#!/usr/bin/env node
/**
 * Street War: bots and ghosts prototype (researcher 28, see 28-bots-ghosts.md).
 *
 *   node research/reports/28-bots-sim.mjs           full run (2,000 matches per experiment, ~1 min)
 *   node research/reports/28-bots-sim.mjs --quick   fast run (300 matches per experiment)
 *
 * One street, 4 flower shops, 12 rounds (1 round = 1 month), simultaneous secret moves.
 * The market model and all constants are a game model with plausible numbers, NOT data about real shops.
 *
 * Fairness by construction: an agent's decide() receives only publicView() (the same object a human
 * client receives) and its own privateState(). Bots, ghosts and humans go through the same validate().
 */

const QUICK = process.argv.includes('--quick');
const N = QUICK ? 300 : 2000;

// ---------------------------------------------------------------- utilities
function rngFrom(seed) {                       // mulberry32: small, fast, deterministic
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (rng) => { let u = 0; while (u === 0) u = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng()); };
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const median = (xs) => { const s = [...xs].sort((a, b) => a - b), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const shuffle = (xs, rng) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pct = (a, b) => `${((100 * a) / Math.max(1, b)).toFixed(1)}%`;
const usd = (x) => `$${Math.round(x).toLocaleString('en-US')}`;

// ---------------------------------------------------------------- public rules (players may know all of this)
const R = {
  rounds: 12,
  market: 2400,            // potential bouquet buyers per month on the street
  refPrice: 35,            // reference bouquet price
  unitCost: 13,            // wholesale flowers per bouquet; perishable, unsold stock is lost
  premiumExtra: 6,         // premium flowers cost more and win more buyers
  capPerPerson: 250,       // bouquets per person per month; the owner works too
  wage: 2900, rent: 4200, startCash: 15000,
  maxLoan: 15000, loanRate: 0.015, tax: 0.2,
  hireCost: 500, fireCost: 1300, poachFee: 1500,
  alpha: 3.0,              // price sensitivity in the logit
  premiumU: 0.45, adK: 0.2, repK: 0.4,
  habitK: 1.5,             // regulars: last month's market share pulls buyers back (bounded, decays by itself)
  outsideU: Math.log(2),   // supermarkets and online shops: the outside option
  spill: 0.5,              // share of turned-away buyers who try another shop on the street
  noise: 0.10,             // month-to-month demand noise, shared by all shops
  season: [0.9, 1.6, 1.0, 1.0, 1.3, 1.0, 0.9, 0.9, 1.0, 1.0, 1.0, 1.2],
};

// Event cards: in the real game the news pipeline (researcher 23) fills these from sourced news.
const EVENT_TYPES = {
  SUPPLY_SHOCK: { title: 'Rose harvest failure: wholesale flowers +50%', costMult: 1.5, dur: 3 },
  DEMAND_BOOST: { title: 'Wedding season boom: demand +30%', demandMult: 1.3, dur: 1 },
  ENERGY_SPIKE: { title: 'Energy prices jump: +$600/month fixed costs', fixedAdd: 600, dur: 3 },
  SLOWDOWN: { title: 'Consumer confidence falls: demand -15%, buyers more price-sensitive', demandMult: 0.85, alphaMult: 1.25, dur: 3 },
  WAGE_RISE: { title: 'Minimum wage +10%', wageMult: 1.1, dur: 99 },
};
function rollEvents(rng) {
  const ids = shuffle(Object.keys(EVENT_TYPES), rng).slice(0, rng() < 0.5 ? 2 : 3);
  return ids.map((id) => ({ id, ...EVENT_TYPES[id], start: 2 + Math.floor(rng() * 8) })); // starts in month 3..10, announced one month ahead
}
// reactivity = how much of an event a bot builds into its forecast (1 = all of it, 0 = news-blind)
function modsAt(events, r, reactivity = 1) {
  const m = { costMult: 1, demandMult: 1, fixedAdd: 0, alphaMult: 1, wageMult: 1 };
  for (const e of events) {
    if (r < e.start || r >= e.start + e.dur) continue;
    if (e.costMult) m.costMult *= 1 + reactivity * (e.costMult - 1);
    if (e.demandMult) m.demandMult *= 1 + reactivity * (e.demandMult - 1);
    if (e.fixedAdd) m.fixedAdd += reactivity * e.fixedAdd;
    if (e.alphaMult) m.alphaMult *= 1 + reactivity * (e.alphaMult - 1);
    if (e.wageMult) m.wageMult *= 1 + reactivity * (e.wageMult - 1);
  }
  return m;
}
// bulk buying: 600+ bouquets a month -10% wholesale, 900+ -15% (economies of scale for volume players)
const volumeDiscount = (stock) => (stock >= 900 ? 0.85 : stock >= 600 ? 0.9 : 1);
const unitCostOf = (premium, m, stock = 0) => (R.unitCost + (premium ? R.premiumExtra : 0)) * m.costMult * volumeDiscount(stock);
const shopUtility = (price, premium, ads, rep, alpha, habit = 0) =>
  -alpha * Math.log(price / R.refPrice) + (premium ? R.premiumU : 0) + R.adK * Math.log(1 + ads / 500) + R.repK * (rep - 3) + habit;
// regulars: share of last month's street sales, normalised over shops still open
function habitOf(shops) {
  const live = shops.filter((s) => s.alive), tot = live.reduce((a, s) => a + s.share, 0) || 1;
  const h = {};
  for (const s of live) h[s.id] = R.habitK * (s.share / tot - 1 / live.length);
  return h;
}

// Demand forecast from public information only. Rivals are assumed to repeat last month's visible move.
function forecast(view, me, myMove, m, override) {
  const total = R.market * R.season[view.round] * m.demandMult;
  const alpha = R.alpha * m.alphaMult;
  let denom = Math.exp(R.outsideU);
  const E = {}, H = habitOf(view.shops);
  for (const s of view.shops) {
    if (!s.alive) continue;
    const mine = s.id === me;
    const price = mine ? myMove.price : (override && override[s.id] != null ? override[s.id] : s.price);
    E[s.id] = Math.exp(shopUtility(price, mine ? myMove.premium : s.premium, mine ? myMove.ads : s.ads, s.rep, alpha, H[s.id]));
    denom += E[s.id];
  }
  const D = {};
  for (const id in E) D[id] = (total * E[id]) / denom;
  return D;
}

// ---------------------------------------------------------------- what an agent is allowed to see
function publicView(st, me) {
  return {
    round: st.round, rounds: R.rounds, me,
    events: st.events.filter((e) => e.start - 1 <= st.round).map((e) => ({ ...e })), // announced 1 month ahead
    shops: st.shops.map((s) => ({
      id: s.id, name: s.name, alive: s.alive,
      price: s.pub.price, premium: s.pub.premium, ads: s.pub.ads, // posted on the shop window and billboards
      staff: s.staff, rep: Math.round(s.rep * 10) / 10,             // people behind the counter, star rating
      share: Math.round(s.share * 100) / 100,                        // last month's share of street sales (public league table)
      busy: s.pub.busy,                                              // 'quiet' | 'steady' | 'packed'
    })),
    offers: st.offers.filter((o) => o.to === me && o.round === st.round - 1).map((o) => ({ ...o })),
    news: st.feed.filter((n) => n.round >= st.round - 1).map((n) => ({ ...n })),
  };
}
function privateState(st, me) {
  const s = st.shops[me];
  return { cash: s.cash, loan: s.loan, staff: s.staff, lastSales: s.lastSales, cartel: s.cartel ? { ...s.cartel } : null };
}
// The server validates every move the same way, whoever sent it.
function validate(a, s) {
  return {
    ...a,
    price: clamp(Math.round(a.price), 5, 120),
    stock: Math.max(0, Math.round(a.stock)),
    staffTarget: Math.max(0, clamp(Math.round(a.staffTarget), s.staff - 1, s.staff + 1)),
    ads: clamp(Math.round(a.ads), 0, 5000),
    borrow: clamp(Math.round(a.borrow || 0), 0, R.maxLoan - s.loan),
    repay: clamp(Math.round(a.repay || 0), 0, Math.min(s.loan, Math.max(0, s.cash))),
  };
}

// ---------------------------------------------------------------- five characters = five weight presets of ONE brain
// killer: switches to predatory pricing when a rival looks close to bankruptcy (predation, then recoupment)
// phases: land grab (months 1-4), consolidate (5-8), harvest (9-12)
// anchor 'own': prefers small price moves from its own last price (sticky, steady)
const PERSONAS = {
  Shark: { label: 'The Shark', priceBias: 0.95, aggression: 0.25, riskAversion: 0.3, floorMonths: 0.5, growth: 0.3, quality: 0, loanAppetite: 0.5, poach: true, cartelAccept: 0, grudge: 0.5, news: 0.7, stockBias: 1.1, repays: false,
    killer: { cash: 8000, bias: 0.8, aggression: 1.0 } },
  Accountant: { label: 'The Accountant', priceBias: 1.0, aggression: 0, riskAversion: 1.0, floorMonths: 2, growth: 0, quality: 0, loanAppetite: 0, poach: false, cartelAccept: 0.8, grudge: 0.2, news: 1.0, stockBias: 0.95, repays: true,
    anchor: 'own', styleW: 6000 },
  Empire: { label: 'The Empire Builder', priceBias: 0.95, aggression: 0.1, riskAversion: 0.15, floorMonths: 0.3, growth: 1.0, quality: 0, loanAppetite: 1, poach: true, cartelAccept: 0.4, grudge: 0.3, news: 0.5, stockBias: 1.15, repays: false,
    phases: [{ bias: 0.92, growth: 0.8 }, { bias: 1.0, growth: 0.3 }, { bias: 1.08, growth: 0 }] },
  Snake: { label: 'The Snake', priceBias: 1.0, aggression: 0.2, riskAversion: 0.5, floorMonths: 1, growth: 0.2, quality: 0, loanAppetite: 0.3, poach: false, cartelAccept: 1, grudge: 0.3, news: 0.8, stockBias: 1.05, repays: true, schemer: true },
  Artisan: { label: 'The Artisan', priceBias: 1.15, aggression: 0, riskAversion: 0.6, floorMonths: 1.5, growth: 0.2, quality: 1, loanAppetite: 0.2, poach: false, cartelAccept: 0.7, grudge: 0.8, news: 0.6, stockBias: 1.0, repays: true },
};
// Difficulty changes only the quality of decisions, never money, information or rules.
const LEVELS = {
  Rookie: { tau: 3000, blunder: 0.3, newsAware: false, endgame: false, rivalResponse: false, noAttacks: true, carelessness: 0.5 },
  Pro: { tau: 400, blunder: 0.03, newsAware: true, endgame: true, rivalResponse: false },
  Tycoon: { tau: 80, blunder: 0, newsAware: true, endgame: true, rivalResponse: true },
};
const BUSY_FRAC = { quiet: 0.35, steady: 0.7, packed: 0.95 };
const PRICE_MULTS = [0.8, 0.9, 1.0, 1.1, 1.2, 1.35];
const STOCK_MULTS = [0.9, 1.0, 1.15];
const ADS_OPTS = [0, 500, 1200];

function makeBot(personaName, levelName, seed, opts = {}) {
  const P = PERSONAS[personaName];
  const L = { ...LEVELS[levelName], ...(opts.level || {}) };
  const rng = rngFrom(seed);
  const mem = { estCash: {}, grudge: null, grudgeTTL: 0, poachCd: 0, defected: false };
  return {
    kind: 'bot', persona: personaName, level: levelName, label: `${P.label} (${levelName})`,
    decide: (view, priv) => decideBot(P, L, mem, rng, view, priv, !!opts.deterministic),
  };
}

function decideBot(P, L, mem, rng, view, priv, deterministic) {
  const r = view.round, me = view.me, last = r === R.rounds - 1;
  const m = modsAt(view.events, r, L.newsAware ? P.news : 0); // what this bot believes about this month
  const rivals = view.shops.filter((s) => s.alive && s.id !== me);
  const meNow = view.shops[me];

  // 1) beliefs from public signals only: estimated rival cash, grudges
  for (const s of rivals) {
    if (r === 0) { mem.estCash[s.id] = R.startCash; continue; }
    const sales = (s.staff + 1) * R.capPerPerson * BUSY_FRAC[s.busy];
    mem.estCash[s.id] = (mem.estCash[s.id] ?? R.startCash) + sales * (s.price - unitCostOf(s.premium, m)) - s.staff * R.wage - R.rent - s.ads;
  }
  if (mem.grudgeTTL > 0) mem.grudgeTTL--;
  for (const n of view.news) {
    if (n.round === r - 1 && n.victim === me && (n.type === 'betrayal' || n.type === 'poach') && P.grudge >= 0.3) { mem.grudge = n.actor; mem.grudgeTTL = 3; }
  }
  const base = rivals.length ? median(rivals.map((s) => s.price)) : R.refPrice;
  if (r > 0 && P.grudge >= 0.5 && mem.grudge == null) {
    const dumper = rivals.find((s) => s.price < base * 0.85);
    if (dumper) { mem.grudge = dumper.id; mem.grudgeTTL = 2; }
  }
  if (mem.grudge != null && (!view.shops[mem.grudge].alive || mem.grudgeTTL <= 0)) mem.grudge = null;
  let target = null;
  if (mem.grudge != null) target = mem.grudge;
  else if (P.aggression >= 0.5 && rivals.length) target = rivals.reduce((a, b) => (mem.estCash[a.id] <= mem.estCash[b.id] ? a : b)).id;
  let bias = P.priceBias, aggrBase = P.aggression, growthW = P.growth;
  if (P.killer && target != null && (mem.estCash[target] ?? 1e9) < P.killer.cash) { bias = P.killer.bias; aggrBase = P.killer.aggression; }
  if (P.phases) { const ph = P.phases[r < 4 ? 0 : r < 8 ? 1 : 2]; bias = ph.bias; growthW = ph.growth; }
  const aggr = mem.grudge != null ? Math.max(aggrBase, P.grudge) : aggrBase;

  // 2) diplomacy state: the Snake plans its betrayal
  const cartel = priv.cartel;
  let defect = false;
  if (cartel && P.schemer && (r >= R.rounds - 3 || (mem.estCash[cartel.partner] ?? 1e9) < 5000)) defect = true;

  // 3) enumerate 54 candidate moves and score each with a one-month lookahead through the public market formula
  const premium = P.quality >= 0.5;
  const uc = unitCostOf(premium, m);
  const wageNow = R.wage * m.wageMult, fixedNow = R.rent + m.fixedAdd;
  const plannedBorrow = P.loanAppetite >= 1 && r === 0 && priv.loan === 0 ? 10000 : 0; // the Empire Builder borrows to grow
  const floorCash = P.floorMonths * (fixedNow + priv.staff * wageNow);
  const baseD = forecast(view, me, { price: meNow.price, premium, ads: meNow.ads }, m, null);
  const evals = [];
  for (const pm of PRICE_MULTS) for (const sm of STOCK_MULTS) for (const ads of ADS_OPTS) {
    let price = Math.round(base * pm);
    if (cartel && !defect) price = Math.max(price, cartel.floor);
    if (defect) price = Math.min(price, Math.round(cartel.floor * 0.85));
    price = Math.max(price, 5);
    let override = null;
    if (L.rivalResponse) { // Tycoon: expects a big undercut to be matched next month
      override = {};
      for (const s of rivals) if (price < s.price * 0.92) override[s.id] = Math.max(price * 1.02, s.price * 0.9);
    }
    const D = forecast(view, me, { price, premium, ads }, m, override);
    const dMe = D[me];
    const stock = Math.round(dMe * sm * P.stockBias);
    let staffT = clamp(Math.ceil(stock / R.capPerPerson) - 1, priv.staff - 1, priv.staff + 1);
    staffT = Math.max(0, staffT);
    const cap = (staffT + 1) * R.capPerPerson;
    const sold = Math.min(dMe, cap, stock), soldLow = Math.min(dMe * 0.85, cap, stock);
    const oneOff = (staffT > priv.staff ? R.hireCost : 0) + (staffT < priv.staff ? R.fireCost : 0);
    const costs = stock * uc * volumeDiscount(stock) + staffT * wageNow + fixedNow + ads + (priv.loan + plannedBorrow) * R.loanRate + oneOff;
    const profit = sold * price - costs;
    const cashLow = priv.cash + plannedBorrow + soldLow * price - costs;
    const floor = last && L.endgame ? 0 : floorCash;
    const risk = Math.max(0, floor - cashLow) + 3 * Math.max(0, -cashLow);
    const growth = last && L.endgame ? 0 : growthW * sold * 4;
    const anchor = P.anchor === 'own' && r > 0 ? meNow.price : base * bias;
    const style = (P.styleW ?? 3000) * Math.abs(Math.log(price / anchor));
    let damage = 0;
    for (const s of rivals) {
      if (target != null && s.id !== target) continue;
      const capS = (s.staff + 1) * R.capPerPerson;
      damage += (Math.min(baseD[s.id], capS) - Math.min(D[s.id], capS)) * (s.price - unitCostOf(s.premium, m));
    }
    if (target == null) damage *= 0.5;
    const U = profit * (profit > 0 ? 1 - R.tax : 1) - P.riskAversion * (1 - (L.carelessness || 0)) * risk - style + growth + (L.noAttacks ? 0 : aggr) * damage;
    evals.push({ price, ads, stock, staffT, U, cashLow });
  }

  // 4) choose: argmax with temperature (difficulty) and occasional blunders (Rookie)
  let pick;
  const best = evals.reduce((a, b) => (b.U > a.U ? b : a));
  if (deterministic) pick = best;
  else if (rng() < L.blunder) pick = evals[Math.floor(rng() * evals.length)];
  else {
    const w = evals.map((e) => Math.exp((e.U - best.U) / L.tau));
    let x = rng() * w.reduce((a, b) => a + b, 0), i = 0;
    while ((x -= w[i]) > 0 && i < w.length - 1) i++;
    pick = evals[i];
  }

  // 5) money moves: borrow before a hole, repay when rich
  let borrow = plannedBorrow;
  const safeLine = P.loanAppetite > 0 ? floorCash : 0;
  if (pick.cashLow < safeLine) borrow += Math.ceil((safeLine - pick.cashLow) / 1000) * 1000;
  borrow = Math.min(borrow, R.maxLoan - priv.loan);
  let repay = 0;
  if (P.repays && priv.loan > 0 && borrow === 0 && pick.cashLow > 3 * floorCash) repay = Math.min(priv.loan, Math.floor((pick.cashLow - 2 * floorCash) / 1000) * 1000);

  // 6) attacks and diplomacy
  let poach = null, poachSel = null;
  mem.poachCd = Math.max(0, mem.poachCd - 1);
  const wantsPoach = (P.poach && P.killer != null) || (mem.grudge != null && P.grudge >= 0.5) || (P.poach && P.phases != null && r <= 2);
  if (wantsPoach && !L.noAttacks && mem.poachCd === 0 && !last && priv.cash + borrow > floorCash + R.poachFee + 2000) {
    const pool = rivals.filter((s) => s.staff >= 1);
    if (pool.length) {
      const g = mem.grudge != null ? view.shops[mem.grudge] : null;
      const t = g && g.staff >= 1 ? g : pool.reduce((a, b) => (b.staff > a.staff ? b : a));
      poach = t.id; poachSel = g && g.staff >= 1 ? 'grudge' : 'mostStaff'; mem.poachCd = 3;
    }
  }
  let proposeCartel = null, acceptCartel = null;
  if (P.schemer && !L.noAttacks && !cartel && !mem.defected && r >= 1 && r <= 3 && rivals.length) {
    const t = rivals.reduce((a, b) => (Math.abs(b.price - meNow.price) < Math.abs(a.price - meNow.price) ? b : a));
    proposeCartel = { to: t.id, floor: Math.round(Math.max(base, meNow.price, t.price) * 1.05) };
  }
  for (const o of view.offers) {
    if (cartel || acceptCartel != null) break;
    if (deterministic ? P.cartelAccept >= 0.5 : rng() < P.cartelAccept) acceptCartel = o.from;
  }
  if (defect) mem.defected = true;

  // 7) the same move, also written as "intent" relative to the situation, for ghosts
  const Dtrue = forecast(view, me, { price: pick.price, premium, ads: pick.ads }, modsAt(view.events, r, 1), null)[me];
  return {
    price: pick.price, premium, stock: pick.stock, staffTarget: pick.staffT, ads: pick.ads, borrow, repay, poach, proposeCartel, acceptCartel,
    meta: { priceRel: pick.price / base, stockRel: pick.stock / Math.max(1, Dtrue), uc: unitCostOf(premium, modsAt(view.events, r, 1)), poachSel },
  };
}

// ---------------------------------------------------------------- a naive human stand-in, to calibrate difficulty
function makeSteady() {
  return {
    kind: 'steady', persona: 'Steady', label: 'Steady Joe (human proxy)',
    decide(view, priv) {
      const stock = priv.lastSales > 0 ? Math.round(priv.lastSales * 1.1) : 420;
      const staffTarget = Math.max(0, clamp(Math.ceil(stock / R.capPerPerson) - 1, priv.staff - 1, priv.staff + 1));
      const borrow = priv.cash < 4000 ? Math.min(6000, R.maxLoan - priv.loan) : 0;
      return { price: 35, premium: false, stock, staffTarget, ads: 0, borrow, repay: 0, poach: null, proposeCartel: null, acceptCartel: null };
    },
  };
}

// A slightly smarter newcomer: copies the street's median price, never attacks, ignores news.
function makeCasey() {
  return {
    kind: 'steady', persona: 'Casey', label: 'Copycat Casey (human proxy)',
    decide(view, priv) {
      const rivals = view.shops.filter((s) => s.alive && s.id !== view.me);
      const price = rivals.length ? Math.round(median(rivals.map((s) => s.price))) : 35;
      const stock = priv.lastSales > 0 ? Math.round(priv.lastSales * 1.1) : 420;
      const staffTarget = Math.max(0, clamp(Math.ceil(stock / R.capPerPerson) - 1, priv.staff - 1, priv.staff + 1));
      const borrow = priv.cash < 4000 ? Math.min(6000, R.maxLoan - priv.loan) : 0;
      return { price, premium: false, stock, staffTarget, ads: 0, borrow, repay: 0, poach: null, proposeCartel: null, acceptCartel: null };
    },
  };
}

// ---------------------------------------------------------------- ghosts: a recorded player replayed in a different match
// mode 'literal'      : replay absolute numbers (price $31, buy 480 stems, ...)
// mode 'relative-raw' : replay intent (price = 0.9 x street median, stock = 1.15 x forecast), no safety rails
// mode 'relative'     : intent + rails (price never below cost +15%, borrow instead of going negative, no ads when broke)
// mode 'markup'       : price = recorded markup over today's unit cost (follows cost shocks, ignores rivals' prices), stock as relative, + rails
function makeGhost(tape, mode) {
  return {
    kind: 'ghost', persona: 'Ghost', label: `Ghost (${mode})`,
    decide(view, priv) {
      const a = tape[Math.min(view.round, tape.length - 1)].act;
      if (mode === 'literal') {
        const ok = a.poach != null && a.poach !== view.me && view.shops[a.poach] && view.shops[a.poach].alive;
        return { ...a, poach: ok ? a.poach : null, proposeCartel: null, acceptCartel: null };
      }
      const rails = mode === 'relative' || mode === 'markup';
      const rivals = view.shops.filter((s) => s.alive && s.id !== view.me);
      const base = rivals.length ? median(rivals.map((s) => s.price)) : R.refPrice;
      const m = modsAt(view.events, view.round, 1);
      const uc = unitCostOf(a.premium, m);
      let price = mode === 'markup' ? Math.round((a.price * uc) / a.meta.uc) : Math.round(a.meta.priceRel * base);
      if (rails) price = clamp(price, Math.ceil(uc * 1.15), R.refPrice * 2);
      let ads = rails && priv.cash < 6000 ? 0 : a.ads;
      const D = forecast(view, view.me, { price, premium: a.premium, ads }, m, null)[view.me];
      const stock = Math.round(D * a.meta.stockRel);
      const staffTarget = Math.max(0, clamp(Math.ceil(stock / R.capPerPerson) - 1, priv.staff - 1, priv.staff + 1));
      let borrow = Math.min(a.borrow, R.maxLoan - priv.loan);
      if (rails) {
        const cap = (staffTarget + 1) * R.capPerPerson;
        const cashLow = priv.cash + Math.min(D * 0.85, cap, stock) * price - stock * uc * volumeDiscount(stock) - staffTarget * R.wage * m.wageMult - R.rent - m.fixedAdd - ads - priv.loan * R.loanRate;
        if (cashLow < 0) borrow = Math.max(borrow, Math.min(R.maxLoan - priv.loan, Math.ceil(-cashLow / 1000) * 1000));
      }
      const repay = a.repay > 0 && priv.cash > 10000 ? Math.min(priv.loan, a.repay) : 0;
      let poach = null;
      if (a.meta.poachSel) { const pool = rivals.filter((s) => s.staff >= 1); if (pool.length) poach = pool.reduce((x, y) => (y.staff > x.staff ? y : x)).id; }
      return { price, premium: a.premium, stock, staffTarget, ads, borrow, repay, poach, proposeCartel: null, acceptCartel: null };
    },
  };
}
// Style fit: which of the five presets best explains a recorded player's 12 moves?
function actionDistance(a, b) {
  return Math.abs(Math.log(a.price / b.price)) * 10 + Math.abs(Math.log((a.stock + 50) / (b.stock + 50))) * 3 + Math.abs(a.ads - b.ads) / 1500
    + (a.premium !== b.premium ? 2 : 0) + ((a.poach != null) !== (b.poach != null) ? 1 : 0)
    + ((a.borrow > 0) !== (b.borrow > 0) ? 0.5 : 0) + (!!a.proposeCartel !== !!b.proposeCartel ? 2 : 0);
}
function fitPersona(tape) {
  let best = null, bestD = Infinity;
  for (const name of Object.keys(PERSONAS)) {
    const brain = makeBot(name, 'Pro', 1, { deterministic: true });
    let d = 0;
    for (const t of tape) d += actionDistance(brain.decide(t.view, t.priv), t.act);
    if (d < bestD) { bestD = d; best = name; }
  }
  return best;
}

// ---------------------------------------------------------------- the match server (authoritative)
const SHOP_NAMES = ['Petal & Stem', 'Bloom Co.', 'Wild Iris', 'The Rose Room', 'Fern Street Florist', 'Daisy Chain'];

function runMatch(seed, agents, { log = false, record = [] } = {}) {
  const rng = rngFrom(seed * 7919 + 13);
  const st = {
    round: 0, events: rollEvents(rng), offers: [], feed: [], story: [],
    shops: agents.map((agent, i) => ({
      id: i, name: SHOP_NAMES[i], agent, alive: true, cash: R.startCash, loan: 0, staff: 1, rep: 3.0,
      pub: { price: R.refPrice, premium: false, ads: 0, busy: 'steady' }, share: 1 / agents.length, lastSales: 0, cartel: null, cartelNext: null, bankruptRound: null,
    })),
  };
  const tapes = agents.map(() => []);
  for (let r = 0; r < R.rounds; r++) {
    st.round = r;
    for (const s of st.shops) if (s.cartelNext) { s.cartel = s.cartelNext; s.cartelNext = null; }
    const m = modsAt(st.events, r, 1);
    for (const e of st.events) {
      if (e.start - 1 === r) st.story.push(`M${r + 1} NEWS (from M${e.start + 1}): ${e.title}`);
    }
    // 1) everyone moves at once, in secret
    const acts = st.shops.map((s) => (s.alive ? validate(s.agent.decide(publicView(st, s.id), privateState(st, s.id)), s) : null));
    for (const i of record) if (acts[i]) tapes[i].push({ view: publicView(st, i), priv: privateState(st, i), act: acts[i] });
    // 2) diplomacy
    acts.forEach((a, i) => {
      if (a && a.proposeCartel && a.proposeCartel.to !== i && st.shops[a.proposeCartel.to]?.alive) {
        st.offers.push({ from: i, to: a.proposeCartel.to, floor: a.proposeCartel.floor, round: r });
        st.story.push(`M${r + 1} ${st.shops[i].name} secretly offers ${st.shops[a.proposeCartel.to].name} a price floor of $${a.proposeCartel.floor}`);
      }
    });
    acts.forEach((a, i) => {
      if (!a || a.acceptCartel == null) return;
      const o = st.offers.find((x) => x.from === a.acceptCartel && x.to === i && x.round === r - 1);
      const A = o ? st.shops[o.from] : null;
      if (A && A.alive && !A.cartel && !A.cartelNext && !st.shops[i].cartel) {
        A.cartelNext = { partner: i, floor: o.floor };
        st.shops[i].cartelNext = { partner: o.from, floor: o.floor };
        st.story.push(`M${r + 1} ${st.shops[i].name} accepts the pact with ${A.name}`);
      }
    });
    // 3) money and people
    for (const s of st.shops) {
      const a = acts[s.id];
      if (!a) continue;
      s.cash += a.borrow - a.repay; s.loan += a.borrow - a.repay;
      s.oneOff = (a.staffTarget > s.staff ? R.hireCost : 0) + (a.staffTarget < s.staff ? R.fireCost : 0);
      s.staff = a.staffTarget;
    }
    for (const i of shuffle([...st.shops.keys()], rng)) {
      const a = acts[i];
      if (!a || a.poach == null) continue;
      const T = st.shops[a.poach];
      if (!T || !T.alive || a.poach === i || T.staff < 1) continue;
      T.staff -= 1; st.shops[i].staff += 1; st.shops[i].oneOff += R.poachFee;
      st.feed.push({ round: r, type: 'poach', actor: i, victim: a.poach });
      st.story.push(`M${r + 1} ${st.shops[i].name} poaches a florist from ${T.name}`);
    }
    // 4) the street splits its buyers (multinomial logit + spill-over of turned-away buyers)
    const total = R.market * R.season[r] * m.demandMult * Math.exp(gauss(rng) * R.noise);
    const alpha = R.alpha * m.alphaMult;
    const live = st.shops.filter((s) => s.alive);
    let denom = Math.exp(R.outsideU), unmetPool = 0;
    const H = habitOf(st.shops);
    for (const s of live) { const a = acts[s.id]; s.E = Math.exp(shopUtility(a.price, a.premium, a.ads, s.rep, alpha, H[s.id])); denom += s.E; }
    for (const s of live) {
      s.D = (total * s.E) / denom;
      s.cap = (s.staff + 1) * R.capPerPerson;
      s.sold = Math.min(s.D, s.cap, acts[s.id].stock);
      unmetPool += s.D - s.sold;
    }
    const spare = live.filter((s) => Math.min(s.cap, acts[s.id].stock) - s.sold > 0.5);
    const Es = spare.reduce((x, s) => x + s.E, 0);
    for (const s of spare) s.sold += Math.min(Math.min(s.cap, acts[s.id].stock) - s.sold, (R.spill * unmetPool * s.E) / Es);
    const soldTotal = live.reduce((x, s) => x + s.sold, 0) || 1;
    for (const s of live) s.share = s.sold / soldTotal;
    // 5) accounting, reputation, bankruptcy
    for (const s of live) {
      const a = acts[s.id];
      const profit = s.sold * a.price - a.stock * unitCostOf(a.premium, m, a.stock) - s.staff * R.wage * m.wageMult - R.rent - m.fixedAdd - a.ads - s.loan * R.loanRate - s.oneOff;
      s.cash += profit - Math.max(0, profit) * R.tax;
      s.lastProfit = profit;
      const unmetShare = Math.max(0, s.D - s.sold) / Math.max(1, s.D);
      s.rep = clamp(s.rep + 0.35 * (3 + (a.premium ? 0.4 : 0) - 1.5 * unmetShare - s.rep), 1, 5);
      s.lastSales = Math.round(s.sold);
      s.pub = { price: a.price, premium: a.premium, ads: a.ads, busy: s.sold / s.cap < 0.5 ? 'quiet' : s.sold / s.cap < 0.85 ? 'steady' : 'packed' };
      if (s.cash < 0) {
        const need = -s.cash * 1.1;                     // emergency credit line: +10% fee
        if (s.loan + need <= R.maxLoan) { s.loan += need; s.cash = 0; st.story.push(`M${r + 1} ${s.name} survives on an emergency loan`); }
        else { s.alive = false; s.bankruptRound = r; st.feed.push({ round: r, type: 'bankrupt', actor: s.id, victim: s.id }); st.story.push(`M${r + 1} ${s.name} GOES BANKRUPT`); }
      }
    }
    for (const s of live) {
      if (!s.cartel) continue;
      const P2 = st.shops[s.cartel.partner];
      if (s.alive && acts[s.id].price < s.cartel.floor * 0.97) {
        st.feed.push({ round: r, type: 'betrayal', actor: s.id, victim: s.cartel.partner });
        st.story.push(`M${r + 1} BETRAYAL: ${s.name} drops to $${acts[s.id].price} under the $${s.cartel.floor} pact with ${P2.name}`);
        P2.cartel = null; s.cartel = null;
      } else if (!P2.alive || !s.alive) { s.cartel = null; P2.cartel = null; }
    }
    if (log) {
      const line = st.shops.map((s) => (s.alive || s.bankruptRound === r
        ? `${s.agent.persona.padEnd(10)} $${String(acts[s.id].price).padStart(2)} staff ${s.staff} sold ${String(Math.round(s.sold)).padStart(3)} cash ${usd(s.cash - s.loan).padStart(8)}`
        : `${s.agent.persona.padEnd(10)} --- out ---`.padEnd(48)));
      console.log(`  M${String(r + 1).padStart(2)} | ${line.join(' | ')}`);
    }
  }
  const results = st.shops.map((s) => ({ id: s.id, kind: s.agent.kind, persona: s.agent.persona, label: s.agent.label, alive: s.alive, nw: s.alive ? s.cash - s.loan : 0, bankruptRound: s.bankruptRound }));
  const ranked = [...results].sort((a, b) => (a.alive !== b.alive ? (a.alive ? -1 : 1) : a.alive ? b.nw - a.nw : b.bankruptRound - a.bankruptRound));
  return { results, winner: ranked[0].id, tapes, story: st.story, events: st.events };
}

// ---------------------------------------------------------------- experiments
const NAMES = Object.keys(PERSONAS);
function tallyAdd(t, key, res, won) {
  t[key] ??= { n: 0, wins: 0, bust: 0, nw: [] };
  t[key].n++; t[key].wins += won ? 1 : 0; t[key].bust += res.alive ? 0 : 1; t[key].nw.push(res.nw);
}
function printTally(t, keys) {
  console.log('  who                         games   win     bankrupt   avg net worth (bankrupt = 0)');
  for (const k of keys) {
    const x = t[k];
    if (!x) continue;
    console.log(`  ${k.padEnd(26)} ${String(x.n).padStart(6)}   ${pct(x.wins, x.n).padStart(6)}   ${pct(x.bust, x.n).padStart(6)}     ${usd(mean(x.nw)).padStart(8)}`);
  }
}

function sampleMatch() {
  console.log('\n=== Sample match (seed 42): Shark, Snake, Artisan, Accountant, all Pro ===');
  const agents = ['Shark', 'Snake', 'Artisan', 'Accountant'].map((p, i) => makeBot(p, 'Pro', 42 * 10 + i));
  const out = runMatch(42, agents, { log: true });
  console.log('  Story:');
  for (const s of out.story) console.log(`   - ${s}`);
  console.log(`  Winner: ${agents[out.winner].label}`);
}

function balance() {
  console.log(`\n=== E1. Balance: ${N} matches, 4 random characters of 5, all Pro (fair share = 25% wins) ===`);
  const t = {};
  for (let k = 0; k < N; k++) {
    const rng = rngFrom(1000 + k);
    const picks = shuffle(NAMES, rng).slice(0, 4);
    const out = runMatch(1000 + k, picks.map((p, i) => makeBot(p, 'Pro', (1000 + k) * 10 + i)));
    out.results.forEach((res) => tallyAdd(t, PERSONAS[res.persona].label, res, out.winner === res.id));
  }
  printTally(t, NAMES.map((n) => PERSONAS[n].label));
}

function difficulty() {
  console.log(`\n=== E2. Difficulty: one human proxy + 3 random bots, ${N} matches per proxy and level (fair share = 25%) ===`);
  const t = {}, keys = [];
  for (const lvl of Object.keys(LEVELS)) {
    for (const [pname, mk] of [['Steady Joe', makeSteady], ['Copycat Casey', makeCasey]]) {
      const key = `${pname} vs ${lvl}`; keys.push(key);
      for (let k = 0; k < N; k++) {
        const seed = 5000 + k, rng = rngFrom(seed);
        const picks = shuffle(NAMES, rng).slice(0, 3);
        const out = runMatch(seed, [mk(), ...picks.map((p, i) => makeBot(p, lvl, seed * 10 + i))]);
        tallyAdd(t, key, out.results[0], out.winner === 0);
      }
    }
  }
  printTally(t, keys);
}

function news() {
  console.log(`\n=== E3. News reaction: the Accountant (Pro) news-aware vs news-blind vs 3 random Pro rivals, paired seeds, ${N} matches ===`);
  const t = {}, delta = {};
  for (let k = 0; k < N; k++) {
    const seed = 9000 + k, rng = rngFrom(seed);
    const rivals = shuffle(NAMES.filter((n) => n !== 'Accountant'), rng).slice(0, 3);
    const nw = {};
    let events = [];
    for (const mode of ['aware', 'blind']) {
      const agents = [makeBot('Accountant', 'Pro', seed * 10, mode === 'blind' ? { level: { newsAware: false } } : {}), ...rivals.map((p, i) => makeBot(p, 'Pro', seed * 10 + i + 1))];
      const out = runMatch(seed, agents);
      tallyAdd(t, `Accountant news-${mode}`, out.results[0], out.winner === 0);
      nw[mode] = out.results[0].nw; events = out.events;
    }
    for (const e of events) (delta[e.id] ??= []).push(nw.aware - nw.blind);
  }
  printTally(t, ['Accountant news-aware', 'Accountant news-blind']);
  console.log('  value of reading the news, by event in the match (avg net worth aware - blind):');
  for (const id of Object.keys(EVENT_TYPES)) if (delta[id]) console.log(`    ${id.padEnd(14)} ${String(delta[id].length).padStart(5)} matches   ${usd(mean(delta[id])).padStart(7)}`);
}

function ghosts() {
  const M = Math.max(200, N / 2);
  console.log(`\n=== E4. Ghosts: record a Pro bot in match A, replay it in a different match B (new events, new rivals), ${M} pairs ===`);
  const t = {};
  let fitHits = 0;
  for (let k = 0; k < M; k++) {
    const seedA = 20000 + k, rngA = rngFrom(seedA);
    const picksA = shuffle(NAMES, rngA).slice(0, 4);
    const A = runMatch(seedA, picksA.map((p, i) => makeBot(p, 'Pro', seedA * 10 + i)), { record: [0] });
    const tape = A.tapes[0];
    const truth = picksA[0];
    const fitted = fitPersona(tape);
    if (fitted === truth) fitHits++;
    const seedB = 70000 + k, rngB = rngFrom(seedB);
    const rivalsB = shuffle(NAMES, rngB).slice(0, 3);
    const seat0 = {
      'live bot, same character': () => makeBot(truth, 'Pro', seedB * 10),
      'ghost: literal replay': () => makeGhost(tape, 'literal'),
      'ghost: relative, no rails': () => makeGhost(tape, 'relative-raw'),
      'ghost: relative + rails': () => makeGhost(tape, 'relative'),
      'ghost: markup + rails': () => makeGhost(tape, 'markup'),
      'ghost: fitted character': () => makeBot(fitted, 'Pro', seedB * 10),
    };
    for (const [label, mk] of Object.entries(seat0)) {
      const out = runMatch(seedB, [mk(), ...rivalsB.map((p, i) => makeBot(p, 'Pro', seedB * 10 + i + 1))]);
      tallyAdd(t, label, out.results[0], out.winner === 0);
    }
  }
  printTally(t, Object.keys(t));
  console.log(`  style fit: the recorded player's true character recognised from 12 moves in ${pct(fitHits, M)} of tapes (chance = 20%)`);
}

function speed() {
  const agents = NAMES.slice(0, 4).map((p, i) => makeBot(p, 'Pro', i));
  const t0 = process.hrtime.bigint();
  const K = 200;
  for (let k = 0; k < K; k++) runMatch(123456 + k, agents.map((a, i) => makeBot(a.persona, 'Pro', k * 10 + i)));
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  console.log(`\n=== Speed: ${K} full matches (4 bots x 12 rounds) in ${ms.toFixed(0)} ms = ${(ms / K).toFixed(2)} ms per match, ${(ms / K / 48).toFixed(3)} ms per bot move ===`);
}

export { R, PERSONAS, LEVELS, EVENT_TYPES, runMatch, makeBot, makeSteady, makeGhost, fitPersona, forecast, modsAt, publicView, privateState, rngFrom, shuffle, NAMES };

import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  sampleMatch();
  balance();
  difficulty();
  news();
  ghosts();
  speed();
}
