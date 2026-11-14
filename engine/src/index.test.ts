import { describe, expect, it } from 'vitest';
import { RULES } from '@ohh/shared';
import { createWorld, tickDay } from './index';

const config = {
  id: 't', name: 'Test', city: 'nyc' as const, seasonMonths: 12, dayMs: RULES.DAY_MS_DEMO, paused: false,
  maxOwners: 100, aiBusinessesTarget: 0, entryFee: 5, prizeShare: 0.9, officialsShare: 0.05, platformShare: 0.05,
  nichePrizeTable: [0.5, 0.3, 0.2], demo: true, seed: 1,
};

describe('engine', () => {
  it('tickDay advances exactly one day without mutating the input', () => {
    const w = createWorld(config);
    const day = w.day;
    const ctx = { packs: { common: { taxes: [], shortcuts: [], violations: [], officials: [], reports: [], ruleCards: [], roadmap: [] } as never, niches: {} }, places: [] };
    const w2 = tickDay(w, ctx);
    expect(w2.day).toBe(day + 1);
    expect(w.day).toBe(day);
  });
});
