import { useState, type ReactNode } from 'react';
import type { Ack, Action, CaseNotice } from '@ohh/shared/types';
import { Icon } from '../../ui';
import { pick } from '../../ui/i18n';
import { Button, Card } from './__stubs__/ui';
import { bribeAction, CONTEST, contestAction, payAction } from './actions';
import { dayLabel, plural, relDay, usd } from './format';
import { ruleCardById, violationById, type Packs } from './lookup';

const ROLE_TITLE = { inspector: 'Health inspection', tax_auditor: 'Tax audit' } as const;

export function NoticeCard({ notice, packs, today, onAnswer, onRule }: {
  notice: CaseNotice; packs: Packs; today: number; onAnswer(a: Action): Promise<Ack>; onRule(id: string): void;
}) {
  const [bribeOpen, setBribeOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bribeCard = ruleCardById(packs, 'bribery');

  const send = async (a: Action | null) => {
    if (!a) { setError('Enter an amount in dollars.'); return; }
    setBusy(true); setError(null);
    try {
      const ack = await onAnswer(a);
      if (!ack.ok) setError(ack.error ?? 'The city did not accept the answer.');
    } catch {
      setError('Connection lost. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const findings = (
    <div className="bz-list">
      {notice.found.map((f) => {
        const v = violationById(packs, f.violationId);
        return (
          <div className="bz-li" key={f.violationId}>
            <div className="bz-li-main">
              <button type="button" className="bz-linkbtn bz-li-title" onClick={() => onRule(f.violationId)}>
                {v?.name ?? f.violationId}
              </button>
              <span className="bz-li-sub">{v?.law ?? ''}{f.months ? ` · ${plural(f.months, 'month')}` : ''}{f.closureDays ? ` · ${plural(f.closureDays, 'day')} closed` : ''}</span>
            </div>
            <span className="bz-amt">{usd(f.fine)}</span>
          </div>
        );
      })}
    </div>
  );

  if (notice.status !== 'notice') return <NoticeOutcome notice={notice} findings={findings} />;

  const left = notice.answerByDay - today;
  return (
    <section className="bz-card bz-tone-bad nt-card" aria-label={ROLE_TITLE[notice.role]}>
      <header className="nt-head">
        <span className="nt-seal" aria-hidden="true"><Icon name="badge" size={22} /></span>
        <div className="nt-head__text">
          <div className="nt-eyebrow">{pick('City of New York · notice of violation', 'Город Нью-Йорк · уведомление о нарушении')}</div>
          <h3 className="bz-card-title">{`${ROLE_TITLE[notice.role]}: ${plural(notice.found.length, 'violation')} found`}</h3>
        </div>
      </header>
      <div className="nt-sum">
        <span className="nt-sum__fine">{usd(notice.fine)}</span>
        <span className="nt-sum__what">
          {pick('fine', 'штраф')}{notice.closureDays ? <> {pick('and', 'и')} <b>{plural(notice.closureDays, 'day')} closed</b></> : null}
        </span>
        <span className={`nt-deadline${left <= 1 ? ' nt-deadline--soon' : ''}`}><Icon name="clock" size={14} /> Answer by {dayLabel(notice.answerByDay)}</span>
      </div>
      {findings}
      <p className="bz-small">
        Answer {relDay(notice.answerByDay, today)}. If you don't answer, the fine is taken from your cash.
      </p>
      <div className="bz-btn-row">
        <Button variant="primary" disabled={busy} onClick={() => send(payAction(notice))}>Pay {usd(notice.fine)}</Button>
        <Button disabled={busy} onClick={() => send(contestAction(notice))}>Contest — lawyer {usd(CONTEST.fee)}, fine −{CONTEST.fineCutPct}%</Button>
        <Button variant="ghost" className="nt-bribe" disabled={busy} aria-expanded={bribeOpen} onClick={() => setBribeOpen((o) => !o)}>Offer a bribe…</Button>
      </div>
      {bribeOpen && (
        <div className="bz-card bz-inner">
          <p className="bz-bad-text"><b>This is a crime in real life.</b> {bribeCard?.text ?? 'Bribing a public servant is a felony in New York.'}</p>
          <p className="bz-small">
            In the game: if the official refuses or doesn't answer, the fine grows by half. Every month internal affairs checks the
            official who took the most bribes; if they are exposed, everyone who paid them is fined for bribery.
          </p>
          <label className="bz-small" htmlFor={`bribe-${notice.caseId}`}>Amount, $</label>
          <input id={`bribe-${notice.caseId}`} className="bz-input" inputMode="numeric" value={amount} placeholder="e.g. 400"
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))} />
          <Button variant="danger" disabled={busy || !amount} onClick={() => send(bribeAction(notice, Number(amount)))}>
            Offer {amount ? usd(Number(amount)) : 'a bribe'}
          </Button>
        </div>
      )}
      {error && <p className="bz-bad-text" role="alert">{error}</p>}
    </section>
  );
}

function NoticeOutcome({ notice, findings }: { notice: CaseNotice; findings: ReactNode }) {
  let title: string;
  let tone: 'good' | 'warn' | 'bad' | 'info' = 'info';
  let text: string;
  if (notice.status === 'bribe_offered') {
    title = 'Bribe offered'; tone = 'warn';
    text = 'The official answers within a day. If they refuse, the fine grows by half.';
  } else {
    switch (notice.outcome) {
      case 'fined':
        title = `Fine paid: ${usd(notice.fine)}`; tone = 'bad';
        text = notice.closureDays ? `Closed for ${plural(notice.closureDays, 'day')}. Fix the cause before the inspector comes back.` : 'Fix the cause before the inspector comes back.';
        break;
      case 'bribed':
        title = 'The official took the money'; tone = 'warn';
        text = 'No fine this time. The violation is still there, and so is the risk of internal affairs.';
        break;
      case 'clean':
        title = 'Inspection: nothing found'; tone = 'good'; text = 'Nothing to pay.';
        break;
      case 'dismissed':
        title = 'Case dismissed'; tone = 'good'; text = 'Nothing to pay.';
        break;
      default:
        title = 'Answer sent'; text = 'The city is processing your answer.';
    }
  }
  return (
    <Card tone={tone} title={title}>
      {notice.found.length > 0 && notice.outcome !== 'clean' && findings}
      <p>{text}</p>
    </Card>
  );
}
