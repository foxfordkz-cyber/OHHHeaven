// Map styles: a dark "night city" style on OpenFreeMap vector tiles, and an offline style built
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

const LIGHT: LightSpecification = { anchor: 'viewport', color: '#c9d2ff', intensity: 0.38, position: [1.25, 205, 32] };
const SKY: SkySpecification = {
  'sky-color': '#070b18', 'horizon-color': '#1c2a58', 'fog-color': '#0a0f1f',
  'sky-horizon-blend': 0.7, 'horizon-fog-blend': 0.55, 'fog-ground-blend': 0.8, 'atmosphere-blend': 0,
};

const BG = '#0a0f1f';
const roadWidth = (base: number) => ['interpolate', ['exponential', 1.6], ['zoom'], 12, base * 0.4, 15, base, 18, base * 4] as unknown as number;

export function nightStyle(): StyleSpecification {
  const src = 'openmaptiles';
  return {
    version: 8,
    name: 'First Year — Night',
    glyphs: OPENFREEMAP_GLYPHS,
    light: LIGHT,
    sky: SKY,
    sources: { [src]: { type: 'vector', url: OPENFREEMAP_TILEJSON, attribution: ATTRIBUTION } },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': BG } },
      { id: 'landcover', type: 'fill', source: src, 'source-layer': 'landcover', paint: { 'fill-color': '#0d1c20', 'fill-opacity': 0.55 } },
      { id: 'park', type: 'fill', source: src, 'source-layer': 'park', paint: { 'fill-color': '#0d2620', 'fill-opacity': 0.9 } },
      { id: 'water', type: 'fill', source: src, 'source-layer': 'water', paint: { 'fill-color': '#06162a' } },
      { id: 'waterway', type: 'line', source: src, 'source-layer': 'waterway', paint: { 'line-color': '#082039', 'line-width': 1.2 } },
      {
        id: 'road-path', type: 'line', source: src, 'source-layer': 'transportation',
        filter: ['in', ['get', 'class'], ['literal', ['path', 'pedestrian', 'footway', 'track']]],
        paint: { 'line-color': '#1a2140', 'line-width': roadWidth(0.8), 'line-dasharray': [2, 1.5] },
      },
      {
        id: 'road-minor', type: 'line', source: src, 'source-layer': 'transportation',
        filter: ['in', ['get', 'class'], ['literal', ['minor', 'service']]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#212a50', 'line-width': roadWidth(2.4) },
      },
      {
        id: 'road-major', type: 'line', source: src, 'source-layer': 'transportation',
        filter: ['in', ['get', 'class'], ['literal', ['tertiary', 'secondary', 'primary', 'trunk', 'motorway']]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#2c3a6e', 'line-width': roadWidth(3.6) },
      },
      {
        id: 'rail', type: 'line', source: src, 'source-layer': 'transportation',
        filter: ['in', ['get', 'class'], ['literal', ['rail', 'transit']]],
        paint: { 'line-color': '#283050', 'line-width': 1, 'line-dasharray': [3, 2] },
      },
      {
        id: 'buildings-3d', type: 'fill-extrusion', source: src, 'source-layer': 'building', minzoom: 13,
        paint: {
          'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 10], 0, '#141b33', 30, '#1b2546', 90, '#26335f', 200, '#31407a'],
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 13, 0, 14.2, ['coalesce', ['get', 'render_height'], 10]],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.94,
          'fill-extrusion-vertical-gradient': true,
        },
      },
      {
        id: 'street-names', type: 'symbol', source: src, 'source-layer': 'transportation_name', minzoom: 15,
        layout: { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-letter-spacing': 0.06 },
        paint: { 'text-color': '#7f8bb8', 'text-halo-color': BG, 'text-halo-width': 1.4 },
      },
    ],
  };
}

export interface OfflineAssets {
  imageUrl: string;
  coordinates: [[number, number], [number, number], [number, number], [number, number]];
  buildingsUrl: string;
}

/** Offline style: no network at all (no glyphs, no tiles). Labels live in the PNG and in HTML markers. */
export function offlineStyle(a: OfflineAssets): StyleSpecification {
  return {
    version: 8,
    name: 'First Year — Offline',
    light: LIGHT,
    sky: SKY,
    sources: {
      'offline-image': { type: 'image', url: a.imageUrl, coordinates: a.coordinates },
      'offline-shapes': { type: 'geojson', data: a.buildingsUrl, attribution: 'Schematic offline map from the street grid · street names © OpenStreetMap contributors' },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': BG } },
      { id: 'offline-image', type: 'raster', source: 'offline-image', paint: { 'raster-fade-duration': 0, 'raster-opacity': 1 } },
      {
        id: 'offline-buildings', type: 'fill-extrusion', source: 'offline-shapes', filter: ['==', ['get', 'kind'], 'building'],
        paint: {
          'fill-extrusion-color': ['case', ['get', 'inside'], ['interpolate', ['linear'], ['get', 'height'], 10, '#18203d', 40, '#202b52', 70, '#2a3868'], '#141a31'],
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
