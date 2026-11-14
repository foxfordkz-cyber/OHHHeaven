// What a future owner needs to know about one storefront before signing the lease, as plain data.
// Every number comes from data/places.json, the niche pack or shared/src/place.ts (the same functions the engine charges
// with); nothing is invented here. Where the engine's own share of passers-by is an estimate, the result says so.
import type { NicheId, Pack, PackKit, Place, PublicBusiness } from '@ohh/shared/types';
import {
  anchorEffects, baselineOrdersDay, buildoutOf, daysToOpenOf, distanceM, footfallParams, isTakeover, openingCost,
  overlap, rentMonthOf, rivalsOf, type Buildout,
} from '@ohh/shared/place';
import { NICHE_META, USABLE_FLOOR_SHARE } from './geo';

/** Shops closer than this share the same passers-by when the pack has no footfall block (pack value wins). */
export const DEFAULT_RIVAL_RADIUS_M = 250;

const FORMER_USE_LABEL: Record<NonNullable<Place['formerUse']>, string> = {
  cafe: 'a café', food: 'a food shop or restaurant', retail: 'a store', salon: 'a salon',
};

export interface PlayingRival { id: string; name: string; isAi: boolean; status: PublicBusiness['status']; distM: number; overlap: number; rank: number }

export interface PassersSplit {
  /** Weights of everyone who sells to the same passers-by; `you` is one average, fully known shop. */
  you: number; real: number; players: number; outside: number;
  /** Share of the buying passers-by an average shop here would get (0–1). */
  yourShare: number;
}

export interface PlaceFacts {
  passersBy: number | null;
  passersNote?: string;
  rentMonth: number;
  /** What the room was before and what that does to the build-out (null when the pack has no build-out rules). */
  former: { label: string; build: Buildout; takeover: boolean; askingPrice?: number } | null;
  /** Cheapest kit of the pack at this place: what the Place step calls "opens from". */
  opening: { kitName: string; cost: number; days: number } | null;
  radiusM: number;
  realRivals: { within150m: number; nearest: { name: string; distM: number }[] } | null;
  playingRivals: PlayingRival[];
  split: PassersSplit | null;
  /** Orders a day for an average shop at the reference price, counting real and playing rivals (estimate). */
  ordersDay: number | null;
  /** The same without playing rivals: what the place promised before anyone in the game opened next to it. */
  ordersDayAlone: number | null;
  refPrice: number;
  neighbours: ReturnType<typeof anchorEffects>;
  taken: boolean;
}

const LIVE: PublicBusiness['status'][] = ['setup', 'open', 'closed'];

/** Businesses of the same niche in the game that split this place's passers-by, nearest first. */
export function playingRivalsNear(place: Place, niche: NicheId, businesses: PublicBusiness[], places: Place[], radiusM = DEFAULT_RIVAL_RADIUS_M, exceptId?: string): PlayingRival[] {
  const byId = new Map(places.map((p) => [p.id, p]));
  const out: PlayingRival[] = [];
  for (const b of businesses) {
    if (b.niche !== niche || b.id === exceptId || b.placeId === place.id || !LIVE.includes(b.status)) continue;
    const at = byId.get(b.placeId);
    if (!at) continue;
    const d = distanceM(at, place);
    if (d >= radiusM) continue;
    out.push({ id: b.id, name: b.name, isAi: b.isAi, status: b.status, distM: Math.round(d), overlap: overlap(d, radiusM), rank: b.rankInNiche });
  }
  return out.sort((a, b) => a.distM - b.distM);
}

/** Size units of this niche that fit the room (engine rule: usable share of the floor ÷ sq ft per unit, capped by the pack). */
export function unitsFit(place: Place, pack: Pack): number {
  const units = Math.floor((place.sqft * USABLE_FLOOR_SHARE) / pack.sizing.sqftPerUnit);
  return Math.max(1, Math.min(units, pack.sizing.max));
}

function cheapestKit(pack: Pack, place: Place): { kit: PackKit; cost: number } | null {
  const max = unitsFit(place, pack);
  let best: { kit: PackKit; cost: number } | null = null;
  for (const kit of pack.kits) {
    const cost = openingCost(pack, kit.items, Math.min(kit.size, max), place);
    if (!best || cost < best.cost) best = { kit, cost };
  }
  return best;
}

export function placeFacts(place: Place, pack: Pack | undefined, businesses: PublicBusiness[], places: Place[], opts: { exceptBusinessId?: string; taken?: boolean } = {}): PlaceFacts {
  const f = pack ? footfallParams(pack) : null;
  const radiusM = f?.radiusM ?? DEFAULT_RIVAL_RADIUS_M;
  const niche = pack?.id ?? place.suitableFor[0];
  const playing = niche ? playingRivalsNear(place, niche, businesses, places, radiusM, opts.exceptBusinessId) : [];
  const r = niche ? rivalsOf(place, niche) : undefined;

  let former: PlaceFacts['former'] = null;
  let opening: PlaceFacts['opening'] = null;
  if (pack) {
    const build = buildoutOf(pack, place);
    if (build && place.formerUse) {
      const takeover = isTakeover(pack, place);
      former = {
        label: takeover ? `a working ${NICHE_META[pack.id].label.toLowerCase()} for sale` : FORMER_USE_LABEL[place.formerUse],
        build, takeover, askingPrice: takeover ? place.forSale?.askingPrice : undefined,
      };
    }
    const k = cheapestKit(pack, place);
    if (k) opening = { kitName: k.kit.name, cost: Math.round(k.cost), days: daysToOpenOf(pack, k.kit.items, place) };
  }

  let split: PassersSplit | null = null;
  let ordersDay: number | null = null;
  let ordersDayAlone: number | null = null;
  if (pack && f && place.pedestriansPerDay) {
    const real = (r?.weight ?? 0) * f.staticWeight;
    // a playing rival counted as an average, fully known shop (strength 1): an estimate, its price and reputation move it
    const players = playing.filter((p) => p.status === 'open').reduce((s, p) => s + p.overlap, 0);
    const total = 1 + real + players + f.outside;
    split = { you: 1, real, players, outside: f.outside, yourShare: 1 / total };
    ordersDay = place.pedestriansPerDay * f.captureRate * (1 + f.outside) * split.yourShare;
    ordersDayAlone = baselineOrdersDay(pack, place);
  }

  return {
    passersBy: place.pedestriansPerDay ?? null,
    passersNote: place.footfallNote,
    rentMonth: Math.round(rentMonthOf(place)),
    former, opening, radiusM,
    realRivals: r ? { within150m: r.within150m, nearest: r.nearest.slice(0, 3) } : null,
    playingRivals: playing,
    split, ordersDay, ordersDayAlone,
    refPrice: pack?.unit.refPrice ?? 0,
    neighbours: anchorEffects(place),
    taken: !!opts.taken,
  };
}

/** Sales a month at the reference price for `ordersDay` (30-day month, before costs). */
export const monthlySales = (ordersDay: number, price: number): number => Math.round(ordersDay * price * 30);

export type Tr = (en: string, ru: string) => string;
const EN: Tr = (en) => en;

/** "60 days" → "about 2 months" for the headline; days stay exact in the detail line. */
export function daysLabel(days: number, tr: Tr = EN): string {
  if (days <= 0) return tr('right away', 'сразу');
  if (days < 45) return tr(`${days} days`, `${days} дн.`);
  const months = Math.round(days / 30);
  return tr(`about ${months} month${months === 1 ? '' : 's'}`, `около ${months} мес.`);
}

/** One line per playing rival: what they mean for this storefront. */
export function rivalMeaning(r: PlayingRival, tr: Tr = EN): string {
  const pct = Math.round(r.overlap * 100);
  if (r.status === 'setup') return tr(`opening ${r.distM} m away: will take part of the same passers-by (overlap ${pct}%)`, `открывается в ${r.distM} м: заберёт часть тех же прохожих (пересечение ${pct}%)`);
  if (r.status === 'closed') return tr(`${r.distM} m away, closed by the city for now: its regulars are looking for coffee`, `в ${r.distM} м, сейчас закрыт городом: его постоянные ищут кофе`);
  return tr(`${r.distM} m away: shares the same passers-by (overlap ${pct}%)`, `в ${r.distM} м: делит тех же прохожих (пересечение ${pct}%)`);
}

/**
 * The stake that makes the place worth a look tomorrow: a rival about to open, or the plain fact that the city is live
 * and anyone can sign this lease first. Only facts from the view; no countdown is invented.
 */
export function placeStake(f: PlaceFacts, tr: Tr = EN): string {
  if (f.taken) return tr('Someone signed this lease already. It frees up only if that business goes bankrupt.', 'Аренду уже подписали. Место освободится, только если этот бизнес разорится.');
  const opening = f.playingRivals.find((r) => r.status === 'setup');
  if (opening && f.split && f.ordersDay != null) {
    const total = 1 / f.split.yourShare;
    const withThem = (f.ordersDay * total) / (total + opening.overlap);
    return tr(
      `${opening.name} is getting ready ${opening.distM} m away. Once it opens, an average shop here drops from about ${Math.round(f.ordersDay)} to ${Math.round(withThem)} orders a day.`,
      `${opening.name} готовится к открытию в ${opening.distM} м. Когда откроется, у средней кофейни здесь будет не около ${Math.round(f.ordersDay)}, а ${Math.round(withThem)} заказов в день.`,
    );
  }
  const closed = f.playingRivals.find((r) => r.status === 'closed');
  if (closed) return tr(`${closed.name} next door is closed by the city right now: its customers walk past this door.`, `${closed.name} рядом сейчас закрыт городом: его гости ходят мимо этой двери.`);
  return tr('Free today. The city is live: any owner can sign this lease before you.', 'Сегодня свободно. Город живой: любой владелец может подписать аренду раньше тебя.');
}

export interface VersusMe {
  sameNiche: boolean;
  distM: number | null;
  /** Share of the same passers-by both shops reach (0 beyond the radius). */
  overlap: number;
  priceGap: number;      // their price − mine
  rankGap: number;       // their rank − mine (negative: they are above me)
  line: string;
}

/** A business on the live map seen from my own: how close, how much of my passers-by, cheaper or dearer, above or below. */
export function versusMe(them: PublicBusiness, me: PublicBusiness, places: Place[], radiusM = DEFAULT_RIVAL_RADIUS_M, tr: Tr = EN): VersusMe {
  const byId = new Map(places.map((p) => [p.id, p]));
  const a = byId.get(them.placeId), b = byId.get(me.placeId);
  const distM = a && b ? Math.round(distanceM(a, b)) : null;
  const sameNiche = them.niche === me.niche;
  const ov = sameNiche && distM != null ? overlap(distM, radiusM) : 0;
  const priceGap = Math.round((them.price - me.price) * 100) / 100;
  const rankGap = them.rankInNiche - me.rankInNiche;
  let line: string;
  if (!sameNiche) {
    line = tr('Another trade: not a rival. A deal with them can bring you their customers.', 'Другое дело: не соперник. Сделка с ними может привести их гостей к тебе.');
  } else {
    const where = distM == null ? '' : ov > 0
      ? tr(`${distM} m from you, sharing about ${Math.round(ov * 100)}% of your passers-by`, `в ${distM} м от тебя, делит около ${Math.round(ov * 100)}% твоих прохожих`)
      : tr(`${distM} m from you, too far to share your passers-by`, `в ${distM} м от тебя, слишком далеко, чтобы делить прохожих`);
    const price = Math.abs(priceGap) < 0.01 ? tr('same price as you', 'та же цена, что у тебя')
      : priceGap < 0 ? tr(`$${Math.abs(priceGap).toFixed(2)} cheaper than you`, `дешевле тебя на $${Math.abs(priceGap).toFixed(2)}`)
        : tr(`$${priceGap.toFixed(2)} dearer than you`, `дороже тебя на $${priceGap.toFixed(2)}`);
    const rank = rankGap === 0 || !them.rankInNiche || !me.rankInNiche ? ''
      : rankGap < 0 ? tr(` · ${-rankGap} place${rankGap === -1 ? '' : 's'} above you`, ` · выше тебя на ${-rankGap}`)
        : tr(` · ${rankGap} place${rankGap === 1 ? '' : 's'} below you`, ` · ниже тебя на ${rankGap}`);
    line = `${where ? `${where}; ` : ''}${price}${rank}.`;
  }
  return { sameNiche, distM, overlap: ov, priceGap, rankGap, line: line.charAt(0).toUpperCase() + line.slice(1) };
}
