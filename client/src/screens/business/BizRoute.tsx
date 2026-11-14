// /biz wired to the app shell: view and actions from the store, packs from the catalog, extra tabs from the registry.
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Ack, Query } from '@ohh/shared/types';
import { getClient } from '../../app/api';
import { useCatalog } from '../../app/catalog';
import { getBizTabs } from '../../app/screens';
import { useGame, useStoreState, useView } from '../../app/store';
import { BusinessScreen } from './BusinessScreen';
import type { BizDeps } from './deps';
import { NoBusiness } from './StatusScreens';
import './biz.css';

export function BizRoute() {
  const view = useView();
  const game = useGame();
  const { mode, worldId, status, fixture } = useStoreState();
  const catalog = useCatalog();
  const navigate = useNavigate();
  const params = useParams();
  const tab = (params['*'] ?? '').split('/')[0] || 'today';

  // An official has a desk, not a business.
  useEffect(() => {
    if (view?.kind === 'official') navigate('/desk', { replace: true });
  }, [view?.kind, navigate]);

  if (!view) {
    return <div className="bz-root"><p className="bz-pad bz-muted" style={{ paddingTop: 24 }}>{status === 'offline' ? 'No connection to the city.' : 'Loading your business…'}</p></div>;
  }
  if (view.kind !== 'owner') {
    return <div className="bz-root"><NoBusiness onOpen={() => navigate('/start')} /></div>;
  }

  const niche = view.business?.niche;
  const deps: BizDeps = {
    view,
    pack: niche ? catalog?.packs.niches[niche] ?? null : null,
    common: catalog?.packs.common ?? null,
    online: status !== 'offline',
    act: game.act,
    // what_if runs every few hundred ms while the player edits: ask the client directly so a failed
    // forecast shows inside the card instead of a stream of toasts. Example data goes through the store.
    query: async <T,>(q: Query): Promise<Ack<T>> => {
      if (fixture) {
        const data = await game.query<T>(q);
        return data === null ? { ok: false, error: 'No answer on example data' } : { ok: true, data };
      }
      return getClient(mode).query<T>(worldId, q);
    },
    navigate: (to) => navigate(to),
    tabs: getBizTabs(),
  };

  return <BusinessScreen deps={deps} initialTab={tab} onTabChange={(t) => navigate(`/biz/${t}`, { replace: true })} />;
}
