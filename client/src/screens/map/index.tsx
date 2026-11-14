import { useNavigate, useSearchParams } from 'react-router-dom';
import type { OwnerView, PublicBusiness } from '@ohh/shared/types';
import type { ScreenModule } from '../../app/screens';
import { useCatalog } from '../../app/catalog';
import { useView } from '../../app/store';
import { CityMap } from '../../map';
import './map-screen.css';

/** The owner's own business as others see it, so it is on the map too. */
function ownPublic(view: OwnerView): PublicBusiness[] {
  const b = view.business;
  if (!b) return [];
  return [{
    id: b.id, name: b.name, ownerName: view.me.name, isAi: false, niche: b.niche, placeId: b.placeId, status: b.status,
    price: b.orders.price, reputation: b.reputation, rankInNiche: b.history[b.history.length - 1]?.rankInNiche ?? 0,
    trust: b.trust,
    partners: view.deals.filter((d) => d.status === 'active').map((d) => (d.fromBusinessId === b.id ? d.toBusinessId : d.fromBusinessId)),
  }];
}

/** /map — the whole district, full screen: zoom, look around, tap a business to see who runs it. */
function MapScreen() {
  const view = useView();
  const catalog = useCatalog();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  if (!view || !catalog) return <div className="map-screen map-screen--loading">Loading the city…</div>;
  const businesses: PublicBusiness[] = view.kind === 'owner' ? [...ownPublic(view), ...view.neighbors] : view.kind === 'city' ? view.businesses : [];
  const myId = view.kind === 'owner' ? view.business?.id : undefined;
  const cta = view.kind === 'official'
    ? undefined
    : myId
      ? { label: 'Deals and reports', onClick: () => navigate('/biz/network') }
      : { label: 'Open my own business', onClick: () => navigate('/start') };
  return (
    <div className="map-screen">
      <CityMap
        mode="live" places={catalog.places} packs={catalog.packs} businesses={businesses} myBusinessId={myId}
        weather={view.weather} events={view.events} day={view.world.day}
        blockFunds={view.kind === 'city' ? view.blockFunds : undefined}
        businessCta={cta} initialBusinessId={params.get('b') ?? undefined} intro={false}
      />
      <button type="button" className="map-screen__back" onClick={() => navigate(-1)} aria-label="Back">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
      </button>
    </div>
  );
}

export const screen: ScreenModule = {
  routes: [{ path: '/map', element: <MapScreen />, wide: true }],
};
