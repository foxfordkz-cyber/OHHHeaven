// The real SDK path against a local fake of the Messages API: checks the request shape and the stop_reason handling.
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as z from 'zod/v4';
import { anthropicProvider } from '../src/provider/anthropic';

let server: Server;
let lastBody: Record<string, unknown> = {};
let reply: { stop_reason: string; text: string; status?: number; delayMs?: number } = { stop_reason: 'end_turn', text: '{}' };

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => {
      lastBody = JSON.parse(raw || '{}');
      const send = () => {
        res.writeHead(reply.status ?? 200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(reply.status && reply.status >= 400
          ? { type: 'error', error: { type: 'api_error', message: 'boom' } }
          : {
            id: 'msg_test', type: 'message', role: 'assistant', model: lastBody.model,
            content: [{ type: 'text', text: reply.text }],
            stop_reason: reply.stop_reason, stop_sequence: null,
            stop_details: reply.stop_reason === 'refusal' ? { type: 'refusal', category: 'test', explanation: null } : null,
            usage: { input_tokens: 10, output_tokens: 5 },
          }));
      };
      if (reply.delayMs) setTimeout(send, reply.delayMs); else send();
    });
  });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  delete process.env.ANTHROPIC_BASE_URL;
  await new Promise<void>(r => server.close(() => r()));
});

const schema = z.object({ answer: z.string(), usedIds: z.array(z.string()) });
const req = { task: 'advisor' as const, system: 'sys', prompt: 'question', schema, maxTokens: 500 };

describe('anthropicProvider', () => {
  it('sends messages.parse with output_config.format and effort low, no sampling or forced tools', async () => {
    reply = { stop_reason: 'end_turn', text: JSON.stringify({ answer: 'ok 1', usedIds: ['a'] }) };
    const p = anthropicProvider({ apiKey: 'test-key', model: 'claude-opus-5-5', timeoutMs: 3000 });
    const out = await p.complete(req, new AbortController().signal);
    expect(out).toEqual({ ok: true, value: { answer: 'ok 1', usedIds: ['a'] } });
    expect(lastBody.model).toBe('claude-opus-5-5');
    expect(lastBody.max_tokens).toBe(500);
    expect(lastBody.system).toBe('sys');
    const oc = lastBody.output_config as { effort: string; format: { type: string; schema: unknown } };
    expect(oc.effort).toBe('low');
    expect(oc.format.type).toBe('json_schema');
    expect(lastBody).not.toHaveProperty('temperature');
    expect(lastBody).not.toHaveProperty('tool_choice');
    expect(lastBody).not.toHaveProperty('thinking');
  });

  it('returns refusal and max_tokens as failures before reading the content', async () => {
    const p = anthropicProvider({ apiKey: 'test-key', model: 'claude-opus-5-5', timeoutMs: 3000 });
    reply = { stop_reason: 'refusal', text: 'not json' };
    expect(await p.complete(req, new AbortController().signal)).toMatchObject({ ok: false, reason: 'refusal' });
    reply = { stop_reason: 'max_tokens', text: '{"answer": "cut' };
    expect(await p.complete(req, new AbortController().signal)).toMatchObject({ ok: false, reason: 'max_tokens' });
  });

  it('turns API errors and timeouts into failures without throwing', async () => {
    const p = anthropicProvider({ apiKey: 'test-key', model: 'claude-opus-5-5', timeoutMs: 300 });
    reply = { stop_reason: 'end_turn', text: '{}', status: 500 };
    expect(await p.complete(req, new AbortController().signal)).toMatchObject({ ok: false, reason: 'error' });
    reply = { stop_reason: 'end_turn', text: JSON.stringify({ answer: 'late', usedIds: [] }), delayMs: 1500 };
    expect(await p.complete(req, new AbortController().signal)).toMatchObject({ ok: false, reason: 'timeout' });
  });
});

describe('gateway with a key: real SDK path end to end', () => {
  it('rejects schema-invalid JSON as a parse failure', async () => {
    const p = anthropicProvider({ apiKey: 'test-key', model: 'claude-opus-5-5', timeoutMs: 3000 });
    reply = { stop_reason: 'end_turn', text: JSON.stringify({ answer: 5 }) };
    expect(await p.complete(req, new AbortController().signal)).toMatchObject({ ok: false, reason: 'parse' });
  });

  it('plans events through callAi and the Claude provider when ANTHROPIC_API_KEY is set', async () => {
    const { planEvents } = await import('../src/events/plan');
    const { aiLog, resetAi, setProvider } = await import('../src/provider');
    const { dateOf } = await import('../src/shared');
    const { forecast } = await import('../src/weather');
    setProvider(null);
    resetAi();
    const prev = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'test-key';
    try {
      reply = {
        stop_reason: 'end_turn',
        text: JSON.stringify({ events: [{ themeId: 'street_fair', kind: 'city', title: 'Street fair on Bedford', text: 'A permitted street fair takes over Bedford Ave on Saturday. Vendors draw crowds to nearby shops.', startInDays: 5, durationDays: 1, block: 'Bedford Ave', effects: [{ target: 'footTraffic', mult: 1.15, niches: null, tiers: null }] }] }),
      };
      const events = await planEvents({ date: dateOf(160), weather: forecast(1, 160, 8), recent: [], niches: ['cafe'], blocks: ['Bedford Ave'] });
      expect(events).toHaveLength(1);
      expect(events[0].origin).toBe('ai');
      expect(aiLog().at(-1)).toMatchObject({ provider: 'anthropic', model: 'claude-opus-5-5', outcome: 'ok' });
      expect(JSON.stringify(aiLog())).not.toContain('test-key');
    } finally {
      if (prev === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = prev;
    }
  });
});
