// Миры, собранные вручную: экономики агента 02 в основной ветке ещё нет.
import type {
  BusinessState, CommonPack, MonthReport, NicheId, OfficialState, Pack, PackSet, Place, Player, WorldState,
} from '../../../shared/src/types';
import { isMonthEnd, dateOf } from '../../../shared/src/rules';
import type { EngineCtx } from '../../src/deals';
import { dealActions, dealsDay, dealsMonthClose } from '../../src/deals';

// Atlantic Ave: четыре витрины в пределах ~250 м. Smith St — в ~600 м.
export const places: Place[] = [
  { id: 'p-a1', address: '100 Atlantic Ave', block: 'Atlantic Ave', lat: 40.6880, lng: -73.9900, kind: 'storefront', sqft: 900, tier: 'mid', rentPerSqftYear: 60, footTraffic: 0.6, suitableFor: ['cafe', 'barbershop', 'bodega'] },
  { id: 'p-a2', address: '110 Atlantic Ave', block: 'Atlantic Ave', lat: 40.6882, lng: -73.9890, kind: 'storefront', sqft: 800, tier: 'mid', rentPerSqftYear: 60, footTraffic: 0.6, suitableFor: ['cafe', 'barbershop', 'bodega'] },
  { id: 'p-a3', address: '120 Atlantic Ave', block: 'Atlantic Ave', lat: 40.6884, lng: -73.9880, kind: 'storefront', sqft: 700, tier: 'mid', rentPerSqftYear: 55, footTraffic: 0.5, suitableFor: ['cafe', 'barbershop', 'bodega'] },
  { id: 'p-a4', address: '130 Atlantic Ave', block: 'Atlantic Ave', lat: 40.6886, lng: -73.9872, kind: 'storefront', sqft: 600, tier: 'cheap', rentPerSqftYear: 45, footTraffic: 0.4, suitableFor: ['cafe', 'barbershop', 'bodega'] },
  { id: 'p-a5', address: '140 Atlantic Ave', block: 'Atlantic Ave', lat: 40.6887, lng: -73.9866, kind: 'storefront', sqft: 600, tier: 'cheap', rentPerSqftYear: 45, footTraffic: 0.4, suitableFor: ['cafe', 'barbershop', 'bodega'] },
  { id: 'p-s1', address: '200 Smith St', block: 'Smith St', lat: 40.6830, lng: -73.9930, kind: 'storefront', sqft: 900, tier: 'prime', rentPerSqftYear: 80, footTraffic: 0.8, suitableFor: ['cafe', 'barbershop', 'bodega'] },
  { id: 'p-s2', address: '210 Smith St', block: 'Smith St', lat: 40.6832, lng: -73.9932, kind: 'storefront', sqft: 900, tier: 'prime', rentPerSqftYear: 80, footTraffic: 0.8, suitableFor: ['cafe', 'barbershop', 'bodega'] },
  { id: 'p-s3', address: '220 Smith St', block: 'Smith St', lat: 40.6834, lng: -73.9934, kind: 'storefront', sqft: 900, tier: 'prime', rentPerSqftYear: 80, footTraffic: 0.8, suitableFor: ['cafe', 'barbershop', 'bodega'] },
];

function pack(id: NicheId, setup: Pack['setup']): Pack {
  return { id, version: 1, name: id, setup } as unknown as Pack;
}

export const packs: PackSet = {
  common: { id: '_common', version: 1, name: 'Common', taxes: [], shortcuts: [], violations: [], officials: [], reports: [], ruleCards: [], roadmap: [], sources: [] } as CommonPack,
  niches: {
    cafe: pack('cafe', [
      { id: 'espresso', name: 'Espresso machine', kind: 'equipment', cost: 8000, required: true },
      { id: 'tables', name: 'Table set', kind: 'furniture', cost: 300, required: true, scalesWithSize: true },
      { id: 'permit', name: 'Food service permit', kind: 'permit', cost: 280, required: true },
    ]),
    barbershop: pack('barbershop', [
      { id: 'chair', name: 'Barber chair', kind: 'equipment', cost: 1500, required: true, scalesWithSize: true },
    ]),
    bodega: pack('bodega', [
      { id: 'shelves', name: 'Shelving', kind: 'furniture', cost: 200, required: true, scalesWithSize: true },
    ]),
  },
};

export const ctx: EngineCtx = { packs, places };

export function makePlayer(id: string, opts: Partial<Player> = {}): Player {
  return { id, name: id, kind: 'owner', isAi: false, paid: true, joinedDay: 1, lastSeenDay: 1, inbox: [], ...opts };
}

export function makeBusiness(id: string, niche: NicheId, placeId: string, owner: string, opts: Partial<BusinessState> = {}): BusinessState {
  return {
    id, name: opts.name ?? id, niche, placeId, isAi: false,
    owners: [{ playerId: owner, share: 1 }], managerPlayerId: owner,
    status: 'open', createdDay: 1, openedDay: 1, cash: 20_000, size: 10, items: [], setupSpent: 0, permits: [],
    quality: 0.6, reputation: 0.6, trust: { kept: 0, broken: 0 },
    orders: { price: 5, staff: {}, levers: {}, shortcuts: [], blockFund: false, autopilot: 'hold' },
    trails: [], liabilities: [],
    mtd: { lines: [], demandUnits: 0, servedUnits: 0, lost: { size: 0, staff: 0, closure: 0 } },
    days: [], history: [],
    ...opts,
  };
}

export function makeOfficial(id: string, playerId: string, points: number, opts: Partial<OfficialState> = {}): OfficialState {
  return { id, playerId, name: id, isAi: false, role: 'inspector', points, casesClosed: 0, bribesTaken: 0, bribesThisMonth: 0, exposed: false, ...opts };
}

export function makeWorld(businesses: BusinessState[], players: Player[], opts: Partial<WorldState> = {}): WorldState {
  return {
    config: {
      id: 'test', name: 'Test City', city: 'nyc', seasonMonths: 12, dayMs: 2000, paused: false, maxOwners: 100,
      aiBusinessesTarget: 0, entryFee: 5, prizeShare: 0.9, officialsShare: 0.05, platformShare: 0.05,
      nichePrizeTable: [0.5, 0.3, 0.2], demo: true, seed: 1,
    },
    phase: 'running', day: 5, version: 1, bank: 0,
    players, businesses, officials: [], deals: [], cases: [], blockFunds: [],
    weather: [], events: [], feed: [], standings: [],
    ...opts,
  };
}

/** Стандартный двор: два кафе и барбершоп на Atlantic Ave, кафе на Smith St. */
export function street(): WorldState {
  return makeWorld(
    [
      makeBusiness('ana', 'cafe', 'p-a1', 'u-ana', { name: "Ana's Cafe" }),
      makeBusiness('kai', 'cafe', 'p-a2', 'u-kai', { name: 'Kai Coffee' }),
      makeBusiness('lena', 'barbershop', 'p-a3', 'u-lena', { name: 'Lena Cuts' }),
      makeBusiness('sam', 'cafe', 'p-s1', 'u-sam', { name: 'Smith Street Cafe' }),
      makeBusiness('rob', 'barbershop', 'p-s2', 'u-rob', { name: 'Rob Fades' }),
    ],
    ['u-ana', 'u-kai', 'u-lena', 'u-sam', 'u-rob'].map((id) => makePlayer(id)),
  );
}

export function act(w: WorldState, playerId: string, action: Parameters<typeof dealActions>[3]): WorldState {
  const r = dealActions(w, ctx, playerId, action);
  if (!r) throw new Error('not a deal action');
  if (r.error) throw new Error(r.error);
  return r.world;
}

export function actErr(w: WorldState, playerId: string, action: Parameters<typeof dealActions>[3]): string {
  const r = dealActions(w, ctx, playerId, action);
  if (!r) throw new Error('not a deal action');
  if (!r.error) throw new Error('expected an error');
  if (r.world !== w) throw new Error('world changed on error');
  return r.error;
}

/** Отчёт месяца, как его оставила бы экономика: строки выручки и расходов дают прибыль. */
export function report(month: number, profit: number, cashEnd: number, revenue = Math.max(profit, 0) + 10_000): MonthReport {
  const cogs = -Math.round(revenue * 0.3);
  const other = profit - revenue - cogs;
  return {
    month, avgPrice: 5, demandUnits: 0, servedUnits: 0, lost: { size: 0, staff: 0, closure: 0 },
    capacityUnits: 0, sizeUtilization: 0,
    lines: [
      { id: 'rev', label: 'Sales', kind: 'revenue', amount: revenue },
      { id: 'cogs', label: 'Supplies', kind: 'cogs', amount: cogs },
      { id: 'other', label: 'Rent and payroll', kind: 'opex', amount: other },
    ],
    revenue, profit, cashStart: cashEnd - profit, cashEnd,
    taxesAccrued: 0, taxesPaid: 0, fines: 0, quality: 0.6, reputation: 0.6, netWorth: cashEnd, rankInNiche: 0,
  };
}

/** Закрытие месяца экономики на заглушке: прибыль ложится в кассу и в отчёт месяца. */
export function economyClose(w: WorldState, profits: Record<string, number> = {}): WorldState {
  const next = structuredClone(w);
  const month = dateOf(next.day).month;
  for (const b of next.businesses) {
    if (b.status === 'bankrupt') continue;
    const p = profits[b.id] ?? 0;
    b.cash = Math.round((b.cash + p) * 100) / 100;
    b.history.push(report(month, p, b.cash));
    b.mtd = { lines: [], demandUnits: 0, servedUnits: 0, lost: { size: 0, staff: 0, closure: 0 } };
  }
  return next;
}

/** Банкротство после закрытия месяца, как в tickDay: касса ниже нуля. */
export function bankruptcyCheck(w: WorldState): WorldState {
  if (!w.businesses.some((b) => b.status !== 'bankrupt' && b.cash < 0)) return w;
  const next = structuredClone(w);
  for (const b of next.businesses) {
    if (b.status !== 'bankrupt' && b.cash < 0) { b.status = 'bankrupt'; b.bankruptDay = next.day; }
  }
  return next;
}

/** Прокрутка дней: dealsDay каждый день, в конце месяца — экономика на заглушке, сделки, банкротство. */
export function advance(w: WorldState, days: number, profits: (month: number) => Record<string, number> = () => ({})): WorldState {
  let cur = w;
  for (let i = 0; i < days; i++) {
    cur = { ...cur, day: cur.day + 1 };
    cur = dealsDay(cur, ctx);
    if (isMonthEnd(cur.day)) {
      cur = economyClose(cur, profits(dateOf(cur.day).month));
      cur = dealsMonthClose(cur, ctx);
      cur = bankruptcyCheck(cur);
    }
  }
  return cur;
}

export function deepFreeze<T>(x: T): T {
  if (x && typeof x === 'object') {
    Object.freeze(x);
    for (const v of Object.values(x as Record<string, unknown>)) deepFreeze(v);
  }
  return x;
}

export const biz = (w: WorldState, id: string): BusinessState => {
  const b = w.businesses.find((x) => x.id === id);
  if (!b) throw new Error(`no business ${id}`);
  return b;
};
