// Minimal copies of the shell's UI kit (agent 08, client/src/ui/) so the screen works standalone.
// Swap these imports for client/src/ui when it lands; props are kept plain on purpose.
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'info';

export function Card({ children, tone = 'neutral', title, aside, className = '' }: { children: ReactNode; tone?: Tone; title?: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <section className={`bz-card bz-tone-${tone} ${className}`}>
      {(title || aside) && (
        <header className="bz-card-head">
          {title && <h3 className="bz-card-title">{title}</h3>}
          {aside && <div className="bz-card-aside">{aside}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Button({ variant = 'outline', className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'outline' | 'ghost' | 'danger' }) {
  return <button type="button" className={`bz-btn bz-btn-${variant} ${className}`} {...rest} />;
}

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  return <span className={`bz-pill bz-tone-${tone}`}>{children}</span>;
}

export function Stepper({ value, onChange, min = 0, max = Number.POSITIVE_INFINITY, label, step = 1, format }: {
  value: number; onChange(v: number): void; min?: number; max?: number; label: string; step?: number; format?(v: number): string;
}) {
  return (
    <div className="bz-stepper" role="group" aria-label={label}>
      <button type="button" className="bz-step" aria-label={`Less ${label}`} disabled={value <= min} onClick={() => onChange(value - step)}>−</button>
      <output className="bz-step-value" aria-live="polite">{format ? format(value) : value}</output>
      <button type="button" className="bz-step" aria-label={`More ${label}`} disabled={value >= max} onClick={() => onChange(value + step)}>+</button>
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange, label }: {
  options: { id: T; label: ReactNode; hint?: ReactNode; warn?: boolean }[]; value: T; onChange(v: T): void; label: string;
}) {
  return (
    <div className="bz-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={o.id === value}
          className={`bz-seg-opt${o.id === value ? ' is-on' : ''}${o.warn ? ' is-warn' : ''}`} onClick={() => onChange(o.id)}>
          <span className="bz-seg-label">{o.label}</span>
          {o.hint && <span className="bz-seg-hint">{o.hint}</span>}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange(v: boolean): void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`bz-toggle${on ? ' is-on' : ''}`} onClick={() => onChange(!on)}>
      <span className="bz-toggle-knob" />
    </button>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose(): void; title: ReactNode; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="bz-sheet-backdrop" onClick={onClose}>
      <div className="bz-sheet" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} onClick={(e) => e.stopPropagation()}>
        <header className="bz-sheet-head">
          <h3>{title}</h3>
          <button type="button" className="bz-btn bz-btn-ghost" aria-label="Close" onClick={onClose}>✕</button>
        </header>
        <div className="bz-sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function Banner({ tone = 'warn', children }: { tone?: Tone; children: ReactNode }) {
  return <div className={`bz-banner bz-tone-${tone}`} role="status">{children}</div>;
}

export function Stat({ label, value, tone = 'neutral', sub }: { label: string; value: ReactNode; tone?: Tone; sub?: ReactNode }) {
  return (
    <div className={`bz-stat bz-tone-${tone}`}>
      <div className="bz-stat-label">{label}</div>
      <div className="bz-stat-value">{value}</div>
      {sub && <div className="bz-stat-sub">{sub}</div>}
    </div>
  );
}
