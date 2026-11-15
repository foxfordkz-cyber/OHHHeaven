// Grok provider on a scripted fetch: Responses API request shape, answer extraction, stop reasons, errors. No network.
import { describe, expect, it } from 'vitest';
import * as z from 'zod/v4';
import { GROK_DEFAULT_MODEL, grokProvider, XAI_BASE_URL } from '../src/provider/grok';
import { fakeFetch, grokReply } from './fake-fetch';

const schema = z.object({ answer: z.string().min(1), usedIds: z.array(z.string()) });
const req = { task: 'advisor' as const, system: 'sys', prompt: 'question', schema, maxTokens: 500 };
const signal = () => new AbortController().signal;
const good = { answer: 'ok 1', usedIds: ['a'] };

describe('grokProvider', () => {
  it('posts to /v1/responses with a bearer key, system and user input and a strict JSON schema', async () => {
    const f = fakeFetch(() => grokReply(good));
    const p = grokProvider({ apiKey: 'test-key', model: GROK_DEFAULT_MODEL, fetch: f });
    expect(await p.complete(req, signal())).toEqual({ ok: true, value: good });
    const s = f.sent[0];
    expect(s.url).toBe(`${XAI_BASE_URL}/responses`);
    expect(s.url).toBe('https://api.x.ai/v1/responses');
    expect(s.headers.authorization).toBe('Bearer test-key');
    expect(s.body.model).toBe('grok-4.20-non-reasoning');
    expect(s.body.input).toEqual([{ role: 'system', content: 'sys' }, { role: 'user', content: 'question' }]);
    expect(s.body.max_output_tokens).toBe(500);
    expect(s.body.store).toBe(false);
    const format = (s.body.text as { format: Record<string, any> }).format;
    expect(format).toMatchObject({ type: 'json_schema', name: 'ohh_advisor', strict: true });
    expect(format.schema.type).toBe('object');
    expect(format.schema).not.toHaveProperty('$schema');
    expect(format.schema.properties.answer).toEqual({ type: 'string' }); // minLength stripped, zod still checks it
    expect(s.body).not.toHaveProperty('reasoning');
    expect(s.body).not.toHaveProperty('temperature');
    expect(s.body).not.toHaveProperty('messages');
  });

  it('reads output_text from message items and skips reasoning items', async () => {
    const f = fakeFetch(() => ({ json: { object: 'response', status: 'completed', output: [
      { type: 'reasoning', id: 'r', summary: [{ type: 'summary_text', text: '{"answer":"no"}' }], status: 'completed' },
      { type: 'message', id: 'm', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: '{"answer":"ok 1",' }, { type: 'output_text', text: '"usedIds":["a"]}' }] },
    ] } }));
    expect(await grokProvider({ apiKey: 'k', model: 'grok-4.3', fetch: f }).complete(req, signal())).toEqual({ ok: true, value: good });
  });

  it('turns incomplete answers, refusals and odd statuses into failures', async () => {
    const run = async (r: ReturnType<typeof grokReply>) => grokProvider({ apiKey: 'k', model: 'grok-4.3', fetch: fakeFetch(() => r) }).complete(req, signal());
    expect(await run(grokReply(good, 'incomplete', 'max_output_tokens'))).toMatchObject({ ok: false, reason: 'max_tokens' });
    expect(await run(grokReply(good, 'incomplete', 'content_filter'))).toMatchObject({ ok: false, reason: 'refusal' });
    expect(await run(grokReply(good, 'failed'))).toMatchObject({ ok: false, reason: 'error' });
    expect(await run({ json: { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }] } })).toMatchObject({ ok: false, reason: 'refusal' });
    expect(await run({ json: { status: 'completed', output: [] } })).toMatchObject({ ok: false, reason: 'parse' });
    expect(await run(grokReply({ answer: 7 }))).toMatchObject({ ok: false, reason: 'parse' });
    expect(await run({ json: { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '```json\n{"answer":"ok 1","usedIds":["a"]}\n```' }] }] } })).toEqual({ ok: true, value: good });
  });

  it('maps HTTP errors and aborts without throwing', async () => {
    const http = async (status: number, json: unknown) => grokProvider({ apiKey: 'k', model: 'grok-4.3', fetch: fakeFetch(() => ({ status, json })) }).complete(req, signal());
    expect(await http(429, { code: 'Some resource has been exhausted', error: 'rate limit' })).toMatchObject({ ok: false, reason: 'rate_limited' });
    expect(await http(401, { error: { message: 'Incorrect API key', type: 'invalid_request_error', code: 'invalid_api_key' } })).toEqual({ ok: false, reason: 'error', detail: '401 auth invalid_api_key' });
    expect(await http(500, { error: 'internal' })).toEqual({ ok: false, reason: 'error', detail: '500' });
    expect(await http(502, 'bad gateway')).toMatchObject({ ok: false, reason: 'error' });
    const slow = grokProvider({ apiKey: 'k', model: 'grok-4.3', fetch: fakeFetch(() => ({ ...grokReply(good), delayMs: 1000 })) });
    const c = new AbortController();
    setTimeout(() => c.abort(), 20);
    expect(await slow.complete(req, c.signal)).toMatchObject({ ok: false, reason: 'timeout' });
  });

  it('uses a custom base URL', async () => {
    const f = fakeFetch(() => grokReply(good));
    await grokProvider({ apiKey: 'k', model: 'grok-4.3', baseUrl: 'http://proxy.local/v1/', fetch: f }).complete(req, signal());
    expect(f.sent[0].url).toBe('http://proxy.local/v1/responses');
  });
});
