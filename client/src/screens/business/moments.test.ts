import { describe, expect, it } from 'vitest';
import type { MonthReport } from '@ohh/shared/types';
import { monthStory, nextRank, rankMove, unseenReport } from './moments';

const month = (m: number, profit: number, rank: number, cashEnd = 50_000): MonthReport => ({
  month: m, avgPrice: 8, demandUnits: 0, servedUnits: 0, lost: { size: 0, staff: 0, closure: 0 }, capacityUnits: 0, sizeUtilization: 0,
  lines: [], revenue: 30_000, profit, cashStart: cashEnd - profit, cashEnd, taxesAccrued: 0, taxesPaid: 0, fines: 0,
  quality: 0.5, reputation: 0.5, netWorth: 0, rankInNiche: rank,
});

describe('the month report', () => {
  it('is waiting until the owner opens it, and only the latest month', () => {
    const h = [month(4, -6000, 6), month(5, 1200, 5)];
    expect(unseenReport(h, 0)?.month).toBe(5);
    expect(unseenReport(h, 4)?.month).toBe(5);
    expect(unseenReport(h, 5)).toBeNull();
    expect(unseenReport([], 0)).toBeNull();
  });

  it('says what the month was against the one before it', () => {
    const h = [month(4, -6000, 6), month(5, -2500, 6), month(6, 1200, 4), month(7, 900, 5)];
    expect(monthStory(h, h[0]).verdict[0]).toMatch(/loss in the first month/);
    expect(monthStory(h, h[1]).verdict[0]).toBe('A loss, but $3,500 smaller than in April.');
    expect(monthStory(h, h[2]).verdict[0]).toBe('Your first month in the black.');
    expect(monthStory(h, h[3]).verdict[0]).toBe('Still a profit, but $300 less than in June.');
  });

  it('counts what was paid, the places moved and how long the cash lasts at a loss', () => {
    const h = [month(4, -6000, 6, 60_000), month(5, -5000, 4, 55_000)];
    const s = monthStory(h, h[1]);
    expect(s.costs).toBe(35_000);
    expect(s.rankBefore).toBe(6);
    expect(s.rankMove).toBe(2);
    expect(s.cashDelta).toBe(-5000);
    expect(s.monthsOfCash).toBe(11);
    expect(monthStory(h, h[0]).rankMove).toBe(0);
    expect(monthStory([month(4, 100, 3)], month(4, 100, 3)).monthsOfCash).toBeNull();
  });
});

describe('the place in the table', () => {
  it('is news for a game week after it moves, and silent otherwise', () => {
    let mem = nextRank(null, 6, 100);
    expect(rankMove(mem, 6, 100)).toBe(0);
    expect(nextRank(mem, 6, 103)).toBe(mem);
    mem = nextRank(mem, 4, 104);
    expect(mem).toEqual({ rank: 4, before: 6, day: 104 });
    expect(rankMove(mem, 4, 104)).toBe(2);
    expect(rankMove(mem, 4, 110)).toBe(2);
    expect(rankMove(mem, 4, 111)).toBe(0);
    mem = nextRank(mem, 5, 112);
    expect(rankMove(mem, 5, 112)).toBe(-1);
    expect(rankMove(mem, 4, 112)).toBe(0); // the header has not caught up with a newer place yet
  });
});
