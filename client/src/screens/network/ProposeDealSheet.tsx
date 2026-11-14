import { useMemo, useState } from 'react';
import type { Action, DealTerms, OwnerView, PublicBusiness } from '../../../../shared/src/types';
import { RULES } from '../../../../shared/src/rules';
import { Badge, Button, Sheet, Stepper } from './ui';
import { Lines, MoneyField, NumberField, StepRow } from './fields';
import {
  act, DEAL_COPY, DEAL_KINDS, dealAvailability, dealEffect, defaultTerms, LOAN_MAX_MONTHS, loanSchedule, money,
  monthBase, monthsLeftInSeason, PARTNER_SHARE_MAX_PCT, PARTNER_SHARE_MIN_PCT, TIMED_DEAL_MAX_MONTHS, validateTerms,
  type DealKind,
} from './logic';

/** «Propose a deal»: four kinds, each with a real-life line and what it is worth. Unavailable kinds stay visible, greyed, with the reason. */
export function ProposeDealSheet(props: {
  onClose: () => void; view: OwnerView; target: PublicBusiness; distanceM: number | null;
  onAct: (a: Action) => unknown;
}) {
  const { view, target } = props;
  const me = view.business;
  const availability = useMemo(() => dealAvailability({ me, target, deals: view.deals, distanceM: props.distanceM }), [me, target, view.deals, props.distanceM]);
  const [kind, setKind] = useState<DealKind | null>(() => DEAL_KINDS.find((k) => availability[k].allowed) ?? null);
  const [terms, setTerms] = useState<Record<DealKind, DealTerms>>(() => ({
    joint_purchase: defaultTerms('joint_purchase', me), cross_promo: defaultTerms('cross_promo', me),
    loan: defaultTerms('loan', me), partnership: defaultTerms('partnership', me),
  }));
  const [sent, setSent] = useState(false);
  const base = monthBase(me, view.analytics);
  const maxTimed = Math.max(1, Math.min(TIMED_DEAL_MAX_MONTHS, monthsLeftInSeason(view)));
  const current = kind ? terms[kind] : null;
  const error = current ? validateTerms(current, me) : null;
  const update = (t: DealTerms) => setTerms((prev) => ({ ...prev, [t.type]: t }));
  const canSend = Boolean(kind && current && !error && availability[kind].allowed);

  const send = () => {
    if (!canSend || !current) return;
    props.onAct(act.proposeDeal(target.id, current));
    setSent(true);
  };

  if (sent) {
    return (
      <Sheet open onClose={props.onClose} title={`Deal with ${target.name}`} footer={<Button block onClick={props.onClose}>Done</Button>}>
        <div className="nw-done" role="status">
          <p><strong>Offer sent.</strong> {target.name} has {RULES.DEAL_OFFER_DAYS} game days to answer. You will see it under My deals.</p>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      open onClose={props.onClose} title={`Deal with ${target.name}`}
      footer={kind && <Button block onClick={send} disabled={!canSend}>Send offer</Button>}
    >
      <div className="stack">
        <div className="nw-kinds" role="radiogroup" aria-label="Kind of deal">
          {DEAL_KINDS.map((k) => {
            const a = availability[k];
            const on = k === kind;
            return (
              <button
                key={k} type="button" role="radio" aria-checked={on} aria-disabled={!a.allowed}
                className={`nw-kind${on ? ' is-on' : ''}${a.allowed ? '' : ' is-off'}`}
                onClick={() => a.allowed && setKind(k)} data-kind={k}
              >
                <span className="nw-kind__title">{DEAL_COPY[k].title}</span>
                <span className="nw-kind__promise">{DEAL_COPY[k].promise}</span>
                {!a.allowed && <span className="nw-kind__reason">{a.reason}</span>}
              </button>
            );
          })}
        </div>

        {kind && current ? (
          <div className="stack" data-form={kind}>
            <p className="nw-life"><span>How it works in real life:</span> {DEAL_COPY[kind].life}</p>
            {(current.type === 'joint_purchase' || current.type === 'cross_promo') && (
              <StepRow label="Months">
                <Stepper label="Months" value={Math.min(current.months, maxTimed)} min={1} max={maxTimed} onChange={(m) => update({ ...current, months: m })} />
              </StepRow>
            )}
            {current.type === 'loan' && <LoanForm terms={current} cash={me?.cash ?? 0} onChange={update} />}
            {current.type === 'partnership' && (
              <>
                <MoneyField label="Amount to invest" value={current.amount} step={500} min={0} max={Math.floor(me?.cash ?? 0)} onChange={(v) => update({ ...current, amount: v })} hint={`You have ${money(me?.cash ?? 0)} in cash`} />
                <StepRow label="Your share of their business">
                  <Stepper label="Your share" value={current.sharePct} min={PARTNER_SHARE_MIN_PCT} max={PARTNER_SHARE_MAX_PCT} format={(v) => `${v}%`} onChange={(v) => update({ ...current, sharePct: v })} />
                </StepRow>
              </>
            )}
            <div className="nw-effect">
              <div className="eyebrow">What you get</div>
              <Lines lines={dealEffect(current, 'from', base).lines} />
              {base.source === 'forecast' && <p className="xsmall muted">Based on this month's forecast: your first month has not closed yet.</p>}
            </div>
            {(current.type === 'loan' || current.type === 'partnership') && (
              <Badge tone="warn" icon="alert">If they go bankrupt, the money left in the deal is lost</Badge>
            )}
            {error && <p className="nw-error" role="alert">{error}</p>}
            <p className="xsmall muted">They have {RULES.DEAL_OFFER_DAYS} game days to answer. Ending a deal early counts against your record.</p>
          </div>
        ) : (
          <p className="muted">No deal is possible with {target.name} right now.</p>
        )}
      </div>
    </Sheet>
  );
}

function LoanForm(props: { terms: Extract<DealTerms, { type: 'loan' }>; cash: number; onChange: (t: DealTerms) => void }) {
  const t = props.terms;
  const s = loanSchedule(t.amount, t.monthlyRatePct, t.months);
  return (
    <>
      <MoneyField label="Amount to lend" value={t.amount} step={500} min={0} max={Math.floor(props.cash)} onChange={(v) => props.onChange({ ...t, amount: v })} hint={`You have ${money(props.cash)} in cash`} />
      <NumberField label="Interest per month" value={t.monthlyRatePct} min={0} max={RULES.LOAN_MAX_RATE_PCT} step={0.5} suffix={`% · max ${RULES.LOAN_MAX_RATE_PCT}%`} onChange={(v) => props.onChange({ ...t, monthlyRatePct: v })} />
      <StepRow label="Months to repay">
        <Stepper label="Months" value={t.months} min={1} max={LOAN_MAX_MONTHS} onChange={(m) => props.onChange({ ...t, months: m })} />
      </StepRow>
      {t.amount > 0 && s.rows.length > 0 && (
        <table className="nw-table" aria-label="Payment schedule">
          <thead><tr><th>Month</th><th>They pay you</th><th>Still owed</th></tr></thead>
          <tbody>
            {s.rows.map((r) => (
              <tr key={r.month}><td>{r.month}</td><td>{money(r.payment, { cents: true })}</td><td>{money(r.balance, { cents: true })}</td></tr>
            ))}
          </tbody>
          <tfoot><tr><td>Total</td><td>{money(s.total, { cents: true })}</td><td>interest {money(s.interest, { cents: true })}</td></tr></tfoot>
        </table>
      )}
    </>
  );
}
