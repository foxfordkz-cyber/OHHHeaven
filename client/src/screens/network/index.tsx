import type { ScreenModule } from '../../app/screens';
import { useCatalog } from '../../app/catalog';
import { NetworkTabScreen } from './NetworkTab';

/** The Network tab of /biz: neighbors, deals, the block fund and "report to the city". */
function NetworkTabRoute() {
  const catalog = useCatalog();
  return <NetworkTabScreen places={catalog?.places} packs={catalog?.packs ?? null} />;
}

export const screen: ScreenModule = {
  bizTabs: [{ id: 'network', label: 'Network', order: 40, element: <NetworkTabRoute /> }],
};
