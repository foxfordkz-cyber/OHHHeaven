import { describe, expect, it } from 'vitest';
import { PLAN } from '../insights/fixtures';
import type { RealWorldPlan } from '@ohh/shared/types';
import { decodePlan, encodePlan, planLink, planTokenFromHash, slimPlan } from './plan-link';
import { personalOf } from './personal';
import sample from './plan.sample.json';

describe('plan link', () => {
  it('round-trips the plan through a compressed URL fragment', async () => {
    const token = await encodePlan(PLAN);
    expect(token.startsWith('z.')).toBe(true);
    expect(token).toMatch(/^z\.[A-Za-z0-9_-]+$/);
    expect(await decodePlan(token)).toEqual(PLAN);
  });
  it('builds a link that a fresh browser can read back', async () => {
    const link = await planLink(PLAN, 'https://firstyear.example');
    const hash = link.slice(link.indexOf('#'));
    expect(link.startsWith('https://firstyear.example/end/plan#plan=z.')).toBe(true);
    expect(await decodePlan(planTokenFromHash(hash)!)).toEqual(PLAN);
    expect(link.length).toBeLessThan(8000);
  });
  it('a real plan keeps the player’s own part on the way through the link (B09)', async () => {
    const real = sample as unknown as RealWorldPlan;
    const back = await decodePlan(await encodePlan(real));
    expect(personalOf(back!)).toEqual(personalOf(real));
    expect((await planLink(real, 'https://firstyear.example')).length).toBeLessThan(16000);
  });
  it('returns null for a broken token', async () => {
    expect(await decodePlan('z.not-really')).toBeNull();
    expect(await decodePlan('nonsense')).toBeNull();
    expect(planTokenFromHash('#other=1')).toBeNull();
  });
});

describe('what the link carries', () => {
  it('only what the page shows: provenance fields of the packs stay behind', async () => {
    const sourced = {
      ...PLAN,
      suppliers: PLAN.suppliers.map((s) => ({ ...s, source: 'https://example.org/notes', confidence: 'estimate' as const, note: 'A long research note '.repeat(20) })),
      checklist: PLAN.checklist.map((s) => ({ ...s, setupItemId: 'fse_permit' })),
    };
    const slim = slimPlan(sourced);
    expect(slim.suppliers[0]).toEqual(PLAN.suppliers[0]);
    expect(Object.keys(slim.checklist[0])).not.toContain('setupItemId');
    expect(await decodePlan(await encodePlan(sourced))).toEqual(PLAN);
    expect((await encodePlan(sourced)).length).toBe((await encodePlan(PLAN)).length);
  });
});
