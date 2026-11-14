// recommendOpening: система собирает бизнес за игрока — три набора из pack.kits, подогнанные под площадь
// и капитал, с готовыми распоряжениями, сроком до открытия и причинами с числами. Порядок — по прогнозу
// прибыли за первый год из whatIf.
import type { BusinessState, NicheId, OpenRecommendation, Pack, PackKit, PackLever, PackLeverOption, Place, StandingOrders, WorldState } from '../../../shared/src/types';
import { RULES } from '../../../shared/src/rules';
import type { EngineCtx } from './link';
import { whatIfWith } from './whatif';
import { clamp, itemsCost, legalOptions, maxSizeForPlace, packOf, placeOf, r1, r2, rentMonth, sizeCapMonth } from './model';
import { plural, usd } from './text';

export const CANDIDATE_ID = '__candidate__';

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
  };
}

function project(pack: Pack, niche: NicheId, placeId: string, size: number, items: { id: string; qty: number }[], orders: StandingOrders, total: number, w: WorldState, ctx: EngineCtx) {
  const world: WorldState = { ...w, businesses: [...w.businesses.filter((b) => b.id !== CANDIDATE_ID), candidate(pack, niche, placeId, size, items, orders, total, w)] };
  return whatIfWith(world, ctx, CANDIDATE_ID, {});
}

interface Built { rec: OpenRecommendation; annual: number }

function build(kit: PackKit, pack: Pack, niche: NicheId, place: Place | undefined, placeId: string, w: WorldState, ctx: EngineCtx): Built {
  const maxSize = maxSizeForPlace(pack, place);
  const capital = pack.startCapital;
  const rent = rentMonth(pack, place);
  let size = Math.max(1, Math.min(kit.size, maxSize, pack.sizing.max));
  if (maxSize >= pack.sizing.min) size = Math.max(size, pack.sizing.min);
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
    while (itemsCost(pack, items, size) > capital - reserve) {
      const optional = items.filter((it) => !pack.setup.find((d) => d.id === it.id)?.required)
        .sort((a, b) => itemsCost(pack, [b], size) - itemsCost(pack, [a], size));
      if (optional.length) {
        dropped.push(pack.setup.find((d) => d.id === optional[0].id)?.name ?? optional[0].id);
        items = items.filter((it) => it.id !== optional[0].id);
        continue;
      }
      if (size > pack.sizing.min) { size -= 1; items = withSize(size); continue; }
      break;
    }
    if (itemsCost(pack, items, size) <= capital - reserve) break;
  }
  items = withSize(size);
  const total = itemsCost(pack, items, size);
  const cashLeft = r2(capital - total);
  const priceMult = kit.id === 'premium' ? 1.1 : kit.id === 'lean' ? 0.95 : 1;
  const price = clamp(Math.round((pack.unit.refPrice * priceMult) / 0.25) * 0.25, pack.unit.priceMin, pack.unit.priceMax);
  const base: StandingOrders = { price, staff: staffFor(pack, pack.capacity.maxStaff), levers: leversFor(pack, kit.id), shortcuts: [], blockFund: false, autopilot: 'hold' };
  // штат: пробный прогон с полным штатом показывает спрос; людей берём под него с запасом 10%
  const probe = project(pack, niche, placeId, size, items, base, total, w, ctx);
  const servable = Math.min(probe.projected.demandUnits, sizeCapMonth(pack, size));
  const per = pack.capacity.unitsPerStaffMonth;
  const need = per ? clamp(Math.ceil(servable / (per * 0.9)), pack.capacity.minStaff, pack.capacity.maxStaff) : pack.capacity.minStaff;
  const orders: StandingOrders = { ...base, staff: staffFor(pack, need) };
  const res = project(pack, niche, placeId, size, items, orders, total, w, ctx);
  const monthProfit = res.analytics.profit;
  const waits = items.map((it) => pack.setup.find((d) => d.id === it.id)!).filter((d) => d.waitDays).sort((a, b) => (b.waitDays ?? 0) - (a.waitDays ?? 0));
  const daysToOpen = waits[0]?.waitDays ?? 0;
  const waitRent = r2((rent * daysToOpen) / RULES.DAYS_PER_MONTH);
  const annual = r2(monthProfit * 12 - waitRent);
  const unit = pack.sizing.unitName;
  const trimmed = size < kit.size ? ` (trimmed from ${kit.size})` : '';
  const months = rent > 0 ? r1(cashLeft / rent) : 0;
  const why = [
    place ? `${plural(size, unit)} fit this ${place.sqft.toLocaleString('en-US')} sq ft space${trimmed}` : `${plural(size, unit)}${trimmed}`,
    dropped.length
      ? `Dropped ${dropped.join(', ')} to fit ${usd(capital)}; leaves ${usd(cashLeft)} — ${months} months of rent`
      : `Leaves ${usd(cashLeft)} in the bank — ${months} months of rent`,
    daysToOpen > 0 ? `${waits[0].name} takes ${daysToOpen} days — rent is due meanwhile: ${usd(waitRent)}` : 'No permit wait: you can open as soon as you sign',
    monthProfit >= 0
      ? `Projected profit ${usd(monthProfit)}/month, about ${usd(annual)} in the first year`
      : `Projected loss ${usd(-monthProfit)}/month — this setup needs more sales to work`,
  ];
  return { rec: { kitId: kit.id, size, items, total, cashLeft, orders, daysToOpen, why }, annual };
}

export function recommendOpening(niche: NicheId, placeId: string, w: WorldState, ctx: EngineCtx): OpenRecommendation[] {
  const pack = packOf(ctx, niche);
  const place = placeOf(ctx, placeId);
  return pack.kits.map((k) => build(k, pack, niche, place, placeId, w, ctx)).sort((a, b) => b.annual - a.annual).map((x) => x.rec);
}
