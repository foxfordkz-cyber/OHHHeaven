import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Ack, ClientView, GameClient, Query } from '@ohh/shared/types';
import { cityView, ownerView, worldPublic } from './fixtures';
import { createStaticStore, createStore, pollIntervalFor } from './store';

function fakeClient(views: (ClientView | { unchanged: true } | Error)[]) {
  const calls: { worldId: string; known?: number }[] = [];
  const client: GameClient = {
    listWorlds: vi.fn(async () => []),
    join: vi.fn(async (): Promise<Ack<{ playerId: string; token: string }>> => ({ ok: true, data: { playerId: 'p1', token: 't1' } })),
    view: vi.fn(async (worldId: string, known?: number) => {
      calls.push({ worldId, known });
      const next = views.length > 1 ? views.shift()! : views[0];
      if (next instanceof Error) throw next;
      return next;
    }),
    act: vi.fn(async (): Promise<Ack> => ({ ok: true })),
    query: vi.fn(async (_w: string, _q: Query): Promise<Ack<unknown>> => ({ ok: true, data: 'answer' })) as unknown as GameClient['query'],
  };
  return { client, calls };
}

const liveCity: ClientView = { ...cityView, world: worldPublic(74, 50, { ...cityView.world.config, demo: false, dayMs: 2_880_000 }) };

beforeEach(() => localStorage.clear());

describe('pollIntervalFor', () => {
  it('polls every 2 s in a demo city and every 15 s in the live city', () => {
    expect(pollIntervalFor(null)).toBe(2_000);
    expect(pollIntervalFor(cityView)).toBe(2_000);
    expect(pollIntervalFor(liveCity)).toBe(15_000);
  });
});

describe('createStore', () => {
  it('keeps the last view and sends its version on the next poll', async () => {
    const { client, calls } = fakeClient([cityView, { unchanged: true }]);
    const store = createStore({ client, mode: 'remote', worldId: 'demo' });
    await store.refresh();
    expect(store.getState().view).toBe(cityView);
    expect(store.getState().version).toBe(cityView.world.version);
    expect(store.getState().status).toBe('live');
    await store.refresh();
    expect(calls).toEqual([{ worldId: 'demo', known: undefined }, { worldId: 'demo', known: cityView.world.version }]);
    expect(store.getState().view).toBe(cityView);
  });

  it('replaces the view when the version changed and notifies subscribers', async () => {
    const newer = { ...cityView, world: { ...cityView.world, version: cityView.world.version + 1 } };
    const { client } = fakeClient([cityView, newer]);
    const store = createStore({ client, mode: 'remote', worldId: 'demo' });
    const seen: (number | null)[] = [];
    store.subscribe(() => seen.push(store.getState().version));
    await store.refresh();
    await store.refresh();
    expect(store.getState().view).toBe(newer);
    expect(seen).toContain(newer.world.version);
  });

  it('goes offline on a network error and keeps the old view', async () => {
    const { client } = fakeClient([cityView, new Error('Network down')]);
    const store = createStore({ client, mode: 'remote', worldId: 'demo' });
    await store.refresh();
    await store.refresh();
    expect(store.getState().status).toBe('offline');
    expect(store.getState().error).toBe('Network down');
    expect(store.getState().view).toBe(cityView);
  });

  it('schedules the next poll by the city speed', async () => {
    const timers: number[] = [];
    const { client } = fakeClient([liveCity]);
    const store = createStore({ client, mode: 'remote', worldId: 'nyc', setTimer: (_fn, ms) => (timers.push(ms), timers.length), clearTimer: () => undefined });
    store.start();
    await vi.waitFor(() => expect(timers).toEqual([15_000]));
    store.stop();
  });

  it('turns an action error into a toast and does not refresh', async () => {
    const { client } = fakeClient([ownerView]);
    client.act = vi.fn(async () => ({ ok: false, error: 'Not enough cash.' }));
    const store = createStore({ client, mode: 'remote', worldId: 'demo', setTimer: () => 0 });
    const ack = await store.act({ type: 'launch' });
    expect(ack.ok).toBe(false);
    expect(store.getState().toasts.map((t) => [t.text, t.tone])).toEqual([['Not enough cash.', 'error']]);
    expect(client.view).not.toHaveBeenCalled();
  });

  it('refreshes the view right after a successful action', async () => {
    const { client } = fakeClient([ownerView]);
    const store = createStore({ client, mode: 'remote', worldId: 'demo' });
    await store.act({ type: 'set_orders', orders: { price: 6.6 } });
    expect(client.act).toHaveBeenCalledWith('demo', { type: 'set_orders', orders: { price: 6.6 } });
    expect(store.getState().view).toBe(ownerView);
  });

  it('returns query data, or null with a toast on error', async () => {
    const { client } = fakeClient([cityView]);
    const store = createStore({ client, mode: 'remote', worldId: 'demo', setTimer: () => 0 });
    expect(await store.query<string>({ type: 'debrief' })).toBe('answer');
    client.query = vi.fn(async () => ({ ok: false, error: 'Advisor timed out.' })) as unknown as GameClient['query'];
    expect(await store.query({ type: 'advisor', question: 'Why?' })).toBeNull();
    expect(store.getState().toasts.at(-1)?.text).toBe('Advisor timed out.');
  });

  it('dismisses toasts', () => {
    const { client } = fakeClient([cityView]);
    const store = createStore({ client, mode: 'remote', worldId: 'demo', setTimer: () => 0 });
    store.toast('Saved', 'success');
    const id = store.getState().toasts[0].id;
    store.dismissToast(id);
    expect(store.getState().toasts).toEqual([]);
  });
});

describe('createStaticStore', () => {
  it('serves example data, answers queries from the table and moves on actions', async () => {
    const store = createStaticStore(cityView, { idea: { niche: 'cafe' } }, (a) => (a.type === 'launch' ? ownerView : undefined));
    expect(store.getState().fixture).toBe(true);
    expect(await store.query({ type: 'idea', text: 'coffee' })).toEqual({ niche: 'cafe' });
    await store.act({ type: 'launch' });
    expect(store.getState().view).toBe(ownerView);
  });
});
