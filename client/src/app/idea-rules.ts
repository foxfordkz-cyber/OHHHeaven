import type { IdeaMatch, NicheId, PlaceTier } from '@shared/types';

/** Offline fallback for the `idea` query: keyword rules. Online the server asks @ohh/ai (agent 05). */
const RULES: { niche: NicheId; words: RegExp; name: string; tier: PlaceTier; note: string }[] = [
  { niche: 'cafe', words: /\b(coffee|caf[eé]|espresso|latte|bakery|pastr(y|ies)|tea|brunch|donut|bagel)/i, name: 'Morning Cup', tier: 'mid', note: 'Coffee shops live on morning foot traffic: a spot near a subway exit matters more than size.' },
  { niche: 'barbershop', words: /\b(barber|hair|haircut|fade|salon|beard|shave|stylist)/i, name: 'Sharp Corner Barbers', tier: 'cheap', note: 'Barbershops sell repeat visits: loyal regulars matter more than the busiest corner.' },
  { niche: 'bodega', words: /\b(bodega|deli|grocery|corner store|convenience|market|snacks)/i, name: 'Corner Market', tier: 'mid', note: 'A corner store wins on hours and location; margins are thin.' },
  { niche: 'guesthouse', words: /\b(hotel|guest ?house|b&b|bed and breakfast|hostel|rooms for tourists)/i, name: 'Little Guesthouse', tier: 'mid', note: 'Short stays are tightly regulated in New York City: check the rules before anything else.' },
  { niche: 'rentals', words: /\b(apartment|rent(al)?s?|landlord|lease out|property|airbnb)/i, name: 'Block Rentals', tier: 'cheap', note: 'Long-term rentals: steady income, heavy upfront money and tenant law to learn.' },
];

export function interpretIdeaByRules(text: string): IdeaMatch {
  const hit = RULES.find((r) => r.words.test(text));
  if (hit) {
    return {
      niche: hit.niche, businessName: hit.name, tier: hit.tier, kitId: 'standard',
      notes: [hit.note, 'Matched by keywords (offline). You can pick another niche below.'], origin: 'rules',
    };
  }
  return {
    niche: 'cafe', businessName: 'My First Shop', tier: 'mid', kitId: 'standard',
    notes: ['We could not match your idea to a niche yet. A coffee shop is the most complete simulation — or pick a niche below.'],
    origin: 'rules',
  };
}
