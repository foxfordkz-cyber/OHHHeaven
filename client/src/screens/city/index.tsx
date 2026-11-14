export { CityScreen, CityScreenRoute, type CityScreenProps } from './CityScreen';
export { QrCode } from './QrCode';
export { useCityView, sendClock, viewUrl, type ClockCommand } from './useCityView';
export * from './cityModel';

import { useParams } from 'react-router-dom';
import type { ScreenModule } from '../../app/screens';
import { CityScreenRoute } from './CityScreen';

function CityRoute() {
  const { id } = useParams();
  return <CityScreenRoute worldId={id ?? 'demo'} />;
}

/** /city/:id — the wide city screen for the projector. */
export const screen: ScreenModule = {
  routes: [{ path: '/city/:id', element: <CityRoute />, wide: true }],
};
