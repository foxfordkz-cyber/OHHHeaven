import cafe from '../../server/fixtures/cafe.json';
import barbershop from '../../server/fixtures/barbershop.json';
import common from '../../server/fixtures/_common.json';
import places from '../../server/fixtures/places.json';
import type { CommonPack, Pack, Place, WorldState } from '@ohh/shared';
import { defaultConfig, defaultDeps, newWorld, step, type EngineCtx, type HostDeps } from '../src/index';

export const ctx: EngineCtx = {
  packs: { common: common as unknown as CommonPack, niches: { cafe: cafe as unknown as Pack, barbershop: barbershop as unknown as Pack } },
  places: places as unknown as Place[],
};

export function makeWorld(over: { seed?: number; aiBusinessesTarget?: number; deps?: HostDeps } = {}): WorldState {
  const config = { ...defaultConfig({ id: 'test', name: 'Test City', demo: true, seed: over.seed ?? 1 }), aiBusinessesTarget: over.aiBusinessesTarget ?? 27 };
  return newWorld(config, ctx, over.deps ?? defaultDeps());
}

export function run(w: WorldState, days: number, deps: HostDeps = defaultDeps()): WorldState {
  let x = w;
  for (let i = 0; i < days; i++) x = step(x, ctx, deps);
  return x;
}

/** Все пути к ключу `key` внутри объекта. */
export function pathsOf(obj: unknown, key: string, base = ''): string[] {
  if (Array.isArray(obj)) return obj.flatMap((v, i) => pathsOf(v, key, `${base}[${i}]`));
  if (obj && typeof obj === 'object') {
    return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => [
      ...(k === key ? [base ? `${base}.${k}` : k] : []),
      ...pathsOf(v, key, base ? `${base}.${k}` : k),
    ]);
  }
  return [];
}

export function freePlace(w: WorldState, niche: 'cafe' | 'barbershop' = 'cafe'): string {
  const p = ctx.places.find((pl) => pl.suitableFor.includes(niche) && !w.businesses.some((b) => b.placeId === pl.id));
  if (!p) throw new Error('no free place');
  return p.id;
}
