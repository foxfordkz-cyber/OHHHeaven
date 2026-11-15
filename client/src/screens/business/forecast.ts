// What a change does, in words the owner reads before pressing Apply. Pure: numbers come from what_if.
// The screen does no game math: it divides the engine's projected month by its days and names the biggest loss.
import { RULES } from '@ohh/shared/rules';
import type { CommonPack, MonthReport, Pack, StandingOrders } from '@ohh/shared/types';
import { usd2 } from './format';
import { pick } from '../../ui/i18n';

const DAYS = RULES.DAYS_PER_MONTH;

/** What stops the shop from selling more next month. */
export type BottleneckId = 'staff' | 'seats' | 'closure' | 'demand';

export interface Bottleneck { id: BottleneckId; perDay: number; text: string }

export interface Outlook {
  ordersPerDay: number;
  demandPerDay: number;
  capacityPerDay: number;
  profit: number;
  cashEnd: number;
  bottleneck: Bottleneck;
}

/** Below this share of demand a loss is noise, not a limit. */
export const LOSS_MATTERS = 0.02;

const perDay = (n: number) => Math.round(n / DAYS);

/** The biggest reason customers walk away in a projected month; demand itself when nobody walks away. */
export function bottleneckOf(m: MonthReport, unitName = 'seat'): Bottleneck {
  const demand = Math.max(1, m.demandUnits);
  const losses: { id: BottleneckId; units: number }[] = [
    { id: 'staff', units: m.lost.staff },
    { id: 'seats', units: m.lost.size },
    { id: 'closure', units: m.lost.closure },
  ];
  const top = losses.sort((a, b) => b.units - a.units)[0];
  if (top.units / demand >= LOSS_MATTERS) {
    const n = Math.max(1, perDay(top.units));
    const text = top.id === 'staff'
      ? pick(`About ${n} a day leave the line: nobody free to serve them.`, `Около ${n} в день уходят из очереди: некому обслужить.`)
      : top.id === 'seats'
        ? pick(`About ${n} a day leave: no free ${unitName}.`, `Около ${n} в день уходят: нет свободного места.`)
        : pick(`Closed by the city: about ${n} a day turned away.`, `Закрыто городом: около ${n} в день не обслужены.`);
    return { id: top.id, perDay: n, text };
  }
  const room = Math.max(0, perDay(m.capacityUnits) - perDay(m.servedUnits));
  return {
    id: 'demand', perDay: room,
    text: room > 0
      ? pick(`Your team could serve about ${room} more a day. Price, marketing and reviews bring them.`, `Команда могла бы обслужить ещё около ${room} в день. Их приводят цена, реклама и отзывы.`)
      : pick('Everyone who comes is served.', 'Обслуживаешь всех, кто пришёл.'),
  };
}

export function outlookOf(m: MonthReport, unitName?: string): Outlook {
  return {
    ordersPerDay: perDay(m.servedUnits),
    demandPerDay: perDay(m.demandUnits),
    capacityPerDay: perDay(m.capacityUnits),
    profit: Math.round(m.profit),
    cashEnd: Math.round(m.cashEnd),
    bottleneck: bottleneckOf(m, unitName),
  };
}

export interface OutlookDelta { ordersPerDay: number; profit: number; cashEnd: number; bottleneckChanged: boolean }

export function deltaOf(base: Outlook, next: Outlook): OutlookDelta {
  return {
    ordersPerDay: next.ordersPerDay - base.ordersPerDay,
    profit: next.profit - base.profit,
    cashEnd: next.cashEnd - base.cashEnd,
    bottleneckChanged: base.bottleneck.id !== next.bottleneck.id,
  };
}

/** "+12" / "−4" / "±0" for orders a day. */
export function signedCount(n: number): string {
  if (n === 0) return '±0';
  return n > 0 ? `+${n}` : `−${Math.abs(n)}`;
}


/** Which control the player touched; per-control forecasts ask what_if about that one change only. */
export type FieldKey = 'price' | `staff:${string}` | `lever:${string}`;

/** Orders for a what_if that changes only one control on top of the current orders. */
export function isolate(base: StandingOrders, draft: StandingOrders, field: FieldKey): Partial<StandingOrders> {
  if (field === 'price') return { price: draft.price };
  const [kind, id] = field.split(':') as ['staff' | 'lever', string];
  if (kind === 'staff') return { staff: { ...base.staff, [id]: draft.staff[id] ?? 0 } };
  return { levers: { ...base.levers, [id]: draft.levers[id] } };
}

/** Is this one control different from the orders the shop runs on? */
export function fieldChanged(base: StandingOrders, draft: StandingOrders, field: FieldKey): boolean {
  if (field === 'price') return Math.round(base.price * 100) !== Math.round(draft.price * 100);
  const [kind, id] = field.split(':') as ['staff' | 'lever', string];
  if (kind === 'staff') return (base.staff[id] ?? 0) !== (draft.staff[id] ?? 0);
  return (base.levers[id] ?? '') !== (draft.levers[id] ?? '');
}

/** Each change in plain words: "Price $8.50 → $9.00", "Barista 3 → 4", "Opening hours: 7am - 7pm → 6am - 9pm". */
export function changeList(base: StandingOrders, draft: StandingOrders, pack: Pack | null, common: CommonPack | null = null): string[] {
  const out: string[] = [];
  if (Math.round(base.price * 100) !== Math.round(draft.price * 100)) out.push(`${pick('Price', 'Цена')} ${usd2(base.price)} → ${usd2(draft.price)}`);
  const roles = new Set([...Object.keys(base.staff), ...Object.keys(draft.staff)]);
  for (const r of roles) {
    const a = base.staff[r] ?? 0, z = draft.staff[r] ?? 0;
    if (a !== z) out.push(`${pack?.staff.find((s) => s.id === r)?.name ?? r} ${a} → ${z}`);
  }
  const levers = new Set([...Object.keys(base.levers), ...Object.keys(draft.levers)]);
  for (const id of levers) {
    if (base.levers[id] === draft.levers[id]) continue;
    const l = pack?.levers.find((x) => x.id === id);
    const label = (o: string | undefined) => l?.options.find((x) => x.id === o)?.label ?? o ?? '—';
    out.push(`${l?.name ?? id}: ${label(base.levers[id])} → ${label(draft.levers[id])}`);
  }
  const offOn = (a: string[], z: string[]) => z.filter((x) => !a.includes(x));
  const all = (id: string) => [...(pack?.shortcuts ?? []), ...(common?.shortcuts ?? [])].find((s) => s.id === id)?.name ?? id;
  for (const id of offOn(base.shortcuts, draft.shortcuts)) out.push(`${pick('Cut corner on', 'Срезан угол')}: ${all(id)}`);
  for (const id of offOn(draft.shortcuts, base.shortcuts)) out.push(`${pick('Back to the rules', 'Снова по правилам')}: ${all(id)}`);
  if (base.blockFund !== draft.blockFund) out.push(draft.blockFund ? pick('Block fund: join', 'Фонд квартала: вступить') : pick('Block fund: leave', 'Фонд квартала: выйти'));
  if (base.autopilot !== draft.autopilot) out.push(draft.autopilot === 'manager' ? pick('Hire a manager', 'Нанять управляющего') : pick('Hold my settings while away', 'Держать мои настройки'));
  return out;
}

/** A paid lever option is charged by the day it is on (engine/src/economy/day.ts). */
export function perDayCost(monthlyCost: number): number {
  return Math.round((monthlyCost / DAYS) * 100) / 100;
}
