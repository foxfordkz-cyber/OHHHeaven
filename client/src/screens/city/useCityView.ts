// Polls the open city picture (CityView) and sends demo clock commands.
// When agent 08's store and useView() land, CityScreenRoute switches to them; this hook stays as a fallback.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CityView, ClientView, GameClient } from '../../../../shared/src/types';

export interface ClockCommand { paused?: boolean; speed?: number }

export function viewUrl(baseUrl: string, worldId: string, version?: number): string {
  const v = version === undefined ? '' : `?v=${version}`;
  return `${baseUrl}/api/worlds/${encodeURIComponent(worldId)}/view${v}`;
}

export async function sendClock(worldId: string, cmd: ClockCommand, baseUrl = ''): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/worlds/${encodeURIComponent(worldId)}/clock`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cmd),
    });
    return res.ok;
  } catch {
    return false;
  }
}

type ViewReply = ClientView | { unchanged: true };
const isCity = (v: ViewReply | null): v is CityView => !!v && 'kind' in v && v.kind === 'city';

export function useCityView(worldId: string, opts: { baseUrl?: string; client?: GameClient; fallback?: CityView } = {}) {
  const { baseUrl = '', client, fallback } = opts;
  const [view, setView] = useState<CityView | null>(fallback ?? null);
  const [receivedAt, setReceivedAt] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const versionRef = useRef<number | undefined>(undefined);
  const demoRef = useRef(true);

  const load = useCallback(async () => {
    try {
      let reply: ViewReply | null;
      if (client) reply = await client.view(worldId, versionRef.current);
      else {
        const res = await fetch(viewUrl(baseUrl, worldId, versionRef.current));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        reply = (await res.json()) as ViewReply;
      }
      setError(null);
      if (isCity(reply)) {
        versionRef.current = reply.world.version;
        demoRef.current = reply.world.config.demo;
        setView(reply);
        setReceivedAt(Date.now());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [baseUrl, client, worldId]);

  useEffect(() => {
    let stop = false;
    let timer = 0;
    const tick = async () => {
      await load();
      if (!stop) timer = window.setTimeout(tick, demoRef.current ? 2000 : 15000);
    };
    tick();
    return () => { stop = true; window.clearTimeout(timer); };
  }, [load]);

  return { view, receivedAt, error, refresh: load };
}
