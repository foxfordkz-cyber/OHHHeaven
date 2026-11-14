import { describe, expect, it } from 'vitest';
import type { CityView, WorldPublic } from '@ohh/shared/types';
import { clockState, dayProgress, feedRows, formatCountdown, leaderBoards, msLeft, seasonDays } from './cityModel';
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
