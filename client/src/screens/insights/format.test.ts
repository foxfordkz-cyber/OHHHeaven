import { describe, expect, it } from 'vitest';
import { compactMoney, money, ordinal, pct, toFraction, unitWord } from './format';

describe('money and shares as an owner reads them', () => {
  it('shows cents only when a small amount has them, or when asked', () => {
    expect(money(7.5)).toBe('$7.50');
    expect(money(89)).toBe('$89');
    expect(money(0)).toBe('$0');
    expect(money(13.5, { cents: true })).toBe('$13.50');
    expect(money(9, { cents: true })).toBe('$9.00');
    expect(money(41230.4)).toBe('$41,230');
    expect(money(-1200)).toBe('−$1,200');
    expect(money(2480, { sign: true })).toBe('+$2,480');
  });
  it('compact amounts drop a trailing .0', () => {
    expect(compactMoney(-6000)).toBe('−$6k');
    expect(compactMoney(1300)).toBe('$1.3k');
    expect(compactMoney(41230)).toBe('$41k');
    expect(compactMoney(1_250_000)).toBe('$1.3M');
    expect(compactMoney(950)).toBe('$950');
  });
  it('percent with a real minus sign; shares and percents both accepted', () => {
    expect(pct(-0.2386)).toBe('−24%');
    expect(pct(0.3258)).toBe('33%');
    expect(pct(22)).toBe('22%');
    expect(pct(-0.001)).toBe('0%');
    expect(toFraction(22)).toBe(0.22);
  });
  it('says places as ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 103].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '103rd']);
  });
  it('names the unit of a niche', () => {
    expect(unitWord('cafe', 1)).toBe('order');
    expect(unitWord('cafe', 2)).toBe('orders');
  });
});
