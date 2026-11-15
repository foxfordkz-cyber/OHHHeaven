// CityMap — the real East Village in the app's theme (night map on dark, day map on light): places to pick, businesses at war and in deals,
// weather, closed streets and lit blocks. Falls back to a saved offline snapshot when tiles do not load.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Map as MapLibreMap, Marker, setWorkerUrl, type GeoJSONSource, type MapLayerMouseEvent } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BusinessCard, type BusinessCta } from './BusinessCard';
import './map.css';
import offlineImageUrl from '../../../data/offline-map.png';
import offlineMeta from '../../../data/offline-map.json';
import offlineBuildingsUrl from '../../../data/offline-buildings.json?url';
import type { BlockFundStatus, DayWeather, GameEvent, NicheId, PackSet, Place, PublicBusiness } from '@ohh/shared/types';
import { dateOf } from '@ohh/shared/rules';
import {
  NICHE_META, WEATHER_ICON, activeFundBlocks, blockLines, blockSegments, businessFeatures, businessMarkers, centerOf,
  closedBlocks, declutterRects, liveEvents, partnerLines, placeFeatures, realFeatures, todayWeather, type BizMarker, type LngLat,
  type RealBusinessLabel,
} from './geo';
import { cityStyle, isTileFailure, mapPalette, offlineStyle, OFFLINE_STYLE_NAME, type MapTheme, type StyleSpecification } from './mapStyle';
import { getTheme, useTheme } from '../ui/theme';
import { useT } from '../ui/i18n';
import { PlaceCard } from './PlaceCard';
import { WeatherLayer } from './WeatherLayer';

setWorkerUrl(workerUrl);

export interface CityMapProps {
  places: Place[];
  businesses: PublicBusiness[];
  myBusinessId?: string;
  weather?: DayWeather | DayWeather[];
  events?: GameEvent[];
  mode: 'pick' | 'live';
  niche?: NicheId;
  onPick?: (placeId: string) => void;
  onOpenBusiness?: (businessId: string) => void;
  /** Live mode: the button on the card that opens when a business is tapped. */
  businessCta?: BusinessCta;
  /** Shows an "expand" button (the caller opens the full-screen map). */
  onExpand?: () => void;
  /** Open this business's card right away (full-screen map opened from a tap elsewhere). */
  initialBusinessId?: string;
  /** Pick mode: open this place's card right away (a link to one storefront). */
  initialPlaceId?: string;
  /**
   * Live mode, full screen: the "Free storefronts" switch shows the places nobody runs yet; a tap opens the place card.
   * Its button calls this; without it the button goes to /start for that niche.
   */
  onStartHere?: (placeId: string, niche: NicheId) => void;
  /** The map sits inside a scrolling page: scroll and one finger move the page, ctrl+scroll or two fingers move the map. */
  embedded?: boolean;
  /** Today's game day: filters events and weather. Without it every event passed in is shown. */
  day?: number;
  /** Lit streets: blocks whose fund is active this month. */
  blockFunds?: BlockFundStatus[];
  /** Real working places (data/real-businesses.json): grey dots, names when zoomed in. Labels only. */
  realBusinesses?: RealBusinessLabel[];
  /** Real sizing for "how many seats fit"; defaults are used until packs load. */
  packs?: PackSet;
  /** Force the offline snapshot (otherwise it switches on its own when tiles fail). */
  offline?: boolean;
  /** Fly over the district on open (default true; off with prefers-reduced-motion). */
  intro?: boolean;
  /** Slow orbit for the projector screen; pauses while someone touches the map. */
  orbit?: boolean;
  className?: string;
  style?: CSSProperties;
}

const LAYERS_PICK = ['ohh-places-halo', 'ohh-places-dot', 'ohh-places-hit'];
const TILE_TIMEOUT_MS = 8000;
const FINAL_VIEW = { pitch: 55, bearing: 29 };
/** Phones: less tilt loads fewer far tiles, fewer pixels to draw, no fly-over on open (see mapBudget). */
export function mapBudget(small: boolean, dpr: number): { pitch: number; pixelRatio: number; intro: boolean; antialias: boolean } {
  return small
    ? { pitch: 45, pixelRatio: Math.min(dpr || 1, 1.5), intro: false, antialias: false }
    : { pitch: FINAL_VIEW.pitch, pixelRatio: Math.min(dpr || 1, 2), intro: true, antialias: true };
}
const MAX_BOUNDS: [LngLat, LngLat] = [[-74.014, 40.705], [-73.952, 40.748]];
const EMPTY = { type: 'FeatureCollection', features: [] };

const offlineAssets = (theme: MapTheme) => offlineStyle({
  imageUrl: offlineImageUrl,
  coordinates: offlineMeta.coordinates as [[number, number], [number, number], [number, number], [number, number]],
  buildingsUrl: offlineBuildingsUrl,
}, theme);

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const isSmallScreen = () => typeof window !== 'undefined' && window.innerWidth < 700;

type GeoData = Parameters<GeoJSONSource['setData']>[0];

function installOverlays(map: MapLibreMap, theme: MapTheme) {
  const c = mapPalette(theme);
  for (const id of ['ohh-real', 'ohh-fund', 'ohh-closed', 'ohh-deals', 'ohh-places', 'ohh-biz']) {
    if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: EMPTY as GeoData });
  }
  const add = (layer: Parameters<MapLibreMap['addLayer']>[0]) => { if (!map.getLayer(layer.id)) map.addLayer(layer); };
  add({
    id: 'ohh-real-dot', type: 'circle', source: 'ohh-real', minzoom: 14.5,
    paint: { 'circle-color': c.poi, 'circle-opacity': 0.75, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 14.5, 1.5, 18, 4], 'circle-stroke-color': c.outline, 'circle-stroke-width': 0.8 },
  });
  if (map.getStyle().glyphs) {
    add({
      id: 'ohh-real-name', type: 'symbol', source: 'ohh-real', minzoom: 16.2,
      layout: { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Regular'], 'text-size': 10.5, 'text-offset': [0, 0.9], 'text-anchor': 'top', 'text-optional': true, 'text-max-width': 9 },
      paint: { 'text-color': c.label, 'text-halo-color': c.halo, 'text-halo-width': 1.3 },
    });
  }
  add({ id: 'ohh-fund-glow', type: 'line', source: 'ohh-fund', layout: { 'line-cap': 'round' }, paint: { 'line-color': c.fund, 'line-width': 14, 'line-blur': 10, 'line-opacity': 0.3 } });
  add({ id: 'ohh-fund-line', type: 'line', source: 'ohh-fund', layout: { 'line-cap': 'round' }, paint: { 'line-color': c.fundLine, 'line-width': 3 } });
  add({ id: 'ohh-closed-glow', type: 'line', source: 'ohh-closed', layout: { 'line-cap': 'round' }, paint: { 'line-color': c.closed, 'line-width': 14, 'line-blur': 10, 'line-opacity': 0.3 } });
  add({ id: 'ohh-closed-line', type: 'line', source: 'ohh-closed', paint: { 'line-color': c.closedLine, 'line-width': 5, 'line-dasharray': [1.4, 1] } });
  add({ id: 'ohh-deals-glow', type: 'line', source: 'ohh-deals', paint: { 'line-color': c.deal, 'line-width': 8, 'line-blur': 6, 'line-opacity': 0.25 } });
  add({ id: 'ohh-deals-line', type: 'line', source: 'ohh-deals', paint: { 'line-color': c.deal, 'line-width': 2.2, 'line-dasharray': [2, 1.6] } });
  add({
    id: 'ohh-places-halo', type: 'circle', source: 'ohh-places', filter: ['==', ['get', 'state'], 'free'],
    paint: {
      'circle-color': c.free, 'circle-blur': 0.9, 'circle-opacity': 0.4,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 8, 17, ['case', ['boolean', ['feature-state', 'selected'], false], 34, 22]],
    },
  });
  add({
    id: 'ohh-places-dot', type: 'circle', source: 'ohh-places',
    paint: {
      'circle-color': ['match', ['get', 'state'], 'free', c.free, 'taken', c.taken, c.other],
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, ['match', ['get', 'state'], 'free', 3.5, 2.2], 17,
        ['case', ['boolean', ['feature-state', 'selected'], false], 13, ['match', ['get', 'state'], 'free', 8, 5]]],
      'circle-stroke-color': ['case', ['boolean', ['feature-state', 'selected'], false], c.ring, c.outline],
      'circle-stroke-width': ['case', ['boolean', ['feature-state', 'selected'], false], 3, 1],
    },
  });
  add({ id: 'ohh-places-hit', type: 'circle', source: 'ohh-places', paint: { 'circle-radius': 18, 'circle-opacity': 0 } });
  add({
    id: 'ohh-biz-halo', type: 'circle', source: 'ohh-biz', filter: ['!', ['get', 'dim']],
    paint: { 'circle-color': ['get', 'color'], 'circle-blur': 1, 'circle-opacity': 0.35, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 7, 17, ['case', ['get', 'mine'], 34, 20]] },
  });
  add({
    id: 'ohh-biz-dot', type: 'circle', source: 'ohh-biz',
    paint: {
      'circle-color': ['case', ['get', 'dim'], c.dim, ['get', 'color']],
      'circle-opacity': ['case', ['get', 'dim'], 0.6, 1],
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, ['case', ['get', 'mine'], 5, 3], 17, ['case', ['get', 'mine'], 12, 7]],
      'circle-stroke-color': ['case', ['get', 'mine'], c.ring, ['get', 'ai'], c.aiRing, c.outline],
      'circle-stroke-width': ['case', ['get', 'mine'], 3, 1.2],
    },
  });
}

function setData(map: MapLibreMap, id: string, data: unknown) {
  (map.getSource(id) as GeoJSONSource | undefined)?.setData(data as GeoData);
}

function pinElement(m: BizMarker, onOpen?: (id: string) => void): HTMLElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'cm-pin';
  const rank = document.createElement('span'); rank.className = 'cm-pin__rank';
  const name = document.createElement('span'); name.className = 'cm-pin__name';
  const ai = document.createElement('span'); ai.className = 'cm-pin__ai'; ai.textContent = 'AI';
  el.append(rank, name, ai);
  el.addEventListener('click', (ev) => { ev.stopPropagation(); onOpen?.(el.dataset.id ?? m.id); });
  updatePin(el, m);
  return el;
}

function updatePin(el: HTMLElement, m: BizMarker) {
  el.dataset.id = m.id;
  // keep a pin that the declutter pass hid hidden until the next pass: a city update must not flash every label on
  const hidden = el.classList.contains('cm-pin--hidden') && !m.mine;
  el.className = `cm-pin${m.mine ? ' cm-pin--mine' : ''}${m.dim ? ' cm-pin--dim' : ''}${m.isAi ? ' cm-pin--ai' : ''}${!m.dim && m.rank > 0 && m.rank <= 3 ? ' cm-pin--top' : ''}${hidden ? ' cm-pin--hidden' : ''}`;
  el.style.setProperty('--pin', m.color);
  (el.children[0] as HTMLElement).textContent = m.status === 'bankrupt' ? '✕' : m.status === 'closed' ? '⛔' : `#${m.rank}`;
  (el.children[1] as HTMLElement).textContent = m.name;
  (el.children[2] as HTMLElement).hidden = !m.isAi;
  el.setAttribute('aria-label', `${m.name}, ${NICHE_META[m.niche].label}, rank ${m.rank}${m.isAi ? ', AI' : ''}`);
}

/** Hide name pins that would overlap a more important one (own business, then rank). Runs after moves. */
/**
 * Hide name pins that would overlap a more important one (own business, then rank). Runs after moves.
 * Measures the pins where they really are on screen (see declutterRects in geo.ts).
 */
function declutter(_map: MapLibreMap, pins: Map<string, Marker>, markers: BizMarker[]) {
  // read every box first (the hidden class keeps the size), then write classes: no layout thrash
  const els = new Map(markers.map((m) => [m.id, pins.get(m.id)?.getElement()]));
  const boxes = new Map<string, DOMRect>();
  els.forEach((el, id) => { if (el) boxes.set(id, el.getBoundingClientRect()); });
  const hide = declutterRects(markers, (m) => {
    const b = boxes.get(m.id);
    return b ? { x: b.left, y: b.top, w: b.width, h: b.height } : null;
  });
  els.forEach((el, id) => el?.classList.toggle('cm-pin--hidden', hide.has(id)));
}

export function CityMap(props: CityMapProps) {
  const {
    places, businesses, myBusinessId, weather, events, day, mode, niche, onPick, onOpenBusiness, businessCta, onExpand, embedded = false, initialBusinessId, initialPlaceId, onStartHere,
    blockFunds, packs, realBusinesses, offline: forceOffline = false, intro = true, orbit = false, className, style,
  } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const pinsRef = useRef(new Map<string, Marker>());
  const closedPinsRef = useRef<Marker[]>([]);
  const markersRef = useRef<BizMarker[]>([]);
  const [showFree, setShowFree] = useState(!!initialPlaceId);
  // places are tappable in pick mode, and in live mode while the free-storefronts switch is on
  const placesOn = mode === 'pick' || showFree;
  const handlersRef = useRef({ onPick, onOpenBusiness, mode, placesOn });
  handlersRef.current = { onPick, onOpenBusiness, mode, placesOn };
  const openBusiness = (id: string) => { setSelected(null); setOpenBiz(id); handlersRef.current.onOpenBusiness?.(id); };
  const openBusinessRef = useRef(openBusiness);
  openBusinessRef.current = openBusiness;
  const [styleEpoch, setStyleEpoch] = useState(0);
  const theme = useTheme();
  const tr = useT();
  const themeRef = useRef<MapTheme>(theme);
  const shownThemeRef = useRef<MapTheme>(theme);
  themeRef.current = theme;
  const [offline, setOffline] = useState(forceOffline || (typeof navigator !== 'undefined' && navigator.onLine === false));
  const [selected, setSelected] = useState<string | null>(initialPlaceId ?? null);
  const [openBiz, setOpenBiz] = useState<string | null>(initialBusinessId ?? null);
  const [zoomedOut, setZoomedOut] = useState(true);
  const [near, setNear] = useState(false);
  // a short frame (a step of a longer page) gets the one-line place card; the page around it shows the details
  const [short, setShort] = useState(false);

  const segments = useMemo(() => blockSegments(places), [places]);
  const realFC = useMemo(() => realFeatures(realBusinesses), [realBusinesses]);
  // live mode looks at storefronts as a café owner would (the product line); pick mode uses the niche being opened
  const placeNiche: NicheId | undefined = mode === 'pick' ? niche : niche ?? 'cafe';
  const placeFC = useMemo(() => placeFeatures(places, businesses, placeNiche), [places, businesses, placeNiche]);
  const freeCount = useMemo(() => placeFC.features.filter((f) => f.properties.state === 'free').length, [placeFC]);
  const markers = useMemo(() => businessMarkers(businesses, places, myBusinessId), [businesses, places, myBusinessId]);
  const bizFC = useMemo(() => businessFeatures(markers), [markers]);
  const dealsFC = useMemo(() => partnerLines(businesses, places), [businesses, places]);
  const fundFC = useMemo(() => blockLines(activeFundBlocks(blockFunds), segments), [blockFunds, segments]);
  const closed = useMemo(() => closedBlocks(events, day), [events, day]);
  const closedFC = useMemo(() => blockLines(closed, segments), [closed, segments]);
  const wx = todayWeather(weather, day);
  const live = useMemo(() => liveEvents(events, day), [events, day]);
  const selectedPlace = selected ? places.find((p) => p.id === selected) ?? null : null;
  const openBizItem = openBiz ? businesses.find((x) => x.id === openBiz) ?? null : null;

  // create the map once
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const center = centerOf(places.length ? places : [{ lat: 40.7265, lng: -73.9845 }]);
    const budget = mapBudget(isSmallScreen(), window.devicePixelRatio);
    const calm = reducedMotion() || !intro || !budget.intro;
    const finalZoom = isSmallScreen() ? 15.1 : 15.55;
    const startOffline = forceOffline || (typeof navigator !== 'undefined' && navigator.onLine === false);
    const map = new MapLibreMap({
      container: el,
      style: (startOffline ? offlineAssets(getTheme()) : cityStyle(getTheme())) as StyleSpecification,
      center,
      zoom: calm ? finalZoom : 13.7,
      pitch: calm ? budget.pitch : 0,
      bearing: calm ? FINAL_VIEW.bearing : -35,
      maxPitch: 65, minZoom: 12.8, maxZoom: 19,
      maxBounds: MAX_BOUNDS,
      attributionControl: { compact: true },
      cooperativeGestures: embedded,
      pixelRatio: budget.pixelRatio,
      refreshExpiredTiles: false,
      fadeDuration: 0,
      canvasContextAttributes: { antialias: budget.antialias },
    });
    mapRef.current = map;
    let isOffline = startOffline;
    const goOffline = () => {
      if (isOffline) return;
      isOffline = true;
      setOffline(true);
      map.setStyle(offlineAssets(themeRef.current) as StyleSpecification, { diff: false });
    };
    map.on('error', (e) => { if (!isOffline && isTileFailure(e as never)) goOffline(); });
    const timer = window.setTimeout(() => {
      if (isOffline) return;
      let ok = false;
      try { ok = map.isSourceLoaded('openmaptiles'); } catch { ok = false; }
      if (!ok) goOffline();
    }, TILE_TIMEOUT_MS);
    map.on('style.load', () => { installOverlays(map, map.getStyle().name === OFFLINE_STYLE_NAME ? 'dark' : themeRef.current); setStyleEpoch((n) => n + 1); });

    // interaction: pick a place, open a business
    map.on('click', 'ohh-places-hit', (e: MapLayerMouseEvent) => {
      if (!handlersRef.current.placesOn) return;
      const id = e.features?.[0]?.properties?.id;
      if (typeof id === 'string') { setOpenBiz(null); setSelected(id); }
    });
    map.on('click', 'ohh-biz-dot', (e: MapLayerMouseEvent) => {
      if (handlersRef.current.mode !== 'live') return;
      const id = e.features?.[0]?.properties?.id;
      if (typeof id === 'string') openBusinessRef.current(id);
    });
    for (const layer of ['ohh-places-hit', 'ohh-biz-dot']) {
      map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
    }
    const onZoom = () => { setZoomedOut(map.getZoom() < 14.6); setNear(map.getZoom() >= 16.3); };
    map.on('zoomend', onZoom);
    onZoom();
    // name pins must not pile up (docs/qa/BUGS.md #5): sort them out after every move, and also once the frame has its
    // real size and the first tiles are drawn — an embedded map starts at 0×0 and fires no move of its own
    const tidy = () => declutter(map, pinsRef.current, markersRef.current);
    map.on('moveend', tidy);
    map.on('resize', tidy);
    map.once('idle', tidy);

    // fly-over on open, then optional orbit
    let orbitRaf = 0, idleUntil = 0, lastT = 0;
    const startOrbit = () => {
      if (!orbit || reducedMotion()) return;
      const step = (t: number) => {
        if (lastT && t > idleUntil && !map.isMoving()) map.setBearing(map.getBearing() + ((t - lastT) / 1000) * 2.2);
        lastT = t;
        orbitRaf = requestAnimationFrame(step);
      };
      orbitRaf = requestAnimationFrame(step);
    };
    const pauseOrbit = () => { idleUntil = performance.now() + 20_000; };
    for (const ev of ['mousedown', 'touchstart', 'wheel'] as const) map.on(ev, pauseOrbit);
    map.once('load', () => {
      if (calm) { startOrbit(); return; }
      map.flyTo({ center, zoom: finalZoom, pitch: budget.pitch, bearing: FINAL_VIEW.bearing, duration: 4200, curve: 1.15, essential: false });
      map.once('moveend', startOrbit);
    });

    const ro = new ResizeObserver(() => { map.resize(); setShort(el.clientHeight > 0 && el.clientHeight < 420); });
    ro.observe(el);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(orbitRaf);
      ro.disconnect();
      pinsRef.current.forEach((m) => m.remove());
      pinsRef.current.clear();
      closedPinsRef.current.forEach((m) => m.remove());
      map.remove();
      mapRef.current = null;
    };
    // the map is created once; later prop changes flow through the effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // honour a forced offline switch after mount
  useEffect(() => {
    const map = mapRef.current;
    if (map && forceOffline && !offline) { setOffline(true); map.setStyle(offlineAssets(themeRef.current) as StyleSpecification, { diff: false }); }
  }, [forceOffline, offline]);

  // the theme changed: redraw the map in the day or the night style
  useEffect(() => {
    const map = mapRef.current;
    if (!map || shownThemeRef.current === theme) return;
    shownThemeRef.current = theme;
    map.setStyle((offline ? offlineAssets(theme) : cityStyle(theme)) as StyleSpecification, { diff: false });
  }, [theme, offline]);

  // data → sources
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleEpoch) return;
    setData(map, 'ohh-real', realFC);
    setData(map, 'ohh-places', placeFC);
    setData(map, 'ohh-biz', bizFC);
    setData(map, 'ohh-deals', mode === 'live' ? dealsFC : EMPTY);
    setData(map, 'ohh-fund', fundFC);
    setData(map, 'ohh-closed', closedFC);
    for (const id of LAYERS_PICK) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', placesOn ? 'visible' : 'none');
    // live mode: taken places already carry a business pin; show only the free ones
    for (const id of ['ohh-places-dot', 'ohh-places-hit']) if (map.getLayer(id)) map.setFilter(id, mode === 'live' ? ['!=', ['get', 'state'], 'taken'] : null);
    if (map.getLayer('ohh-biz-halo')) map.setLayoutProperty('ohh-biz-halo', 'visibility', mode === 'live' ? 'visible' : 'none');
  }, [styleEpoch, realFC, placeFC, bizFC, dealsFC, fundFC, closedFC, mode, placesOn]);

  // selection highlight
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleEpoch) return;
    map.removeFeatureState({ source: 'ohh-places' });
    const idx = selected ? places.findIndex((p) => p.id === selected) : -1;
    if (idx >= 0) map.setFeatureState({ source: 'ohh-places', id: idx }, { selected: true });
  }, [selected, places, styleEpoch]);

  useEffect(() => { if (!placesOn) setSelected(null); }, [placesOn]);

  // HTML name pins for live mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const pins = pinsRef.current;
    const wanted = mode === 'live' ? markers : [];
    markersRef.current = wanted;
    const keep = new Set(wanted.map((m) => m.id));
    for (const [id, marker] of pins) if (!keep.has(id)) { marker.remove(); pins.delete(id); }
    for (const m of wanted) {
      const existing = pins.get(m.id);
      if (existing) { existing.setLngLat([m.lng, m.lat]); updatePin(existing.getElement(), m); continue; }
      const marker = new Marker({ element: pinElement(m, (id) => openBusinessRef.current(id)), anchor: 'bottom', offset: [0, -10] })
        .setLngLat([m.lng, m.lat]).addTo(map);
      pins.set(m.id, marker);
    }
    const raf = requestAnimationFrame(() => declutter(map, pins, wanted));
    return () => cancelAnimationFrame(raf);
  }, [markers, mode]);

  // zooming in or out switches which pins the CSS shows (cm-root--near / --far), and web fonts change their width:
  // sort the labels out again after either
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const tidy = () => declutter(map, pinsRef.current, markersRef.current);
    const raf = requestAnimationFrame(tidy);
    let alive = true;
    document.fonts?.ready.then(() => { if (alive) tidy(); }).catch(() => {});
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, [near, zoomedOut]);

  // the opened business keeps a ring and its name, so it is clear which pin the card is about
  useEffect(() => {
    pinsRef.current.forEach((marker, id) => {
      const el = marker.getElement();
      if (id === openBiz) el.dataset.sel = '1'; else delete el.dataset.sel;
    });
  }, [openBiz, markers, mode]);

  // "Road closed" tags in the middle of closed streets
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    closedPinsRef.current.forEach((m) => m.remove());
    closedPinsRef.current = closed.flatMap((block) => {
      const seg = segments.get(block);
      if (!seg) return [];
      const el = document.createElement('div');
      el.className = 'cm-closed';
      el.textContent = 'Road closed';
      const mid: LngLat = [(seg[0][0] + seg[1][0]) / 2, (seg[0][1] + seg[1][1]) / 2];
      return [new Marker({ element: el, anchor: 'center' }).setLngLat(mid).addTo(map)];
    });
  }, [closed, segments]);

  const freeLegend = [{ color: mapPalette(theme).free, label: placeNiche ? `Free for a ${NICHE_META[placeNiche].label.toLowerCase()}` : 'Free' }, { color: mapPalette(theme).other, label: 'Other niche' }];
  const legend = mode === 'pick'
    ? [...freeLegend, { color: mapPalette(theme).taken, label: 'Taken' }]
    : [...[...new Set(markers.map((m) => m.niche))].map((n) => ({ color: NICHE_META[n].color, label: NICHE_META[n].label })), ...(showFree ? freeLegend : [])];
  const canBrowseFree = mode === 'live' && !embedded && !orbit;
  const startHere = (id: string) => {
    const n = placeNiche ?? 'cafe';
    if (onStartHere) onStartHere(id, n);
    else window.location.assign(`/start?niche=${encodeURIComponent(n)}&place=${encodeURIComponent(id)}`);
  };

  return (
    <div className={`cm-root${zoomedOut ? ' cm-root--far' : ''}${near ? ' cm-root--near' : ''}${offline ? ' cm-root--offline' : ''}${className ? ` ${className}` : ''}`} style={style}>
      <div ref={containerRef} className="cm-map" />
      <div className="cm-vignette" aria-hidden="true" />
      <WeatherLayer condition={wx?.condition} />
      <div className="cm-top">
        {wx && (
          <div className="cm-chip cm-chip--weather" title={wx.label}>
            <span aria-hidden="true">{WEATHER_ICON[wx.condition]}</span> {Math.round(wx.tempF)}°F · {wx.label}
            {wx.footTrafficMult !== 1 && <span className={wx.footTrafficMult < 1 ? 'cm-down' : 'cm-up'}> {wx.footTrafficMult < 1 ? '▼' : '▲'} foot traffic {Math.round(Math.abs(wx.footTrafficMult - 1) * 100)}%</span>}
          </div>
        )}
        {live.slice(0, 3).map((e) => {
          const now = day === undefined || (e.startDay <= day && day <= e.endDay);
          return (
            <div key={e.id} className={`cm-chip cm-chip--event cm-chip--${e.kind}${now ? ' cm-chip--now' : ''}`} title={e.text}>
              <strong>{e.title}</strong>
              <span>{now ? `until ${dateOf(e.endDay).label}` : `from ${dateOf(e.startDay).label}`}{e.block ? ` · ${e.block}` : ''}</span>
            </div>
          );
        })}
        {offline && <div className="cm-chip cm-chip--offline" title="Map tiles did not load: a schematic map drawn from the street grid">Offline map</div>}
      </div>
      {legend.length > 0 && (
        <ul className="cm-legend" aria-label="Legend">
          {legend.map((l) => <li key={l.label}><i style={{ background: l.color }} />{l.label}</li>)}
          {mode === 'live' && !embedded && <li className="cm-legend__hint">#1–3 lead their niche · zoom in to see everyone</li>}
          {canBrowseFree && (
            <li>
              <button type="button" className="cm-legend__toggle" aria-pressed={showFree} onClick={() => setShowFree((v) => !v)}>
                {showFree ? tr('Hide free storefronts', 'Скрыть свободные помещения') : tr(`Free storefronts · ${freeCount}`, `Свободные помещения · ${freeCount}`)}
              </button>
            </li>
          )}
        </ul>
      )}
      <div className="cm-ctl" role="group" aria-label="Map controls">
        {onExpand && (
          <button type="button" className="cm-ctl__btn" onClick={onExpand} aria-label="Open the full map" title="Open the full map">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
          </button>
        )}
        <button type="button" className="cm-ctl__btn" onClick={() => mapRef.current?.zoomIn({ duration: 320 })} aria-label="Zoom in" title="Zoom in">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        </button>
        <button type="button" className="cm-ctl__btn" onClick={() => mapRef.current?.zoomOut({ duration: 320 })} aria-label="Zoom out" title="Zoom out">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
        </button>
      </div>
      {mode === 'live' && !embedded && openBizItem && (
        <BusinessCard
          business={openBizItem} place={places.find((p) => p.id === openBizItem.placeId)} mine={openBizItem.id === myBusinessId}
          cta={businessCta} onClose={() => setOpenBiz(null)}
          me={myBusinessId ? businesses.find((x) => x.id === myBusinessId) : undefined} places={places}
        />
      )}
      {placesOn && selectedPlace && (
        <PlaceCard
          place={selectedPlace} places={places} businesses={businesses} niche={placeNiche} packs={packs}
          onOpen={mode === 'pick' ? onPick : myBusinessId ? undefined : startHere} onClose={() => setSelected(null)}
          compact={short} myBusinessId={myBusinessId}
          actionLabel={mode === 'live' ? (myBusinessId ? tr('You already run a business', 'У тебя уже есть бизнес') : tr('Open my business here', 'Открыть здесь свой бизнес')) : undefined}
        />
      )}
    </div>
  );
}

export default CityMap;
