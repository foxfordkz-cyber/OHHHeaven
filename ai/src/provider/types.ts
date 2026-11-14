import type * as z from 'zod/v4';

export type AiTask = 'plan_events' | 'advisor' | 'idea' | 'debrief';

export interface AiRequest<T> {
  task: AiTask;
  system: string;      // stable instructions first: better prompt-cache reuse
  prompt: string;      // the data for this call
  schema: z.ZodType<T>;
  maxTokens: number;
}

export type AiFailure = 'unavailable' | 'refusal' | 'max_tokens' | 'parse' | 'error' | 'timeout' | 'rate_limited' | 'invalid';
export type AiOutcome<T> = { ok: true; value: T } | { ok: false; reason: AiFailure; detail?: string };

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  complete<T>(req: AiRequest<T>, signal: AbortSignal): Promise<AiOutcome<T>>;
}

export interface AiLogEntry {
  at: string; task: AiTask; provider: string; model: string;
  outcome: 'ok' | 'cached' | AiFailure; ms: number; inputHash: string; promptChars: number; detail?: string;
}
