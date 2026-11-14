// Gateway for every AI call: provider choice, 8-second budget, cache by input hash, per-minute limit, call log.
// Never throws: any failure returns null and the caller takes its deterministic fallback.
import { digest } from '../rng';
import { mockProvider } from './mock';
import type { AiLogEntry, AiOutcome, AiProvider, AiRequest } from './types';

export type { AiProvider, AiRequest, AiLogEntry } from './types';
export { mockProvider } from './mock';

export const DEFAULT_MODEL = 'claude-opus-5-5';
export const HARD_TIMEOUT_MS = 8000;

function env(name: string): string | undefined {
  try {
    return typeof process !== 'undefined' ? process.env?.[name] : undefined;
  } catch {
    return undefined;
  }
}

export function aiConfig() {
  const timeout = Number(env('AI_TIMEOUT_MS'));
  const rpm = Number(env('AI_MAX_RPM'));
  return {
    provider: env('AI_PROVIDER') === 'mock' || !env('ANTHROPIC_API_KEY') ? 'mock' : 'anthropic',
    model: env('AI_MODEL') || DEFAULT_MODEL,
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? Math.min(timeout, HARD_TIMEOUT_MS) : HARD_TIMEOUT_MS,
    maxPerMinute: Number.isFinite(rpm) && rpm > 0 ? rpm : 20,
  };
}

let override: AiProvider | null = null;
let anthropic: AiProvider | null = null;
const cache = new Map<string, unknown>();
const CACHE_MAX = 300;
const calls: number[] = [];
const log: AiLogEntry[] = [];
const LOG_MAX = 200;

/** Tests and the host can force a provider (null = back to environment choice). */
export function setProvider(p: AiProvider | null): void {
  override = p;
}

/** Clears cache, rate window and log. */
export function resetAi(): void {
  cache.clear();
  calls.length = 0;
  log.length = 0;
}

export function aiLog(): readonly AiLogEntry[] {
  return log;
}

async function provider(cfg: ReturnType<typeof aiConfig>): Promise<AiProvider> {
  if (override) return override;
  if (cfg.provider === 'mock') return mockProvider();
  if (!anthropic || anthropic.model !== cfg.model) {
    const mod = await import('./anthropic');
    anthropic = mod.anthropicProvider({ apiKey: env('ANTHROPIC_API_KEY') ?? '', model: cfg.model, timeoutMs: cfg.timeoutMs });
  }
  return anthropic;
}

function record(e: Omit<AiLogEntry, 'at'>): void {
  const entry = { at: new Date().toISOString(), ...e };
  log.push(entry);
  if (log.length > LOG_MAX) log.shift();
  if (env('AI_LOG') === '1') console.error(`[ai] ${JSON.stringify(entry)}`);
}

/**
 * Runs one structured AI call. Returns the parsed value, or null on any failure (no key, timeout, refusal,
 * schema failure, rate limit, network error). The caller validates plausibility and falls back.
 */
export async function callAi<T, R = T>(req: AiRequest<T>, check?: (value: T) => { ok: true; value: R } | { ok: false; reason: string }): Promise<R | null> {
  const cfg = aiConfig();
  const started = Date.now();
  let p: AiProvider;
  try {
    p = await provider(cfg);
  } catch (err) {
    record({ task: req.task, provider: cfg.provider, model: cfg.model, outcome: 'error', ms: Date.now() - started, inputHash: '', promptChars: req.prompt.length, detail: 'provider load failed' });
    return null;
  }
  const inputHash = digest(`${p.name}|${p.model}|${req.task}|${req.system}|${req.prompt}`);
  const base = { task: req.task, provider: p.name, model: p.model, inputHash, promptChars: req.prompt.length };

  if (cache.has(inputHash)) {
    record({ ...base, outcome: 'cached', ms: 0 });
    return cache.get(inputHash) as R;
  }
  const now = Date.now();
  while (calls.length > 0 && now - calls[0] > 60_000) calls.shift();
  if (calls.length >= cfg.maxPerMinute) {
    record({ ...base, outcome: 'rate_limited', ms: 0 });
    return null;
  }
  calls.push(now);

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<AiOutcome<T>>(resolve => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ ok: false, reason: 'timeout' });
    }, cfg.timeoutMs);
  });
  let outcome: AiOutcome<T>;
  try {
    outcome = await Promise.race([p.complete(req, controller.signal), deadline]);
  } catch (err) {
    outcome = { ok: false, reason: 'error', detail: err instanceof Error ? err.name : 'unknown' };
  } finally {
    clearTimeout(timer);
  }
  const ms = Date.now() - started;
  if (!outcome.ok) {
    record({ ...base, outcome: outcome.reason, ms, detail: outcome.detail });
    return null;
  }
  let value: R;
  try {
    const checked = check ? check(outcome.value) : { ok: true as const, value: outcome.value as unknown as R };
    if (!checked.ok) {
      record({ ...base, outcome: 'invalid', ms, detail: checked.reason.slice(0, 200) });
      return null;
    }
    value = checked.value;
  } catch (err) {
    record({ ...base, outcome: 'invalid', ms, detail: err instanceof Error ? err.message.slice(0, 200) : 'check failed' });
    return null;
  }
  record({ ...base, outcome: 'ok', ms });
  cache.set(inputHash, value);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
  return value;
}
