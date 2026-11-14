// The real global fetch against local fakes of both APIs (127.0.0.1, no internet): headers and bodies as they go over
// the wire, chosen through the environment exactly as on the server (GEMINI_BASE_URL / XAI_BASE_URL point at the fakes).
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { askAdvisor } from '../src/advisor';
import { aiLog, resetAi, setProvider } from '../src/provider';
import { analytics, business, cafePack, commonPack } from '../src/__stubs__/fixtures';
import { geminiReply, grokReply } from './fake-fetch';

interface Hit { path: string; headers: IncomingMessage['headers']; body: Record<string, any> }
let server: Server;
let base = '';
const hits: Hit[] = [];
let geminiStatus = 200;
const advice = { answer: 'You lost about 410 orders this month. A barista costs about $2,380 a month, so a third one pays off only if the queue stays.', usedIds: ['staff:barista'] };

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => {
      const hit = { path: req.url ?? '', headers: req.headers, body: JSON.parse(raw || '{}') };
      hits.push(hit);
      const gemini = hit.path.startsWith('/gemini/');
      const status = gemini ? geminiStatus : 200;
      const reply = gemini ? geminiReply(advice) : grokReply(advice);
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(status === 200 ? reply.json : { error: { code: status, status: 'INTERNAL' } }));
    });
  });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { await new Promise<void>(r => server.close(() => r())); });

const VARS = ['AI_PROVIDER', 'AI_MODEL', 'GEMINI_API_KEY', 'XAI_API_KEY', 'GEMINI_BASE_URL', 'XAI_BASE_URL'];
afterEach(() => { for (const v of VARS) delete process.env[v]; resetAi(); setProvider(null); hits.length = 0; geminiStatus = 200; });

const ask = () => askAdvisor({ question: 'Should I hire a third barista?', business, analytics, pack: cafePack, common: commonPack });

describe('over the wire with the real fetch', () => {
  it('Gemini: key header, JSON body, model path', async () => {
    Object.assign(process.env, { GEMINI_API_KEY: 'wire-gem-key', GEMINI_BASE_URL: `${base}/gemini/v1beta` });
    resetAi();
    expect((await ask()).origin).toBe('ai');
    expect(hits).toHaveLength(1);
    expect(hits[0].path).toBe('/gemini/v1beta/models/gemini-3.5-flash:generateContent');
    expect(hits[0].headers['x-goog-api-key']).toBe('wire-gem-key');
    expect(hits[0].headers['content-type']).toBe('application/json');
    expect(hits[0].body.generationConfig.responseMimeType).toBe('application/json');
  });

  it('Gemini fails with 500, Grok answers: bearer key and Responses body', async () => {
    Object.assign(process.env, { GEMINI_API_KEY: 'wire-gem-key', XAI_API_KEY: 'wire-xai-key', GEMINI_BASE_URL: `${base}/gemini/v1beta`, XAI_BASE_URL: `${base}/xai/v1`, AI_MODEL: 'grok-4.3' });
    geminiStatus = 500;
    resetAi();
    expect((await ask()).origin).toBe('ai');
    expect(hits.map(h => h.path)).toEqual(['/gemini/v1beta/models/gemini-3.5-flash:generateContent', '/xai/v1/responses']);
    expect(hits[1].headers.authorization).toBe('Bearer wire-xai-key');
    expect(hits[1].body).toMatchObject({ model: 'grok-4.3', store: false, text: { format: { type: 'json_schema', strict: true } } });
    expect(aiLog().map(e => `${e.provider}:${e.outcome}:${e.detail ?? ''}`)).toEqual(['gemini:error:500 INTERNAL', 'grok:ok:']);
  });
});
