// COPY of agent 08 client/src/app/dev.tsx (branch claude/inspiring-babbage-xgafu9, commit aefcbcd). Delete when it is in main.
import { useMemo, type ReactNode } from 'react';
import type { Action, ClientView, Query } from '../../../../../../shared/src/types';
import { Toaster } from '../ui';
import { createStaticStore, StoreProvider, useStoreState, useGameStore, type GameStore } from './store';

/** Toasts of the store in context. The app shell renders one; dev wrappers render their own. */
export function StoreToaster() {
  const store = useGameStore();
  const { toasts } = useStoreState();
  return <Toaster toasts={toasts} onClose={store.dismissToast} />;
}

/**
 * Wrap a screen in example data for /dev/<screen>: `useView()` returns `view`, `query` answers from `answers`,
 * `act` calls `onAct` (return a new view to move the screen to its next state).
 */
export function DevStore({ view, answers, onAct, children }: { view: ClientView; answers?: Partial<Record<Query['type'], unknown>>; onAct?: (a: Action, current: ClientView) => ClientView | void; children: ReactNode }) {
  const store = useMemo(() => createStaticStore(view, answers, onAct), [view, answers, onAct]);
  return <WithStore store={store}>{children}</WithStore>;
}

export function WithStore({ store, children }: { store: GameStore; children: ReactNode }) {
  return (
    <StoreProvider store={store}>
      {children}
      <StoreToaster />
    </StoreProvider>
  );
}
