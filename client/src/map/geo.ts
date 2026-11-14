// Pure helpers for CityMap: everything here is data in → data out, no DOM and no map instance.
import type {
  BlockFundStatus, DayWeather, GameEvent, NicheId, PackSet, Place, PublicBusiness, WeatherCondition,
} from '@ohh/shared/types';

export const USABLE_FLOOR_SHARE = 0.6; // mirrors RULES.USABLE_FLOOR_SHARE in shared/src/rules.ts

export interface NicheMeta { label: string; color: string; glyph: string; unitName: string; sqftPerUnit: number }

/** Fallback sizing when packs are not loaded yet (estimate; packs/<niche>.json sizing wins). */
export const NICHE_META: Record<NicheId, NicheMeta> = {
  cafe: { label: 'Café', color: '#ffb347', glyph: '☕', unitName: 'seats', sqftPerUnit: 18 },
  barbershop: { label: 'Barbershop', color: '#4cc9f0', glyph: '✂', unitName: 'chairs', sqftPerUnit: 55 },
  bodega: { label: 'Bodega', color: '#7ee081', glyph: '🛒', unitName: 'shelf feet', sqftPerUnit: 12 },
  guesthouse: { label: 'Guesthouse', color: '#c77dff', glyph: '🛏', unitName: 'rooms', sqftPerUnit: 280 },
  rentals: { label: 'Rentals', color: '#ff7aa8', glyph: '🏠', unitName: 'apartments', sqftPerUnit: 650 },
};

export type LngLat = [number, number];

export const rentPerMonth = (p: Place): number => Math.round((p.rentPerSqftYear * p.sqft) / 12);

export function trafficLabel(f: number): 'High' | 'Medium' | 'Low' {
  if (f >= 0.7) return 'High';
  if (f >= 0.45) return 'Medium';
  return 'Low';
}

/** How many size units of the niche fit into the place (same rule as the engine: usable share ÷ sq ft per unit). */
export function capacityFor(place: Place, niche: NicheId, packs?: PackSet): { units: number; unitName: string } {
  const sizing = packs?.niches[niche]?.sizing;
  const sqftPerUnit = sizing?.sqftPerUnit ?? NICHE_META[niche].sqftPerUnit;
  const unitName = sizing?.unitName ?? NICHE_META[niche].unitName;
  let units = Math.floor((place.sqft * USABLE_FLOOR_SHARE) / sqftPerUnit);
  if (sizing) units = Math.min(units, sizing.max);
  return { units: Math.max(0, units), unitName };
}

const M_PER_DEG_LAT = 111_040;
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const mLng = 111_320 * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  return Math.hypot((a.lat - b.lat) * M_PER_DEG_LAT, (a.lng - b.lng) * mLng);
}

const LIVE_STATUSES: PublicBusiness['status'][] = ['setup', 'open', 'closed'];

/** Place ids taken by a business that still exists (bankrupt businesses free their place). */
export function occupiedPlaceIds(businesses: PublicBusiness[]): Set<string> {
  return new Set(businesses.filter((b) => LIVE_STATUSES.includes(b.status)).map((b) => b.placeId));
}

export function competitorsNearby(place: Place, niche: NicheId, businesses: PublicBusiness[], places: Place[], radiusM = 300): number {
  const byId = new Map(places.map((p) => [p.id, p]));
  return businesses.filter((b) => {
    if (b.niche !== niche || b.placeId === place.id || !LIVE_STATUSES.includes(b.status)) return false;
    const at = byId.get(b.placeId);
    return at ? distanceM(at, place) <= radiusM : false;
  }).length;
}

export interface FeatureCollection<G> { type: 'FeatureCollection'; features: { type: 'Feature'; id?: number; geometry: G; properties: Record<string, string | number | boolean> }[] }
type Point = { type: 'Point'; coordinates: LngLat };
type Line = { type: 'LineString'; coordinates: LngLat[] };

/** Places as points; `state`: 'free' (fits the niche), 'other' (free, wrong niche), 'taken'. */
export function placeFeatures(places: Place[], businesses: PublicBusiness[], niche?: NicheId): FeatureCollection<Point> {
  const taken = occupiedPlaceIds(businesses);
  return {
    type: 'FeatureCollection',
    features: places.map((p, i) => {
      const fits = niche ? p.suitableFor.includes(niche) : p.suitableFor.length > 0;
      const state = taken.has(p.id) ? 'taken' : fits ? 'free' : 'other';
      return {
        type: 'Feature', id: i,
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: { id: p.id, state, tier: p.tier, foot: p.footTraffic, rent: rentPerMonth(p) },
      };
    }),
  };
}

export interface BizMarker { id: string; name: string; niche: NicheId; rank: number; isAi: boolean; mine: boolean; dim: boolean; status: PublicBusiness['status']; lng: number; lat: number; color: string; glyph: string }

export function businessMarkers(businesses: PublicBusiness[], places: Place[], myBusinessId?: string): BizMarker[] {
  const byId = new Map(places.map((p) => [p.id, p]));
  const out: BizMarker[] = [];
  for (const b of businesses) {
    const at = byId.get(b.placeId);
    if (!at) continue;
    out.push({
      id: b.id, name: b.name, niche: b.niche, rank: b.rankInNiche, isAi: b.isAi, mine: b.id === myBusinessId,
      dim: b.status === 'closed' || b.status === 'bankrupt', status: b.status, lng: at.lng, lat: at.lat,
      color: NICHE_META[b.niche].color, glyph: NICHE_META[b.niche].glyph,
    });
  }
  // own business last so it draws on top
  return out.sort((x, y) => Number(x.mine) - Number(y.mine));
}

export function businessFeatures(markers: BizMarker[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: markers.map((m, i) => ({
      type: 'Feature', id: i, geometry: { type: 'Point', coordinates: [m.lng, m.lat] },
      properties: { id: m.id, color: m.color, mine: m.mine, dim: m.dim, ai: m.isAi },
    })),
  };
}

/** One line per pair of businesses with an active deal (`partners`), deduplicated. */
export function partnerLines(businesses: PublicBusiness[], places: Place[]): FeatureCollection<Line> {
  const byPlace = new Map(places.map((p) => [p.id, p]));
  const byBiz = new Map(businesses.map((b) => [b.id, b]));
  const seen = new Set<string>();
  const features: FeatureCollection<Line>['features'] = [];
  for (const b of businesses) {
    for (const otherId of b.partners) {
      const key = [b.id, otherId].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      const o = byBiz.get(otherId);
      const p1 = byPlace.get(b.placeId), p2 = o ? byPlace.get(o.placeId) : undefined;
      if (!p1 || !p2) continue;
      features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[p1.lng, p1.lat], [p2.lng, p2.lat]] }, properties: { key } });
    }
  }
  return { type: 'FeatureCollection', features };
}

/** Each block drawn as a line through its two farthest places, stretched 25 m at both ends. */
export function blockSegments(places: Place[]): Map<string, LngLat[]> {
  const groups = new Map<string, Place[]>();
  for (const p of places) groups.set(p.block, [...(groups.get(p.block) ?? []), p]);
  const out = new Map<string, LngLat[]>();
  for (const [block, ps] of groups) {
    if (ps.length < 2) continue;
    let best: [Place, Place] = [ps[0], ps[1]];
    let bestD = -1;
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const d = distanceM(ps[i], ps[j]);
      if (d > bestD) { bestD = d; best = [ps[i], ps[j]]; }
    }
    const [a, b] = best;
    const k = bestD > 0 ? 25 / bestD : 0;
    const dx = b.lng - a.lng, dy = b.lat - a.lat;
    out.set(block, [[a.lng - dx * k, a.lat - dy * k], [b.lng + dx * k, b.lat + dy * k]]);
  }
  return out;
}

export function blockLines(blocks: string[], segments: Map<string, LngLat[]>, props: Record<string, string> = {}): FeatureCollection<Line> {
  return {
    type: 'FeatureCollection',
    features: blocks.flatMap((block) => {
      const coords = segments.get(block);
      return coords ? [{ type: 'Feature' as const, geometry: { type: 'LineString' as const, coordinates: coords }, properties: { block, ...props } }] : [];
    }),
  };
}

export const activeFundBlocks = (funds: BlockFundStatus[] = []): string[] => [...new Set(funds.filter((f) => f.active).map((f) => f.block))];

/** Events that are announced and not over yet. Without `day`, every event counts. */
export function liveEvents(events: GameEvent[] = [], day?: number): GameEvent[] {
  if (day === undefined) return events;
  return events.filter((e) => e.announcedDay <= day && day <= e.endDay);
}

/** Streets closed today: a traffic event tied to one block. */
export function closedBlocks(events: GameEvent[] = [], day?: number): string[] {
  return liveEvents(events, day)
    .filter((e) => e.kind === 'traffic' && e.block && (day === undefined || e.startDay <= day))
    .map((e) => e.block as string);
}

export function todayWeather(weather: DayWeather | DayWeather[] | undefined, day?: number): DayWeather | undefined {
  if (!weather) return undefined;
  if (!Array.isArray(weather)) return weather;
  return (day !== undefined && weather.find((w) => w.day === day)) || weather[0];
}

export const WEATHER_ICON: Record<WeatherCondition, string> = { clear: '☀', cloudy: '☁', rain: '🌧', snow: '❄', heat: '🔥', storm: '⛈' };

export function boundsOf(places: { lat: number; lng: number }[]): [LngLat, LngLat] {
  const lngs = places.map((p) => p.lng), lats = places.map((p) => p.lat);
  return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
}

export function centerOf(places: { lat: number; lng: number }[]): LngLat {
  const [[w, s], [e, n]] = boundsOf(places);
  return [(w + e) / 2, (s + n) / 2];
}

export const money = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`;

/** Real working places from data/real-businesses.json: labels only, never game objects. */
export interface RealBusinessLabel { id: string; name: string; type: string; lat: number; lng: number; grade?: string | null }

export function realFeatures(list: RealBusinessLabel[] = []): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: list.map((b, i) => ({
      type: 'Feature', id: i, geometry: { type: 'Point', coordinates: [b.lng, b.lat] },
      properties: { id: b.id, label: b.grade ? `${b.name} · ${b.grade}` : b.name, type: b.type },
    })),
  };
}
