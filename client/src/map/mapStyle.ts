// Map styles: a night style (dark theme) and a day style (light theme) on OpenFreeMap vector tiles, and an offline style built
// from the saved schematic snapshot (data/offline-map.png) plus local 3D footprints.
import type { Map as MapLibreMap } from 'maplibre-gl';

// maplibre-gl does not re-export the style-spec types; derive them from setStyle().
export type StyleSpecification = Exclude<Parameters<MapLibreMap['setStyle']>[0], string | null | undefined>;
type LightSpecification = NonNullable<StyleSpecification['light']>;
type SkySpecification = NonNullable<StyleSpecification['sky']>;

export const OPENFREEMAP_TILEJSON = 'https://tiles.openfreemap.org/planet';
export const OPENFREEMAP_GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
export const OPENFREEMAP_HOST = 'tiles.openfreemap.org';
export const ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

export type MapTheme = 'light' | 'dark';

/** Every color the map draws with. Night goes with the dark theme ("asphalt"), day with the light one ("paper"). */
export interface MapPalette {
  bg: string; landcover: string; park: string; water: string; waterway: string;
  path: string; minor: string; major: string; rail: string;
  buildings: [string, string, string, string];
  label: string; halo: string;
  /** overlays drawn by CityMap */
  poi: string; outline: string; ring: string; free: string; taken: string; other: string; dim: string; aiRing: string;
  deal: string; fund: string; fundLine: string; closed: string; closedLine: string;
  light: LightSpecification; sky: SkySpecification;
  /** the saved offline picture is a night picture: these raster settings turn it into the theme's look */
  raster: Record<string, number>;
}

const NIGHT: MapPalette = {
  bg: '#151513', landcover: '#181915', park: '#1a2318', water: '#101a20', waterway: '#16242c',
  path: '#24231f', minor: '#2a2925', major: '#3a3832', rail: '#2e2d28',
  buildings: ['#1f1f1c', '#2a2925', '#36342e', '#45423a'],
  label: '#8f8b7c', halo: '#151513',
  poi: '#77736a', outline: '#151513', ring: '#ffffff', free: '#62bf8c', taken: '#ea6c59', other: '#45433c', dim: '#55524a', aiRing: '#8f8b7c',
  deal: '#f6c62e', fund: '#62bf8c', fundLine: '#a9dcc0', closed: '#ea6c59', closedLine: '#f08a79',
  light: { anchor: 'viewport', color: '#fff3d6', intensity: 0.36, position: [1.25, 205, 32] },
  sky: { 'sky-color': '#0d0d0c', 'horizon-color': '#2a2822', 'fog-color': '#151513', 'sky-horizon-blend': 0.7, 'horizon-fog-blend': 0.55, 'fog-ground-blend': 0.8, 'atmosphere-blend': 0 },
  raster: { 'raster-saturation': -0.9, 'raster-contrast': -0.05 },
};

const DAY: MapPalette = {
  bg: '#ece8dd', landcover: '#e6e3d5', park: '#cfdcc0', water: '#b7cfdb', waterway: '#a8c3d1',
  path: '#dcd7c8', minor: '#fbfaf5', major: '#ffffff', rail: '#cdc7b8',
  buildings: ['#e0dacb', '#d6cfbe', '#c9c1ad', '#bab09a'],
  label: '#787364', halo: '#f3f1ea',
  poi: '#9a9484', outline: '#fcfbf7', ring: '#1a1913', free: '#1d7a4c', taken: '#b8392a', other: '#b9b3a2', dim: '#a8a292', aiRing: '#767265',
  deal: '#a87900', fund: '#1d7a4c', fundLine: '#1d7a4c', closed: '#b8392a', closedLine: '#b8392a',
  light: { anchor: 'viewport', color: '#ffffff', intensity: 0.42, position: [1.25, 205, 32] },
  sky: { 'sky-color': '#dfe8ec', 'horizon-color': '#f1eee6', 'fog-color': '#ece8dd', 'sky-horizon-blend': 0.7, 'horizon-fog-blend': 0.55, 'fog-ground-blend': 0.8, 'atmosphere-blend': 0 },
  raster: { 'raster-saturation': -0.9, 'raster-brightness-min': 1, 'raster-brightness-max': 0.12, 'raster-contrast': -0.1 },
};

export const mapPalette = (theme: MapTheme = 'dark'): MapPalette => (theme === 'light' ? DAY : NIGHT);

const roadWidth = (base: number) => ['interpolate', ['exponential', 1.6], ['zoom'], 12, base * 0.4, 15, base, 18, base * 4] as unknown as number;

/** The online style for a theme. */
export function cityStyle(theme: MapTheme = 'dark'): StyleSpecification {
  const src = 'openmaptiles';
  const c = mapPalette(theme);
  return {
    version: 8,
    name: theme === 'light' ? 'First Year — Day' : 'First Year — Night',
    glyphs: OPENFREEMAP_GLYPHS,
    light: c.light,
    sky: c.sky,
    sources: { [src]: { type: 'vector', url: OPENFREEMAP_TILEJSON, attribution: ATTRIBUTION } },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': c.bg } },
      { id: 'landcover', type: 'fill', source: src, 'source-layer': 'landcover', paint: { 'fill-color': c.landcover, 'fill-opacity': 0.55 } },
      { id: 'park', type: 'fill', source: src, 'source-layer': 'park', paint: { 'fill-color': c.park, 'fill-opacity': 0.9 } },
      { id: 'water', type: 'fill', source: src, 'source-layer': 'water', paint: { 'fill-color': c.water } },
      { id: 'waterway', type: 'line', source: src, 'source-layer': 'waterway', paint: { 'line-color': c.waterway, 'line-width': 1.2 } },
      {
        id: 'road-path', type: 'line', source: src, 'source-layer': 'transportation',
        filter: ['in', ['get', 'class'], ['literal', ['path', 'pedestrian', 'footway', 'track']]],
        paint: { 'line-color': c.path, 'line-width': roadWidth(0.8), 'line-dasharray': [2, 1.5] },
      },
      {
        id: 'road-minor', type: 'line', source: src, 'source-layer': 'transportation',
        filter: ['in', ['get', 'class'], ['literal', ['minor', 'service']]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': c.minor, 'line-width': roadWidth(2.4) },
      },
      {
        id: 'road-major', type: 'line', source: src, 'source-layer': 'transportation',
        filter: ['in', ['get', 'class'], ['literal', ['tertiary', 'secondary', 'primary', 'trunk', 'motorway']]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': c.major, 'line-width': roadWidth(3.6) },
      },
      {
        id: 'rail', type: 'line', source: src, 'source-layer': 'transportation',
        filter: ['in', ['get', 'class'], ['literal', ['rail', 'transit']]],
        paint: { 'line-color': c.rail, 'line-width': 1, 'line-dasharray': [3, 2] },
      },
      {
        id: 'buildings-3d', type: 'fill-extrusion', source: src, 'source-layer': 'building', minzoom: 13,
        paint: {
          'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 10], 0, c.buildings[0], 30, c.buildings[1], 90, c.buildings[2], 200, c.buildings[3]],
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 13, 0, 14.2, ['coalesce', ['get', 'render_height'], 10]],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.94,
          'fill-extrusion-vertical-gradient': true,
        },
      },
      {
        id: 'street-names', type: 'symbol', source: src, 'source-layer': 'transportation_name', minzoom: 15,
        layout: { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-letter-spacing': 0.06 },
        paint: { 'text-color': c.label, 'text-halo-color': c.halo, 'text-halo-width': 1.4 },
      },
    ],
  };
}

/** The dark-theme online style (kept under its old name). */
export const nightStyle = (): StyleSpecification => cityStyle('dark');

export interface OfflineAssets {
  imageUrl: string;
  coordinates: [[number, number], [number, number], [number, number], [number, number]];
  buildingsUrl: string;
}

/** Offline style: no network at all (no glyphs, no tiles). Labels live in the PNG and in HTML markers. */
export function offlineStyle(a: OfflineAssets, theme: MapTheme = 'dark'): StyleSpecification {
  const c = mapPalette(theme);
  return {
    version: 8,
    name: 'First Year — Offline',
    light: c.light,
    sky: c.sky,
    sources: {
      'offline-image': { type: 'image', url: a.imageUrl, coordinates: a.coordinates },
      'offline-shapes': { type: 'geojson', data: a.buildingsUrl, attribution: 'Schematic offline map from the street grid · street names © OpenStreetMap contributors' },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': c.bg } },
      { id: 'offline-image', type: 'raster', source: 'offline-image', paint: { 'raster-fade-duration': 0, 'raster-opacity': 1, ...c.raster } },
      {
        id: 'offline-buildings', type: 'fill-extrusion', source: 'offline-shapes', filter: ['==', ['get', 'kind'], 'building'],
        paint: {
          'fill-extrusion-color': ['case', ['get', 'inside'], ['interpolate', ['linear'], ['get', 'height'], 10, c.buildings[1], 40, c.buildings[2], 70, c.buildings[3]], c.buildings[0]],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.92,
          'fill-extrusion-vertical-gradient': true,
        },
      },
    ],
  };
}

/** Does this map error mean the online tiles are unreachable? */
export function isTileFailure(err: { sourceId?: string; error?: { message?: string; url?: string; status?: number } } | undefined): boolean {
  if (!err) return false;
  if (err.sourceId === 'openmaptiles') return true;
  const text = `${err.error?.message ?? ''} ${err.error?.url ?? ''}`;
  return text.includes(OPENFREEMAP_HOST) || /Failed to fetch|NetworkError|Load failed/i.test(text);
}
