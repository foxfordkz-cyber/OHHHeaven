// Loan and stake amounts are taken in whole cents only (host/src/validate.ts): a fraction of a cent is refused at the door.
import { describe, expect, it } from 'vitest';
import { checkActionShape } from '../src/validate';

const loan = (amount: number) => ({ type: 'propose_deal', toBusinessId: 'b2', terms: { type: 'loan', amount, monthlyRatePct: 3, months: 6 } });
const stake = (amount: number) => ({ type: 'propose_deal', toBusinessId: 'b2', terms: { type: 'partnership', amount, sharePct: 10 } });

describe('money in deals is in whole cents', () => {
  it('whole dollars and cents pass', () => {
    for (const a of [1, 5000, 1500.25, 0.01, 12345.67]) {
      expect(checkActionShape(loan(a))).toBeNull();
      expect(checkActionShape(stake(a))).toBeNull();
    }
  });
  it('a fraction of a cent is refused, for a loan and for a stake', () => {
    for (const a of [1500.255, 0.001, 99.999]) {
      expect(checkActionShape(loan(a))).toMatch(/whole cents/);
      expect(checkActionShape(stake(a))).toMatch(/whole cents/);
    }
  });
});
