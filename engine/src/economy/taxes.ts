import type { BusinessState, Money, Pack, PackTax, TaxLiability } from '../../../shared/src/types';
import { RULES } from '../../../shared/src/rules';
import type { EngineCtx } from '../index';
import { round2 } from './util';

/**
 * Taxes the game applies to a business: _common plus the niche pack. If _common.extra.simplifiedScheme.taxIds is a list,
 * only those ids apply (agent 14 picks one simplified scheme for the game); otherwise every listed tax applies.
 */
export function applicableTaxes(ctx: EngineCtx, pack: Pack): PackTax[] {
  const all = [...ctx.packs.common.taxes, ...pack.taxes];
  const scheme = (ctx.packs.common.extra as Record<string, unknown> | undefined)?.simplifiedScheme as { taxIds?: unknown } | undefined;
  const ids = Array.isArray(scheme?.taxIds) ? new Set((scheme!.taxIds as unknown[]).filter((x): x is string => typeof x === 'string')) : null;
  const seen = new Set<string>();
  return all.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return ids ? ids.has(t.id) : true;
  });
}

/** Sales taxes are collected from customers on top of the price (base taxable_revenue). */
export const isSalesTax = (t: PackTax): boolean => t.base === 'taxable_revenue';

export function taxableShare(pack: Pack): number {
  const v = (pack.extra as Record<string, unknown> | undefined)?.taxableShare;
  return typeof v === 'number' && v >= 0 && v <= 1 ? v : 1;
}

function dueDayOfMonth(ctx: EngineCtx): number {
  const v = (ctx.packs.common.extra as Record<string, unknown> | undefined)?.taxDueDayOfMonth;
  return typeof v === 'number' && v >= 1 && v <= RULES.DAYS_PER_MONTH ? Math.floor(v) : 20;
}

/**
 * Game calendar of payments for a tax accrued in month m: monthly — the last day of the month (paid at month close);
 * quarterly — day 20 of the month after the calendar quarter; annual — day 20 of the month after the season year.
 */
export function dueDayFor(t: PackTax, month: number, ctx: EngineCtx): number {
  const d = RULES.DAYS_PER_MONTH;
  if (t.due === 'monthly') return month * d;
  if (t.due === 'quarterly') return Math.ceil(month / 3) * 3 * d + dueDayOfMonth(ctx);
  return Math.ceil(month / 12) * 12 * d + dueDayOfMonth(ctx);
}

/** Adds an accrued amount to the open liability of this tax and due day, or opens a new one. */
export function accrue(liabilities: readonly TaxLiability[], taxId: string, amount: Money, dueDay: number): TaxLiability[] {
  const a = round2(amount);
  if (a <= 0) return liabilities.slice();
  const i = liabilities.findIndex((l) => !l.paid && l.taxId === taxId && l.dueDay === dueDay);
  if (i < 0) return [...liabilities, { taxId, amount: a, dueDay, paid: false }];
  const out = liabilities.slice();
  out[i] = { ...liabilities[i], amount: round2(liabilities[i].amount + a) };
  return out;
}

export function taxName(ctx: EngineCtx, pack: Pack | undefined, taxId: string): string {
  return pack?.taxes.find((t) => t.id === taxId)?.name ?? ctx.packs.common.taxes.find((t) => t.id === taxId)?.name ?? taxId;
}

export function taxDef(ctx: EngineCtx, pack: Pack | undefined, taxId: string): PackTax | undefined {
  return pack?.taxes.find((t) => t.id === taxId) ?? ctx.packs.common.taxes.find((t) => t.id === taxId);
}

export function dueLiabilities(b: BusinessState, day: number): TaxLiability[] {
  return b.liabilities.filter((l) => !l.paid && l.dueDay <= day);
}
