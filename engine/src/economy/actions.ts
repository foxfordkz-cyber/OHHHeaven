// Owner actions handled by the economy: build/CONTRACT.md, section 3 (economyActions).
import type { Action, ActionResult, BusinessState, Pack, PermitState, Player, StandingOrders, WorldState } from '../../../shared/src/types';
import { RULES } from '../../../shared/src/rules';
import type { EngineCtx } from '../index';
import { defaultLeverOption } from './effects';
import { activeBusinessOf, addLine, clamp, econOf, emptyMtd, itemDef, maxSizeFor, placeOf, replaceBusiness, round2, staffCount, withEcon, type EconExtra } from './util';

const ECONOMY_ACTIONS = new Set(['open_business', 'launch', 'set_orders', 'buy_item', 'sell_item', 'resize', 'read_inbox']);
const fail = (w: WorldState, error: string): ActionResult => ({ world: w, error });

export function economyActions(w: WorldState, ctx: EngineCtx, playerId: string, a: Action): ActionResult | null {
  const mine = ECONOMY_ACTIONS.has(a.type) || (a.type === 'spend' && (a.kind === 'marketing' || a.kind === 'training'));
  if (!mine) return null;
  const player = w.players.find((p) => p.id === playerId);
  if (!player) return fail(w, 'Unknown player');
  if (a.type === 'read_inbox') return readInbox(w, player, a.ids);
  if (player.kind !== 'owner') return fail(w, 'Only business owners can do this');
  if (a.type === 'open_business') return openBusiness(w, ctx, player, a);

  const b = activeBusinessOf(w, playerId);
  if (!b) return fail(w, 'You have no business yet');
  const pack = ctx.packs.niches[b.niche];
  if (!pack) return fail(w, `No data for niche ${b.niche}`);
  switch (a.type) {
    case 'launch': return launch(w, ctx, b, pack, player);
    case 'set_orders': return setOrders(w, ctx, b, pack, a.orders);
    case 'buy_item': return buyItem(w, b, pack, a.itemId, a.qty);
    case 'sell_item': return sellItem(w, b, pack, a.itemId, a.qty);
    case 'resize': return resize(w, ctx, b, pack, a.size);
    case 'spend': return spend(w, b, a.kind as 'marketing' | 'training', a.amount);
    default: return null;
  }
}

export function defaultOrders(pack: Pack): StandingOrders {
  const levers: Record<string, string> = {};
  for (const l of pack.levers) {
    const o = defaultLeverOption(l.options);
    if (o) levers[l.id] = o.id;
  }
  const staff: Record<string, number> = {};
  const per = pack.capacity.unitsPerStaffMonth;
  const need = per ? Math.ceil(pack.market.unitsPerSlotMonth / per) : pack.capacity.minStaff;
  if (pack.staff[0]) staff[pack.staff[0].id] = clamp(need, pack.capacity.minStaff, pack.capacity.maxStaff);
  return { price: pack.unit.refPrice, staff, levers, shortcuts: [], blockFund: false, autopilot: 'hold' };
}

/** Setup cost of a list of items at a given size (items that scale with size cost per unit of size). */
export function itemsCost(pack: Pack, items: readonly { id: string; qty: number }[], size: number): number {
  let total = 0;
  for (const it of items) {
    const def = itemDef(pack, it.id);
    if (!def) continue;
    total += def.cost * (def.scalesWithSize ? size : it.qty);
  }
  return round2(total);
}

function normalizeItems(pack: Pack, items: readonly { id: string; qty: number }[], size: number): { id: string; qty: number }[] | string {
  const out = new Map<string, number>();
  for (const it of items) {
    const def = itemDef(pack, it.id);
    if (!def) return `Unknown item: ${it.id}`;
    const qty = def.scalesWithSize ? size : Math.floor(it.qty);
    if (qty <= 0) continue;
    out.set(it.id, def.scalesWithSize ? size : (out.get(it.id) ?? 0) + qty);
  }
  for (const def of pack.setup) {
    if (def.required && !out.has(def.id)) return `Missing required item: ${def.name}`;
  }
  return [...out].map(([id, qty]) => ({ id, qty }));
}

function openBusiness(w: WorldState, ctx: EngineCtx, player: Player, a: Extract<Action, { type: 'open_business' }>): ActionResult {
  if (activeBusinessOf(w, player.id)) return fail(w, 'You already run a business');
  const pack = ctx.packs.niches[a.niche];
  if (!pack) return fail(w, `This niche is not playable yet: ${a.niche}`);
  const place = placeOf(ctx, a.placeId);
  if (!place) return fail(w, 'Unknown place');
  if (place.suitableFor.length > 0 && !place.suitableFor.includes(a.niche)) return fail(w, `This space is not suitable for a ${pack.name.toLowerCase()}`);
  if (w.businesses.some((x) => x.placeId === place.id && x.status !== 'bankrupt')) return fail(w, 'This space is already taken');
  const kit = pack.kits.find((k) => k.id === a.kitId);
  if (!kit) return fail(w, 'Unknown kit');
  const size = Math.floor(a.size || kit.size);
  const maxSize = maxSizeFor(pack, place, RULES.USABLE_FLOOR_SHARE);
  if (size < pack.sizing.min || size > pack.sizing.max) return fail(w, `Size must be between ${pack.sizing.min} and ${pack.sizing.max} ${pack.sizing.unitName}s`);
  if (size > maxSize) return fail(w, `Only ${maxSize} ${pack.sizing.unitName}s fit in ${place.sqft} sq ft`);
  const items = normalizeItems(pack, a.items ?? kit.items, size);
  if (typeof items === 'string') return fail(w, items);
  const cost = itemsCost(pack, items, size);
  const cash = round2(pack.startCapital - cost);
  if (cash < 0) return fail(w, `Not enough money: this setup costs $${Math.round(cost).toLocaleString('en-US')}, you have $${pack.startCapital.toLocaleString('en-US')}`);
  const name = a.name.trim().slice(0, 40);
  if (!name) return fail(w, 'Give your business a name');

  const permits: PermitState[] = [];
  let quality = 0.5;
  for (const it of items) {
    const def = itemDef(pack, it.id)!;
    if ((def.kind === 'permit' || def.kind === 'license') && def.waitDays && def.waitDays > 0) {
      permits.push({ itemId: def.id, appliedDay: w.day, readyDay: w.day + def.waitDays });
    }
    quality += def.qualityBonus ?? 0;
  }
  const id = `biz_${w.businesses.length + 1}`;
  const econ: EconExtra = { marketing: 0, training: 0, lossCarry: 0, cashStart: pack.startCapital, mtd: emptyMtd() };
  const b: BusinessState = withEcon({
    id, name, niche: a.niche, placeId: place.id, isAi: player.isAi,
    owners: [{ playerId: player.id, share: 1 }], managerPlayerId: player.id,
    status: 'setup', createdDay: w.day,
    cash, size, items, setupSpent: cost, permits,
    quality: clamp(quality, 0, 1), reputation: 0.5, trust: { kept: 0, broken: 0 },
    orders: defaultOrders(pack), trails: [], liabilities: [],
    mtd: { lines: [{ id: 'setup_open', label: `Setup: ${kit.name}`, kind: 'setup', amount: -cost }], demandUnits: 0, servedUnits: 0, lost: { size: 0, staff: 0, closure: 0 } },
    days: [], history: [],
  }, econ);
  return { world: { ...w, businesses: [...w.businesses, b] } };
}

function launch(w: WorldState, ctx: EngineCtx, b: BusinessState, pack: Pack, player: Player): ActionResult {
  if (b.status !== 'setup') return fail(w, 'Your doors are already open');
  const missing = b.permits.filter((p) => p.readyDay > w.day).map((p) => itemDef(pack, p.itemId)).filter((d) => !!d && !!d.withoutItViolation);
  const opened: BusinessState = { ...b, status: 'open', openedDay: w.day };
  const place = placeOf(ctx, b.placeId);
  let world = replaceBusiness(w, opened);
  world = { ...world, feed: [...world.feed, { id: `feed-${w.day}-${w.feed.length}`, day: w.day, kind: 'opening', text: `${b.name} opened its doors${place ? ` at ${place.address}` : ''}`, businessId: b.id }] };
  if (missing.length > 0) {
    const names = missing.map((d) => d!.name).join(', ');
    world = {
      ...world,
      players: world.players.map((p) => p.id !== player.id ? p : {
        ...p, inbox: [...p.inbox, { id: `inbox-${w.day}-${p.inbox.length}`, day: w.day, kind: 'system', title: 'Opened without a permit',
          text: `You opened before this was ready: ${names}. Every day you trade without it is a violation an inspector can find.`, ref: { type: 'business', id: b.id }, read: false }],
      }),
    };
  }
  return { world };
}

function setOrders(w: WorldState, ctx: EngineCtx, b: BusinessState, pack: Pack, patch: Partial<StandingOrders>): ActionResult {
  const o: StandingOrders = { ...b.orders };
  if (patch.price !== undefined) {
    if (!Number.isFinite(patch.price)) return fail(w, 'Price must be a number');
    o.price = round2(clamp(patch.price, pack.unit.priceMin, pack.unit.priceMax));
  }
  if (patch.staff !== undefined) {
    const staff: Record<string, number> = {};
    for (const role of pack.staff) {
      const n = patch.staff[role.id] ?? b.orders.staff[role.id] ?? 0;
      staff[role.id] = clamp(Math.floor(Number.isFinite(n) ? n : 0), 0, pack.capacity.maxStaff);
    }
    let total = staffCount(staff);
    for (let i = pack.staff.length - 1; i >= 0 && total > pack.capacity.maxStaff; i--) {
      const id = pack.staff[i].id;
      const cut = Math.min(staff[id], total - pack.capacity.maxStaff);
      staff[id] -= cut; total -= cut;
    }
    if (total < pack.capacity.minStaff && pack.staff[0]) staff[pack.staff[0].id] += pack.capacity.minStaff - total;
    o.staff = staff;
  }
  if (patch.levers !== undefined) {
    const levers = { ...b.orders.levers };
    for (const [id, opt] of Object.entries(patch.levers)) {
      const lever = pack.levers.find((l) => l.id === id);
      if (!lever) return fail(w, `Unknown setting: ${id}`);
      if (!lever.options.some((x) => x.id === opt)) return fail(w, `Unknown option for ${lever.name}: ${opt}`);
      levers[id] = opt;
    }
    o.levers = levers;
  }
  if (patch.shortcuts !== undefined) {
    const known = new Set([...pack.shortcuts, ...ctx.packs.common.shortcuts].map((s) => s.id));
    const bad = patch.shortcuts.find((s) => !known.has(s));
    if (bad) return fail(w, `Unknown shortcut: ${bad}`);
    o.shortcuts = [...new Set(patch.shortcuts)];
  }
  if (patch.blockFund !== undefined) o.blockFund = !!patch.blockFund;
  if (patch.autopilot !== undefined) {
    if (patch.autopilot !== 'hold' && patch.autopilot !== 'manager') return fail(w, 'Unknown autopilot mode');
    o.autopilot = patch.autopilot;
  }
  return { world: replaceBusiness(w, { ...b, orders: o }) };
}

function buyItem(w: WorldState, b: BusinessState, pack: Pack, itemId: string, qty: number): ActionResult {
  const def = itemDef(pack, itemId);
  if (!def) return fail(w, 'Unknown item');
  if (def.scalesWithSize) return fail(w, `Change the number of ${pack.sizing.unitName}s instead`);
  const n = Math.floor(qty);
  if (!(n > 0)) return fail(w, 'Quantity must be positive');
  const cost = round2(def.cost * n);
  if (cost > b.cash) return fail(w, `Not enough cash: ${def.name} costs $${Math.round(cost).toLocaleString('en-US')}`);
  const has = b.items.find((i) => i.id === itemId);
  const items = has ? b.items.map((i) => (i.id === itemId ? { ...i, qty: i.qty + n } : i)) : [...b.items, { id: itemId, qty: n }];
  let permits = b.permits;
  if ((def.kind === 'permit' || def.kind === 'license') && def.waitDays && !b.permits.some((p) => p.itemId === itemId)) {
    permits = [...b.permits, { itemId, appliedDay: w.day, readyDay: w.day + def.waitDays }];
  }
  return { world: replaceBusiness(w, {
    ...b, cash: round2(b.cash - cost), items, permits, setupSpent: round2(b.setupSpent + cost),
    mtd: { ...b.mtd, lines: addLine(b.mtd.lines, { id: `buy_${itemId}`, label: `Bought: ${def.name}`, kind: 'setup', amount: -cost }) },
  }) };
}

function sellItem(w: WorldState, b: BusinessState, pack: Pack, itemId: string, qty: number): ActionResult {
  const def = itemDef(pack, itemId);
  if (!def) return fail(w, 'Unknown item');
  if (def.scalesWithSize) return fail(w, `Change the number of ${pack.sizing.unitName}s instead`);
  const has = b.items.find((i) => i.id === itemId);
  const n = Math.floor(qty);
  if (!has || !(n > 0) || n > has.qty) return fail(w, `You do not have ${n} × ${def.name}`);
  if (def.required && has.qty - n < 1) return fail(w, `${def.name} is required to operate`);
  if (def.kind === 'permit' || def.kind === 'license' || def.kind === 'deposit' || def.kind === 'buildout') return fail(w, `${def.name} cannot be sold`);
  const refund = round2(def.cost * n * RULES.RESALE_SHARE);
  const items = b.items.map((i) => (i.id === itemId ? { ...i, qty: i.qty - n } : i)).filter((i) => i.qty > 0);
  return { world: replaceBusiness(w, {
    ...b, cash: round2(b.cash + refund), items,
    mtd: { ...b.mtd, lines: addLine(b.mtd.lines, { id: `sell_${itemId}`, label: `Sold: ${def.name}`, kind: 'setup', amount: refund }) },
  }) };
}

function resize(w: WorldState, ctx: EngineCtx, b: BusinessState, pack: Pack, sizeIn: number): ActionResult {
  const place = placeOf(ctx, b.placeId);
  if (!place) return fail(w, 'Unknown place');
  const size = Math.floor(sizeIn);
  const max = maxSizeFor(pack, place, RULES.USABLE_FLOOR_SHARE);
  if (!(size >= pack.sizing.min)) return fail(w, `At least ${pack.sizing.min} ${pack.sizing.unitName}s`);
  if (size > max) return fail(w, `Only ${max} ${pack.sizing.unitName}s fit in ${place.sqft} sq ft`);
  if (size === b.size) return { world: w };
  const scaled = pack.setup.filter((s) => s.scalesWithSize);
  const perUnit = scaled.reduce((a, s) => a + s.cost, 0);
  const delta = size - b.size;
  const amount = delta > 0 ? -round2(perUnit * delta) : round2(perUnit * -delta * RULES.RESALE_SHARE);
  if (-amount > b.cash) return fail(w, `Not enough cash: ${delta} more ${pack.sizing.unitName}s cost $${Math.round(-amount).toLocaleString('en-US')}`);
  const ids = new Set(scaled.map((s) => s.id));
  const items = b.items.map((i) => (ids.has(i.id) ? { ...i, qty: size } : i));
  for (const s of scaled) if (!items.some((i) => i.id === s.id) && s.required) items.push({ id: s.id, qty: size });
  const label = delta > 0 ? `Bought ${delta} ${pack.sizing.unitName}s` : `Sold ${-delta} ${pack.sizing.unitName}s`;
  return { world: replaceBusiness(w, {
    ...b, size, items, cash: round2(b.cash + amount), setupSpent: delta > 0 ? round2(b.setupSpent - amount) : b.setupSpent,
    mtd: { ...b.mtd, lines: addLine(b.mtd.lines, { id: `resize_${delta > 0 ? 'buy' : 'sell'}`, label, kind: 'setup', amount }) },
  }) };
}

function spend(w: WorldState, b: BusinessState, kind: 'marketing' | 'training', amountIn: number | undefined): ActionResult {
  const amount = round2(amountIn ?? 0);
  if (!(amount > 0)) return fail(w, 'Amount must be positive');
  if (amount > b.cash) return fail(w, 'Not enough cash');
  const econ = econOf(b);
  const next: EconExtra = kind === 'marketing' ? { ...econ, marketing: econ.marketing + amount } : { ...econ, training: econ.training + amount };
  const label = kind === 'marketing' ? 'Advertising' : 'Staff training';
  return { world: replaceBusiness(w, withEcon({
    ...b, cash: round2(b.cash - amount),
    mtd: { ...b.mtd, lines: addLine(b.mtd.lines, { id: `spend_${kind}`, label, kind: 'opex', amount: -amount }) },
  }, next)) };
}

function readInbox(w: WorldState, player: Player, ids: string[]): ActionResult {
  const set = new Set(ids);
  return { world: { ...w, players: w.players.map((p) => (p.id !== player.id ? p : { ...p, inbox: p.inbox.map((i) => (set.has(i.id) ? { ...i, read: true } : i)) })) } };
}
