// recommendOpening: система собирает бизнес за игрока — три набора из pack.kits, подогнанные под площадь
// и капитал, с готовыми распоряжениями, сроком до открытия и причинами с числами. Порядок — по прогнозу
// прибыли за первый год из whatIf.
import type { BusinessState, NicheId, OpenRecommendation, Pack, PackKit, PackLever, PackLeverOption, Place, StandingOrders, WorldState } from '../../../shared/src/types';
import { RULES } from '../../../shared/src/rules';
import { asEstablishedPlace, awarenessAt, buildoutOf, daysToOpenOf, footfallParams, isTakeover, takeoverRules } from '../../../shared/src/place';
import type { EngineCtx } from './link';
import { whatIfWith } from './whatif';
import { clamp, itemsCost, legalOptions, maxSizeForPlace, packOf, placeOf, r1, r2, rentMonth, sizeCapMonth } from './model';
import { plural, usd } from './text';

export const CANDIDATE_ID = '__candidate__';

/** Seat rules that ask for a setup item (the same pack field open_business checks with seatRuleBroken), lowest first. */
function seatRules(pack: Pack): { seats: number; setupItemId: string }[] {
  const raw = (pack.extra as { seatThresholds?: unknown } | undefined)?.seatThresholds;
  if (!Array.isArray(raw)) return [];
  return (raw as { seats?: unknown; setupItemId?: unknown }[])
    .filter((t): t is { seats: number; setupItemId: string } => typeof t?.seats === 'number' && typeof t.setupItemId === 'string' && pack.setup.some((d) => d.id === t.setupItemId))
    .sort((a, b) => a.seats - b.seats);
}

function pickOption(legal: PackLeverOption[], kit: PackKit['id']): PackLeverOption {
  if (kit === 'lean') return [...legal].sort((a, b) => a.monthlyCost - b.monthlyCost)[0];
  if (kit === 'premium') {
    const q = [...legal].sort((a, b) => (b.effects?.quality ?? 0) - (a.effects?.quality ?? 0) || a.monthlyCost - b.monthlyCost)[0];
    return (q.effects?.quality ?? 0) > 0 ? q : legal[0];
  }
  return legal[0];
}

export function leversFor(pack: Pack, kit: PackKit['id']): Record<string, string> {
  const out: Record<string, string> = {};
  for (const lever of pack.levers as PackLever[]) {
    const legal = legalOptions(lever);
    if (legal.length) out[lever.id] = pickOption(legal, kit).id;
  }
  return out;
}

export function staffFor(pack: Pack, n: number): Record<string, number> {
  const [main, second] = pack.staff;
  if (!main) return {};
  if (second && n >= 3) return { [main.id]: n - 1, [second.id]: 1 };
  return { [main.id]: n };
}

function candidate(pack: Pack, niche: NicheId, placeId: string, size: number, items: { id: string; qty: number }[], orders: StandingOrders, total: number, w: WorldState): BusinessState {
  const quality = clamp(0.5 + items.reduce((s, it) => s + (pack.setup.find((d) => d.id === it.id)?.qualityBonus ?? 0), 0), 0, 1);
  return {
    id: CANDIDATE_ID, name: 'Your business', niche, placeId, isAi: false,
    owners: [{ playerId: CANDIDATE_ID, share: 1 }], managerPlayerId: CANDIDATE_ID,
    status: 'open', createdDay: w.day, openedDay: w.day, cash: r2(pack.startCapital - total), size, items, setupSpent: total, permits: [],
    quality, reputation: 0.5, trust: { kept: 0, broken: 0 }, orders, trails: [], liabilities: [],
    mtd: { lines: [], demandUnits: 0, servedUnits: 0, lost: { size: 0, staff: 0, closure: 0 } }, days: [], history: [],
    extra: { econ: { marketing: 0, training: 0, lossCarry: 0, cashStart: r2(pack.startCapital - total), awareness0: 1,
      mtd: { revenue: 0, cogs: 0, salesTax: 0, taxesPaid: 0, capacityUnits: 0, utilSum: 0, utilDays: 0, daysAlive: 0, daysOpen: 0, managerDays: 0, rentMultSum: 0, utilitiesMultSum: 0, staffDays: {} } } },
  };
}

/** A full month of a business that would stand at this place with these orders, its regular crowd complete. */
export function project(pack: Pack, niche: NicheId, placeId: string, size: number, items: { id: string; qty: number }[], orders: StandingOrders, total: number, w: WorldState, ctx: EngineCtx) {
  const world: WorldState = { ...w, businesses: [...w.businesses.filter((b) => b.id !== CANDIDATE_ID), candidate(pack, niche, placeId, size, items, orders, total, w)] };
  return whatIfWith(world, ctx, CANDIDATE_ID, {});
}

interface Built { rec: OpenRecommendation; annual: number }

function build(kit: PackKit, pack: Pack, niche: NicheId, place: Place | undefined, placeId: string, w: WorldState, ctx: EngineCtx): Built {
  const maxSize = maxSizeForPlace(pack, place);
  const capital = pack.startCapital;
  const rent = rentMonth(pack, place);
  const takeover = isTakeover(pack, place);
  let size = Math.max(1, Math.min(kit.size, maxSize, pack.sizing.max));
  if (maxSize >= pack.sizing.min) size = Math.max(size, pack.sizing.min);
  if (takeover) size = place!.forSale!.size;      // куплен как есть: его зал и его места
  const ids = new Set(kit.items.map((i) => i.id));
  for (const s of pack.setup) if (s.required) ids.add(s.id);
  let items = [...ids].filter((id) => pack.setup.some((d) => d.id === id)).map((id) => {
    const def = pack.setup.find((d) => d.id === id)!;
    return { id, qty: def.scalesWithSize ? size : kit.items.find((i) => i.id === id)?.qty ?? 1 };
  });
  const dropped: string[] = [];
  const withSize = (s: number) => items.map((it) => (pack.setup.find((d) => d.id === it.id)?.scalesWithSize ? { ...it, qty: s } : it));
  // подгонка под капитал: сначала держим месяц аренды в запасе, если не выходит — хотя бы ноль
  for (const reserve of [rent, 0]) {
    while (itemsCost(pack, items, size, place) > capital - reserve) {
      const optional = items.filter((it) => !pack.setup.find((d) => d.id === it.id)?.required)
        .sort((a, b) => itemsCost(pack, [b], size) - itemsCost(pack, [a], size));
      if (optional.length) {
        dropped.push(pack.setup.find((d) => d.id === optional[0].id)?.name ?? optional[0].id);
        items = items.filter((it) => it.id !== optional[0].id);
        continue;
      }
      if (!takeover && size > pack.sizing.min) { size -= 1; items = withSize(size); continue; }
      break;
    }
    if (itemsCost(pack, items, size, place) <= capital - reserve) break;
  }
  items = withSize(size);
  // seat rules of the law (pack.extra.seatThresholds, checked by open_business): never offer a kit the city refuses.
  // The item the rule asks for goes in if the money allows, otherwise the room stays under the threshold
  // (docs/qa/BUGS.md #12: premium with 24 seats and no customer restroom was offered and then refused).
  for (const t of seatRules(pack)) {
    if (size < t.seats || items.some((i) => i.id === t.setupItemId && i.qty > 0)) continue;
    const withItem = [...items, { id: t.setupItemId, qty: 1 }];
    if (itemsCost(pack, withItem, size, place) <= capital) { items = withItem; continue; }
    if (!takeover && t.seats - 1 >= pack.sizing.min) { size = t.seats - 1; items = withSize(size); }
  }
  const total = itemsCost(pack, items, size, place);
  const cashLeft = r2(capital - total);
  const priceMult = kit.id === 'premium' ? 1.1 : kit.id === 'lean' ? 0.95 : 1;
  const price = clamp(Math.round((pack.unit.refPrice * priceMult) / 0.25) * 0.25, pack.unit.priceMin, pack.unit.priceMax);
  const base: StandingOrders = { price, staff: staffFor(pack, pack.capacity.maxStaff), levers: leversFor(pack, kit.id), shortcuts: [], blockFund: false, autopilot: 'hold' };
  // штат: пробный прогон с полным штатом показывает спрос; людей берём под него с запасом 10%
  const probe = project(pack, niche, placeId, size, items, base, total, w, ctx);
  const servable = Math.min(probe.projected.demandUnits, sizeCapMonth(pack, size));
  const per = pack.capacity.unitsPerStaffMonth;
  const need = per ? clamp(Math.ceil(servable / (per * 0.9)), pack.capacity.minStaff, pack.capacity.maxStaff) : pack.capacity.minStaff;
  let orders: StandingOrders = { ...base, staff: staffFor(pack, need) };
  let res = project(pack, niche, placeId, size, items, orders, total, w, ctx);
  // the formula counts heads, not whether the last one pays for themselves: one fewer is tried and kept when it earns
  // more (docs/qa/BUGS.md #1: three baristas and a lead lost $1,589 a month where two and a lead made money in play)
  if (need - 1 >= pack.capacity.minStaff) {
    const fewer: StandingOrders = { ...base, staff: staffFor(pack, need - 1) };
    const alt = project(pack, niche, placeId, size, items, fewer, total, w, ctx);
    if (alt.analytics.profit > res.analytics.profit) { orders = fewer; res = alt; }
  }
  const monthProfit = res.analytics.profit;
  const waits = items.map((it) => pack.setup.find((d) => d.id === it.id)!).filter((d) => d.waitDays).sort((a, b) => (b.waitDays ?? 0) - (a.waitDays ?? 0));
  const build = buildoutOf(pack, place);
  const daysToOpen = daysToOpenOf(pack, items, place);
  const waitRent = r2((rent * daysToOpen) / RULES.DAYS_PER_MONTH);
  // первый год: дни до открытия без выручки, потом разгон — постоянные клиенты набираются не сразу
  const foot = place?.pedestriansPerDay ? footfallParams(pack) : null;
  const seasonDays = (w.config?.seasonMonths ?? 12) * RULES.DAYS_PER_MONTH;
  const tradingDays = Math.max(0, seasonDays - daysToOpen);
  let annual = r2(monthProfit * 12 - waitRent);
  let rampCost = 0;
  if (foot) {
    const a0 = takeover ? takeoverRules(pack)!.awareness : foot.awarenessStart;
    const avgAware = tradingDays > 0 ? 1 - (1 - a0) * (foot.rampDays / tradingDays) * (1 - Math.exp(-tradingDays / foot.rampDays)) : awarenessAt(0, a0, foot.rampDays);
    const contributionMonth = Math.max(0, res.analytics.contributionPerUnit * res.projected.servedUnits);
    rampCost = r2((1 - avgAware) * contributionMonth * (tradingDays / RULES.DAYS_PER_MONTH));
    annual = r2(monthProfit * (tradingDays / RULES.DAYS_PER_MONTH) - rampCost - waitRent);
  }
  const unit = pack.sizing.unitName;
  const trimmed = size < kit.size && !takeover ? ` (trimmed from ${kit.size})` : '';
  const months = rent > 0 ? r1(cashLeft / rent) : 0;
  const sqft = place ? place.sqft.toLocaleString('en-US') : '';
  const why = [
    place ? `${plural(size, unit)} fit this ${sqft} sq ft space${trimmed}` : `${plural(size, unit)}${trimmed}`,
    cashLeft < 0
      ? `Costs ${usd(total)} to open — ${usd(-cashLeft)} more than your ${usd(capital)}`
      : dropped.length
        ? `Dropped ${dropped.join(', ')} to fit ${usd(capital)}; leaves ${usd(cashLeft)} — ${months} months of rent`
        : `Leaves ${usd(cashLeft)} in the bank — ${months} months of rent`,
  ];
  if (takeover) why.push(`Operating shop: ${usd(place!.forSale!.askingPrice)} buys the finished room, the equipment and most of its regulars`);
  else if (build) why.push(`${build.label}: ${usd(build.cost)} (${usd(build.perSqft)} × ${sqft} sq ft), ${build.days} days of construction`);
  why.push(daysToOpen > 0
    ? (build ? `${daysToOpen} days until you can open — rent is due meanwhile: ${usd(waitRent)}` : `${waits[0].name} takes ${daysToOpen} days — rent is due meanwhile: ${usd(waitRent)}`)
    : 'No permit wait: you can open as soon as you sign');
  if (foot) {
    why.push(monthProfit >= 0
      ? `Once the regulars know you: ${usd(monthProfit)}/month. First year, with the wait and a slow start: ${annual >= 0 ? usd(annual) : `a loss of ${usd(-annual)}`}`
      : `Even with a full regular crowd this loses ${usd(-monthProfit)}/month — this address needs a leaner setup or a lower rent`);
  } else {
    why.push(monthProfit >= 0
      ? `Projected profit ${usd(monthProfit)}/month, about ${usd(annual)} in the first year`
      : `Projected loss ${usd(-monthProfit)}/month — this setup needs more sales to work`);
  }
  return { rec: { kitId: kit.id, size, items, total, cashLeft, orders, daysToOpen, why }, annual };
}

export function recommendOpening(niche: NicheId, placeId: string, w: WorldState, ctx: EngineCtx, opts: { established?: boolean } = {}): OpenRecommendation[] {
  const pack = packOf(ctx, niche);
  const real = placeOf(ctx, placeId);
  // давно работающее заведение: помещение отделано много лет назад, считать его как новичку в сыром помещении нельзя
  const place = real && opts.established ? asEstablishedPlace(pack, real) : real;
  // готовый бизнес покупают как есть: один набор — то, что в нём уже стоит
  const kits = isTakeover(pack, place) ? pack.kits.filter((k) => k.id === 'standard').concat(pack.kits).slice(0, 1) : pack.kits;
  return kits.map((k) => build(k, pack, niche, place, placeId, w, ctx)).sort((a, b) => b.annual - a.annual).map((x) => x.rec);
}
