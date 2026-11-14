// Заём: равные платежи (аннуитет), всё в центах, последний платёж закрывает остаток до цента.
import type { Deal, Money } from '../../../shared/src/types';
import { RULES } from '../../../shared/src/rules';
import { fromCents, toCents } from './util';

export interface Installment { k: number; dueDay: number; payment: Money; interest: Money; principal: Money; balanceAfter: Money }

const DPM = RULES.DAYS_PER_MONTH;

/** Первый платёж — в закрытии месяца, до которого прошло не меньше половины месяца с начала займа. */
export function firstDueDay(startDay: number): number {
  return Math.ceil((startDay + Math.floor(DPM / 2) - 1) / DPM) * DPM;
}

export function schedule(amount: Money, monthlyRatePct: number, months: number, startDay: number): Installment[] {
  const n = Math.max(1, Math.floor(months));
  const r = monthlyRatePct / 100;
  let balance = toCents(amount);
  const raw = r === 0 ? balance / n : (balance * r) / (1 - (1 + r) ** -n);
  const level = Math.round(raw);
  const first = firstDueDay(startDay);
  const out: Installment[] = [];
  for (let k = 1; k <= n; k++) {
    const interest = Math.round(balance * r);
    const principal = k === n ? balance : Math.min(balance, level - interest);
    balance -= principal;
    out.push({
      k, dueDay: first + (k - 1) * DPM,
      payment: fromCents(principal + interest), interest: fromCents(interest), principal: fromCents(principal),
      balanceAfter: fromCents(balance),
    });
  }
  return out;
}

export function loanSchedule(d: Deal): Installment[] {
  if (d.terms.type !== 'loan') return [];
  return schedule(d.terms.amount, d.terms.monthlyRatePct, d.terms.months, d.startDay ?? 0);
}

/** Сколько платежей уже внесено: по сумме `paidBack` (досрочное погашение закрывает всё). */
export function paymentsMade(d: Deal): number {
  const sched = loanSchedule(d);
  const paid = toCents(d.paidBack ?? 0);
  let sum = 0;
  let k = 0;
  for (const s of sched) {
    sum += toCents(s.payment);
    if (sum <= paid) k += 1;
    else break;
  }
  return k;
}

/** Остаток основного долга. Погашенный заём — 0. */
export function outstanding(d: Deal): Money {
  if (d.terms.type !== 'loan' || d.status === 'completed') return 0;
  if (d.status !== 'active' && d.status !== 'broken') return 0;
  const sched = loanSchedule(d);
  const k = paymentsMade(d);
  return k === 0 ? d.terms.amount : sched[k - 1].balanceAfter;
}

export function installmentDueOn(d: Deal, day: number): Installment | undefined {
  return loanSchedule(d).find((s) => s.dueDay === day);
}
