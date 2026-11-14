// Minimal stand-ins for agent 08's design system (client/src/ui/). Same component names as in
// build/tasks/08-client-home.md, so swapping `./__stubs__/ui` for `../../ui` in ../ui.ts is one line.
import { useEffect, type ReactNode } from 'react';
import './tokens.css';

type Tone = 'neutral' | 'accent' | 'good' | 'bad' | 'warn';

export function Card(props: { title?: ReactNode; aside?: ReactNode; children?: ReactNode; className?: string; testId?: string }) {
  return (
    <section className={`ui-card ${props.className ?? ''}`} data-testid={props.testId}>
      {(props.title || props.aside) && (
        <header className="ui-card__head">
          <h3 className="ui-card__title">{props.title}</h3>
          {props.aside && <div className="ui-card__aside">{props.aside}</div>}
        </header>
      )}
      {props.children}
    </section>
  );
}

export function Button(props: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean; full?: boolean; title?: string; type?: 'button' | 'submit'; small?: boolean;
}) {
  return (
    <button
      type={props.type ?? 'button'}
      className={`ui-btn ui-btn--${props.variant ?? 'primary'}${props.full ? ' ui-btn--full' : ''}${props.small ? ' ui-btn--small' : ''}`}
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.title}
    >
      {props.children}
    </button>
  );
}

export function Badge(props: { children: ReactNode; tone?: Tone; title?: string }) {
  return <span className={`ui-badge ui-badge--${props.tone ?? 'neutral'}`} title={props.title}>{props.children}</span>;
}

export function AiBadge() {
  return <span className="ui-badge ui-badge--ai" title="Run by the computer, not a person">AI</span>;
}

export function ListRow(props: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode; onClick?: () => void; testId?: string; ariaLabel?: string }) {
  const body = (
    <>
      <div className="ui-row__main">
        <div className="ui-row__title">{props.title}</div>
        {props.subtitle && <div className="ui-row__sub">{props.subtitle}</div>}
      </div>
      {props.right && <div className="ui-row__right">{props.right}</div>}
    </>
  );
  return props.onClick ? (
    <button type="button" className="ui-row ui-row--button" onClick={props.onClick} data-testid={props.testId} aria-label={props.ariaLabel}>{body}</button>
  ) : (
    <div className="ui-row" data-testid={props.testId}>{body}</div>
  );
}

export function SegmentedControl<T extends string>(props: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; ariaLabel?: string }) {
  return (
    <div className="ui-seg" role="tablist" aria-label={props.ariaLabel}>
      {props.options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={o.value === props.value} className={`ui-seg__opt${o.value === props.value ? ' is-on' : ''}`} onClick={() => props.onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle(props: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; disabled?: boolean }) {
  return (
    <label className={`ui-toggle${props.disabled ? ' is-disabled' : ''}`}>
      <span className="ui-toggle__label">{props.label}</span>
      <input type="checkbox" role="switch" checked={props.checked} disabled={props.disabled} onChange={(e) => props.onChange(e.target.checked)} />
      <span className="ui-toggle__track" aria-hidden="true"><span className="ui-toggle__thumb" /></span>
    </label>
  );
}

export function Stepper(props: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; label: string; format?: (v: number) => string }) {
  const step = props.step ?? 1;
  const set = (v: number) => props.onChange(Math.min(props.max, Math.max(props.min, Math.round(v / step) * step)));
  return (
    <div className="ui-stepper">
      <span className="ui-stepper__label">{props.label}</span>
      <button type="button" aria-label={`Less ${props.label}`} onClick={() => set(props.value - step)} disabled={props.value <= props.min}>−</button>
      <output aria-label={props.label}>{props.format ? props.format(props.value) : props.value}</output>
      <button type="button" aria-label={`More ${props.label}`} onClick={() => set(props.value + step)} disabled={props.value >= props.max}>+</button>
    </div>
  );
}

export function MoneyText(props: { amount: number; signed?: boolean; cents?: boolean }) {
  const abs = Math.abs(props.amount).toLocaleString('en-US', { minimumFractionDigits: props.cents ? 2 : 0, maximumFractionDigits: props.cents ? 2 : 0 });
  const sign = props.amount < 0 ? '−' : props.signed && props.amount > 0 ? '+' : '';
  const tone = props.amount < 0 ? 'bad' : props.signed && props.amount > 0 ? 'good' : '';
  return <span className={`ui-money ${tone ? `ui-money--${tone}` : ''}`}>{sign}${abs}</span>;
}

export function Stat(props: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="ui-stat">
      <div className="ui-stat__label">{props.label}</div>
      <div className="ui-stat__value">{props.value}</div>
      {props.hint && <div className="ui-stat__hint">{props.hint}</div>}
    </div>
  );
}

export function ProgressBar(props: { value: number; label?: string; marker?: number }) {
  const v = Math.max(0, Math.min(1, props.value));
  return (
    <div className="ui-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} aria-label={props.label}>
      <div className="ui-progress__fill" style={{ width: `${v * 100}%` }} />
      {props.marker !== undefined && <div className="ui-progress__marker" style={{ left: `${props.marker * 100}%` }} />}
    </div>
  );
}

export function Sheet(props: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; testId?: string }) {
  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && props.onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props.open, props.onClose]);
  if (!props.open) return null;
  return (
    <div className="ui-sheet" role="dialog" aria-modal="true" aria-label={typeof props.title === 'string' ? props.title : undefined} data-testid={props.testId}>
      <button type="button" className="ui-sheet__scrim" aria-label="Close" onClick={props.onClose} />
      <div className="ui-sheet__panel">
        <header className="ui-sheet__head">
          <h2>{props.title}</h2>
          <button type="button" className="ui-sheet__close" aria-label="Close panel" onClick={props.onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </header>
        <div className="ui-sheet__body">{props.children}</div>
      </div>
    </div>
  );
}

export function Feed(props: { items: { id: string; day: number; text: string }[]; dayLabel?: (day: number) => string; empty?: string }) {
  if (props.items.length === 0) return <p className="ui-muted">{props.empty ?? 'Nothing yet.'}</p>;
  return (
    <ul className="ui-feed">
      {props.items.map((i) => (
        <li key={i.id}><span className="ui-feed__day">{props.dayLabel ? props.dayLabel(i.day) : `Day ${i.day}`}</span><span>{i.text}</span></li>
      ))}
    </ul>
  );
}

export function Clock(props: { label: string; weather?: string }) {
  return (
    <div className="ui-clock">
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
      <span>{props.label}</span>
      {props.weather && <span className="ui-muted">· {props.weather}</span>}
    </div>
  );
}

export function RuleCard(props: { title: string; text: string; source?: string }) {
  return (
    <aside className="ui-rule">
      <div className="ui-rule__kicker">Real rule</div>
      <div className="ui-rule__title">{props.title}</div>
      <p>{props.text}</p>
      {props.source && <a href={props.source} target="_blank" rel="noreferrer">Source</a>}
    </aside>
  );
}
