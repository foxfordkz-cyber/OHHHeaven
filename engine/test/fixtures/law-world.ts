// Мир для тестов и демо закона: три кафе на одной улице, госслужащие людей и ИИ.
import type { BusinessState, OfficialState, Player, StandingOrders, WorldState } from '../../../shared/src/types';
import type { EngineCtx } from '../../src/law/ctx';
import { lawCafePack, lawCommonPack } from './law-packs';

export const lawCtx: EngineCtx = {
  packs: { common: lawCommonPack, niches: { cafe: lawCafePack } },
  places: [
    { id: 'p1', address: '120 Bedford Ave', block: 'bedford-n7', lat: 40.719, lng: -73.957, kind: 'storefront', sqft: 900, tier: 'mid', rentPerSqftYear: 120, footTraffic: 0.6, suitableFor: ['cafe'] },
    { id: 'p2', address: '134 Bedford Ave', block: 'bedford-n7', lat: 40.7192, lng: -73.9568, kind: 'storefront', sqft: 900, tier: 'mid', rentPerSqftYear: 120, footTraffic: 0.6, suitableFor: ['cafe'] },
    { id: 'p3', address: '150 Bedford Ave', block: 'bedford-n7', lat: 40.7194, lng: -73.9566, kind: 'storefront', sqft: 900, tier: 'mid', rentPerSqftYear: 120, footTraffic: 0.6, suitableFor: ['cafe'] },
  ],
};

const player = (id: string, name: string, kind: Player['kind'], isAi = false, role?: Player['role']): Player => {
  const p: Player = { id, name, kind, isAi, paid: !isAi, joinedDay: 1, lastSeenDay: 1, inbox: [] };
  if (role) p.role = role;
  return p;
};

const official = (id: string, playerId: string, name: string, role: OfficialState['role'], isAi: boolean): OfficialState =>
  ({ id, playerId, name, isAi, role, points: 0, casesClosed: 0, bribesTaken: 0, bribesThisMonth: 0, exposed: false });

export function orders(over: Partial<StandingOrders> = {}): StandingOrders {
  return { price: 6.5, staff: { barista: 4 }, levers: { cleaning: 'standard' }, shortcuts: [], blockFund: false, autopilot: 'hold', ...over };
}

export function business(id: string, name: string, playerId: string, placeId: string, over: Partial<BusinessState> = {}): BusinessState {
  return {
    id, name, niche: 'cafe', placeId, isAi: false, owners: [{ playerId, share: 1 }], managerPlayerId: playerId,
    status: 'open', createdDay: 1, openedDay: 1, cash: 40000, size: 18,
    items: [{ id: 'espresso_machine', qty: 1 }, { id: 'fse_permit', qty: 1 }], setupSpent: 20000,
    permits: [{ itemId: 'fse_permit', appliedDay: 1, readyDay: 1 }],
    quality: 0.6, reputation: 0.6, trust: { kept: 0, broken: 0 }, orders: orders(),
    trails: [], liabilities: [], mtd: { lines: [], demandUnits: 0, servedUnits: 0, lost: { size: 0, staff: 0, closure: 0 } },
    days: [], history: [], ...over,
  };
}

export function lawWorld(over: { day?: number; luna?: Partial<BusinessState>; rival?: Partial<BusinessState>; honest?: Partial<BusinessState> } = {}): WorldState {
  return {
    config: {
      id: 'law-test', name: 'Law test', city: 'nyc', seasonMonths: 12, dayMs: 2000, paused: false, maxOwners: 100, aiBusinessesTarget: 0,
      entryFee: 5, prizeShare: 0.9, officialsShare: 0.05, platformShare: 0.05, nichePrizeTable: [0.5, 0.3, 0.2], demo: true, seed: 1,
    },
    phase: 'running', day: over.day ?? 1, version: 1, bank: 0,
    players: [
      player('pl_luna', 'Maya', 'owner'), player('pl_rival', 'Sam', 'owner'), player('pl_honest', 'Ava', 'owner'),
      player('pl_insp', 'Rosa', 'official', false, 'inspector'), player('pl_aud', 'Dev', 'official', false, 'tax_auditor'),
      player('pl_ai_insp', 'Inspector Kim (AI)', 'official', true, 'inspector'), player('pl_ai_aud', 'Auditor Lee (AI)', 'official', true, 'tax_auditor'),
    ],
    businesses: [
      business('luna', 'Luna Cafe', 'pl_luna', 'p1', over.luna),
      business('rival', 'Rival Roasters', 'pl_rival', 'p2', over.rival),
      business('honest', 'Honest Beans', 'pl_honest', 'p3', over.honest),
    ],
    officials: [
      official('of_insp', 'pl_insp', 'Rosa', 'inspector', false),
      official('of_aud', 'pl_aud', 'Dev', 'tax_auditor', false),
      official('of_ai_insp', 'pl_ai_insp', 'Inspector Kim (AI)', 'inspector', true),
      official('of_ai_aud', 'pl_ai_aud', 'Auditor Lee (AI)', 'tax_auditor', true),
    ],
    deals: [], cases: [], blockFunds: [], weather: [], events: [], feed: [], standings: [],
  };
}

/** Рекурсивно замораживает объект: любая мутация в строгом режиме бросит исключение. */
export function deepFreeze<T>(x: T): T {
  if (x && typeof x === 'object' && !Object.isFrozen(x)) {
    Object.freeze(x);
    for (const v of Object.values(x as Record<string, unknown>)) deepFreeze(v);
  }
  return x;
}
