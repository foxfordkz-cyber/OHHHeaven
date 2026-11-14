// One season, day by day: weather, events, AI residents act through Action, managers, tickDay.
// Shared by sim/season.ts and the @ohh/bots tests.
import type { Action, NicheId, OfficialRole, PackSet, Place, WorldConfig, WorldState } from '../shared/src/types';
import { RULES } from '../shared/src/rules';
import { createBotBrain, type BotBrain, type BrainOptions } from '../bots/src/brain';
import { FIRST, LAST } from '../bots/src/names';
import { mulberry32, shuffle } from '../bots/src/rng';
import type { OfficialStrategy, OwnerStrategy } from '../bots/src/strategies';
import type { Ctx, EngineApi } from './engine';

export interface OwnerSpec { strategy: OwnerStrategy; niche: NicheId }
export interface SeasonSetup {
  seed: number;
  owners: OwnerSpec[];
  officials: { role: OfficialRole; strategy: OfficialStrategy }[];
  packs: PackSet;
  places: Place[];
  months?: number;
  weather?: 'nyc' | 'flat';
  events?: boolean;
  brain?: Omit<BrainOptions, 'strategyOf' | 'nicheOf'>;
  tuning?: Ctx['tuning'];
  /** stop early (tests): last day to simulate */
  days?: number;
  /** collect invalid actions instead of ignoring them (tests) */
  recordErrors?: boolean;
}

export interface OwnerResult { playerId: string; name: string; strategy: OwnerStrategy; niche: NicheId; businessId?: string; netWorth: number; bankrupt: boolean; bankruptDay?: number; rank: number; prizePlace: boolean; profit: number; fines: number; savings: number; cashAtMonth3: number | null; bankruptByMonth3: boolean }
export interface SeasonResult { world: WorldState; owners: OwnerResult[]; errors: { playerId: string; action: Action; error: string }[]; actions: number }

export const DEFAULT_OFFICIALS: SeasonSetup['officials'] = [
  { role: 'inspector', strategy: 'complaint_chaser' },
  { role: 'inspector', strategy: 'bribe_taker' },
  { role: 'tax_auditor', strategy: 'hint_hunter' },
];

export function seasonConfig(seed: number, months = 12): WorldConfig {
  return { id: `sim-${seed}`, name: 'Simulated season', city: 'nyc', seasonMonths: months, dayMs: RULES.DAY_MS_DEMO, paused: false, maxOwners: 100, aiBusinessesTarget: 0, entryFee: 5, prizeShare: 0.9, officialsShare: 0.05, platformShare: 0.05, nichePrizeTable: [0.5, 0.3, 0.2], demo: true, seed };
}

export function runSeason(api: EngineApi, setup: SeasonSetup): SeasonResult {
  const ctx: Ctx = { packs: setup.packs, places: setup.places, tuning: setup.tuning };
  const months = setup.months ?? 12;
  let w = api.createWorld(seasonConfig(setup.seed, months));
  const rng = mulberry32(setup.seed);
  const names = shuffle(rng, FIRST.flatMap((f) => LAST.map((l) => `${f} ${l}`)));
  const strat = new Map<string, OwnerStrategy | OfficialStrategy>();
  const niche = new Map<string, NicheId>();
  const ownerIds: string[] = [], officialIds: string[] = [];
  setup.owners.forEach((o, k) => {
    const r = api.join(w, { name: names[k], kind: 'owner', isAi: false, paid: true });
    w = r.world; ownerIds.push(r.playerId); strat.set(r.playerId, o.strategy); niche.set(r.playerId, o.niche);
  });
  setup.officials.forEach((o, k) => {
    const r = api.join(w, { name: names[setup.owners.length + k], kind: 'official', role: o.role, isAi: true });
    w = r.world; officialIds.push(r.playerId); strat.set(r.playerId, o.strategy);
  });
  const brain: BotBrain = createBotBrain({ ...setup.brain, strategyOf: (p) => strat.get(p.id), nicheOf: (p) => niche.get(p.id), recommendOpening: (n, pl, ww, c) => api.recommendOpening(n, pl, ww, c as Ctx) });
  const errors: SeasonResult['errors'] = [];
  let actions = 0;
  const apply = (pid: string, a: Action) => {
    actions++;
    const res = api.applyAction(w, ctx, pid, a);
    if (res.error) { if (setup.recordErrors) errors.push({ playerId: pid, action: a, error: res.error }); return; }
    w = res.world;
  };
  const lastDay = Math.min(setup.days ?? Infinity, months * RULES.DAYS_PER_MONTH);
  const cash3 = new Map<string, number>();
  for (let day = 1; day <= lastDay && w.phase === 'running'; day++) {
    const weather = setup.weather === 'flat'
      ? Array.from({ length: 8 }, (_, i) => ({ day: day + i, tempF: 60, condition: 'clear' as const, footTrafficMult: 1, label: 'clear' }))
      : api.forecast(setup.seed, day, 8);
    w = { ...w, weather };
    if (setup.events !== false) {
      const ev = api.deckEvent(w);
      if (ev) w = { ...w, events: [...w.events.filter((e) => e.endDay >= w.day - 30), ev] };
    }
    for (const pid of ownerIds) for (const a of brain.ownerActions(w, ctx, pid)) apply(pid, a);
    // nanny for manager-run shops: open when permits are ready, safe orders every MANAGER_REVIEW_DAYS
    for (const b of w.businesses) {
      if (b.orders.autopilot !== 'manager' || b.status === 'bankrupt') continue;
      if (b.status === 'setup' && b.permits.every((p) => p.readyDay <= w.day)) apply(b.managerPlayerId, { type: 'launch' });
      else if (b.status === 'open' && day % RULES.MANAGER_REVIEW_DAYS === 0) apply(b.managerPlayerId, { type: 'set_orders', orders: api.managerOrders(b, w, ctx) });
    }
    for (const pid of officialIds) for (const a of brain.officialActions(w, ctx, pid)) apply(pid, a);
    w = api.tickDay(w, ctx);
    if (w.day === 3 * RULES.DAYS_PER_MONTH) for (const b of w.businesses) cash3.set(b.managerPlayerId, b.status === 'bankrupt' ? -1 : b.cash);
  }
  const standings = new Map(w.standings.map((s) => [s.businessId, s]));
  const owners: OwnerResult[] = ownerIds.map((pid) => {
    const p = w.players.find((x) => x.id === pid)!;
    const b = [...w.businesses].reverse().find((x) => x.managerPlayerId === pid);
    const st = b ? standings.get(b.id) : undefined;
    const lines = b ? b.history.flatMap((h) => h.lines) : [];
    const sum = (k: string) => lines.filter((l) => l.kind === k).reduce((s, l) => s + l.amount, 0);
    return {
      playerId: pid, name: p.name, strategy: strat.get(pid) as OwnerStrategy, niche: niche.get(pid)!, businessId: b?.id,
      netWorth: b && b.status !== 'bankrupt' ? api.netWorth(b, ctx, w) : 0, bankrupt: !b || b.status === 'bankrupt', bankruptDay: b?.bankruptDay,
      rank: st?.rank ?? 999, prizePlace: !!st && !st.bankrupt && st.rank <= 3,
      profit: b ? b.history.reduce((s, h) => s + h.profit, 0) : 0, fines: -sum('fine'), savings: sum('saving'),
      cashAtMonth3: cash3.has(pid) ? cash3.get(pid)! : null, bankruptByMonth3: !!b && b.status === 'bankrupt' && (b.bankruptDay ?? 999) <= 90,
    };
  });
  return { world: w, owners, errors, actions };
}

/** Even mix of characters across niches: owner k gets strategies[k % n], niches alternate within each character. */
export function mixedOwners(count: number, strategies: OwnerStrategy[], niches: NicheId[]): OwnerSpec[] {
  const out: OwnerSpec[] = [];
  const seen = new Map<OwnerStrategy, number>();
  for (let k = 0; k < count; k++) {
    const s = strategies[k % strategies.length];
    const i = seen.get(s) ?? 0; seen.set(s, i + 1);
    out.push({ strategy: s, niche: niches[i % niches.length] });
  }
  return out;
}
