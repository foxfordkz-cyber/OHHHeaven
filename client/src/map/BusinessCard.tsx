// Card for one business in "live" mode: what anyone in the city can see about it.
import type { Place, PublicBusiness } from '@ohh/shared/types';
import { NICHE_META, money } from './geo';

export interface BusinessCta { label: string; onClick: (businessId: string) => void }

export interface BusinessCardProps {
  business: PublicBusiness; place?: Place; mine?: boolean;
  cta?: BusinessCta; onClose: () => void;
}

const STATUS_LABEL: Record<PublicBusiness['status'], string> = {
  setup: 'Getting ready to open',
  open: 'Open',
  closed: 'Closed by the city',
  bankrupt: 'Out of business',
};

export function BusinessCard({ business: b, place, mine, cta, onClose }: BusinessCardProps) {
  const meta = NICHE_META[b.niche];
  const deals = b.trust.kept + b.trust.broken;
  return (
    <section className="cm-card cm-card--biz" role="dialog" aria-label={b.name}>
      <header className="cm-card__head">
        <div>
          <div className="cm-card__eyebrow">{place ? place.address : meta.label}</div>
          <h3 className="cm-card__title">{b.name}</h3>
        </div>
        <button type="button" className="cm-card__close" onClick={onClose} aria-label="Close">×</button>
      </header>
      <div className="cm-card__tags">
        <span className="cm-tag cm-tag--niche" style={{ color: meta.color }}>{meta.label}</span>
        <span className={`cm-tag cm-tag--status-${b.status}`}>{STATUS_LABEL[b.status]}</span>
        {b.isAi && <span className="cm-tag cm-tag--ai">AI-run</span>}
        {mine && <span className="cm-tag cm-tag--mine">Yours</span>}
        {b.grade && <span className="cm-tag">Grade {b.grade}</span>}
      </div>
      <dl className="cm-card__grid">
        <div><dt>Place in the niche</dt><dd>#{b.rankInNiche}</dd></div>
        <div><dt>Price</dt><dd>{money(b.price)}</dd></div>
        <div>
          <dt>Reputation</dt><dd>{(b.reputation * 5).toFixed(1)}<small> of 5</small></dd>
          <span className="cm-bar"><span style={{ width: `${Math.round(b.reputation * 100)}%` }} /></span>
        </div>
        <div>
          <dt>Deals</dt>
          <dd>{deals === 0 ? '—' : b.trust.kept}<small>{deals === 0 ? ' none yet' : ` kept · ${b.trust.broken} broken`}</small></dd>
        </div>
      </dl>
      <p className="cm-card__note">Run by {b.ownerName}{b.partners.length > 0 ? ` · ${b.partners.length} active deal${b.partners.length === 1 ? '' : 's'}` : ''}</p>
      {cta && (
        <button type="button" className="cm-btn cm-btn--primary" onClick={() => cta.onClick(b.id)}>{cta.label}</button>
      )}
    </section>
  );
}
