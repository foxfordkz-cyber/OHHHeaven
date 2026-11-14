import { cafe, fixturePlace, fixtureSource, main, metadata, save, simulate } from './harness';

main(() => {
  // Preserve the original 4 × 5 × 7 grid. These are test choices, not claims about NYC distributions.
  const grid = { seats: [12, 18, 19, 24], staff: [2, 3, 4, 5, 6], price: [7.5, 8.5, 9.5, 10.5, 11.5, 13, 16] };
  const rows = [];
  for (const size of grid.seats) for (const staff of grid.staff) for (const price of grid.price) {
    rows.push(simulate([{ label: `${size} seats / ${staff} baristas / $${price}`, size, price,
      kit: size >= 20 ? 'premium' : 'standard', staff: { barista: staff, shift_lead: 0 } }]).summaries[0]);
  }
  const ranked = [...rows].sort((a, b) => b.netWorth - a.netWorth || a.label.localeCompare(b.label));
  const result = { metadata: metadata({ fixture: fixtureSource, place: fixturePlace(), grid }),
    count: rows.length, bankrupt: rows.filter(r => r.status === 'bankrupt').length,
    millionaires: rows.filter(r => r.netWorth >= 1_000_000).length, startingCapital: cafe.startCapital,
    ranking: 'End-of-season net worth; profit is also reported. No claim of a global optimum.', best: ranked.slice(0, 12), rows };
  console.table(rows.map(r => ({ profile: r.label, status: r.status, openedDay: r.openedDay, cash: r.cash, netWorth: r.netWorth, profit: r.profit, served: r.served })));
  console.log(`Grid: ${result.count}; bankrupt: ${result.bankrupt}; net worth >= $1m: ${result.millionaires}. Best: ${ranked[0].label}`);
  save('sweep.results.json', result);
});
