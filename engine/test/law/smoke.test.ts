import { describe, expect, it } from 'vitest';
import { lawActions } from '../../src/law/index';

describe('law module skeleton', () => {
  it('ignores actions it does not own', () => {
    const w = {} as never;
    expect(lawActions(w, { packs: { common: {} as never, niches: {} }, places: [] }, 'p1', { type: 'launch' })).toBeNull();
  });
});
