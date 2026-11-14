// Gateway for every AI call: provider chain, 8-second budget for the whole chain, cache by input hash, per-minute
// limit, call log. Chain: primary provider → second provider → deterministic fallback (the caller's rules path).
// Never throws: any failure returns null and the caller takes its deterministic fallback.
import { digest } from '../rng';
import { GEMINI_DEFAULT_MODEL } from './gemini';
import { GROK_DEFAULT_MODEL } from './grok';
import { mockProvider } from './mock';
import type { AiFailure, AiLogEntry, AiOutcome, AiProvider, AiRequest } from './types';

export type { AiProvider, AiRequest, AiLogEntry } from './types';
export { mockProvider } from './mock';
export { geminiProvider, GEMINI_DEFAULT_MODEL } from './gemini';
export { grokProvider, GROK_DEFAULT_MODEL } from './grok';

export type ProviderName = 'gemini' | 'grok' | 'anthropic';

/** Per provider: key variable, model override variable, default model. Anthropic is off unless named in AI_PROVIDER. */
export const PROVIDERS: Record<ProviderName, { keyEnv: string; modelEnv: string; baseEnv: string; defaultModel: string; family: RegExp }> = {
  gemini: { keyEnv: 'GEMINI_API_KEY', modelEnv: 'GEMINI_MODEL', baseEnv: 'GEMINI_BASE_URL', defaultModel: GEMINI_DEFAULT_MODEL, family: /^(models\/)?(gemini|gemma)-/i },
  grok: { keyEnv: 'XAI_API_KEY', modelEnv: 'XAI_MODEL', baseEnv: 'XAI_BASE_URL', defaultModel: GROK_DEFAULT_MODEL, family: /^grok-/i },
  anthropic: { keyEnv: 'ANTHROPIC_API_KEY', modelEnv: 'ANTHROPIC_MODEL', baseEnv: 'ANTHROPIC_BASE_URL', defaultModel: 'claude-opus-5-5', family: /^claude-/i },
};
/** Order when AI_PROVIDER is unset; the other one becomes the second provider. */
const AUTO_ORDER: ProviderName[] = ['gemini', 'grok'];

/** Primary model when nothing is set (kept for older imports). */
export const DEFAULT_MODEL = GEMINI_DEFAULT_MODEL;
export const HARD_TIMEOUT_MS = 8000;
/** With a second provider waiting, the first one gets at most this much of the budget (AI_PRIMARY_MS). */
export const PRIMARY_SHARE_MS = 5000;
/** Below this, a provider is not worth starting: the request could not finish anyway. */
const MIN_ATTEMPT_MS = 300;

function env(name: string): string | undefined {
  try {
    const v = typeof process !== 'undefined' ? process.env?.[name] : undefined;
    return v && v.trim() ? v.trim() : undefined;
  } catch {
    return undefined;
  }
}

export interface ChainLink { name: ProviderName; model: string }

/** Which providers to try, in order. Only providers with a key are listed. */
export function providerChain(): ChainLink[] {
  const raw = (env('AI_PROVIDER') ?? '').toLowerCase();
  if (raw === 'mock' || raw === 'none' || raw === 'off' || raw === 'rules') return [];
  const named = raw.split(/[,\s>]+/).filter((n): n is ProviderName => n in PROVIDERS);
  // Named providers first, then the other auto providers as backups. Anthropic only when named.
  const order = [...new Set([...named, ...AUTO_ORDER])];
  const withKeys = order.filter(n => env(PROVIDERS[n].keyEnv));
  const aiModel = env('AI_MODEL');
  // AI_MODEL goes to the provider whose family it names (gemini-…, grok-…, claude-…); an id with no known prefix
  // goes to the primary. GEMINI_MODEL / XAI_MODEL / ANTHROPIC_MODEL set a provider's model when AI_MODEL does not.
  const target = aiModel ? withKeys.find(n => PROVIDERS[n].family.test(aiModel)) ?? (Object.values(PROVIDERS).some(p => p.family.test(aiModel)) ? undefined : withKeys[0]) : undefined;
  return withKeys.map(name => ({
    name,
    model: (name === target ? aiModel : undefined) ?? env(PROVIDERS[name].modelEnv) ?? PROVIDERS[name].defaultModel,
  }));
}

export function aiConfig() {
  const timeout = Number(env('AI_TIMEOUT_MS'));
  const rpm = Number(env('AI_MAX_RPM'));
  const share = Number(env('AI_PRIMARY_MS'));
  const chain = providerChain();
  const timeoutMs = Number.isFinite(timeout) && timeout > 0 ? Math.min(timeout, HARD_TIMEOUT_MS) : HARD_TIMEOUT_MS;
  return {
    /** Primary provider name, 'mock' when no provider has a key (everything runs on rules). */
    provider: (chain[0]?.name ?? 'mock') as ProviderName | 'mock',
    model: chain[0]?.model ?? 'mock',
    chain,
    timeoutMs,
    primaryShareMs: Math.min(Number.isFinite(share) && share > 0 ? share : PRIMARY_SHARE_MS, timeoutMs),
    maxPerMinute: Number.isFinite(rpm) && rpm > 0 ? rpm : 20,
  };
}

let override: AiProvider[] | null = null;
const built = new Map<string, AiProvider>();
const cache = new Map<string, unknown>();
const CACHE_MAX = 300;
const calls: number[] = [];
const log: AiLogEntry[] = [];
const LOG_MAX = 200;

/** Tests and the host can force a provider or a whole chain (null = back to the environment's choice). */
export function setProvider(p: AiProvider | AiProvider[] | null): void {
  override = p === null ? null : Array.isArray(p) ? p : [p];
}

/** Clears cache, rate window, log and built providers (so changed keys and models are picked up). */
export function resetAi(): void {
  cache.clear();
  calls.length = 0;
  log.length = 0;
  built.clear();
}

export function aiLog(): readonly AiLogEntry[] {
  return log;
}

async function build(link: ChainLink): Promise<AiProvider> {
  const spec = PROVIDERS[link.name];
  const apiKey = env(spec.keyEnv) ?? '';
  const id = `${link.name}|${link.model}|${digest(apiKey)}|${env(spec.baseEnv) ?? ''}`;
  const hit = built.get(id);
  if (hit) return hit;
  let p: AiProvider;
  if (link.name === 'gemini') {
    const { geminiProvider } = await import('./gemini');
    p = geminiProvider({ apiKey, model: link.model, baseUrl: env(spec.baseEnv), thinking: env('GEMINI_THINKING') });
  } else if (link.name === 'grok') {
    const { grokProvider } = await import('./grok');
    p = grokProvider({ apiKey, model: link.model, baseUrl: env(spec.baseEnv) });
  } else {
    const mod = await import('./anthropic'); // the SDK reads ANTHROPIC_BASE_URL itself
    p = mod.anthropicProvider({ apiKey, model: link.model, timeoutMs: HARD_TIMEOUT_MS });
  }
  built.set(id, p);
  return p;
}

async function providers(cfg: ReturnType<typeof aiConfig>): Promise<{ list: AiProvider[]; failed: ChainLink[] }> {
  if (override) return { list: override, failed: [] };
  if (cfg.chain.length === 0) return { list: [mockProvider()], failed: [] };
  const list: AiProvider[] = [];
  const failed: ChainLink[] = [];
  for (const link of cfg.chain) {
    try {
      list.push(await build(link));
    } catch {
      failed.push(link);
    }
  }
  return { list, failed };
}

function record(e: Omit<AiLogEntry, 'at'>): void {
  const entry = { at: new Date().toISOString(), ...e };
  log.push(entry);
  if (log.length > LOG_MAX) log.shift();
  if (env('AI_LOG') === '1') console.error(`[ai] ${JSON.stringify(entry)}`);
}

/** One provider attempt with its own time limit. Never throws. */
async function attempt<T>(p: AiProvider, req: AiRequest<T>, ms: number): Promise<AiOutcome<T>> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<AiOutcome<T>>(resolve => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ ok: false, reason: 'timeout' });
    }, ms);
  });
  try {
    return await Promise.race([p.complete(req, controller.signal), deadline]);
  } catch (err) {
    return { ok: false, reason: 'error', detail: err instanceof Error ? err.name : 'unknown' };
  } finally {
    clearTimeout(timer);
  }
}

type Check<T, R> = (value: T) => { ok: true; value: R } | { ok: false; reason: string };

/**
 * Runs one structured AI call through the chain. Returns the parsed and checked value, or null when every provider
 * failed (no key, timeout, refusal, schema failure, rate limit, network error, failed check). The whole chain shares
 * one budget (AI_TIMEOUT_MS, at most 8 s); with a second provider waiting, the first gets at most AI_PRIMARY_MS.
 */
export async function callAi<T, R = T>(req: AiRequest<T>, check?: Check<T, R>): Promise<R | null> {
  const cfg = aiConfig();
  const started = Date.now();
  const end = started + cfg.timeoutMs;
  const { list, failed } = await providers(cfg);
  for (const link of failed) {
    record({ task: req.task, provider: link.name, model: link.model, outcome: 'error', ms: Date.now() - started, inputHash: '', promptChars: req.prompt.length, detail: 'provider load failed' });
  }
  if (list.length === 0) return null;
  const inputHash = digest(`${list.map(p => `${p.name}:${p.model}`).join('>')}|${req.task}|${req.system}|${req.prompt}`);
  const base = (p: AiProvider) => ({ task: req.task, provider: p.name, model: p.model, inputHash, promptChars: req.prompt.length });

  if (cache.has(inputHash)) {
    record({ ...base(list[0]), outcome: 'cached', ms: 0 });
    return cache.get(inputHash) as R;
  }
  const now = Date.now();
  while (calls.length > 0 && now - calls[0] > 60_000) calls.shift();
  if (calls.length >= cfg.maxPerMinute) {
    record({ ...base(list[0]), outcome: 'rate_limited', ms: 0 });
    return null;
  }
  calls.push(now);

  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const left = end - Date.now();
    if (i > 0 && left < MIN_ATTEMPT_MS) {
      record({ ...base(p), outcome: 'timeout', ms: 0, detail: 'chain budget spent' });
      break;
    }
    const isLast = i === list.length - 1;
    const budget = isLast ? left : Math.min(left, cfg.primaryShareMs);
    const t0 = Date.now();
    const outcome = await attempt(p, req, budget);
    const ms = Date.now() - t0;
    if (!outcome.ok) {
      record({ ...base(p), outcome: outcome.reason, ms, detail: outcome.detail });
      continue;
    }
    let value: R;
    try {
      const checked = check ? check(outcome.value) : { ok: true as const, value: outcome.value as unknown as R };
      if (!checked.ok) {
        record({ ...base(p), outcome: 'invalid', ms, detail: checked.reason.slice(0, 200) });
        continue;
      }
      value = checked.value;
    } catch (err) {
      record({ ...base(p), outcome: 'invalid', ms, detail: err instanceof Error ? err.message.slice(0, 200) : 'check failed' });
      continue;
    }
    record({ ...base(p), outcome: 'ok', ms });
    cache.set(inputHash, value);
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
    return value;
  }
  return null;
}

/** Failure reasons a log entry can carry, for the host's status line. */
export type { AiFailure };
