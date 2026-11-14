import { footfallDemand, marketParams } from '../../engine/src/index';
import { footfallParams } from '../../shared/src/index';
import type { MonthReport } from '../../shared/src/types';
import { act, applyAction, cafe, CENT, fixturePlace, fixtureSource, itemsCost, main, metadata, netWorth, places, round, run, save, setup, simulate, summary, RULES } from './harness';

interface Probe { id: string; pass: boolean; criterion: string; numbers: unknown }
const close = (a: number, b: number) => Math.abs(a - b) < CENT;
const cost = (m: MonthReport) => round(-m.lines.filter(l => l.id.startsWith('lever_')).reduce((s, l) => s + l.amount, 0));

main(() => {
  const probes: Probe[] = [];
  const check = (p: Probe) => { probes.push(p); console.log(`${p.pass ? 'PASS' : 'FAIL'} ${p.id}: ${p.criterion}\n${JSON.stringify(p.numbers)}`); };
  const f = footfallParams(cafe);
  if (!f) throw new Error('Missing cafe.extra.footfall; saturation cannot use the intended model');
  const market = [1, 10, 100].map(n => {
    const xs = Array.from({ length: n }, (_, i) => ({
      id: `cafe-${i}`, price: cafe.unit.refPrice, quality: 0.5, reputation: 0.5, footTraffic: 0.5,
      marketing: 0, awareness: 1, place: { ...fixturePlace(), id: `colocated-${i}` },
    }));
    const { demand } = footfallDemand(cafe, f, marketParams(cafe), xs);
    return { cafes: n, firstDemandMonth: demand[0], totalDemandMonth: demand.reduce((s, x) => s + x, 0) };
  });
  const ceiling = fixturePlace().pedestriansPerDay! * RULES.DAYS_PER_MONTH * f.captureRate * (1 + f.outside);
  const integrated = [1, 10, 100].map(n => {
    const test = simulate(Array.from({ length: n }, (_, i) => ({ label: `Cafe ${i}`, place: { ...fixturePlace(), id: `colocated-${i}` } })), 30, undefined, true);
    return { cafes: n, firstDemand: test.summaries[0].demand, firstProfit: test.summaries[0].profit, totalDemand: test.summaries.reduce((s, r) => s + r.demand, 0) };
  });
  check({ id: 'market_1_10_100', pass: market[0].firstDemandMonth > market[1].firstDemandMonth && market[1].firstDemandMonth > market[2].firstDemandMonth && market.every(r => r.totalDemandMonth <= ceiling + CENT)
      && integrated[0].firstDemand > integrated[1].firstDemand && integrated[1].firstDemand > integrated[2].firstDemand,
    criterion: 'Co-located identical cafes lose individual demand in the public demand function AND through tickDay; aggregate direct demand stays below the fixed local pool.', numbers: { direct: market, integratedFirstMonth: integrated, localPoolCeiling: ceiling } });

  const teams = [{ barista: 4, shift_lead: 0 }, { barista: 3, shift_lead: 1 }];
  const busy = { ...fixturePlace(), pedestriansPerDay: Math.max(...places.filter(p => p.suitableFor.includes('cafe')).map(p => p.pedestriansPerDay ?? 0)) };
  const roles = teams.map((staff, i) => simulate([{ label: i ? 'Three baristas and a lead' : 'Four baristas', kit: 'premium', size: 24, staff, place: busy }], 90, undefined, true).summaries[0]);
  const useful = roles[1].served > roles[0].served || roles[1].quality > roles[0].quality + Number.EPSILON || roles[1].months[2].capacity > roles[0].months[2].capacity;
  check({ id: 'shift_lead', pass: useful, criterion: 'At equal headcount the lead improves served orders, quality or capacity under load; a higher wage alone is not a benefit.', numbers: roles });

  const paid: Record<string, string> = {}, cheap: Record<string, string> = {};
  let high = 0, low = 0;
  for (const l of cafe.levers) {
    const legal = l.options.filter(o => !o.causes).sort((a, b) => a.monthlyCost - b.monthlyCost);
    if (!legal.length) continue;
    cheap[l.id] = legal[0].id; paid[l.id] = legal.at(-1)!.id;
    low += legal[0].monthlyCost; high += legal.at(-1)!.monthlyCost;
  }
  if (high <= low) throw new Error('No paid legal lever to test');
  const honest = simulate([{ label: 'Paid throughout', levers: paid }], 90, undefined, true);
  const switched = simulate([{ label: 'Cheap on closing day', levers: paid }], 90,
    (w, ctx) => act(w, ctx, 0, { type: 'set_orders', orders: { levers: (w.day + 1) % RULES.DAYS_PER_MONTH === 0 ? cheap : paid } }), true);
  const expectedSwitched = ((RULES.DAYS_PER_MONTH - 1) * high + low) / RULES.DAYS_PER_MONTH;
  const leverRows = [2, 3].map(month => {
    const a = honest.w.businesses[0].history.find(m => m.month === month)!;
    const b = switched.w.businesses[0].history.find(m => m.month === month)!;
    return { month, honestCost: cost(a), switchedCost: cost(b), expectedHonest: high, expectedSwitched: round(expectedSwitched), cashReconciliationError: round(b.lines.reduce((s, l) => s + l.amount, 0) - (b.cashEnd - b.cashStart)) };
  });
  // Each lever is rounded independently at month close: at most half a cent per line.
  const roundingBudget = cafe.levers.length * 0.005 + CENT;
  check({ id: 'month_close_levers', pass: leverRows.every(r => close(r.honestCost, high) && Math.abs(r.switchedCost - expectedSwitched) <= roundingBudget && close(r.cashReconciliationError, 0)),
    criterion: 'One cheap closing day saves one day of cost, not the whole month; lines reconcile to cash.', numbers: { paid, cheap, roundingBudget, rows: leverRows } });

  const start = setup([{ label: 'Lender' }, { label: 'Borrower' }], true);
  const before = run(start.w, start.ctx, 40);
  const amount = 30000; // Original audit transaction; controlled input, not a market lending quote.
  let loan = act(before, start.ctx, 0, { type: 'propose_deal', toBusinessId: before.businesses[1].id, terms: { type: 'loan', amount, monthlyRatePct: 0, months: 6 } });
  loan = act(loan, start.ctx, 1, { type: 'answer_deal', dealId: loan.deals.at(-1)!.id, accept: true });
  const immediateCash = loan.businesses[1].cash - before.businesses[1].cash;
  const plain = run(before, start.ctx, 60), financed = run(loan, start.ctx, 60);
  const loanRows = plain.businesses.map((b, i) => {
    const a = b.history[1], f = financed.businesses[i].history[1];
    return { business: b.name, revenueWithout: a.revenue, revenueWith: f.revenue, profitWithout: a.profit, profitWith: f.profit, taxesWithout: a.taxesAccrued, taxesWith: f.taxesAccrued,
      principalLines: f.lines.filter(l => /loan|principal/.test(l.id)), cashReconciliationError: round(f.lines.reduce((s, l) => s + l.amount, 0) - (f.cashEnd - f.cashStart)) };
  });
  check({ id: 'loan_is_not_profit', pass: close(immediateCash, amount) && loanRows.every(r => close(r.revenueWithout, r.revenueWith) && close(r.profitWithout, r.profitWith) && close(r.taxesWithout, r.taxesWith) && close(r.cashReconciliationError, 0)),
    criterion: 'Zero-interest principal moves cash but changes neither revenue, profit nor accrued tax for lender or borrower.', numbers: { amount, immediateCash, rows: loanRows } });

  const bad = setup([{ label: 'Deliberately unaffordable payroll', price: cafe.unit.priceMax,
    place: { ...fixturePlace(), pedestriansPerDay: Math.min(...places.filter(p => p.suitableFor.includes('cafe') && (p.pedestriansPerDay ?? 0) > 0).map(p => p.pedestriansPerDay!)) },
    staff: { barista: cafe.capacity.maxStaff, shift_lead: 0 } }]);
  let broke = bad.w;
  while (broke.day < 330 && broke.businesses[0].status !== 'bankrupt') broke = run(broke, bad.ctx, broke.day + 1);
  if (broke.businesses[0].status !== 'bankrupt') throw new Error('Bankruptcy setup did not fail; update the stress scenario, do not report a vacuous PASS');
  const remaining = Math.max(0, netWorth(broke.businesses[0], bad.ctx));
  const kit = cafe.kits.find(k => k.id === 'lean')!;
  const reopenCost = itemsCost(cafe, kit.items, kit.size, bad.ctx.places[0]);
  const retried = applyAction(broke, bad.ctx, broke.players[0].id, { type: 'open_business', niche: 'cafe', placeId: bad.ctx.places[0].id, name: 'Second attempt', kitId: kit.id, size: kit.size });
  const second = retried.world.businesses[1];
  const conserved = remaining < reopenCost
    ? !!retried.error?.includes('Not enough money') && retried.world === broke
    : !retried.error && !!second && close(second.cash + second.setupSpent, remaining);
  check({ id: 'no_second_starting_capital', pass: conserved && !close(remaining, cafe.startCapital),
    criterion: 'After an actual simulated bankruptcy, reopening uses residual net worth or is rejected for lack of funds.', numbers: { bankrupt: summary(broke.businesses[0], bad.ctx), originalCapital: cafe.startCapital, remaining, reopenCost, error: retried.error ?? null, secondCapital: second ? round(second.cash + second.setupSpent) : null } });

  save('probes.results.json', { metadata: metadata({ fixture: fixtureSource }), pass: probes.every(p => p.pass), probes });
  process.exitCode = probes.every(p => p.pass) ? 0 : 1;
});
