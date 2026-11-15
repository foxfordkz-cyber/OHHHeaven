// The map library (maplibre, ~800 KB) loads as its own chunk after the first screen: on a phone the idea field
// does not wait for the map (docs/qa/BUGS.md #11). Everything that imports CityMap from 'client/src/map' gets this.
import { lazy, Suspense } from 'react';
import type { CityMapProps } from './CityMap';

const Real = lazy(() => import('./CityMap'));
// map.css comes with the chunk, so the placeholder carries its own size and colour
const FALLBACK = { position: 'relative', width: '100%', height: '100%', minHeight: 120, background: 'var(--map-bg, #151513)' } as const;

export function CityMap(props: CityMapProps) {
  return (
    <Suspense fallback={<div className={`cm-root cm-root--loading${props.className ? ` ${props.className}` : ''}`} style={{ ...FALLBACK, ...props.style }} aria-busy="true" aria-label="Loading the map" />}>
      <Real {...props} />
    </Suspense>
  );
}

export type { CityMapProps };
