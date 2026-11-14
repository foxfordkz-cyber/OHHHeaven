import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { AdvisorAnswer, OwnerView, Query } from '@ohh/shared/types';
import { AiBadge, Badge, Button, Card, Icon, Sheet, Skeleton } from '../../ui';
import { advisorPresets } from './model';

/** How long the player waits before we say so. The AI service itself answers within 8 s or falls back (CONTRACT §8). */
export const ADVISOR_TIMEOUT_MS = 12_000;

export type AskFn = (q: Query) => Promise<unknown>;

export interface AdvisorItem {
  id: number;
  question: string;
  status: 'waiting' | 'done' | 'timeout' | 'error';
  answer?: AdvisorAnswer;
  askedAt: number;
}

export const TIMEOUT_TEXT = 'The advisor is taking longer than usual. Your question is saved below: try again in a minute.';
export const ERROR_TEXT = 'The advisor could not answer right now. Try again in a minute.';

/** Ask once, never hang: resolves to an answer, 'timeout' or 'error'. */
export async function askAdvisor(ask: AskFn, question: string, timeoutMs = ADVISOR_TIMEOUT_MS): Promise<AdvisorAnswer | 'timeout' | 'error'> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => { timer = setTimeout(() => resolve('timeout'), timeoutMs); });
  try {
    const res = await Promise.race([ask({ type: 'advisor', question }), timeout]);
    if (res === 'timeout') return 'timeout';
    const a = (res && typeof res === 'object' && 'data' in (res as object) ? (res as { data?: unknown }).data : res) as AdvisorAnswer | null | undefined;
    return a && typeof a.answer === 'string' ? a : 'error';
  } catch {
    return 'error';
  } finally {
    clearTimeout(timer);
  }
}

const storageKey = (v: OwnerView) => `ohh.advisor.${v.world.config.id}.${v.business?.id ?? v.me.id}`;

function loadHistory(v: OwnerView): AdvisorItem[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey(v)) : null;
    const items = raw ? (JSON.parse(raw) as AdvisorItem[]) : [];
    return items.map((it) => (it.status === 'waiting' ? { ...it, status: 'timeout' } : it));
  } catch {
    return [];
  }
}

function saveHistory(v: OwnerView, items: AdvisorItem[]) {
  try {
    localStorage.setItem(storageKey(v), JSON.stringify(items.slice(0, 20)));
  } catch {
    /* private mode or full storage: history lives for this visit only */
  }
}

export function OriginBadge({ origin }: { origin: AdvisorAnswer['origin'] }) {
  return origin === 'ai' ? <AiBadge label="Answered by AI" /> : <Badge tone="info" icon="doc">From the rule book</Badge>;
}

function Answer({ item }: { item: AdvisorItem }) {
  if (item.status === 'waiting') {
    return (
      <div className="ins-answer" aria-live="polite" aria-busy="true">
        <div className="row small muted"><span className="ins-spinner" aria-hidden="true" />Thinking… usually under 8 seconds</div>
        <Skeleton height={12} />
        <Skeleton height={12} width="70%" />
      </div>
    );
  }
  if (item.status === 'timeout' || item.status === 'error') {
    return <div className="ins-answer ins-answer--fail small" role="status"><Icon name="clock" size={16} /> {item.status === 'timeout' ? TIMEOUT_TEXT : ERROR_TEXT}</div>;
  }
  const a = item.answer!;
  return (
    <div className="ins-answer" aria-live="polite">
      <p>{a.answer}</p>
      {a.sources.length > 0 && (
        <ul className="ins-sources">
          {a.sources.map((s) => (
            <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer"><Icon name="doc" size={14} /> {s.title}</a></li>
          ))}
        </ul>
      )}
      <OriginBadge origin={a.origin} />
    </div>
  );
}

/** "Ask the advisor": three questions that fit the situation, a free question, the answer with sources, a history. */
export function AdvisorCard({ view, ask, timeoutMs = ADVISOR_TIMEOUT_MS }: { view: OwnerView; ask: AskFn; timeoutMs?: number }) {
  const [items, setItems] = useState<AdvisorItem[]>(() => loadHistory(view));
  const [text, setText] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const seq = useRef(items.reduce((m, it) => Math.max(m, it.id), 0));
  const presets = advisorPresets(view);
  const busy = items.some((it) => it.status === 'waiting');

  useEffect(() => saveHistory(view, items), [view, items]);

  async function send(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const id = ++seq.current;
    setItems((xs) => [{ id, question: q, status: 'waiting', askedAt: Date.now() }, ...xs]);
    setText('');
    const res = await askAdvisor(ask, q, timeoutMs);
    setItems((xs) => xs.map((it) => (it.id !== id ? it : typeof res === 'string' ? { ...it, status: res } : { ...it, status: 'done', answer: res })));
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(text);
  };
  const latest = items[0];

  return (
    <Card title="Ask the advisor" subtitle="Rules, real life and the numbers of your business"
      action={items.length > 1 ? <Button size="sm" variant="ghost" onClick={() => setHistoryOpen(true)}>History ({items.length})</Button> : undefined}>
      <div className="stack">
        <div className="ins-presets" role="list">
          {presets.map((p) => (
            <button key={p} type="button" role="listitem" className="chip ins-chip" disabled={busy} onClick={() => void send(p)}>{p}</button>
          ))}
        </div>
        <form className="ins-ask" onSubmit={onSubmit}>
          <input className="ins-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask about your business…" aria-label="Your question" maxLength={300} />
          <Button type="submit" disabled={!text.trim() || busy} loading={busy}>Ask</Button>
        </form>
        {latest && (
          <div className="stack-sm">
            <div className="ins-question small"><Icon name="info" size={14} /> {latest.question}</div>
            <Answer item={latest} />
          </div>
        )}
      </div>
      <Sheet open={historyOpen} onClose={() => setHistoryOpen(false)} title="Your questions">
        {items.map((it) => (
          <div key={it.id} className="stack-sm ins-history-item">
            <div className="ins-question small">{it.question}</div>
            <Answer item={it} />
          </div>
        ))}
      </Sheet>
    </Card>
  );
}
