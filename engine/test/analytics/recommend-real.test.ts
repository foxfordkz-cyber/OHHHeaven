// Advice on the real packs (docs/qa/BUGS.md #2): a quiet door, the recommended standard cafe, eighty days.
// The engine's own forecast says shrinking the room loses money there; the advice must not offer it.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CommonPack, Pack, PackSet, Place, Player, WorldConfig, WorldState } from '@ohh/shared';
import { applyAction, createWorld, tickDay } from '../../src/index';
import { recommend } from '../../src/analytics';
import { recommendOpening } from '../../src/analytics/opening';
import { seatRuleBroken } from '../../src/economy/actions';

const read = <T>(p: string): T => JSON.parse(readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8')) as T;
const packs: PackSet = { common: read<CommonPack>('packs/_common.json'), niches: { cafe: read<Pack>('packs/cafe.json') } };
const places = read<Place[]>('data/places.json');
const ctx = { packs, places };
const cfg = { id: 'rr', name: 'Advice', city: 'nyc', seasonMonths: 12, dayMs: 2000, paused: false, maxOwners: 10, aiBusinessesTarget: 0, entryFee: 5, prizeShare: 0.9, officialsShare: 0.05, platformShare: 0.05, nichePrizeTable: [0.5, 0.3, 0.2], demo: true, seed: 11 } as WorldConfig;

function openAt(placeId: string, days: number): WorldState {
  const me: Player = { id: 'pl1', name: 'Me', kind: 'owner', isAi: false, paid: true, joinedDay: 0, lastSeenDay: 0, inbox: [] } as Player;
  let w: WorldState = { ...createWorld(cfg), players: [me] };
  const rec = recommendOpening('cafe', placeId, w, ctx).find((r) => r.kitId === 'standard')!;
  w = applyAction(w, ctx, 'pl1', { type: 'open_business', niche: 'cafe', placeId, name: 'Me', kitId: rec.kitId, size: rec.size, items: rec.items }).world;
  w = applyAction(w, ctx, 'pl1', { type: 'set_orders', orders: rec.orders }).world;
  while (w.day < days) {
    w = tickDay(w, ctx);
    if (w.businesses[0].status === 'setup') { const r = applyAction(w, ctx, 'pl1', { type: 'launch' }); if (!r.error) w = r.world; }
  }
  return w;
}

describe('recommend on the real packs', () => {
  it('seat advice always promises more profit: Apply never leads into a loss', () => {
    // ev-074: 1,260 people a day, the quietest door a newcomer can afford; an 18-seat room is mostly empty there
    for (const day of [80, 120]) {
      const w = openAt('ev-074', day);
      const b = w.businesses[0];
      expect(b.status).toBe('open');
      for (const r of recommend(b, w, ctx)) {
        if (r.id === 'many_seats' || r.id === 'few_seats') expect(r.impact!.profitDeltaMonth).toBeGreaterThan(0);
      }
    }
  });
});

describe('recommend_opening on the real packs', () => {
  it('never offers a kit that open_business refuses for the seat rules (docs/qa/BUGS.md #12)', () => {
    const w = { ...createWorld(cfg), players: [] } as WorldState;
    // the rooms where premium was offered with 24 seats and no customer restroom
    for (const placeId of ['ev-005', 'ev-016', 'ev-053', 'ev-058', 'ev-062']) {
      for (const r of recommendOpening('cafe', placeId, w, ctx)) {
        expect(seatRuleBroken(packs.niches.cafe!, r.size, r.items), `${placeId} ${r.kitId}`).toBeNull();
      }
    }
  });
});
