import type { ScreenModule } from '../../app/screens';
import { DevStore } from '../../app/dev';
import { cityView, fixtureIdea, ownerView, ownerViewNew } from '../../app/fixtures';
import { Home } from './Home';

const ANSWERS = { idea: fixtureIdea };

export const screen: ScreenModule = {
  routes: [{ path: '/', element: <Home />, wide: true }],
  dev: [
    { id: 'home', title: 'Home — the city (CityView)', wide: true, render: () => <DevStore view={cityView} answers={ANSWERS}><Home /></DevStore> },
    { id: 'home-back', title: 'Home — returning owner, "While you were away"', wide: true, render: () => <DevStore view={ownerView} answers={ANSWERS}><Home /></DevStore> },
    { id: 'home-joined', title: 'Home — joined, not opened yet', wide: true, render: () => <DevStore view={ownerViewNew} answers={ANSWERS}><Home /></DevStore> },
  ],
};
