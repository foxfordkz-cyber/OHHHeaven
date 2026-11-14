#!/usr/bin/env node
// Builds packs/next/cafe.events.json: the events of the cafe catalog that the first version of the engine can run.
// Spec: build/EVENTS.md (task A3, round 3). No number is invented here: every number is copied from the catalog or
// derived from it by a rule written next to the code and repeated in the effect's `note`.
//
//   node packs/next/build-events.mjs                      # catalog from packs/cafe.next.json, or from the D11 branch
//   node packs/next/build-events.mjs path/to/cafe.next.json
//   node packs/next/build-events.mjs --check              # build in memory, compare with the file on disk, exit 1 on a difference
//
// After D18 and D19 land in the catalog (packs/parts/cafe/D11-merge.mjs), run the first command again.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const OUT = join(HERE, 'cafe.events.json');
const LOG = join(HERE, 'cafe.events.log.json');
const D11_BRANCH = 'origin/claude/jolly-volta-dv0cll';

// ───────────────────────── rules of the first version (build/EVENTS.md) ─────────────────────────

const MULT_FIELDS = ['demand', 'footTraffic', 'cogs', 'wages', 'rent', 'utilities', 'staffAvailability'];
const ADD_FIELDS = ['quality', 'reputation'];
const FIELDS = [...MULT_FIELDS, 'cash', 'closureDays', 'violation', ...ADD_FIELDS];
const HARD_FIELDS = [...MULT_FIELDS, 'cash', 'closureDays', 'violation'];   // an event needs at least one of these
const MULT_MIN = 0.5, MULT_MAX = 1.5;       // engine/src/economy/effects.ts, clipMult
const SOFT_MAX = 0.15;                      // |quality|, |reputation| per event
const SEASON_MONTHS = 12;
const MAX_CLOSURE_DAYS = 60;
/** Game rules, not facts: how many days ahead an event of each scale is announced (RULES.EVENT_NOTICE_DAYS is the floor). */
const NOTICE_DAYS = { point: 3, block: 5, city: 7, country: 10, world: 14 };
const SCALES = ['point', 'block', 'city', 'country', 'world'];
const MAX_MOVES = 5;                        // with ride_out
const MAX_SETTING_MOVES = 3;
const TARGET_TOTAL = 240;                   // all core events that fit, then the best deep ones up to this many
const HIGHER_IS_BETTER = { demand: 1, footTraffic: 1, staffAvailability: 1, quality: 1, reputation: 1, cash: 1, cogs: -1, wages: -1, rent: -1, utilities: -1, closureDays: -1, violation: -1 };

const round = (x, d = 3) => Math.round((x + Number.EPSILON) * 10 ** d) / 10 ** d;
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48);

// ───────────────────────── sources ─────────────────────────

function loadCatalogPack() {
  const arg = process.argv.slice(2).find((a) => !a.startsWith('--'));
  const local = [arg, join(ROOT, 'packs', 'cafe.next.json')].filter(Boolean);
  for (const p of local) if (existsSync(p)) return { pack: JSON.parse(readFileSync(p, 'utf8')), from: p.replace(ROOT + '/', '') };
  const raw = execFileSync('git', ['show', `${D11_BRANCH}:packs/cafe.next.json`], { cwd: ROOT, maxBuffer: 256 * 1024 * 1024 });
  return { pack: JSON.parse(raw.toString('utf8')), from: `${D11_BRANCH}:packs/cafe.next.json` };
}
function loadCommon() {
  for (const p of [join(HERE, '_common.json'), join(ROOT, 'packs', '_common.json')]) if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf8'));
  return { violations: [] };
}

// ───────────────────────── effects ─────────────────────────

const EFFECT_KEYS_OK = new Set(['field', 'mult', 'add', 'id', 'note', 'why', 'engine', 'fine', 'tiers', 'month', 'perWorkday', 'perInstance', 'cap']);
const noteOf = (x, extra) => [x.note, x.why, typeof x.onlyIf === 'string' ? `in the catalog: only if ${x.onlyIf}; the game uses the place tier` : undefined, extra].filter(Boolean).join('; ') || undefined;
const clean = (o) => { for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k]; return o; };

/** One catalog effect → one first-version effect, or { drop: reason }. `violations` is the set of ids the packs know. */
function normEffect(x, violations) {
  if (!x || typeof x !== 'object' || typeof x.field !== 'string') return { drop: 'not an effect object' };
  const hasTiers = Array.isArray(x.tiers) && x.tiers.length > 0;
  const cond = Object.keys(x).find((k) => !EFFECT_KEYS_OK.has(k) && !(k === 'onlyIf' && hasTiers));
  if (cond) return { drop: `condition "${cond}" is text the engine cannot check` };
  const tiers = Array.isArray(x.tiers) && x.tiers.length ? { tiers: x.tiers } : {};
  let f = x.field;
  let extra;
  if (f === 'capacity') { f = 'staffAvailability'; extra = 'catalog field "capacity": the same limit in the engine'; if (isNum(x.add) && !isNum(x.mult)) return { capacityAdd: x.add, note: noteOf(x) }; }
  if (MULT_FIELDS.includes(f)) {
    if (!isNum(x.mult)) return { drop: `${x.field} without a multiplier (add or formula)` };
    if (x.mult < MULT_MIN || x.mult > MULT_MAX) return { drop: `${x.field} x${x.mult} is outside ${MULT_MIN}-${MULT_MAX}` };
    if (x.mult === 1) return { drop: `${x.field} x1 changes nothing` };
    return { eff: clean({ field: f, mult: round(x.mult), ...tiers, note: noteOf(x, extra) }) };
  }
  if (ADD_FIELDS.includes(f)) {
    let add = x.add;
    if (!isNum(add) && isNum(x.mult)) { add = (x.mult - 1) * 0.5; extra = `catalog gives x${x.mult}; taken at the average level 0.5`; }
    if (!isNum(add) || add === 0) return { drop: `${f} without a number` };
    if (Math.abs(add) > SOFT_MAX) return { drop: `${f} ${add} is outside +-${SOFT_MAX}` };
    return { eff: clean({ field: f, add: round(add), ...tiers, note: noteOf(x, extra) }) };
  }
  if (f === 'cash' || f === 'cashOut' || f === 'cashIn' || f === 'fine' || f === 'monthlyCost' || f === 'monthlyFees') {
    if (!isNum(x.add)) return { drop: `${f} without a dollar amount (formula or multiplier)` };
    const sign = f === 'cash' || f === 'cashIn' ? 1 : -1;
    const add = Math.round(sign * x.add);
    if (add === 0) return { drop: `${f} of $0` };
    const monthly = f === 'monthlyCost' || f === 'monthlyFees';
    return { eff: clean({ field: 'cash', add, when: monthly ? 'monthly' : 'start', line: f === 'fine' ? 'fine' : undefined, ...tiers, note: noteOf(x, f === 'cash' ? undefined : `catalog field "${f}"`) }) };
  }
  if (f === 'closureDays' || f === 'downtimeDays') {
    if (!isNum(x.add) || x.add <= 0) return { drop: `${f} without a number of days` };
    if (x.add > MAX_CLOSURE_DAYS) return { drop: `${f} ${x.add} days is longer than ${MAX_CLOSURE_DAYS}` };
    return { eff: clean({ field: 'closureDays', add: Math.round(x.add), ...tiers, note: noteOf(x) }) };
  }
  if (f === 'violation' || f === 'violationAccrual' || f === 'violationExposure') {
    if (typeof x.id !== 'string') return { drop: `${f} without an id` };
    if (!violations.has(x.id)) return { drop: `violation "${x.id}" is not in the packs` };
    return { eff: clean({ field: 'violation', id: x.id, ...tiers, note: noteOf(x, f === 'violation' ? undefined : `catalog field "${f}": the daily accrual is left out`) }) };
  }
  return { drop: `field "${f}" is not in the first version` };
}

/** Same field twice → one effect: multipliers multiply, amounts add, a violation id is kept once. */
function mergeEffects(list) {
  const out = [];
  for (const e of list) {
    const same = out.find((o) => o.field === e.field && (o.when ?? '') === (e.when ?? '') && (o.id ?? '') === (e.id ?? '') && (o.line ?? '') === (e.line ?? '') && JSON.stringify(o.tiers ?? null) === JSON.stringify(e.tiers ?? null));
    if (!same) { out.push({ ...e }); continue; }
    if (isNum(e.mult)) same.mult = round(same.mult * e.mult);
    if (isNum(e.add)) same.add = round(same.add + e.add);
    if (e.note && e.note !== same.note) same.note = [same.note, e.note].filter(Boolean).join(' | ');
  }
  return out.filter((e) => !(isNum(e.mult) && e.mult === 1) && !(e.field !== 'violation' && !isNum(e.mult) && e.add === 0))
    .sort((a, b) => FIELDS.indexOf(a.field) - FIELDS.indexOf(b.field));
}

function eventEffects(e, violations, log) {
  const list = [];
  for (const x of e.effects ?? []) {
    const r = normEffect(x, violations);
    if (r.eff) list.push(r.eff); else log.droppedEffects.push(`${x?.field}: ${r.drop ?? 'capacity given as an addition'}`);
  }
  if (isNum(e.oneTimeCost) && e.oneTimeCost > 0) list.push({ field: 'cash', add: -Math.round(e.oneTimeCost), when: 'start', note: 'catalog field "oneTimeCost"' });
  for (const k of ['downtimeDays', 'closureDays']) {
    if (isNum(e[k]) && e[k] > 0 && e[k] <= MAX_CLOSURE_DAYS && !list.some((x) => x.field === 'closureDays')) list.push({ field: 'closureDays', add: Math.round(e[k]), note: `catalog field "${k}" of the event` });
  }
  return mergeEffects(list);
}

// ───────────────────────── moves ─────────────────────────

const COST_DICT_OK = new Set(['oneTime', 'monthly', 'cash', 'usd', 'usdMonthly', 'lostSales', 'other', 'note', 'days', 'lawyerHours', 'staffMinutes', 'staffMinutesPerDay', 'see', 'onceOnly']);

/** Value of a list of effects, field by field, for "is this move better or worse than doing nothing". */
function vector(effects, months) {
  const v = Object.fromEntries(FIELDS.map((f) => [f, MULT_FIELDS.includes(f) ? 1 : 0]));
  for (const e of effects) {
    if (MULT_FIELDS.includes(e.field)) v[e.field] *= e.mult;
    else if (e.field === 'violation') v.violation += 1;
    else if (e.field === 'cash') v.cash += e.add * (e.when === 'monthly' ? Math.max(1, months) : 1);
    else v[e.field] += e.add;
  }
  return v;
}
function compare(move, base, months) {
  const a = vector(move, months), b = vector(base, months);
  let better = 0, worse = 0;
  for (const f of FIELDS) {
    const d = (a[f] - b[f]) * HIGHER_IS_BETTER[f];
    if (d > 1e-9) better++; else if (d < -1e-9) worse++;
  }
  return { better, worse };
}

function normMove(m, e, base, ctx, months) {
  const { violations, levers, shortcuts } = ctx;
  if (m.kind === 'price') return { drop: 'a price change is the player\'s own standing order, not an event move' };
  const cost = { cash: 0 };
  const extra = [];       // effects the move itself carries as its price
  const notes = [];
  let onTop = false;      // D17 style: the result is a change on top of the event; D15/D16 style: the result replaces it
  if (m.cost == null || m.result == null) return settingMove(m, e, base, ctx);
  if (Array.isArray(m.cost)) {
    onTop = true;
    for (const c of m.cost) {
      if (!c || typeof c !== 'object') return { drop: 'cost is text' };
      if (c.field === 'cashOut' && isNum(c.add)) cost.cash += c.add;
      else if (c.field === 'cashIn' && isNum(c.add)) cost.cash -= c.add;
      else if (c.field === 'monthlyCost' && isNum(c.add)) cost.monthly = (cost.monthly ?? 0) + c.add;
      else if (c.field === 'ownerHours' && isNum(c.add)) cost.ownerHours = (cost.ownerHours ?? 0) + c.add;
      else { const r = normEffect(c, violations); if (r.eff) extra.push(r.eff); else return { drop: `cost "${c.field}" cannot be charged in the first version` }; }
      if (c.note) notes.push(c.note);
    }
  } else if (typeof m.cost === 'object') {
    const bad = Object.keys(m.cost).find((k) => !COST_DICT_OK.has(k));
    if (bad) return { drop: `cost "${bad}" cannot be charged in the first version` };
    for (const k of ['oneTime', 'cash', 'usd']) if (isNum(m.cost[k])) cost.cash += m.cost[k];
    for (const k of ['monthly', 'usdMonthly']) if (isNum(m.cost[k])) cost.monthly = (cost.monthly ?? 0) + m.cost[k];
    if (isNum(m.cost.lostSales) && m.cost.lostSales > 0 && m.cost.lostSales < 0.5) extra.push({ field: 'demand', mult: round(1 - m.cost.lostSales), note: `lost sales ${m.cost.lostSales} of the month (catalog cost "lostSales")` });
    for (const k of ['other', 'note']) if (typeof m.cost[k] === 'string') notes.push(m.cost[k]);
    if (isNum(m.cost.days)) notes.push(`takes ${m.cost.days} days`);
    if (isNum(m.cost.lawyerHours)) notes.push(`${m.cost.lawyerHours} lawyer hours`);
  } else return { drop: 'cost is text' };
  if (!Array.isArray(m.result)) return { drop: 'the result is a sentence without a number' };
  // D16 style (cost as a table, result as the full list of what is left): an empty list means the move prevents the event
  const prevents = !onTop && m.result.length === 0 && extra.length === 0;

  const res = [];
  const capAdds = [];
  for (const x of m.result) {
    if (x && typeof x === 'object' && x.field === 'price') return { drop: 'a price change is the player\'s own standing order, not an event move' };
    if (x && typeof x === 'object' && x.field === 'cashOneTime' && isNum(x.add ?? x.amount)) { res.push({ field: 'cash', add: Math.round(x.add ?? x.amount), when: 'start', note: noteOf(x, 'catalog field "cashOneTime"') }); continue; }
    const r = normEffect(x, violations);
    if (r.eff) res.push(r.eff);
    else if (isNum(r.capacityAdd)) capAdds.push(r.capacityAdd);
    else if (x && typeof x === 'object' && x.field === 'ownerHours') { if (isNum(x.add)) cost.ownerHours = (cost.ownerHours ?? 0) + x.add; }
    else return { drop: `result "${x?.field ?? 'text'}" is not in the first version (${r.drop})` };
  }
  if (typeof m.violation === 'string') {
    if (!violations.has(m.violation)) return { drop: `violation "${m.violation}" is not in the packs` };
    res.push({ field: 'violation', id: m.violation, note: 'the move itself is the violation' });
  }
  if (res.length === 0 && capAdds.length === 0 && extra.length === 0 && !prevents) return { drop: 'no result with a number' };

  let effects;
  if (onTop) {
    // the result changes the event: multipliers multiply, amounts add; a harmful effect can be undone, not turned into a gain
    effects = base.map((b) => ({ ...b }));
    for (const r of [...res, ...extra]) {
      const same = effects.find((o) => o.field === r.field && (o.when ?? '') === (r.when ?? '') && (o.id ?? '') === (r.id ?? ''));
      if (!same) { effects.push({ ...r }); continue; }
      if (isNum(r.mult)) {
        const before = same.mult; let next = before * r.mult;
        if ((before < 1 && next > 1) || (before > 1 && next < 1)) next = 1;
        same.mult = round(next);
      } else if (isNum(r.add)) {
        const before = same.add; let next = before + r.add;
        if ((before < 0 && next > 0) || (before > 0 && next < 0 && r.field !== 'cash')) next = 0;
        same.add = round(next);
      }
      same.note = [same.note, r.note && `move: ${r.note}`].filter(Boolean).join(' | ') || undefined;
    }
    for (const add of capAdds) {
      const same = effects.find((o) => o.field === 'staffAvailability');
      if (same) same.mult = round(Math.min(1, same.mult + add));
    }
  } else {
    effects = [...res, ...extra];
  }
  effects = mergeEffects(effects.map(clean));

  cost.cash = Math.round(cost.cash);
  if (cost.monthly !== undefined) cost.monthly = Math.round(cost.monthly);
  if (cost.monthly === 0) delete cost.monthly;
  if (cost.ownerHours !== undefined) cost.ownerHours = round(cost.ownerHours, 1);
  const paid = cost.cash + (cost.monthly ?? 0) * Math.max(1, months);
  const { better, worse } = compare(effects, base, months);
  if (paid > 0 && better === 0) return { drop: 'costs money and improves nothing the engine counts' };
  if (paid <= 0 && worse === 0) return { drop: 'a free gain: no price and nothing gets worse' };
  if (paid === 0 && better === 0) return { drop: 'only makes things worse' };

  // label: the catalog's own, else the name of the pack setting it points to
  let label = typeof m.label === 'string' && m.label.trim() ? m.label.trim() : undefined;
  // some catalog labels are bare references ("lever cleaning:standard"): take the pack's own words instead
  const ref = label && /^(lever|shortcut|roadmap|setup|choice)\s+([a-z0-9_]+)(?::([a-z0-9_]+))?$/i.exec(label);
  if (ref) {
    const l = ctx.levers.get(ref[2]); const o = l?.options?.find((x) => x.id === (ref[3] ?? m.optionId));
    label = l ? (o ? `${l.name}: ${o.label}` : l.name) : shortcuts.get(ref[2])?.name ?? ctx.roadmap.get(ref[2])?.title ?? ctx.setup.get(ref[2])?.name;
    if (!label) { const words = [ref[2], ref[3]].filter(Boolean).join(': ').replace(/_/g, ' '); label = words.charAt(0).toUpperCase() + words.slice(1); }
  }
  if (!label && m.kind === 'shortcut') label = shortcuts.get(m.id)?.name;
  if (!label && m.kind === 'lever') { const l = levers.get(m.id); const o = l?.options?.find((x) => x.id === m.optionId); if (l) label = o ? `${l.name}: ${o.label}` : l.name; }
  if (!label) return { drop: 'no label for the player' };
  const id = slug([m.id, m.optionId].filter(Boolean).join('_') || label);
  if (typeof m.note === 'string') notes.unshift(m.note);
  if (prevents) notes.push('Prevents the event: it must be bought before the event starts.');
  return { move: clean({ id, label, cost, effects, byDay: prevents ? 0 : undefined, note: notes.join('; ') || undefined }) };
}

/**
 * A catalog move that only names a pack setting ("the answer is this lever"). The move switches the setting on; its
 * price and its effect are the pack's own numbers and are charged by the lever and shortcut code, not by the event.
 */
function settingMove(m, e, base, ctx) {
  const { levers, shortcuts, violations } = ctx;
  const effects = base.map((x) => { const { note: _n, ...rest } = x; return rest; });
  if (m.kind === 'lever' && levers.has(m.id)) {
    const lever = levers.get(m.id);
    const def = lever.options.find((o) => !o.causes) ?? lever.options[0];
    const opt = m.optionId ? lever.options.find((o) => o.id === m.optionId) : lever.options.find((o) => o !== def && !o.causes && o.monthlyCost > 0);
    if (!opt || opt === def || !(opt.monthlyCost > 0) || opt.causes) return { drop: 'the pack lever has no paid option to switch on' };
    const am = opt.activeMonths ?? lever.activeMonths;
    if (Array.isArray(am) && !e.months.some((x) => am.includes(x))) return { drop: 'the pack lever is not active in the months of the event' };
    const fx = {};
    for (const k of ['demand', 'capacity', 'quality', 'reputation']) if (isNum(opt.effects?.[k]) && opt.effects[k] !== 0) fx[k] = opt.effects[k];
    return { move: { id: slug(`set_${lever.id}_${opt.id}`), label: `${lever.name}: ${opt.label}`, cost: { cash: 0 }, effects,
      setting: clean({ kind: 'lever', id: lever.id, optionId: opt.id, monthlyCost: opt.monthlyCost, effects: Object.keys(fx).length ? fx : undefined }),
      note: 'Switches a standing setting of the shop on; it stays on after the event until you switch it back. The price and the effect are the pack\'s.' } };
  }
  if (m.kind === 'shortcut' && shortcuts.has(m.id)) {
    const sc = shortcuts.get(m.id);
    if (!sc.violation || !violations.has(sc.violation) || !sc.saves) return { drop: 'the pack shortcut has no saving or no known violation' };
    return { move: { id: slug(`cut_${sc.id}`), label: sc.name, cost: { cash: 0 }, effects,
      setting: { kind: 'shortcut', id: sc.id, saves: sc.saves, violation: sc.violation },
      note: 'Cuts a corner: it saves money every month it is on and opens a violation an inspector can find. The saving and the violation are the pack\'s.' } };
  }
  return { drop: 'a reference to something that is not a lever or a shortcut of the pack' };
}

// ───────────────────────── which events ─────────────────────────

const WEATHER_WORDS = /\b(snow|blizzard|ice|icy|freez|frost|cold snap|heat|hot|rain|storm|hurricane|flood|thunder|nor.?easter|wind chill|humid)/i;
function kindOf(e, effects) {
  const text = `${e.id} ${e.name}`;
  const has = (f) => effects.some((x) => x.field === f);
  if (WEATHER_WORDS.test(text) && (has('footTraffic') || has('demand') || has('staffAvailability') || has('utilities'))) return 'weather';
  if (has('violation') || effects.some((x) => x.line === 'fine') || /inspect|permit|law|rule|ban|tax|fee|licen|code|summons|audit/i.test(text)) return 'regulation';
  if (has('cogs')) return 'supply';
  if (has('wages') || has('staffAvailability')) return 'staff';
  if (has('footTraffic')) return 'traffic';
  if (has('demand')) return 'demand';
  return 'city';
}

/** How the event starts. Only two ways need no chance and no state the engine lacks. */
function launchOf(e, ctx) {
  const t = String(e.trigger ?? '').trim();
  // a bare "decision" in the catalog marks a dilemma: the event itself is the moment of choice
  if (t === '' || /^(announced|calendar)/i.test(t) || /^decision$/i.test(t)) return { launch: 'calendar' };
  // three states the engine already keeps: last month's price, the cash against the fixed costs, a closure that ended
  const rise = /price order rises more than (\d+)%/i.exec(t);
  if (rise) return { launch: 'condition', requires: { priceRisePct: Number(rise[1]) } };
  if (/cash below two weeks of fixed costs/i.test(t)) return { launch: 'condition', requires: { cashBelowDaysOfFixedCosts: 14 } };
  if (/violation that closed the shop/i.test(t)) return { launch: 'condition', requires: { afterClosure: true } };
  if (/^decision/i.test(t)) {
    const words = t.match(/[a-z][a-z0-9_]+/g) ?? [];
    const sc = words.find((w) => ctx.shortcuts.has(w)) ?? (e.playerMoves ?? []).find((m) => m.kind === 'shortcut' && ctx.shortcuts.has(m.id))?.id;
    if (sc) return { launch: 'decision', requires: { shortcut: sc } };
    const m = /([a-z][a-z0-9_]+)\s*=\s*([a-z][a-z0-9_]+)/.exec(t);
    if (m && ctx.levers.get(m[1])?.options?.some((o) => o.id === m[2])) return { launch: 'decision', requires: { lever: { id: m[1], optionId: m[2] } } };
  }
  if (/^decision/i.test(t)) return { skip: 'follows from a decision the engine cannot see yet' };
  return { skip: 'the trigger needs a state the engine does not track yet' };
}

function scoreDeep(e, ev) {
  let s = 0;
  if (e.confidence === 'verified') s += 3;
  if (ev.scale === 'city' || ev.scale === 'country' || ev.scale === 'world') s += 3;
  if (ev.scale === 'block') s += 1;
  if (e.calibrated) s += 1;
  if (ev.months.length < 12) s += 1;             // a real season
  s += Math.min(2, ev.moves.length - 2);         // more than one real move
  if (ev.effects.some((x) => MULT_FIELDS.includes(x.field))) s += 1;   // runs in the engine as it is today
  return s;
}

function build() {
  const { pack, from } = loadCatalogPack();
  const common = loadCommon();
  const catalog = pack.extra?.eventCatalog;
  if (!Array.isArray(catalog)) throw new Error('extra.eventCatalog is missing in the source pack');
  const ctx = {
    violations: new Set([...(pack.violations ?? []), ...(common.violations ?? [])].map((v) => v.id)),
    levers: new Map((pack.levers ?? []).map((l) => [l.id, l])),
    shortcuts: new Map([...(pack.shortcuts ?? []), ...(common.shortcuts ?? [])].map((s) => [s.id, s])),
    roadmap: new Map([...(pack.roadmap ?? []), ...(common.roadmap ?? [])].map((s) => [s.id, s])),
    setup: new Map((pack.setup ?? []).map((s) => [s.id, s])),
  };
  const log = [];
  const fit = [];
  const seenId = new Set(), seenName = new Set(), seenSig = new Set();
  // core first, verified first: of two copies of one event the better one stays
  const order = [...catalog].sort((a, b) => (a.tier === 'core' ? 0 : 1) - (b.tier === 'core' ? 0 : 1) || (a.confidence === 'verified' ? 0 : 1) - (b.confidence === 'verified' ? 0 : 1) || a.id.localeCompare(b.id));
  for (const e of order) {
    const entry = { id: e.id, tier: e.tier, scale: e.scale, taken: false, droppedEffects: [], droppedMoves: [] };
    log.push(entry);
    const skip = (why) => { entry.why = why; };
    if (e.tier !== 'core' && e.tier !== 'deep') { skip('tier exotic'); continue; }
    if (!SCALES.includes(e.scale)) { skip(`unknown scale "${e.scale}"`); continue; }
    if (Array.isArray(e.formats) && !e.formats.includes('cafe')) { skip('another format'); continue; }
    if (e.appliesTo) { skip(`only for "${[].concat(e.appliesTo).join(', ')}"`); continue; }
    const months = Array.isArray(e.months) ? [...new Set(e.months.filter((m) => Number.isInteger(m) && m >= 1 && m <= 12))].sort((a, b) => a - b) : [];
    if (months.length === 0) { skip('no months'); continue; }
    const l = launchOf(e, ctx);
    if (l.skip) { skip(l.skip); continue; }
    const effects = eventEffects(e, ctx.violations, entry);
    if (!effects.some((x) => HARD_FIELDS.includes(x.field))) { skip('no effect of the first version is left'); continue; }
    const durationMonths = isNum(e.durationMonths) && e.durationMonths >= 0 ? e.durationMonths : 1;
    const activeMonths = Math.min(SEASON_MONTHS, Math.max(1, Math.round(durationMonths)));
    const moves = [{ id: 'ride_out', label: 'Ride it out', cost: { cash: 0 }, effects: effects.map((x) => { const { note: _n, ...rest } = x; return rest; }) }];
    const raw = [...(e.playerMoves ?? [])].sort((a, b) => (a.cost == null ? 1 : 0) - (b.cost == null ? 1 : 0));
    for (const m of raw) {
      const r = normMove(m, { ...e, months }, effects, ctx, activeMonths);
      if (r.move?.setting && l.requires?.shortcut === r.move.setting.id) { entry.droppedMoves.push(`${m.id}: this corner is the cause of the event, not an answer to it`); continue; }
      if (r.move?.setting && moves.filter((x) => x.setting).length >= MAX_SETTING_MOVES) { entry.droppedMoves.push(`${m.id}: more than ${MAX_SETTING_MOVES} setting moves`); continue; }
      if (r.move && moves.length >= MAX_MOVES) { entry.droppedMoves.push(`${m.id ?? m.label}: more than ${MAX_MOVES} moves`); continue; }
      if (!r.move) { entry.droppedMoves.push(`${m.id ?? m.label ?? m.kind}: ${r.drop}`); continue; }
      let id = r.move.id; let n = 2;
      while (moves.some((x) => x.id === id)) id = `${r.move.id}_${n++}`;
      if (moves.some((x) => x.label === r.move.label && JSON.stringify(x.cost) === JSON.stringify(r.move.cost))) { entry.droppedMoves.push(`${id}: the same move twice`); continue; }
      moves.push({ ...r.move, id });
    }
    if (moves.length < 2) { skip('no move with a price and a result in numbers'); continue; }
    const nameKey = slug(e.name);
    const sig = JSON.stringify([e.scale, months, effects.map((x) => [x.field, x.mult ?? x.add ?? x.id]), moves.map((m) => m.label)]);
    const ids = [e.id, ...(e.aliases ?? [])];
    if (ids.some((i) => seenId.has(i))) { skip('duplicate id or alias'); continue; }
    if (seenName.has(nameKey)) { skip('duplicate name'); continue; }
    if (seenSig.has(sig)) { skip('duplicate: same scale, months, effects and moves'); continue; }
    ids.forEach((i) => seenId.add(i)); seenName.add(nameKey); seenSig.add(sig);
    const ev = clean({
      id: e.id, name: e.name, text: e.text, kind: kindOf(e, effects), scale: e.scale, tier: e.tier,
      months, durationMonths, durationDays: durationMonths === 0 ? 1 : activeMonths * 30, noticeDays: NOTICE_DAYS[e.scale],
      launch: l.launch, requires: l.requires, trigger: e.trigger, signal: e.realSignal,
      effects, moves, source: e.source, confidence: e.confidence === 'verified' ? 'verified' : 'estimate',
      note: e.note, realFrequency: /^not estimated/i.test(e.realFrequency ?? '') ? undefined : e.realFrequency,
    });
    fit.push({ e, ev, entry });
  }
  const core = fit.filter((x) => x.e.tier === 'core');
  const deep = fit.filter((x) => x.e.tier === 'deep').map((x) => ({ ...x, score: scoreDeep(x.e, x.ev) }))
    .sort((a, b) => b.score - a.score || a.e.id.localeCompare(b.e.id));
  const room = Math.max(0, TARGET_TOTAL - core.length);
  const takenDeep = deep.slice(0, room);
  for (const x of deep.slice(room)) x.entry.why = `deep event below the cut (score ${x.score})`;
  const taken = [...core, ...takenDeep];
  for (const x of taken) x.entry.taken = true;
  const events = taken.map((x) => x.ev).sort((a, b) => SCALES.indexOf(b.scale) - SCALES.indexOf(a.scale) || a.id.localeCompare(b.id));

  const count = (xs, f) => xs.reduce((o, x) => { const k = f(x); o[k] = (o[k] ?? 0) + 1; return o; }, {});
  const fieldsUsed = {};
  for (const ev of events) for (const f of new Set(ev.effects.map((x) => x.field))) fieldsUsed[f] = (fieldsUsed[f] ?? 0) + 1;
  const out = {
    id: 'cafe.events', version: 1, niche: 'cafe',
    spec: 'build/EVENTS.md',
    builtBy: 'packs/next/build-events.mjs',
    builtFrom: from.replace(/^.*packs\/cafe\.next\.json$/, 'packs/cafe.next.json'),
    fields: FIELDS,
    rules: {
      note: 'Game rules, not facts: notice by scale, the limits of a multiplier, how many events run at once (build/EVENTS.md, section 2).',
      noticeDays: NOTICE_DAYS, multMin: MULT_MIN, multMax: MULT_MAX, softMax: SOFT_MAX,
      maxActivePerBusiness: 3, maxActiveByScale: { world: 1, country: 1, city: 1, block: 1, point: 1 },
    },
    counts: {
      catalog: catalog.length, events: events.length,
      byScale: count(events, (x) => x.scale), byTier: count(events, (x) => x.tier), byConfidence: count(events, (x) => x.confidence),
      byKind: count(events, (x) => x.kind), byLaunch: count(events, (x) => x.launch),
      cityAndWider: events.filter((x) => ['city', 'country', 'world'].includes(x.scale)).length,
      moves: events.reduce((a, x) => a + x.moves.length, 0), movesWithOwnNumbers: events.reduce((a, x) => a + x.moves.filter((m) => m.id !== 'ride_out' && !m.setting).length, 0),
      eventsWithOwnMove: events.filter((x) => x.moves.some((m) => m.id !== 'ride_out' && !m.setting)).length, fieldsUsed,
    },
    events,
  };
  const skipped = count(log.filter((x) => !x.taken), (x) => x.why ?? 'unknown');
  const logOut = { builtFrom: out.builtFrom, taken: events.length, skipped, events: log.sort((a, b) => a.id.localeCompare(b.id)).map((x) => clean({ ...x, droppedEffects: x.droppedEffects.length ? x.droppedEffects : undefined, droppedMoves: x.droppedMoves.length ? x.droppedMoves : undefined })) };
  return { out, logOut };
}

// ───────────────────────── self-check ─────────────────────────

function check(out) {
  const errs = [];
  const ids = new Set();
  for (const ev of out.events) {
    const at = (m) => errs.push(`${ev.id}: ${m}`);
    if (ids.has(ev.id)) at('duplicate id'); ids.add(ev.id);
    for (const k of ['id', 'scale', 'months', 'durationMonths', 'noticeDays', 'effects', 'moves', 'source', 'confidence']) if (ev[k] === undefined || ev[k] === null || ev[k] === '') at(`no "${k}"`);
    if (ev.moves.length < 2) at('fewer than two moves');
    if (ev.moves[0].id !== 'ride_out' || ev.moves[0].cost.cash !== 0) at('the first move must be a free ride_out');
    if (ev.noticeDays < 3) at('notice shorter than RULES.EVENT_NOTICE_DAYS');
    const all = [...ev.effects, ...ev.moves.flatMap((m) => m.effects)];
    for (const x of all) {
      if (!FIELDS.includes(x.field)) at(`field "${x.field}"`);
      if (MULT_FIELDS.includes(x.field) && !(x.mult >= MULT_MIN && x.mult <= MULT_MAX)) at(`${x.field} multiplier ${x.mult}`);
      if (x.field === 'violation' && !x.id) at('violation without an id');
      if ((x.field === 'cash' || x.field === 'closureDays' || ADD_FIELDS.includes(x.field)) && !isNum(x.add)) at(`${x.field} without a number`);
    }
    for (const m of ev.moves.slice(1)) {
      const months = Math.min(SEASON_MONTHS, Math.max(1, Math.round(ev.durationMonths)));
      const paid = m.cost.cash + (m.cost.monthly ?? 0) * months;
      const { better, worse } = compare(m.effects, ev.effects, months);
      if (m.setting) { if (!(m.setting.monthlyCost > 0) && !m.setting.violation) at(`setting move "${m.id}" has no price`); continue; }
      if (paid <= 0 && worse === 0) at(`move "${m.id}" is a free gain`);
      if (paid > 0 && better === 0) at(`move "${m.id}" costs money for nothing`);
    }
  }
  if (out.events.length < 150) errs.push(`only ${out.events.length} events, 150 are needed`);
  if (out.counts.cityAndWider < 40) errs.push(`only ${out.counts.cityAndWider} events of city, country and world scale, 40 are needed`);
  return errs;
}

const { out, logOut } = build();
const errs = check(out);
const text = JSON.stringify(out, null, 1) + '\n';
if (process.argv.includes('--check')) {
  const same = existsSync(OUT) && readFileSync(OUT, 'utf8') === text;
  console.log(same ? 'cafe.events.json is up to date' : 'cafe.events.json differs from a fresh build');
  if (errs.length) console.log(errs.join('\n'));
  process.exit(same && errs.length === 0 ? 0 : 1);
}
writeFileSync(OUT, text);
writeFileSync(LOG, JSON.stringify(logOut, null, 1) + '\n');
console.log(`source: ${out.builtFrom}`);
console.log(`catalog ${out.counts.catalog} -> events ${out.counts.events} (${Math.round(text.length / 1024)} KB)`);
console.log('by scale     ', JSON.stringify(out.counts.byScale), `| city and wider: ${out.counts.cityAndWider}`);
console.log('by tier      ', JSON.stringify(out.counts.byTier));
console.log('by confidence', JSON.stringify(out.counts.byConfidence));
console.log('by kind      ', JSON.stringify(out.counts.byKind));
console.log('by launch    ', JSON.stringify(out.counts.byLaunch));
console.log('fields used  ', JSON.stringify(out.counts.fieldsUsed));
console.log('moves        ', out.counts.moves);
console.log('skipped      ', JSON.stringify(logOut.skipped, null, 1));
if (errs.length) { console.log(`\nFAIL: ${errs.length} problems`); console.log(errs.slice(0, 40).join('\n')); process.exit(1); }
console.log('\nOK: every event has an id, scale, months, duration, notice, effects, two or more moves, a source and a confidence');
