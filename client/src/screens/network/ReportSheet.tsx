import { useState } from 'react';
import type { Action, OwnerView, PackSet, PublicBusiness } from '../../../../shared/src/types';
import { Button, Field, Sheet } from './ui';
import { Lines } from './fields';
import { act, myReports, NICHE_LABEL, reportConsequences, reportEligibility, reportLimit, reportOptions, type NetworkExtra } from './logic';

export const ROLE_LABEL = { inspector: 'City health inspector', tax_auditor: 'Tax auditor' } as const;

/** «Report to the city»: the only attack in the game. The target is fixed (opened from a profile) or picked here. */
export function ReportSheet(props: {
  onClose: () => void; view: OwnerView & { extra?: Partial<NetworkExtra> }; packs: PackSet | null;
  target?: PublicBusiness; onAct: (a: Action) => unknown;
}) {
  const { view } = props;
  const candidates = view.neighbors.filter((n) => n.id !== view.business?.id && n.status !== 'bankrupt');
  const [targetId, setTargetId] = useState(props.target?.id ?? candidates[0]?.id ?? '');
  const target = props.target ?? view.neighbors.find((n) => n.id === targetId);
  const options = target ? reportOptions(props.packs, target.niche) : [];
  const [reportId, setReportId] = useState('');
  const [sent, setSent] = useState(false);
  const history = myReports(view);
  const eligibility = target ? reportEligibility(view.business, target, reportLimit(view)) : { allowed: false, reason: 'Pick a business' };
  const chosen = options.find((o) => o.id === reportId) ?? options[0];
  const canSend = Boolean(target && chosen && eligibility.allowed);

  const send = () => {
    if (!canSend || !target || !chosen) return;
    props.onAct(act.report(target.id, chosen.id));
    setSent(true);
  };

  if (sent) {
    return (
      <Sheet open onClose={props.onClose} title="Report to the city" footer={<Button block onClick={props.onClose}>Done</Button>}>
        <div className="nw-done" role="status">
          <p><strong>Report sent.</strong> The city opens a case and an official will take it. Your name stays hidden unless the report turns out false.</p>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      open onClose={props.onClose} title="Report to the city"
      footer={<Button block variant="danger" icon="flag" onClick={send} disabled={!canSend}>Send report</Button>}
    >
      <div className="stack">
        {props.target ? (
          <p className="nw-target">About <strong>{props.target.name}</strong> · {NICHE_LABEL[props.target.niche]}</p>
        ) : (
          <Field label="Business">
            <select className="input" aria-label="Business" value={targetId} onChange={(e) => { setTargetId(e.target.value); setReportId(''); }}>
              {candidates.map((c) => <option key={c.id} value={c.id}>{c.name} · {NICHE_LABEL[c.niche]}{c.isAi ? ' · AI' : ''}</option>)}
            </select>
          </Field>
        )}

        <fieldset className="nw-reports">
          <legend className="field__label">What is wrong</legend>
          {!props.packs && <p className="muted small">Loading the list of reports…</p>}
          {props.packs && options.length === 0 && <p className="muted small">No report types for this kind of business yet.</p>}
          {options.map((o) => (
            <label key={o.id} className={`nw-report${chosen?.id === o.id ? ' is-on' : ''}`}>
              <input type="radio" name="report-kind" value={o.id} checked={chosen?.id === o.id} onChange={() => setReportId(o.id)} />
              <span>
                <span className="nw-report__name">{o.name}</span>
                <span className="nw-report__text">{o.text}</span>
                <span className="nw-report__who">Checked by: {ROLE_LABEL[o.role]}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="nw-effect">
          <div className="eyebrow">What happens next</div>
          <Lines lines={reportConsequences(history)} tone="warn" />
        </div>
        {!eligibility.allowed && <p className="nw-error" role="alert">{eligibility.reason}</p>}
      </div>
    </Sheet>
  );
}
