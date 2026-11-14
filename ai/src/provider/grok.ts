// xAI Grok, REST Responses API with structured output.
// Request shape (checked 14 Nov 2026 against the xAI structured-outputs docs page, found by search, and the request
// builder of @ai-sdk/xai 5.0.46, published 13 Nov 2026 — that SDK dropped Chat Completions for /v1/responses in 5.0.0;
// docs.x.ai itself is closed from this sandbox):
//   POST {base}/responses, header Authorization: Bearer <key>
//   { model, input: [{ role: 'system', content }, { role: 'user', content }], max_output_tokens,
//     text: { format: { type: 'json_schema', name, schema, strict: true } }, store: false }
// Response: output[] items; the answer is in items of type "message", content parts of type "output_text"; reasoning
// items are skipped. status "incomplete" with incomplete_details.reason says why the answer was cut.
import { defaultFetch, jsonSchemaOf, parseWith, postJson, type FetchLike } from './http';
import type { AiOutcome, AiProvider, AiRequest } from './types';

export const XAI_BASE_URL = 'https://api.x.ai/v1';
/**
 * Non-reasoning model from the current lineup (grok-4.20-*, grok-4.3, grok-latest): answers without a thinking
 * phase, so a structured reply fits the 8-second budget. It rejects the reasoning-effort field, so none is sent.
 */
export const GROK_DEFAULT_MODEL = 'grok-4.20-non-reasoning';

export interface GrokOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
  fetch?: FetchLike;
}

interface GrokResponse {
  status?: string;
  incomplete_details?: { reason?: string } | null;
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string; refusal?: string }> }>;
}

export function grokProvider(opts: GrokOptions): AiProvider {
  const base = (opts.baseUrl || XAI_BASE_URL).replace(/\/+$/, '');
  const fetchImpl = opts.fetch ?? defaultFetch;
  return {
    name: 'grok',
    model: opts.model,
    async complete<T>(req: AiRequest<T>, signal: AbortSignal): Promise<AiOutcome<T>> {
      const body = {
        model: opts.model,
        input: [
          { role: 'system', content: req.system },
          { role: 'user', content: req.prompt },
        ],
        max_output_tokens: req.maxTokens,
        text: { format: { type: 'json_schema', name: `ohh_${req.task}`, schema: jsonSchemaOf(req.schema, { loose: true }), strict: true } },
        store: false, // game data is not kept on xAI's side
      };
      const res = await postJson(fetchImpl, `${base}/responses`, { authorization: `Bearer ${opts.apiKey}` }, body, signal);
      if (!res.ok) return res;
      const json = res.json as GrokResponse;
      if (json.status === 'incomplete') {
        const why = json.incomplete_details?.reason ?? 'unknown';
        if (why === 'max_output_tokens' || why === 'length') return { ok: false, reason: 'max_tokens' };
        if (why === 'content_filter') return { ok: false, reason: 'refusal', detail: why };
        return { ok: false, reason: 'error', detail: `incomplete ${why}` };
      }
      if (json.status && json.status !== 'completed') return { ok: false, reason: 'error', detail: `status ${json.status}` };
      const parts = (json.output ?? []).filter(o => o.type === 'message').flatMap(o => o.content ?? []);
      if (parts.some(p => p.type === 'refusal')) return { ok: false, reason: 'refusal' };
      const text = parts.filter(p => p.type === 'output_text').map(p => p.text ?? '').join('');
      if (!text) return { ok: false, reason: 'parse', detail: 'no output_text' };
      return parseWith(req.schema, text);
    },
  };
}
