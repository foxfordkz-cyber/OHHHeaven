import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router-dom';
import { Icon, type IconName } from './icons';
import { formatMoney, toneOf } from './format';

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

// ───────────────────────── Button ─────────────────────────

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
}

export function Button({ variant = 'primary', size = 'md', block, icon, iconRight, loading, disabled, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={cx('btn', `btn--${variant}`, size !== 'md' && `btn--${size}`, block && 'btn--block', className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <span className="btn__spinner" aria-hidden="true" /> : icon && <Icon name={icon} size={size === 'sm' ? 16 : 20} />}
      {children}
      {iconRight && !loading && <Icon name={iconRight} size={size === 'sm' ? 16 : 20} />}
    </button>
  );
}

// ───────────────────────── Card ─────────────────────────

export interface CardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  tone?: 'default' | 'accent' | 'warn' | 'loss' | 'profit' | 'flat';
  onClick?: () => void;
  className?: string;
  children?: ReactNode;
  'aria-label'?: string;
}

export function Card({ title, subtitle, action, tone = 'default', onClick, className, children, ...rest }: CardProps) {
  const cls = cx('card', tone !== 'default' && `card--${tone}`, onClick && 'card--clickable', className);
  const head = (title || action) && (
    <div className="card__head">
      <div className="grow">
        {title && <div className="card__title">{title}</div>}
        {subtitle && <div className="card__subtitle">{subtitle}</div>}
      </div>
      {action}
    </div>
  );
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} aria-label={rest['aria-label']}>
        {head}
        {children}
      </button>
    );
  }
  return (
    <section className={cls} aria-label={rest['aria-label']}>
      {head}
      {children}
    </section>
  );
}

// ───────────────────────── Badge, Stat, MoneyText, ProgressBar ─────────────────────────

export type BadgeTone = 'neutral' | 'accent' | 'profit' | 'loss' | 'warn' | 'info' | 'ai';
export function Badge({ tone = 'neutral', icon, children, title }: { tone?: BadgeTone; icon?: IconName; children: ReactNode; title?: string }) {
  return (
    <span className={cx('badge', tone !== 'neutral' && `badge--${tone}`)} title={title}>
      {icon && <Icon name={icon} size={12} strokeWidth={2.2} />}
      {children}
    </span>
  );
}

export function MoneyText({ value, signed, compact, cents, tone = 'auto', className }: { value: number; signed?: boolean; compact?: boolean; cents?: boolean; tone?: 'auto' | 'none'; className?: string }) {
  const t = tone === 'auto' && signed ? toneOf(value) : 'neutral';
  return <span className={cx('money', t === 'profit' && 'money--profit', t === 'loss' && 'money--loss', className)}>{formatMoney(value, { signed, compact, cents })}</span>;
}

export function Stat({ label, value, hint, small }: { label: ReactNode; value: ReactNode; hint?: ReactNode; small?: boolean }) {
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className={cx('stat__value', small && 'stat__value--sm')}>{value}</span>
      {hint && <span className="stat__hint">{hint}</span>}
    </div>
  );
}

export function ProgressBar({ value, tone = 'accent', label }: { value: number; tone?: 'accent' | 'profit' | 'loss' | 'warn' | 'info'; label?: string }) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)} aria-label={label}>
      <div className={cx('progress__fill', tone !== 'accent' && `progress__fill--${tone}`)} style={{ width: `${pct * 100}%` }} />
    </div>
  );
}

// ───────────────────────── ListRow ─────────────────────────

export interface ListRowProps {
  icon?: IconName;
  iconTone?: 'accent' | 'profit' | 'loss' | 'warn' | 'info';
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  trailing?: ReactNode;
  chevron?: boolean;
  onClick?: () => void;
}

const ICON_TONE: Record<NonNullable<ListRowProps['iconTone']>, { color: string; background: string }> = {
  accent: { color: 'var(--accent)', background: 'var(--accent-soft)' },
  profit: { color: 'var(--profit)', background: 'var(--profit-soft)' },
  loss: { color: 'var(--loss)', background: 'var(--loss-soft)' },
  warn: { color: 'var(--warn)', background: 'var(--warn-soft)' },
  info: { color: 'var(--info)', background: 'var(--info-soft)' },
};

export function ListRow({ icon, iconTone, title, subtitle, value, trailing, chevron, onClick }: ListRowProps) {
  const body = (
    <>
      {icon && (
        <span className="list-row__icon" style={iconTone ? ICON_TONE[iconTone] : undefined}>
          <Icon name={icon} size={18} />
        </span>
      )}
      <span className="list-row__body">
        <span className="list-row__title" style={{ display: 'block' }}>{title}</span>
        {subtitle && <span className="list-row__subtitle" style={{ display: 'block' }}>{subtitle}</span>}
      </span>
      {value !== undefined && <span className="list-row__value">{value}</span>}
      {trailing}
      {(chevron ?? Boolean(onClick)) && <Icon name="chevronRight" size={18} className="list-row__chevron" />}
    </>
  );
  return onClick ? (
    <button type="button" className="list-row" onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className="list-row">{body}</div>
  );
}

export function List({ children }: { children: ReactNode }) {
  return <div className="list">{children}</div>;
}

// ───────────────────────── Stepper, Slider, Toggle, SegmentedControl, Tabs ─────────────────────────

export function Stepper({ value, min = 0, max = 99, step = 1, onChange, label, format }: { value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void; label?: string; format?: (v: number) => ReactNode }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" aria-label={`Decrease${label ? ` ${label}` : ''}`} disabled={value - step < min} onClick={() => onChange(Math.max(min, value - step))}>
        <Icon name="minus" size={18} />
      </button>
      <span className="stepper__value" aria-live="polite">{format ? format(value) : value}</span>
      <button type="button" aria-label={`Increase${label ? ` ${label}` : ''}`} disabled={value + step > max} onClick={() => onChange(Math.min(max, value + step))}>
        <Icon name="plus" size={18} />
      </button>
    </div>
  );
}

export function Slider({ value, min, max, step = 1, onChange, label, format, marks }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; label: string; format?: (v: number) => ReactNode; marks?: [ReactNode, ReactNode] }) {
  const id = useId();
  return (
    <div className="slider">
      <div className="row-between">
        <label htmlFor={id} className="field__label">{label}</label>
        <span className="num" style={{ fontWeight: 700 }}>{format ? format(value) : value}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      {marks && (
        <div className="slider__marks">
          <span>{marks[0]}</span>
          <span>{marks[1]}</span>
        </div>
      )}
    </div>
  );
}

export function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode; disabled?: boolean }) {
  return (
    <label className="toggle" style={disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
      <span className="grow">
        <span style={{ display: 'block', fontWeight: 600 }}>{label}</span>
        {description && <span className="small muted" style={{ display: 'block' }}>{description}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle__track" aria-hidden="true" />
    </label>
  );
}

export function SegmentedControl<T extends string>({ options, value, onChange, label }: { options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; label?: string }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { id: T; label: ReactNode; badge?: number }[]; value: T; onChange: (id: T) => void; label?: string }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={t.id === value} onClick={() => onChange(t.id)}>
          {t.label}
          {t.badge ? <span className="tabs__badge">{t.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}

// ───────────────────────── Sheet (bottom panel) ─────────────────────────

export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);
  if (!open || typeof document === 'undefined') return null;
  // A portal keeps the panel fixed to the viewport even when opened from inside another panel.
  return createPortal(
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} tabIndex={-1} ref={ref}>
        <div className="sheet__grip" />
        <div className="sheet__head">
          <div className="h3">{title}</div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="sheet__body">{children}</div>
        {footer && <div className="sheet__foot">{footer}</div>}
      </div>
    </>,
    document.body,
  );
}

// ───────────────────────── Toast ─────────────────────────

export interface ToastItem { id: number; text: string; tone: 'error' | 'info' | 'success' }

export function Toast({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  const icon: IconName = toast.tone === 'error' ? 'alert' : toast.tone === 'success' ? 'check' : 'info';
  return (
    <div className={`toast toast--${toast.tone}`} role={toast.tone === 'error' ? 'alert' : 'status'}>
      <Icon name={icon} size={18} className="toast__icon" />
      <span className="toast__text">{toast.text}</span>
      <button type="button" aria-label="Dismiss" onClick={onClose}>
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}

export function Toaster({ toasts, onClose }: { toasts: ToastItem[]; onClose: (id: number) => void }) {
  if (!toasts.length) return null;
  return (
    <div className="toaster" aria-live="polite">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onClose={() => onClose(t.id)} />
      ))}
    </div>
  );
}

// ───────────────────────── BottomNav ─────────────────────────

export interface NavItem { to: string; label: string; icon: IconName; badge?: number; end?: boolean }

export function BottomNav({ items }: { items: NavItem[] }) {
  return (
    <nav className="bottom-nav" aria-label="Main">
      {items.map((it) => (
        <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => (isActive ? 'active' : undefined)}>
          <Icon name={it.icon} size={22} />
          <span>{it.label}</span>
          {it.badge ? <span className="bottom-nav__badge">{it.badge}</span> : null}
        </NavLink>
      ))}
    </nav>
  );
}

// ───────────────────────── small layout pieces ─────────────────────────

export function TopBar({ title, onBack, right }: { title?: ReactNode; onBack?: () => void; right?: ReactNode }) {
  return (
    <div className="top-bar">
      {onBack && (
        <button type="button" className="icon-btn" aria-label="Back" onClick={onBack}>
          <Icon name="arrowLeft" size={18} />
        </button>
      )}
      <div className="top-bar__title">{title}</div>
      {right}
    </div>
  );
}

export function Field({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {hint && <span className="xsmall faint">{hint}</span>}
    </label>
  );
}

export function Skeleton({ height = 16, width = '100%' }: { height?: number; width?: number | string }) {
  return <div className="skeleton" style={{ height, width }} aria-hidden="true" />;
}

export function Banner({ tone = 'warn', icon = 'alert', children }: { tone?: 'warn' | 'info'; icon?: IconName; children: ReactNode }) {
  return (
    <div className={cx('banner', tone === 'info' && 'banner--info')} role="status">
      <Icon name={icon} size={16} />
      <span>{children}</span>
    </div>
  );
}

export { cx };
