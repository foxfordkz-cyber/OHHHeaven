// D14 — worked examples for the four mechanics, computed from packs/cafe.json the way
// engine/src/economy/month.ts closes a month. Not engine code: a calculator so the numbers in
// D14-mechanics-spec.md can be re-run. Usage: node packs/parts/cafe/D14-examples.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const pack = JSON.parse(readFileSync(join(here, '../../cafe.json'), 'utf8'));
const common = JSON.parse(readFileSync(join(here, '../../_common.json'), 'utf8'));
const frag = JSON.parse(readFileSync(join(here, 'D14-mechanics.json'), 'utf8'));
const X = frag.extra;

const D = 30;
const r0 = (x) => Math.round(x);
const usd = (x) => (x < 0 ? '-$' : '$') + Math.abs(r0(x)).toLocaleString('en-US');

// employer payroll taxes the engine accrues (payroll base), without the yearly wage-base caps (one month)
const payrollTaxRate = common.taxes.filter((t) => t.base === 'payroll').reduce((a, t) => a + t.rate, 0);

/** One month of a cafe, like economyMonthClose: lines in dollars. */
function month({ daysOpen, orders, baristas = 4, seats = 18, rentBase, rentLabel = 'Rent', extra = [], price = pack.unit.refPrice, setupCosts = [] }) {
  const openShare = daysOpen / D;
  const revenue = orders * price;
  const lines = [];
  const add = (label, amount) => { if (Math.abs(amount) >= 0.5) lines.push([label, amount]); };
  add('Sales', revenue);
  add('Cost of goods', -orders * pack.unit.cogsPerUnit);
  add(rentLabel, -rentBase);
  const barista = pack.staff.find((s) => s.id === 'barista');
  const wages = baristas * barista.hourlyWage * barista.hoursPerMonth * openShare;
  add('Wages', -wages);
  add('Employer payroll taxes', -wages * payrollTaxRate);
  for (const c of pack.monthlyCosts) {
    if (c.kind === 'rent') continue;
    const amt = c.basis === 'fixed' ? c.amount * openShare
      : c.basis === 'per_staff' ? c.amount * baristas * openShare
      : c.basis === 'per_unit' ? c.amount * orders
      : c.basis === 'pct_revenue' ? c.amount * revenue
      : c.amount * seats * openShare;
    add(c.name, -amt);
  }
  add('Cleaning per seat', -pack.sizing.cleaningCostPerSizeMonth * seats * openShare);
  for (const l of pack.levers) {
    const o = l.options.find((x) => !x.causes) ?? l.options[0];
    add(`${l.name}: ${o.label}`, -o.monthlyCost * openShare);
  }
  for (const [label, amt] of setupCosts) add(label, amt);
  for (const [label, amt] of extra) add(label, amt);
  const profit = lines.reduce((a, [, v]) => a + v, 0);
  return { revenue, profit, lines };
}

// sanity check against pack.extra.referenceMonth (engine-computed): profit before owner taxes 9,719
const ref = month({ daysOpen: 30, orders: 6000, rentBase: 6000 });
console.log(`Reference month: sales ${usd(ref.revenue)}, profit before owner taxes ${usd(ref.profit)} (pack.extra.referenceMonth says $9,719)`);

/** keen-cray awareness ramp (shared/src/place.ts awarenessAt): share of the regular crowd `t` days after opening. */
const awareness = (t, start, ramp = 75) => start + (1 - start) * (1 - Math.exp(-Math.max(0, t) / ramp));
/** Orders in days [from, to] (game days) of a shop that opened on `opened` with full demand `full` a day. */
function ordersBetween(from, to, opened, full, start) {
  let n = 0;
  for (let d = Math.max(from, opened); d <= to; d++) n += full * awareness(d - opened, start);
  return Math.round(n);
}

const out = [];
const P = (s = '') => out.push(s);

// ───────────── Mechanic 1: months before opening ─────────────
{
  const po = X.preOpening;
  const market = 6000;               // pack reference rent, 800 sq ft mid tier
  const signed = 1;                  // Jan 1
  const build = 60;                  // keen-cray: former cafe, light renovation
  const fse = 21;                    // pack fse_permit.waitDays, starts after the build-out
  const open = signed + build + fse; // day 82
  P('## Mechanic 1: months before opening');
  P(`Signed day ${signed} (Jan 1). Build-out ends day ${signed + build - 1}; health permit ready day ${open}; doors open day ${open} (Mar 22).`);
  for (const opt of po.leaseOptions) {
    const face = market * opt.faceRentMult;
    const freeUntil = signed + opt.freeRentMonths * D - 1;
    let cum = 0; const rows = [];
    for (let m = 1; m <= 3; m++) {
      const a = (m - 1) * D + 1, b = m * D;
      let baseDays = 0;
      for (let d = a; d <= b; d++) if (d > freeUntil) baseDays++;
      const rent = face * baseDays / D;
      const daysOpen = Math.max(0, b - Math.max(a, open) + 1);
      const orders = daysOpen > 0 ? ordersBetween(a, b, open, 200, 0.35) : 0;
      const setupDays = D - daysOpen;
      const setupCosts = po.setupCostShares.map((s) => {
        const c = pack.monthlyCosts.find((x) => x.id === s.costId);
        return [`${c.name} (before opening)`, -c.amount * s.share * setupDays / D];
      });
      const mo = month({ daysOpen, orders, rentBase: rent, setupCosts });
      cum += mo.profit;
      rows.push({ m, rent, orders, sales: mo.revenue, setup: setupCosts.reduce((x, [, v]) => x + v, 0), profit: mo.profit, cum });
    }
    P(`\nLease "${opt.id}": ${opt.freeRentMonths} free months, face rent ${usd(face)}`);
    P('| Month | Base rent | Other costs before opening | Orders | Sales | Profit | Cash used so far |');
    P('|---|---|---|---|---|---|---|');
    for (const r of rows) P(`| ${r.m} | ${usd(r.rent)} | ${usd(-r.setup)} | ${r.orders} | ${usd(r.sales)} | ${usd(r.profit)} | ${usd(r.cum)} |`);
    const term = po.termMonths;
    P(`Total base rent over the ${term}-month term: ${usd(face * (term - opt.freeRentMonths))}`);
  }
  // the whole first season (12 months): what free rent is worth, and what the rest of the lease owes
  P('\nFirst season (12 months) and the rest of the lease (netWorth += (market - face) x months left):');
  P('| Lease | Base rent paid in the season | Lease value at season end | Season rent minus lease value |');
  P('|---|---|---|---|');
  for (const opt of po.leaseOptions) {
    const face = market * opt.faceRentMult;
    const paid = face * Math.max(0, 12 - opt.freeRentMonths);
    const value = (market - face) * (po.termMonths - 12);
    P(`| ${opt.id} | ${usd(paid)} | ${usd(value)} | ${usd(paid - value)} |`);
  }
  // the current engine: rent from signing, no free rent, nothing else before opening
  let cum = 0;
  P('\nCurrent engine (main branch + keen-cray): rent from day 1, no free months, no other cost before opening');
  P('| Month | Rent | Orders | Sales | Profit | Cash used so far |'); P('|---|---|---|---|---|---|');
  for (let m = 1; m <= 3; m++) {
    const a = (m - 1) * D + 1, b = m * D;
    const daysOpen = Math.max(0, b - Math.max(a, open) + 1);
    const orders = daysOpen > 0 ? ordersBetween(a, b, open, 200, 0.35) : 0;
    const mo = month({ daysOpen, orders, rentBase: market });
    cum += mo.profit;
    P(`| ${m} | ${usd(market)} | ${orders} | ${usd(mo.revenue)} | ${usd(mo.profit)} | ${usd(cum)} |`);
  }
  // work without a permit
  const wwp = po.dobPermitDays;
  P(`\nShortcut "start_work_before_permit": construction starts ${wwp} days earlier -> doors open day ${open - wwp}. If found: fine ${usd(frag.violations.find((v) => v.id === 'work_without_permit').fine.base)} and the ${frag.violations.find((v) => v.id === 'work_without_permit').closureDays} days come back: doors open day ${open} again.`);
  // start-up costs, IRC 195
  const s195 = po.startupCostDeduction;
  for (const startup of [9000, 30000, 60000]) {
    const immediate = Math.max(0, s195.immediate - Math.max(0, startup - s195.phaseOutFrom));
    const amort = (startup - immediate) / s195.amortMonths;
    P(`Start-up costs ${usd(startup)}: deductible in the opening month ${usd(immediate)}, then ${usd(amort)} a month for ${s195.amortMonths} months (IRC 195).`);
  }
}

// ───────────── Mechanic 2: buy an operating business ─────────────
{
  const t = X.takeoverRules;
  P('\n## Mechanic 2: buy an operating cafe vs. build one');
  // seller: an established shop at the same reference address, 200 orders a day
  const sellerMonth = month({ daysOpen: 30, orders: 6000, rentBase: 6000 });
  const sde = sellerMonth.profit * 12;   // seller's discretionary earnings: owner works, no manager, before owner taxes
  const byEarnings = t.earningsMultiple * sde;
  const salesYear = sellerMonth.revenue * 12;
  const cap = t.revenueMultipleCap * salesYear;
  const ffe = 27187;                     // standard kit furniture and equipment at pack prices
  const floor = t.floorShareOfReplacement * (70000 + 7000 + ffe);
  const price = Math.round(Math.min(cap, Math.max(floor, byEarnings)) / 1000) * 1000;
  const asking = Math.round(price / t.saleToAskRatio / 1000) * 1000;
  P(`Seller at the reference address: sales ${usd(salesYear)} a year, earnings before owner pay and taxes (SDE) ${usd(sde)} a year.`);
  P(`Price = ${t.earningsMultiple} x SDE = ${usd(byEarnings)}; floor ${usd(floor)}; cap ${t.revenueMultipleCap} x sales = ${usd(cap)} -> price ${usd(price)}, asking ${usd(asking)} (sale/ask ${t.saleToAskRatio}).`);
  P(`keen-cray rule (0.2 x sales, $80k-$200k) would ask ${usd(Math.min(200000, Math.max(80000, 0.2 * salesYear)))}.`);
  const down = price * (1 - t.sellerNote.maxShare);
  const note = price - down;
  const r = t.sellerNote.annualRate / 12, n = t.sellerNote.months;
  const pay = note * r / (1 - Math.pow(1 + r, -n));
  P(`Seller note: ${usd(note)} at ${t.sellerNote.annualRate * 100}% over ${n} months = ${usd(pay)} a month; down payment ${usd(down)}.`);
  const closing = Math.max(t.bulkSaleNoticeDays, t.fsePermitDays, t.landlordConsentDays);
  P(`Closing day = max(bulk-sale notice ${t.bulkSaleNoticeDays}, own health permit ${t.fsePermitDays}, landlord consent ${t.landlordConsentDays}) = day ${closing + 1}; the seller runs the shop and pays the rent until then.`);
  // three months, buyer's view
  const paths = [
    { id: 'scratch_light', label: 'Empty former cafe, build', open: 82, start: 0.35, rentFrom: 1, upfront: 141166 },
    { id: 'takeover', label: 'Buy the operating cafe', open: closing + 1, start: t.awarenessKeepName, rentFrom: closing + 1, upfront: down + 18000 + 3000 + 4000 + 1675 + 3500 + t.dueDiligenceCost + 2500 + 280 + 24, notePay: pay, debt: note },
    { id: 'takeover_rebrand', label: 'Buy it and rebrand', open: closing + 1, start: t.awarenessRebrand, rentFrom: closing + 1, upfront: down + 18000 + 3000 + 4000 + 1675 + 3500 + t.dueDiligenceCost + 2500 + 280 + 24 + t.rebrandCost, notePay: pay, debt: note },
  ];
  P('\n| Path | Paid before the first sale | Opens | M1 orders | M1 profit | M2 orders | M2 profit | M3 orders | M3 profit | Cash change after 3 months | Note left | netWorth today | netWorth with goodwill |');
  P('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const p of paths) {
    let cash = -p.upfront; const cells = []; let lastProfit = 0; let notePaid = 0;
    for (let m = 1; m <= 3; m++) {
      const a = (m - 1) * D + 1, b = m * D;
      const daysOpen = Math.max(0, b - Math.max(a, p.open) + 1);
      const rentDays = Math.max(0, b - Math.max(a, p.rentFrom) + 1);
      const orders = daysOpen > 0 ? ordersBetween(a, b, p.open, 200, p.start) : 0;
      const extra = p.notePay && rentDays > 0 ? [['Seller note payment', -p.notePay * rentDays / D]] : [];
      const mo = month({ daysOpen, orders, rentBase: 6000 * rentDays / D, extra });
      cash += mo.profit;
      lastProfit = mo.profit - extra.reduce((x, [, v]) => x + v, 0);
      if (extra.length) notePaid += -extra[0][1];
      cells.push(orders, usd(mo.profit));
    }
    // principal left on the note after the payments made (annuity)
    let bal = p.debt ?? 0;
    if (p.debt) { const months = notePaid / p.notePay; for (let k = 0; k < Math.floor(months); k++) bal = bal * (1 + t.sellerNote.annualRate / 12) - p.notePay; const f = months - Math.floor(months); bal = bal * (1 + f * t.sellerNote.annualRate / 12) - f * p.notePay; }
    const items = p.id === 'scratch_light' ? ffe : ffe * 0.5;   // a bought shop's furniture and machines are half-way through their life
    const nw = 224000 + cash + 0.5 * items - bal;
    const goodwill = t.goodwillInNetWorth.share * t.earningsMultiple * lastProfit * 12;
    P(`| ${p.label} | ${usd(p.upfront)} | day ${p.open} | ${cells.join(' | ')} | ${usd(cash)} | ${usd(bal)} | ${usd(nw)} | ${usd(nw + Math.max(0, goodwill))} |`);
  }
  // twelve months on the same rules (no events, no weather)
  P('\nTwelve months on the same rules:');
  P('| Path | Cash change after 12 months | Note left | Profit in month 12 (after note) |'); P('|---|---|---|---|');
  for (const p of paths) {
    let cash = -p.upfront, bal = p.debt ?? 0, last = 0;
    for (let m = 1; m <= 12; m++) {
      const a = (m - 1) * D + 1, b = m * D;
      const daysOpen = Math.max(0, b - Math.max(a, p.open) + 1);
      const rentDays = Math.max(0, b - Math.max(a, p.rentFrom) + 1);
      const orders = daysOpen > 0 ? ordersBetween(a, b, p.open, 200, p.start) : 0;
      const payNow = p.notePay && rentDays > 0 ? p.notePay * rentDays / D : 0;
      if (payNow) bal = bal * (1 + (rentDays / D) * t.sellerNote.annualRate / 12) - payNow;
      const mo = month({ daysOpen, orders, rentBase: 6000 * rentDays / D, extra: payNow ? [['Seller note payment', -payNow]] : [] });
      cash += mo.profit; last = mo.profit;
    }
    P(`| ${p.label} | ${usd(cash)} | ${usd(bal)} | ${usd(last)} |`);
  }
  P('netWorth today = $224,000 start + cash change + 0.5 x furniture and equipment (bought ones at half their price) - note left. With goodwill: + 0.5 x 2.0 x month-3 earnings x 12 (before the note).');
}

// ───────────── Mechanic 3: floor area and crowding ─────────────
{
  const z = X.floorZones;
  P('\n## Mechanic 3: floor area and crowding');
  const sqft = 800;
  const boh = sqft * z.backOfHouseShare;
  for (const dens of z.densities) {
    for (const queueSlots of [6]) {
      const restroomIf = (seats) => (seats >= 20 ? z.restroomSqft : 0);
      let seats = 0;
      for (let s = 1; s <= 60; s++) {
        const used = boh + z.barSqft + restroomIf(s) + queueSlots * z.queueSqftPerPerson + s * dens.sqftPerSeat;
        if (used <= sqft) seats = s;
      }
      const load = Math.ceil((seats * dens.sqftPerSeat) / 15 + (queueSlots * z.queueSqftPerPerson) / 5);
      P(`${dens.id} (${dens.sqftPerSeat} sq ft a seat): back of house ${r0(boh)}, bar ${z.barSqft}, queue ${queueSlots} x ${z.queueSqftPerPerson} -> ${seats} seats${seats >= 20 ? ' (needs the customer restroom)' : ''}; code occupant load about ${load}.`);
    }
  }
  P(`Current engine: floor(800 x 0.6 / 18) = ${Math.floor(800 * 0.6 / 18)} seats, no area for the bar, the queue or the restroom.`);

  // the busiest 15 minutes of each rush hour
  const prof = z.hourProfile;
  const perBarista = z.ordersPerBaristaHourPeak;
  const machineCap = z.machineOrdersPerHour;
  const tol = z.waitToleranceCdf;
  const cdf = (w) => {   // linear between the survey points, 0 at 0 minutes
    let pm = 0, ps = 0;
    for (const [m, sh] of tol) { if (w <= m) return ps + (sh - ps) * (w - pm) / (m - pm); pm = m; ps = sh; }
    return 1;
  };
  function day(ordersIn, baristasOnPeak, seats, queueSlots, outsideBalk, dwellH, staff = 99) {
    // the engine's daily cap on paid hours stays: staff x 1,700 / 30 orders a day
    const hoursCap = staff * pack.capacity.unitsPerStaffMonth / D;
    const orders = Math.min(ordersIn, hoursCap);
    const lostHours = ordersIn - orders;
    let lostQueue = 0, lostSeat = 0, worstLine = 0, worstWait = 0, peakUtil = 0;
    const cap = Math.min(machineCap, baristasOnPeak * perBarista);           // orders an hour the bar can make
    for (const [, share] of prof) {
      const hourly = orders * share;
      const rate15 = hourly / z.peak15Factor;                                  // arrival rate in the busiest quarter-hour
      const arrive15 = rate15 / 4;
      const line = Math.max(0, (rate15 - cap) / 4);                            // people still waiting when the quarter ends
      const waitMin = (60 * line) / cap;
      const outside = Math.max(0, line - queueSlots);
      const lost = Math.min(line, arrive15 * cdf(waitMin / 2) + outside * outsideBalk);
      lostQueue += lost;
      worstLine = Math.max(worstLine, line); worstWait = Math.max(worstWait, waitMin);
      const dineIn = (hourly - lost) * (1 - pack.sizing.takeawayShare);
      const occupied = dineIn * dwellH;                                        // Little's law over the hour
      const noSeat = Math.max(0, occupied - seats) / dwellH;
      lostSeat += noSeat * (1 - z.noSeatTakesAway);
      peakUtil = Math.max(peakUtil, (Math.min(occupied, seats) + Math.min(line, queueSlots)) / (seats + queueSlots));
    }
    return { lostHours: r0(lostHours), total: r0(lostHours + lostQueue + lostSeat), lq: lostQueue, lostQueue: r0(lostQueue), lostSeat: r0(lostSeat), line: r0(worstLine), wait: r0(worstWait), peakUtil: Math.round(peakUtil * 100) };
  }
  const engineLost = (orders, seats, staff) => {
    const sizeCapDay = seats * pack.sizing.unitsServedPerSizeMonth / D / (1 - pack.sizing.takeawayShare);
    const staffCapDay = staff * pack.capacity.unitsPerStaffMonth / D;
    const lost = r0(Math.max(0, orders - Math.min(sizeCapDay, staffCapDay)));
    return sizeCapDay <= staffCapDay ? `${lost} (seats)` : `${lost} (staff hours)`;
  };
  P('\nMorning rush 7-10 am, busiest quarter-hour of each hour, 18 seats, 6 people of queue room, dwell 0.5 h.');
  P('Demand levels: the pack reference (200 a day) and keen-cray footfall demand at two real map blocks (ev-003: 341, ev-028: 442 a day).');
  P('| Orders a day | Staff (on the rush) | Lost to paid hours (both models) | Longest line | Longest wait, min | Lost in the line | Lost for want of a seat | New total lost | Peak use of room | Current engine loses |');
  P('|---|---|---|---|---|---|---|---|---|---|');
  for (const [orders, staff, bar] of [[200, 4, 1], [200, 4, 2], [341, 4, 2], [341, 6, 2], [341, 6, 3], [442, 8, 2], [442, 8, 3], [442, 8, 4]]) {
    const r = day(orders, bar, 18, 6, z.outsideBalk.normal, z.dwellHours.standard, staff);
    P(`| ${orders} | ${staff} (${bar}) | ${r.lostHours} | ${r.line} | ${r.wait} | ${r.lostQueue} | ${r.lostSeat} | ${r.total} | ${r.peakUtil}% | ${engineLost(orders, 18, staff)} |`);
  }
  const kiosk = day(200, 2, 6, 4, z.outsideBalk.normal, z.dwellHours.standard, 4);
  const kiosk1 = day(200, 1, 6, 4, z.outsideBalk.normal, z.dwellHours.standard, 4);
  P(`\nCounter shop, 6 seats, 4 staff (2 on the rush), 200 orders a day: longest line ${kiosk.line}, lost in line ${kiosk.lostQueue}, for want of a seat ${kiosk.lostSeat}; with 1 on the rush: line ${kiosk1.line}, wait ${kiosk1.wait} min, lost ${kiosk1.lostQueue}. Current engine caps it at ${r0(6 * pack.sizing.unitsServedPerSizeMonth / D / (1 - pack.sizing.takeawayShare))} orders a day and loses ${engineLost(200, 6, 4)}.`);
  const mild = day(442, 3, 24, 1, z.outsideBalk.normal, z.dwellHours.standard, 8);
  const cold = day(442, 3, 24, 1, z.outsideBalk.freezing, z.dwellHours.standard, 8);
  P(`442 orders, 3 on the rush, tight layout that gave the queue room to seats (room for 1 in line): lost in line ${mild.lq.toFixed(1)} on a mild day, ${cold.lq.toFixed(1)} on a freezing day (the rest of the line stands on the sidewalk).`);
  const lap = day(341, 3, 18, 6, z.outsideBalk.normal, z.dwellHours.laptops, 7);
  const lapTight = day(341, 3, 24, 6, z.outsideBalk.normal, z.dwellHours.laptops, 7);
  P(`341 orders, laptops welcome (dwell ${z.dwellHours.laptops} h): lost for want of a seat ${lap.lostSeat} with 18 seats, ${lapTight.lostSeat} with 24 tight seats; peak use ${lap.peakUtil}% / ${lapTight.peakUtil}%.`);
}

// ───────────── Mechanic 4: winter at the door ─────────────
{
  const w = X.winterDoor;
  P('\n## Mechanic 4: winter at the door');
  // a deterministic winter: Dec, Jan, Feb with the Central Park normals rounded to whole days
  const months = [
    { name: 'Dec', snowDays: 2, iceDaysAfter: [1, 0] },
    { name: 'Jan', snowDays: 4, iceDaysAfter: [2, 1, 1, 0] },
    { name: 'Feb', snowDays: 3, iceDaysAfter: [1, 2, 0] },
  ];
  const ped = 5140;   // median pedestrians a day at cafe-suitable places (keen-cray data/places.json)
  let staffWinter = 0;
  for (const optId of ['staff', 'contractor', 'none']) {
    const opt = w.clearingOptions.find((o) => o.id === optId);
    let exposure = 0, tickets = 0, fines = 0, cost = 0, claims = 0, lostOrders = 0, rows = [];
    for (const m of months) {
      let mFines = 0, mCost = 0, mClaim = 0, mLost = 0;
      m.iceDaysAfter.forEach((ice) => {
        mCost += opt.costPerSnowDay * (1 + (ice > 0 ? 0.5 : 0));
        if (optId === 'none') {
          tickets++;
          const fine = w.dsnyFines[Math.min(tickets, w.dsnyFines.length) - 1];
          mFines += fine;
          const icyDays = 1 + ice;
          // storm-in-progress: the first clearing window is free of liability; exposure counts the rest of the snow day and every icy day after
          exposure += ped * (w.exposureShareOfSnowDay + ice);
          mLost += 200 * (1 - w.uncleanedDoorDemandMult) * icyDays;
          while (exposure >= (claims + 1) * w.claimExposureThreshold) { claims++; mClaim += w.claimAverage; }
        }
      });
      fines += mFines; cost += mCost; lostOrders += mLost;
      if (optId === 'staff') staffWinter += mCost;
      rows.push(`| ${m.name} | ${m.snowDays} | ${usd(mCost)} | ${usd(mFines)} | ${r0(mLost)} | ${usd(mClaim)} |`);
    }
    P(`\nOption "${optId}" on a block with ${ped.toLocaleString('en-US')} pedestrians a day:`);
    P('| Month | Snow days | Clearing cost | DSNY fines | Orders lost at an icy door | Fall claim |');
    P('|---|---|---|---|---|---|');
    rows.forEach((r) => P(r));
    if (optId === 'none') {
      const insured = claims * w.insurance.deductible + 250 * 12 * w.insurance.renewalIncrease;
      P(`Icy pedestrian passes: ${r0(exposure).toLocaleString('en-US')} (one claim per ${w.claimExposureThreshold.toLocaleString('en-US')}) -> ${claims} claim(s), each arriving ${w.claimDelayDays} days after the threshold is crossed. With the business owner's policy the shop pays ${usd(claims * w.insurance.deductible)} of deductibles and about ${usd(250 * 12 * w.insurance.renewalIncrease)} more premium over the next year = ${usd(insured)}; without coverage ${usd(claims * w.claimAverage)}.`);
      P(`Saved by not clearing: ${usd(staffWinter)} (what the staff option cost); lost: ${usd(fines)} in fines + ${r0(lostOrders)} orders (${usd(lostOrders * (pack.unit.refPrice - 2.76))} of margin) + the claim(s).`);
    }
  }
}

// exposure by block: how many claims a winter of neglect brings
{
  const w = X.winterDoor;
  const iceDays = [1, 0, 2, 1, 1, 0, 1, 2, 0];   // the same nine snow days as above
  P('\nA winter of neglect by block (same nine snow days):');
  P('| Pedestrians a day | DSNY sweep without a 311 report | Icy passes | Claims |'); P('|---|---|---|---|');
  for (const ped of [2500, 5140, 9010]) {
    const exp = iceDays.reduce((a, ice) => a + ped * (w.exposureShareOfSnowDay + ice), 0);
    P(`| ${ped.toLocaleString('en-US')} | ${ped >= w.dsnySweep.minPedestriansPerDay ? 'yes' : 'no'} | ${r0(exp).toLocaleString('en-US')} | ${Math.floor(exp / w.claimExposureThreshold)} |`);
  }
}

console.log(out.join('\n'));
