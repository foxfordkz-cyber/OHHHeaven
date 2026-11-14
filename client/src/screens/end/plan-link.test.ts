import { describe, expect, it } from 'vitest';
import { PLAN } from '../insights/fixtures';
import { decodePlan, encodePlan, planLink, planTokenFromHash } from './plan-link';

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
  it('returns null for a broken token', async () => {
    expect(await decodePlan('z.not-really')).toBeNull();
    expect(await decodePlan('nonsense')).toBeNull();
    expect(planTokenFromHash('#other=1')).toBeNull();
  });
});
