// Small form pieces shared by the network and desk screens. Inputs carry aria-labels so tests and screen readers find them.
import type { ReactNode } from 'react';
import { Field } from './ui';

export function MoneyField(props: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; hint?: ReactNode }) {
  return (
    <Field label={props.label} hint={props.hint}>
      <span className="nw-input">
        <span className="nw-input__affix" aria-hidden="true">$</span>
        <input
          className="input" type="number" inputMode="numeric" aria-label={props.label}
          value={Number.isFinite(props.value) ? props.value : ''}
          min={props.min} max={props.max} step={props.step ?? 100}
          onChange={(e) => props.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        />
      </span>
    </Field>
  );
}

export function NumberField(props: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; suffix?: string; hint?: ReactNode }) {
  return (
    <Field label={props.label} hint={props.hint}>
      <span className="nw-input">
        <input
          className="input" type="number" inputMode="decimal" aria-label={props.label}
          value={Number.isFinite(props.value) ? props.value : ''}
          min={props.min} max={props.max} step={props.step ?? 1}
          onChange={(e) => props.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        />
        {props.suffix && <span className="nw-input__affix">{props.suffix}</span>}
      </span>
    </Field>
  );
}

/** A labelled stepper row: label on the left, − value + on the right. */
export function StepRow(props: { label: string; children: ReactNode }) {
  return (
    <div className="row-between nw-steprow">
      <span className="field__label">{props.label}</span>
      {props.children}
    </div>
  );
}

export function Lines(props: { lines: string[]; tone?: 'plain' | 'warn' }) {
  if (!props.lines.length) return null;
  return (
    <ul className={`nw-lines${props.tone === 'warn' ? ' nw-lines--warn' : ''}`}>
      {props.lines.map((l) => <li key={l}>{l}</li>)}
    </ul>
  );
}

export function Stars(props: { value: number }) {
  const v = Math.round(Math.max(0, Math.min(1, props.value)) * 50) / 10;
  return <span className="nw-stars num" aria-label={`Reputation ${v.toFixed(1)} of 5`}>★ {v.toFixed(1)}</span>;
}
