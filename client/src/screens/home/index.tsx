import type { ScreenModule } from '../../app/screens';
import { DevStore } from '../../app/dev';
import { cityView, fixtureIdea, ownerView, ownerViewNew } from '../../app/fixtures';
import { Home } from './Home';

const ANSWERS = { idea: fixtureIdea };

export const screen: ScreenModule = {
  routes: [{ path: '/', element: <Home /> }],
  dev: [
    { id: 'home', title: 'Home — the city (CityView)', render: () => <DevStore view={cityView} answers={ANSWERS}><Home /></DevStore> },
    { id: 'home-back', title: 'Home — returning owner, "While you were away"', render: () => <DevStore view={ownerView} answers={ANSWERS}><Home /></DevStore> },
    { id: 'home-joined', title: 'Home — joined, not opened yet', render: () => <DevStore view={ownerViewNew} answers={ANSWERS}><Home /></DevStore> },
  ],
};
