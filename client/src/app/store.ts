import { createContext, createElement, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import type { Ack, Action, ClientView, GameClient, OfficialRole, OwnerView, OfficialView, CityView, Query } from '@ohh/shared/types';
import { getClient } from './api';
import { detectMode, detectWorld, getSession, rememberMode, rememberWorld, type Mode } from './session';
import { addressNamesCity, openFreshCity, wantsFreshCity } from './fresh-city';

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

/** Poll cadence from the contract: every 2 s in a demo city, every 15 s in the live city. */
export function pollIntervalFor(view: ClientView | null): number {
  if (!view) return 2_000;
  return view.world.config.demo ? 2_000 : 15_000;
}

const TOAST_MS = 4_000;

export interface StoreOptions {
  client: GameClient;
  mode: Mode;
  worldId: string;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (t: unknown) => void;
  /**
   * Asked once, with the first view of the city: the id of a city to move into instead (a fresh demo city when this
   * one no longer takes a guest — app/fresh-city.ts), or null to stay.
   */
  freshCity?: (view: ClientView) => Promise<string | null>;
}

export function createStore(opts: StoreOptions): GameStore {
  const setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer ?? ((t) => clearTimeout(t as ReturnType<typeof setTimeout>));
  let state: StoreState = { mode: opts.mode, worldId: opts.worldId, view: null, version: null, status: 'idle', error: null, toasts: [], fixture: false };
  const listeners = new Set<() => void>();
  let timer: unknown = null;
  let running = false;
  let toastSeq = 0;
  let inflight: Promise<void> | null = null;
  let freshAsked = false;

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
    refresh() {
      if (inflight) return inflight;
      if (state.status === 'idle') set({ status: 'loading' });
      inflight = (async () => {
        try {
          const res = await opts.client.view(state.worldId, state.version ?? undefined);
          if ('unchanged' in res) {
            if (state.status !== 'live') set({ status: 'live', error: null });
          } else {
            set({ view: res, version: res.world.version, status: 'live', error: null });
            if (opts.freshCity && !freshAsked) {
              freshAsked = true;
              const id = await opts.freshCity(res);
              if (id && id !== state.worldId) {
                rememberWorld(id);
                set({ worldId: id, view: null, version: null, status: 'loading' });
                const next = await opts.client.view(id);
                if (!('unchanged' in next)) set({ view: next, version: next.world.version, status: 'live', error: null });
              }
            }
          }
        } catch (e) {
          set({ status: 'offline', error: e instanceof Error ? e.message : String(e) });
        } finally {
          inflight = null;
        }
      })();
      return inflight;
    },
    async act(action) {
      const ack = await opts.client.act(state.worldId, action);
      if (!ack.ok) store.toast(ack.error ?? 'That did not work. Try again.', 'error');
      else {
        set({ version: null });
        await store.refresh();
      }
      return ack;
    },
    async query<T>(q: Query) {
      const ack = await opts.client.query<T>(state.worldId, q);
      if (!ack.ok) {
        store.toast(ack.error ?? 'No answer. Try again.', 'error');
        return null;
      }
      return (ack.data ?? null) as T | null;
    },
    async join(p) {
      const ack = await opts.client.join(state.worldId, p);
      if (!ack.ok) store.toast(ack.error ?? 'Could not join the city.', 'error');
      else {
        set({ version: null });
        await store.refresh();
      }
      return ack;
    },
    toast(text, tone = 'info') {
      const id = ++toastSeq;
      set({ toasts: [...state.toasts, { id, text, tone }].slice(-3) });
      setTimer(() => store.dismissToast(id), TOAST_MS);
    },
    dismissToast(id) {
      if (state.toasts.some((t) => t.id === id)) set({ toasts: state.toasts.filter((t) => t.id !== id) });
    },
    start() {
      if (running) return;
      running = true;
      const loop = async () => {
        await store.refresh();
        if (running) timer = setTimer(loop, pollIntervalFor(state.view));
      };
      void loop();
    },
    stop() {
      running = false;
      if (timer !== null) clearTimer(timer);
      timer = null;
    },
    isJoined: () => Boolean(getSession(state.mode, state.worldId)),
  };
  return store;
}

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

// ───────────────────────── the app store and React bindings ─────────────────────────

let appStore: GameStore | null = null;

export function getAppStore(): GameStore {
  if (!appStore) {
    const mode = detectMode();
    appStore = createStore({
      client: getClient(mode), mode, worldId: detectWorld(),
      // a guest is never left in a demo city that will refuse them on the last step (docs/qa/BUGS.md #18)
      freshCity: mode === 'remote'
        ? (view) => (wantsFreshCity({ world: view.world, joined: Boolean(getSession(mode, view.world.config.id)), explicit: addressNamesCity() }) ? openFreshCity('', fetch, view.world.config.id) : Promise.resolve(null))
        : undefined,
    });
  }
  return appStore;
}

/** "Practice offline": the same game in the browser, no server. Reloads into local mode. */
export function switchMode(mode: Mode): void {
  rememberMode(mode);
  const url = new URL(window.location.href);
  url.searchParams.set('mode', mode);
  window.location.assign(url.toString());
}

const StoreContext = createContext<GameStore | null>(null);

export function StoreProvider({ store, children }: { store: GameStore; children: ReactNode }) {
  return createElement(StoreContext.Provider, { value: store }, children);
}

export function useGameStore(): GameStore {
  return useContext(StoreContext) ?? getAppStore();
}

export function useStoreState(): StoreState {
  const store = useGameStore();
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

/** The last ClientView. Starts polling while a component that needs it is mounted. */
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

/** Store-bound actions for screens: errors become toasts. */
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

/** Module-level helpers bound to the app store (outside React). */
export const act = (a: Action) => getAppStore().act(a);
export const query = <T,>(q: Query) => getAppStore().query<T>(q);
