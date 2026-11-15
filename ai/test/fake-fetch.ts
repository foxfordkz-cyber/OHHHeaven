// A scripted fetch for provider tests: no network. Records every request and answers from a handler.
import type { FetchLike } from '../src/provider/http';

export interface Sent { url: string; headers: Record<string, string>; body: Record<string, unknown> }
export type Reply = { status?: number; json?: unknown; text?: string; delayMs?: number; throws?: Error };

export function fakeFetch(handler: (sent: Sent) => Reply): FetchLike & { sent: Sent[] } {
  const sent: Sent[] = [];
  const f = (async (url, init) => {
    const s: Sent = { url, headers: init.headers, body: JSON.parse(init.body) as Record<string, unknown> };
    sent.push(s);
    const r = handler(s);
    if (r.delayMs) {
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, r.delayMs);
        init.signal.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('aborted', 'AbortError')); }, { once: true });
      });
    }
    if (r.throws) throw r.throws;
    const status = r.status ?? 200;
    const raw = r.text ?? JSON.stringify(r.json ?? {});
    return { ok: status >= 200 && status < 300, status, text: async () => raw };
  }) as FetchLike & { sent: Sent[] };
  f.sent = sent;
  return f;
}

/** A Gemini generateContent reply carrying `value` as JSON text. */
export function geminiReply(value: unknown, finishReason = 'STOP'): Reply {
  return {
    json: {
      candidates: [{ content: { role: 'model', parts: [{ text: 'thinking about it', thought: true }, { text: JSON.stringify(value) }] }, finishReason }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
    },
  };
}

/** An xAI Responses reply carrying `value` as JSON text. */
export function grokReply(value: unknown, status = 'completed', reason?: string): Reply {
  return {
    json: {
      id: 'resp_test', object: 'response', model: 'grok-4.20-non-reasoning', status,
      incomplete_details: reason ? { reason } : null,
      output: [
        { type: 'reasoning', id: 'rs_1', summary: [], status: 'completed' },
        { type: 'message', id: 'msg_1', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(value), annotations: [] }] },
      ],
      usage: { input_tokens: 10, output_tokens: 5 },
    },
  };
}
