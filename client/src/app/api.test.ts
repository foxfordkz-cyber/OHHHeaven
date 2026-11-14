import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OpenRecommendation, OwnerView, RoadmapItem } from '@ohh/shared/types';
import { createLocalClient, createRemoteClient, localWorldConfigs } from './api';
import { getSession } from './session';
import { interpretIdeaByRules } from './idea-rules';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => localStorage.clear());

describe('remote client (HTTP, contract section 6)', () => {
  it('joins, stores the token and sends it as a Bearer header afterwards', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => json({ ok: true, data: { playerId: 'p7', token: 'tok-7' } }));
    const client = createRemoteClient({ base: '', fetchImpl: fetchImpl as unknown as typeof fetch });
    const ack = await client.join('demo', { name: 'Jordan', kind: 'owner' });
    expect(ack).toEqual({ ok: true, data: { playerId: 'p7', token: 'tok-7' } });
    expect(fetchImpl.mock.calls[0][0]).toBe('/api/worlds/demo/join');
    expect(getSession('remote', 'demo')?.token).toBe('tok-7');

    fetchImpl.mockResolvedValueOnce(json({ unchanged: true }));
    await client.view('demo', 12);
    const [url, init] = fetchImpl.mock.calls[1];
    expect(url).toBe('/api/worlds/demo/view?v=12');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok-7');
  });

  it('accepts bare payloads and Ack bodies alike', async () => {
    const fetchImpl = vi.fn(async () => json([{ id: 'demo', name: 'Demo City', demo: true, owners: 3, day: 9 }]));
    const client = createRemoteClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(await client.listWorlds()).toHaveLength(1);
    fetchImpl.mockResolvedValueOnce(json({ ok: true }));
    expect(await client.act('demo', { type: 'launch' })).toEqual({ ok: true });
  });

  it('turns HTTP and network errors into a failed Ack', async () => {
    const fetchImpl = vi.fn(async () => json({ error: 'Permit not ready' }, 400));
    const client = createRemoteClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(await client.act('demo', { type: 'launch' })).toEqual({ ok: false, error: 'Permit not ready' });
    fetchImpl.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const ack = await client.query('demo', { type: 'debrief' });
    expect(ack.ok).toBe(false);
    expect(ack.error).toMatch(/No connection/);
  });

  it('throws on a failed view so the store can show the offline banner', async () => {
    const fetchImpl = vi.fn(async () => json({ error: 'down' }, 503));
    const client = createRemoteClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(client.view('demo')).rejects.toThrow('down');
  });
});

describe('local client (the city in the browser)', () => {
  it('lists a demo and a live city', async () => {
    const client = createLocalClient({ autoTick: false });
    const worlds = await client.listWorlds();
    expect(worlds.map((w) => w.id)).toEqual(localWorldConfigs().map((c) => c.id));
    client.dispose();
  });

  it('plays the opening path: join, idea, roadmap, setup, open, wait, launch', async () => {
    const client = createLocalClient({ autoTick: false });
    expect((await client.view('demo')).hasOwnProperty('kind')).toBe(true);
    const joined = await client.join('demo', { name: 'Jordan', kind: 'owner' });
    expect(joined.ok).toBe(true);

    const idea = await client.query('demo', { type: 'idea', text: 'a little coffee shop with pastries' });
    expect(idea.data).toMatchObject({ niche: 'cafe' });
    const roadmap = await client.query<RoadmapItem[]>('demo', { type: 'roadmap', niche: 'cafe' });
    expect(roadmap.data?.length).toBeGreaterThan(3);
    const recs = await client.query<OpenRecommendation[]>('demo', { type: 'recommend_opening', niche: 'cafe', placeId: 'p12' });
    const rec = recs.data![0];
    expect(rec.total).toBeGreaterThan(0);

    const opened = await client.act('demo', { type: 'open_business', niche: 'cafe', placeId: 'p12', name: 'Jordan’s Coffee', kitId: rec.kitId, size: rec.size, items: rec.items });
    expect(opened).toEqual({ ok: true });
    let view = (await client.view('demo')) as OwnerView;
    expect(view.business?.status).toBe('setup');
    expect(view.business?.permits.length).toBeGreaterThan(0);

    const v1 = view.world.version;
    expect(await client.view('demo', v1)).toEqual({ unchanged: true });

    const ready = Math.max(...view.business!.permits.map((p) => p.readyDay));
    while (view.world.day < ready) {
      client.tick('demo');
      view = (await client.view('demo')) as OwnerView;
    }
    expect(await client.act('demo', { type: 'launch' })).toEqual({ ok: true });
    view = (await client.view('demo')) as OwnerView;
    expect(view.business?.status).toBe('open');
    client.dispose();
  });

  it('refuses actions before joining and explains why', async () => {
    const client = createLocalClient({ autoTick: false });
    expect(await client.act('nyc', { type: 'launch' })).toEqual({ ok: false, error: 'Join the city first.' });
    client.dispose();
  });
});

describe('interpretIdeaByRules', () => {
  it('matches niches by keywords and falls back to a coffee shop', () => {
    expect(interpretIdeaByRules('I want a barbershop with fades').niche).toBe('barbershop');
    expect(interpretIdeaByRules('a deli and grocery').niche).toBe('bodega');
    expect(interpretIdeaByRules('rent out two apartments').niche).toBe('rentals');
    expect(interpretIdeaByRules('something nice').niche).toBe('cafe');
    expect(interpretIdeaByRules('espresso bar').origin).toBe('rules');
  });
});
