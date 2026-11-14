// "Ask the advisor": answers from the player's own numbers and the niche's rule cards only.
// AI path: the model writes at most 90 words from the selected cards; code checks words, numbers and sources.
// Rules path (no key, timeout, bad answer): the same cards and numbers through templates, origin 'rules'.
import * as z from 'zod/v4';
import type { AdvisorAnswer, Analytics, BusinessState, CommonPack, Pack, PackShortcut, PackStaffRole, PackViolation } from './shared';
import { callAi } from './provider';
import { expand, grounded, limitWords, money, overlap, pct, plainEnglish, tokens, wordCount } from './text';

export interface AdvisorInput { question: string; business: BusinessState; analytics: Analytics; pack: Pack; common: CommonPack }

export const MAX_WORDS = 90;

interface Card { id: string; title: string; text: string; url: string }
type Intent = 'shortcut' | 'hire' | 'supplier' | 'permit' | 'tax' | 'price' | 'rent' | 'money' | 'general';

const INTENTS: [Intent, RegExp][] = [
  ['shortcut', /\b(cash wages?|pay (them |staff |workers )?(in )?cash|off the books|under the table|skip(ping)?|without (a |the )?(permit|license)|shortcut|cut(ting)? corners?|bribe|illegal|cheat)/i],
  ['hire', /\b(hire|hiring|another (barista|barber|worker|employee)|third|second (barista|barber)|more staff|staff|barista|barber|employee|worker|lay ?off|fire someone)/i],
  ['supplier', /\b(supplier|vendor|wholesale|roaster|distributor|where (do|can|should) i (find|buy|get)|buy (beans|milk|supplies)|supplies)\b/i],
  ['permit', /\b(permit|license|licence|inspection|inspector|letter grade|grade|health department|register|llc|ein)\b/i],
  ['tax', /\b(tax|taxes|irs|sales tax)\b/i],
  ['price', /\b(price|pricing|charge|raise|discount|expensive|cheaper)\b/i],
  ['rent', /\b(rent|lease|landlord)\b/i],
  ['money', /\b(profit|loss|losing|break[- ]?even|cash|runway|money|margin|payback|survive)\b/i],
];

export function intentOf(question: string): Intent {
  for (const [intent, re] of INTENTS) if (re.test(question)) return intent;
  return 'general';
}

const url = (s?: string) => (s && /^https?:\/\//.test(s) ? s : '');

function fineText(v: PackViolation): string {
  const parts: string[] = [];
  if (v.fine.base) parts.push(money(v.fine.base));
  if (v.fine.perMonth) parts.push(`${money(v.fine.perMonth)} per month`);
  if (v.fine.pctOfSaved) parts.push(`${Math.round(v.fine.pctOfSaved * 100)}% of what you saved`);
  const cap = v.fine.max ? `, up to ${money(v.fine.max)}` : '';
  return parts.length ? `${parts.join(' + ')}${cap}` : 'a fine';
}

export function fineAfter(v: PackViolation, months: number, savedPerMonth: number): number {
  const raw = (v.fine.base ?? 0) + (v.fine.perMonth ?? 0) * months + (v.fine.pctOfSaved ?? 0) * savedPerMonth * months;
  return v.fine.max ? Math.min(raw, v.fine.max) : raw;
}

function roles(pack: Pack): PackStaffRole[] {
  return pack.staff ?? [];
}

export function monthlyPayroll(b: BusinessState, pack: Pack): number {
  return roles(pack).reduce((s, r) => s + (b.orders.staff[r.id] ?? 0) * r.hourlyWage * r.hoursPerMonth, 0);
}

export function shortcutSavingMonth(sc: PackShortcut, b: BusinessState, a: Analytics, pack: Pack): number {
  const staffCount = Object.values(b.orders.staff).reduce((s, n) => s + n, 0);
  const rent = a.rentPct * a.revenue;
  switch (sc.saves.basis) {
    case 'fixed': return sc.saves.amount;
    case 'pct_payroll': return sc.saves.amount * monthlyPayroll(b, pack);
    case 'pct_revenue': return sc.saves.amount * a.revenue;
    case 'pct_rent': return sc.saves.amount * rent;
    case 'per_staff': return sc.saves.amount * staffCount;
  }
}

function cardsOf(pack: Pack, common: CommonPack): Card[] {
  const violations = [...pack.violations, ...common.violations];
  const out: Card[] = [];
  for (const c of [...pack.ruleCards, ...common.ruleCards]) out.push({ id: `rule:${c.id}`, title: c.title, text: c.text, url: url(c.source) });
  for (const v of violations) out.push({ id: `law:${v.id}`, title: v.name, text: `${v.name}. Law: ${v.law}. Found by ${v.foundBy.join(', ')}. Fine: ${fineText(v)}.${v.closureDays ? ` Closure ${v.closureDays} days.` : ''}${v.criminal ? ` ${v.criminal}` : ''}`, url: url(v.source) });
  for (const s of [...pack.shortcuts, ...common.shortcuts]) out.push({ id: `shortcut:${s.id}`, title: s.name, text: `${s.name}. ${s.what} Violation: ${violations.find(v => v.id === s.violation)?.name ?? s.violation}.`, url: '' });
  for (const r of [...pack.roadmap, ...common.roadmap]) out.push({ id: `step:${r.id}`, title: r.title, text: `${r.title}. ${r.text}${r.agency ? ` Agency: ${r.agency}.` : ''}${r.fee ? ` Fee ${money(r.fee)}.` : ''}${r.waitDays ? ` About ${r.waitDays} days.` : ''}`, url: url(r.link) });
  for (const s of pack.suppliers) out.push({ id: `supplier:${s.id}`, title: s.category, text: `${s.category}: ${stop(s.what)} Where to find: ${stop(s.whereToFind)}${s.examples ? ` Examples: ${stop(s.examples)}` : ''}`, url: url(s.link) });
  for (const r of roles(pack)) out.push({ id: `staff:${r.id}`, title: r.name, text: `${r.name}: ${money(r.hourlyWage)} an hour, ${r.hoursPerMonth} hours a month${r.tipped ? `, tipped, cash wage ${money(r.cashWage ?? r.hourlyWage)}` : ''}${r.licenseRequired ? `, needs ${r.licenseRequired}` : ''}.`, url: url(r.source) });
  for (const t of [...pack.taxes, ...common.taxes]) out.push({ id: `tax:${t.id}`, title: t.name, text: `${t.name}: ${(t.rate * 100).toFixed(3).replace(/\.?0+$/, '')}% of ${t.base.replace('_', ' ')}, paid ${t.due}${t.appliesIf ? ` (${t.appliesIf})` : ''}.`, url: url(t.source) });
  for (const s of pack.setup.filter(x => x.kind === 'permit' || x.kind === 'license')) out.push({ id: `setup:${s.id}`, title: s.name, text: `${s.name}${s.agency ? ` from ${s.agency}` : ''}: ${money(s.cost)}${s.waitDays ? `, about ${s.waitDays} days` : ''}.`, url: url(s.link ?? s.source) });
  return out;
}

const INTENT_PREFIX: Record<Intent, string[]> = {
  shortcut: ['shortcut:', 'law:', 'rule:'], hire: ['staff:', 'rule:'], supplier: ['supplier:', 'step:'], permit: ['setup:', 'step:', 'law:', 'rule:'],
  tax: ['tax:', 'rule:'], price: ['rule:'], rent: ['rule:', 'step:'], money: ['rule:'], general: ['rule:', 'step:', 'law:'],
};

/** Cards most related to the question: word overlap first, then the intent's kinds of cards. */
export function selectCards(question: string, pack: Pack, common: CommonPack, limit = 6): Card[] {
  const q = expand(tokens(question));
  const intent = intentOf(question);
  const prefixes = INTENT_PREFIX[intent];
  return cardsOf(pack, common)
    .map(c => ({ c, hits: overlap(q, `${c.title} ${c.text}`) }))
    .filter(x => x.hits > 0)
    .map(x => ({ c: x.c, score: x.hits * 2 + (prefixes.some(p => x.c.id.startsWith(p)) ? 1 : 0) }))
    .sort((a, b) => b.score - a.score || a.c.id.localeCompare(b.c.id))
    .slice(0, limit)
    .map(x => x.c);
}

interface Calc { text: string; used: string[]; facts: number[] }

function bench(a: Analytics, metric: string): number | undefined {
  return a.benchmarks.find(b => b.metric === metric)?.industry;
}

function hireAnswer(input: AdvisorInput): Calc {
  const { question, business: b, analytics: a, pack } = input;
  const q = question.toLowerCase();
  const role = roles(pack).find(r => q.includes(r.name.toLowerCase()) || q.includes(r.id)) ?? roles(pack)[0];
  if (!role) return { text: 'This niche has no staff roles in its data yet.', used: [], facts: [] };
  const cost = role.hourlyWage * role.hoursPerMonth;
  const cap = pack.capacity.unitsPerStaffMonth ?? 0;
  const lostStaff = b.days.reduce((s, d) => s + d.lost.staff, 0);
  const lostSize = b.days.reduce((s, d) => s + d.lost.size, 0);
  const lost = Math.round(a.lostSalesUnits);
  const recoverable = Math.min(lost, cap);
  const gain = recoverable * a.contributionPerUnit;
  const net = gain - cost;
  const industry = bench(a, 'laborPct') ?? pack.benchmarks.laborPct;
  const unit = pack.unit.name;
  const facts = [cost, role.hourlyWage, role.hoursPerMonth, cap, lost, a.lostSalesMoney, recoverable, gain, net, a.contributionPerUnit, a.laborPct, industry, a.utilization, lostStaff, lostSize];
  const wageCard = [...pack.ruleCards, ...input.common.ruleCards].find(c => /minimum wage|tipped|wage/i.test(`${c.title} ${c.text}`) && /^https?:/.test(c.source));
  const used = [`staff:${role.id}`, ...(wageCard ? [`rule:${wageCard.id}`] : [])];
  if (lostSize > lostStaff && lostSize > 0) {
    return { text: `Not first. Most lost ${unit}s came from a full room (${Math.round(lostSize)} from size, ${Math.round(lostStaff)} from staff). More seats would help before another ${role.name.toLowerCase()}, who costs about ${money(cost)} a month (${money(role.hourlyWage)} an hour for ${role.hoursPerMonth} hours).`, used, facts };
  }
  if (lost > 0 && net > 0) {
    return { text: `Likely yes. This month you turned away about ${lost} ${unit}s (${money(a.lostSalesMoney)} of sales). A ${role.name.toLowerCase()} costs about ${money(cost)} a month (${money(role.hourlyWage)} an hour for ${role.hoursPerMonth} hours) and can handle up to ${cap} more. At ${money(a.contributionPerUnit)} margin per ${unit}, that is up to ${money(gain)}, about ${money(net)} more profit. Labor is ${pct(a.laborPct)} of revenue against ${pct(industry)} for the industry.`, used, facts };
  }
  if (lost > 0) {
    return { text: `Not yet. You lost about ${lost} ${unit}s, worth ${money(gain)} in margin, but a ${role.name.toLowerCase()} costs about ${money(cost)} a month. Labor is already ${pct(a.laborPct)} of revenue against ${pct(industry)} for the industry. Try longer shifts at the rush first.`, used, facts };
  }
  const newPct = a.revenue > 0 ? (a.laborPct * a.revenue + cost) / a.revenue : a.laborPct;
  facts.push(newPct);
  return { text: `Probably not. No ${unit}s were lost to a queue this month (utilization ${pct(a.utilization)}). Another ${role.name.toLowerCase()} adds about ${money(cost)} a month and would push labor from ${pct(a.laborPct)} to about ${pct(newPct)} of revenue; the industry runs near ${pct(industry)}.`, used, facts };
}

function shortcutAnswer(input: AdvisorInput, cards: Card[]): Calc {
  const { question, business: b, analytics: a, pack, common } = input;
  const all = [...pack.shortcuts, ...common.shortcuts];
  const q = expand(tokens(question));
  const sc = [...all].sort((x, y) => overlap(q, `${y.id} ${y.name} ${y.what}`) - overlap(q, `${x.id} ${x.name} ${x.what}`))[0];
  if (!sc) return generalAnswer(input, cards);
  const v = [...pack.violations, ...common.violations].find(x => x.id === sc.violation);
  const saved = shortcutSavingMonth(sc, b, a, pack);
  if (!v) return { text: `The shortcut "${sc.name}" saves about ${money(saved)} a month. ${sc.what}`, used: [`shortcut:${sc.id}`], facts: [saved] };
  const fine6 = fineAfter(v, 6, saved);
  const facts = [saved, saved * 6, fine6, v.fine.base ?? 0, v.fine.perMonth ?? 0, (v.fine.pctOfSaved ?? 0) * 100, v.fine.max ?? 0, v.closureDays ?? 0];
  const found = v.foundBy.join(' or ').replace('inspection', 'an inspection').replace('audit', 'an audit').replace('complaint', 'a complaint');
  const compare = fine6 >= saved * 6 ? `more than the ${money(saved * 6)} you would have saved` : `on top of paying back what you skipped; you would have saved ${money(saved * 6)}`;
  const text = `The shortcut "${sc.name}" saves about ${money(saved)} a month. It is "${v.name}" under ${v.law}. If ${found} finds it after 6 months, the fine is about ${money(fine6)}, ${compare}${v.closureDays ? `, and you close for ${v.closureDays} days` : ''}. ${v.criminal ?? 'The trail stays on your record for months after you stop.'}`;
  return { text, used: [`shortcut:${sc.id}`, `law:${v.id}`], facts };
}

/** Ends a pack sentence with one full stop: pack texts sometimes carry their own ("…across the city."). */
function stop(t: string): string {
  const s = t.trim();
  return /[.!?]["')\]]?$/.test(s) ? s : `${s}.`;
}

function supplierAnswer(input: AdvisorInput, cards: Card[]): Calc {
  const { question, analytics: a, pack } = input;
  const q = expand(tokens(question));
  const ranked = [...pack.suppliers].sort((x, y) => overlap(q, `${y.category} ${y.what}`) - overlap(q, `${x.category} ${x.what}`));
  const top = ranked.filter((s, i) => i === 0 || overlap(q, `${s.category} ${s.what}`) > 0).slice(0, 2);
  if (top.length === 0) return generalAnswer(input, cards);
  const industry = bench(a, 'cogsPct') ?? pack.benchmarks.cogsPct;
  const lines = top.map(s => `${s.category}: ${stop(s.whereToFind)}`).join(' ');
  return { text: `${lines} Ingredients and supplies are ${pct(a.cogsPct)} of your revenue against ${pct(industry)} for the industry, so ask at least three suppliers for prices.`, used: top.map(s => `supplier:${s.id}`), facts: [a.cogsPct, industry] };
}

function permitAnswer(input: AdvisorInput, cards: Card[]): Calc {
  const { pack, common } = input;
  const permits = pack.setup.filter(s => s.kind === 'permit' || s.kind === 'license');
  const q = expand(tokens(input.question));
  const p = [...permits].sort((x, y) => overlap(q, y.name) - overlap(q, x.name))[0];
  if (!p) return generalAnswer(input, cards);
  const v = p.withoutItViolation ? [...pack.violations, ...common.violations].find(x => x.id === p.withoutItViolation) : undefined;
  const grade = cards.find(c => c.id.startsWith('rule:') && /inspect|grade/i.test(c.text));
  const text = `You need the ${p.name}${p.agency ? ` from ${p.agency}` : ''}: ${money(p.cost)}${p.waitDays ? `, about ${p.waitDays} days to get it` : ''}. Apply before you open; rent runs while you wait.${v ? ` Opening without it is "${v.name}": ${fineText(v)}${v.closureDays ? ` and ${v.closureDays} days closed` : ''}.` : ''}${grade ? ` ${grade.text}` : ''}`;
  return { text, used: [`setup:${p.id}`, ...(v ? [`law:${v.id}`] : []), ...(grade ? [grade.id] : [])], facts: [p.cost, p.waitDays ?? 0, v?.fine.base ?? 0, v?.fine.perMonth ?? 0, v?.fine.max ?? 0, v?.closureDays ?? 0] };
}

function taxAnswer(input: AdvisorInput): Calc {
  const { analytics: a, pack, common } = input;
  const taxes = [...pack.taxes, ...common.taxes].slice(0, 2);
  const due = a.taxDueNext ? `Your next tax payment is about ${money(a.taxDueNext.amount)} on day ${a.taxDueNext.day}. ` : '';
  const list = taxes.map(t => `${t.name} is ${(t.rate * 100).toFixed(3).replace(/\.?0+$/, '')}% of ${t.base.replace('_', ' ')}${t.appliesIf ? ` on ${t.appliesIf}` : ''}, paid ${t.due}.`).join(' ');
  return { text: `${due}${list} Keep sales tax you collect in a separate account: it is not your money.`, used: taxes.map(t => `tax:${t.id}`), facts: [a.taxDueNext?.amount ?? 0, a.taxDueNext?.day ?? 0, ...taxes.map(t => t.rate * 100)] };
}

function priceAnswer(input: AdvisorInput): Calc {
  const { business: b, analytics: a, pack } = input;
  const e = Math.abs(pack.market.priceElasticity);
  const loss5 = 5 * e;
  const be = a.breakEvenPrice !== null ? ` Your break-even price at this volume is ${money(a.breakEvenPrice)}.` : '';
  return { text: `At ${money(b.orders.price)} each ${pack.unit.name} leaves ${money(a.contributionPerUnit)} after variable costs.${be} In this niche a 5% price rise loses about ${loss5.toFixed(0)}% of ${pack.unit.name}s, so raise prices in small steps and watch your daily count.`, used: [], facts: [b.orders.price, a.contributionPerUnit, a.breakEvenPrice ?? 0, 5, loss5, e] };
}

function rentAnswer(input: AdvisorInput, cards: Card[]): Calc {
  const { analytics: a, pack } = input;
  const industry = bench(a, 'rentPct') ?? pack.benchmarks.rentPct;
  const verdict = a.rentPct > industry * 1.5 ? 'That is heavy: grow sales or look for a cheaper place when the lease ends.' : 'That is in a healthy range.';
  const step = cards.find(c => c.id.startsWith('step:') && /lease|space|rent/i.test(c.text));
  return { text: `Rent is ${pct(a.rentPct)} of your revenue against ${pct(industry)} for the industry. ${verdict}`, used: step ? [step.id] : [], facts: [a.rentPct, industry] };
}

function moneyAnswer(input: AdvisorInput): Calc {
  const { analytics: a, pack } = input;
  const runway = a.cashRunwayMonths === null ? 'You are making money, so cash is not running out.' : `At this pace your cash lasts about ${a.cashRunwayMonths.toFixed(1)} months.`;
  const be = a.breakEvenUnitsMonth !== null ? ` Break-even is about ${Math.round(a.breakEvenUnitsMonth).toLocaleString('en-US')} ${pack.unit.name}s a month.` : '';
  const pay = a.paybackMonths !== null ? ` Your setup of ${money(a.setupInvested)} pays back in about ${a.paybackMonths} months.` : '';
  return { text: `This month you are on track for ${money(a.revenue)} in sales and ${money(a.profit)} profit (${pct(a.netMarginPct)} margin).${be}${pay} ${runway}`, used: [], facts: [a.revenue, a.profit, a.netMarginPct, a.breakEvenUnitsMonth ?? 0, a.setupInvested, a.paybackMonths ?? 0, a.cashRunwayMonths ?? 0] };
}

function generalAnswer(input: AdvisorInput, cards: Card[]): Calc {
  const { analytics: a } = input;
  const card = cards[0];
  const tail = ` Right now you are on track for ${money(a.profit)} profit this month.`;
  if (!card) return { text: `I can answer from your numbers and the city rules. ${tail.trim()} Ask about staff, prices, permits, taxes, suppliers or shortcuts.`, used: [], facts: [a.profit] };
  const body = card.text.toLowerCase().startsWith(card.title.toLowerCase()) ? card.text : `${card.title}: ${card.text}`;
  return { text: `${body}${tail}`, used: [card.id], facts: [a.profit, ...[...card.text.matchAll(/\d[\d,.]*/g)].map(m => Number(m[0].replace(/,/g, '')))] };
}

function rulesAnswer(input: AdvisorInput, cards: Card[]): Calc {
  switch (intentOf(input.question)) {
    case 'shortcut': return shortcutAnswer(input, cards);
    case 'hire': return hireAnswer(input);
    case 'supplier': return supplierAnswer(input, cards);
    case 'permit': return permitAnswer(input, cards);
    case 'tax': return taxAnswer(input);
    case 'price': return priceAnswer(input);
    case 'rent': return rentAnswer(input, cards);
    case 'money': return moneyAnswer(input);
    default: return generalAnswer(input, cards);
  }
}

function sourcesFor(ids: string[], cards: Card[], all: Card[]): AdvisorAnswer['sources'] {
  const seen = new Set<string>();
  const out: AdvisorAnswer['sources'] = [];
  for (const id of ids) {
    const c = cards.find(x => x.id === id) ?? all.find(x => x.id === id);
    if (!c || !c.url || seen.has(c.url)) continue;
    seen.add(c.url);
    out.push({ title: c.title, url: c.url });
  }
  return out;
}

const AdvisorSchema = z.object({ answer: z.string(), usedIds: z.array(z.string()) });

export const ADVISOR_SYSTEM = [
  'You are the business advisor inside First Year, a New York City small business simulation.',
  'Answer the owner\'s question using ONLY the numbers in BUSINESS and the facts in CARDS. If they do not cover the question, say so in one sentence.',
  `At most ${MAX_WORDS} words, plain American English, no lists. Include at least one number from the data and copy numbers exactly as given.`,
  'Put the ids of the cards you used in usedIds.',
  'About shortcuts and violations be honest: say how much it saves and what the law and the fine are if it is found. Never encourage breaking the law or hiding it.',
].join('\n');

export async function askAdvisor(input: AdvisorInput): Promise<AdvisorAnswer> {
  try {
    const all = cardsOf(input.pack, input.common);
    const cards = selectCards(input.question, input.pack, input.common);
    const calc = rulesAnswer(input, cards);
    const offered = [...new Map([...cards, ...all.filter(c => calc.used.includes(c.id))].map(c => [c.id, c])).values()];
    const fallback: AdvisorAnswer = { answer: limitWords(calc.text, MAX_WORDS), sources: sourcesFor(calc.used, offered, all), origin: 'rules' };
    if (input.question.trim().length < 3) return fallback;

    const { business: b, analytics: a, pack } = input;
    const facts = {
      niche: pack.name, unit: pack.unit.name, price: b.orders.price, cash: Math.round(b.cash), staff: b.orders.staff, size: b.size,
      month: a.month, revenueThisMonth: Math.round(a.revenue), profitThisMonth: Math.round(a.profit),
      cogsPct: a.cogsPct, laborPct: a.laborPct, rentPct: a.rentPct, netMarginPct: a.netMarginPct,
      contributionPerUnit: a.contributionPerUnit, breakEvenUnitsMonth: a.breakEvenUnitsMonth, breakEvenPrice: a.breakEvenPrice,
      utilization: a.utilization, lostSalesUnits: a.lostSalesUnits, lostSalesMoney: Math.round(a.lostSalesMoney),
      cashRunwayMonths: a.cashRunwayMonths, paybackMonths: a.paybackMonths, taxDueNext: a.taxDueNext, exposure: a.exposure,
      benchmarks: a.benchmarks, shortcutsOn: b.orders.shortcuts, calculated: calc.text,
    };
    const numbers = [...JSON.stringify(facts).matchAll(/-?\d+(\.\d+)?/g)].map(m => Number(m[0])).concat(calc.facts)
      .concat(offered.flatMap(c => [...`${c.title} ${c.text}`.matchAll(/\d[\d,]*(\.\d+)?/g)].map(m => Number(m[0].replace(/,/g, '')))));
    const prompt = JSON.stringify({ question: input.question.slice(0, 500), BUSINESS: facts, CARDS: offered.map(c => ({ id: c.id, title: c.title, text: c.text })) });

    const ai = await callAi({ task: 'advisor', system: ADVISOR_SYSTEM, prompt, schema: AdvisorSchema, maxTokens: 1500 }, out => {
      const answer = out.answer.trim().replace(/\s+/g, ' ');
      if (wordCount(answer) > MAX_WORDS) return { ok: false, reason: 'too long' };
      if (!plainEnglish(answer)) return { ok: false, reason: 'not plain English' };
      if (!/\d/.test(answer)) return { ok: false, reason: 'no number' };
      if (!grounded(answer, numbers)) return { ok: false, reason: 'number not in the data' };
      if (/\b(get away with|won'?t get caught|nobody will (notice|know)|no one will (notice|know)|go ahead and (pay|skip|hide))\b/i.test(answer)) return { ok: false, reason: 'encourages a violation' };
      const ids = out.usedIds.filter(id => offered.some(c => c.id === id));
      return { ok: true, value: { answer, sources: sourcesFor(ids, offered, all), origin: 'ai' as const } };
    });
    return ai ?? fallback;
  } catch {
    return { answer: 'The advisor is unavailable right now. Check the Insights tab for your numbers.', sources: [], origin: 'rules' };
  }
}
