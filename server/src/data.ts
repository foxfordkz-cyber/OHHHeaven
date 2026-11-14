// Данные при старте: packs/*.json и data/places.json из корня репозитория; нет файла — примеры из server/fixtures/.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CommonPack, NicheId, Pack, PackSet, Place } from '@ohh/shared';
import type { EngineCtx } from '@ohh/host';

const here = dirname(fileURLToPath(import.meta.url));
export const SERVER_DIR = resolve(here, '..');
export const REPO_ROOT = resolve(SERVER_DIR, '..');
export const FIXTURES_DIR = join(SERVER_DIR, 'fixtures');

const NICHES: NicheId[] = ['cafe', 'barbershop', 'bodega', 'guesthouse', 'rentals'];

export interface GameData {
  /** Все пакеты, включая ниши-карточки: их видит клиент через GET /api/packs. */
  packs: PackSet;
  places: Place[];
  /** Контекст мира: только играбельные ниши. */
  ctx: EngineCtx;
  sources: Record<string, string>;
}

function readJson<T>(file: string, log: (m: string) => void): T | null {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T;
  } catch (e) {
    log(`data: cannot parse ${file}: ${(e as Error).message}`);
    return null;
  }
}

function looksLikePack(x: unknown, id: string): boolean {
  const p = x as Partial<Pack> | null;
  return !!p && p.id === id && Array.isArray(p.setup) && Array.isArray(p.kits) && !!p.unit && !!p.market && !!p.sizing;
}

export function loadData(opts: { root?: string; playable?: NicheId[]; log?: (m: string) => void } = {}): GameData {
  const root = opts.root ?? REPO_ROOT;
  const log = opts.log ?? (() => {});
  const sources: Record<string, string> = {};
  const pick = <T>(name: string, real: string, fixture: string, ok: (x: unknown) => boolean): T | null => {
    const r = readJson<T>(real, log);
    if (r && ok(r)) { sources[name] = real; return r; }
    if (r) log(`data: ${real} has the wrong shape, using the fixture`);
    const f = readJson<T>(fixture, log);
    if (f && ok(f)) { sources[name] = fixture; return f; }
    return null;
  };
  const common = pick<CommonPack>('_common', join(root, 'packs/_common.json'), join(FIXTURES_DIR, '_common.json'), (x) => (x as CommonPack)?.id === '_common');
  if (!common) throw new Error('No packs/_common.json and no fixture');
  const niches: Partial<Record<NicheId, Pack>> = {};
  for (const id of NICHES) {
    const p = pick<Pack>(id, join(root, `packs/${id}.json`), join(FIXTURES_DIR, `${id}.json`), (x) => looksLikePack(x, id));
    if (p) niches[id] = p;
  }
  const places = pick<Place[]>('places', join(root, 'data/places.json'), join(FIXTURES_DIR, 'places.json'), (x) => Array.isArray(x) && x.length > 0) ?? [];
  const playable = (opts.playable ?? ['cafe', 'barbershop']).filter((n) => niches[n]);
  const ctxNiches: Partial<Record<NicheId, Pack>> = {};
  for (const n of playable) ctxNiches[n] = niches[n];
  const packs: PackSet = { common, niches };
  return { packs, places, ctx: { packs: { common, niches: ctxNiches }, places }, sources };
}
