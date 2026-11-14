// The one seam between the /biz screen and the app shell (agent 08).
import type { ReactNode } from 'react';
import type { Ack, Action, CommonPack, GameClient, OwnerView, Pack, Query } from '@ohh/shared/types';

/** Tabs this screen owns; other agents add theirs through the shell (Network 40, Insights 50). */
export type BizTabId = 'today' | 'manage' | 'books' | 'network' | 'insights' | (string & {});

/** Same shape as the shell's BizTab (client/src/app/screens.tsx). */
export interface ExtraTab { id: string; label: string; order: number; element: ReactNode; badge?: number }

export interface BizDeps {
  view: OwnerView;
  /** Pack of this business's niche and the common pack (shell loads them from GET /api/packs). */
  pack: Pack | null;
  common: CommonPack | null;
  /** false while the last poll failed: the screen shows a banner and keeps the draft. */
  online: boolean;
  act(a: Action): Promise<Ack>;
  query<T>(q: Query): Promise<Ack<T>>;
  navigate?(to: string): void;
  /** Tabs registered by other agents (getBizTabs()); Network and Insights get a placeholder until they exist. */
  tabs?: ExtraTab[];
}

/** For a shell that holds a GameClient directly. */
export function fromGameClient(p: {
  client: GameClient; worldId: string; view: OwnerView; pack: Pack | null; common: CommonPack | null; online: boolean;
  navigate?(to: string): void; tabs?: ExtraTab[];
}): BizDeps {
  return {
    view: p.view, pack: p.pack, common: p.common, online: p.online, navigate: p.navigate, tabs: p.tabs,
    act: (a) => p.client.act(p.worldId, a),
    query: <T,>(q: Query) => p.client.query<T>(p.worldId, q),
  };
}
