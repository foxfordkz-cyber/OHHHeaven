// "What would you open?": maps a free-text idea to the nearest niche pack, a name, a place tier and a kit.
import * as z from 'zod/v4';
import type { IdeaMatch, NicheId, Pack, PackSet, PlaceTier } from './shared';
import { callAi } from './provider';
import { hash32 } from './rng';
import { BANNED } from './events/themes';
import { money, plainEnglish } from './text';

export interface IdeaInput { text: string; packs: PackSet }

const ORDER: NicheId[] = ['cafe', 'barbershop', 'bodega', 'guesthouse', 'rentals'];
const NAMES: Record<NicheId, string> = { cafe: 'Coffee shop', barbershop: 'Barbershop', bodega: 'Corner store', guesthouse: 'Guesthouse', rentals: 'Apartment rentals' };

const KEYWORDS: Record<NicheId, RegExp> = {
  cafe: /\b(coffee|caf[eé]s?|espresso|latte|cappuccino|tea|matcha|boba|bubble tea|bakery|bakeries|pastr(y|ies)|bagels?|donuts?|doughnuts?|juice|smoothies?|brunch|breakfast|sandwich(es)?|dessert|ice cream|food truck|restaurant|diner|food|kitchen|eatery|snack bar)\b|кофе|кафе|эспрессо|латте|пекарн|выпечк|чай|завтрак|десерт|бранч/gi,
  barbershop: /\b(barbers?|barbershops?|haircuts?|hair|salons?|beard|shaves?|fades?|braids|stylists?|grooming|beauty|nails?|spa)\b|барбер|парикмахер|стрижк|бород|брить/gi,
  bodega: /\b(bodegas?|deli|grocer(y|ies)|convenience|corner store|mini ?market|market|produce|newsstand|general store|shop|store|retail)\b|магазин|продукт|ларёк|ларек|киоск/gi,
  guesthouse: /\b(hotels?|motels?|hostels?|guest ?house|b ?& ?b|bed and breakfast|inn|lodging|guest rooms?|airbnb)\b|отель|гостиниц|хостел|гостевой/gi,
  rentals: /\b(rent(ing)? out|rentals?|apartments?|landlord|real estate|propert(y|ies)|tenants?|lease out|buildings?)\b|аренд|квартир|недвижимост|сдавать/gi,
};

/** Closest playable niche when the matched one has no pack yet. */
const NEAREST: Record<NicheId, NicheId[]> = {
  cafe: ['bodega', 'barbershop'], barbershop: ['cafe', 'bodega'], bodega: ['cafe', 'barbershop'],
  guesthouse: ['rentals', 'cafe', 'bodega'], rentals: ['guesthouse', 'cafe', 'bodega'],
};

const CHEAP = /\b(small|tiny|cheap|budget|low[- ]cost|affordable|starter|side street|quiet|residential|modest|simple)\b/gi;
const PRIME = /\b(premium|luxury|upscale|fancy|high[- ]end|flagship|busy|prime|downtown|midtown|soho|times square|tourist|main street|big|large)\b/gi;
const TRANSIT = /\b(subway|station|metro|train|transit|commuters?)\b/gi;

const count = (re: RegExp, s: string) => (s.match(re) ?? []).length;

/** Words that decide the niche on their own count double. */
const STRONG: Record<NicheId, RegExp> = {
  cafe: /\b(coffee|caf[eé]s?|espresso|bakery|bakeries)\b/gi,
  barbershop: /\b(barbers?|barbershops?|haircuts?|salons?)\b/gi,
  bodega: /\b(bodegas?|deli|grocer(y|ies)|convenience|corner store)\b/gi,
  guesthouse: /\b(hotels?|hostels?|guest ?house|b ?& ?b|bed and breakfast|inn)\b/gi,
  rentals: /\b(apartments?|rentals?|landlord|real estate)\b/gi,
};

export function scoreNiches(text: string): Record<NicheId, number> {
  // "bed and breakfast" is a guesthouse, not a breakfast place.
  const forOthers = text.replace(/\bbed and breakfast\b|\bb ?& ?b\b/gi, ' ');
  const out = {} as Record<NicheId, number>;
  for (const n of ORDER) {
    const t = n === 'guesthouse' ? text : forOthers;
    out[n] = count(KEYWORDS[n], t) + count(STRONG[n], t);
  }
  return out;
}

export function tierOf(text: string): PlaceTier {
  const s = count(PRIME, text) + count(TRANSIT, text) - count(CHEAP, text);
  return s > 0 ? 'prime' : s < 0 ? 'cheap' : 'mid';
}

function kitOf(text: string, pack: Pack): Pack['kits'][number]['id'] {
  const want = count(/\b(premium|luxury|upscale|fancy|high[- ]end|big|large|flagship)\b/gi, text) > 0 ? 'premium'
    : count(CHEAP, text) > 0 ? 'lean' : 'standard';
  return pack.kits.some(k => k.id === want) ? want : (pack.kits[0]?.id ?? 'standard');
}

const ADJ: [RegExp, string[]][] = [
  [/\bvegan|plant/i, ['Green', 'Leaf', 'Sprout']], [/\borganic|farm/i, ['Root', 'Field']], [/\bsubway|station|train/i, ['Platform', 'Station']],
  [/\bcorner\b/i, ['Corner']], [/\bfamily|kids?\b/i, ['Family']], [/\bsmall|tiny|little\b/i, ['Little']], [/\bmorning|breakfast\b/i, ['Sunrise']],
  [/\bbrooklyn\b/i, ['Brooklyn']], [/\bqueens\b/i, ['Queens']], [/\bharlem\b/i, ['Harlem']], [/\bcozy|warm\b/i, ['Hearth']],
];
const DEFAULT_ADJ = ['Bright', 'Daily', 'Golden', 'Hudson', 'Union', 'Bluebird', 'Main Street', 'Good Day'];
const NOUN: Record<NicheId, string[]> = {
  cafe: ['Coffee', 'Cafe', 'Coffee Bar', 'Espresso'], barbershop: ['Barbers', 'Barber Co.', 'Cuts'],
  bodega: ['Market', 'Deli', 'Corner Store'], guesthouse: ['Inn', 'Guest House'], rentals: ['Rentals', 'Homes'],
};

export function nameFor(text: string, niche: NicheId): string {
  const h = hash32(text.toLowerCase().trim());
  const hit = ADJ.find(([re]) => re.test(text));
  const adjs = hit ? hit[1] : DEFAULT_ADJ;
  const nouns = NOUN[niche];
  return `${adjs[h % adjs.length]} ${nouns[(h >>> 8) % nouns.length]}`;
}

function kitCost(pack: Pack, kitId: string): number {
  const kit = pack.kits.find(k => k.id === kitId);
  if (!kit) return 0;
  return kit.items.reduce((s, it) => {
    const item = pack.setup.find(x => x.id === it.id);
    if (!item) return s;
    return s + item.cost * (item.scalesWithSize ? kit.size : it.qty);
  }, 0) + pack.setup.filter(x => x.scalesWithSize && x.required && !kit.items.some(i => i.id === x.id)).reduce((s, x) => s + x.cost * kit.size, 0);
}

function rulesMatch(input: IdeaInput): IdeaMatch {
  const text = input.text.slice(0, 600);
  const playable = ORDER.filter(n => input.packs.niches[n]);
  const scores = scoreNiches(text);
  const best = ORDER.reduce((a, b) => (scores[b] > scores[a] ? b : a), ORDER[0]);
  const unknown = scores[best] === 0;
  const notes: string[] = [];
  let niche: NicheId = unknown ? (playable[0] ?? 'cafe') : best;
  if (!input.packs.niches[niche]) {
    const near = NEAREST[niche].find(n => input.packs.niches[n]) ?? playable[0] ?? 'cafe';
    notes.push(`${NAMES[niche]} isn't playable in this city yet; the closest open option is the ${(input.packs.niches[near]?.name ?? NAMES[near]).toLowerCase()}.`);
    niche = near;
  }
  if (unknown) notes.push(`We couldn't tell the type of business, so we started you with the ${(input.packs.niches[niche]?.name ?? NAMES[niche]).toLowerCase()}.`);
  const pack = input.packs.niches[niche];
  const tier = tierOf(text);
  const kitId = pack ? kitOf(text, pack) : 'standard';
  if (/\bvegan|plant[- ]based|organic|gluten/i.test(text)) notes.push('Specialty menus like vegan or organic usually cost more per order; the game uses standard ingredient costs, so price a little higher.');
  if (count(TRANSIT, text) > 0) notes.push('Near a subway means more people walking by and higher rent; compare places by their foot traffic on the map.');
  if (pack && notes.length < 3) {
    const kit = pack.kits.find(k => k.id === kitId);
    const cost = kitCost(pack, kitId);
    if (kit && cost > 0) notes.push(`The ${kit.name} kit (${kit.size} ${pack.sizing.unitName}s) costs about ${money(cost)} of your ${money(pack.startCapital)} start.`);
    else if (kit) notes.push(`${kit.name}: ${kit.pitch}`);
  }
  if (notes.length === 0) notes.push(`A ${tier} place fits this idea; you can change it on the map.`);
  return { niche, businessName: nameFor(text, niche), tier, kitId, notes: notes.slice(0, 3), origin: 'rules' };
}

const IdeaSchema = z.object({
  niche: z.enum(['cafe', 'barbershop', 'bodega', 'guesthouse', 'rentals']),
  businessName: z.string(),
  tier: z.enum(['prime', 'mid', 'cheap']),
  kitId: z.enum(['lean', 'standard', 'premium']),
  notes: z.array(z.string()),
});

export const IDEA_SYSTEM = [
  'You help a player of First Year, a New York City small business simulation, turn a business idea into a starting setup.',
  'Pick the closest niche. Only niches marked playable can be opened; if the idea fits a niche that is not playable, pick the closest playable one and explain that in a note.',
  'Suggest a short, friendly business name (at most 30 characters), a place tier (prime: busy and expensive, mid: average, cheap: quiet and affordable) and one of the kits of that niche.',
  'Write two or three notes in plain American English, each one sentence under 140 characters, about what this idea changes in practice. Mark any rough number with "about".',
].join('\n');

export async function interpretIdea(input: IdeaInput): Promise<IdeaMatch> {
  try {
    const fallback = rulesMatch(input);
    const text = input.text.trim();
    if (text.length < 3) return fallback;
    const playable = ORDER.filter(n => input.packs.niches[n]);
    const prompt = JSON.stringify({
      idea: text.slice(0, 600),
      niches: ORDER.map(n => {
        const p = input.packs.niches[n];
        return { id: n, name: p?.name ?? NAMES[n], playable: !!p, ...(p ? { tagline: p.tagline, startCapital: p.startCapital, kits: p.kits.map(k => ({ id: k.id, name: k.name, size: k.size, pitch: k.pitch })) } : {}) };
      }),
    });
    const ai = await callAi({ task: 'idea', system: IDEA_SYSTEM, prompt, schema: IdeaSchema, maxTokens: 1000 }, out => {
      const notes = out.notes.map(n => n.trim()).filter(Boolean);
      const name = out.businessName.trim();
      if (name.length < 2 || name.length > 40 || !plainEnglish(name) || BANNED.test(name)) return { ok: false, reason: 'bad name' };
      if (notes.length < 1 || notes.length > 3 || notes.some(n => n.length > 160 || !plainEnglish(n) || BANNED.test(n))) return { ok: false, reason: 'bad notes' };
      let niche = out.niche;
      if (!input.packs.niches[niche]) {
        const near = NEAREST[niche].find(n => input.packs.niches[n]) ?? playable[0];
        if (!near) return { ok: false, reason: 'no playable niche' };
        notes.unshift(`${NAMES[niche]} isn't playable in this city yet; the closest open option is the ${(input.packs.niches[near]?.name ?? NAMES[near]).toLowerCase()}.`);
        niche = near;
      }
      const pack = input.packs.niches[niche]!;
      const kitId = pack.kits.some(k => k.id === out.kitId) ? out.kitId : kitOf(text, pack);
      return { ok: true, value: { niche, businessName: name, tier: out.tier, kitId, notes: notes.slice(0, 3), origin: 'ai' as const } };
    });
    return ai ?? fallback;
  } catch {
    const niche = (ORDER.find(n => input.packs?.niches?.[n]) ?? 'cafe') as NicheId;
    return { niche, businessName: nameFor(input.text ?? '', niche), tier: 'mid', kitId: 'standard', notes: ['Pick a place on the map to start.'], origin: 'rules' };
  }
}
