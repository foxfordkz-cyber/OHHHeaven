// Screen /brief — "while you were away": what changed, the one decision that waits, when the next report lands.
// The router finds this module by itself (import.meta.glob in app/screens.tsx).
import type { ScreenModule } from '../../app/screens';
import { BriefRoute } from './BriefRoute';
import { DevBrief } from './DevBrief';

export const screen: ScreenModule = {
  routes: [{ path: '/brief', element: <BriefRoute /> }],
  dev: [{ id: 'brief', title: 'Return brief — while you were away', render: () => <DevBrief /> }],
};
