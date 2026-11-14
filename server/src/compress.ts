// Compressed answers for the built client and the packs (B04, round 3; docs/qa/BUGS.md #11).
// Without it a phone on a slow line waits about 13 s for the first screen: 2.7 MB go over the wire uncompressed.
// Node's own zlib, no new dependency. Each file is compressed once and kept in memory until it changes on disk.
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
import type { NextFunction, Request, Response } from 'express';

const TYPES: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};
/** Smaller than this, compression is not worth a round of CPU. */
const MIN_BYTES = 1024;

export type Encoding = 'br' | 'gzip';

/** The best encoding the browser takes, or null. Brotli first: about a fifth smaller than gzip on our bundle. */
export function pickEncoding(acceptEncoding: string | undefined): Encoding | null {
  const a = (acceptEncoding ?? '').toLowerCase();
  const takes = (name: string) => a.split(',').some((part) => {
    const [token, ...params] = part.trim().split(';');
    if (token.trim() !== name && token.trim() !== '*') return false;
    const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
    return !q || Number(q.slice(2)) > 0;
  });
  if (takes('br')) return 'br';
  if (takes('gzip')) return 'gzip';
  return null;
}

export function compress(body: Buffer, enc: Encoding): Buffer {
  return enc === 'br'
    ? brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 9, [constants.BROTLI_PARAM_SIZE_HINT]: body.length } })
    : gzipSync(body, { level: 9 });
}

interface Cached { mtimeMs: number; size: number; bodies: Partial<Record<Encoding, Buffer>> }

/**
 * Serves compressed copies of the files in `dir` (GET and HEAD) when the browser takes br or gzip; everything else
 * falls through to express.static. Files under /assets/ carry a content hash in their name (Vite), so the browser may
 * keep them for a year: a player who comes back tomorrow loads only what changed.
 */
export function compressedStatic(dir: string) {
  const root = normalize(dir + sep);
  const cache = new Map<string, Cached>();
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.method !== 'GET' && req.method !== 'HEAD') { next(); return; }
    const type = TYPES[extname(req.path).toLowerCase()];
    const enc = type ? pickEncoding(req.headers['accept-encoding']) : null;
    if (!type || !enc) { next(); return; }
    let rel: string;
    try { rel = decodeURIComponent(req.path); } catch { next(); return; }
    const file = normalize(join(root, rel));
    if (!file.startsWith(root)) { next(); return; }
    let st;
    try { st = statSync(file); } catch { next(); return; }
    if (!st.isFile() || st.size < MIN_BYTES) { next(); return; }
    let c = cache.get(file);
    if (!c || c.mtimeMs !== st.mtimeMs || c.size !== st.size) { c = { mtimeMs: st.mtimeMs, size: st.size, bodies: {} }; cache.set(file, c); }
    const body = (c.bodies[enc] ??= compress(readFileSync(file), enc));
    res.set({
      'Content-Type': type,
      'Content-Encoding': enc,
      'Content-Length': String(body.length),
      Vary: 'Accept-Encoding',
      'Cache-Control': rel.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    if (req.method === 'HEAD') { res.end(); return; }
    res.end(body);
  };
}

/**
 * A JSON answer that does not change while the server runs (the packs: about 220 KB on every visit), compressed once
 * per encoding. `get` is called again only if it returns a different object.
 */
export function compressedJson(get: () => unknown) {
  let seen: unknown;
  let raw: Buffer | null = null;
  const bodies: Partial<Record<Encoding, Buffer>> = {};
  return (req: Request, res: Response): void => {
    const value = get();
    if (value !== seen || raw === null) {
      seen = value;
      raw = Buffer.from(JSON.stringify(value));
      delete bodies.br;
      delete bodies.gzip;
    }
    const enc = pickEncoding(req.headers['accept-encoding']);
    res.set({ 'Content-Type': 'application/json; charset=utf-8', Vary: 'Accept-Encoding' });
    if (!enc) { res.send(raw); return; }
    const body = (bodies[enc] ??= compress(raw, enc));
    res.set({ 'Content-Encoding': enc, 'Content-Length': String(body.length) });
    res.end(body);
  };
}
