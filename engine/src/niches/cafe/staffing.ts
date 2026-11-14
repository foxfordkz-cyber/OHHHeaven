// Cafe model, part "staffing": roles and skill, cover of opening hours (build/ROUND3.md, B03).
// Empty until its wave B executor fills it in. An empty part changes nothing in the game.
import { defaultStaffPower, type CafeDay, type CafePart, type StaffPower } from './contract';

/** How fast and how well today's team works. service.ts reads this; keep the name and the signature. */
export function staffPower(d: CafeDay): StaffPower {
  return defaultStaffPower(d.b, d.pack);
}

export const part: CafePart = {};
