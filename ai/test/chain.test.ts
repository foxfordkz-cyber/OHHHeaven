// The provider chain: which providers run, in what order, with which model; primary → second → rules inside one
// 8-second budget; and the four AI functions end to end on a scripted global fetch. No network.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as z from 'zod/v4';
import { askAdvisor } from '../src/advisor';
import { writeDebrief } from '../src/debrief';
import { planEvents } from '../src/events/plan';
import { interpretIdea } from '../src/idea';
import { aiConfig, aiLog, callAi, mockProvider, providerChain, resetAi, setProvider } from '../src/provider';
import type { AiProvider } from '../src/provider';
import { dateOf } from '../src/shared';
import { forecast } from '../src/weather';
import { analytics, business, cafePack, commonPack, packSet, plan } from '../src/__stubs__/fixtures';
import { fakeFetch, geminiReply, grokReply } from './fake-fetch';

const VARS = ['AI_PROVIDER', 'AI_MODEL', 'GEMINI_API_KEY', 'XAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_MODEL', 'XAI_MODEL', 'AI_TIMEOUT_MS', 'AI_PRIMARY_MS', 'GEMINI_BASE_URL', 'XAI_BASE_URL'];
let saved: Record<string, string | undefined> = {};
const setEnv = (vars: Record<string, string>) => Object.assign(process.env, vars);

beforeEach(() => {
  saved = Object.fromEntries(VARS.map(v => [v, process.env[v]]));
  for (const v of VARS) delete process.env[v];
  resetAi();
  setProvider(null);
});
afterEach(() => {
  for (const v of VARS) { if (saved[v] === undefined) delete process.env[v]; else process.env[v] = saved[v]; }
  setProvider(null);
  resetAi();
  vi.unstubAllGlobals();
});

describe('providerChain', () => {
  it('is empty without keys or with AI_PROVIDER=mock: everything runs on rules', () => {
    expect(providerChain()).toEqual([]);
    expect(aiConfig()).toMatchObject({ provider: 'mock', model: 'mock', timeoutMs: 8000 });
    setEnv({ GEMINI_API_KEY: 'g', XAI_API_KEY: 'x', AI_PROVIDER: 'mock' });
    expect(providerChain()).toEqual([]);
  });

  it('defaults to Gemini then Grok, and AI_PROVIDER picks the primary', () => {
    setEnv({ GEMINI_API_KEY: 'g', XAI_API_KEY: 'x' });
    expect(providerChain()).toEqual([{ name: 'gemini', model: 'gemini-3.5-flash' }, { name: 'grok', model: 'grok-4.20-non-reasoning' }]);
    setEnv({ AI_PROVIDER: 'grok' });
    expect(providerChain().map(l => l.name)).toEqual(['grok', 'gemini']);
    setEnv({ AI_PROVIDER: ' Gemini ' });
    expect(providerChain().map(l => l.name)).toEqual(['gemini', 'grok']);
  });

  it('skips a provider without a key', () => {
    setEnv({ XAI_API_KEY: 'x', AI_PROVIDER: 'gemini' });
    expect(providerChain()).toEqual([{ name: 'grok', model: 'grok-4.20-non-reasoning' }]);
    delete process.env.XAI_API_KEY;
    setEnv({ GEMINI_API_KEY: 'g' });
    expect(providerChain().map(l => l.name)).toEqual(['gemini']);
  });

  it('routes AI_MODEL to the provider it names; per-provider variables cover the rest', () => {
    setEnv({ GEMINI_API_KEY: 'g', XAI_API_KEY: 'x', AI_MODEL: 'grok-4.3' });
    expect(providerChain()).toEqual([{ name: 'gemini', model: 'gemini-3.5-flash' }, { name: 'grok', model: 'grok-4.3' }]);
    setEnv({ AI_MODEL: 'gemini-3.5-flash-lite', XAI_MODEL: 'grok-latest' });
    expect(providerChain()).toEqual([{ name: 'gemini', model: 'gemini-3.5-flash-lite' }, { name: 'grok', model: 'grok-latest' }]);
    setEnv({ AI_MODEL: 'my-tuned-model', AI_PROVIDER: 'grok' });
    expect(providerChain()[0]).toEqual({ name: 'grok', model: 'my-tuned-model' });
    setEnv({ AI_MODEL: 'claude-opus-5-5', GEMINI_MODEL: 'gemini-3.8-flash' });
    expect(providerChain()).toEqual([{ name: 'grok', model: 'grok-latest' }, { name: 'gemini', model: 'gemini-3.8-flash' }]);
  });

  it('keeps Anthropic off unless AI_PROVIDER names it', () => {
    setEnv({ ANTHROPIC_API_KEY: 'a' });
    expect(providerChain()).toEqual([]);
    setEnv({ AI_PROVIDER: 'anthropic', GEMINI_API_KEY: 'g' });
    expect(providerChain().map(l => l.name)).toEqual(['anthropic', 'gemini']);
  });

  it('caps the budget at 8 seconds and the primary share at the budget', () => {
    setEnv({ AI_TIMEOUT_MS: '20000', AI_PRIMARY_MS: '9000' });
    expect(aiConfig()).toMatchObject({ timeoutMs: 8000, primaryShareMs: 8000 });
    delete process.env.AI_PRIMARY_MS;
    setEnv({ AI_TIMEOUT_MS: 'abc' });
    expect(aiConfig()).toMatchObject({ timeoutMs: 8000, primaryShareMs: 5000 });
  });
});

const schema = z.object({ n: z.number() });
const req = { task: 'advisor' as const, system: 's', prompt: 'p', schema, maxTokens: 100 };
const named = (name: string, p: AiProvider): AiProvider => ({ ...p, name, model: `${name}-model`, complete: p.complete.bind(p) });

describe('callAi chain', () => {
  it('passes to the second provider when the first fails fast', async () => {
    setProvider([named('first', mockProvider({ advisor: () => { throw new Error('500'); } })), named('second', mockProvider({ advisor: () => ({ n: 2 }) }))]);
    expect(await callAi(req)).toEqual({ n: 2 });
    expect(aiLog().map(e => [e.provider, e.outcome])).toEqual([['first', 'error'], ['second', 'ok']]);
  });

  it('cuts a hanging primary at AI_PRIMARY_MS and lets the second answer inside the budget', async () => {
    setEnv({ AI_TIMEOUT_MS: '1000', AI_PRIMARY_MS: '150' });
    setProvider([named('first', mockProvider({ advisor: () => ({ n: 1 }) }, { delayMs: 5000 })), named('second', mockProvider({ advisor: () => ({ n: 2 }) }, { delayMs: 50 }))]);
    const t0 = Date.now();
    expect(await callAi(req)).toEqual({ n: 2 });
    expect(Date.now() - t0).toBeLessThan(900);
    expect(aiLog().map(e => [e.provider, e.outcome])).toEqual([['first', 'timeout'], ['second', 'ok']]);
  });

  it('returns null inside the budget when every provider fails, so callers take the rules path', async () => {
    setEnv({ AI_TIMEOUT_MS: '600', AI_PRIMARY_MS: '200' });
    setProvider([named('first', mockProvider({ advisor: () => ({ n: 1 }) }, { delayMs: 5000 })), named('second', mockProvider({ advisor: () => ({ n: 2 }) }, { delayMs: 5000 }))]);
    const t0 = Date.now();
    expect(await callAi(req)).toBeNull();
    const ms = Date.now() - t0;
    expect(ms).toBeGreaterThanOrEqual(550);
    expect(ms).toBeLessThan(900);
    expect(aiLog().map(e => e.outcome)).toEqual(['timeout', 'timeout']);
  });

  it('does not start the second provider with less than 300 ms left', async () => {
    setEnv({ AI_TIMEOUT_MS: '400', AI_PRIMARY_MS: '400' });
    const second = vi.fn(() => ({ n: 2 }));
    setProvider([named('first', mockProvider({ advisor: () => ({ n: 1 }) }, { delayMs: 5000 })), named('second', mockProvider({ advisor: second }))]);
    expect(await callAi(req)).toBeNull();
    expect(second).not.toHaveBeenCalled();
    expect(aiLog().at(-1)).toMatchObject({ provider: 'second', outcome: 'timeout', detail: 'chain budget spent' });
  });

  it('asks the second provider when the first answer fails the plausibility check', async () => {
    setProvider([named('first', mockProvider({ advisor: () => ({ n: 99 }) })), named('second', mockProvider({ advisor: () => ({ n: 3 }) }))]);
    const out = await callAi(req, v => (v.n < 10 ? { ok: true, value: v.n * 2 } : { ok: false, reason: 'n too big' }));
    expect(out).toBe(6);
    expect(aiLog().map(e => [e.provider, e.outcome])).toEqual([['first', 'invalid'], ['second', 'ok']]);
  });

  it('caches by input and does not call providers again', async () => {
    const h = vi.fn(() => ({ n: 4 }));
    setProvider([named('first', mockProvider({ advisor: h }))]);
    expect(await callAi(req)).toEqual({ n: 4 });
    expect(await callAi(req)).toEqual({ n: 4 });
    expect(h).toHaveBeenCalledTimes(1);
    expect(aiLog().at(-1)?.outcome).toBe('cached');
  });
});

// End to end through the environment: real Gemini and Grok providers, global fetch replaced by a script.
const isGemini = (url: string) => url.startsWith('https://generativelanguage.googleapis.com/');
const isGrok = (url: string) => url.startsWith('https://api.x.ai/');
const planned = { events: [{ themeId: 'street_fair', kind: 'city', title: 'Street fair on Bedford', text: 'A permitted street fair takes over Bedford Ave on Saturday. Vendors draw crowds to nearby shops.', startInDays: 5, durationDays: 1, block: 'Bedford Ave', effects: [{ target: 'footTraffic', mult: 1.15, niches: null, tiers: null }] }] };
const advice = { answer: 'You lost about 410 orders this month. A barista costs about $2,380 a month, so a third one pays off only if the queue stays.', usedIds: ['staff:barista'] };
const idea = { niche: 'cafe', businessName: 'Subway Beans', tier: 'mid', kitId: 'lean', notes: ['A small room near a station lives on the morning rush.'] };
const debrief = { headline: 'Second place and $38,600 to show for it', didWell: ['You kept the room busy most days.'], nextTime: ['Keep a $65,700 reserve before you sign a lease.'] };
/** Answers by the requested schema (Gemini: responseJsonSchema, Grok: text.format.schema). */
const byTask = (body: Record<string, any>) => {
  const props = Object.keys((body.generationConfig?.responseJsonSchema ?? body.text?.format?.schema)?.properties ?? {});
  if (props.includes('events')) return planned;
  if (props.includes('usedIds')) return advice;
  if (props.includes('businessName')) return idea;
  if (props.includes('headline')) return debrief;
  throw new Error(`unknown schema ${props.join(',')}`);
};

describe('the four AI functions on the new chain', () => {
  it('fall back from Gemini (503) to Grok and answer with origin "ai"; keys never reach the log', async () => {
    setEnv({ GEMINI_API_KEY: 'gem-secret-key', XAI_API_KEY: 'xai-secret-key' });
    const f = fakeFetch(s => (isGemini(s.url) ? { status: 503, json: { error: { code: 503, status: 'UNAVAILABLE' } } } : grokReply(byTask(s.body))));
    vi.stubGlobal('fetch', f);
    const events = await planEvents({ date: dateOf(160), weather: forecast(1, 160, 8), recent: [], niches: ['cafe'], blocks: ['Bedford Ave'] });
    expect(events).toHaveLength(1);
    expect(events[0].origin).toBe('ai');
    expect((await askAdvisor({ question: 'Should I hire a third barista?', business, analytics, pack: cafePack, common: commonPack })).origin).toBe('ai');
    expect((await interpretIdea({ text: 'a small coffee place near a subway', packs: packSet })).origin).toBe('ai');
    expect((await writeDebrief({ business, analytics, plan, rank: 2 })).origin).toBe('ai');
    expect(f.sent.filter(s => isGemini(s.url))).toHaveLength(4);
    expect(f.sent.filter(s => isGrok(s.url))).toHaveLength(4);
    expect(aiLog().map(e => `${e.task}:${e.provider}:${e.outcome}`)).toEqual([
      'plan_events:gemini:error', 'plan_events:grok:ok',
      'advisor:gemini:error', 'advisor:grok:ok',
      'idea:gemini:error', 'idea:grok:ok',
      'debrief:gemini:error', 'debrief:grok:ok',
    ]);
    const logText = JSON.stringify(aiLog());
    expect(logText).not.toContain('gem-secret-key');
    expect(logText).not.toContain('xai-secret-key');
  });

  it('use Gemini alone when it answers', async () => {
    setEnv({ GEMINI_API_KEY: 'g', XAI_API_KEY: 'x' });
    const f = fakeFetch(s => (isGemini(s.url) ? geminiReply(byTask(s.body)) : { status: 500 }));
    vi.stubGlobal('fetch', f);
    expect((await askAdvisor({ question: 'Should I hire a third barista?', business, analytics, pack: cafePack, common: commonPack })).origin).toBe('ai');
    expect(f.sent.map(s => isGemini(s.url))).toEqual([true]);
  });

  it('answer by rules when both providers fail, and without keys never touch the network', async () => {
    setEnv({ GEMINI_API_KEY: 'g', XAI_API_KEY: 'x' });
    vi.stubGlobal('fetch', fakeFetch(() => ({ status: 429, json: { error: { code: 429, status: 'RESOURCE_EXHAUSTED' } } })));
    expect((await askAdvisor({ question: 'Should I hire a third barista?', business, analytics, pack: cafePack, common: commonPack })).origin).toBe('rules');
    expect(await planEvents({ date: dateOf(160), weather: forecast(1, 160, 8), recent: [], niches: ['cafe'], blocks: ['Bedford Ave'] })).toEqual([]);
    expect(aiLog().slice(0, 2).map(e => e.outcome)).toEqual(['rate_limited', 'rate_limited']);

    delete process.env.GEMINI_API_KEY;
    delete process.env.XAI_API_KEY;
    resetAi();
    const f = fakeFetch(() => ({ status: 500 }));
    vi.stubGlobal('fetch', f);
    expect((await interpretIdea({ text: 'a small coffee place near a subway', packs: packSet })).origin).toBe('rules');
    expect((await writeDebrief({ business, analytics, plan, rank: 2 })).origin).toBe('rules');
    expect(f.sent).toHaveLength(0);
  });
});
