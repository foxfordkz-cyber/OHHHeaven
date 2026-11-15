// Rivals and prizes in plain sight (task B18). Pure helpers: no React, no network, no Date, no randomness.
// Who my main rival is, where I stand in my niche and how far the prize is, what changed next door and what it
// means for me, and the two moves I can make with any neighbor. Every number comes from OwnerView, the packs or RULES.
import type { BusinessState, Deal, FeedItem, NicheId, OwnerView, PackSet, Place, PublicBusiness } from '../../../../shared/src/types';
import { RULES } from '../../../../shared/src/rules';
import { nicheBoard, type BoardRow } from '../end/prizes';
import {
  CROSS_PROMO_MAX_METERS, dealAvailability, dealEffect, defaultTerms, distanceBetween, falseReports, formatDistance,
  KIND_NAME, money, monthBase, myReports, NICHE_LABEL, pct, reportEligibility, reportLimit, reportOptions,
  type DealKind, type MyReport, type NetworkExtra,
} from './logic';

type View = OwnerView & { extra?: Partial<NetworkExtra>; myReports?: MyReport[] };

// ───────────── shared foot traffic ─────────────

/**
 * Cafes closer than this split one stream of pedestrians (engine/src/economy/demand.ts, footfallDemand, overlap by
 * pack.extra.footfall.radiusM). The pack value wins; 250 m is the value in packs/cafe.json on 14 Nov 2026.
 */
export const FOOTFALL_RADIUS_FALLBACK_M = 250;

export function footfallRadius(packs: PackSet | null, niche: NicheId | undefined): number {
  const extra = niche ? packs?.niches[niche]?.extra : undefined;
  const ff = extra && typeof extra === 'object' ? (extra as { footfall?: { radiusM?: unknown } }).footfall : undefined;
  const r = ff && typeof ff.radiusM === 'number' ? ff.radiusM : NaN;
  return Number.isFinite(r) && r > 0 ? r : FOOTFALL_RADIUS_FALLBACK_M;
}

const alive = (b: Pick<PublicBusiness, 'status'>) => b.status !== 'bankrupt';

// ───────────── the ladder ─────────────

export interface LadderRow { businessId: string; rank: number; name: string; owner: string; isAi: boolean; mine: boolean; netWorth: number; prize: number | null }

export interface Ladder {
  niche: NicheId;
  /** Businesses of my niche in the table (top 20 plus me) and in the city. */
  total: number;
  me: LadderRow | null;
  above: LadderRow | null;
  below: LadderRow | null;
  /** The last row that would win a prize today, when it is not me. */
  cutoff: LadderRow | null;
  /** The nearest person below me: the one who can take my prize place (AI never takes prizes). */
  chaser: LadderRow | null;
  /** Net worth I need to pass the cutoff; 0 when I would win a prize today; null when nobody can win yet. */
  toPrize: number | null;
  /** Prize fund of the niche today (bank × prize share, split by human owners). */
  pool: number;
  /** Prize places of a niche (config.nichePrizeTable). */
  prizePlaces: number;
}

const toRow = (r: BoardRow): LadderRow => ({ businessId: r.businessId, rank: r.rank, name: r.name, owner: r.owner, isAi: r.isAi, mine: r.mine, netWorth: r.netWorth, prize: r.prize });

/** My niche's table as the prize screen sees it (client/src/screens/end/prizes.ts), cut down to what matters to me. */
export function ladderOf(view: OwnerView): Ladder | null {
  const me = view.business;
  if (!me) return null;
  const board = nicheBoard(view, me.niche);
  const rows = board.rows.filter((r) => !r.bankrupt);
  const i = rows.findIndex((r) => r.mine);
  const mine = i >= 0 ? toRow(rows[i]) : null;
  const winners = rows.filter((r) => r.prize !== null && !r.isAi);
  const iWin = Boolean(mine && mine.prize !== null);
  const last = winners.length ? winners[winners.length - 1] : null;
  const cutoff = !iWin && last && !last.mine ? toRow(last) : null;
  const cityCount = view.neighbors.filter((n) => n.id !== me.id && n.niche === me.niche && alive(n)).length + (alive(me) ? 1 : 0);
  return {
    niche: me.niche,
    total: Math.max(rows.length, cityCount),
    me: mine,
    above: i > 0 ? toRow(rows[i - 1]) : null,
    below: i >= 0 && i < rows.length - 1 ? toRow(rows[i + 1]) : null,
    cutoff,
    chaser: i >= 0 ? (rows.slice(i + 1).find((r) => !r.isAi) ? toRow(rows.slice(i + 1).find((r) => !r.isAi)!) : null) : null,
    toPrize: iWin ? 0 : cutoff && mine ? round2(Math.max(0, cutoff.netWorth - mine.netWorth)) : null,
    pool: board.pool,
    prizePlaces: view.world.config.nichePrizeTable.length,
  };
}

/** First day of next month: the month close moves net worth the most, and with it the table and the prize. */
export function nextMonthCloseDay(view: Pick<OwnerView, 'world'>): number {
  return view.world.date.month * RULES.DAYS_PER_MONTH + 1;
}

/**
 * Real time until the month closes: the tick that ends the last day of this month. A live game day is 48 minutes, so
 * a game month is a real day — the month close is the reason to come back tomorrow. null while the city is paused.
 */
export function msToMonthClose(view: Pick<OwnerView, 'world'>): number | null {
  const w = view.world;
  if (w.config.paused || !(w.config.dayMs > 0)) return null;
  const lastDay = w.date.month * RULES.DAYS_PER_MONTH;
  return Math.max(0, w.msToNextDay + Math.max(0, lastDay - w.day) * w.config.dayMs);
}

/** One line under the ladder: why today's place matters and what to do about it. */
export function ladderLine(l: Ladder): string {
  if (!l.me) return 'You are not in the table yet: it counts net worth once your doors are open.';
  if (l.toPrize === 0) {
    const chaser = l.chaser ? ` ${l.chaser.name} is ${money(l.me.netWorth - l.chaser.netWorth)} behind you and can take it.` : '';
    const ai = l.above?.isAi ? ' AI businesses above you never take prizes.' : '';
    return `You are in the prize places today.${ai}${chaser}`;
  }
  if (l.cutoff && l.toPrize !== null) return `${money(l.toPrize)} more net worth and you pass ${l.cutoff.name} into the prize places.`;
  return `Only owners who are people win prizes: top ${l.prizePlaces} of the niche at the end of the season.`;
}

// ───────────── the main rival ─────────────

export interface Rival {
  biz: PublicBusiness;
  distanceM: number | null;
  /** They split my foot traffic (same niche, closer than the footfall radius). */
  sharesStreet: boolean;
  /** Their net worth minus mine; null when one of us is not in the table. */
  gap: number | null;
  rank: number | null;
  why: string;
}

/**
 * The one business to watch. First the nearest open business of my niche that splits my foot traffic (every guest
 * it wins is one I lose); else the one right above me in the table (the place I can take); else the one right below.
 */
export function mainRival(view: OwnerView, places: Place[], packs: PackSet | null, ladder: Ladder | null = ladderOf(view)): Rival | null {
  const me = view.business;
  if (!me) return null;
  const radius = footfallRadius(packs, me.niche);
  const mineNw = ladder?.me?.netWorth;
  const rowOf = (id: string) => (ladder && [ladder.above, ladder.below, ladder.cutoff].find((r) => r?.businessId === id)) || null;
  const standing = (id: string) => (view.leaderboards[me.niche] ?? []).find((s) => s.businessId === id);
  const build = (biz: PublicBusiness, why: string): Rival => {
    const distanceM = distanceBetween(places, me.placeId, biz.placeId);
    const s = standing(biz.id);
    const nw = rowOf(biz.id)?.netWorth ?? s?.netWorth;
    return {
      biz, distanceM, sharesStreet: distanceM !== null && distanceM <= radius,
      gap: nw !== undefined && mineNw !== undefined ? round2(nw - mineNw) : null,
      rank: s?.rank ?? (biz.rankInNiche > 0 ? biz.rankInNiche : null), why,
    };
  };
  const sameNiche = view.neighbors.filter((n) => n.id !== me.id && n.niche === me.niche && alive(n));
  const street = sameNiche
    .map((biz) => ({ biz, d: distanceBetween(places, me.placeId, biz.placeId) }))
    .filter((x) => x.d !== null && x.d <= radius && x.biz.status !== 'setup')
    .sort((a, b) => a.d! - b.d! || a.biz.name.localeCompare(b.biz.name));
  if (street.length) {
    const { biz, d } = street[0];
    return build(biz, `${formatDistance(d)} away: you split one stream of people walking by. Every guest they win is one you lose.`);
  }
  const byId = (id: string | undefined) => (id ? view.neighbors.find((n) => n.id === id && alive(n)) : undefined);
  const up = byId(ladder?.above?.businessId);
  if (up && ladder?.above && ladder.me) {
    return build(up, `Right above you in the table, ${money(ladder.above.netWorth - ladder.me.netWorth)} ahead. Pass them and you take #${ladder.above.rank}.`);
  }
  const down = byId(ladder?.below?.businessId);
  if (down && ladder?.below && ladder.me) {
    return build(down, `Right behind you in the table, ${money(ladder.me.netWorth - ladder.below.netWorth)} back. Slip and they take your place.`);
  }
  if (sameNiche.length) {
    const near = sameNiche
      .map((biz) => ({ biz, d: distanceBetween(places, me.placeId, biz.placeId) }))
      .sort((a, b) => (a.d ?? Infinity) - (b.d ?? Infinity) || a.biz.name.localeCompare(b.biz.name))[0];
    return build(near.biz, `The nearest ${NICHE_LABEL[me.niche].toLowerCase()}, ${formatDistance(near.d)} away.`);
  }
  return null;
}

// ───────────── two moves with any neighbor ─────────────

export interface TeamUpMove { allowed: boolean; kind: DealKind | null; title: string; name: string; value: string; reason?: string }

/** Deal kinds in the order they suit a neighbor: same trade buys together, a different trade nearby swaps customers. */
const TEAM_UP_ORDER: DealKind[] = ['joint_purchase', 'cross_promo', 'loan'];

/** «Team up»: the best deal I can offer this neighbor right now and what it gives me a month, at default terms. */
export function teamUpMove(view: OwnerView, target: PublicBusiness, distanceM: number | null): TeamUpMove {
  const me = view.business;
  const avail = dealAvailability({ me, target, deals: view.deals, distanceM });
  const kind = TEAM_UP_ORDER.find((k) => avail[k].allowed) ?? null;
  if (!kind || !me) {
    const reason = avail[TEAM_UP_ORDER[0]].reason ?? avail.cross_promo.reason ?? 'No deal fits right now';
    return { allowed: false, kind: null, title: 'Team up', name: '', value: reason, reason };
  }
  const effect = dealEffect(defaultTerms(kind, me), 'from', monthBase(me, view.analytics));
  let value: string;
  if (kind === 'joint_purchase') value = effect.monthly !== null ? `${money(effect.monthly, { signed: true })}/mo for you: ingredients −${pct(1 - RULES.JOINT_PURCHASE_COGS_MULT)}` : `Ingredients −${pct(1 - RULES.JOINT_PURCHASE_COGS_MULT)} for both`;
  else if (kind === 'cross_promo') value = effect.monthly !== null ? `${money(effect.monthly, { signed: true })}/mo for you: +${pct(RULES.CROSS_PROMO_DEMAND_MULT - 1)} guests` : `+${pct(RULES.CROSS_PROMO_DEMAND_MULT - 1)} guests for both`;
  else value = effect.lines[0] ?? 'Lend them cash at interest';
  return { allowed: true, kind, title: `Team up: ${KIND_NAME[kind].toLowerCase()}`, name: KIND_NAME[kind], value };
}

export interface ReportMove { allowed: boolean; reason?: string; ifRight: string; ifWrong: string }

/** Fine of one violation as the law states it: the base, else the monthly fine. */
const fineOf = (v: { fine: { base?: number; perMonth?: number } }): number => v.fine.base ?? v.fine.perMonth ?? 0;

/** «Report»: what happens to them if I am right, and to me if I am wrong. Fines and closures come from the packs. */
export function reportMove(view: View, packs: PackSet | null, target: PublicBusiness): ReportMove {
  const eligibility = reportEligibility(view.business, target, reportLimit(view));
  const options = reportOptions(packs, target.niche);
  const violations = packs ? [...(packs.niches[target.niche]?.violations ?? []), ...packs.common.violations] : [];
  const checked = new Set(options.flatMap((r) => r.checks));
  const found = violations.filter((v) => checked.has(v.id));
  const fines = found.map(fineOf).filter((f) => f > 0);
  const closure = Math.max(0, ...found.map((v) => v.closureDays ?? 0));
  const fineText = fines.length ? (Math.min(...fines) === Math.max(...fines) ? money(fines[0]) : `${money(Math.min(...fines))}–${money(Math.max(...fines))}`) : 'the fine the law sets';
  const ifRight = `If you are right: they pay ${fineText}${closure > 0 ? ` and can be closed for up to ${closure} days` : ''}. Your name stays hidden.`;
  const warned = falseReports(myReports(view)) > 0;
  const ifWrong = warned
    ? `If you are wrong: you pay ${money(RULES.FALSE_REPORT_FINE)} and ${target.name} learns your name.`
    : `If you are wrong: a warning. The next false report costs ${money(RULES.FALSE_REPORT_FINE)} and your name.`;
  return { allowed: eligibility.allowed, reason: eligibility.reason, ifRight, ifWrong };
}

// ───────────── the neighbors' feed, with what it means for me ─────────────

export type NewsTone = 'good' | 'bad' | 'info';
export interface RivalNews { id: string; day: number; text: string; meaning: string; tone: NewsTone; businessId?: string; count?: number; icon: 'store' | 'badge' | 'flag' | 'alert' | 'handshake' | 'money' | 'trophy' }

interface Ctx { me: BusinessState; places: Place[]; radius: number; byId: Map<string, PublicBusiness> }

const near = (c: Ctx, b: PublicBusiness | undefined, m: number) => {
  if (!b) return false;
  const d = distanceBetween(c.places, c.me.placeId, b.placeId);
  return d !== null && d <= m;
};

/** What one engine feed line means for my business; null — not worth my attention. Texts: engine/src/{economy,law,deals}. */
export function meaningOf(item: FeedItem, c: Ctx): Omit<RivalNews, 'id' | 'day' | 'text' | 'businessId'> | null {
  const mine = item.businessId === c.me.id;
  const b = item.businessId ? c.byId.get(item.businessId) : undefined;
  const same = b?.niche === c.me.niche;
  const street = same && near(c, b, c.radius);
  const t = item.text;
  switch (item.kind) {
    case 'opening': {
      if (mine) return null;
      if (street) return { tone: 'bad', icon: 'store', meaning: `Opens on your street, ${formatDistance(distanceBetween(c.places, c.me.placeId, b!.placeId))} away: you will split the people walking by.` };
      if (same) return { tone: 'info', icon: 'store', meaning: `A new rival in the ${NICHE_LABEL[c.me.niche].toLowerCase()} table, but not on your street.` };
      if (near(c, b, CROSS_PROMO_MAX_METERS)) return { tone: 'good', icon: 'store', meaning: 'A different trade close by: a partner for cross-promo.' };
      return null;
    }
    case 'report':
      if (mine) return { tone: 'bad', icon: 'flag', meaning: 'Someone reported you. An official will come: check permits and hygiene now.' };
      if (same || near(c, b, c.radius)) return { tone: 'info', icon: 'flag', meaning: 'An official will visit them soon. Officials on your street may look at you too.' };
      return null;
    case 'inspection': {
      if (mine) return null;
      if (!same && !near(c, b, c.radius)) return null;
      const closed = /closed for (\d+) day/.exec(t);
      if (closed) return street
        ? { tone: 'good', icon: 'badge', meaning: `Closed for ${closed[1]} days: their regulars need somewhere to go — your door is closest.` }
        : { tone: 'info', icon: 'badge', meaning: `A rival is closed for ${closed[1]} days and loses net worth.` };
      if (/reopened/.test(t)) return street ? { tone: 'bad', icon: 'badge', meaning: 'Back open: their guests come back to them.' } : null;
      if (/no violations/.test(t)) return { tone: 'info', icon: 'badge', meaning: 'Clean inspection. Reporting them now would likely be a false report.' };
      return { tone: 'info', icon: 'badge', meaning: 'Inspectors are working your street. Make sure your own permits are in order.' };
    }
    case 'bankruptcy':
      if (mine) return null;
      if (street) return { tone: 'good', icon: 'alert', meaning: 'One less cafe splitting your street: their walk-ins are yours to win.' };
      if (same) return { tone: 'good', icon: 'alert', meaning: 'One less rival in your table.' };
      if (/owing/.test(t) && b && c.me && /owing (.+) money/.exec(t)?.[1] === c.me.name) return { tone: 'bad', icon: 'alert', meaning: 'They owed you: the rest of your loan is lost.' };
      return null;
    case 'deal': {
      const involvesMe = t.includes(c.me.name);
      if (involvesMe) return null;
      if (/started a joint purchasing/.test(t) && same) return { tone: 'bad', icon: 'handshake', meaning: `They now buy ${pct(1 - RULES.JOINT_PURCHASE_COGS_MULT)} cheaper: room to cut prices against you.` };
      if (/started a cross-promo/.test(t) && (same || street)) return { tone: 'bad', icon: 'handshake', meaning: `+${pct(RULES.CROSS_PROMO_DEMAND_MULT - 1)} guests for them while it lasts.` };
      if (/broke|defaulted/.test(t) && (same || near(c, b, CROSS_PROMO_MAX_METERS))) return { tone: 'info', icon: 'handshake', meaning: 'Their deal record drops. Think twice before teaming up with them.' };
      return null;
    }
    case 'bribe':
      if (mine) return null;
      if (/fined .* for bribing/.test(t)) return { tone: 'info', icon: 'badge', meaning: 'Bribes get caught: Internal Affairs checks officials every month.' };
      return null;
    default:
      return null;
  }
}

/** The neighbors' feed for me, newest first. Block fund lines of my block are kept: they decide my foot traffic. */
export function rivalNews(view: OwnerView, places: Place[], packs: PackSet | null, limit = 12): RivalNews[] {
  const me = view.business;
  if (!me) return [];
  const c: Ctx = { me, places, radius: footfallRadius(packs, me.niche), byId: new Map(view.neighbors.map((n) => [n.id, n])) };
  const block = places.find((p) => p.id === me.placeId)?.block;
  const out: RivalNews[] = [];
  const seen = new Map<string, RivalNews>();
  for (const item of [...view.feed].sort((a, b) => b.day - a.day)) {
    // the same line about the same business (residents report the same shop again and again): one row with a count
    const same = seen.get(`${item.kind}|${item.businessId ?? ''}|${item.text}`);
    if (same) { same.count = (same.count ?? 1) + 1; continue; }
    if (!item.businessId) {
      if (item.kind === 'deal' && block && item.text.startsWith(`${block}:`)) {
        out.push({ id: item.id, day: item.day, text: item.text, tone: 'good', icon: 'handshake', meaning: 'Your block: more people walking past your door next month.' });
      }
      continue;
    }
    const m = meaningOf(item, c);
    if (!m) continue;
    const row: RivalNews = { id: item.id, day: item.day, text: item.text, businessId: item.businessId, ...m };
    seen.set(`${item.kind}|${item.businessId ?? ''}|${item.text}`, row);
    out.push(row);
  }
  return out.slice(0, limit);
}

// ───────────── what changed since I last looked (prices, places) ─────────────

/** What I saw last time: prices and places of the neighborhood on a game day. Kept by the browser, not game state. */
export interface Snapshot { day: number; prices: Record<string, number>; ranks: Record<string, number>; myRank: number | null }

export function snapshotOf(view: OwnerView): Snapshot {
  const prices: Record<string, number> = {};
  const ranks: Record<string, number> = {};
  for (const n of view.neighbors) {
    if (!alive(n)) continue;
    prices[n.id] = n.price;
    if (n.rankInNiche > 0) ranks[n.id] = n.rankInNiche;
  }
  const me = view.business;
  const s = me ? (view.leaderboards[me.niche] ?? []).find((x) => x.businessId === me.id) : undefined;
  return { day: view.world.day, prices, ranks, myRank: s?.rank ?? null };
}

/** The stored snapshot counts as «last time» only if it is from an earlier day of this season; anything else is noise. */
export function lastLook(stored: unknown, today: number): Snapshot | null {
  if (!stored || typeof stored !== 'object') return null;
  const s = stored as Partial<Snapshot>;
  if (typeof s.day !== 'number' || s.day >= today || !s.prices || typeof s.prices !== 'object') return null;
  return { day: s.day, prices: s.prices, ranks: s.ranks ?? {}, myRank: typeof s.myRank === 'number' ? s.myRank : null };
}

/** Smallest price move worth a line: 5 cents next door, 5% elsewhere (AI managers nudge prices by a cent). */
export const PRICE_STEP_STREET = 0.05;
export const PRICE_STEP_CITY = 0.05;

/** Price cuts and raises of my rivals and my own move in the table since the last game day I looked. */
export function changesSince(view: OwnerView, places: Place[], packs: PackSet | null, prev: Snapshot | null): RivalNews[] {
  const me = view.business;
  if (!me || !prev) return [];
  const radius = footfallRadius(packs, me.niche);
  const myPrice = me.orders?.price;
  const out: RivalNews[] = [];
  for (const n of view.neighbors) {
    if (n.niche !== me.niche || !alive(n)) continue;
    const was = prev.prices[n.id];
    if (was === undefined) continue;
    const d = distanceBetween(places, me.placeId, n.placeId);
    const street = d !== null && d <= radius;
    // a rival on my street: from 5 cents; anyone else in my niche: only a real move of 5% or more
    if (Math.abs(was - n.price) < (street ? PRICE_STEP_STREET : was * PRICE_STEP_CITY) - 1e-9) continue;
    const cut = n.price < was;
    const text = `${n.name} ${cut ? 'cut' : 'raised'} its price: ${money(was, { cents: true })} → ${money(n.price, { cents: true })}`;
    const vsMe = typeof myPrice === 'number' && myPrice > 0 ? n.price - myPrice : null;
    let meaning: string;
    if (cut) meaning = street
      ? `${vsMe !== null && vsMe < 0 ? `${money(-vsMe, { cents: true })} cheaper than you now. ` : ''}Price-minded guests on your street walk over. Match it or win on quality.`
      : 'A rival is chasing guests on price. Watch your table place.';
    else meaning = street
      ? `${vsMe !== null && vsMe > 0 ? `${money(vsMe, { cents: true })} above you now. ` : ''}Room for you to raise yours without losing guests to them.`
      : 'A rival is betting on margin over volume.';
    out.push({ id: `price-${n.id}-${view.world.day}`, day: view.world.day, text, meaning, tone: cut && street ? 'bad' : street ? 'good' : 'info', businessId: n.id, icon: 'money' });
  }
  const s = snapshotOf(view);
  if (prev.myRank !== null && s.myRank !== null && prev.myRank !== s.myRank) {
    const up = s.myRank < prev.myRank;
    out.unshift({
      id: `rank-${view.world.day}`, day: view.world.day, icon: 'trophy', tone: up ? 'good' : 'bad',
      text: `You ${up ? 'moved up' : 'slipped'} to #${s.myRank} in ${NICHE_LABEL[me.niche].toLowerCase()}s (was #${prev.myRank})`,
      meaning: up ? 'Your net worth passed a rival. Keep the margin to hold the place.' : 'A rival passed you in net worth. See who is right above you.',
    });
  }
  return out;
}

// ───────────── incoming: what each answer does ─────────────

export interface Choice { label: string; outcome: string }

/** Accept or decline an offer: the money for me and what happens to my record. */
export function offerChoices(deal: Deal, view: OwnerView): Choice[] {
  const effect = dealEffect(deal.terms, 'to', monthBase(view.business, view.analytics));
  return [
    { label: 'Accept', outcome: sentences([...effect.lines, 'Keep it to the end and both records show one more kept deal']) },
    { label: 'Decline', outcome: 'Nothing changes for you. Declining leaves no mark on your record.' },
  ];
}

/** Pay or contest a fine notice: the money each answer costs (engine/src/law/cases.ts settleFine). */
export function noticeChoices(fine: number, closureDays: number): Choice[] {
  const contest = round2(fine * RULES.CONTEST_FINE_MULT + RULES.CONTEST_FEE);
  const diff = round2(fine - contest);
  const closed = closureDays > 0 ? ` Closed for ${closureDays} days either way.` : '';
  return [
    { label: 'Pay', outcome: `You pay ${money(fine)} now.${closed}` },
    { label: 'Contest', outcome: `A lawyer costs ${money(RULES.CONTEST_FEE)} and the fine drops to ${money(fine * RULES.CONTEST_FINE_MULT)}: ${money(contest)} in total, ${diff >= 0 ? `${money(diff)} less` : `${money(-diff)} more`} than paying.${closed}` },
  ];
}

export interface Revealed { id: string; day: number; businessId: string; title: string; text: string }

/** How long a revealed reporter stays in «Waiting for your answer»: one game month. */
export const REVEAL_SHOW_DAYS = RULES.DAYS_PER_MONTH;

/**
 * A neighbor whose report on me turned out false twice: the engine tells me who (engine/src/law/cases.ts falseReport,
 * inbox `law:<case>:reveal`, ref to their business). Newest first, from the last game month.
 */
export function revealedReporters(view: OwnerView): Revealed[] {
  return view.me.inbox
    .filter((i) => /:reveal$/.test(i.id) && i.ref?.type === 'business' && i.day > view.world.day - REVEAL_SHOW_DAYS)
    .filter((i) => view.neighbors.some((n) => n.id === i.ref!.id && n.status !== 'bankrupt'))
    .sort((a, b) => b.day - a.day)
    .map((i) => ({ id: i.id, day: i.day, businessId: i.ref!.id, title: i.title, text: i.text }));
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Lines from dealEffect have no full stops: one paragraph of sentences. */
const sentences = (lines: string[]): string => lines.map((l) => (/[.!?]$/.test(l) ? l : `${l}.`)).join(' ');
