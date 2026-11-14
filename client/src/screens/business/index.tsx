// Screen /biz — "my business" (OwnerView): Today, Manage, Books and fine notices.
// The router (agent 08) finds this module by itself; Network and Insights tabs come from getBizTabs().
import type { ScreenModule } from '../../app/screens';
import { BizRoute } from './BizRoute';
import { DevBiz } from './DevBiz';

export const screen: ScreenModule = {
  routes: [{ path: '/biz/*', element: <BizRoute /> }],
  dev: [{ id: 'biz', title: 'My business — every state (OwnerView)', render: () => <DevBiz /> }],
};
