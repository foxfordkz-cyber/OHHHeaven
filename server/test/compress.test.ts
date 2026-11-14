// Compressed answers (server/src/compress.ts): the built client and the packs go over the wire as br or gzip.
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import express from 'express';
import { get as httpGet } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import { compressedJson, compressedStatic, pickEncoding } from '../src/compress';
import { createApp, GameServer } from '../src/index';

interface Raw { status: number; headers: Record<string, string | string[] | undefined>; body: Buffer }

/** What really goes over the wire: plain node http, no decoding on the way (supertest unzips by itself). */
function get(app: express.Express, path: string, acceptEncoding?: string): Promise<Raw> {
  return new Promise((done, fail) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      const headers: Record<string, string> = acceptEncoding ? { 'Accept-Encoding': acceptEncoding } : {};
      httpGet({ host: '127.0.0.1', port, path, headers }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => { server.close(); done({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }); });
      }).on('error', (e) => { server.close(); fail(e); });
    });
  });
}

function siteWith(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'ohh-dist-'));
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), body);
  }
  return dir;
}

describe('compress', () => {
  it('picks brotli, then gzip, and respects q=0', () => {
    expect(pickEncoding('gzip, deflate, br')).toBe('br');
    expect(pickEncoding('gzip, deflate')).toBe('gzip');
    expect(pickEncoding('br;q=0, gzip')).toBe('gzip');
    expect(pickEncoding('identity')).toBeNull();
    expect(pickEncoding(undefined)).toBeNull();
  });

  it('serves a hashed bundle compressed, with a year of cache, and the same bytes after decoding', async () => {
    const js = 'export const hello = "world";\n'.repeat(400);
    const dir = siteWith({ 'assets/index-abc123.js': js, 'tiny.js': 'x=1', 'index.html': '<!doctype html>' + 'a'.repeat(2000) });
    const app = express();
    app.use(compressedStatic(dir));
    app.use(express.static(dir));

    const br = await get(app, '/assets/index-abc123.js', 'gzip, br');
    expect(br.status).toBe(200);
    expect(br.headers['content-encoding']).toBe('br');
    expect(br.headers['cache-control']).toContain('immutable');
    expect(br.headers['vary']).toBe('Accept-Encoding');
    expect(brotliDecompressSync(br.body).toString()).toBe(js);
    expect(br.body.length).toBeLessThan(js.length / 10);

    const gz = await get(app, '/assets/index-abc123.js', 'gzip');
    expect(gz.headers['content-encoding']).toBe('gzip');
    expect(gunzipSync(gz.body).toString()).toBe(js);

    // no encoding asked, a tiny file, a path outside the folder: express.static (or a 404) answers as before
    const plain = await get(app, '/assets/index-abc123.js', 'identity');
    expect(plain.headers['content-encoding']).toBeUndefined();
    const tiny = await get(app, '/tiny.js', 'br');
    expect(tiny.headers['content-encoding']).toBeUndefined();
    const out = await get(app, '/..%2f..%2fetc%2fpasswd.js', 'br');
    expect(out.headers['content-encoding']).toBeUndefined();

    const html = await get(app, '/index.html', 'br');
    expect(html.headers['cache-control']).toBe('no-cache');
  });

  it('compresses a JSON answer once and recompresses only when the value changes', async () => {
    let value: unknown = { a: 'x'.repeat(5000) };
    const app = express();
    app.get('/j', compressedJson(() => value));
    const one = await get(app, '/j', 'gzip');
    expect(one.headers['content-encoding']).toBe('gzip');
    expect(JSON.parse(gunzipSync(one.body).toString())).toEqual(value);
    value = { b: 2 };
    const two = await get(app, '/j', 'gzip');
    expect(JSON.parse(gunzipSync(two.body).toString())).toEqual({ b: 2 });
    const none = await get(app, '/j');
    expect(none.headers['content-encoding']).toBeUndefined();
    expect(JSON.parse(none.body.toString())).toEqual({ b: 2 });
  });

  it('the game server sends the packs compressed and the client still reads them as JSON', async () => {
    const app = createApp(new GameServer({ snapshotDir: null, autoStart: false, log: () => {} }).boot());
    const r = await get(app, '/api/packs', 'br');
    expect(r.status).toBe(200);
    expect(r.headers['content-encoding']).toBe('br');
    const packs = JSON.parse(brotliDecompressSync(r.body).toString());
    expect(packs.niches.cafe.id).toBe('cafe');
    expect(r.body.length).toBeLessThan(JSON.stringify(packs).length / 3);   // about 244 KB → 62 KB
    const plain = await get(app, '/api/packs');
    expect(plain.headers['content-encoding']).toBeUndefined();
    expect(JSON.parse(plain.body.toString()).niches.cafe.id).toBe('cafe');
  });
});
