import { useMemo } from 'react';
import type { ScreenModule } from '../../app/screens';
import { WithStore } from '../../app/dev';
import { devStore } from './dev-store';
import { cafeRiskyView, cafeSetupView, cafeStrugglingView, cafeView } from './fixtures';
import { InsightsTabConnected } from './InsightsTab';
import type { OwnerView } from '@ohh/shared/types';

const DEV_LINKS = { plan: '/dev/plan', leaderboards: '/dev/leaderboards' };

function DevInsights({ view, hang }: { view: OwnerView; hang?: boolean }) {
  const store = useMemo(() => devStore(view, { delayMs: 900, hang }), [view, hang]);
  return (
    <WithStore store={store}>
      <main className="screen">
        <div className="eyebrow">Insights · example data</div>
        <InsightsTabConnected links={DEV_LINKS} />
      </main>
    </WithStore>
  );
}

export const screen: ScreenModule = {
  bizTabs: [{ id: 'insights', label: 'Insights', order: 50, element: <InsightsTabConnected /> }],
  dev: [
    { id: 'insights', title: 'Insights — cafe in profit, June', render: () => <DevInsights view={cafeView} /> },
    { id: 'insights-loss', title: 'Insights — losing money, tax due in 5 days', render: () => <DevInsights view={cafeStrugglingView} /> },
    { id: 'insights-risky', title: 'Insights — paying wages in cash', render: () => <DevInsights view={cafeRiskyView} /> },
    { id: 'insights-setup', title: 'Insights — before opening', render: () => <DevInsights view={cafeSetupView} /> },
    { id: 'insights-timeout', title: 'Insights — advisor does not answer', render: () => <DevInsights view={cafeView} hang /> },
  ],
};
