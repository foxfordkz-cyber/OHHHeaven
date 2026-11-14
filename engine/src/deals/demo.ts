// Демо модуля сделок: сезон из шести бизнесов со сделками и итоговыми выплатами.
// Запуск: npx tsx engine/src/deals/demo.ts
// Экономики агента 02 ещё нет: месяц считает простая детерминированная заглушка ниже,
// а множители сделок берутся из dealModifiers — так видно, что сделки меняют деньги.
import type { Action, BusinessState, NicheId, Pack, PackSet, Place, Player, WorldState } from '../../../shared/src/types';
import { RULES, dateOf, isMonthEnd } from '../../../shared/src/rules';
import type { EngineCtx } from './ctx';
import { computeStandings, dealActions, dealModifiers, dealsDay, dealsMonthClose, finalizeSeason } from './index';
import { fmtMoney } from './util';

const places: Place[] = [
  { id: 'a1', address: '100 Atlantic Ave', block: 'Atlantic Ave', lat: 40.6880, lng: -73.9900, kind: 'storefront', sqft: 900, tier: 'mid', rentPerSqftYear: 60, footTraffic: 0.6, suitableFor: ['cafe', 'barbershop'] },
  { id: 'a2', address: '112 Atlantic Ave', block: 'Atlantic Ave', lat: 40.6882, lng: -73.9890, kind: 'storefront', sqft: 800, tier: 'mid', rentPerSqftYear: 60, footTraffic: 0.6, suitableFor: ['cafe', 'barbershop'] },
  { id: 'a3', address: '124 Atlantic Ave', block: 'Atlantic Ave', lat: 40.6884, lng: -73.9880, kind: 'storefront', sqft: 700, tier: 'mid', rentPerSqftYear: 55, footTraffic: 0.5, suitableFor: ['cafe', 'barbershop'] },
  { id: 'a4', address: '136 Atlantic Ave', block: 'Atlantic Ave', lat: 40.6886, lng: -73.9872, kind: 'storefront', sqft: 600, tier: 'cheap', rentPerSqftYear: 45, footTraffic: 0.4, suitableFor: ['cafe', 'barbershop'] },
  { id: 's1', address: '200 Smith St', block: 'Smith St', lat: 40.6830, lng: -73.9930, kind: 'storefront', sqft: 900, tier: 'prime', rentPerSqftYear: 80, footTraffic: 0.8, suitableFor: ['cafe', 'barbershop'] },
  { id: 's2', address: '212 Smith St', block: 'Smith St', lat: 40.6832, lng: -73.9932, kind: 'storefront', sqft: 900, tier: 'prime', rentPerSqftYear: 80, footTraffic: 0.8, suitableFor: ['cafe', 'barbershop'] },
];

const packs: PackSet = {
  common: { id: '_common', version: 1, name: 'Common', taxes: [], shortcuts: [], violations: [], officials: [], reports: [], ruleCards: [], roadmap: [], sources: [] },
  niches: {
    cafe: { id: 'cafe', setup: [{ id: 'espresso', name: 'Espresso machine', kind: 'equipment', cost: 9000, required: true }] } as unknown as Pack,
    barbershop: { id: 'barbershop', setup: [{ id: 'chair', name: 'Barber chair', kind: 'equipment', cost: 1500, required: true }] } as unknown as Pack,
  },
};
const ctx: EngineCtx = { packs, places };

// Заглушка экономики: дневная выручка и доли расходов. У Dan с апреля спад: он сорвёт заём и разорится.
const ECON: Record<string, { revenueDay: number; cogsShare: number; fixedMonth: number; slump?: [number, number, number] }> = {
  ana: { revenueDay: 1300, cogsShare: 0.32, fixedMonth: 25_500 },
  kai: { revenueDay: 1150, cogsShare: 0.32, fixedMonth: 23_400 },
  bot1: { revenueDay: 1250, cogsShare: 0.33, fixedMonth: 25_800 },
  lena: { revenueDay: 950, cogsShare: 0.12, fixedMonth: 21_800 },
  dan: { revenueDay: 820, cogsShare: 0.12, fixedMonth: 21_900, slump: [4, 12, 0.6] },
  bot2: { revenueDay: 900, cogsShare: 0.12, fixedMonth: 21_200 },
};

function business(id: string, name: string, niche: NicheId, placeId: string, owner: string, isAi: boolean, item: string, blockFund: boolean): BusinessState {
  return {
    id, name, niche, placeId, isAi, owners: [{ playerId: owner, share: 1 }], managerPlayerId: owner,
    status: 'open', createdDay: 1, openedDay: 1, cash: 30_000, size: 12, items: [{ id: item, qty: 1 }], setupSpent: 0, permits: [],
    quality: 0.6, reputation: 0.6, trust: { kept: 0, broken: 0 },
    orders: { price: 5, staff: {}, levers: {}, shortcuts: [], blockFund, autopilot: 'hold' },
    trails: [], liabilities: [], mtd: { lines: [], demandUnits: 0, servedUnits: 0, lost: { size: 0, staff: 0, closure: 0 } },
    days: [], history: [],
  };
}

const player = (id: string, name: string, kind: Player['kind'] = 'owner', isAi = false): Player =>
  ({ id, name, kind, isAi, paid: !isAi, joinedDay: 1, lastSeenDay: 1, inbox: [] });

let w: WorldState = {
  config: { id: 'demo', name: 'Demo Brooklyn', city: 'nyc', seasonMonths: 12, dayMs: RULES.DAY_MS_DEMO, paused: false, maxOwners: 100, aiBusinessesTarget: 2, entryFee: 5, prizeShare: 0.9, officialsShare: 0.05, platformShare: 0.05, nichePrizeTable: [0.5, 0.3, 0.2], demo: true, seed: 7 },
  phase: 'running', day: 1, version: 1, bank: 4 * 5,
  players: [player('u-ana', 'Ana'), player('u-kai', 'Kai'), player('u-lena', 'Lena'), player('u-dan', 'Dan'), player('u-bot1', 'Brew Bot', 'owner', true), player('u-bot2', 'Trim Bot', 'owner', true), player('u-ivy', 'Ivy', 'official'), player('u-gov', 'City AI', 'official', true)],
  businesses: [
    business('ana', "Ana's Corner Cafe", 'cafe', 'a1', 'u-ana', false, 'espresso', true),
    business('kai', 'Kai Coffee', 'cafe', 'a2', 'u-kai', false, 'espresso', true),
    business('bot1', 'Brew Bot (AI)', 'cafe', 's1', 'u-bot1', true, 'espresso', false),
    business('lena', 'Lena Cuts', 'barbershop', 'a3', 'u-lena', false, 'chair', true),
    business('dan', "Dan's Fades", 'barbershop', 'a4', 'u-dan', false, 'chair', false),
    business('bot2', 'Trim Bot (AI)', 'barbershop', 's2', 'u-bot2', true, 'chair', false),
  ],
  officials: [
    { id: 'o-ivy', playerId: 'u-ivy', name: 'Ivy', isAi: false, role: 'inspector', points: 40, casesClosed: 5, bribesTaken: 0, bribesThisMonth: 0, exposed: false },
    { id: 'o-gov', playerId: 'u-gov', name: 'City AI', isAi: true, role: 'tax_auditor', points: 70, casesClosed: 9, bribesTaken: 0, bribesThisMonth: 0, exposed: false },
  ],
  deals: [], cases: [], blockFunds: [], weather: [], events: [], feed: [], standings: [],
};

const byId = (id: string) => w.businesses.find((b) => b.id === id)!;
const lastDealId = () => w.deals[w.deals.length - 1].id;

function act(playerId: string, a: Action): void {
  const r = dealActions(w, ctx, playerId, a);
  if (!r || r.error) throw new Error(`${playerId}: ${r?.error ?? 'not a deal action'}`);
  w = r.world;
}

// Сценарий сделок по дням.
const script: Record<number, () => void> = {
  2: () => { act('u-ana', { type: 'propose_deal', toBusinessId: 'kai', terms: { type: 'joint_purchase', months: 6 } }); act('u-kai', { type: 'answer_deal', dealId: lastDealId(), accept: true }); },
  3: () => { act('u-lena', { type: 'propose_deal', toBusinessId: 'ana', terms: { type: 'cross_promo', months: 4 } }); act('u-ana', { type: 'answer_deal', dealId: lastDealId(), accept: true }); },
  4: () => { act('u-ana', { type: 'propose_deal', toBusinessId: 'lena', terms: { type: 'partnership', amount: 8000, sharePct: 25 } }); act('u-lena', { type: 'answer_deal', dealId: lastDealId(), accept: true }); },
  5: () => { act('u-kai', { type: 'propose_deal', toBusinessId: 'dan', terms: { type: 'loan', amount: 6000, monthlyRatePct: 3, months: 3 } }); act('u-dan', { type: 'answer_deal', dealId: lastDealId(), accept: true }); },
  6: () => { act('u-dan', { type: 'propose_deal', toBusinessId: 'kai', terms: { type: 'cross_promo', months: 2 } }); },           // Kai не ответит — истечёт
  95: () => { act('u-lena', { type: 'propose_deal', toBusinessId: 'dan', terms: { type: 'loan', amount: 5000, monthlyRatePct: 4, months: 6 } }); act('u-dan', { type: 'answer_deal', dealId: lastDealId(), accept: true }); },
  140: () => { act('u-kai', { type: 'cancel_deal', dealId: w.deals.find((d) => d.terms.type === 'joint_purchase' && d.status === 'active')!.id }); },
};

// Заглушка экономики: день копит выручку и себестоимость в mtd с множителями сделок; месяц — постоянные расходы и отчёт.
function economyDayStub(): void {
  const next = structuredClone(w);
  for (const b of next.businesses) {
    if (b.status !== 'open') continue;
    const e = ECON[b.id];
    const m = dealModifiers(w, ctx, b.id);
    const month = dateOf(next.day).month;
    const slump = e.slump && month >= e.slump[0] && month <= e.slump[1] ? e.slump[2] : 1;
    const units = e.revenueDay * m.demandMult * m.footTrafficMult * slump;
    const revenue = Math.round(units * m.priceMult * 100) / 100;
    const cogs = -Math.round(units * e.cogsShare * m.cogsMult * 100) / 100;
    b.cash = Math.round((b.cash + revenue + cogs) * 100) / 100;
    b.mtd.lines.push({ id: `rev-${next.day}`, label: 'Sales', kind: 'revenue', amount: revenue }, { id: `cogs-${next.day}`, label: 'Supplies', kind: 'cogs', amount: cogs });
  }
  w = next;
}

function economyMonthCloseStub(): void {
  const next = structuredClone(w);
  const month = dateOf(next.day).month;
  for (const b of next.businesses) {
    if (b.status === 'bankrupt') continue;
    const fixed = -ECON[b.id].fixedMonth;
    const sales = b.mtd.lines.filter((l) => l.kind === 'revenue' || l.kind === 'cogs');
    const revenue = sales.filter((l) => l.kind === 'revenue').reduce((s, l) => s + l.amount, 0);
    const salesNet = sales.reduce((s, l) => s + l.amount, 0);
    const otherMtd = b.mtd.lines.filter((l) => l.kind !== 'revenue' && l.kind !== 'cogs');
    const cashEnd = Math.round((b.cash + fixed) * 100) / 100;
    const lines = [
      { id: 'sales', label: 'Sales', kind: 'revenue' as const, amount: Math.round(revenue * 100) / 100 },
      { id: 'supplies', label: 'Supplies', kind: 'cogs' as const, amount: Math.round((salesNet - revenue) * 100) / 100 },
      { id: 'fixed', label: 'Rent, payroll and taxes', kind: 'opex' as const, amount: fixed },
      ...otherMtd,
    ];
    const moved = lines.reduce((s, l) => s + l.amount, 0);
    b.history.push({
      month, avgPrice: 5, demandUnits: 0, servedUnits: 0, lost: { size: 0, staff: 0, closure: 0 }, capacityUnits: 0, sizeUtilization: 0,
      lines, revenue: Math.round(revenue * 100) / 100, profit: Math.round((salesNet + fixed) * 100) / 100,
      cashStart: Math.round((cashEnd - moved) * 100) / 100, cashEnd, taxesAccrued: 0, taxesPaid: 0, fines: 0,
      quality: 0.6, reputation: 0.6, netWorth: cashEnd, rankInNiche: 0,
    });
    b.cash = cashEnd;
    b.mtd = { lines: [], demandUnits: 0, servedUnits: 0, lost: { size: 0, staff: 0, closure: 0 } };
  }
  w = next;
}

function bankruptcies(): void {
  const next = structuredClone(w);
  for (const b of next.businesses) {
    if (b.status !== 'bankrupt' && b.cash < 0) { b.status = 'bankrupt'; b.bankruptDay = next.day; }
  }
  w = next;
}

const feedSeen = new Set<string>();
function printFeed(): void {
  for (const f of w.feed) {
    if (feedSeen.has(f.id)) continue;
    feedSeen.add(f.id);
    console.log(`  day ${String(f.day).padStart(3)}  ${f.text}`);
  }
}

console.log(`First Year — deals demo: ${w.businesses.length} businesses, ${w.config.seasonMonths} months, bank ${fmtMoney(w.bank)}\n`);
for (let day = 2; day <= 30 * w.config.seasonMonths; day++) {
  w = { ...w, day };
  w = dealsDay(w, ctx);
  economyDayStub();
  if (isMonthEnd(day)) {
    economyMonthCloseStub();
    w = dealsMonthClose(w, ctx);
    bankruptcies();
    w = { ...w, standings: computeStandings(w, ctx) };
  }
  script[day]?.();                                   // игроки действуют в течение дня, после расчёта города
  printFeed();
  if (isMonthEnd(day)) {
    const cash = w.businesses.map((b) => `${b.id} ${fmtMoney(Math.round(b.cash))}${b.status === 'bankrupt' ? ' (bankrupt)' : ''}`).join(' · ');
    console.log(`month ${String(dateOf(day).month).padStart(2)}: ${cash}`);
  }
}
w = finalizeSeason(w, ctx);
printFeed();

console.log('\nDeals:');
for (const d of w.deals) {
  const from = byId(d.fromBusinessId).name;
  const to = byId(d.toBusinessId).name;
  const extra = d.terms.type === 'loan' ? `, paid back ${fmtMoney(d.paidBack ?? 0)} of ${fmtMoney(d.terms.amount)}` : '';
  console.log(`  ${d.id.padEnd(11)} ${d.terms.type.padEnd(14)} ${from} → ${to}: ${d.status}${extra}`);
}

console.log('\nTrust (kept / broken) and owners:');
for (const b of w.businesses) {
  const owners = b.owners.map((o) => `${w.players.find((p) => p.id === o.playerId)!.name} ${Math.round(o.share * 100)}%`).join(', ');
  console.log(`  ${b.name.padEnd(18)} ${b.trust.kept} / ${b.trust.broken}   owners: ${owners}`);
}

console.log('\nFinal standings:');
for (const s of w.standings) {
  const b = byId(s.businessId);
  console.log(`  ${s.niche.padEnd(10)} #${s.rank} ${b.name.padEnd(18)} ${fmtMoney(s.netWorth).padStart(10)}${s.isAi ? '  AI' : ''}${s.bankrupt ? '  bankrupt' : ''}`);
}

console.log('\nPayouts:');
const name = (id: string) => w.players.find((p) => p.id === id)?.name ?? id;
for (const p of w.payouts ?? []) {
  const where = p.kind === 'owner' ? `${p.niche} prize, place ${p.rank}` : p.kind === 'official' ? 'officials pool' : 'platform';
  console.log(`  ${name(p.playerId).padEnd(10)} ${fmtMoney(p.amount).padStart(8)}  ${where}`);
}
const total = Math.round((w.payouts ?? []).reduce((s, p) => s + p.amount * 100, 0));
console.log(`\nSum of payouts ${fmtMoney(total / 100)} = bank ${fmtMoney(w.bank)}: ${total === Math.round(w.bank * 100) ? 'OK' : 'MISMATCH'}`);
