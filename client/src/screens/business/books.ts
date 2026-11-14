// Books tab: groups P&L lines by kind for display. Totals are plain sums of the lines the engine sent.
import type { BusinessState, CommonPack, MonthReport, Pack, PnlKind, PnlLine, TaxLiability } from '../../../../shared/src/types';

export const KIND_ORDER: PnlKind[] = ['revenue', 'cogs', 'payroll', 'payroll_tax', 'rent', 'opex', 'tax', 'fine', 'saving', 'deal', 'setup', 'other'];

export const KIND_LABEL: Record<PnlKind, string> = {
  revenue: 'Sales',
  cogs: 'Cost of goods',
  payroll: 'Wages',
  payroll_tax: 'Payroll taxes',
  rent: 'Rent',
  opex: 'Operating costs',
  tax: 'Taxes',
  fine: 'Fines',
  saving: 'Not paid (corners cut)',
  deal: 'Deals with neighbors',
  setup: 'Setup and equipment',
  other: 'Other',
};

export interface LineGroup { kind: PnlKind; label: string; total: number; lines: PnlLine[] }

export const sumLines = (lines: PnlLine[]): number => lines.reduce((a, l) => a + l.amount, 0);

/** Groups in a fixed order; empty kinds are left out. Unknown kinds fall into "other". */
export function groupLines(lines: PnlLine[]): LineGroup[] {
  const byKind = new Map<PnlKind, PnlLine[]>();
  for (const l of lines) {
    const k: PnlKind = KIND_ORDER.includes(l.kind) ? l.kind : 'other';
    const list = byKind.get(k) ?? [];
    list.push(l);
    byKind.set(k, list);
  }
  return KIND_ORDER.filter((k) => byKind.has(k)).map((k) => {
    const ls = byKind.get(k)!;
    return { kind: k, label: KIND_LABEL[k], total: sumLines(ls), lines: ls };
  });
}

/** Does the month add up? The contract says the lines explain the whole cash change. */
export function monthAddsUp(m: MonthReport, tolerance = 1): { linesTotal: number; cashDelta: number; ok: boolean } {
  const linesTotal = sumLines(m.lines);
  const cashDelta = m.cashEnd - m.cashStart;
  return { linesTotal, cashDelta, ok: Math.abs(linesTotal - cashDelta) <= tolerance };
}

export interface TaxRow { taxId: string; name: string; amount: number; dueDay: number }

/** Unpaid liabilities, soonest first, with names from the packs. */
export function taxRows(b: BusinessState, pack: Pack | null, common: CommonPack | null): TaxRow[] {
  const names = new Map<string, string>();
  for (const t of [...(pack?.taxes ?? []), ...(common?.taxes ?? [])]) names.set(t.id, t.name);
  return b.liabilities
    .filter((l: TaxLiability) => !l.paid && l.amount > 0)
    .map((l) => ({ taxId: l.taxId, name: names.get(l.taxId) ?? l.taxId.replace(/_/g, ' '), amount: l.amount, dueDay: l.dueDay }))
    .sort((a, b2) => a.dueDay - b2.dueDay);
}

/** Taxes due in the next `withinDays` game days and whether cash covers them. */
export function taxCoverage(rows: TaxRow[], cash: number, today: number, withinDays = 30): { due: number; short: number; covered: boolean } {
  const due = rows.filter((r) => r.dueDay - today <= withinDays).reduce((a, r) => a + r.amount, 0);
  const short = Math.max(0, due - cash);
  return { due, short, covered: short === 0 };
}
