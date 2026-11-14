import { useState, type ReactNode } from 'react';
import { Sheet } from '../../ui';
import { glossary } from './glossary';

/** Any number on the Insights tab: tap it to learn what it is and why it matters. */
export function Tip({ k, children, className, label }: { k: string; children: ReactNode; className?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const g = glossary(k);
  return (
    <>
      <button type="button" className={`ins-tip${className ? ` ${className}` : ''}`} onClick={() => setOpen(true)} aria-label={label ?? `${g.title}: what is this?`}>
        {children}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={g.title}>
        <p>{g.what}</p>
        {g.why && <p className="muted"><strong>Why it matters.</strong> {g.why}</p>}
      </Sheet>
    </>
  );
}

/** A headline number as a tappable tile. */
export function StatTile({ k, label, value, sub, tone }: { k: string; label: string; value: string; sub?: string; tone: 'good' | 'bad' | 'neutral' }) {
  return (
    <Tip k={k} className={`ins-stat ins-stat--${tone}`} label={`${label}: ${value}. What is this?`}>
      <span className="ins-stat__label">{label}</span>
      <span className="ins-stat__value num">{value}</span>
      {sub && <span className="ins-stat__sub">{sub}</span>}
    </Tip>
  );
}
