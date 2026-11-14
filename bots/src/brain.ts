// BotBrain — AI residents of the city (build/CONTRACT.md §7). Residents change the world only through
// Action and decide only from ownerSight / officialSight (what a human in their seat would see).
import type { Action, BusinessState, DealTerms, NicheId, OfficialRole, OpenRecommendation, Pack, Place, Player, PublicBusiness, StandingOrders, WorldState } from '../../shared/src/types';
import { RULES } from '../../shared/src/rules';
import { FIRST, LAST, businessName } from './names';
import { officialSight, ownerSight, type OwnerSight } from './observe';
import { hashStr, mulberry32, rngFor, shuffle } from './rng';
import { OFFICIAL_PROFILES, OWNER_STRATEGIES, PROFILES, officialStrategyFromName, ownerStrategyFromName, type OfficialStrategy, type OwnerProfile, type OwnerStrategy } from './strategies';
import type { EngineCtx } from './__stubs__/engine';
import { recommendOpening as stubRecommendOpening, recommendedPrice as stubRecommendedPrice } from './__stubs__/engine';

export interface PopulateEntry { name: string; kind: 'owner' | 'official'; role?: OfficialRole; niche?: NicheId; placeId?: string; strategy: string }

export interface BotBrain {
  populate(w: WorldState, ctx: EngineCtx, seed: number): PopulateEntry[];
  ownerActions(w: WorldState, ctx: EngineCtx, playerId: string): Action[];
  officialActions(w: WorldState, ctx: EngineCtx, playerId: string): Action[];
}

export interface BrainOptions {
  /** Override the character (simulator). Default: derived from the player's name. */
  strategyOf?: (p: Player) => OwnerStrategy | OfficialStrategy | undefined;
  /** Override the niche (simulator). Default: derived from the player's name. */
  nicheOf?: (p: Player) => NicheId | undefined;
  /** Agent 04's recommendOpening when available; the stub picks the pack's standard kit. */
  recommendOpening?: (niche: NicheId, placeId: string, w: WorldState, ctx: EngineCtx) => OpenRecommendation[];
  /** Price the analytics screen suggests (agent 04's recommend → set_orders.price). Default: stub Lerner-rule advice. */
  priceAdvice?: (b: BusinessState, w: WorldState, ctx: EngineCtx) => number | null;
  /** Experiment: complainers report the niche leader every week, suspicious or not. */
  harassLeader?: boolean;
  /** Days between complaints of a complainer (default 7). */
  complainEvery?: number;
  /** How many open cases an AI official takes per day (default 2). */
  officialCasesPerDay?: number;
}

const OFFICIAL_SLOTS: { role: OfficialRole; strategy: OfficialStrategy }[] = [
  { role: 'inspector', strategy: 'complaint_chaser' },
  { role: 'inspector', strategy: 'bribe_taker' },
  { role: 'tax_auditor', strategy: 'hint_hunter' },
];
const TAX_VIOLATIONS = new Set(['off_books_payroll', 'sales_tax_fraud', 'misclassification']);
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const r2 = (x: number) => Math.round(x * 100) / 100;

export function playableNiches(ctx: EngineCtx): NicheId[] {
  return (Object.keys(ctx.packs.niches) as NicheId[]).filter((n) => !!ctx.packs.niches[n]).sort();
}
export const nicheFromName = (name: string, niches: NicheId[]): NicheId => niches[hashStr(`niche:${name}`) % niches.length];

function distanceM(a: Place, b: Place): number {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const placeMap = new WeakMap<Place[], Map<string, Place>>();
function placeOf(ctx: EngineCtx, id: string): Place | undefined {
  let m = placeMap.get(ctx.places);
  if (!m) { m = new Map(ctx.places.map((p) => [p.id, p])); placeMap.set(ctx.places, m); }
  return m.get(id);
}

/** Share of the expected revenue the rent takes (lower is better). Uses only public map and pack data. */
export function rentShare(ctx: EngineCtx, niche: NicheId, p: Place, profile: OwnerProfile): number {
  const pack = ctx.packs.niches[niche];
  if (!pack) return Infinity;
  const e = Math.exp(5 * pack.market.weights.location * (p.footTraffic - 0.55));
  const demand = pack.market.unitsPerSlotMonth * (0.6 + 0.8 * p.footTraffic) * (e / (e + 0.4286));
  const seats = Math.min(pack.sizing.max, Math.floor((p.sqft * RULES.USABLE_FLOOR_SHARE) / pack.sizing.sqftPerUnit), pack.kits.find((k) => k.id === 'standard')?.size ?? pack.sizing.default);
  const capacity = (seats * pack.sizing.unitsServedPerSizeMonth) / (1 - (pack.sizing.takeawayShare ?? 0));
  const revenue = Math.min(demand, capacity) * pack.unit.refPrice * (profile.quality === 'high' ? 1.3 : 1);
  return ((p.sqft * p.rentPerSqftYear) / 12) / Math.max(1, revenue);
}

/** Rent a sensible owner accepts: at most 25% of the revenue the place can bring (30% for a premium shop). */
export const affordable =(ctx: EngineCtx, niche: NicheId, p: Place, profile: OwnerProfile): boolean =>
  rentShare(ctx, niche, p, profile) <= (profile.quality === 'high' ? 0.3 : 0.25);

/** Pick a free place: affordable ones first (by character tier, name-seeded jitter); if none, the lowest rent share. */
export function choosePlace(ctx: EngineCtx, name: string, niche: NicheId, profile: OwnerProfile, occupied: Set<string>): Place | undefined {
  const rng = rngFor('place', name);
  const want = profile.tier;
  const free = ctx.places.filter((p) => !occupied.has(p.id) && p.suitableFor.includes(niche));
  const careless = profile.price === 'fixed_random';
  const pool = careless ? free : free.filter((p) => affordable(ctx, niche, p, profile));
  if (!pool.length) return careless ? undefined : free.reduce<Place | undefined>((a, p) => (!a || rentShare(ctx, niche, p, profile) < rentShare(ctx, niche, a, profile) ? p : a), undefined);
  let best: Place | undefined, bestScore = -Infinity;
  for (const p of pool) {
    const tierScore = want === 'any' ? 0 : p.tier === want ? 2 : (want === 'mid' || p.tier === 'mid') ? 1 : 0;
    const score = tierScore + rng() * 1.5;
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return best;
}

function fixedCostsMonth(pack: Pack, place: Place, b: BusinessState): number {
  const payroll = pack.staff.reduce((s, r) => s + (b.orders.staff[r.id] ?? 0) * r.hourlyWage * r.hoursPerMonth, 0);
  const fixed = pack.monthlyCosts.filter((c) => c.basis === 'fixed').reduce((s, c) => s + c.amount, 0);
  return (place.sqft * place.rentPerSqftYear) / 12 + payroll * 1.1 + fixed;
}
function recentProfit(b: BusinessState): number {
  const h = b.history.slice(-3);
  return h.length ? h.reduce((s, m) => s + m.profit, 0) / h.length : 0;
}
const median = (xs: number[]) => { if (!xs.length) return NaN; const s = [...xs].sort((a, b) => a - b); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };

export function createBotBrain(opts: BrainOptions = {}): BotBrain {
  const ownerStrategy = (p: Player): OwnerStrategy => {
    const s = opts.strategyOf?.(p);
    return s && s in PROFILES ? (s as OwnerStrategy) : ownerStrategyFromName(p.name);
  };
  const officialStrategy = (p: Player): OfficialStrategy => {
    const s = opts.strategyOf?.(p);
    return s && s in OFFICIAL_PROFILES ? (s as OfficialStrategy) : officialStrategyFromName(p.name);
  };
  const nicheOf = (p: Player, ctx: EngineCtx): NicheId => opts.nicheOf?.(p) ?? nicheFromName(p.name, playableNiches(ctx));
  const recommend = opts.recommendOpening ?? stubRecommendOpening;

  function populate(w: WorldState, ctx: EngineCtx, seed: number): PopulateEntry[] {
    const out: PopulateEntry[] = [];
    const rng = mulberry32(seed);
    const usedNames = new Set(w.players.map((p) => p.name));
    const occupied = new Set(w.businesses.filter((b) => b.status !== 'bankrupt').map((b) => b.placeId));
    const niches = playableNiches(ctx);
    const names = shuffle(rng, FIRST.flatMap((f) => LAST.map((l) => `${f} ${l}`)));
    const takeName = (ok: (n: string) => boolean) => { const n = names.find((x) => !usedNames.has(x) && ok(x)); if (n) usedNames.add(n); return n; };
    const need = Math.max(0, w.config.aiBusinessesTarget - w.businesses.filter((b) => b.isAi && b.status !== 'bankrupt').length);
    const order = shuffle(rng, OWNER_STRATEGIES);
    for (let k = 0; k < need; k++) {
      const strategy = order[k % order.length];
      const niche = niches[k % niches.length];
      const name = takeName((n) => ownerStrategyFromName(n) === strategy && nicheFromName(n, niches) === niche);
      if (!name) break;
      const place = choosePlace(ctx, name, niche, PROFILES[strategy], occupied);
      if (!place) break;
      occupied.add(place.id);
      out.push({ name, kind: 'owner', niche, placeId: place.id, strategy });
    }
    const have = w.officials.filter((o) => o.isAi);
    const left = [...have];
    for (const slot of OFFICIAL_SLOTS) {
      const i = left.findIndex((o) => o.role === slot.role);
      if (i >= 0) { left.splice(i, 1); continue; }
      const name = takeName((n) => officialStrategyFromName(n) === slot.strategy);
      if (name) out.push({ name, kind: 'official', role: slot.role, strategy: slot.strategy });
    }
    return out;
  }

  function openingActions(w: WorldState, ctx: EngineCtx, sight: OwnerSight, strategy: OwnerStrategy): Action[] {
    if (w.day > RULES.JOIN_UNTIL_MONTH * RULES.DAYS_PER_MONTH) return [];
    const profile = PROFILES[strategy];
    const niche = nicheOf(sight.me, ctx);
    const pack = ctx.packs.niches[niche];
    if (!pack) return [];
    const occupied = new Set(w.businesses.filter((b) => b.status !== 'bankrupt').map((b) => b.placeId));
    const place = choosePlace(ctx, sight.me.name, niche, profile, occupied);
    if (!place) return [];
    const recs = recommend(niche, place.id, w, ctx);
    if (!recs.length) return [];
    const rng = rngFor('open', sight.me.name, w.config.seed);
    const rec = profile.kit === 'random' ? recs[Math.floor(rng() * recs.length)] : recs.find((r) => r.kitId === profile.kit) ?? recs[0];
    const name = businessName(niche, sight.me.name, place.block, hashStr(sight.me.name));
    const orders = initialOrders(ctx, pack, profile, rec.orders, rng);
    const acts: Action[] = [
      { type: 'open_business', niche, placeId: place.id, name, kitId: rec.kitId, size: rec.size, items: rec.items },
      { type: 'set_orders', orders },
    ];
    if (profile.launchEarly) acts.push({ type: 'launch' });
    return acts;
  }

  function ownerActions(w: WorldState, ctx: EngineCtx, playerId: string): Action[] {
    if (!w?.players || w.phase !== 'running') return [];
    const sight = ownerSight(w, playerId);
    if (!sight) return [];
    if (!sight.me.isAi && !opts.strategyOf?.(sight.me)) return []; // humans play themselves
    const strategy = ownerStrategy(sight.me);
    const profile = PROFILES[strategy];
    const phase = hashStr(playerId) % 7;
    if (profile.loginEvery > 1 && (w.day - sight.me.joinedDay) % profile.loginEvery !== 0 && sight.business) return [];
    const b = sight.business;
    if (!b) return sight.hadBusiness ? [] : openingActions(w, ctx, sight, strategy);
    const pack = ctx.packs.niches[b.niche]!;
    const place = placeOf(ctx, b.placeId)!;
    const acts: Action[] = [];
    if (b.status === 'setup') {
      if (profile.launchEarly || b.permits.every((p) => p.readyDay <= w.day)) acts.push({ type: 'launch' });
      return acts;
    }
    const rng = rngFor('day', playerId, w.day, w.config.seed);
    // 1. answers: deals and notices, the same day they are seen
    for (const d of sight.offers) acts.push({ type: 'answer_deal', dealId: d.id, accept: acceptDeal(sight, ctx, b, pack, place, d.terms, d.fromBusinessId, profile, strategy) });
    for (const n of sight.notices) acts.push(noticeAnswer(n.caseId, n.fine, b, profile));
    if (b.status !== 'open') return acts;
    // 2. weekly review of standing orders
    if (profile.reviewEvery > 0 && w.day % profile.reviewEvery === phase) {
      adviceOf = (x) => (opts.priceAdvice ?? stubRecommendedPrice)(x, w, ctx);
      const o = reviewOrders(sight, ctx, b, pack, place, profile);
      if (o) acts.push({ type: 'set_orders', orders: o });
    }
    // 3. neighbours: complaints, deals, walking out of deals
    if (profile.complains && w.day % (opts.complainEvery ?? 7) === (phase + 3) % (opts.complainEvery ?? 7)) {
      const r = complaint(sight, ctx, b, !!opts.harassLeader);
      if (r) acts.push(r);
    }
    if (profile.proposesDeals && w.day % 7 === (phase + 5) % 7) acts.push(...proposals(w, sight, ctx, b, place, strategy));
    if (profile.breaksDeals && w.day % 7 === (phase + 1) % 7) {
      for (const d of sight.myDeals) if (d.status === 'active' && d.terms.type !== 'loan' && w.day - (d.startDay ?? w.day) >= 20 && rng() < 0.5) acts.push({ type: 'cancel_deal', dealId: d.id });
    }
    return acts;
  }

  function officialActions(w: WorldState, ctx: EngineCtx, playerId: string): Action[] {
    if (!w?.players || w.phase !== 'running') return [];
    const sight = officialSight(w, playerId);
    if (!sight) return [];
    if (sight.official.exposed && (sight.official.suspendedUntilDay ?? 0) > w.day) return [];
    const prof = OFFICIAL_PROFILES[officialStrategy(sight.me)];
    const acts: Action[] = [];
    for (const c of sight.mine) {
      if (c.status !== 'bribe_offered') continue;
      const accept = prof.bribeThreshold !== null && (c.bribeAmount ?? 0) >= prof.bribeThreshold;
      acts.push({ type: 'answer_bribe', caseId: c.caseId, accept });
    }
    const cap = opts.officialCasesPerDay ?? 2;
    const rank = (o: string) => { const i = prof.priority.indexOf(o as 'report'); return i < 0 ? 9 : i; };
    const picks = sight.queue
      .filter((c) => !sight.recentTargets.has(c.business.id) && c.business.status !== 'bankrupt' && c.business.status !== 'closed')
      .sort((a, b) => rank(a.origin) - rank(b.origin) || a.openedDay - b.openedDay);
    const taken = new Set<string>();
    for (const c of picks) {
      if (taken.size >= cap) break;
      if (taken.has(c.business.id)) continue;
      taken.add(c.business.id);
      acts.push({ type: 'take_case', caseId: c.caseId });
    }
    return acts;
  }

  return { populate, ownerActions, officialActions };
}


function initialOrders(ctx: EngineCtx, pack: Pack, profile: OwnerProfile, rec: StandingOrders, rng: () => number): Partial<StandingOrders> {
  const ref = pack.unit.refPrice;
  const price = profile.price === 'dump' ? ref * 0.85 : profile.price === 'premium' ? ref * 1.3 : profile.price === 'fixed_random' ? ref * (0.8 + 0.45 * rng()) : ref;
  const role = pack.staff[0].id;
  let staff = Object.values(rec.staff).reduce((s, n) => s + n, 0);
  if (profile.price === 'fixed_random') staff = clamp(staff + Math.floor(rng() * 3) - 1, pack.capacity.minStaff, pack.capacity.maxStaff);
  const levers: Record<string, string> = {};
  for (const lv of pack.levers) {
    const ids = lv.options.map((o) => o.id);
    const bad = lv.options.find((o) => o.causes)?.id;
    if (profile.shortcuts === 'all' && bad) levers[lv.id] = bad;
    else if (profile.quality === 'high') levers[lv.id] = ids.includes('full') ? 'full' : ids.includes('specialty') ? 'specialty' : ids[0];
    else levers[lv.id] = ids[0];
  }
  const all = [...pack.shortcuts, ...ctx.packs.common.shortcuts];
  const shortcuts = profile.shortcuts === 'all' ? all.map((s) => s.id) : profile.shortcuts === 'taxes' ? all.filter((s) => TAX_VIOLATIONS.has(s.violation)).map((s) => s.id) : profile.shortcuts === 'wages' ? all.filter((s) => s.violation === 'off_books_payroll').map((s) => s.id) : [];
  return { price: r2(clamp(price, pack.unit.priceMin, pack.unit.priceMax)), staff: { [role]: staff }, levers, shortcuts, blockFund: profile.blockFund, autopilot: profile.loginEvery > 1 ? 'manager' : 'hold' };
}

let adviceOf: (b: BusinessState) => number | null = () => null;
function reviewOrders(sight: OwnerSight, ctx: EngineCtx, b: BusinessState, pack: Pack, place: Place, profile: OwnerProfile): Partial<StandingOrders> | null {
  const days = b.days.slice(-7).filter((d) => d.demandUnits > 0);
  if (days.length < 3) return null;
  const demand = days.reduce((s, d) => s + d.demandUnits, 0) / days.length;
  const lost = days.reduce((s, d) => s + d.lost.size + d.lost.staff, 0) / days.length;
  const lostStaff = days.reduce((s, d) => s + d.lost.staff, 0) / days.length;
  const util = days.reduce((s, d) => s + d.sizeUtilization, 0) / days.length;
  const ref = pack.unit.refPrice;
  let price = b.orders.price;
  if (profile.price === 'dump') {
    const peers = sight.neighbors().filter((n) => n.niche === b.niche && n.status === 'open').map((n) => n.price);
    const med = median(peers);
    price = Math.max(pack.unit.cogsPerUnit * 2.2, Math.min(Number.isFinite(med) ? med * 0.87 : ref * 0.87, ref * 0.9));
  } else {
    // A human would compare the last two weeks of their own books: did the last price move raise the margin?
    const lo = profile.price === 'premium' ? ref * 1.1 : ref * 0.85, hi = ref * 1.6;
    const wk = (from: number, to: number) => {
      const xs = b.days.slice(from, to).filter((d) => d.servedUnits > 0);
      const served = xs.reduce((s, d) => s + d.servedUnits, 0), rev = xs.reduce((s, d) => s + d.revenue, 0);
      return { n: xs.length, price: served ? rev / served : 0, margin: xs.length ? xs.reduce((s, d) => s + d.revenue - d.variableCosts, 0) / xs.length : 0 };
    };
    const A = wk(-14, -7), B = wk(-7, b.days.length);
    const advice = adviceOf(b);
    let step = 0;
    if (A.n >= 4 && B.n >= 4 && Math.abs(B.price - A.price) / Math.max(0.01, A.price) > 0.01) {
      const dir = Math.sign(B.price - A.price);
      step = (B.margin - A.margin) * dir > 0 ? 0.03 * dir : -0.02 * dir;
    } else if (lost / Math.max(1, demand) > 0.05) step = 0.03;
    else if (util < 0.35) step = -0.03;
    else step = 0.02;
    price = price * (1 + step);
    // the analytics screen suggests a price; a reasonable owner moves halfway toward it
    if (advice) price = price + 0.5 * (advice - price);
    price = clamp(price, lo, hi);
  }
  const per = (pack.capacity.unitsPerStaffMonth ?? 1e9) / 30;
  let need = Math.ceil((demand / per) * (profile.price === 'dump' ? 1.1 : 1.05));
  if (lostStaff / Math.max(1, demand) > 0.05) need += 1;
  const fixed = fixedCostsMonth(pack, place, b);
  const levers: Record<string, string> = { ...b.orders.levers };
  const mkt = pack.levers.find((l) => l.id === 'marketing');
  if (b.cash < fixed * 0.5) { need -= 1; if (mkt) levers.marketing = mkt.options[0].id; }
  else if (mkt) levers.marketing = (b.cash > fixed * (profile.quality === 'high' ? 2 : 4) && util < 0.6) ? (mkt.options.find((o) => o.id === 'local')?.id ?? mkt.options[0].id) : mkt.options[0].id;
  need = clamp(need, pack.capacity.minStaff, pack.capacity.maxStaff);
  const role = pack.staff[0].id;
  const changed = Math.abs(price - b.orders.price) > 0.009 || (b.orders.staff[role] ?? 0) !== need || JSON.stringify(levers) !== JSON.stringify(b.orders.levers);
  return changed ? { price: r2(clamp(price, pack.unit.priceMin, pack.unit.priceMax)), staff: { [role]: need }, levers } : null;
}

function noticeAnswer(caseId: string, fine: number, b: BusinessState, profile: OwnerProfile): Action {
  if (profile.notice === 'bribe') {
    const amount = Math.round(Math.max(500, fine * 0.4));
    if (amount < b.cash) return { type: 'answer_notice', caseId, response: 'bribe', bribeAmount: amount };
  }
  if (profile.notice === 'contest_if_big' && fine > RULES.CONTEST_FEE / (1 - RULES.CONTEST_FINE_MULT)) return { type: 'answer_notice', caseId, response: 'contest' };
  return { type: 'answer_notice', caseId, response: 'pay' };
}

function acceptDeal(sight: OwnerSight, ctx: EngineCtx, b: BusinessState, pack: Pack, place: Place, terms: DealTerms, fromId: string, profile: OwnerProfile, strategy: OwnerStrategy): boolean {
  const partner = sight.neighbors().find((n) => n.id === fromId);
  if (!partner || partner.status !== 'open') return false;
  const { kept, broken } = partner.trust;
  const trusted = strategy === 'unreliable' || strategy === 'newbie' ? true : strategy === 'social' ? broken <= kept + 1 : broken === 0 || kept >= 2 * broken;
  const live = sight.myDeals.filter((d) => d.status === 'active').length;
  if (live >= RULES.MAX_ACTIVE_DEALS) return false;
  switch (terms.type) {
    case 'joint_purchase': case 'cross_promo': return trusted;
    case 'loan': {
      const fixed = fixedCostsMonth(pack, place, b);
      const maxRate = profile.shortcuts === 'none' ? 4 : 5;
      return trusted && b.cash < fixed * 2 && terms.monthlyRatePct <= maxRate && terms.amount <= fixed * 3;
    }
    case 'partnership': {
      const profit = recentProfit(b);
      const multiple = strategy === 'social' ? 18 : 24;
      return trusted && profit > 0 && terms.amount >= (terms.sharePct / 100) * multiple * profit;
    }
  }
  return false;
}

function complaint(sight: OwnerSight, ctx: EngineCtx, b: BusinessState, harass: boolean): Action | null {
  if (sight.myReportDays.filter((d) => d > sight.day - 7).length >= RULES.REPORTS_PER_WEEK) return null;
  const peers = sight.neighbors().filter((n) => n.niche === b.niche && n.status === 'open' && n.rankInNiche > 0);
  if (!peers.length) return null;
  const leader = peers.reduce((a, c) => (c.rankInNiche < a.rankInNiche ? c : a));
  const med = median(peers.map((p) => p.price));
  const finedRecently = sight.feed.some((f) => f.kind === 'inspection' && f.businessId === leader.id && f.day > sight.day - 60);
  const cheap = leader.price < med * 0.9;
  const dirty = leader.reputation < 0.45;
  const pack = (ctx.packs.niches[leader.niche])!;
  const reports = [...pack.reports, ...ctx.packs.common.reports];
  const taxReport = reports.find((r) => r.role === 'tax_auditor');
  const healthReport = reports.find((r) => r.role === 'inspector');
  if (!harass && !(cheap || dirty || finedRecently)) return null;
  const pick = dirty ? healthReport : harass && sight.day % 14 < 7 ? healthReport : taxReport;
  return pick ? { type: 'report', targetBusinessId: leader.id, reportId: pick.id } : null;
}

function proposals(w: WorldState, sight: OwnerSight, ctx: EngineCtx, b: BusinessState, place: Place, strategy: OwnerStrategy): Action[] {
  const live = sight.myDeals;
  if (live.length >= RULES.MAX_ACTIVE_DEALS - 1) return [];
  const partners = new Set(live.flatMap((d) => [d.fromBusinessId, d.toBusinessId])); // grows as we propose below
  const ok = (n: PublicBusiness) => n.status === 'open' && !partners.has(n.id) && n.partners.length < RULES.MAX_ACTIVE_DEALS && (strategy === 'unreliable' || n.trust.broken === 0 || n.trust.kept >= 2 * n.trust.broken);
  const neighbors = sight.neighbors();
  const acts: Action[] = [];
  if (!live.some((d) => d.terms.type === 'joint_purchase')) {
    const same = neighbors.filter((n) => n.niche === b.niche && ok(n)).sort((x, y) => (y.trust.kept - y.trust.broken) - (x.trust.kept - x.trust.broken) || x.rankInNiche - y.rankInNiche);
    if (same[0]) { acts.push({ type: 'propose_deal', toBusinessId: same[0].id, terms: { type: 'joint_purchase', months: 3 } }); partners.add(same[0].id); }
  }
  if (!live.some((d) => d.terms.type === 'cross_promo') && acts.length + live.length < RULES.MAX_ACTIVE_DEALS - 1) {
    const near = neighbors.filter((n) => n.niche !== b.niche && ok(n) && distanceM(place, placeOf(ctx, n.placeId)!) <= 400).sort((x, y) => distanceM(place, placeOf(ctx, x.placeId)!) - distanceM(place, placeOf(ctx, y.placeId)!));
    if (near[0]) { acts.push({ type: 'propose_deal', toBusinessId: near[0].id, terms: { type: 'cross_promo', months: 3 } }); partners.add(near[0].id); }
  }
  if (strategy === 'social' && b.cash > 40000 && w.day < 300 && !live.some((d) => d.terms.type === 'loan' && d.fromBusinessId === b.id) && acts.length + live.length < RULES.MAX_ACTIVE_DEALS - 1) {
    const blockmates = neighbors.filter((n) => ok(n) && placeOf(ctx, n.placeId)!.block === place.block);
    if (blockmates[0]) acts.push({ type: 'propose_deal', toBusinessId: blockmates[0].id, terms: { type: 'loan', amount: 5000, monthlyRatePct: 2, months: 6 } });
  }
  return acts;
}
