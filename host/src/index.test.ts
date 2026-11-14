import { describe, expect, it } from 'vitest';
import { RULES } from '@ohh/shared';
import { botBrain } from '@ohh/bots';
import { join, newWorld, step, viewFor } from './index';

const config = {
  id: 'demo', name: 'Demo', city: 'nyc' as const, seasonMonths: 12, dayMs: RULES.DAY_MS_DEMO, paused: false,
  maxOwners: 100, aiBusinessesTarget: 0, entryFee: 5, prizeShare: 0.9, officialsShare: 0.05, platformShare: 0.05,
  nichePrizeTable: [0.5, 0.3, 0.2], demo: true, seed: 1,
};
const deps = { bots: botBrain, forecast: () => [], deckEvent: () => null };
const ctx = { packs: { common: {} as never, niches: {} }, places: [] };

describe('host', () => {
  it('creates a world, lets a player join and steps a day', () => {
    const w = newWorld(config, ctx, deps);
    const { world, playerId } = join(w, { name: 'Ana', kind: 'owner' });
    expect(world.players.find((p) => p.id === playerId)?.name).toBe('Ana');
    const w2 = step(world, ctx, deps);
    expect(w2.day).toBe(world.day + 1);
    expect(viewFor(w2, ctx, null).kind).toBe('city');
  });
});
