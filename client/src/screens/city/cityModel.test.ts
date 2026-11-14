import { describe, expect, it } from 'vitest';
import type { CityView, WorldPublic } from '@ohh/shared/types';
import { closestRaces, clockState, dayProgress, daysToReports, feedRows, formatCountdown, leaderBoards, msLeft, seasonDays } from './cityModel';
import { cityView } from './fixtures';

const world = (patch: Partial<WorldPublic['config']> = {}, msToNextDay = 1000): WorldPublic => ({
  ...cityView.world, msToNextDay, config: { ...cityView.world.config, ...patch },
});

describe('leaderboards', () => {
  it('shows the top three per niche in niche order with business names', () => {
    const boards = leaderBoards(cityView);
    expect(boards[0].niche).toBe('cafe');
    expect(boards.every((b) => b.rows.length <= 3)).toBe(true);
    expect(boards[0].rows.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(boards[0].rows[0].name).toBe('Night Owl Coffee');
  });
  it('skips niches without standings', () => {
    const view: CityView = { ...cityView, leaderboards: { barbershop: cityView.leaderboards.barbershop } };
    expect(leaderBoards(view).map((b) => b.niche)).toEqual(['barbershop']);
  });
});

describe('feed', () => {
  it('puts the newest first and keeps same-day order newest first', () => {
    const rows = feedRows(cityView.feed, 3);
    expect(rows.map((f) => f.id)).toEqual(['f7', 'f6', 'f5']);
  });
});

describe('clock', () => {
  it('reads demo speed from dayMs', () => {
    expect(clockState(world({ dayMs: 2000 })).speed).toBe(1);
    expect(clockState(world({ dayMs: 400 })).speed).toBe(5);
    expect(clockState(world({ demo: false, dayMs: 2_880_000 })).speed).toBe(1);
  });
  it('counts down locally and stops while paused', () => {
    expect(msLeft(world({}, 1500), 500)).toBe(1000);
    expect(msLeft(world({}, 1500), 5000)).toBe(0);
    expect(msLeft(world({ paused: true }, 1500), 5000)).toBe(1500);
    expect(dayProgress(world({ dayMs: 2000 }, 1000), 0)).toBeCloseTo(0.5);
  });
  it('formats countdowns for demo and live cities', () => {
    expect(formatCountdown(1234)).toBe('1.2 s');
    expect(formatCountdown(31 * 60_000)).toBe('31 min');
    expect(formatCountdown(125 * 60_000)).toBe('2 h 5 min');
  });
  it('knows the season length', () => {
    expect(seasonDays(world())).toBe(360);
  });
});

describe('races to watch', () => {
  it('names #1 and #2 of a niche and the net worth between them, closest race first', () => {
    const races = closestRaces(cityView);
    expect(races.length).toBeGreaterThan(0);
    for (const r of races) {
      const live = (cityView.leaderboards[r.niche] ?? []).filter((s) => !s.bankrupt).sort((a, b) => a.rank - b.rank);
      expect(r.gap).toBe(live[0].netWorth - live[1].netWorth);
    }
    const rel = races.map((r) => r.gap);
    expect(rel.length).toBeLessThanOrEqual(2);
  });
  it('skips a niche with one standing business and never counts the bankrupt', () => {
    const view: CityView = {
      ...cityView,
      leaderboards: {
        cafe: [
          { businessId: 'x', niche: 'cafe', rank: 1, netWorth: 0, isAi: false, bankrupt: true },
          { businessId: 'y', niche: 'cafe', rank: 2, netWorth: 1000, isAi: false, bankrupt: false, name: 'Y' },
        ],
      },
    };
    expect(closestRaces(view)).toEqual([]);
  });
  it('counts down to the month-end reports', () => {
    expect(daysToReports(1)).toBe(29);
    expect(daysToReports(29)).toBe(1);
    expect(daysToReports(30)).toBe(0);
    expect(daysToReports(31)).toBe(29);
  });
});
