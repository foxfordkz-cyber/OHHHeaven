import type {
  Ack, Action, ClientView, GameClient, OfficialRole, Query, WorldConfig, WorldState,
} from '@shared/types';
import { RULES } from '@shared/rules';
import { getSession, saveSession, type Mode } from './session';
import { localRuntime, type LocalRuntime } from './local-host';
import { interpretIdeaByRules } from './idea-rules';

type WorldSummary = Awaited<ReturnType<GameClient['listWorlds']>>[number];
type JoinInput = { name: string; kind: 'owner' | 'official'; role?: OfficialRole };

const NETWORK_ERROR = 'No connection to the city server. Check your internet or try "Practice offline".';

// ───────────────────────── remote: HTTP, build/CONTRACT.md section 6 ─────────────────────────

export interface RemoteOptions { base?: string; fetchImpl?: typeof fetch }

/** Any server answer becomes an Ack: `{ ok, data }` passes through, a bare payload is wrapped. */
async function toAck<T>(res: Response): Promise<Ack<T>> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (body && typeof body === 'object' && 'ok' in body && typeof (body as Ack).ok === 'boolean') {
    const ack = body as Ack<T>;
    return res.ok ? ack : { ok: false, error: ack.error ?? res.statusText };
  }
  if (!res.ok) {
    const error = body && typeof body === 'object' && 'error' in body ? String((body as { error: unknown }).error) : `${res.status} ${res.statusText}`;
    return { ok: false, error };
  }
  return { ok: true, data: body as T };
}

export function createRemoteClient(opts: RemoteOptions = {}): GameClient {
  const base = (opts.base ?? import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
  const doFetch = opts.fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));

  const headers = (worldId?: string): Record<string, string> => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    const s = worldId ? getSession('remote', worldId) : null;
    if (s?.token) h.Authorization = `Bearer ${s.token}`;
    return h;
  };

  async function post<T>(path: string, worldId: string, body: unknown): Promise<Ack<T>> {
    try {
      const res = await doFetch(`${base}${path}`, { method: 'POST', headers: headers(worldId), body: JSON.stringify(body) });
      return await toAck<T>(res);
    } catch {
      return { ok: false, error: NETWORK_ERROR };
    }
  }

  return {
    async listWorlds() {
      const res = await doFetch(`${base}/api/worlds`, { headers: headers() });
      const ack = await toAck<WorldSummary[]>(res);
      if (!ack.ok) throw new Error(ack.error);
      return ack.data ?? [];
    },
    async join(worldId, p) {
      const ack = await post<{ playerId: string; token: string }>(`/api/worlds/${encodeURIComponent(worldId)}/join`, worldId, p);
      if (ack.ok && ack.data) {
        saveSession('remote', { worldId, playerId: ack.data.playerId, token: ack.data.token, name: p.name, kind: p.kind, role: p.role });
      }
      return ack;
    },
    async view(worldId, knownVersion) {
      const v = knownVersion === undefined ? '' : `?v=${knownVersion}`;
      const res = await doFetch(`${base}/api/worlds/${encodeURIComponent(worldId)}/view${v}`, { headers: headers(worldId) });
      const ack = await toAck<ClientView | { unchanged: true }>(res);
      if (!ack.ok || !ack.data) throw new Error(ack.error ?? 'Empty view');
      return ack.data;
    },
    act(worldId, action: Action) {
      return post(`/api/worlds/${encodeURIComponent(worldId)}/action`, worldId, action);
    },
    query<T>(worldId: string, q: Query) {
      return post<T>(`/api/worlds/${encodeURIComponent(worldId)}/query`, worldId, q);
    },
  };
}

// ───────────────────────── local: the whole game in the browser ─────────────────────────

export interface LocalOptions { runtime?: LocalRuntime; autoTick?: boolean }

interface LocalWorld { state: WorldState; timer: ReturnType<typeof setInterval> | null }

/** Demo city (2 s per day) and the live city (48 min per day), like the server keeps them. */
export function localWorldConfigs(): WorldConfig[] {
  const base = {
    city: 'nyc' as const, seasonMonths: 12, paused: false, maxOwners: 100, aiBusinessesTarget: 24, entryFee: 5,
    prizeShare: 0.9, officialsShare: 0.05, platformShare: 0.05, nichePrizeTable: [0.5, 0.3, 0.2],
  };
  return [
    { ...base, id: 'demo', name: 'Demo City', dayMs: RULES.DAY_MS_DEMO, demo: true, seed: 7 },
    { ...base, id: 'nyc', name: 'New York City', dayMs: RULES.DAY_MS_LIVE, demo: false, seed: 11 },
  ];
}

export function createLocalClient(opts: LocalOptions = {}): GameClient & { tick(worldId: string): void; dispose(): void } {
  const rt = opts.runtime ?? localRuntime;
  const autoTick = opts.autoTick ?? true;
  const worlds = new Map<string, LocalWorld>();

  function world(worldId: string): LocalWorld {
    let lw = worlds.get(worldId);
    if (lw) return lw;
    const config = localWorldConfigs().find((c) => c.id === worldId) ?? { ...localWorldConfigs()[0], id: worldId, name: worldId };
    lw = { state: rt.host.newWorld(config, rt.ctx, rt.deps), timer: null };
    worlds.set(worldId, lw);
    if (autoTick) {
      const target = lw;
      target.timer = setInterval(() => {
        if (!target.state.config.paused && target.state.phase === 'running') target.state = rt.host.step(target.state, rt.ctx, rt.deps);
      }, config.dayMs);
    }
    return lw;
  }

  const playerOf = (worldId: string): string | null => getSession('local', worldId)?.playerId ?? null;

  return {
    async listWorlds() {
      return localWorldConfigs().map((c) => {
        const s = world(c.id).state;
        return { id: c.id, name: c.name, demo: c.demo, owners: s.players.filter((p) => p.kind === 'owner' && !p.isAi).length, day: s.day };
      });
    },
    async join(worldId, p: JoinInput) {
      const lw = world(worldId);
      try {
        const r = rt.host.join(lw.state, p);
        lw.state = r.world;
        const token = `local-${r.playerId}`;
        saveSession('local', { worldId, playerId: r.playerId, token, name: p.name, kind: p.kind, role: p.role });
        return { ok: true, data: { playerId: r.playerId, token } };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
    async view(worldId, knownVersion) {
      const lw = world(worldId);
      if (knownVersion !== undefined && knownVersion === lw.state.version) return { unchanged: true };
      return rt.host.viewFor(lw.state, rt.ctx, playerOf(worldId));
    },
    async act(worldId, action) {
      const lw = world(worldId);
      const pid = playerOf(worldId);
      if (!pid) return { ok: false, error: 'Join the city first.' };
      const r = rt.host.act(lw.state, rt.ctx, pid, action);
      if (r.error) return { ok: false, error: r.error };
      lw.state = r.world;
      return { ok: true };
    },
    async query<T>(worldId: string, q: Query): Promise<Ack<T>> {
      const lw = world(worldId);
      if (q.type === 'idea') return { ok: true, data: interpretIdeaByRules(q.text) as T };
      if (q.type === 'advisor' || q.type === 'debrief') return { ok: false, error: 'The AI advisor needs the city server. Offline practice answers from the rules only.' };
      const pid = playerOf(worldId);
      if (!pid) return { ok: false, error: 'Join the city first.' };
      try {
        return { ok: true, data: rt.host.answer(lw.state, rt.ctx, pid, q) as T };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
    tick(worldId: string) {
      const lw = world(worldId);
      lw.state = rt.host.step(lw.state, rt.ctx, rt.deps);
    },
    dispose() {
      for (const lw of worlds.values()) if (lw.timer) clearInterval(lw.timer);
      worlds.clear();
    },
  };
}

// ───────────────────────── one client per mode ─────────────────────────

const clients: Partial<Record<Mode, GameClient>> = {};

export function getClient(mode: Mode): GameClient {
  clients[mode] ??= mode === 'local' ? createLocalClient() : createRemoteClient();
  return clients[mode]!;
}
