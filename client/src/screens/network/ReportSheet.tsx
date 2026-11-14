import { useState } from 'react';
import type { Action, OwnerView, PackSet, PublicBusiness } from '../../../../shared/src/types';
import { Button, Sheet } from './ui';
import { Lines } from './fields';
import { act, myReports, NICHE_LABEL, reportConsequences, reportEligibility, reportLimit, reportOptions, type NetworkExtra } from './logic';

const ROLE_LABEL = { inspector: 'City inspector', tax_auditor: 'Tax auditor' } as const;

/** «Report to the city»: the only attack in the game. Target can be fixed (from a profile) or picked here. */
export function ReportSheet(props: {
  open: boolean; onClose: () => void; view: OwnerView & { extra?: Partial<NetworkExtra> }; packs: PackSet;
  target?: PublicBusiness; onAct: (a: Action) => unknown;
}) {
  const { view } = props;
  const candidates = view.neighbors.filter((n) => n.id !== view.business?.id && n.status !== 'bankrupt');
  const [targetId, setTargetId] = useState(props.target?.id ?? candidates[0]?.id ?? '');
  const target = props.target ?? view.neighbors.find((n) => n.id === targetId);
  const options = target ? reportOptions(props.packs, target.niche) : [];
  const [reportId, setReportId] = useState(options[0]?.id ?? '');
  const [sent, setSent] = useState(false);
  const history = myReports(view);
  const eligibility = target ? reportEligibility(view.business, target, reportLimit(view)) : { allowed: false, reason: 'Pick a business' };
  const chosen = options.find((o) => o.id === reportId) ?? options[0];

  const send = () => {
    if (!target || !chosen || !eligibility.allowed) return;
    props.onAct(act.report(target.id, chosen.id));
    setSent(true);
  };

  return (
    <Sheet open={props.open} onClose={props.onClose} title="Report to the city" testId="report-sheet">
      {sent ? (
        <div className="nw-done" role="status">
          <p><strong>Report sent.</strong> The city opens a case. Your name stays hidden unless the report turns out false.</p>
          <Button full onClick={props.onClose}>Done</Button>
        </div>
      ) : (
        <>
          {props.target ? (
            <p className="nw-target">About <strong>{props.target.name}</strong> · {NICHE_LABEL[props.target.niche]}</p>
          ) : (
            <label className="nw-field">
              <span className="nw-field__label">Business</span>
              <select aria-label="Business" value={targetId} onChange={(e) => { setTargetId(e.target.value); setReportId(''); }}>
                {candidates.map((c) => <option key={c.id} value={c.id}>{c.name} · {NICHE_LABEL[c.niche]}{c.isAi ? ' · AI' : ''}</option>)}
              </select>
            </label>
          )}

          <fieldset className="nw-reports">
            <legend>What is wrong</legend>
            {options.length === 0 && <p className="ui-muted">No report types for this niche yet.</p>}
            {options.map((o) => (
              <label key={o.id} className={`nw-report${chosen?.id === o.id ? ' is-on' : ''}`}>
                <input type="radio" name="report" value={o.id} checked={chosen?.id === o.id} onChange={() => setReportId(o.id)} />
                <span>
                  <span className="nw-report__name">{o.name}</span>
                  <span className="nw-report__text">{o.text}</span>
                  <span className="nw-report__who">Checked by: {ROLE_LABEL[o.role]}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <div className="nw-effect">
            <div className="nw-effect__title">What happens next</div>
            <Lines lines={reportConsequences(history)} tone="warn" />
          </div>
          {!eligibility.allowed && <p className="nw-error" role="alert">{eligibility.reason}</p>}
          <Button full variant="danger" onClick={send} disabled={!eligibility.allowed || !chosen}>Send report</Button>
        </>
      )}
    </Sheet>
  );
}
