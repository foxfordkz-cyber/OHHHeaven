// День: просроченные предложения, сделки, дошедшие до конца, и сделки с обанкротившимися.
import type { WorldState } from '../../../shared/src/types';
import type { EngineCtx } from './ctx';
import { outstanding } from './loans';
import { addFeed, bizById, clone, dealTypeLabel, fmtMoney, notifyBusiness, postLine } from './util';

export function dealsDay(w: WorldState, _ctx: EngineCtx): WorldState {
  const touched = w.deals.some((d) => {
    if (d.status === 'proposed') return true;
    if (d.status !== 'active') return false;
    const t = d.terms.type;
    if ((t === 'joint_purchase' || t === 'cross_promo') && d.endDay !== undefined && w.day >= d.endDay) return true;
    const from = bizById(w, d.fromBusinessId);
    const to = bizById(w, d.toBusinessId);
    return from?.status === 'bankrupt' || to?.status === 'bankrupt';
  });
  if (!touched) return w;

  const next = clone(w);
  let changed = false;
  for (const d of next.deals) {
    const from = bizById(next, d.fromBusinessId);
    const to = bizById(next, d.toBusinessId);
    if (!from || !to) continue;

    if (d.status === 'proposed') {
      if (from.status === 'bankrupt' || to.status === 'bankrupt') {
        d.status = 'cancelled';
        changed = true;
      } else if (next.day > d.expiresDay) {
        d.status = 'expired';
        changed = true;
        notifyBusiness(next, from, { id: `in-${d.id}-expired`, kind: 'deal', title: `Your ${dealTypeLabel(d)} offer expired`, text: `${to.name} did not answer in time.`, ref: { type: 'deal', id: d.id } });
      }
      continue;
    }
    if (d.status !== 'active') continue;
    const t = d.terms;

    if (to.status === 'bankrupt' || from.status === 'bankrupt') {
      if (t.type === 'loan' && to.status === 'bankrupt') {
        const lost = outstanding(d);
        d.status = 'broken';
        d.endDay = next.day;
        to.trust.broken += 1;
        postLine(next, from, { id: `deal:${d.id}:writeoff`, label: `Loan to ${to.name} written off: ${fmtMoney(lost)} lost (borrower bankrupt)`, kind: 'deal', amount: 0 }, false);
        notifyBusiness(next, from, { id: `in-${d.id}-writeoff`, kind: 'deal', title: `${to.name} went bankrupt`, text: `Your loan is lost: ${fmtMoney(lost)} will not come back.`, ref: { type: 'deal', id: d.id } });
        addFeed(next, `feed-${d.id}-writeoff`, `${to.name} went bankrupt owing ${from.name} money.`, to.id);
        changed = true;
      } else if (t.type === 'partnership' && to.status === 'bankrupt') {
        d.status = 'broken';
        d.endDay = next.day;
        notifyBusiness(next, from, { id: `in-${d.id}-lost`, kind: 'deal', title: `${to.name} went bankrupt`, text: `Your ${t.sharePct}% stake is worth nothing now.`, ref: { type: 'deal', id: d.id } });
        changed = true;
      } else if (t.type === 'joint_purchase' || t.type === 'cross_promo') {
        d.status = 'cancelled';
        d.endDay = next.day;
        const alive = from.status === 'bankrupt' ? to : from;
        const dead = alive === from ? to : from;
        notifyBusiness(next, alive, { id: `in-${d.id}-ended`, kind: 'deal', title: `Your ${dealTypeLabel(d)} ended`, text: `${dead.name} went bankrupt.`, ref: { type: 'deal', id: d.id } });
        changed = true;
      }
      // Заём у обанкротившегося кредитора и доля обанкротившегося вкладчика продолжают жить.
      continue;
    }

    if ((t.type === 'joint_purchase' || t.type === 'cross_promo') && d.endDay !== undefined && next.day >= d.endDay) {
      d.status = 'completed';
      from.trust.kept += 1;
      to.trust.kept += 1;
      for (const [me, other] of [[from, to], [to, from]] as const) {
        notifyBusiness(next, me, { id: `in-${d.id}-done-${me.id}`, kind: 'deal', title: `Your ${dealTypeLabel(d)} with ${other.name} is complete`, text: 'Both trust scores show one more kept deal.', ref: { type: 'deal', id: d.id } });
      }
      changed = true;
    }
  }
  if (!changed) return w;
  next.version += 1;
  return next;
}
