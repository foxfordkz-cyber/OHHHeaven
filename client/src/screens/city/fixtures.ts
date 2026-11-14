// Example CityView for /dev/city: the map fixtures plus world numbers, standings and a feed.
import type { CityView, FeedItem, NicheId, Standing, WorldConfig } from '../../../../shared/src/types';
import { RULES, dateOf } from '../../../../shared/src/rules';
import { businesses, day, events, weather } from '../../map/fixtures';

const config: WorldConfig = {
  id: 'demo', name: 'Demo city', city: 'nyc', seasonMonths: 12, dayMs: RULES.DAY_MS_DEMO, paused: false,
  maxOwners: 100, aiBusinessesTarget: 30, entryFee: 5, prizeShare: 0.9, officialsShare: 0.05, platformShare: 0.05,
  nichePrizeTable: [0.5, 0.3, 0.2], demo: true, seed: 7,
};

function standings(): Partial<Record<NicheId, Standing[]>> {
  const out: Partial<Record<NicheId, Standing[]>> = {};
  for (const b of businesses) {
    const list = out[b.niche] ?? [];
    const bankrupt = b.status === 'bankrupt';
    list.push({ businessId: b.id, niche: b.niche, rank: b.rankInNiche, isAi: b.isAi, bankrupt, netWorth: bankrupt ? 0 : Math.round(52_000 - b.rankInNiche * 2_900 + b.reputation * 600) });
    out[b.niche] = list;
  }
  for (const list of Object.values(out)) list?.sort((a, b) => a.rank - b.rank);
  return out;
}

const feed: FeedItem[] = [
  { id: 'f1', day: 40, kind: 'event', text: 'Street work announced: St Marks Pl between 2nd and 3rd Ave closes Feb 12–15.' },
  { id: 'f2', day: 41, kind: 'opening', text: 'Latte Lab opened on Ave A.', businessId: 'b-cafe-15' },
  { id: 'f3', day: 41, kind: 'deal', text: 'Night Owl Coffee and Fade Factory started a cross-promo.', businessId: 'b-cafe-1' },
  { id: 'f4', day: 42, kind: 'report', text: 'A neighbor reported Corner Crema to the health department.' },
  { id: 'f5', day: 42, kind: 'inspection', text: 'Health inspection at Corner Crema: 2 violations, $1,800 fine, closed 3 days.', businessId: 'b-cafe-14' },
  { id: 'f6', day: 43, kind: 'bankruptcy', text: 'Copper Kettle ran out of cash and closed for good.', businessId: 'b-cafe-16' },
  { id: 'f7', day: 43, kind: 'event', text: 'Coffee bean prices up 12% from Feb 14.' },
];

export const cityView: CityView = {
  kind: 'city',
  world: {
    config, phase: 'running', day, date: dateOf(day), version: 1, bank: 96 * config.entryFee, msToNextDay: 1_200,
    stats: {
      owners: businesses.filter((b) => !b.isAi).length + 52,
      aiBusinesses: businesses.filter((b) => b.isAi).length,
      officials: 6,
      open: businesses.filter((b) => b.status === 'open').length,
      bankrupt: businesses.filter((b) => b.status === 'bankrupt').length,
    },
  },
  businesses, weather, events, feed, leaderboards: standings(),
};
