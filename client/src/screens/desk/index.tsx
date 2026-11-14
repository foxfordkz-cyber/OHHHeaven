// /desk — the city official's desk (OfficialView) and its /dev pages. The router of agent 08 finds this module by itself.
import type { ScreenModule } from '../network/deps';
import { DeskScreen } from './DeskScreen';
import { DevDesk, DevDeskEmpty, DevDeskExposed } from './dev';

export const screen: ScreenModule = {
  routes: [{ path: '/desk', element: <DeskScreen /> }],
  dev: [
    { id: 'desk', title: 'Official desk — queue, inspection, fine notice, bribe offer', render: () => <DevDesk /> },
    { id: 'desk-empty', title: 'Official desk — empty queue', render: () => <DevDeskEmpty /> },
    { id: 'desk-exposed', title: 'Official desk — exposed by Internal Affairs', render: () => <DevDeskExposed /> },
  ],
};

export { Desk, DeskScreen } from './DeskScreen';
