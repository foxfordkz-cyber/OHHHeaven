// COPY (trimmed) of agent 08 client/src/app/store.ts (branch claude/inspiring-babbage-xgafu9, commit aefcbcd).
// Only the example-data store and the React bindings: no server, no polling. Delete when client/src/app/ is in main.
import { createContext, createElement, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import type { Ack, Action, ClientView, OfficialRole, OwnerView, OfficialView, CityView, Query } from '../../../../../../shared/src/types';

export type Mode = 'remote' | 'local';
export type Status = 'idle' | 'loading' | 'live' | 'offline';
export interface Toast { id: number; text: string; tone: 'error' | 'info' | 'success' }

export interface StoreState {
  mode: Mode;
  worldId: string;
  view: ClientView | null;
  version: number | null;
  status: Status;
  error: string | null;
  toasts: Toast[];
  /** Static example data (/dev screens): actions do not reach a server. */
  fixture: boolean;
}

export interface GameStore {
  getState(): StoreState;
  subscribe(listener: () => void): () => void;
  refresh(): Promise<void>;
  act(action: Action): Promise<Ack>;
  query<T>(q: Query): Promise<T | null>;
  join(p: { name: string; kind: 'owner' | 'official'; role?: OfficialRole }): Promise<Ack<{ playerId: string; token: string }>>;
  toast(text: string, tone?: Toast['tone']): void;
  dismissToast(id: number): void;
  start(): void;
  stop(): void;
  isJoined(): boolean;
}

const TOAST_MS = 4_000;

/** A store that only shows example data: for /dev screens and component tests. */
export function createStaticStore(view: ClientView, answers: Partial<Record<Query['type'], unknown>> = {}, onAct?: (a: Action, current: ClientView) => ClientView | void): GameStore {
  let state: StoreState = { mode: 'local', worldId: 'dev', view, version: view.world.version, status: 'live', error: null, toasts: [], fixture: true };
  const listeners = new Set<() => void>();
  let seq = 0;
  const set = (patch: Partial<StoreState>) => {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  };
  const store: GameStore = {
    getState: () => state,
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    refresh: async () => undefined,
    async act(a) {
      const next = onAct?.(a, state.view!);
      if (next) set({ view: next, version: next.world.version });
      else store.toast('Example data: this action is not sent anywhere.', 'info');
      return { ok: true };
    },
    async query<T>(q: Query) {
      if (q.type in answers) return answers[q.type] as T;
      store.toast('Example data: no answer for this question.', 'info');
      return null;
    },
    async join() {
      return { ok: true, data: { playerId: 'dev', token: 'dev' } };
    },
    toast(text, tone = 'info') {
      const id = ++seq;
      set({ toasts: [...state.toasts, { id, text, tone }].slice(-3) });
      setTimeout(() => store.dismissToast(id), TOAST_MS);
    },
    dismissToast(id) {
      set({ toasts: state.toasts.filter((t) => t.id !== id) });
    },
    start: () => undefined,
    stop: () => undefined,
    isJoined: () => true,
  };
  return store;
}

const StoreContext = createContext<GameStore | null>(null);

export function StoreProvider({ store, children }: { store: GameStore; children: ReactNode }) {
  return createElement(StoreContext.Provider, { value: store }, children);
}

export function useGameStore(): GameStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error('Stub store: wrap the screen in <DevStore>. The real app store comes with agent 08 shell.');
  return store;
}

export function useStoreState(): StoreState {
  const store = useGameStore();
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

export function useView(): ClientView | null {
  const store = useGameStore();
  useEffect(() => {
    store.start();
  }, [store]);
  return useStoreState().view;
}

export const useOwnerView = (): OwnerView | null => {
  const v = useView();
  return v?.kind === 'owner' ? v : null;
};
export const useOfficialView = (): OfficialView | null => {
  const v = useView();
  return v?.kind === 'official' ? v : null;
};
export const useCityView = (): CityView | null => {
  const v = useView();
  return v?.kind === 'city' ? v : null;
};

export function useGame() {
  const store = useGameStore();
  return {
    act: store.act,
    query: store.query,
    join: store.join,
    toast: store.toast,
    refresh: store.refresh,
    isJoined: store.isJoined,
  };
}
