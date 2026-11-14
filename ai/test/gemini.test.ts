// Gemini provider on a scripted fetch: request shape, answer extraction, stop reasons and HTTP errors. No network.
import { describe, expect, it } from 'vitest';
import * as z from 'zod/v4';
import { GEMINI_BASE_URL, GEMINI_DEFAULT_MODEL, geminiProvider, thinkingConfigFor } from '../src/provider/gemini';
import { jsonSchemaOf } from '../src/provider/http';
import { fakeFetch, geminiReply } from './fake-fetch';

const schema = z.object({ answer: z.string().min(1), usedIds: z.array(z.string()) });
const req = { task: 'advisor' as const, system: 'sys', prompt: 'question', schema, maxTokens: 500 };
const signal = () => new AbortController().signal;
const good = { answer: 'ok 1', usedIds: ['a'] };

describe('geminiProvider', () => {
  it('posts generateContent with the key header, system instruction, JSON schema and minimal thinking', async () => {
    const f = fakeFetch(() => geminiReply(good));
    const p = geminiProvider({ apiKey: 'test-key', model: GEMINI_DEFAULT_MODEL, fetch: f });
    expect(await p.complete(req, signal())).toEqual({ ok: true, value: good });
    expect(f.sent).toHaveLength(1);
    const s = f.sent[0];
    expect(s.url).toBe(`${GEMINI_BASE_URL}/models/gemini-3.5-flash:generateContent`);
    expect(s.headers['x-goog-api-key']).toBe('test-key');
    expect(s.headers['content-type']).toBe('application/json');
    expect(s.url).not.toContain('test-key');
    expect(s.body.systemInstruction).toEqual({ parts: [{ text: 'sys' }] });
    expect(s.body.contents).toEqual([{ role: 'user', parts: [{ text: 'question' }] }]);
    const gc = s.body.generationConfig as Record<string, any>;
    expect(gc.maxOutputTokens).toBe(500);
    expect(gc.responseMimeType).toBe('application/json');
    expect(gc.responseJsonSchema.type).toBe('object');
    expect(gc.responseJsonSchema.required).toEqual(['answer', 'usedIds']);
    expect(gc.responseJsonSchema).not.toHaveProperty('$schema');
    expect(gc.thinkingConfig).toEqual({ thinkingLevel: 'minimal' });
    expect(gc).not.toHaveProperty('temperature');
  });

  it('skips thought parts and joins the answer text', async () => {
    const f = fakeFetch(() => ({ json: { candidates: [{ content: { parts: [{ text: '{"answer":"a', thought: true }, { text: '{"answer":"ok 1",' }, { text: '"usedIds":["a"]}' }] }, finishReason: 'STOP' }] } }));
    const p = geminiProvider({ apiKey: 'k', model: 'gemini-3.5-flash', fetch: f });
    expect(await p.complete(req, signal())).toEqual({ ok: true, value: good });
  });

  it('turns stop reasons and a blocked prompt into failures', async () => {
    const cases: Array<[unknown, string]> = [
      [geminiReply(good, 'MAX_TOKENS').json, 'max_tokens'],
      [geminiReply(good, 'SAFETY').json, 'refusal'],
      [geminiReply(good, 'RECITATION').json, 'refusal'],
      [geminiReply(good, 'MALFORMED_FUNCTION_CALL').json, 'error'],
      [{ promptFeedback: { blockReason: 'PROHIBITED_CONTENT' } }, 'refusal'],
      [{ candidates: [] }, 'parse'],
    ];
    for (const [json, reason] of cases) {
      const p = geminiProvider({ apiKey: 'k', model: 'gemini-3.5-flash', fetch: fakeFetch(() => ({ json })) });
      expect(await p.complete(req, signal()), reason).toMatchObject({ ok: false, reason });
    }
  });

  it('rejects text that is not JSON or fails the schema', async () => {
    const notJson = fakeFetch(() => ({ json: { candidates: [{ content: { parts: [{ text: 'Sure! Here you go' }] }, finishReason: 'STOP' }] } }));
    expect(await geminiProvider({ apiKey: 'k', model: 'gemini-3.5-flash', fetch: notJson }).complete(req, signal())).toMatchObject({ ok: false, reason: 'parse' });
    const wrong = fakeFetch(() => geminiReply({ answer: 5 }));
    expect(await geminiProvider({ apiKey: 'k', model: 'gemini-3.5-flash', fetch: wrong }).complete(req, signal())).toMatchObject({ ok: false, reason: 'parse' });
    const empty = fakeFetch(() => geminiReply({ answer: '', usedIds: [] }));
    expect(await geminiProvider({ apiKey: 'k', model: 'gemini-3.5-flash', fetch: empty }).complete(req, signal())).toMatchObject({ ok: false, reason: 'parse' });
  });

  it('maps HTTP errors, network errors and aborts without throwing', async () => {
    const http = async (status: number, json: unknown) => geminiProvider({ apiKey: 'k', model: 'gemini-3.5-flash', fetch: fakeFetch(() => ({ status, json })) }).complete(req, signal());
    expect(await http(429, { error: { code: 429, message: 'quota', status: 'RESOURCE_EXHAUSTED' } })).toEqual({ ok: false, reason: 'rate_limited', detail: '429 RESOURCE_EXHAUSTED' });
    expect(await http(403, { error: { code: 403, message: 'API key not valid', status: 'PERMISSION_DENIED' } })).toEqual({ ok: false, reason: 'error', detail: '403 auth PERMISSION_DENIED' });
    expect(await http(404, { error: { code: 404, status: 'NOT_FOUND' } })).toMatchObject({ ok: false, reason: 'error' });
    expect(await http(503, { error: { code: 503, status: 'UNAVAILABLE' } })).toEqual({ ok: false, reason: 'error', detail: '503 UNAVAILABLE' });
    const down = geminiProvider({ apiKey: 'k', model: 'gemini-3.5-flash', fetch: fakeFetch(() => ({ throws: new TypeError('fetch failed') })) });
    expect(await down.complete(req, signal())).toMatchObject({ ok: false, reason: 'error' });
    const slow = geminiProvider({ apiKey: 'k', model: 'gemini-3.5-flash', fetch: fakeFetch(() => ({ ...geminiReply(good), delayMs: 1000 })) });
    const c = new AbortController();
    setTimeout(() => c.abort(), 20);
    expect(await slow.complete(req, c.signal)).toMatchObject({ ok: false, reason: 'timeout' });
  });

  it('uses a custom base URL and strips a models/ prefix', async () => {
    const f = fakeFetch(() => geminiReply(good));
    const p = geminiProvider({ apiKey: 'k', model: 'models/gemini-2.5-flash', baseUrl: 'http://proxy.local/v1beta/', fetch: f });
    expect(p.model).toBe('gemini-2.5-flash');
    await p.complete(req, signal());
    expect(f.sent[0].url).toBe('http://proxy.local/v1beta/models/gemini-2.5-flash:generateContent');
    expect((f.sent[0].body.generationConfig as Record<string, unknown>).thinkingConfig).toEqual({ thinkingBudget: 0 });
  });
});

describe('thinkingConfigFor', () => {
  it('picks the lowest setting each model family accepts', () => {
    expect(thinkingConfigFor('gemini-3.5-flash')).toEqual({ thinkingLevel: 'minimal' });
    expect(thinkingConfigFor('gemini-3.5-flash-lite')).toEqual({ thinkingLevel: 'minimal' });
    expect(thinkingConfigFor('gemini-3.8-flash')).toEqual({ thinkingLevel: 'low' });
    expect(thinkingConfigFor('gemini-3.1-pro-preview')).toEqual({ thinkingLevel: 'low' });
    expect(thinkingConfigFor('gemini-3-flash-preview')).toEqual({ thinkingLevel: 'minimal' });
    expect(thinkingConfigFor('gemini-2.5-flash')).toEqual({ thinkingBudget: 0 });
    expect(thinkingConfigFor('gemini-2.5-flash-lite')).toEqual({ thinkingBudget: 0 });
    expect(thinkingConfigFor('gemini-2.5-pro')).toEqual({ thinkingBudget: 128 });
    expect(thinkingConfigFor('gemini-flash-latest')).toBeUndefined();
    expect(thinkingConfigFor('gemini-3.5-flash', 'low')).toEqual({ thinkingLevel: 'low' });
    expect(thinkingConfigFor('gemini-2.5-flash', '512')).toEqual({ thinkingBudget: 512 });
  });
});

describe('jsonSchemaOf', () => {
  it('drops $schema, turns const into enum and loosens only on request', () => {
    const s = z.object({ kind: z.literal('city'), name: z.string().min(2).max(30), tags: z.array(z.string()).max(3), note: z.string().nullable() });
    const strict = jsonSchemaOf(s) as Record<string, any>;
    expect(strict).not.toHaveProperty('$schema');
    expect(strict.properties.kind).toMatchObject({ enum: ['city'] });
    expect(strict.properties.kind).not.toHaveProperty('const');
    expect(strict.properties.name).toMatchObject({ minLength: 2, maxLength: 30 });
    const loose = jsonSchemaOf(s, { loose: true }) as Record<string, any>;
    expect(loose.properties.name).toEqual({ type: 'string' });
    expect(loose.properties.tags).not.toHaveProperty('maxItems');
    expect(loose.required).toEqual(['kind', 'name', 'tags', 'note']);
  });
});
