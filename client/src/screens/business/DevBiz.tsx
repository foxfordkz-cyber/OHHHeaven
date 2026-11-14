// /dev/biz — the screen on sample data, no server. Every state is one tap away.
import { useMemo, useState } from 'react';
import type { OwnerView } from '@ohh/shared/types';
import { DevStore } from '../../app/dev';
import { getBizTabs } from '../../app/screens';
import { cafePack, commonPack } from './__stubs__/cafePack';
import { fakeDeps, fakeReduce } from './__stubs__/fakeDeps';
import { BusinessScreen } from './BusinessScreen';
import { fixture, FIXTURE_NAMES, type FixtureName } from './fixtures';
import './biz.css';

const LABEL: Record<FixtureName, string> = {
  open: 'Open', away: 'Back after 6 days', notice: 'Fine notice', setup: 'Setup', closed: 'Closed', bankrupt: 'Bankrupt', none: 'No business',
};

function readParam(): FixtureName {
  try {
    const s = new URLSearchParams(window.location.search).get('state') as FixtureName | null;
    return s && FIXTURE_NAMES.includes(s) ? s : 'away';
  } catch {
    return 'away';
  }
}

export function DevBiz({ initial }: { initial?: FixtureName }) {
  const [name, setName] = useState<FixtureName>(initial ?? readParam());
  const [view, setView] = useState<OwnerView>(() => fixture(initial ?? readParam()));
  const [online, setOnline] = useState(true);
  const [log, setLog] = useState<string[]>([]);
  const [epoch, setEpoch] = useState(0);

  const pick = (n: FixtureName) => {
    setName(n); setView(fixture(n)); setLog([]); setEpoch((e) => e + 1);
    try { localStorage.removeItem('ohh.rules.seen'); } catch { /* ignore */ }
  };
  const deps = useMemo(() => ({
    ...fakeDeps({
      view, pack: cafePack, common: commonPack, online, onView: setView,
      log: (l) => setLog((old) => [l, ...old].slice(0, 8)),
    }),
    tabs: getBizTabs(),
  }), [view, online]);

  return (
    // Other agents' tabs (Network, Insights) read the same sample view from the store.
    <DevStore view={view} onAct={(a, current) => { const next = fakeReduce(current as OwnerView, a); setView(next); return next; }}>
      <div className="bz-root" style={{ minHeight: 0, paddingBottom: 0 }}>
        <div className="bz-dev" aria-label="Dev controls">
          <div className="bz-row bz-wrap">
            <b>/dev/biz</b>
            {FIXTURE_NAMES.map((n) => (
              <button key={n} type="button" className={`bz-pill${n === name ? ' bz-tone-info' : ''}`} style={{ border: 0, cursor: 'pointer' }} onClick={() => pick(n)}>{LABEL[n]}</button>
            ))}
            <label className="bz-row"><input type="checkbox" checked={!online} onChange={(e) => setOnline(!e.target.checked)} /> offline</label>
          </div>
          {log.length > 0 && <pre aria-label="Sent to server">{log.join('\n')}</pre>}
        </div>
      </div>
      <BusinessScreen key={`${name}-${epoch}`} deps={deps} />
    </DevStore>
  );
}
