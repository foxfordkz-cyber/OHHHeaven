// Модель затрат бизнеса по данным пакета, месту и постоянным распоряжениям.
// Чистые функции без доступа к чужим модулям: их используют аналитика и заглушка движка.
import type {
  BusinessState, CommonPack, Money, NicheId, Pack, PackLever, PackLeverOption, PackSet, PackShortcut,
  PackTax, PackViolation, Place, PnlKind, StandingOrders,
} from '../../../shared/src/types';
import { RULES } from '../../../shared/src/rules';
import { openingCost } from '../../../shared/src/place';

export interface Ctx { packs: PackSet; places: Place[] }

export const r2 = (x: number): number => Math.round(x * 100) / 100;
export const r1 = (x: number): number => Math.round(x * 10) / 10;
export const r4 = (x: number): number => Math.round(x * 10000) / 10000;
export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

export function packOf(ctx: Ctx, niche: NicheId): Pack {
  const p = ctx.packs.niches[niche];
  if (!p) throw new Error(`No pack for niche "${niche}"`);
  return p;
}

export const placeOf = (ctx: Ctx, placeId: string): Place | undefined => ctx.places.find((p) => p.id === placeId);

export const staffCount = (orders: StandingOrders): number =>
  Object.values(orders.staff ?? {}).reduce((s, n) => s + Math.max(0, n), 0);

export const taxesOf = (common: CommonPack, pack: Pack): PackTax[] => [...common.taxes, ...pack.taxes];
export const shortcutsOf = (common: CommonPack, pack: Pack): PackShortcut[] => [...pack.shortcuts, ...common.shortcuts];
export const violationsOf = (common: CommonPack, pack: Pack): PackViolation[] => [...pack.violations, ...common.violations];

/** Вариант рычага по умолчанию: первый законный (без `causes`). */
export function defaultOptionId(lever: PackLever): string {
  return (lever.options.find((o) => !o.causes) ?? lever.options[0]).id;
}

export function chosenOption(lever: PackLever, orders: StandingOrders): PackLeverOption {
  const id = orders.levers?.[lever.id] ?? defaultOptionId(lever);
  return lever.options.find((o) => o.id === id) ?? lever.options.find((o) => o.id === defaultOptionId(lever))!;
}

export const legalOptions = (lever: PackLever): PackLeverOption[] => lever.options.filter((o) => !o.causes);

/** Сколько единиц размера помещается в место: площадь × доля под зал ÷ площадь на единицу. */
export function maxSizeForPlace(pack: Pack, place?: Place): number {
  if (!place) return pack.sizing.max;
  const fit = Math.floor((place.sqft * RULES.USABLE_FLOOR_SHARE) / pack.sizing.sqftPerUnit);
  return Math.min(pack.sizing.max, fit);
}

/** Аренда месяца: по месту на карте, если оно известно, иначе строка `rent` пакета. */
export function rentMonth(pack: Pack, place?: Place): Money {
  if (place) return r2((place.sqft * place.rentPerSqftYear) / 12);
  return pack.monthlyCosts.filter((c) => c.kind === 'rent' && c.basis === 'fixed').reduce((s, c) => s + c.amount, 0);
}

export function staffCapMonth(pack: Pack, orders: StandingOrders, capacityBoost = 0): number {
  const per = pack.capacity.unitsPerStaffMonth;
  if (per == null) return pack.capacity.hardCapUnits ?? Number.POSITIVE_INFINITY;
  return staffCount(orders) * per * (1 + capacityBoost);
}

export function sizeCapMonth(pack: Pack, size: number): number {
  const t = pack.sizing.takeawayShare ?? 0;
  return (size * pack.sizing.unitsServedPerSizeMonth) / Math.max(0.05, 1 - t);
}

export const hardCapMonth = (pack: Pack): number => pack.capacity.hardCapUnits ?? Number.POSITIVE_INFINITY;

/** Сумма эффектов выбранных вариантов рычагов. */
export function leverEffects(pack: Pack, orders: StandingOrders): { quality: number; reputation: number; demand: number; capacity: number } {
  const e = { quality: 0, reputation: 0, demand: 0, capacity: 0 };
  for (const lever of pack.levers) {
    const o = chosenOption(lever, orders).effects ?? {};
    e.quality += o.quality ?? 0; e.reputation += o.reputation ?? 0; e.demand += o.demand ?? 0; e.capacity += o.capacity ?? 0;
  }
  return e;
}

/** Цена набора предметов: предметы со `scalesWithSize` стоят цену × размер. */
export function itemsCost(pack: Pack, items: { id: string; qty: number }[], size: number, place?: Place): Money {
  // с местом: ремонт по состоянию помещения, депозит от настоящей аренды, цена готового бизнеса (shared/src/place.ts)
  return openingCost(pack, items, size, place);
}

/** Расстояние между двумя местами в метрах (гаверсинус). */
export function metersBetween(a: Place, b: Place): number {
  const R = 6_371_000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ───────────────────────── Модель затрат ─────────────────────────

/** amount > 0 — расход (для `saving` — сохранённые деньги). */
export interface CostLine { id: string; label: string; kind: PnlKind; amount: Money }

export interface CostModel {
  price: Money; priceMult: number; priceEff: Money;
  cogsPerUnit: Money;            // себестоимость единицы с учётом множителей сделок
  perUnit: Money;                // прочие расходы на единицу (стаканы, упаковка)
  pctRevenue: number;            // доля выручки: эквайринг, налоги с оборота
  fixed: CostLine[];             // постоянные расходы месяца
  rent: Money; payroll: Money; payrollTax: Money; manager: Money;
  profitTaxRate: number; staffCount: number;
  savings(revenue: Money): CostLine[];
  variableLines(units: number, revenue: Money): CostLine[];
}

export interface CostInputs {
  pack: Pack; common: CommonPack; place?: Place; orders: StandingOrders; size: number;
  status?: BusinessState['status'];
  mods?: { cogsMult: number; priceMult: number };
}

const roleWage = (r: Pack['staff'][number]): Money => (r.tipped && r.cashWage != null ? r.cashWage : r.hourlyWage) * r.hoursPerMonth;

export function costModel(inp: CostInputs): CostModel {
  const { pack, common, place, orders, size } = inp;
  const mods = inp.mods ?? { cogsMult: 1, priceMult: 1 };
  const taxes = taxesOf(common, pack);
  const rent = rentMonth(pack, place);
  const setupOnly = inp.status === 'setup';
  const fixed: CostLine[] = [{ id: 'rent', label: 'Rent', kind: 'rent', amount: rent }];

  let payroll = 0, manager = 0, payrollTax = 0;
  const nStaff = staffCount(orders);
  let perUnit = 0, pctRevenue = 0;

  if (!setupOnly) {
    for (const role of pack.staff) {
      const n = orders.staff?.[role.id] ?? 0;
      if (n <= 0) continue;
      const amount = r2(n * roleWage(role));
      payroll += amount;
      fixed.push({ id: `payroll_${role.id}`, label: `${role.name} × ${n}`, kind: 'payroll', amount });
    }
    if (orders.autopilot === 'manager') {
      manager = pack.manager.monthlySalary;
      fixed.push({ id: 'manager', label: 'Manager salary', kind: 'payroll', amount: manager });
    }
    for (const t of taxes.filter((x) => x.base === 'payroll')) {
      const amount = r2(t.rate * (payroll + manager));
      payrollTax += amount;
      if (amount > 0) fixed.push({ id: t.id, label: t.name, kind: 'payroll_tax', amount });
    }
    for (const t of taxes.filter((x) => x.base === 'rent')) {
      fixed.push({ id: t.id, label: t.name, kind: 'tax', amount: r2(t.rate * rent) });
    }
    for (const t of taxes.filter((x) => x.base === 'fixed')) {
      const per = t.due === 'annual' ? t.rate / 12 : t.due === 'quarterly' ? t.rate / 3 : t.rate;
      fixed.push({ id: t.id, label: t.name, kind: 'tax', amount: r2(per) });
    }
    for (const c of pack.monthlyCosts) {
      if (c.kind === 'rent' && place) continue;
      if (c.basis === 'per_unit') { perUnit += c.amount; continue; }
      if (c.basis === 'pct_revenue') { pctRevenue += c.amount; continue; }
      const amount = c.basis === 'fixed' ? c.amount : c.basis === 'per_staff' ? c.amount * nStaff : c.amount * size;
      if (amount > 0) fixed.push({ id: c.id, label: c.name, kind: c.kind === 'rent' ? 'rent' : 'opex', amount: r2(amount) });
    }
    for (const t of taxes.filter((x) => x.base === 'revenue')) pctRevenue += t.rate;
    const cleaning = r2(pack.sizing.cleaningCostPerSizeMonth * size);
    if (cleaning > 0) fixed.push({ id: 'size_cleaning', label: `Cleaning and upkeep (${size} ${pack.sizing.unitName}s)`, kind: 'opex', amount: cleaning });
    for (const lever of pack.levers) {
      const o = chosenOption(lever, orders);
      if (o.monthlyCost > 0) fixed.push({ id: `lever_${lever.id}`, label: `${lever.name}: ${o.label}`, kind: 'opex', amount: o.monthlyCost });
    }
    if (orders.blockFund) fixed.push({ id: 'block_fund', label: 'Block fund', kind: 'deal', amount: RULES.BLOCK_FUND_FEE_MONTH });
  }

  const profitTaxRate = taxes.filter((t) => t.base === 'profit').reduce((s, t) => s + t.rate, 0);
  const shortcuts = shortcutsOf(common, pack);
  const priceEff = r2(orders.price * mods.priceMult);

  return {
    price: orders.price, priceMult: mods.priceMult, priceEff,
    cogsPerUnit: pack.unit.cogsPerUnit * mods.cogsMult,
    perUnit, pctRevenue, fixed, rent, payroll, payrollTax, manager, profitTaxRate, staffCount: nStaff,
    savings(revenue: Money): CostLine[] {
      if (setupOnly) return [];
      const out: CostLine[] = [];
      for (const id of orders.shortcuts ?? []) {
        const s = shortcuts.find((x) => x.id === id);
        if (!s) continue;
        const base = s.saves.basis === 'fixed' ? 1 : s.saves.basis === 'pct_payroll' ? payroll + manager
          : s.saves.basis === 'pct_revenue' ? revenue : s.saves.basis === 'pct_rent' ? rent : nStaff;
        const amount = r2(s.saves.amount * base);
        if (amount > 0) out.push({ id: `saving_${s.id}`, label: s.name, kind: 'saving', amount });
      }
      return out;
    },
    variableLines(units: number, revenue: Money): CostLine[] {
      const out: CostLine[] = [];
      for (const c of pack.monthlyCosts) {
        if (c.basis === 'per_unit') out.push({ id: c.id, label: c.name, kind: 'opex', amount: r2(c.amount * units) });
        if (c.basis === 'pct_revenue') out.push({ id: c.id, label: c.name, kind: 'opex', amount: r2(c.amount * revenue) });
      }
      for (const t of taxes.filter((x) => x.base === 'revenue')) out.push({ id: t.id, label: t.name, kind: 'tax', amount: r2(t.rate * revenue) });
      return out.filter((l) => l.amount > 0);
    },
  };
}

export const sumLines = (lines: { amount: Money }[]): Money => r2(lines.reduce((s, l) => s + l.amount, 0));
