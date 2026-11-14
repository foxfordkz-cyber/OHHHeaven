import { describe, expect, it } from 'vitest';
import { botBrain } from './index';

describe('bots', () => {
  it('stub brain acts through Action lists', () => {
    expect(Array.isArray(botBrain.ownerActions({} as never, {} as never, 'p'))).toBe(true);
  });
});
