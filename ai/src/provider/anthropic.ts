// Claude through the official SDK. Loaded lazily on the server only (see provider/index.ts).
// Per the claude-api skill docs: messages.parse with output_config.format (zodOutputFormat) and effort "low";
// no temperature, no forced tool_choice, thinking left at the model default; stop_reason checked before reading.
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { AiOutcome, AiProvider, AiRequest } from './types';

export function anthropicProvider(opts: { apiKey: string; model: string; timeoutMs: number }): AiProvider {
  // maxRetries 0: a retry would break the 8-second budget; the caller has a deterministic fallback instead.
  const client = new Anthropic({ apiKey: opts.apiKey, maxRetries: 0, timeout: opts.timeoutMs });
  return {
    name: 'anthropic',
    model: opts.model,
    async complete<T>(req: AiRequest<T>, signal: AbortSignal): Promise<AiOutcome<T>> {
      try {
        const res = await client.messages.parse(
          {
            model: opts.model,
            max_tokens: req.maxTokens,
            system: req.system,
            messages: [{ role: 'user', content: req.prompt }],
            output_config: { format: zodOutputFormat(req.schema), effort: 'low' },
          },
          { signal, timeout: opts.timeoutMs, maxRetries: 0 },
        );
        if (res.stop_reason === 'refusal') return { ok: false, reason: 'refusal', detail: res.stop_details?.category ?? undefined };
        if (res.stop_reason === 'max_tokens' || res.stop_reason === 'model_context_window_exceeded') return { ok: false, reason: 'max_tokens' };
        if (res.parsed_output === null || res.parsed_output === undefined) return { ok: false, reason: 'parse' };
        return { ok: true, value: res.parsed_output as T };
      } catch (err) {
        if (err instanceof Anthropic.APIConnectionTimeoutError) return { ok: false, reason: 'timeout' };
        if (err instanceof Anthropic.APIUserAbortError) return { ok: false, reason: 'timeout', detail: 'aborted' };
        if (err instanceof Anthropic.RateLimitError) return { ok: false, reason: 'rate_limited', detail: '429' };
        if (err instanceof Anthropic.APIError) return { ok: false, reason: 'error', detail: `${err.status ?? 'network'} ${err.name}` };
        return { ok: false, reason: 'error', detail: err instanceof Error ? err.name : 'unknown' };
      }
    },
  };
}
