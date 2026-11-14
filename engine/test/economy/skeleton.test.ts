import { describe, expect, it } from 'vitest';
import { RULES } from '../../../shared/src/rules';

describe('economy skeleton', () => {
  it('reads shared rules', () => {
    expect(RULES.DAYS_PER_MONTH).toBe(30);
  });
});
