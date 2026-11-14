import { describe, expect, it } from 'vitest';
import { clamp, formatMoney, mulberry32, round2, sum, uid } from './index';
import { RULES, dateOf, isMonthEnd } from '../index';

describe('shared utils', () => {
  it('clamp', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
  it('round2', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(-1.005)).toBe(-1.01);
    expect(round2(2)).toBe(2);
  });
  it('sum', () => {
    expect(sum([1, 2, 3])).toBe(6);
    expect(sum([{ a: 2 }, { a: 5 }], (x) => x.a)).toBe(7);
    expect(sum([])).toBe(0);
  });
  it('formatMoney', () => {
    expect(formatMoney(1234.5)).toBe('$1,235');
    expect(formatMoney(1234.5, { cents: true })).toBe('$1,234.50');
    expect(formatMoney(-80)).toBe('-$80');
    expect(formatMoney(Number.NaN)).toBe('—');
  });
  it('mulberry32 is deterministic and in [0,1)', () => {
    const a = mulberry32(42), b = mulberry32(42);
    const xs = Array.from({ length: 100 }, () => a());
    expect(xs).toEqual(Array.from({ length: 100 }, () => b()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
  it('uid is deterministic, 8 chars, distinct for different n', () => {
    expect(uid(7, 1)).toBe(uid(7, 1));
    expect(uid(7, 1)).toHaveLength(8);
    const ids = new Set(Array.from({ length: 1000 }, (_, i) => uid(7, i)));
    expect(ids.size).toBe(1000);
  });
  it('re-exports rules', () => {
    expect(RULES.DAYS_PER_MONTH).toBe(30);
    expect(dateOf(31).month).toBe(2);
    expect(isMonthEnd(30)).toBe(true);
  });
});
