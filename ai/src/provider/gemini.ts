// Google Gemini API, REST generateContent with structured output.
// Request shape (checked 14 Nov 2026 against the Gemini docs' generateContent curl sample, found by search, and the
// request builder of @ai-sdk/google 4.0.121, published 12 Nov 2026 — ai.google.dev itself is closed from this sandbox):
//   POST {base}/models/{model}:generateContent, header x-goog-api-key
//   { systemInstruction: { parts: [{ text }] }, contents: [{ role: 'user', parts: [{ text }] }],
//     generationConfig: { maxOutputTokens, responseMimeType: 'application/json', responseJsonSchema, thinkingConfig } }
// Response: candidates[0].content.parts[].text (parts with thought: true are skipped), candidates[0].finishReason,
// promptFeedback.blockReason when the prompt itself was blocked.
import { defaultFetch, jsonSchemaOf, parseWith, postJson, type FetchLike } from './http';
import type { AiOutcome, AiProvider, AiRequest } from './types';

export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
/** Stable flash model in the current lineup; thinking can go down to "minimal" on it, which keeps calls fast. */
export const GEMINI_DEFAULT_MODEL = 'gemini-3.5-flash';

export interface GeminiOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
  fetch?: FetchLike;
  /** Overrides the thinking setting chosen from the model id (GEMINI_THINKING). */
  thinking?: string;
}

/**
 * Lowest thinking setting the model accepts: game calls want a short structured answer inside 8 seconds.
 * Gemini 3+ takes thinkingLevel; "minimal" exists on flash/flash-lite before 3.7, pro and newer flash start at "low".
 * Gemini 2.5 takes thinkingBudget: 0 turns thinking off on flash and flash-lite; 2.5 pro needs at least 128.
 */
export function thinkingConfigFor(model: string, override?: string): Record<string, unknown> | undefined {
  const id = model.toLowerCase().replace(/^models\//, '');
  if (override) {
    const n = Number(override);
    return Number.isFinite(n) ? { thinkingBudget: n } : { thinkingLevel: override };
  }
  const m = /^gemini-(\d+)(?:\.(\d+))?-(flash-lite|flash|pro)/.exec(id);
  if (!m) return undefined; // aliases (gemini-flash-latest) and unknown ids: leave the model default
  const major = Number(m[1]);
  const minor = Number(m[2] ?? 0);
  const kind = m[3];
  if (major >= 3) {
    if (kind === 'pro') return { thinkingLevel: 'low' };
    if (kind === 'flash' && (major > 3 || minor >= 7)) return { thinkingLevel: 'low' };
    return { thinkingLevel: 'minimal' };
  }
  if (major === 2 && minor === 5) return { thinkingBudget: kind === 'pro' ? 128 : 0 };
  return undefined;
}

const BLOCKED = new Set(['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'IMAGE_SAFETY', 'LANGUAGE']);

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; thought?: boolean }> };
    finishReason?: string | null;
  }> | null;
  promptFeedback?: { blockReason?: string | null } | null;
}

export function geminiProvider(opts: GeminiOptions): AiProvider {
  const base = (opts.baseUrl || GEMINI_BASE_URL).replace(/\/+$/, '');
  const fetchImpl = opts.fetch ?? defaultFetch;
  const model = opts.model.replace(/^models\//, '');
  return {
    name: 'gemini',
    model,
    async complete<T>(req: AiRequest<T>, signal: AbortSignal): Promise<AiOutcome<T>> {
      const thinkingConfig = thinkingConfigFor(model, opts.thinking);
      const body = {
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: 'user', parts: [{ text: req.prompt }] }],
        generationConfig: {
          maxOutputTokens: req.maxTokens,
          responseMimeType: 'application/json',
          responseJsonSchema: jsonSchemaOf(req.schema),
          ...(thinkingConfig ? { thinkingConfig } : {}),
        },
      };
      const res = await postJson(fetchImpl, `${base}/models/${encodeURIComponent(model)}:generateContent`, { 'x-goog-api-key': opts.apiKey }, body, signal);
      if (!res.ok) return res;
      const json = res.json as GeminiResponse;
      const block = json.promptFeedback?.blockReason;
      if (block) return { ok: false, reason: 'refusal', detail: `prompt ${block}` };
      const cand = json.candidates?.[0];
      if (!cand) return { ok: false, reason: 'parse', detail: 'no candidates' };
      const finish = cand.finishReason ?? 'STOP';
      if (finish === 'MAX_TOKENS' || finish === 'CONTINUATION') return { ok: false, reason: 'max_tokens' };
      if (BLOCKED.has(finish)) return { ok: false, reason: 'refusal', detail: finish };
      if (finish !== 'STOP') return { ok: false, reason: 'error', detail: `finish ${finish}` };
      const text = (cand.content?.parts ?? []).filter(p => p.thought !== true).map(p => p.text ?? '').join('');
      return parseWith(req.schema, text);
    },
  };
}
