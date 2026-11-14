// Network tab of /biz (neighbors, deals, block fund, report to the city) and its /dev pages.
// The router of agent 08 finds this module by itself; agent 10 renders the tab from getBizTabs().
import type { ScreenModule } from './deps';
import { NetworkTabScreen } from './NetworkTab';
import { DevNetwork, DevNetworkSetup, DevNetworkWeek } from './dev';

export const screen: ScreenModule = {
  bizTabs: [{ id: 'network', label: 'Network', order: 40, element: <NetworkTabScreen /> }],
  dev: [
    { id: 'network', title: 'Network tab — offers, deals, block fund, reports', render: () => <DevNetwork /> },
    { id: 'network-week', title: 'Network tab — block fund on, report used this week', render: () => <DevNetworkWeek /> },
    { id: 'network-setup', title: 'Network tab — business not open yet', render: () => <DevNetworkSetup /> },
  ],
};

export { NetworkTab, NetworkTabScreen } from './NetworkTab';

export { RivalStrip, RivalStripView } from './RivalStrip';
