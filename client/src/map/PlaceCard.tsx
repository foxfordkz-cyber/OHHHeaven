// Card for one place in "pick" mode: the facts a future owner needs before signing a lease.
import type { NicheId, PackSet, Place, PublicBusiness } from '../../../shared/src/types';
import { NICHE_META, capacityFor, competitorsNearby, money, occupiedPlaceIds, rentPerMonth, trafficLabel } from './geo';

export interface PlaceCardProps {
  place: Place; places: Place[]; businesses: PublicBusiness[]; niche?: NicheId; packs?: PackSet;
  onOpen?: (placeId: string) => void; onClose: () => void;
}

export function PlaceCard({ place, places, businesses, niche, packs, onOpen, onClose }: PlaceCardProps) {
  const taken = occupiedPlaceIds(businesses).has(place.id);
  const fits = niche ? place.suitableFor.includes(niche) : place.suitableFor.length > 0;
  const n = niche && place.suitableFor.includes(niche) ? niche : place.suitableFor[0];
  const cap = n ? capacityFor(place, n, packs) : null;
  const rivals = n ? competitorsNearby(place, n, businesses, places) : 0;
  const meta = n ? NICHE_META[n] : null;
  const traffic = trafficLabel(place.footTraffic);
  const unverified = /unverified/i.test(place.note ?? '');
  return (
    <section className="cm-card" role="dialog" aria-label={`Place at ${place.address}`}>
      <header className="cm-card__head">
        <div>
          <div className="cm-card__eyebrow">{place.block}</div>
          <h3 className="cm-card__title">{place.address}</h3>
        </div>
        <button type="button" className="cm-card__close" onClick={onClose} aria-label="Close">×</button>
      </header>
      <div className="cm-card__tags">
        <span className={`cm-tag cm-tag--${place.tier}`}>{place.tier}</span>
        <span className="cm-tag">{place.kind === 'building' ? 'Whole building' : 'Storefront'}</span>
        {place.suitableFor.map((s) => <span key={s} className="cm-tag cm-tag--niche" style={{ color: NICHE_META[s].color }}>{NICHE_META[s].glyph} {NICHE_META[s].label}</span>)}
      </div>
      <dl className="cm-card__grid">
        <div><dt>Rent</dt><dd>{money(rentPerMonth(place))}<small>/mo</small></dd><span className="cm-card__sub">${place.rentPerSqftYear}/sq ft/yr</span></div>
        <div><dt>Size</dt><dd>{place.sqft.toLocaleString('en-US')}<small> sq ft</small></dd></div>
        <div>
          <dt>Foot traffic</dt><dd>{traffic}</dd>
          <span className="cm-bar"><span style={{ width: `${Math.round(place.footTraffic * 100)}%` }} /></span>
        </div>
        {cap && meta && <div><dt>Fits</dt><dd>{cap.units}<small> {cap.unitName}</small></dd></div>}
        {meta && <div><dt>Rivals within 300 m</dt><dd>{rivals}<small> {meta.label.toLowerCase()}{rivals === 1 ? '' : 's'}</small></dd></div>}
      </dl>
      {unverified && <p className="cm-card__note">Place data hand-collected on real streets; address and size not yet verified.</p>}
      <button
        type="button" className="cm-btn cm-btn--primary"
        disabled={taken || !fits || !onOpen}
        onClick={() => onOpen?.(place.id)}
      >
        {taken ? 'Taken' : fits ? 'Open here' : `Not for a ${niche ? NICHE_META[niche].label.toLowerCase() : 'business'}`}
      </button>
    </section>
  );
}
