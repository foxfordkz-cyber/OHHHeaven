// Small form pieces used by both folders. Labels are real <label>s so tests and screen readers find them.
import type { ReactNode } from 'react';

export function MoneyField(props: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; hint?: ReactNode }) {
  return (
    <label className="nw-field">
      <span className="nw-field__label">{props.label}</span>
      <span className="nw-field__box">
        <span className="nw-field__prefix">$</span>
        <input
          type="number" inputMode="numeric" aria-label={props.label}
          value={Number.isFinite(props.value) ? props.value : ''}
          min={props.min} max={props.max} step={props.step ?? 100}
          onChange={(e) => props.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        />
      </span>
      {props.hint && <span className="nw-field__hint">{props.hint}</span>}
    </label>
  );
}

export function NumberField(props: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; suffix?: string }) {
  return (
    <label className="nw-field">
      <span className="nw-field__label">{props.label}</span>
      <span className="nw-field__box">
        <input
          type="number" inputMode="decimal" aria-label={props.label}
          value={Number.isFinite(props.value) ? props.value : ''}
          min={props.min} max={props.max} step={props.step ?? 1}
          onChange={(e) => props.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        />
        {props.suffix && <span className="nw-field__suffix">{props.suffix}</span>}
      </span>
    </label>
  );
}

export function Lines(props: { lines: string[]; tone?: 'muted' | 'warn' }) {
  return (
    <ul className={`nw-lines nw-lines--${props.tone ?? 'muted'}`}>
      {props.lines.map((l) => <li key={l}>{l}</li>)}
    </ul>
  );
}

export function Stars(props: { value: number }) {
  const v = Math.round(Math.max(0, Math.min(1, props.value)) * 50) / 10;
  return <span className="nw-stars" aria-label={`Reputation ${v} of 5`}>★ {v.toFixed(1)}</span>;
}
