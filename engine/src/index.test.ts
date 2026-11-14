import { describe, expect, it } from 'vitest';
import { RULES } from '@ohh/shared';
import { createWorld, tickDay } from './index';

const config = {
  id: 't', name: 'Test', city: 'nyc' as const, seasonMonths: 12, dayMs: RULES.DAY_MS_DEMO, paused: false,
  maxOwners: 100, aiBusinessesTarget: 0, entryFee: 5, prizeShare: 0.9, officialsShare: 0.05, platformShare: 0.05,
  nichePrizeTable: [0.5, 0.3, 0.2], demo: true, seed: 1,
};

describe('engine', () => {
  it('createWorld starts on day 1 and tickDay advances one day', () => {
    const w = createWorld(config);
    expect(w.day).toBe(1);
    const ctx = { packs: { common: {} as never, niches: {} }, places: [] };
    const w2 = tickDay(w, ctx);
    expect(w2.day).toBe(2);
    expect(w2.version).toBeGreaterThan(w.version);
    expect(w.day).toBe(1);
  });
});
