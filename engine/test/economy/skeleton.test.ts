import { describe, expect, it } from 'vitest';
import { RULES } from '@ohh/shared';

describe('economy skeleton', () => {
  it('reads shared rules', () => {
    expect(RULES.DAYS_PER_MONTH).toBe(30);
  });
});
