// ЗАГЛУШКА @ohh/bots (агент 07): простые жители по характерам. Только через Action, только по открытым данным.
import type { Action, BusinessState, NicheId, Player, WorldState } from '../../../shared/src/types';
import { RULES } from '../../../shared/src/rules';
import type { BotBrain, BotResident, EngineCtx, PlayerExtra } from '../types';
import { distanceM, hash32, mulberry32, sum } from '../util';

const OWNER_STRATEGIES = ['honest', 'cuts_all', 'honest', 'cuts_taxes', 'briber', 'reporter', 'discounter', 'premium', 'social', 'unreliable'];
const CAFE_NAMES = ['Bluebird Coffee', 'Kettle & Crumb', 'Northside Espresso', 'Morning Ritual', 'Copper Cup', 'Little Fern Cafe', 'Grand Street Roasters', 'Daybreak Coffee Bar', 'Paper Moon Cafe', 'Steam & Stone', 'Corner Pour', 'Harbor Bean', 'Velvet Crema', 'Bedford Grind', 'Sunday Drip', 'Maple & Milk', 'The Daily Cup', 'Brick Lane Coffee', 'Lantern Cafe', 'Oak & Oat'];
const BARBER_NAMES = ['Sharp Line Barbers', 'Kings County Cuts', 'Fade Factory', 'Old Brooklyn Barbershop', 'Clean Cut Studio', 'The Chair Room', 'Hudson Fades', 'Union Barbers', 'Steel Comb', 'Prime Cuts NYC'];
const OWNER_NAMES = ['Maria Lopez', 'David Chen', 'Aisha Rahman', 'Tom Walsh', 'Priya Patel', 'Luis Ortega', 'Grace Kim', 'Omar Haddad', 'Nina Rossi', 'Sam Okafor', 'Elena Petrova', 'Jamal Brooks', 'Hana Sato', 'Carlos Rivera', 'Mei Lin', 'Ben Cohen', 'Fatima Ali', 'Jake Murphy', 'Rosa Diaz', 'Kwame Mensah', 'Lucy Park', 'Ivan Novak', 'Zoe Martin', 'Ravi Shah', 'Ana Silva', 'Leo Weiss', 'Iris Moreau', 'Dan Kowalski', 'Mona Farah', 'Eric Jensen'];
const OFFICIAL_NAMES = ['Inspector Alvarez', 'Inspector Brennan', 'Auditor Nakamura'];

function strategyOf(p: Player | undefined): string {
  return (p as (Player & PlayerExtra) | undefined)?.strategy ?? 'honest';
}

function playable(ctx: EngineCtx): NicheId[] {
  return (Object.keys(ctx.packs.niches) as NicheId[]).filter((n) => (ctx.packs.niches[n]?.kits.length ?? 0) > 0);
}

export function populate(w: WorldState, ctx: EngineCtx, seed: number): (BotResident & { businessName?: string })[] {
  const rnd = mulberry32(seed ^ 0x5eed);
  const niches = playable(ctx);
  const out: (BotResident & { businessName?: string })[] = [];
  const free = ctx.places.filter((p) => !w.businesses.some((b) => b.placeId === p.id));
  const order = free.map((p) => ({ p, k: rnd() })).sort((a, b) => a.k - b.k).map((x) => x.p);
  const target = Math.min(w.config.aiBusinessesTarget, Math.floor(ctx.places.length * 0.6));
  let cafe = 0, barber = 0;
  for (let i = 0; i < order.length && out.length < target; i++) {
    const place = order[i];
    const niche: NicheId = niches.includes('barbershop') && i % 3 === 2 ? 'barbershop' : (niches[0] ?? 'cafe');
    if (!place.suitableFor.includes(niche) || !ctx.packs.niches[niche]) continue;
    const businessName = niche === 'barbershop' ? BARBER_NAMES[barber++ % BARBER_NAMES.length] : CAFE_NAMES[cafe++ % CAFE_NAMES.length];
    out.push({ name: OWNER_NAMES[out.length % OWNER_NAMES.length], businessName, kind: 'owner', niche, placeId: place.id, strategy: OWNER_STRATEGIES[out.length % OWNER_STRATEGIES.length] });
  }
  out.push({ name: OFFICIAL_NAMES[0], kind: 'official', role: 'inspector', strategy: 'honest' });
  out.push({ name: OFFICIAL_NAMES[1], kind: 'official', role: 'inspector', strategy: 'corrupt' });
  out.push({ name: OFFICIAL_NAMES[2], kind: 'official', role: 'tax_auditor', strategy: 'honest' });
  return out;
}

const myBusiness = (w: WorldState, playerId: string): BusinessState | undefined =>
  w.businesses.find((b) => b.managerPlayerId === playerId && b.status !== 'bankrupt');

export function ownerActions(w: WorldState, ctx: EngineCtx, playerId: string): Action[] {
  const me = myBusiness(w, playerId);
  if (!me) return [];
  const pack = ctx.packs.niches[me.niche];
  if (!pack) return [];
  const strategy = strategyOf(w.players.find((p) => p.id === playerId));
  const out: Action[] = [];
  if (me.status === 'setup') {
    return me.permits.every((p) => p.readyDay <= w.day) ? [{ type: 'launch' }] : [];
  }
  for (const d of w.deals.filter((x) => x.toBusinessId === me.id && x.status === 'proposed')) {
    const from = w.businesses.find((b) => b.id === d.fromBusinessId);
    const trusted = !!from && from.trust.broken <= from.trust.kept;
    const simple = d.terms.type === 'joint_purchase' || d.terms.type === 'cross_promo';
    out.push({ type: 'answer_deal', dealId: d.id, accept: (simple && (trusted || strategy === 'social' || strategy === 'unreliable')) || (strategy === 'social' && d.terms.type === 'loan' && d.terms.monthlyRatePct <= 3) });
  }
  for (const c of w.cases.filter((x) => x.businessId === me.id && x.status === 'notice')) {
    if (strategy === 'briber') out.push({ type: 'answer_notice', caseId: c.id, response: 'bribe', bribeAmount: Math.round((c.fine ?? 0) * 0.4) });
    else if (strategy === 'cuts_all' && (c.fine ?? 0) > 3000) out.push({ type: 'answer_notice', caseId: c.id, response: 'contest' });
    else out.push({ type: 'answer_notice', caseId: c.id, response: 'pay' });
  }
  const weekly = (w.day + (hash32(playerId) % 7)) % 7 === 0;
  if (weekly && me.status === 'open') {
    const recent = me.days.slice(-7);
    const demand = sum(recent.map((d) => d.demandUnits));
    const lostStaff = sum(recent.map((d) => d.lost.staff));
    const role = pack.staff[0]?.id;
    const staff = { ...me.orders.staff };
    if (role && demand > 0 && lostStaff / demand > 0.12 && sum(Object.values(staff)) < pack.capacity.maxStaff) staff[role] = (staff[role] ?? 0) + 1;
    const orders: Partial<typeof me.orders> = { staff };
    if (strategy === 'cuts_all') {
      orders.shortcuts = pack.shortcuts.map((s) => s.id);
      const levers = { ...me.orders.levers };
      for (const l of pack.levers) { const bad = l.options.find((o) => o.causes); if (bad) levers[l.id] = bad.id; }
      orders.levers = levers;
    }
    if ((strategy === 'cuts_taxes' || strategy === 'briber') && pack.shortcuts.some((s) => s.id === 'cash_wages')) orders.shortcuts = ['cash_wages'];
    if (strategy === 'discounter') orders.price = Math.round(pack.unit.refPrice * 0.85 * 100) / 100;
    if (strategy === 'premium') orders.price = Math.round(pack.unit.refPrice * 1.2 * 100) / 100;
    if (strategy === 'social') orders.blockFund = true;
    out.push({ type: 'set_orders', orders });
  }
  if (strategy === 'social' && w.day % RULES.DAYS_PER_MONTH === 10 && me.status === 'open') {
    const here = ctx.places.find((p) => p.id === me.placeId);
    const partner = w.businesses.find((b) => {
      if (b.id === me.id || b.status !== 'open' || b.niche === me.niche) return false;
      const there = ctx.places.find((p) => p.id === b.placeId);
      const busy = w.deals.some((d) => (d.status === 'active' || d.status === 'proposed') && [d.fromBusinessId, d.toBusinessId].includes(b.id) && [d.fromBusinessId, d.toBusinessId].includes(me.id));
      return !!here && !!there && !busy && distanceM(here, there) <= 400;
    });
    if (partner) out.push({ type: 'propose_deal', toBusinessId: partner.id, terms: { type: 'cross_promo', months: 2 } });
  }
  if (strategy === 'reporter' && w.day % RULES.DAYS_PER_MONTH === 15 && me.status === 'open') {
    const leader = w.standings.find((s) => s.niche === me.niche && s.rank === 1 && s.businessId !== me.id);
    const target = leader && w.businesses.find((b) => b.id === leader.businessId && b.status === 'open');
    const rep = target && ctx.packs.niches[target.niche]?.reports[0];
    if (target && rep) out.push({ type: 'report', targetBusinessId: target.id, reportId: rep.id });
  }
  if (strategy === 'unreliable' && w.day % RULES.DAYS_PER_MONTH === 20) {
    const d = w.deals.find((x) => x.status === 'active' && (x.fromBusinessId === me.id || x.toBusinessId === me.id) && w.day - (x.startDay ?? w.day) >= 10);
    if (d) out.push({ type: 'cancel_deal', dealId: d.id });
  }
  return out;
}

export function officialActions(w: WorldState, _ctx: EngineCtx, playerId: string): Action[] {
  const off = w.officials.find((o) => o.playerId === playerId);
  if (!off) return [];
  const corrupt = strategyOf(w.players.find((p) => p.id === playerId)) === 'corrupt';
  return w.cases
    .filter((c) => c.officialId === off.id && c.status === 'bribe_offered')
    .map((c): Action => ({ type: 'answer_bribe', caseId: c.id, accept: corrupt && (c.bribeAmount ?? 0) >= 500 }));
}

export const stubBots: BotBrain = { populate, ownerActions, officialActions };
