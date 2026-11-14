// Shared plumbing for the REST providers (Gemini, Grok): one POST with the caller's abort signal, errors mapped to
// AiFailure, and the zod schema turned into plain JSON Schema. No SDKs: both APIs are plain JSON over HTTPS, and a
// bare fetch keeps the server bundle small and the tests network-free (they pass their own fetch).
import * as z from 'zod/v4';
import type { AiFailure } from './types';

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

/** Resolved at call time, so tests can stub globalThis.fetch after the provider was built. */
export const defaultFetch: FetchLike = (url, init) => globalThis.fetch(url, init);

export type PostResult = { ok: true; json: unknown } | { ok: false; reason: AiFailure; detail?: string };

/** Maps an HTTP status to a failure. 429 is a rate limit; everything else is an error with the status as detail. */
export function failureOf(status: number): { reason: AiFailure; detail: string } {
  if (status === 429) return { reason: 'rate_limited', detail: '429' };
  if (status === 401 || status === 403) return { reason: 'error', detail: `${status} auth` };
  if (status === 404) return { reason: 'error', detail: '404 model or endpoint not found' };
  return { reason: 'error', detail: String(status) };
}

/** POST JSON. Never throws: abort becomes "timeout", a network error becomes "error". The body is never logged. */
export async function postJson(fetchImpl: FetchLike, url: string, headers: Record<string, string>, body: unknown, signal: AbortSignal): Promise<PostResult> {
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal,
    });
    const raw = await res.text();
    if (!res.ok) {
      const f = failureOf(res.status);
      return { ok: false, reason: f.reason, detail: `${f.detail}${apiErrorStatus(raw)}` };
    }
    try {
      return { ok: true, json: JSON.parse(raw) };
    } catch {
      return { ok: false, reason: 'parse', detail: 'response is not JSON' };
    }
  } catch (err) {
    if (signal.aborted) return { ok: false, reason: 'timeout', detail: 'aborted' };
    return { ok: false, reason: 'error', detail: err instanceof Error ? `network ${err.name}` : 'network' };
  }
}

/** The API's own error code (e.g. RESOURCE_EXHAUSTED), never the message: messages can echo the request. */
function apiErrorStatus(raw: string): string {
  try {
    const j = JSON.parse(raw) as { error?: { status?: unknown; code?: unknown } | string; code?: unknown };
    const e = typeof j.error === 'object' && j.error ? j.error : undefined;
    const code = e?.status ?? e?.code ?? j.code;
    return typeof code === 'string' || typeof code === 'number' ? ` ${String(code).slice(0, 40)}` : '';
  } catch {
    return '';
  }
}

type Json = Record<string, unknown>;

/** Keywords some structured-output engines reject; zod still checks them after the answer arrives. */
const LOOSE_KEYWORDS = ['minLength', 'maxLength', 'pattern', 'format', 'minItems', 'maxItems', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf'];

/**
 * zod schema → JSON Schema for a provider. `$schema` is dropped (neither API needs it), `const` becomes a one-value
 * `enum` (Gemini's responseJsonSchema has no `const`), and `loose` strips keywords a strict engine may refuse.
 */
export function jsonSchemaOf(schema: z.ZodType, opts: { loose?: boolean } = {}): Json {
  const raw = z.toJSONSchema(schema, { unrepresentable: 'any' }) as Json;
  return clean(raw, opts.loose ?? false) as Json;
}

function clean(node: unknown, loose: boolean): unknown {
  if (Array.isArray(node)) return node.map(n => clean(n, loose));
  if (!node || typeof node !== 'object') return node;
  const out: Json = {};
  for (const [k, v] of Object.entries(node as Json)) {
    if (k === '$schema') continue;
    if (loose && LOOSE_KEYWORDS.includes(k)) continue;
    if (k === 'const') {
      out.enum = [v];
      continue;
    }
    out[k] = k === 'properties' || k === '$defs' || k === 'definitions'
      ? Object.fromEntries(Object.entries(v as Json).map(([name, def]) => [name, clean(def, loose)]))
      : clean(v, loose);
  }
  return out;
}

/** Parses model text against the request schema. A fenced ```json block is unwrapped first. */
export function parseWith<T>(schema: z.ZodType<T>, text: string): { ok: true; value: T } | { ok: false; reason: AiFailure; detail?: string } {
  const body = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return { ok: false, reason: 'parse', detail: 'model text is not JSON' };
  }
  const parsed = schema.safeParse(json);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, reason: 'parse', detail: 'model JSON failed the schema' };
}
