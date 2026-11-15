// The real packs/cafe.json without the sections of the cafe model parts (B04, the integrator, build/ROUND3.md).
// The integrator puts extra.guestSegments, extra.service, extra.staffing and extra.regulars into packs/cafe.json
// (packs/parts/cafe/apply-parts.mjs). A part's test that needs "the pack before any part data" starts from this one
// and adds back only the sections it wants, so it checks the same thing whether the real pack has the data or not.
import type { Pack } from '@ohh/shared';

export const PART_SECTIONS = ['guestSegments', 'service', 'staffing', 'regulars'] as const;

export function plainCafePack(real: Pack): Pack {
  const extra = Object.fromEntries(
    Object.entries(real.extra ?? {}).filter(([k]) => !(PART_SECTIONS as readonly string[]).includes(k)),
  );
  return { ...real, extra };
}
