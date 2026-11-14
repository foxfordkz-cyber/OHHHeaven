// Slots for pieces other agents build. Today they render stand-ins; switch one import when the real piece lands.
// CityMap — agent 09 (client/src/map/). Signature from build/tasks/09-map-city.md.
import { useMemo } from 'react';
import type { DayWeather, GameEvent, NicheId, Place, PublicBusiness } from '@ohh/shared/types';
import { Icon, WEATHER_ICON } from '../ui';
import { CityMap } from '../map';

export interface CityMapProps {
  places: Place[];
  businesses: PublicBusiness[];
  myBusinessId?: string;
  weather?: DayWeather;
  events?: GameEvent[];
  mode: 'pick' | 'live';
  niche?: NicheId;
  onPick?: (placeId: string) => void;
  onOpenBusiness?: (businessId: string) => void;
  /** stand-in only: height in px */
  height?: number;
  /** stand-in only: highlighted place in pick mode */
  selectedPlaceId?: string;
}

/** The real map of agent 09 (client/src/map). Under tests (no WebGL) the light stand-in below is used. */
export function CityMapSlot(props: CityMapProps) {
  if (import.meta.env.MODE === 'test') return <StubCityMap {...props} />;
  const { height = 240, selectedPlaceId: _selected, ...rest } = props;
  return (
    <div style={{ height, borderRadius: 16, overflow: 'hidden' }}>
      <CityMap {...rest} intro={false} />
    </div>
  );
}

const W = 390;

function StubCityMap({ places, businesses, myBusinessId, weather, events = [], mode, niche, onPick, onOpenBusiness, height = 240, selectedPlaceId }: CityMapProps) {
  const H = Math.round((height / 240) * 240);
  const { project } = useMemo(() => {
    const lats = places.map((p) => p.lat);
    const lngs = places.map((p) => p.lng);
    const pad = 0.0012;
    const minLat = Math.min(...lats, 40.721) - pad;
    const maxLat = Math.max(...lats, 40.731) + pad;
    const minLng = Math.min(...lngs, -73.992) - pad;
    const maxLng = Math.max(...lngs, -73.979) + pad;
    return {
      project: (lat: number, lng: number) => ({ x: ((lng - minLng) / (maxLng - minLng)) * W, y: ((maxLat - lat) / (maxLat - minLat)) * H }),
    };
  }, [places, H]);

  const byPlace = new Map(businesses.filter((b) => b.status !== 'bankrupt').map((b) => [b.placeId, b]));
  const activeEvent = events.find((e) => e.block);
  const park = project(40.7265, -73.9817);

  return (
    <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', border: '1px solid var(--border)', background: 'radial-gradient(120% 90% at 30% 20%, #18202e 0%, #0d1118 70%)' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={height} role="img" aria-label={mode === 'pick' ? 'Map of free places' : 'Map of the neighborhood'} style={{ display: 'block' }}>
        <defs>
          <radialGradient id="glow" r="0.5">
            <stop offset="0%" stopColor="#ffc93c" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#ffc93c" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g transform={`rotate(-29 ${W / 2} ${H / 2})`} opacity="0.9">
          {Array.from({ length: 14 }, (_, i) => (
            <line key={`a${i}`} x1={-120 + i * 52} y1={-200} x2={-120 + i * 52} y2={H + 200} stroke="#232b3a" strokeWidth={i % 3 === 0 ? 7 : 4} />
          ))}
          {Array.from({ length: 22 }, (_, i) => (
            <line key={`s${i}`} x1={-200} y1={-160 + i * 26} x2={W + 200} y2={-160 + i * 26} stroke="#1c2330" strokeWidth={2.5} />
          ))}
          <rect x={park.x - 30} y={park.y - 40} width={58} height={74} rx={6} fill="#173226" stroke="#21493a" />
        </g>
        <text x={park.x - 4} y={park.y + 4} fill="#3f7a62" fontSize="9" textAnchor="middle" fontFamily="var(--font)">Tompkins Sq</text>
        {places.map((p) => {
          const { x, y } = project(p.lat, p.lng);
          const biz = byPlace.get(p.id);
          if (mode === 'pick') {
            const fits = !biz && (!niche || p.suitableFor.includes(niche));
            const selected = p.id === selectedPlaceId;
            return (
              <g key={p.id} onClick={fits && onPick ? () => onPick(p.id) : undefined} style={{ cursor: fits && onPick ? 'pointer' : 'default' }}>
                {fits && <circle cx={x} cy={y} r={selected ? 20 : 14} fill="url(#glow)" />}
                <circle cx={x} cy={y} r={selected ? 8 : 6} fill={fits ? '#ffc93c' : '#3a4252'} stroke={selected ? '#fff' : '#0b0d12'} strokeWidth={2} />
              </g>
            );
          }
          if (!biz) return <circle key={p.id} cx={x} cy={y} r={3} fill="#2c3443" />;
          const mine = biz.id === myBusinessId;
          const dim = biz.status === 'closed' || biz.status === 'setup';
          const color = mine ? '#ffc93c' : biz.isAi ? '#a78bfa' : biz.niche === 'cafe' ? '#34d399' : '#7cb2ff';
          return (
            <g key={p.id} onClick={onOpenBusiness ? () => onOpenBusiness(biz.id) : undefined} style={{ cursor: onOpenBusiness ? 'pointer' : 'default' }} opacity={dim ? 0.45 : 1}>
              {mine && <circle cx={x} cy={y} r={16} fill="url(#glow)" />}
              <circle cx={x} cy={y} r={mine ? 7.5 : 6} fill={color} stroke="#0b0d12" strokeWidth={2} />
              {(mine || biz.rankInNiche <= 2) && (
                <text x={x + 10} y={y + 4} fill="#d6dbe4" fontSize="10" fontWeight={mine ? 700 : 500} fontFamily="var(--font)">
                  {biz.name.length > 18 ? `${biz.name.slice(0, 17)}…` : biz.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div style={{ position: 'absolute', left: 10, top: 10, display: 'flex', gap: 6, flexWrap: 'wrap', right: 10 }}>
        <span className="badge" style={{ background: 'rgba(11,13,18,0.8)' }}>East Village</span>
        {weather && (
          <span className="badge" style={{ background: 'rgba(11,13,18,0.8)' }}>
            <Icon name={WEATHER_ICON[weather.condition]} size={12} /> {weather.label}
          </span>
        )}
        {activeEvent && (
          <span className="badge badge--info" style={{ background: 'rgba(11,13,18,0.85)' }}>
            <Icon name="bell" size={12} /> {activeEvent.title}
          </span>
        )}
      </div>
      {mode === 'live' && (
        <div style={{ position: 'absolute', left: 10, bottom: 8, display: 'flex', gap: 10, fontSize: 11, color: 'var(--text-2)' }}>
          <Legend color="#34d399" label="Coffee" />
          <Legend color="#7cb2ff" label="Barbers" />
          <Legend color="#a78bfa" label="AI" />
        </div>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 8, height: 8, borderRadius: 8, background: color, display: 'inline-block' }} />
      {label}
    </span>
  );
}
