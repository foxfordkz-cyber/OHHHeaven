// Cafe model, part "segments": guest groups by place and time (build/ROUND3.md, B02).
// Empty until its wave B executor fills it in. An empty part changes nothing in the game.
import { defaultGuestMix, type CafeDay, type CafePart, type GuestMix } from './contract';

/** Who comes today. service.ts reads this; keep the name and the signature. */
export function guestMix(d: CafeDay): GuestMix {
  return defaultGuestMix(d.pack);
}

export const part: CafePart = {};
