import { describe, expect, it } from 'vitest';
import { isTileFailure, nightStyle, offlineStyle } from './mapStyle';

describe('map styles', () => {
  it('night style uses OpenFreeMap vector tiles with 3D buildings and no API key', () => {
    const s = nightStyle();
    const src = s.sources.openmaptiles as { url: string };
    expect(src.url).toBe('https://tiles.openfreemap.org/planet');
    expect(JSON.stringify(s)).not.toMatch(/key=|access_token/i);
    const b = s.layers.find((l) => l.id === 'buildings-3d');
    expect(b?.type).toBe('fill-extrusion');
  });
  it('offline style needs no network: no glyphs, no tile URLs', () => {
    const s = offlineStyle({ imageUrl: '/offline.png', coordinates: [[0, 1], [1, 1], [1, 0], [0, 0]], buildingsUrl: '/b.json' });
    expect(s.glyphs).toBeUndefined();
    expect(JSON.stringify(s)).not.toContain('openfreemap');
    expect(s.layers.some((l) => l.type === 'symbol')).toBe(false);
  });
  it('recognises tile failures', () => {
    expect(isTileFailure({ sourceId: 'openmaptiles' })).toBe(true);
    expect(isTileFailure({ error: { message: 'Failed to fetch' } })).toBe(true);
    expect(isTileFailure({ error: { message: 'x', url: 'https://tiles.openfreemap.org/planet' } })).toBe(true);
    expect(isTileFailure({ sourceId: 'ohh-places', error: { message: 'bad data' } })).toBe(false);
    expect(isTileFailure(undefined)).toBe(false);
  });
});
