import type { OfficialRole } from '@shared/types';

/** Who am I in a given world. Stored in localStorage so the same token brings the player back. */
export interface Session {
  worldId: string;
  playerId: string;
  token: string;
  name: string;
  kind: 'owner' | 'official';
  role?: OfficialRole;
}

export type Mode = 'remote' | 'local';

const SESSIONS_KEY = 'ohh.sessions.v1';
const WORLD_KEY = 'ohh.world.v1';
const MODE_KEY = 'ohh.mode.v1';

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function readAll(): Record<string, Session> {
  const raw = storage()?.getItem(SESSIONS_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, Session>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

const sessionKey = (mode: Mode, worldId: string) => `${mode}:${worldId}`;

export function getSession(mode: Mode, worldId: string): Session | null {
  return readAll()[sessionKey(mode, worldId)] ?? null;
}

export function saveSession(mode: Mode, s: Session): void {
  const all = readAll();
  all[sessionKey(mode, s.worldId)] = s;
  storage()?.setItem(SESSIONS_KEY, JSON.stringify(all));
}

export function clearSession(mode: Mode, worldId: string): void {
  const all = readAll();
  delete all[sessionKey(mode, worldId)];
  storage()?.setItem(SESSIONS_KEY, JSON.stringify(all));
}

/** Mode: `?mode=local` or the "Practice offline" button switch to the in-browser game. */
export function detectMode(search: string = typeof location === 'undefined' ? '' : location.search): Mode {
  const q = new URLSearchParams(search).get('mode');
  if (q === 'local' || q === 'remote') {
    storage()?.setItem(MODE_KEY, q);
    return q;
  }
  const saved = storage()?.getItem(MODE_KEY);
  return saved === 'local' ? 'local' : 'remote';
}

export function rememberMode(mode: Mode): void {
  storage()?.setItem(MODE_KEY, mode);
}

/** Which world the player is in: `?world=` beats the saved one; default is the fast demo city. */
export function detectWorld(search: string = typeof location === 'undefined' ? '' : location.search): string {
  const q = new URLSearchParams(search).get('world');
  if (q) {
    storage()?.setItem(WORLD_KEY, q);
    return q;
  }
  return storage()?.getItem(WORLD_KEY) ?? 'demo';
}

export function rememberWorld(worldId: string): void {
  storage()?.setItem(WORLD_KEY, worldId);
}
