// The one seam between the /biz screen and the app shell (agent 08).
import type { ReactNode } from 'react';
import type { Ack, Action, CommonPack, GameClient, OwnerView, Pack, Query } from '../../../../shared/src/types';

export type BizTab = 'today' | 'manage' | 'books' | 'network' | 'insights';

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
  /** Tabs owned by other agents: Network (12) and Insights (11). */
  slots?: Partial<Record<'network' | 'insights', ReactNode>>;
}

/** What the shell passes in once it has useView() and a GameClient. */
export function fromGameClient(p: {
  client: GameClient; worldId: string; view: OwnerView; pack: Pack | null; common: CommonPack | null; online: boolean;
  navigate?(to: string): void; slots?: BizDeps['slots'];
}): BizDeps {
  return {
    view: p.view, pack: p.pack, common: p.common, online: p.online, navigate: p.navigate, slots: p.slots,
    act: (a) => p.client.act(p.worldId, a),
    query: <T,>(q: Query) => p.client.query<T>(p.worldId, q),
  };
}
