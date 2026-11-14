// End-of-season debrief. The three biggest losses come from the engine (RealWorldPlan.lessons) unchanged;
// the AI only writes the headline, what went well and what to do next time. Templates otherwise.
import * as z from 'zod/v4';
import type { Analytics, BusinessState, Debrief, RealWorldPlan } from './shared';
import { callAi } from './provider';
import { BANNED } from './events/themes';
import { grounded, money, pct, plainEnglish } from './text';

export interface DebriefInput { business: BusinessState; analytics: Analytics; plan: RealWorldPlan; rank: number }

function rulesDebrief(input: DebriefInput): Debrief {
  const { business: b, analytics: a, plan, rank } = input;
  const lost = plan.lessons.slice(0, 3);
  const headline = b.status === 'bankrupt'
    ? `Bankrupt in month ${Math.max(1, Math.ceil((b.bankruptDay ?? a.month * 30) / 30))}: here is what sank it`
    : rank >= 1 && rank <= 3 ? `#${rank} in your niche with ${money(a.netWorth)} net worth` : `Finished #${rank} with ${money(a.netWorth)} net worth`;
  const didWell: string[] = [];
  for (const bm of a.benchmarks.filter(x => x.verdict === 'good').slice(0, 2)) didWell.push(`${bm.metric.replace(/Pct$/, '')} at ${pct(bm.you)} of revenue beat the industry's ${pct(bm.industry)}.`);
  if (a.cumulativeProfit > 0) didWell.push(`You made ${money(a.cumulativeProfit)} in total profit.`);
  if (a.netMarginPct > 0 && didWell.length < 3) didWell.push(`You kept a ${pct(a.netMarginPct)} net margin.`);
  if (a.utilization >= 0.75 && didWell.length < 3) didWell.push(`You kept the business busy: ${pct(a.utilization)} of capacity used.`);
  if (b.trust.kept > 0 && didWell.length < 3) didWell.push(`You kept ${b.trust.kept} deal${b.trust.kept === 1 ? '' : 's'} with neighbors.`);
  if (didWell.length === 0) didWell.push('You ran a real business for a season and saw every bill it brings.');
  const nextTime: string[] = [];
  if (plan.reserveAdvised > 0) nextTime.push(`Start with a cash reserve of about ${money(plan.reserveAdvised)} on top of the ${money(plan.startupTotal)} setup.`);
  if (plan.breakEvenUnitsMonth) nextTime.push(`Plan to reach about ${Math.round(plan.breakEvenUnitsMonth).toLocaleString('en-US')} sales a month to break even.`);
  for (const l of lost) if (nextTime.length < 3) nextTime.push(`Watch for this: ${l.title.charAt(0).toLowerCase()}${l.title.slice(1)} cost you ${money(l.amount)}.`);
  return { headline, lostMoneyOn: lost, didWell: didWell.slice(0, 3), nextTime: nextTime.slice(0, 3), origin: 'rules' };
}

const DebriefSchema = z.object({ headline: z.string(), didWell: z.array(z.string()), nextTime: z.array(z.string()) });

export const DEBRIEF_SYSTEM = [
  'You write the end-of-season debrief in First Year, a New York City small business simulation, for a player who wants to open a real business.',
  'Use ONLY the numbers given. Write a headline under 80 characters, two or three things that went well and two or three concrete things to do next time, each one sentence under 160 characters.',
  'Plain American English, warm and direct. The money lost is already listed; do not repeat it as a list. Never invent numbers.',
].join('\n');

export async function writeDebrief(input: DebriefInput): Promise<Debrief> {
  try {
    const fallback = rulesDebrief(input);
    const { business: b, analytics: a, plan, rank } = input;
    const facts = {
      businessName: b.name, niche: b.niche, status: b.status, rank, netWorth: Math.round(a.netWorth), cumulativeProfit: Math.round(a.cumulativeProfit),
      netMarginPct: a.netMarginPct, utilization: a.utilization, cogsPct: a.cogsPct, laborPct: a.laborPct, rentPct: a.rentPct, benchmarks: a.benchmarks,
      startupTotal: plan.startupTotal, monthlyTotal: plan.monthlyTotal, reserveAdvised: plan.reserveAdvised, breakEvenUnitsMonth: plan.breakEvenUnitsMonth,
      paybackMonths: plan.paybackMonths, dealsKept: b.trust.kept, dealsBroken: b.trust.broken, lessons: plan.lessons,
    };
    const numbers = [...JSON.stringify(facts).matchAll(/-?\d+(\.\d+)?/g)].map(m => Number(m[0]));
    const ai = await callAi({ task: 'debrief', system: DEBRIEF_SYSTEM, prompt: JSON.stringify(facts), schema: DebriefSchema, maxTokens: 1500 }, out => {
      const headline = out.headline.trim();
      const lists = [out.didWell, out.nextTime].map(l => l.map(x => x.trim()).filter(Boolean));
      const all = [headline, ...lists.flat()];
      if (headline.length < 5 || headline.length > 80) return { ok: false, reason: 'headline length' };
      if (lists.some(l => l.length < 1 || l.length > 3 || l.some(x => x.length > 160))) return { ok: false, reason: 'list size' };
      if (all.some(x => !plainEnglish(x) || BANNED.test(x))) return { ok: false, reason: 'text' };
      if (!all.every(x => grounded(x, numbers))) return { ok: false, reason: 'number not in the data' };
      return { ok: true, value: { headline, lostMoneyOn: fallback.lostMoneyOn, didWell: lists[0], nextTime: lists[1], origin: 'ai' as const } };
    });
    return ai ?? fallback;
  } catch {
    return { headline: 'Your season is over', lostMoneyOn: input?.plan?.lessons?.slice(0, 3) ?? [], didWell: [], nextTime: [], origin: 'rules' };
  }
}
