// STUB map for agent 07's simulator: 48 storefronts on 8 real East Village blocks.
// Rents, sizes and foot traffic are estimates (note: "unverified"). Replace with data/places.json (agent 09).
import type { Place, PlaceTier } from '../../../shared/src/types';

interface BlockSpec { block: string; tier: PlaceTier; rent: number; foot: number; from: [number, number]; to: [number, number] }

const BLOCKS: BlockSpec[] = [
  { block: 'St Marks Pl, 2nd–3rd Ave', tier: 'prime', rent: 160, foot: 0.85, from: [40.7294, -73.9894], to: [40.7286, -73.9876] },
  { block: 'St Marks Pl, 1st–2nd Ave', tier: 'prime', rent: 140, foot: 0.8, from: [40.7280, -73.9870], to: [40.7270, -73.9846] },
  { block: '1st Ave, E 4th–E 7th St', tier: 'mid', rent: 105, foot: 0.6, from: [40.7238, -73.9878], to: [40.7262, -73.9861] },
  { block: 'Avenue A, E 7th–E 10th St', tier: 'mid', rent: 110, foot: 0.65, from: [40.7254, -73.9836], to: [40.7280, -73.9817] },
  { block: 'E 7th St, 1st Ave–Ave A', tier: 'mid', rent: 95, foot: 0.55, from: [40.7262, -73.9858], to: [40.7254, -73.9838] },
  { block: 'E 9th St, 1st–2nd Ave', tier: 'cheap', rent: 85, foot: 0.45, from: [40.7286, -73.9882], to: [40.7276, -73.9858] },
  { block: 'Avenue B, E 3rd–E 6th St', tier: 'cheap', rent: 70, foot: 0.35, from: [40.7215, -73.9835], to: [40.7236, -73.9819] },
  { block: 'E 4th St, Ave A–Ave B', tier: 'cheap', rent: 65, foot: 0.3, from: [40.7230, -73.9850], to: [40.7222, -73.9829] },
];

const SQFT = [620, 780, 940, 700, 860, 1040];

export const stubPlaces: Place[] = BLOCKS.flatMap((b, bi) =>
  SQFT.map((sqft, i) => {
    const t = (i + 0.5) / SQFT.length;
    return {
      id: `ev-${bi + 1}-${i + 1}`,
      address: `${b.block} #${i + 1}`,
      block: b.block,
      lat: +(b.from[0] + (b.to[0] - b.from[0]) * t).toFixed(5),
      lng: +(b.from[1] + (b.to[1] - b.from[1]) * t).toFixed(5),
      kind: 'storefront' as const,
      sqft,
      tier: b.tier,
      rentPerSqftYear: b.rent,
      footTraffic: b.foot,
      suitableFor: ['cafe', 'barbershop', 'bodega', 'guesthouse', 'rentals'],
      note: 'unverified: agent 07 stub, replace with data/places.json',
    } satisfies Place;
  }),
);
