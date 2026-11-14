import { useMemo } from 'react';
import type { ScreenModule } from '../../app/screens';
import { WithStore } from '../../app/dev';
import { useOwnerView } from '../../app/store';
import { devStore } from '../insights/dev-store';
import { cafeEndedView, cafeView, RULE_CARDS, type ViewWithExtra } from '../insights/fixtures';
import { EndConnected, EndScreen } from './EndScreen';
import { Leaderboards } from './Leaderboards';
import { PlanConnected, PlanScreen } from './PlanScreen';
import { useGame } from '../../app/store';

function LeaderboardsPage() {
  const view = useOwnerView();
  return (
    <main className="screen stack">
      <h1 className="h2" style={{ margin: 0 }}>Leaderboards</h1>
      {view ? <Leaderboards view={view} /> : <p className="muted">Join the city to see the tables.</p>}
    </main>
  );
}

function DevEnd({ view }: { view: ViewWithExtra }) {
  const store = useMemo(() => devStore(view, { delayMs: 700 }), [view]);
  return <WithStore store={store}><DevEndInner view={view} /></WithStore>;
}
function DevEndInner({ view }: { view: ViewWithExtra }) {
  const { query } = useGame();
  return <EndScreen view={view} ask={query} cards={RULE_CARDS} planHref="/dev/plan" />;
}

function DevPlan() {
  const store = useMemo(() => devStore(cafeEndedView, { delayMs: 500 }), []);
  return <WithStore store={store}><DevPlanInner /></WithStore>;
}
function DevPlanInner() {
  const { query, toast } = useGame();
  return <PlanScreen ask={query} cards={RULE_CARDS} toast={toast} />;
}

function DevLeaderboards() {
  const store = useMemo(() => devStore(cafeView), []);
  return <WithStore store={store}><LeaderboardsPage /></WithStore>;
}

export const screen: ScreenModule = {
  routes: [
    { path: '/end', element: <EndConnected /> },
    { path: '/end/plan', element: <PlanConnected /> },
    { path: '/leaderboards', element: <LeaderboardsPage /> },
  ],
  dev: [
    { id: 'end', title: 'End of season — 2nd of 18 coffee shops', render: () => <DevEnd view={cafeEndedView} /> },
    { id: 'end-running', title: 'End screen during the season', render: () => <DevEnd view={cafeView as ViewWithExtra} /> },
    { id: 'plan', title: 'Your real-world plan', render: () => <DevPlan /> },
    { id: 'leaderboards', title: 'Leaderboards', render: () => <DevLeaderboards /> },
  ],
};
