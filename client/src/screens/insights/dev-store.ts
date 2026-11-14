// A store for /dev screens whose queries answer like the server would: after a delay, by question.
import type { ClientView, Query } from '@shared/types';
import { createStaticStore, type GameStore } from '../../app/store';
import { fakeQuery } from './fixtures';

export function devStore(view: ClientView, opts: { delayMs?: number; hang?: boolean } = {}): GameStore {
  const store = createStaticStore(view);
  const fake = fakeQuery(opts);
  store.query = async <T,>(q: Query): Promise<T | null> => {
    const ack = await fake<T>(q);
    if (!ack.ok) store.toast(ack.error ?? 'No answer', 'info');
    return ack.ok ? (ack.data ?? null) : null;
  };
  return store;
}
