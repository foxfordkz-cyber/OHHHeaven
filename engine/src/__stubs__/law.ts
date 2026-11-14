// Stub of engine/src/law/index.ts (agent 03). Same signatures as build/CONTRACT.md, section 3.
// What it does: savings from shortcuts by `saves`, trails for shortcuts, lever options with `causes`
// and days open without a ready permit. No cases, no inspections, no fines.
import type { ActionResult, Action, BusinessState, Money, Pack, PackShortcut, PnlLine, ViolationTrail, WorldState } from '../../../shared/src/types';
import type { EngineCtx } from '../index';
import { RULES } from '../../../shared/src/rules';

export function lawActions(_w: WorldState, _ctx: EngineCtx, _playerId: string, a: Action): ActionResult | null {
  void a;
  return null;
}

export function lawDay(w: WorldState, _ctx: EngineCtx): WorldState {
  return w;
}

export function lawMonthClose(w: WorldState, _ctx: EngineCtx): WorldState {
  return w;
}

function shortcutDef(pack: Pack | undefined, ctx: EngineCtx, id: string): PackShortcut | undefined {
  return pack?.shortcuts.find((s) => s.id === id) ?? ctx.packs.common.shortcuts.find((s) => s.id === id);
}

function bump(trails: ViolationTrail[], violationId: string, saved: Money, month: number): ViolationTrail[] {
  const i = trails.findIndex((t) => t.violationId === violationId);
  if (i < 0) return [...trails, { violationId, months: 1, saved, lastActiveMonth: month, discovered: false }];
  const t = trails[i];
  const out = trails.slice();
  out[i] = { ...t, months: t.lastActiveMonth === month ? t.months : t.months + 1, saved: t.saved + saved, lastActiveMonth: month };
  return out;
}

export function shortcutSavings(
  b: BusinessState,
  ctx: EngineCtx,
  base: { payroll: Money; revenue: Money; rent: Money; staffCount: number },
  month: number,
): { lines: PnlLine[]; trails: ViolationTrail[] } {
  const pack = ctx.packs.niches[b.niche];
  const lines: PnlLine[] = [];
  let trails = b.trails.slice();
  for (const id of b.orders.shortcuts) {
    const s = shortcutDef(pack, ctx, id);
    if (!s) continue;
    const a = s.saves.amount;
    const saved =
      s.saves.basis === 'fixed' ? a
      : s.saves.basis === 'pct_payroll' ? a * base.payroll
      : s.saves.basis === 'pct_revenue' ? a * base.revenue
      : s.saves.basis === 'pct_rent' ? a * base.rent
      : a * base.staffCount;
    const amount = Math.round(saved * 100) / 100;
    lines.push({ id: `saving_${s.id}`, label: s.name, kind: 'saving', amount });
    trails = bump(trails, s.violation, amount, month);
  }
  if (pack) {
    for (const lever of pack.levers) {
      const opt = lever.options.find((o) => o.id === b.orders.levers[lever.id]);
      if (!opt?.causes) continue;
      const proper = Math.max(...lever.options.map((o) => o.monthlyCost));
      trails = bump(trails, opt.causes, Math.max(0, proper - opt.monthlyCost), month);
    }
    const monthEnd = month * RULES.DAYS_PER_MONTH;
    if (b.openedDay !== undefined && b.openedDay <= monthEnd) {
      for (const p of b.permits) {
        const item = pack.setup.find((s) => s.id === p.itemId);
        if (!item?.withoutItViolation) continue;
        const operatingFrom = Math.max(b.openedDay, monthEnd - RULES.DAYS_PER_MONTH + 1);
        if (p.readyDay > operatingFrom) trails = bump(trails, item.withoutItViolation, 0, month);
      }
    }
  }
  return { lines, trails };
}
