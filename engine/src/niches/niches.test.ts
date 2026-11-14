import { describe, expect, it } from 'vitest';
import { NICHE_HOOKS, hooksFor } from './index';

describe('niche registry', () => {
  it('returns an empty hooks object for a niche without hooks', () => {
    const h = hooksFor('guesthouse');
    expect(typeof h).toBe('object');
    expect(h.demandMult).toBeUndefined();
  });
  it('registry only holds known niches', () => {
    for (const k of Object.keys(NICHE_HOOKS)) expect(['cafe', 'barbershop', 'bodega', 'guesthouse', 'rentals']).toContain(k);
  });
});
