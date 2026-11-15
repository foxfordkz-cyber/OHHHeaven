// A guest never lands in a demo city that will refuse them (app/fresh-city.ts, docs/qa/BUGS.md #18).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Ack, ClientView, GameClient } from '@ohh/shared/types';
import { RULES } from '@ohh/shared/rules';
import { cityView, worldPublic } from './fixtures';
import { FRESH_AFTER_MONTH, addressNamesCity, openFreshCity, wantsFreshCity } from './fresh-city';
import { createStore } from './store';

const D = RULES.DAYS_PER_MONTH;
const demo = { ...cityView.world.config, id: 'demo', demo: true };
const at = (month: number, config = demo) => worldPublic((month - 1) * D + 5, 10, config);

beforeEach(() => localStorage.clear());

describe('wantsFreshCity', () => {
  it('early in the season a guest stays; late, or after it, a guest gets a fresh city', () => {
    expect(wantsFreshCity({ world: at(1), joined: false, explicit: false })).toBe(false);
    expect(wantsFreshCity({ world: at(FRESH_AFTER_MONTH), joined: false, explicit: false })).toBe(false);
    expect(wantsFreshCity({ world: at(FRESH_AFTER_MONTH + 1), joined: false, explicit: false })).toBe(true);
    expect(wantsFreshCity({ world: at(RULES.JOIN_UNTIL_MONTH + 1), joined: false, explicit: false })).toBe(true);
    expect(wantsFreshCity({ world: { ...at(3), phase: 'ended' as const }, joined: false, explicit: false })).toBe(true);
  });

  it('never moves a player, a city named in the address, the live city or the pitch city', () => {
    expect(wantsFreshCity({ world: at(11), joined: true, explicit: false })).toBe(false);
    expect(wantsFreshCity({ world: at(11), joined: false, explicit: true })).toBe(false);
    expect(wantsFreshCity({ world: at(11, { ...demo, id: 'nyc', demo: false }), joined: false, explicit: false })).toBe(false);
    expect(wantsFreshCity({ world: at(11, { ...demo, id: 'pitch' }), joined: false, explicit: false })).toBe(false);
  });

  it('reads ?world= from the address', () => {
    expect(addressNamesCity('?world=pitch')).toBe(true);
    expect(addressNamesCity('?mode=remote')).toBe(false);
  });
});

describe('openFreshCity', () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  it('takes a young demo city another guest already opened, the youngest first', async () => {
    const f = vi.fn(async () => json([
      { id: 'nyc', demo: false, day: 3 }, { id: 'demo', demo: true, day: 300 }, { id: 'pitch', demo: true, day: 2 },
      { id: 'demo-2', demo: true, day: 40 }, { id: 'demo-3', demo: true, day: 9 }, { id: 'demo-4', demo: true, day: 350 },
    ]));
    expect(await openFreshCity('', f as unknown as typeof fetch, 'demo')).toBe('demo-3');
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('opens a new one when none is young enough; null when the server refuses or is away', async () => {
    const ok = vi.fn(async (_u: string, init?: RequestInit) => (init?.method === 'POST' ? json({ ok: true, data: { id: 'demo-5' } }, 201) : json([{ id: 'demo', demo: true, day: 300 }])));
    expect(await openFreshCity('', ok as unknown as typeof fetch)).toBe('demo-5');
    expect(ok).toHaveBeenLastCalledWith('/api/worlds', expect.objectContaining({ method: 'POST' }));
    const full = vi.fn(async (_u: string, init?: RequestInit) => (init?.method === 'POST' ? json({ ok: false, error: 'Too many demo cities' }, 429) : json([])));
    expect(await openFreshCity('', full as unknown as typeof fetch)).toBeNull();
    const away = vi.fn(async () => { throw new Error('offline'); });
    expect(await openFreshCity('', away as unknown as typeof fetch)).toBeNull();
  });
});

describe('the store moves a guest into the fresh city once', () => {
  it('first view of a late demo city → the next view comes from the new city, and the choice is remembered', async () => {
    const late: ClientView = { ...cityView, world: at(11) };
    const fresh: ClientView = { ...cityView, world: at(1, { ...demo, id: 'demo-2' }) };
    const asked: string[] = [];
    const client: GameClient = {
      listWorlds: vi.fn(async () => []),
      join: vi.fn(async (): Promise<Ack<{ playerId: string; token: string }>> => ({ ok: true, data: { playerId: 'p1', token: 't1' } })),
      view: vi.fn(async (worldId: string) => { asked.push(worldId); return worldId === 'demo-2' ? fresh : late; }),
      act: vi.fn(async (): Promise<Ack> => ({ ok: true })),
      query: vi.fn() as unknown as GameClient['query'],
    };
    const freshCity = vi.fn(async (v: ClientView) => (v.world.date.month > FRESH_AFTER_MONTH ? 'demo-2' : null));
    const store = createStore({ client, mode: 'remote', worldId: 'demo', freshCity });
    await store.refresh();
    expect(store.getState().worldId).toBe('demo-2');
    expect(store.getState().view).toBe(fresh);
    await store.refresh();
    expect(freshCity).toHaveBeenCalledTimes(1);
    expect(asked).toEqual(['demo', 'demo-2', 'demo-2']);
    expect(localStorage.getItem('ohh.world.v1')).toBe('demo-2');
  });

  it('a city that still takes guests is kept', async () => {
    const early: ClientView = { ...cityView, world: at(2) };
    const client = { view: vi.fn(async () => early) } as unknown as GameClient;
    const store = createStore({ client, mode: 'remote', worldId: 'demo', freshCity: async () => null });
    await store.refresh();
    expect(store.getState().worldId).toBe('demo');
  });
});
