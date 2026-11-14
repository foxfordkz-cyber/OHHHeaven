// Демо: npx tsx engine/src/analytics/demo.ts
// Примерное кафе на Bedford Ave проживает 45 дней (с одним срезанным углом и рискованной уборкой),
// затем печатаются аналитика, советы, план открытия, дорожная карта, личный план и распоряжения управляющего.
import type { WorldState } from '../../../shared/src/types';
import { sampleCtx, sampleWorld } from './__stubs__/fixtures';
import { tickDay } from './link';
import { GLOSSARY, analyze, managerOrders, realWorldPlan, recommend, recommendOpening, roadmapFor, whatIf } from './index';
import { pct, usd } from './text';

const ctx = sampleCtx();
let w: WorldState = sampleWorld();
w.businesses = w.businesses.map((b) => (b.id === 'b_me' ? { ...b, orders: { ...b.orders, shortcuts: ['cash_wages'], levers: { cleaning: 'minimal' } } } : b));
for (let i = 0; i < 45; i++) w = tickDay(w, ctx);
// впереди метель и снег, и уведомление о штрафе ждёт ответа
w = {
  ...w,
  events: [{ id: 'ev_blizzard', kind: 'weather', title: 'Blizzard warning', text: 'Heavy snow Thursday to Saturday.', announcedDay: 45, startDay: 48, endDay: 50, effects: [{ target: 'footTraffic', mult: 0.6 }], origin: 'deck' }],
  weather: [46, 47, 48, 49, 50, 51, 52, 53].map((d) => ({ day: d, tempF: d >= 48 && d <= 50 ? 24 : 38, condition: d >= 48 && d <= 50 ? 'snow' as const : 'cloudy' as const, footTrafficMult: d >= 48 && d <= 50 ? 0.6 : 1, label: d >= 48 && d <= 50 ? 'Snow' : 'Cloudy' })),
  cases: [{ id: 'case_1', businessId: 'b_me', role: 'inspector', origin: 'report', openedDay: 43, hints: ['1 complaint this month'], status: 'notice', officialId: 'off_ai_1', takenDay: 44, inspectDay: 45, found: [{ violationId: 'dirty_surfaces', months: 1, fine: 2800, closureDays: 0 }], fine: 2800, closureDays: 0, answerByDay: 47 }],
};
const me = w.businesses.find((b) => b.id === 'b_me')!;

const line = (s = '') => console.log(s);
line(`=== ${me.name} — day ${w.day} ===`);
const a = analyze(me, w, ctx);
const show: (keyof typeof a)[] = ['revenue', 'profit', 'cogsPct', 'laborPct', 'rentPct', 'primeCostPct', 'netMarginPct', 'fixedCostsMonth', 'contributionPerUnit', 'breakEvenUnitsMonth', 'breakEvenRevenueMonth', 'breakEvenPrice', 'utilization', 'sizeUtilization', 'lostSalesUnits', 'cashRunwayMonths', 'paybackMonths', 'exposure'];
for (const k of show) {
  const v = a[k];
  const txt = typeof v === 'number' ? (k.endsWith('Pct') || k.endsWith('ization') ? pct(v) : ['breakEvenUnitsMonth', 'lostSalesUnits', 'paybackMonths', 'cashRunwayMonths'].includes(k) ? String(v) : usd(v)) : String(v);
  line(`  ${GLOSSARY[k].label.padEnd(34)} ${txt}`);
}
line(`  ${'Next tax payment'.padEnd(34)} ${a.taxDueNext ? `${usd(a.taxDueNext.amount)} on day ${a.taxDueNext.day}` : 'none'}`);
line('  Benchmarks:');
for (const bm of a.benchmarks) line(`    ${bm.metric.padEnd(30)} you ${pct(bm.you).padStart(4)}  norm ${pct(bm.industry).padStart(4)}  ${bm.verdict}`);
line('  Key numbers: ' + a.nicheKpis.map((k) => `${k.label} ${k.unit === '$' ? usd(k.value) : k.value}`).join(' · '));

line('\n=== Recommendations ===');
const t0 = Date.now();
const recs = recommend(me, w, ctx);
for (const r of recs) line(`  [${r.severity}] ${r.title}${r.impact ? ` (${r.impact.profitDeltaMonth >= 0 ? '+' : ''}${usd(r.impact.profitDeltaMonth)}/mo)` : ''}\n      ${r.text}\n      → ${JSON.stringify(r.suggested)}`);
line(`  (${recs.length} recommendations in ${Date.now() - t0} ms)`);

line('\n=== What if: price $8.25 ===');
const wi = whatIf(w, ctx, 'b_me', { price: 8.25 });
line(`  revenue ${usd(wi.projected.revenue)}, profit ${usd(wi.projected.profit)}, served ${wi.projected.servedUnits}`);

line('\n=== Manager orders ===');
line('  ' + JSON.stringify(managerOrders(me, w, ctx)));

line('\n=== Opening plan for 102 Graham Ave ===');
for (const o of recommendOpening('cafe', 'p_graham_102', w, ctx)) {
  line(`  ${o.kitId}: ${o.size} seats, total ${usd(o.total)}, cash left ${usd(o.cashLeft)}, opens in ${o.daysToOpen} days, staff ${JSON.stringify(o.orders.staff)}`);
  for (const y of o.why) line(`     • ${y}`);
}

line('\n=== Roadmap (my cafe) ===');
for (const s of roadmapFor('cafe', me, w, ctx)) line(`  ${s.status.padEnd(7)} ${s.kind.padEnd(8)} ${s.title}${s.readyDay ? ` (ready day ${s.readyDay})` : ''}`);

line('\n=== Your real-world plan ===');
const plan = realWorldPlan(me, w, ctx);
line(`  Startup budget ${usd(plan.startupTotal)}:`);
for (const l of plan.startupBudget) line(`    ${l.label.padEnd(48)} ${usd(l.amount)}`);
line(`  Monthly costs ${usd(plan.monthlyTotal)}:`);
for (const l of plan.monthlyCosts.slice(0, 8)) line(`    ${l.label.padEnd(48)} ${usd(l.amount)}`);
line(`  Reserve advised (6 months of fixed costs): ${usd(plan.reserveAdvised)}`);
line(`  Break-even: ${plan.breakEvenUnitsMonth} orders/month; payback: ${plan.paybackMonths ?? 'n/a'} months`);
line(`  Documents: ${plan.checklist.map((s) => `${s.title}${s.agency ? ` (${s.agency}${s.fee != null ? `, ${usd(s.fee)}` : ''})` : ''}`).join('; ')}`);
line(`  Suppliers: ${plan.suppliers.map((s) => s.category).join(', ')}`);
line('  Lessons:');
for (const l of plan.lessons) line(`    ${l.title}: ${usd(l.amount)} — ${l.lesson}`);
line(`  ${plan.disclaimer}`);
