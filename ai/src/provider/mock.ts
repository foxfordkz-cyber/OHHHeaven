// Offline provider. With no handler it answers "unavailable" at once, so every AI function takes its fallback path.
// Tests pass handlers to script answers, errors and delays.
import type { AiProvider, AiRequest, AiTask } from './types';

export type MockHandler = (req: AiRequest<unknown>) => unknown | Promise<unknown>;
export interface MockOptions { delayMs?: number }

export function mockProvider(handlers: Partial<Record<AiTask, MockHandler>> = {}, opts: MockOptions = {}): AiProvider {
  return {
    name: 'mock',
    model: 'mock',
    async complete<T>(req: AiRequest<T>, signal: AbortSignal) {
      const handler = handlers[req.task];
      if (!handler) return { ok: false as const, reason: 'unavailable' as const };
      if (opts.delayMs) {
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(resolve, opts.delayMs);
          signal.addEventListener('abort', () => { clearTimeout(t); reject(new Error('aborted')); }, { once: true });
        });
      }
      const raw = await handler(req as AiRequest<unknown>);
      const parsed = req.schema.safeParse(raw);
      return parsed.success ? { ok: true as const, value: parsed.data } : { ok: false as const, reason: 'parse' as const, detail: 'mock output failed the schema' };
    },
  };
}
