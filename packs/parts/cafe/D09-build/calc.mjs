// Arithmetic used in the fragment, computed once so that no number is typed by hand.
const pmt = (P, apr, n) => { const r = apr / 12; return P * r / (1 - Math.pow(1 + r, -n)); };
const bal = (P, apr, n, k) => { const r = apr / 12, p = pmt(P, apr, n); return P * Math.pow(1 + r, k) - p * (Math.pow(1 + r, k) - 1) / r; };
const brackets = (x, table) => { let t = 0, prev = 0; for (const [top, rate] of table) { if (x <= prev) break; t += (Math.min(x, top) - prev) * rate; prev = top; } return t; };
const FED = { single: [[12400, .10], [50400, .12], [105700, .22], [1e12, .24]], mfj: [[24800, .10], [100800, .12], [211400, .22], [1e12, .24]] };
const NYS = { single: [[8500, .039], [11700, .044], [13900, .0515], [80650, .054], [215400, .059], [1e12, .0685]], mfj: [[17150, .039], [23600, .044], [27900, .0515], [161550, .054], [323200, .059], [1e12, .0685]] };
const NYC = { single: [[12000, .03078], [25000, .03762], [50000, .03819], [1e12, .03876]], mfj: [[21600, .03078], [45000, .03762], [90000, .03819], [1e12, .03876]] };
function owner(P, status, otherWages, deps) {
  const se = P > 0 ? 0.9235 * P * 0.153 : 0, half = se / 2;
  const fedStd = status === 'mfj' ? 32200 : 16100, nyStd = status === 'mfj' ? 16050 : 8000;
  const fedTaxable = (biz) => { const agi = otherWages + (biz ? P - half : 0); const pre = Math.max(0, agi - fedStd); const qbi = biz && P > 0 ? Math.min(0.2 * (P - half), 0.2 * pre) : 0; return Math.max(0, pre - qbi); };
  const nyTaxable = (biz) => Math.max(0, otherWages + (biz ? P - half : 0) - nyStd - deps * 1000);
  const fed = brackets(fedTaxable(true), FED[status]) - brackets(fedTaxable(false), FED[status]);
  const nys = brackets(nyTaxable(true), NYS[status]) - brackets(nyTaxable(false), NYS[status]);
  const nyc = brackets(nyTaxable(true), NYC[status]) - brackets(nyTaxable(false), NYC[status]);
  const r = (x) => Math.round(x);
  return { profit: P, selfEmploymentTax: r(se), federalIncomeTax: r(fed), nysIncomeTax: r(nys), nycIncomeTax: r(nyc), incomeTaxTotal: r(fed + nys + nyc), incomeTaxShareOfProfit: +((fed + nys + nyc) / P).toFixed(3), allOwnerTax: r(se + fed + nys + nyc), allShareOfProfit: +((se + fed + nys + nyc) / P).toFixed(3) };
}
const ubt = (P) => { const allowance = Math.min(0.2 * Math.max(P, 0), 10000); const taxable = Math.max(0, P - allowance - 5000); const tax = 0.04 * taxable; const credit = tax <= 3400 ? tax : tax < 5400 ? tax * (5400 - tax) / 2000 : 0; return { taxable: Math.round(taxable), tax: Math.round(tax), credit: Math.round(credit), due: Math.round(tax - credit) }; };
const out = {
  sba100k: { payment: pmt(100000, .13, 120), balance12: bal(100000, .13, 120, 12), totalInterest: pmt(100000, .13, 120) * 120 - 100000, paymentAt1325: pmt(100000, .1325, 120) },
  micro50k: pmt(50000, .105, 72), family50k: pmt(50000, .0461, 60), lease25k: pmt(25000, .12, 60),
  honeycomb50k: pmt(50000, .125, 36),
  ownerSingle80: owner(80000, 'single', 0, 0), ownerMfj80: owner(80000, 'mfj', 90000, 2), ownerSingle117: owner(116628, 'single', 0, 0), ownerMfj117: owner(116628, 'mfj', 90000, 2),
  lossMfj: (() => { const L = -60000; const fedBefore = brackets(90000 - 32200, FED.mfj), fedAfter = brackets(Math.max(0, 90000 + L - 32200), FED.mfj); const nyB = brackets(90000 - 16050 - 2000, NYS.mfj), nyA = brackets(Math.max(0, 90000 + L - 16050 - 2000), NYS.mfj); const cB = brackets(90000 - 16050 - 2000, NYC.mfj), cA = brackets(Math.max(0, 90000 + L - 16050 - 2000), NYC.mfj); return { loss: L, federalSaved: Math.round(fedBefore - fedAfter), nysSaved: Math.round(nyB - nyA), nycSaved: Math.round(cB - cA), total: Math.round(fedBefore - fedAfter + nyB - nyA + cB - cA) }; })(),
  ubt100: ubt(100000), ubt117: ubt(116628), ubt150: ubt(150000), ubt200: ubt(200000),
  scorp: (() => { const P = 116628, sal = 60000; const llcSe = 0.9235 * P * 0.153; const u1 = ubt(P).due; const fica = sal * 0.153, sui = 0.041 * 17600 + 42; const left = P - sal - sal * 0.0765 - sui; const gct = 0.0885 * left; return { llc: { selfEmploymentTax: Math.round(llcSe), ubt: u1, total: Math.round(llcSe + u1) }, sCorp: { salary: sal, payrollTaxBothHalves: Math.round(fica), unemploymentTaxes: Math.round(sui), profitLeft: Math.round(left), nycGct: Math.round(gct), nysMinimum: 300, extraFees: 3000, total: Math.round(fica + sui + gct + 300 + 3000) }, savingBeforeFees: Math.round(llcSe + u1 - (fica + sui + gct + 300)), savingAfterFees: Math.round(llcSe + u1 - (fica + sui + gct + 300 + 3000)) }; })(),
  mca: (() => { const adv = 40000, back = 54000, m = 0.135 * 51000; const n = back / m; let lo = 0, hi = 1; for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; const pv = m * (1 - Math.pow(1 + mid, -n)) / mid; if (pv > adv) lo = mid; else hi = mid; } return { monthly: Math.round(m), months: +n.toFixed(1), monthlyRate: +lo.toFixed(4), aprNominal: +(lo * 12).toFixed(3), aprEffective: +(Math.pow(1 + lo, 12) - 1).toFixed(3) }; })(),
};
if (process.argv[1] && process.argv[1].endsWith('calc.mjs')) console.log(JSON.stringify(out, null, 1));
export default out;
