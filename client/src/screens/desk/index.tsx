// /desk — the city official's desk (OfficialView) and its /dev pages. The router of agent 08 finds this module by itself.
// Wide route: on a computer the desk uses the whole screen (queue, my cases and the ranking side by side).
import type { ScreenModule } from '../../app/screens';
import { DeskScreen } from './DeskScreen';
import { DevDesk, DevDeskEmpty, DevDeskExposed } from './dev';

export const screen: ScreenModule = {
  routes: [{ path: '/desk', element: <DeskScreen />, wide: true }],
  dev: [
    { id: 'desk', title: 'Official desk — queue, inspection, fine notice, bribe offer', render: () => <DevDesk />, wide: true },
    { id: 'desk-empty', title: 'Official desk — empty queue', render: () => <DevDeskEmpty />, wide: true },
    { id: 'desk-exposed', title: 'Official desk — exposed by Internal Affairs', render: () => <DevDeskExposed />, wide: true },
  ],
};

export { Desk, DeskScreen } from './DeskScreen';
