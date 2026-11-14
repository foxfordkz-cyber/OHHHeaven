// Stand-in for agent 09's <CityMap mode="live"> (client/src/map/). Same props; flat SVG instead of MapLibre.
import type { Place, PublicBusiness } from '../../../../../shared/src/types';

export interface CityMapProps {
  places: Place[]; businesses: PublicBusiness[]; myBusinessId?: string; mode: 'pick' | 'live';
  onOpenBusiness?: (businessId: string) => void; onPick?: (placeId: string) => void;
}

export function CityMap(props: CityMapProps) {
  const W = 358, H = 240, pad = 22;
  const placed = props.businesses
    .map((b) => ({ b, p: props.places.find((p) => p.id === b.placeId) }))
    .filter((x): x is { b: PublicBusiness; p: Place } => !!x.p);
  if (placed.length === 0) return <div className="ui-muted">Map unavailable</div>;
  const lats = placed.map((x) => x.p.lat), lngs = placed.map((x) => x.p.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const sx = (lng: number) => pad + ((lng - minLng) / (maxLng - minLng || 1)) * (W - 2 * pad);
  const sy = (lat: number) => H - pad - ((lat - minLat) / (maxLat - minLat || 1)) * (H - 2 * pad);
  const at = new Map(placed.map((x) => [x.b.id, x]));
  const links = placed.flatMap((x) => x.b.partners.filter((id) => id > x.b.id && at.has(id)).map((id) => [x, at.get(id)!] as const));
  return (
    <svg className="stub-map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Map of the block with neighbors">
      <rect x="0" y="0" width={W} height={H} rx="14" fill="#0b1220" />
      {links.map(([a, b]) => (
        <line key={`${a.b.id}-${b.b.id}`} x1={sx(a.p.lng)} y1={sy(a.p.lat)} x2={sx(b.p.lng)} y2={sy(b.p.lat)} stroke="#4f8cff" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.8" />
      ))}
      {placed.map(({ b, p }) => {
        const mine = b.id === props.myBusinessId;
        const off = b.status === 'closed' || b.status === 'bankrupt';
        return (
          <g key={b.id} transform={`translate(${sx(p.lng)},${sy(p.lat)})`} opacity={off ? 0.4 : 1} style={{ cursor: props.onOpenBusiness ? 'pointer' : 'default' }} onClick={() => props.onOpenBusiness?.(b.id)}>
            <circle r={mine ? 8 : 6} fill={mine ? '#4f8cff' : b.isAi ? '#b48cff' : '#e8ecf1'} stroke="#0b1220" strokeWidth="2" />
            <text x="10" y="4" fontSize="10" fill="#9aa4b2">{b.name}</text>
          </g>
        );
      })}
    </svg>
  );
}
