// Закрытие месяца: платежи по займам, доля прибыли партнёрам, фонд квартала на следующий месяц.
import type { BlockFundStatus, BusinessState, WorldState } from '../../../shared/src/types';
import { RULES, dateOf } from '../../../shared/src/rules';
import type { EngineCtx } from './ctx';
import { installmentDueOn, outstanding, loanSchedule } from './loans';
import { addFeed, bizById, clone, fmtMoney, isLaunched, notifyBusiness, placeOf, postLine, round2 } from './util';

/** Прибыль бизнеса за закрываемый месяц: из отчёта экономики, иначе по строкам месяца без сделок. */
export function monthProfit(b: BusinessState, month: number): number {
  const report = b.history[b.history.length - 1];
  if (report && report.month === month) return report.profit;
  return round2(b.mtd.lines.filter((l) => l.kind !== 'deal').reduce((s, l) => s + l.amount, 0));
}

const BLOCK_FUND_LINE = /block.?fund/i;

/** Экономика по контракту тоже может списать взнос; не берём его дважды. */
function alreadyCharged(b: BusinessState, month: number): boolean {
  const report = b.history[b.history.length - 1];
  const lines = report && report.month === month ? report.lines : b.mtd.lines;
  return lines.some((l) => BLOCK_FUND_LINE.test(l.id) || BLOCK_FUND_LINE.test(l.label));
}

function closeLoans(next: WorldState): void {
  for (const d of next.deals) {
    if (d.status !== 'active' || d.terms.type !== 'loan') continue;
    const lender = bizById(next, d.fromBusinessId);
    const borrower = bizById(next, d.toBusinessId);
    if (!lender || !borrower || borrower.status === 'bankrupt') continue;
    const due = installmentDueOn(d, next.day);
    if (!due) continue;
    const n = loanSchedule(d).length;
    if (borrower.cash >= due.payment) {
      postLine(next, borrower, { id: `deal:${d.id}:p${due.k}:principal`, label: `Loan payment ${due.k}/${n} to ${lender.name}`, kind: 'deal', amount: -due.principal }, true);
      postLine(next, borrower, { id: `deal:${d.id}:p${due.k}:interest`, label: `Loan interest to ${lender.name}`, kind: 'deal', amount: -due.interest }, true);
      postLine(next, lender, { id: `deal:${d.id}:p${due.k}:principal`, label: `Loan payment ${due.k}/${n} from ${borrower.name}`, kind: 'deal', amount: due.principal }, true);
      postLine(next, lender, { id: `deal:${d.id}:p${due.k}:interest`, label: `Loan interest from ${borrower.name}`, kind: 'deal', amount: due.interest }, true);
      d.paidBack = round2((d.paidBack ?? 0) + due.payment);
      if (due.k === n) {
        d.status = 'completed';
        d.endDay = next.day;
        lender.trust.kept += 1;
        borrower.trust.kept += 1;
        notifyBusiness(next, lender, { id: `in-${d.id}-repaid`, kind: 'deal', title: `${borrower.name} repaid your loan`, text: `All ${n} payments came in: ${fmtMoney(d.paidBack)} in total.`, ref: { type: 'deal', id: d.id } });
        notifyBusiness(next, borrower, { id: `in-${d.id}-cleared`, kind: 'deal', title: 'Loan paid off', text: `You repaid ${lender.name} in full.`, ref: { type: 'deal', id: d.id } });
      }
    } else {
      const lost = outstanding(d);
      d.status = 'broken';
      d.endDay = next.day;
      borrower.trust.broken += 1;
      postLine(next, lender, { id: `deal:${d.id}:writeoff`, label: `Loan to ${borrower.name} written off: ${fmtMoney(lost)} unpaid`, kind: 'deal', amount: 0 }, true);
      notifyBusiness(next, lender, { id: `in-${d.id}-default`, kind: 'deal', title: `${borrower.name} missed a loan payment`, text: `They could not pay ${fmtMoney(due.payment)}. The loan is broken: ${fmtMoney(lost)} is lost.`, ref: { type: 'deal', id: d.id } });
      notifyBusiness(next, borrower, { id: `in-${d.id}-missed`, kind: 'deal', title: 'You missed a loan payment', text: `You needed ${fmtMoney(due.payment)}. Your trust score shows a broken deal, and the debt still counts against your net worth.`, ref: { type: 'deal', id: d.id } });
      addFeed(next, `feed-${d.id}-default`, `${borrower.name} defaulted on a loan from ${lender.name}.`, borrower.id);
    }
  }
}

function closePartnerships(next: WorldState, month: number): void {
  for (const d of next.deals) {
    if (d.status !== 'active' || d.terms.type !== 'partnership') continue;
    const investor = bizById(next, d.fromBusinessId);
    const company = bizById(next, d.toBusinessId);
    if (!investor || !company || company.status === 'bankrupt') continue;
    const profit = monthProfit(company, month);
    if (profit <= 0) continue;
    const share = round2(profit * d.terms.sharePct / 100);
    const pay = round2(Math.min(share, Math.max(0, company.cash)));
    if (pay <= 0) continue;
    postLine(next, company, { id: `deal:${d.id}:m${month}:dividend`, label: `Profit share to ${investor.name} (${d.terms.sharePct}%)`, kind: 'deal', amount: -pay }, true);
    postLine(next, investor, { id: `deal:${d.id}:m${month}:dividend`, label: `Profit share from ${company.name} (${d.terms.sharePct}%)`, kind: 'deal', amount: pay }, true);
    notifyBusiness(next, investor, { id: `in-${d.id}-m${month}-dividend`, kind: 'money', title: `${company.name} paid your profit share`, text: `${fmtMoney(pay)}: ${d.terms.sharePct}% of ${fmtMoney(profit)} profit.`, ref: { type: 'deal', id: d.id } });
  }
}

function closeBlockFunds(next: WorldState, ctx: EngineCtx, month: number): void {
  if (month >= next.config.seasonMonths) return;      // следующего месяца нет — взнос не берём
  const blocks = new Map<string, BusinessState[]>();
  for (const b of next.businesses) {
    if (!isLaunched(b)) continue;
    const place = placeOf(ctx, b);
    if (!place) continue;
    const list = blocks.get(place.block) ?? [];
    list.push(b);
    blocks.set(place.block, list);
  }
  const fee = RULES.BLOCK_FUND_FEE_MONTH;
  for (const block of [...blocks.keys()].sort()) {
    const list = blocks.get(block)!;
    let contributors = 0;
    for (const b of list) {
      if (!b.orders.blockFund) continue;
      if (alreadyCharged(b, month)) { contributors += 1; continue; }
      if (b.cash < fee) {
        notifyBusiness(next, b, { id: `in-bf-${block}-m${month}-${b.id}-skipped`, kind: 'money', title: 'Block fund fee skipped', text: `Not enough cash for the ${fmtMoney(fee)} fee this month.` });
        continue;
      }
      postLine(next, b, { id: `deal:blockfund:${block}:m${month}`, label: 'Block fund fee (cleaning and lights)', kind: 'opex', amount: -fee }, true);
      contributors += 1;
    }
    const status: BlockFundStatus = {
      block, month: month + 1, contributors, eligible: list.length,
      active: contributors / list.length >= RULES.BLOCK_FUND_THRESHOLD - 1e-9, feeMonth: fee,
    };
    next.blockFunds = next.blockFunds.filter((f) => !(f.block === block && f.month === status.month));
    next.blockFunds.push(status);
    if (status.active) {
      const pct = Math.round((RULES.BLOCK_FUND_TRAFFIC_MULT - 1) * 100);
      addFeed(next, `feed-bf-${block}-m${status.month}`, `${block}: ${contributors} of ${list.length} businesses chipped in. Street cleaning and lights next month: +${pct}% foot traffic for the whole block.`);
      for (const b of list) {
        notifyBusiness(next, b, { id: `in-bf-${block}-m${status.month}-${b.id}`, kind: 'deal', title: `Block fund is live on ${block}`, text: `${contributors} of ${list.length} neighbors paid. Next month every business on the block gets +${pct}% foot traffic.` });
      }
    }
  }
}

export function dealsMonthClose(w: WorldState, ctx: EngineCtx): WorldState {
  const next = clone(w);
  const month = dateOf(next.day).month;
  closeLoans(next);
  closePartnerships(next, month);
  closeBlockFunds(next, ctx, month);
  if (JSON.stringify(next) === JSON.stringify(w)) return w;
  next.version += 1;
  return next;
}
