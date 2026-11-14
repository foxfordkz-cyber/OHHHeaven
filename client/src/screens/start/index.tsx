import { useMemo } from 'react';
import type { Action, ClientView, OwnerView } from '@ohh/shared/types';
import type { ScreenModule } from '../../app/screens';
import { DevStore, WithStore } from '../../app/dev';
import { getClient } from '../../app/api';
import { createStore } from '../../app/store';
import { clearSession } from '../../app/session';
import { fixtureIdea, fixtureOpenRecommendations, fixtureRoadmapTodo, ownerView, ownerViewNew, ownerViewSetup } from '../../app/fixtures';
import { Start } from './Start';

const DEV_WORLD = 'dev-start';

/** /dev/start — the whole path on the in-browser city (stub host until @ohh/host lands): join, open, wait, launch. */
function DevStartLive() {
  const store = useMemo(() => createStore({ client: getClient('local'), mode: 'local', worldId: DEV_WORLD }), []);
  const reset = () => {
    clearSession('local', DEV_WORLD);
    sessionStorage.removeItem(`ohh.start.draft.v1:local:${DEV_WORLD}`);
    window.location.reload();
  };
  return (
    <WithStore store={store}>
      <div style={{ padding: '8px 16px 0', display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" className="chip" onClick={reset}>Reset this example</button>
      </div>
      <Start />
    </WithStore>
  );
}

const ANSWERS = { idea: fixtureIdea, roadmap: fixtureRoadmapTodo, recommend_opening: fixtureOpenRecommendations };
const KIT_DRAFT = { step: 'kit' as const, niche: 'cafe' as const, placeId: 'p12', name: 'Jordan’s Coffee', idea: 'A coffee shop near the subway', match: fixtureIdea };

/** Static example: open_business moves to the waiting screen, launch to the open business. */
function onAct(a: Action, current: ClientView): ClientView | void {
  if (a.type === 'open_business') return ownerViewSetup;
  if (a.type === 'launch' && current.kind === 'owner') return { ...ownerView, away: null } satisfies OwnerView;
}

export const screen: ScreenModule = {
  routes: [{ path: '/start', element: <Start /> }],
  dev: [
    { id: 'start', title: 'Start — full path, offline city', render: () => <DevStartLive /> },
    { id: 'start-plan', title: 'Start — opening plan (roadmap)', render: () => <DevStore view={ownerViewNew} answers={ANSWERS} onAct={onAct}><Start initial={{ ...KIT_DRAFT, step: 'plan' }} /></DevStore> },
    { id: 'start-kit', title: 'Start — opening setup (recommend_opening)', render: () => <DevStore view={ownerViewNew} answers={ANSWERS} onAct={onAct}><Start initial={KIT_DRAFT} /></DevStore> },
    { id: 'start-wait', title: 'Start — waiting for permits', render: () => <DevStore view={ownerViewSetup} answers={ANSWERS} onAct={onAct}><Start /></DevStore> },
  ],
};
