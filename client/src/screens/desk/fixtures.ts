// Sample OfficialView data for /dev/desk and tests. Businesses, the world and the packs are the same as in the
// network fixtures; names of people are made up. Fines are placeholders (estimate), the engine sets real ones.
import type { CaseCard, FoundViolation, OfficialState, OfficialView, Player } from '../../../../shared/src/types';
import { neighbors, ownerView, packs, TODAY, world } from '../network/fixtures';
import type { CaseCardMaybe } from './logic';

export { packs, TODAY };

const biz = (id: string) => neighbors.find((b) => b.id === id)!;

const card = (caseId: string, businessId: string, origin: CaseCard['origin'], openedDay: number, hints: string[], extra: Partial<CaseCardMaybe> = {}): CaseCardMaybe =>
  ({ caseId, business: biz(businessId), role: 'inspector', origin, openedDay, hints, status: 'open', ...extra });

const pests = (months: number, fine: number): FoundViolation => ({ violationId: 'pests', months, fine, closureDays: 2 });
const dirty = (months: number, fine: number): FoundViolation => ({ violationId: 'dirty_surfaces', months, fine, closureDays: 0 });

export const official: OfficialState = {
  id: 'off_dana', playerId: 'pl_dana', name: 'Dana Ortiz', isAi: false, role: 'inspector',
  points: 40, casesClosed: 6, bribesTaken: 0, bribesThisMonth: 0, exposed: false,
};

export const officialPlayer: Player = { id: 'pl_dana', name: 'Dana Ortiz', kind: 'official', isAi: false, paid: false, role: 'inspector', joinedDay: 10, lastSeenDay: TODAY, inbox: [] };

export const queue: CaseCardMaybe[] = [
  card('c21', 'b_tompkins', 'report', TODAY - 1, ['Neighbor report: sticky counters and a sour smell', 'No deep clean recorded in 3 months']),
  card('c22', 'b_stmarks', 'routine', TODAY - 2, ['Routine inspection: 6 months since the last one']),
  card('c23', 'b_fade', 'flag', TODAY, ['Cleaning spend is half the norm for a shop this size']),
];

export const mine: CaseCardMaybe[] = [
  card('c11', 'b_avea', 'report', TODAY - 1, ['Neighbor report: mice seen near the back door'], { status: 'taken' }),
  card('c13', 'b_cuppa', 'flag', TODAY - 3, ['Pest control invoices stopped two months ago'], { status: 'bribe_offered', found: [pests(3, 950)], bribeAmount: 400 }),
  card('c12', 'b_ninth', 'report', TODAY - 4, ['Neighbor report: droppings by the pastry case'], { status: 'notice', found: [pests(2, 700), dirty(1, 300)] }),
  card('c10', 'b_les', 'routine', TODAY - 7, ['Routine inspection'], { status: 'closed', found: [dirty(1, 300)], outcome: 'fined', fine: 300 }),
  card('c14', 'b_fade', 'report', TODAY - 17, ['Neighbor report: hair on the floor all day'], { status: 'closed', found: [], outcome: 'clean' }),
];

export const ranking: OfficialView['ranking'] = [
  { name: 'Inspector Reyes (AI)', points: 55, isAi: true },
  { name: 'Dana Ortiz', points: 40, isAi: false },
  { name: 'Sam Lee', points: 20, isAi: false },
  { name: 'Tax desk (AI)', points: 10, isAi: true },
];

const base = { kind: 'official' as const, me: officialPlayer, world, weather: ownerView.weather, events: ownerView.events, feed: ownerView.feed };

export const officialView: OfficialView = { ...base, official, queue, mine, ranking };

/** A new official on a quiet day: nothing in the queue, no cases yet. */
export const officialViewEmpty: OfficialView = {
  ...base, official: { ...official, points: 0, casesClosed: 0 }, queue: [], mine: [],
  ranking: ranking.map((r) => (r.name === official.name ? { ...r, points: 0 } : r)),
};

/** Internal Affairs exposed this official this month. */
export const officialViewExposed: OfficialView = {
  ...base,
  official: { ...official, points: 0, exposed: true, suspendedUntilDay: TODAY + 20, bribesTaken: 1_150, bribesThisMonth: 0 },
  queue: [],
  mine: [card('c13', 'b_cuppa', 'flag', TODAY - 3, ['Pest control invoices stopped two months ago'], { status: 'closed', found: [pests(3, 950)], bribeAmount: 400, outcome: 'bribed' })],
  ranking: ranking.map((r) => (r.name === official.name ? { ...r, points: 0 } : r)),
};
