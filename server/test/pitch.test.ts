// Город показа жюри (ROUND3, A5): сценарий pitch, команды ведущего, вход по коду, QR.
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { OwnerView } from '@ohh/shared';
import { createApp, GameServer } from '../src/index';
import { joinPage, lanBase, makeCode, normalizeCode, type PitchStatus } from '../src/pitch';
import { qrMatrix, qrSvg } from '../src/qr';

const quiet = () => {};
const fingerprint = (text: string) => {
  const q = qrMatrix(text);
  return { version: q.version, mask: q.mask, hash: createHash('sha256').update(q.modules.map((r) => r.map((d) => (d ? 1 : 0)).join('')).join('\n')).digest('hex').slice(0, 16) };
};

describe('QR without dependencies', () => {
  // эталоны сверены бит в бит с библиотекой qrcode 1.5.4 (байтовый режим, уровень M), все 8 масок, версии 1–10
  it('matches the reference matrices', () => {
    expect(fingerprint('http://192.168.1.5:8787/p/ABCD')).toEqual({ version: 3, mask: 1, hash: '7ab13eb4f15cdc42' });
    expect(fingerprint('HELLO')).toEqual({ version: 1, mask: 4, hash: 'c346c75add569873' });
    expect(fingerprint(`https://example.org/${'y'.repeat(120)}`)).toEqual({ version: 8, mask: 2, hash: 'ef2e51f47c12e3cd' });
  });
  it('draws an SVG with a quiet zone and refuses text that does not fit', () => {
    const svg = qrSvg('http://10.0.0.2:8787/p/K7QZ');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('viewBox="0 0 37 37"');
    expect(() => qrMatrix('z'.repeat(400))).toThrow(/too long/);
  });
});

describe('codes and addresses', () => {
  it('codes avoid look-alike letters and never repeat', () => {
    const taken = new Set<string>();
    for (let i = 0; i < 200; i++) { const c = makeCode(4, taken); expect(c).toMatch(/^[A-HJ-NP-Z2-9]{4}$/); taken.add(c); }
    expect(taken.size).toBe(200);
    expect(normalizeCode(' ab-cd ')).toBe('ABCD');
  });
  it('the join address is a network address, not localhost', () => {
    expect(lanBase(8787, { PUBLIC_URL: 'http://show.local:8787/' })).toBe('http://show.local:8787');
    const base = lanBase(8787, {});
    expect(base).toMatch(/^http:\/\/\d+\.\d+\.\d+\.\d+:8787$/);
  });
  it('the join page stores the session where the client looks for it and escapes the payload', () => {
    const html = joinPage({ role: 'maya', worldId: 'pitch', playerId: 'p1', token: 'tok</script>', name: 'Maya' });
    expect(html).toContain("'ohh.sessions.v1'");
    expect(html).toContain("'remote:'+s.world");
    expect(html).toContain('/biz?world=pitch');
    expect(html).not.toContain('tok</script>');
    expect(joinPage({ role: 'guest', worldId: 'pitch' })).toContain('/?world=pitch');
  });
});

describe('pitch scenario', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ohh-pitch-'));
  let game: GameServer;
  let app: ReturnType<typeof createApp>;
  let status: PitchStatus;
  afterAll(() => { game?.stopAll(); rmSync(dir, { recursive: true, force: true }); });

  beforeAll(async () => {
    game = new GameServer({ snapshotDir: dir, autoStart: false, log: quiet }).boot();
    app = createApp(game);
    const r = await request(app).post('/api/worlds').send({ scenario: 'pitch' });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    status = r.body.data.pitch as PitchStatus;
  }, 180_000);

  it('builds a paused city with Maya, Viktor, eight AI cafes and two AI officials', () => {
    const w = game.runtimes.get('pitch')!.world;
    expect(w.config.paused).toBe(true);
    const humans = w.players.filter((p) => !p.isAi).map((p) => p.name).sort();
    expect(humans).toEqual(['Maya', 'Viktor']);
    expect(w.businesses.filter((b) => b.isAi)).toHaveLength(8);
    expect(w.officials.map((o) => `${o.name}:${o.role}:${o.isAi}`).sort()).toEqual(['Dana:inspector:true', 'Sam:tax_auditor:true']);
  });

  it('every must-check passes: both jury branches, the hidden payroll and the complaint', () => {
    const failed = status.checks.filter((c) => c.level === 'must' && !c.ok);
    expect(failed, JSON.stringify(failed)).toEqual([]);
    expect(status.branches.map((b) => b.ok)).toEqual([true, true]);
    expect(status.dryComplaint.found).toContain(status.shortcut.violationId);
  });

  it('owner codes sign Maya in on a phone; the guest code opens the city without a session', async () => {
    expect(status.join.base).not.toMatch(/localhost|127\.0\.0\.1/);
    const guest = await request(app).get(`/p/${status.join.guest.code.toLowerCase()}`);
    expect(guest.status).toBe(200);
    expect(guest.text).toContain('/?world=pitch');
    const maya = await request(app).get(`/p/${status.join.maya!.code}`);
    const token = /"token":"([^"]+)"/.exec(maya.text)?.[1];
    expect(token).toBeTruthy();
    const view = await request(app).get('/api/worlds/pitch/view').set('Authorization', `Bearer ${token}`);
    expect((view.body as OwnerView).me.name).toBe('Maya');
    expect((await request(app).get('/p/ZZZZ')).status).toBe(404);
    const qr = await request(app).get(`/p/${status.join.guest.code}/qr.svg`);
    expect(qr.headers['content-type']).toContain('image/svg+xml');
  });

  it('a jury branch, the complaint and the clock all work; reset brings the prepared moment back', async () => {
    const rt = game.runtimes.get('pitch')!;
    const start = rt.world.day;
    const mayaId = status.summary.maya!.business;
    for (const branch of ['price', 'seats'] as const) {
      const b = await request(app).post('/api/worlds/pitch/pitch').send({ command: 'branch', branch });
      expect(b.body.ok, JSON.stringify(b.body)).toBe(true);
      expect(await request(app).post('/api/worlds/pitch/pitch').send({ command: 'reset' }).then((r) => r.body.data.atStart)).toBe(true);
    }
    const c = await request(app).post('/api/worlds/pitch/pitch').send({ command: 'complaint', run: true, dayMs: 500 });
    expect(c.body.ok).toBe(true);
    expect(c.body.data.complaint.status).toBe('open');
    expect(c.body.data.paused).toBe(false);
    // часы в тесте не идут сами: ведущий перематывает, автопауза срабатывает на уведомлении
    rt.setClock({ advanceDays: 14 });
    const after = (await request(app).get('/api/worlds/pitch/pitch')).body.data as PitchStatus;
    expect(after.complaint?.status).toBe('notice');
    expect(after.complaint?.found).toContain(status.shortcut.violationId);
    expect(after.paused).toBe(true);
    const reset = (await request(app).post('/api/worlds/pitch/pitch').send({ command: 'reset' })).body.data as PitchStatus;
    expect(reset.day).toBe(start);
    expect(reset.complaint).toBeNull();
    expect(reset.summary.maya!.business).toBe(mayaId);
  });

  it('comes back from the snapshot after a restart, with the same codes', async () => {
    game.saveAllSync();
    const again = new GameServer({ snapshotDir: dir, autoStart: false, log: quiet }).boot();
    try {
      expect(again.pitch?.file.codes).toEqual(game.pitch?.file.codes);
      const r = await request(createApp(again)).get(`/p/${status.join.maya!.code}`);
      expect(r.status).toBe(200);
    } finally {
      again.stopAll();
    }
  });

  it('refuses commands without the clock key when one is set', async () => {
    const locked = createApp(Object.assign(game, {}) as GameServer);
    const prev = process.env.CLOCK_KEY;
    process.env.CLOCK_KEY = 'secret';
    try {
      expect((await request(locked).post('/api/worlds/pitch/pitch').send({ command: 'pause' })).status).toBe(403);
      const open = await request(locked).get('/api/worlds/pitch/pitch');
      expect(open.body.data.join.maya).toBeNull();
      expect((await request(locked).post('/api/worlds/pitch/pitch').set('x-clock-key', 'secret').send({ command: 'pause' })).status).toBe(200);
    } finally {
      if (prev === undefined) delete process.env.CLOCK_KEY; else process.env.CLOCK_KEY = prev;
    }
  });
});
