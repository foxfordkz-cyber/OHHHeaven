// The cafe hooks are glued from parts (engine/src/niches/cafe.ts). Empty parts must change nothing.
import { describe, expect, it } from 'vitest';
import type { BusinessState, GameDate, Pack } from '@ohh/shared';
import { composeHooks, hooks, parts } from '../../src/niches/cafe';
import type { CafePart } from '../../src/niches/cafe/contract';

const b = {} as BusinessState;
const pack = {} as Pack;
const date = { month: 1, weekday: 0 } as GameDate;
const env = { day: 5, date, demand: 200 };

describe('cafe hooks', () => {
  it('a part that implements nothing adds no hook', () => {
    expect(composeHooks([{}, {}])).toEqual({});
  });

  it('every hook the registered parts do not implement is absent', () => {
    for (const k of ['demandMult', 'capacityDay', 'qualityDelta', 'extraLines', 'kpis', 'notes'] as const) {
      const implemented = parts.some((p) => typeof p[k] === 'function');
      expect(typeof hooks[k] === 'function').toBe(implemented);
    }
  });

  it('demand multipliers multiply, capacities take the smallest, quality adds up', () => {
    const a: CafePart = { demandMult: () => 1.1, capacityDay: () => 300, qualityDelta: () => 0.02 };
    const c: CafePart = { demandMult: () => 0.9, capacityDay: () => 250, qualityDelta: () => -0.01 };
    const silent: CafePart = { capacityDay: () => null };
    const h = composeHooks([a, c, silent]);
    expect(h.demandMult!(b, date, pack, env)).toBeCloseTo(0.99, 10);
    expect(h.capacityDay!(b, pack, env)).toBe(250);
    expect(h.qualityDelta!(b, pack, env)).toBeCloseTo(0.01, 10);
  });

  it('a part sees the day it is asked about', () => {
    let seen: unknown;
    const h = composeHooks([{ capacityDay: (d) => { seen = { day: d.day, demand: d.demand }; return null; } }]);
    expect(h.capacityDay!(b, pack, env)).toBeNull();
    expect(seen).toEqual({ day: 5, demand: 200 });
  });

  it('money lines, numbers and notes of the parts are joined', () => {
    const h = composeHooks([
      { notes: () => ['Morning rush: 12 guests left the line'] },
      { notes: () => ['Regulars: 140'], extraLines: () => [{ id: 'x', label: 'X', kind: 'opex', amount: -5 }] },
    ]);
    expect(h.notes!(b, {} as never, pack)).toEqual(['Morning rush: 12 guests left the line', 'Regulars: 140']);
    expect(h.extraLines!(b, pack, 1)).toHaveLength(1);
  });
});
