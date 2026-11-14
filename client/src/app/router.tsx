import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Badge, Banner, Button, Card, Icon, List, ListRow, TopBar } from '../ui';
import { DevUi } from '../ui/DevUi';
import { getDevScreens, getRoutes, type DevScreen, type ScreenRoute } from './screens';
import { StoreToaster } from './dev';
import { switchMode, useStoreState } from './store';

/** Section 9 of the contract: these paths always exist; a screen module replaces the placeholder. */
const CORE: { path: string; title: string; owner: string; wide?: boolean }[] = [
  { path: '/biz/*', title: 'My business', owner: 'agent 10' },
  { path: '/desk', title: 'City official desk', owner: 'agent 12' },
  { path: '/city/:id', title: 'City screen', owner: 'agent 09', wide: true },
  { path: '/end', title: 'End of season', owner: 'agent 11' },
];

const OWN_DEV: DevScreen[] = [{ id: 'ui', title: 'Design system', render: () => <DevUi /> }];

function Placeholder({ title, owner }: { title: string; owner: string }) {
  const navigate = useNavigate();
  return (
    <main className="screen">
      <TopBar title={title} onBack={() => navigate('/')} />
      <Card tone="flat" title="This screen is on its way" subtitle={`Built by ${owner}. The city keeps running in the meantime.`}>
        <Button variant="secondary" icon="home" onClick={() => navigate('/')}>Back to the city</Button>
      </Card>
    </main>
  );
}

function NotFound() {
  return (
    <main className="screen">
      <TopBar title="Page not found" />
      <Link to="/" className="btn btn--secondary">Back to the city</Link>
    </main>
  );
}

function devScreens(): DevScreen[] {
  const seen = new Set<string>();
  return [...OWN_DEV, ...getDevScreens()].filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)));
}

function DevIndex() {
  const navigate = useNavigate();
  return (
    <main className="screen">
      <TopBar title="Screens on example data" right={<Badge tone="accent">/dev</Badge>} />
      <p className="small muted">Every screen opens here without a server.</p>
      <List>
        {devScreens().map((s) => (
          <ListRow key={s.id} icon="doc" title={s.title} subtitle={`/dev/${s.id}`} onClick={() => navigate(`/dev/${s.id}`)} />
        ))}
      </List>
    </main>
  );
}

function DevScreenPage() {
  const { screen = '' } = useParams();
  const found = devScreens().find((s) => s.id === screen);
  if (!found) return <NotFound />;
  return <>{found.render()}</>;
}

/** Connection state and mode, shown on every screen. */
function StatusBar() {
  const { status, mode, fixture } = useStoreState();
  const { pathname } = useLocation();
  if (fixture || pathname.startsWith('/dev') || pathname.startsWith('/city/')) return null;
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 20, padding: '8px 16px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {status === 'offline' && (
        <Banner icon="wifiOff">
          No connection to the city.{' '}
          {mode === 'remote' && (
            <button type="button" onClick={() => switchMode('local')} style={{ border: 0, background: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', padding: 0, font: 'inherit' }}>
              Practice offline
            </button>
          )}
        </Banner>
      )}
      {mode === 'local' && (
        <div className="row-between xsmall faint">
          <span className="row"><Icon name="wifiOff" size={14} /> Practice offline — the city runs in your browser</span>
          <button type="button" className="chip" style={{ minHeight: 26 }} onClick={() => switchMode('remote')}>Go online</button>
        </div>
      )}
    </div>
  );
}

function Shell({ wide, children }: { wide?: boolean; children: ReactNode }) {
  return (
    <div className={`app${wide ? ' app--wide' : ''}`}>
      <StatusBar />
      {children}
    </div>
  );
}

function routeElement(r: ScreenRoute | undefined, core: (typeof CORE)[number]) {
  return <Shell wide={r?.wide ?? core.wide}>{r ? r.element : <Placeholder title={core.title} owner={core.owner} />}</Shell>;
}

export function AppRoutes() {
  const plugged = getRoutes();
  const corePaths = new Set(CORE.map((c) => c.path));
  const extra = plugged.filter((r) => !corePaths.has(r.path));
  return (
    <Routes>
      {CORE.map((c) => (
        <Route key={c.path} path={c.path} element={routeElement(plugged.find((r) => r.path === c.path), c)} />
      ))}
      {extra.map((r) => (
        <Route key={r.path} path={r.path} element={<Shell wide={r.wide}>{r.element}</Shell>} />
      ))}
      <Route path="/dev" element={<Shell><DevIndex /></Shell>} />
      <Route path="/dev/:screen" element={<DevRoute />} />
      <Route path="*" element={<Shell><NotFound /></Shell>} />
    </Routes>
  );
}

function DevRoute() {
  const { screen = '' } = useParams();
  const wide = devScreens().find((s) => s.id === screen)?.wide;
  return (
    <Shell wide={wide}>
      <DevScreenPage />
    </Shell>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <AppRoutes />
      <StoreToaster />
    </BrowserRouter>
  );
}
