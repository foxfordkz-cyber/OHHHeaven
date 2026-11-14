// realWorldPlan: то, что человек унесёт в жизнь. Бюджет из того, что он купил; расходы из его книг;
// резерв на шесть месяцев постоянных расходов (без срезанных углов); документы; поставщики; три урока.
import type { BusinessState, Money, PackRoadmapStep, RealWorldPlan, WorldState } from '../../../shared/src/types';
import type { EngineCtx } from './link';
import { analyze, currentBasis, modelFor } from './analyze';
import { orderedSteps } from './roadmap';
import { packOf, r2, sumLines, violationsOf } from './model';
import { num, pct, usd } from './text';

export const DISCLAIMER = 'This is a training simulation, not legal, tax or financial advice. Rules, fees and wait times change; check them with the agencies listed and a licensed professional before you spend real money.';

function startupBudget(b: BusinessState, ctx: EngineCtx): { label: string; amount: Money }[] {
  const pack = packOf(ctx, b.niche);
  const lines = b.items.map((it) => {
    const def = pack.setup.find((d) => d.id === it.id);
    if (!def) return null;
    const amount = r2(def.cost * it.qty);
    return { label: it.qty > 1 ? `${def.name} × ${it.qty}` : def.name, amount };
  }).filter((x): x is { label: string; amount: Money } => !!x && x.amount > 0);
  if (!lines.length && b.setupSpent > 0) lines.push({ label: 'Setup (equipment, build-out, permits)', amount: r2(b.setupSpent) });
  return lines;
}

function monthlyFromBooks(b: BusinessState, w: WorldState, ctx: EngineCtx): { label: string; amount: Money }[] {
  const months = b.history.filter((m) => m.revenue > 0 || m.lines.length > 0);
  const skip = new Set(['fine', 'setup', 'tax', 'saving', 'revenue']);
  if (months.length) {
    const acc = new Map<string, number>();
    for (const m of months) for (const l of m.lines) {
      if (skip.has(l.kind) || l.amount >= 0) continue;
      acc.set(l.label, (acc.get(l.label) ?? 0) - l.amount);
    }
    return [...acc.entries()].map(([label, sum]) => ({ label, amount: r2(sum / months.length) })).sort((x, y) => y.amount - x.amount);
  }
  const basis = currentBasis(b, w);
  const cm = modelFor(b, w, ctx);
  const lines = [
    ...(basis.cogs > 0 ? [{ label: 'Cost of goods', amount: r2(basis.cogs) }] : []),
    ...cm.variableLines(basis.served, basis.revenue).map((l) => ({ label: l.label, amount: l.amount })),
    ...cm.fixed.map((l) => ({ label: l.label, amount: l.amount })),
  ];
  return lines.filter((l) => l.amount > 0).sort((x, y) => y.amount - x.amount);
}

function checklist(b: BusinessState, ctx: EngineCtx): PackRoadmapStep[] {
  const pack = packOf(ctx, b.niche);
  const steps = orderedSteps(ctx, b.niche).filter((s) => s.agency || s.link || s.fee != null);
  const covered = new Set(steps.map((s) => s.setupItemId).filter(Boolean));
  for (const d of pack.setup) {
    if (!(d.kind === 'permit' || d.kind === 'license') || covered.has(d.id)) continue;
    steps.push({ id: `item_${d.id}`, title: `Get: ${d.name}`, text: `Required before you open. Fee ${usd(d.cost)}.`, kind: 'permit', setupItemId: d.id, fee: d.cost, waitDays: d.waitDays, agency: d.agency, link: d.link });
  }
  return steps;
}

function lessons(b: BusinessState, w: WorldState, ctx: EngineCtx): RealWorldPlan['lessons'] {
  const pack = packOf(ctx, b.niche);
  const vs = violationsOf(ctx.packs.common, pack);
  const out: RealWorldPlan['lessons'] = [];
  const cardIds = new Set([...pack.ruleCards, ...ctx.packs.common.ruleCards].map((c) => c.id));
  // штрафы — по найденным нарушениям в делах
  for (const c of w.cases.filter((x) => x.businessId === b.id && (x.outcome === 'fined' || x.status === 'notice'))) {
    for (const f of c.found ?? []) {
      const v = vs.find((x) => x.id === f.violationId);
      out.push({ title: `Fine: ${v?.name ?? f.violationId}`, amount: r2(f.fine), lesson: `${v?.law ?? 'The law'} — the saving was not worth it. Fines grow every month the problem lasts.`, ruleCardId: cardIds.has(f.violationId) ? f.violationId : undefined });
    }
  }
  const fineLines = -b.history.flatMap((m) => m.lines).filter((l) => l.kind === 'fine').reduce((s, l) => s + l.amount, 0);
  if (!out.length && fineLines > 0) out.push({ title: 'Fines', amount: r2(fineLines), lesson: 'Every fine came from a corner you cut. Fix it before an inspector finds it.' });
  // потерянные продажи по причинам, в упущенной марже
  let size = 0, staff = 0, closure = 0;
  let rentOver = 0, laborOver = 0;
  for (const m of b.history) {
    const cogs = -m.lines.filter((l) => l.kind === 'cogs').reduce((s, l) => s + l.amount, 0);
    const margin = m.servedUnits > 0 ? Math.max(0, m.avgPrice - cogs / m.servedUnits) : 0;
    size += m.lost.size * margin; staff += m.lost.staff * margin; closure += m.lost.closure * margin;
    const rent = -m.lines.filter((l) => l.kind === 'rent').reduce((s, l) => s + l.amount, 0);
    const labor = -m.lines.filter((l) => l.kind === 'payroll' || l.kind === 'payroll_tax').reduce((s, l) => s + l.amount, 0);
    if (m.revenue > 0) { rentOver += Math.max(0, rent - pack.benchmarks.rentPct * m.revenue); laborOver += Math.max(0, labor - pack.benchmarks.laborPct * m.revenue); }
  }
  const lostUnits = (k: 'size' | 'staff' | 'closure') => b.history.reduce((s, m) => s + m.lost[k], 0);
  if (size > 0) out.push({ title: `Customers turned away: not enough ${pack.sizing.unitName}s`, amount: r2(size), lesson: `${num(lostUnits('size'))} ${pack.unit.name}s walked out because there was nowhere to sit. Size the room to the busiest hour, not the average.` });
  if (staff > 0) out.push({ title: 'Customers turned away: not enough staff', amount: r2(staff), lesson: `${num(lostUnits('staff'))} ${pack.unit.name}s were lost to the line. One more person on the busy shift often pays for itself.` });
  if (closure > 0) out.push({ title: 'Sales lost while closed', amount: r2(closure), lesson: 'Closed days still cost rent and wages. Permits and inspections decide when you can sell.' });
  if (rentOver > 0) out.push({ title: 'Rent above the norm', amount: r2(rentOver), lesson: `Rent should be near ${pct(pack.benchmarks.rentPct)} of sales. Negotiate, pick a cheaper block, or plan the sales that justify the address.` });
  if (laborOver > 0) out.push({ title: 'Labor above the norm', amount: r2(laborOver), lesson: `Labor should be near ${pct(pack.benchmarks.laborPct)} of sales. Schedule people to the hours that sell.` });
  return out.filter((l) => l.amount > 0).sort((x, y) => y.amount - x.amount).slice(0, 3);
}

export function realWorldPlan(b: BusinessState, w: WorldState, ctx: EngineCtx): RealWorldPlan {
  const pack = packOf(ctx, b.niche);
  const a = analyze(b, w, ctx);
  const cm = modelFor({ ...b, orders: { ...b.orders, shortcuts: [] } }, w, ctx);
  const startup = startupBudget(b, ctx);
  const monthly = monthlyFromBooks(b, w, ctx);
  return {
    niche: b.niche, businessName: b.name,
    startupBudget: startup, startupTotal: sumLines(startup),
    monthlyCosts: monthly, monthlyTotal: sumLines(monthly),
    reserveAdvised: r2(6 * sumLines(cm.fixed)),
    breakEvenUnitsMonth: a.breakEvenUnitsMonth, paybackMonths: a.paybackMonths,
    checklist: checklist(b, ctx), suppliers: pack.suppliers,
    lessons: lessons(b, w, ctx),
    disclaimer: DISCLAIMER,
  };
}
