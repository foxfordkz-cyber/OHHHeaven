// Stand-in for the server so /dev/biz works offline. It does rough, made-up math on purpose:
// the real numbers come from the engine (agents 02–04) through what_if and the view.
import type { Ack, Action, CommonPack, MonthReport, OwnerView, Pack, PnlLine, Query, StandingOrders } from '../../../../../shared/src/types';
import type { BizDeps } from '../deps';
import type { WhatIf } from '../useWhatIf';

const round = (n: number) => Math.round(n);

function savingLines(view: OwnerView, pack: Pack | null, common: CommonPack | null, orders: StandingOrders, revenue: number, payroll: number): PnlLine[] {
  const all = [...(pack?.shortcuts ?? []), ...(common?.shortcuts ?? [])];
  const rent = pack?.monthlyCosts.find((c) => c.kind === 'rent')?.amount ?? 0;
  const staff = Object.values(orders.staff).reduce((a, b) => a + b, 0);
  return orders.shortcuts.flatMap((id) => {
    const s = all.find((x) => x.id === id);
    if (!s) return [];
    const amt = { fixed: s.saves.amount, pct_payroll: s.saves.amount * payroll, pct_revenue: s.saves.amount * revenue, pct_rent: s.saves.amount * rent, per_staff: s.saves.amount * staff }[s.saves.basis];
    return [{ id: `shortcut_${s.id}`, label: `Not paid: ${s.name.toLowerCase()}`, kind: 'saving' as const, amount: round(amt) }];
  }).filter(() => view.business !== null);
}

export function fakeWhatIf(view: OwnerView, pack: Pack | null, common: CommonPack | null, patch: Partial<StandingOrders>): WhatIf | null {
  const b = view.business;
  if (!b) return null;
  const a = view.analytics;
  const orders: StandingOrders = { ...b.orders, ...patch, staff: patch.staff ?? b.orders.staff, levers: { ...b.orders.levers, ...(patch.levers ?? {}) } };
  const baseServed = a ? a.revenue / b.orders.price : 0;
  const elasticity = pack?.market.priceElasticity ?? -1.4;
  const staffCount = Object.values(orders.staff).reduce((x, y) => x + y, 0);
  const staffCap = (pack?.capacity.unitsPerStaffMonth ?? 1800) * staffCount;
  const seatCap = b.size * (pack?.sizing.unitsServedPerSizeMonth ?? 150) / (1 - (pack?.sizing.takeawayShare ?? 0));
  const want = baseServed * (orders.price / b.orders.price) ** elasticity * 1.22;
  const served = Math.min(want, staffCap, seatCap);
  const revenue = served * orders.price;
  const cogs = served * (pack?.unit.cogsPerUnit ?? 0);
  const payroll = (pack?.staff ?? []).reduce((sum, r) => sum + (orders.staff[r.id] ?? 0) * r.hourlyWage * r.hoursPerMonth, 0);
  const levers = (pack?.levers ?? []).reduce((sum, l) => sum + (l.options.find((o) => o.id === orders.levers[l.id])?.monthlyCost ?? 0), 0);
  const fixed = (pack?.monthlyCosts ?? []).reduce((sum, c) => sum + (c.basis === 'fixed' ? c.amount : 0), 0);
  const manager = orders.autopilot === 'manager' ? pack?.manager.monthlySalary ?? 0 : 0;
  const saves = savingLines(view, pack, common, orders, revenue, payroll);
  const lines: PnlLine[] = [
    { id: 'revenue', label: 'Sales', kind: 'revenue', amount: round(revenue) },
    { id: 'cogs', label: 'Cost of goods', kind: 'cogs', amount: -round(cogs) },
    { id: 'payroll', label: 'Wages', kind: 'payroll', amount: -round(payroll) },
    { id: 'payroll_tax', label: 'Payroll taxes', kind: 'payroll_tax', amount: -round(payroll * 0.11) },
    { id: 'fixed', label: 'Rent and bills', kind: 'rent', amount: -round(fixed) },
    { id: 'levers', label: 'Cleaning, beans, hours', kind: 'opex', amount: -round(levers + manager) },
    ...saves,
  ];
  const profit = lines.reduce((x, l) => x + l.amount, 0);
  const left = a ? 1 - a.daysIntoMonth / 30 : 1;
  const projected: MonthReport = {
    month: view.world.date.month, avgPrice: orders.price, demandUnits: round(want), servedUnits: round(served),
    lost: { size: round(Math.max(0, Math.min(want, staffCap) - served)), staff: round(Math.max(0, want - staffCap)), closure: 0 },
    capacityUnits: round(Math.min(staffCap, seatCap)), sizeUtilization: Math.min(1, served / seatCap), lines,
    revenue: round(revenue), profit: round(profit), cashStart: b.cash, cashEnd: round(b.cash + profit * left),
    taxesAccrued: 0, taxesPaid: 0, fines: 0, quality: b.quality, reputation: b.reputation, netWorth: round(b.cash + profit), rankInNiche: 4,
  };
  const analytics = a ?? null;
  if (!analytics) return null;
  return { projected, analytics: { ...analytics, profit: round(profit), breakEvenPrice: analytics.breakEvenPrice } };
}

/** Applies the few actions /dev/biz needs to see a change on screen. Everything else is acknowledged and logged. */
export function fakeReduce(view: OwnerView, a: Action): OwnerView {
  const b = view.business;
  switch (a.type) {
    case 'read_inbox':
      return { ...view, away: null, me: { ...view.me, inbox: view.me.inbox.map((i) => (a.ids.includes(i.id) ? { ...i, read: true } : i)) } };
    case 'set_orders':
      return b ? { ...view, business: { ...b, orders: { ...b.orders, ...a.orders } }, recommendations: view.recommendations.filter((r) => JSON.stringify(r.suggested) !== JSON.stringify(a)) } : view;
    case 'resize':
      return b ? { ...view, business: { ...b, size: a.size }, recommendations: view.recommendations.filter((r) => r.suggested?.type !== 'resize') } : view;
    case 'launch':
      return b ? { ...view, business: { ...b, status: 'open', openedDay: view.world.day } } : view;
    case 'answer_notice':
      return {
        ...view,
        notices: view.notices.map((n) => {
          if (n.caseId !== a.caseId) return n;
          if (a.response === 'bribe') return { ...n, status: 'bribe_offered' };
          return { ...n, status: 'closed', outcome: 'fined', fine: a.response === 'contest' ? Math.round(n.fine * 0.7) : n.fine };
        }),
      };
    default:
      return view;
  }
}

export function fakeDeps(p: {
  view: OwnerView; pack: Pack | null; common: CommonPack | null; online: boolean;
  onView(v: OwnerView): void; log(line: string): void; delayMs?: number;
}): BizDeps {
  const wait = () => new Promise((r) => setTimeout(r, p.delayMs ?? 150));
  return {
    view: p.view, pack: p.pack, common: p.common, online: p.online,
    navigate: (to) => p.log(`navigate → ${to}`),
    async act(a: Action): Promise<Ack> {
      await wait();
      if (!p.online) throw new Error('offline');
      p.log(`act ${JSON.stringify(a)}`);
      p.onView(fakeReduce(p.view, a));
      return { ok: true };
    },
    async query<T>(q: Query): Promise<Ack<T>> {
      await wait();
      if (!p.online) throw new Error('offline');
      if (q.type !== 'what_if') return { ok: false, error: `${q.type} is not in the /dev/biz stub` };
      const data = fakeWhatIf(p.view, p.pack, p.common, q.orders);
      return data ? { ok: true, data: data as T } : { ok: false, error: 'No forecast before opening' };
    },
  };
}
