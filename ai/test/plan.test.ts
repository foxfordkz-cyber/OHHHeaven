import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { planEvents, validatePlan, type PlannedEvent } from '../src/events/plan';
import { aiLog, mockProvider, resetAi, setProvider, type AiProvider } from '../src/provider';
import { dateOf, RULES } from '../src/shared';
import { forecast } from '../src/weather';

const BLOCKS = ['Bedford Ave', 'N 6th St'];
const input = (day: number) => ({ date: dateOf(day), weather: forecast(1, day, 8), recent: [], niches: ['cafe', 'barbershop'] as ('cafe' | 'barbershop')[], blocks: BLOCKS });

const ok = (over: Partial<PlannedEvent> = {}): PlannedEvent => ({
  themeId: 'street_fair', kind: 'city', title: 'Street fair on Bedford', text: 'A permitted street fair takes over Bedford Ave on Saturday. Vendors draw crowds to nearby shops.',
  startInDays: 5, durationDays: 1, block: 'Bedford Ave', effects: [{ target: 'footTraffic', mult: 1.15, niches: null, tiers: null }], ...over,
});
const JUNE = 160;  // Jun 10
const JULY = 190;  // Jul 10

beforeEach(() => { resetAi(); delete process.env.AI_TIMEOUT_MS; delete process.env.AI_MAX_RPM; });
afterEach(() => { setProvider(null); delete process.env.AI_TIMEOUT_MS; delete process.env.AI_MAX_RPM; });

describe('planEvents', () => {
  it('returns validated AI events with notice', async () => {
    setProvider(mockProvider({ plan_events: () => ({ events: [ok()] }) }));
    const events = await planEvents(input(JUNE));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ origin: 'ai', kind: 'city', block: 'Bedford Ave', announcedDay: JUNE, startDay: JUNE + 5, endDay: JUNE + 5 });
    expect(events[0].startDay - events[0].announcedDay).toBeGreaterThanOrEqual(RULES.EVENT_NOTICE_DAYS);
    expect(events[0].id).toMatch(/^ai-street_fair-d165-/);
  });

  it('drops a multiplier of 3', async () => {
    setProvider(mockProvider({ plan_events: () => ({ events: [ok({ effects: [{ target: 'footTraffic', mult: 3, niches: null, tiers: null }] })] }) }));
    expect(await planEvents(input(JUNE))).toEqual([]);
    expect(aiLog().at(-1)?.outcome).toBe('invalid');
  });

  it('drops a blizzard in July', async () => {
    const blizzard = ok({ themeId: 'snowstorm', kind: 'weather', title: 'Blizzard hits the city', text: 'A blizzard buries the streets in snow. Staff cannot get to work.', block: null, effects: [{ target: 'staffAvailability', mult: 0.8, niches: null, tiers: null }] });
    setProvider(mockProvider({ plan_events: () => ({ events: [blizzard] }) }));
    expect(await planEvents(input(JULY))).toEqual([]);
    expect(validatePlan({ events: [blizzard] }, input(JULY)).rejected[0]).toMatch(/implausible/);
  });

  it('drops snow words hidden in a summer theme', () => {
    const sneaky = ok({ themeId: 'tourism', kind: 'city', title: 'Snow tourists arrive', text: 'Snow lovers flock to the city. Hotels fill up quickly.', block: null, effects: [{ target: 'footTraffic', mult: 1.05, niches: null, tiers: null }] });
    expect(validatePlan({ events: [sneaky] }, input(JULY)).events).toEqual([]);
  });

  it('drops events with too little notice, unknown blocks, banned topics, money figures and wrong targets', () => {
    const cases: PlannedEvent[] = [
      ok({ startInDays: 1 }),
      ok({ block: 'Fake St' }),
      ok({ text: 'A fair is planned. Two people died in a crash nearby.' }),
      ok({ text: 'A fair is planned. Sales rise 20% on the block.' }),
      ok({ effects: [{ target: 'rent', mult: 1.1, niches: null, tiers: null }] }),
      ok({ effects: [{ target: 'footTraffic', mult: 1.1, niches: ['bodega'], tiers: null }] }),
      ok({ themeId: 'not_a_theme' }),
      ok({ kind: 'weather' }),
      ok({ durationDays: 9 }),
    ];
    for (const c of cases) expect(validatePlan({ events: [c] }, input(JUNE)).events, JSON.stringify(c)).toEqual([]);
  });

  it('keeps the valid event when one of two is invalid, and never more than two', () => {
    const r = validatePlan({ events: [ok({ startInDays: 0 }), ok({ themeId: 'tourism', kind: 'city', block: null, title: 'Visitors pour in', text: 'Tour groups fill the neighborhood. Cafes near the subway get busy.', effects: [{ target: 'footTraffic', mult: 1.05, niches: null, tiers: null }] })] }, input(JUNE));
    expect(r.events).toHaveLength(1);
    const three = validatePlan({ events: [ok(), ok({ block: 'N 6th St', startInDays: 12 }), ok({ startInDays: 20 })] }, input(JUNE));
    expect(three.events.length).toBeLessThanOrEqual(2);
  });

  it('falls back to an empty list on schema-invalid output', async () => {
    setProvider(mockProvider({ plan_events: () => ({ events: [{ title: 'missing fields' }] }) }));
    expect(await planEvents(input(JUNE))).toEqual([]);
    expect(aiLog().at(-1)?.outcome).toBe('parse');
  });

  it('falls back on provider errors and refusals', async () => {
    setProvider(mockProvider({ plan_events: () => { throw new Error('boom'); } }));
    expect(await planEvents(input(JUNE))).toEqual([]);
    const refusing: AiProvider = { name: 'fake', model: 'fake', complete: async () => ({ ok: false, reason: 'refusal', detail: 'test' }) };
    setProvider(refusing);
    expect(await planEvents(input(JUNE + 1))).toEqual([]);
    expect(aiLog().at(-1)?.outcome).toBe('refusal');
  });

  it('falls back on timeout within the time budget', async () => {
    process.env.AI_TIMEOUT_MS = '60';
    setProvider(mockProvider({ plan_events: () => ({ events: [ok()] }) }, { delayMs: 2000 }));
    const t0 = Date.now();
    expect(await planEvents(input(JUNE))).toEqual([]);
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(aiLog().at(-1)?.outcome).toBe('timeout');
  });

  it('uses the offline path without a key', async () => {
    const key = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      expect(await planEvents(input(JUNE))).toEqual([]);
      expect(aiLog().at(-1)).toMatchObject({ provider: 'mock', outcome: 'unavailable' });
    } finally {
      if (key !== undefined) process.env.ANTHROPIC_API_KEY = key;
    }
  });

  it('caches by input and limits calls per minute', async () => {
    let calls = 0;
    setProvider(mockProvider({ plan_events: () => { calls++; return { events: [ok()] }; } }));
    await planEvents(input(JUNE));
    await planEvents(input(JUNE));
    expect(calls).toBe(1);
    expect(aiLog().at(-1)?.outcome).toBe('cached');
    process.env.AI_MAX_RPM = '2';
    await planEvents(input(JUNE + 1));
    expect(await planEvents(input(JUNE + 2))).toEqual([]);
    expect(aiLog().at(-1)?.outcome).toBe('rate_limited');
  });

  it('never logs the API key', async () => {
    process.env.ANTHROPIC_API_KEY_TEST_MARKER = 'sk-ant-secret';
    setProvider(mockProvider({ plan_events: () => ({ events: [ok()] }) }));
    await planEvents(input(JUNE));
    expect(JSON.stringify(aiLog())).not.toContain('sk-ant');
    delete process.env.ANTHROPIC_API_KEY_TEST_MARKER;
  });
});
