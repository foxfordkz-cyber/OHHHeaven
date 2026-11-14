// One full season of the real demo city (seed 7, same as the server's "demo" world) with six human players:
// four owners and two officials, each playing a fixed character. Everything goes through the same host API
// the server uses (join, act, step, viewFor, answer), so every number in the log comes from the engine.
// Run: npx tsx sim/demo6.ts [out.json]
import { writeFileSync } from 'node:fs';
import { act, answer, defaultConfig, defaultDeps, join, markSeen, newWorld, step, viewFor } from '../host/src/index';
import { loadData } from '../server/src/data';
import { dateOf } from '../shared/src/rules';
import type { Action, Case, NicheId, OfficialRole, OfficialView, OpenRecommendation, OwnerView, Place, RealWorldPlan, RoadmapItem, WorldState } from '../shared/src/types';

const data = loadData();
const ctx = data.ctx;
const deps = defaultDeps();
let w: WorldState = newWorld(defaultConfig({ id: 'demo', name: 'Demo City', demo: true, seed: 7 }), ctx, deps);

const r0 = (n: number | undefined | null) => (n == null ? null : Math.round(n));
const log: any = { setup: {}, timeline: [], months: {}, cases: {}, deals: {}, events: [], feed: [], errors: [], final: {} };
const names: Record<string, string> = {};
const T = (who: string, text: string, extra: object = {}) => log.timeline.push({ day: w.day, date: dateOf(w.day).label, who, text, ...extra });

function J(name: string, kind: 'owner' | 'official', role?: OfficialRole): string {
  const r = join(w, { name, kind, role });
  if (r.error) throw new Error(`join ${name}: ${r.error}`);
  w = r.world; names[r.playerId] = name;
  return r.playerId;
}
function A(pid: string, a: Action, note = ''): boolean {
  const r = act(w, ctx, pid, a);
  if (r.error) { log.errors.push({ day: w.day, who: names[pid], action: a, error: r.error, note }); return false; }
  w = r.world;
  return true;
}
const ov = (pid: string) => viewFor(w, ctx, pid) as OwnerView;
const fv = (pid: string) => viewFor(w, ctx, pid) as OfficialView;
const biz = (pid: string) => w.businesses.find((b) => b.managerPlayerId === pid);
const bizName = (id?: string) => w.businesses.find((b) => b.id === id)?.name ?? id ?? '?';
const dist = (a: Place, b: Place) => {
  const R = 6371000, t = Math.PI / 180, dLat = (b.lat - a.lat) * t, dLng = (b.lng - a.lng) * t;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

// ───────────── the six players ─────────────
log.setup.cityBefore = { day: w.day, aiBusinesses: w.businesses.length, aiOfficials: w.officials.length, byNiche: w.businesses.reduce((m: any, b) => ((m[b.niche] = (m[b.niche] ?? 0) + 1), m), {}) };
const you = J('You', 'owner'), viktor = J('Viktor', 'owner'), leo = J('Leo', 'owner'), bella = J('Bella', 'owner');
const dana = J('Dana', 'official', 'inspector'), sam = J('Sam', 'official', 'tax_auditor');
const owners = [you, viktor, leo, bella];
log.setup.bank = w.bank; log.setup.config = w.config;

// Places: three cafes on one block where possible, the barbershop within 400 m of yours.
const taken = () => new Set(w.businesses.map((b) => b.placeId));
const freeFor = (n: NicheId) => ctx.places.filter((p) => p.suitableFor.includes(n) && !taken().has(p.id));
const byBlock = new Map<string, Place[]>();
for (const p of freeFor('cafe')) byBlock.set(p.block, [...(byBlock.get(p.block) ?? []), p]);
const block = [...byBlock.entries()].sort((a, b) => b[1].length - a[1].length)[0][1];
const pick = (tier: string, used: Place[]) => block.find((p) => p.tier === tier && !used.includes(p)) ?? block.find((p) => !used.includes(p)) ?? freeFor('cafe').find((p) => !used.includes(p))!;
const pYou = pick('mid', []);
const pViktor = pick('cheap', [pYou]);
const pLeo = pick('prime', [pYou, pViktor]);
const pBella = freeFor('barbershop').filter((p) => ![pYou, pViktor, pLeo].includes(p)).sort((a, b) => dist(a, pYou) - dist(b, pYou))[0];

function open(pid: string, niche: NicheId, place: Place, name: string, kitId: string) {
  const recs = answer(w, ctx, pid, { type: 'recommend_opening', niche, placeId: place.id }) as OpenRecommendation[];
  const kit = recs.find((k) => k.kitId === kitId) ?? recs[0];
  const pack = ctx.packs.niches[niche]!;
  const ok = A(pid, { type: 'open_business', niche, placeId: place.id, name, kitId: kit.kitId, size: kit.size, items: kit.items }, 'open') && A(pid, { type: 'set_orders', orders: kit.orders }, 'first orders');
  const b = biz(pid);
  log.setup[names[pid]] = {
    ok, niche, name, startCapital: pack.startCapital,
    place: { address: place.address, block: place.block, tier: place.tier, sqft: place.sqft, rentMonth: r0((place.sqft * place.rentPerSqftYear) / 12), footTraffic: place.footTraffic, metersFromYou: r0(dist(place, pYou)) },
    kits: recs.map((k) => ({ kitId: k.kitId, size: k.size, total: r0(k.total), cashLeft: r0(k.cashLeft), daysToOpen: k.daysToOpen, price: k.orders.price, staff: k.orders.staff, why: k.why })),
    chosen: kit.kitId, cashAfterOpening: r0(b?.cash), setupSpent: r0(b?.setupSpent), permits: b?.permits, orders: b?.orders,
  };
  T(names[pid], `opens "${name}" (${niche}) at ${place.address}: kit ${kit.kitId}, ${kit.size} ${pack.sizing.unitName}s, spent $${r0(b?.setupSpent)}, cash left $${r0(b?.cash)}`);
}
open(you, 'cafe', pYou, 'Your Cafe', 'standard');
open(viktor, 'cafe', pViktor, "Viktor's Espresso", 'lean');
open(leo, 'cafe', pLeo, 'Leo Roasters', 'premium');
open(bella, 'barbershop', pBella, 'Bella Cuts', 'standard');
log.setup.roadmapYou = (answer(w, ctx, you, { type: 'roadmap', niche: 'cafe' }) as RoadmapItem[]).map((s) => ({ title: s.title, kind: s.kind, fee: s.fee, waitDays: s.waitDays, agency: s.agency, status: s.status }));

// ───────────── characters ─────────────
const RESTROOM = 'customer_restroom';
const launched = new Set<string>();
function launchWhenReady(pid: string, early = false) {
  const b = biz(pid);
  if (!b || b.status !== 'setup' || launched.has(pid)) return;
  const ready = b.permits.every((p) => p.readyDay <= w.day);
  if (!ready && !early) return;
  if (A(pid, { type: 'launch' }, 'launch')) { launched.add(pid); T(names[pid], ready ? 'opens the doors with every permit ready' : 'opens the doors EARLY, before the permits are ready (violation)'); }
}

function applyAdvice(pid: string) {
  const v = ov(pid);
  for (const rec of v.recommendations ?? []) {
    const s = rec.suggested;
    if (!s) continue;
    if (s.type === 'set_orders' && (s.orders.shortcuts?.length ?? 0) > 0) continue;       // never the illegal way
    if (s.type === 'propose_deal' || s.type === 'report') continue;                         // deals and reports are scripted below
    if ((rec.impact?.profitDeltaMonth ?? 0) <= 0 && rec.severity !== 'critical') continue;
    if (A(pid, s, `advice ${rec.id}`)) T(names[pid], `applies the advice "${rec.title}"`, { text2: rec.text, impactMonth: r0(rec.impact?.profitDeltaMonth), action: s });
  }
}

function answerNotices(pid: string, how: 'pay' | 'contest' | 'bribe', bribe = 0) {
  const mine = biz(pid)?.id;
  for (const c of w.cases) {
    if (c.businessId !== mine || c.status !== 'notice') continue;
    const n = { caseId: c.id, fine: c.fine };
    const resp: Action = how === 'bribe' ? { type: 'answer_notice', caseId: n.caseId, response: 'bribe', bribeAmount: bribe } : { type: 'answer_notice', caseId: n.caseId, response: how };
    if (A(pid, resp, 'notice')) T(names[pid], how === 'bribe' ? `answers the notice (fine $${r0(n.fine)}) with a bribe offer of $${bribe}` : `answers the notice: ${how} (fine $${r0(n.fine)})`, { caseId: n.caseId });
  }
}

function answerDeals(pid: string, accept: (kind: string, fromHuman: boolean) => boolean) {
  const b = biz(pid);
  if (!b) return;
  for (const d of w.deals) {
    if (d.status !== 'proposed' || d.toBusinessId !== b.id) continue;
    const from = w.businesses.find((x) => x.id === d.fromBusinessId);
    const yes = accept(d.terms.type, !from?.isAi);
    if (A(pid, { type: 'answer_deal', dealId: d.id, accept: yes }, 'answer deal')) T(names[pid], `${yes ? 'accepts' : 'declines'} ${d.terms.type} from ${from?.name}`, { terms: d.terms });
  }
}

function officialDay(pid: string, takesBribes: boolean) {
  const me = w.officials.find((o) => o.playerId === pid)!;
  const card = (c: Case) => ({ caseId: c.id, status: c.status, bribeAmount: c.bribeAmount, origin: c.origin, hints: c.hints, business: { name: bizName(c.businessId) } });
  const v = { mine: w.cases.filter((c) => c.officialId === me.id).map(card), queue: w.cases.filter((c) => c.status === 'open' && c.role === me.role).map(card) };
  for (const c of v.mine ?? []) {
    if (c.status !== 'bribe_offered') continue;
    const yes = takesBribes && (c.bribeAmount ?? 0) >= 1000;
    if (A(pid, { type: 'answer_bribe', caseId: c.caseId, accept: yes }, 'bribe')) T(names[pid], `${yes ? 'TAKES' : 'refuses'} the $${r0(c.bribeAmount)} bribe from ${c.business.name}`, { caseId: c.caseId });
  }
  let n = 0;
  for (const c of v.queue ?? []) {
    if (c.status !== 'open' || n >= 2) continue;
    if (A(pid, { type: 'take_case', caseId: c.caseId }, 'take')) { n += 1; T(names[pid], `takes case ${c.caseId} on ${c.business.name} (${c.origin}${c.hints?.length ? `: ${c.hints[0]}` : ''})`, { caseId: c.caseId }); }
  }
}

const propose = (from: string, to: string, terms: any) => {
  const tb = biz(to);
  if (!tb) return;
  if (A(from, { type: 'propose_deal', toBusinessId: tb.id, terms }, 'propose')) T(names[from], `offers ${terms.type} to ${tb.name}`, { terms });
};
const report = (from: string, target: string, reportId: string) => {
  const tb = biz(target);
  if (!tb) return;
  if (A(from, { type: 'report', targetBusinessId: tb.id, reportId }, 'report')) T(names[from], `reports ${tb.name} to the city: ${reportId}`);
};

// ───────────── the season, day by day ─────────────
function humansAct() {
  const d = w.day;
  // Viktor: opens early, pays wages in cash off the books.
  if (d === 2) { launchWhenReady(viktor, true); if (A(viktor, { type: 'set_orders', orders: { shortcuts: ['cash_wages'] } }, 'shortcut')) T('Viktor', 'starts paying wages in cash, off the books (shortcut cash_wages)'); }
  for (const p of [you, leo, bella]) launchWhenReady(p);
  // Leo: saves on cleaning and pest control from the first day.
  if (d === 1 && A(leo, { type: 'set_orders', orders: { levers: { ...biz(leo)!.orders.levers, cleaning: 'minimal', pest_control: 'none' } } }, 'levers')) T('Leo', 'sets cleaning to "minimal" and cancels pest control to save money');
  // You: log in twice a week, follow the system's advice, pay what you owe.
  if (d === 23 && A(you, { type: 'buy_item', itemId: RESTROOM, qty: 1 }, 'restroom')) T('You', 'buys the customer restroom upgrade: the law requires it for 20 or more seats');
  if (d % 3 === 0 && !(d >= 200 && d <= 230)) { w = markSeen(w, you); applyAdvice(you); }
  if (d === 231) log.awayYou = ov(you).away;
  answerNotices(you, 'pay');
  answerNotices(bella, 'contest');
  answerNotices(viktor, 'bribe', 5000);
  answerNotices(leo, 'bribe', 1500);
  answerDeals(you, (_k, human) => human);
  answerDeals(bella, (_k, human) => human);
  answerDeals(leo, (k, human) => human && k !== 'partnership');
  answerDeals(viktor, (k, human) => human && k === 'loan');
  // Cooperation.
  if (d === 35) propose(you, bella, { type: 'cross_promo', months: 3 });
  if (d === 36) propose(you, leo, { type: 'joint_purchase', months: 3 });
  if (d === 40) for (const p of [you, bella]) if (A(p, { type: 'set_orders', orders: { blockFund: true } }, 'block fund')) T(names[p], 'joins the block fund ($300 a month)');
  if (d === 150) propose(bella, you, { type: 'partnership', amount: 20000, sharePct: 10 });
  // Attacks.
  if (d === 70) report(viktor, you, 'report_unsanitary');          // a false report
  if (d === 95) report(you, viktor, 'report_cash_wages');           // a true one
  if (d === 100) propose(bella, viktor, { type: 'loan', amount: 10000, monthlyRatePct: 3, months: 4 });
  if (d === 130) report(bella, leo, 'report_unsanitary');           // a true one
  // Officials log in every day.
  officialDay(sam, false);
  officialDay(dana, true);
}

const seenCase: Record<string, string> = {};
const seenDeal: Record<string, string> = {};
const humanBiz = () => new Set(owners.map((p) => biz(p)?.id).filter(Boolean) as string[]);
const humanOff = () => new Set(w.officials.filter((o) => !o.isAi).map((o) => o.id));

function afterStep() {
  const hb = humanBiz(), ho = humanOff();
  for (const c of w.cases as Case[]) {
    if (!hb.has(c.businessId) && !(c.officialId && ho.has(c.officialId)) && !(c.reporterBusinessId && hb.has(c.reporterBusinessId))) continue;
    const key = `${c.status}/${c.outcome ?? ''}/${c.response ?? ''}`;
    if (seenCase[c.id] === key) continue;
    seenCase[c.id] = key;
    const off = w.officials.find((o) => o.id === c.officialId);
    (log.cases[c.id] ??= { target: bizName(c.businessId), role: c.role, origin: c.origin, reportId: c.reportId, reporter: c.reporterBusinessId ? bizName(c.reporterBusinessId) : undefined, openedDay: c.openedDay, hints: c.hints, steps: [] }).steps.push({
      day: w.day, status: c.status, official: off ? `${off.name}${off.isAi ? ' (AI)' : ''}` : undefined, found: c.found?.map((f) => ({ ...f, fine: r0(f.fine) })), fine: r0(c.fine), closureDays: c.closureDays, response: c.response, bribeAmount: c.bribeAmount, outcome: c.outcome,
    });
  }
  for (const d of w.deals) {
    if (!hb.has(d.fromBusinessId) && !hb.has(d.toBusinessId)) continue;
    if (seenDeal[d.id] === d.status) continue;
    seenDeal[d.id] = d.status;
    (log.deals[d.id] ??= { from: bizName(d.fromBusinessId), to: bizName(d.toBusinessId), terms: d.terms, steps: [] }).steps.push({ day: w.day, status: d.status, paidBack: r0(d.paidBack) });
  }
  if (w.day % 30 === 0) {
    const m = w.day / 30;
    log.months[m] = {
      owners: Object.fromEntries(owners.map((p) => {
        const b = biz(p)!; const h = b.history.at(-1);
        const top = (h?.lines ?? []).reduce((acc: Record<string, number>, l) => ((acc[l.kind] = (acc[l.kind] ?? 0) + l.amount), acc), {});
        return [names[p], {
          status: b.status, price: b.orders.price, size: b.size, staff: b.orders.staff, levers: b.orders.levers, shortcuts: b.orders.shortcuts, blockFund: b.orders.blockFund,
          demand: r0(h?.demandUnits), served: r0(h?.servedUnits), lost: h ? { size: r0(h.lost.size), staff: r0(h.lost.staff), closure: r0(h.lost.closure) } : null,
          revenue: r0(h?.revenue), profit: r0(h?.profit), cashEnd: r0(b.cash), netWorth: r0(h?.netWorth), rank: h?.rankInNiche, quality: h?.quality, reputation: h?.reputation,
          fines: r0(h?.fines), taxesAccrued: r0(h?.taxesAccrued), taxesPaid: r0(h?.taxesPaid), byKind: Object.fromEntries(Object.entries(top).map(([k, x]) => [k, r0(x)])),
          trails: b.trails.map((t) => ({ id: t.violationId, months: t.months, saved: r0(t.saved), discovered: t.discovered })), owedTaxes: r0(b.liabilities.filter((l) => !l.paid).reduce((s, l) => s + l.amount, 0)), owners: b.owners,
        }];
      })),
      officials: w.officials.filter((o) => !o.isAi || o.points !== 0).map((o) => ({ name: o.name, ai: o.isAi, role: o.role, points: o.points, cases: o.casesClosed, bribesTaken: r0(o.bribesTaken), exposed: o.exposed })),
      city: { open: w.businesses.filter((b) => b.status === 'open').length, bankrupt: w.businesses.filter((b) => b.status === 'bankrupt').length, bank: w.bank },
      blockFunds: w.blockFunds.filter((f) => f.block === pYou.block || f.block === pBella.block),
    };
  }
}

const seenEvents = new Set<string>(); const seenFeed = new Set<string>();
const MAXDAY = Number(process.env.DAYS) || 400; let t0 = Date.now();
while (w.phase === 'running' && w.day < MAXDAY) {
  if (w.day % 10 === 0) { console.error('day', w.day, Date.now() - t0, 'ms', 'biz', w.businesses.length, 'cases', w.cases.length, 'feed', w.feed.length); t0 = Date.now(); }
  humansAct();
  w = step(w, ctx, deps);
  for (const e of w.events) if (!seenEvents.has(e.id)) { seenEvents.add(e.id); log.events.push({ announcedDay: e.announcedDay, startDay: e.startDay, endDay: e.endDay, start: dateOf(e.startDay).label, title: e.title, text: e.text, kind: e.kind, effects: e.effects, origin: e.origin }); }
  for (const f of w.feed) if (!seenFeed.has(f.id)) { seenFeed.add(f.id); log.feed.push({ day: f.day, kind: f.kind, text: f.text }); }
  afterStep();
}

// ───────────── the end ─────────────
const nameOf = (pid: string) => w.players.find((p) => p.id === pid)?.name ?? pid;
log.final = {
  day: w.day, phase: w.phase, bank: w.bank,
  standings: w.standings.filter((s) => !s.isAi || s.rank <= 3).map((s) => ({ niche: s.niche, rank: s.rank, name: bizName(s.businessId), ai: s.isAi, bankrupt: s.bankrupt, netWorth: r0(s.netWorth), prize: s.prize })),
  humansAmongAll: Object.fromEntries(owners.map((p) => { const b = biz(p)!; const s = w.standings.find((x) => x.businessId === b.id); return [names[p], { niche: b.niche, rankAmongAllInNiche: s?.rank, of: w.standings.filter((x) => x.niche === b.niche).length, netWorth: r0(s?.netWorth), status: b.status, bankruptDay: b.bankruptDay }]; })),
  payouts: (w.payouts ?? []).map((p) => ({ ...p, name: p.kind === 'platform' ? 'platform' : nameOf(p.playerId) })),
  officials: w.officials.map((o) => ({ name: o.name, ai: o.isAi, role: o.role, points: o.points, cases: o.casesClosed, bribesTaken: r0(o.bribesTaken), exposed: o.exposed })),
  aiBankrupt: w.businesses.filter((b) => b.isAi && b.status === 'bankrupt').length, aiTotal: w.businesses.filter((b) => b.isAi).length,
  planYou: (() => { const p = answer(w, ctx, you, { type: 'real_world_plan' }) as RealWorldPlan; return p && { startupTotal: r0(p.startupTotal), startupBudget: p.startupBudget, monthlyTotal: r0(p.monthlyTotal), monthlyCosts: p.monthlyCosts, reserveAdvised: r0(p.reserveAdvised), breakEvenUnitsMonth: r0(p.breakEvenUnitsMonth), paybackMonths: p.paybackMonths, checklist: p.checklist?.length, suppliers: p.suppliers?.length, lessons: p.lessons }; })(),
  awayYou: ov(you).away,
};
const out = process.argv[2] ?? 'sim/demo6.out.json';
writeFileSync(out, JSON.stringify(log, null, 1));
console.log(`season ended on day ${w.day} (${w.phase}); log → ${out}; timeline ${log.timeline.length}, cases ${Object.keys(log.cases).length}, deals ${Object.keys(log.deals).length}, errors ${log.errors.length}`);
