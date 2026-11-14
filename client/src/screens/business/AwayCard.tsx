import type { InboxItem, OwnerView } from '@ohh/shared/types';
import { Button, Card } from './__stubs__/ui';
import type { BizTabId } from './deps';
import { pendingNotices } from './actions';
import { plural, shortDate, signedUsd } from './format';

/** Where an inbox item sends the player, if it waits for an answer or deserves a look. */
function goFor(item: InboxItem, hasNotice: boolean): { label: string; tab: BizTabId } | null {
  switch (item.kind) {
    case 'deal': return { label: 'Answer the offer', tab: 'network' };
    case 'case': return hasNotice ? { label: 'Answer the notice', tab: 'today' } : null;
    case 'event': return { label: "See what's ahead", tab: 'today' };
    case 'money': return { label: 'Open the books', tab: 'books' };
    default: return null;
  }
}

export function AwayCard({ view, onClose, onGo }: { view: OwnerView; onClose(): void; onGo(tab: BizTabId): void }) {
  const away = view.away!;
  const b = view.business;
  const offers = b ? view.deals.filter((d) => d.status === 'proposed' && d.toBusinessId === b.id).length : 0;
  const notices = pendingNotices(view.notices).length;
  const caseTitles = away.items.filter((i) => i.kind === 'case').map((i) => i.title);
  const chips = [
    `${plural(away.days, 'day')} passed`,
    signedUsd(away.profit),
    ...caseTitles,
    ...(offers ? [`${plural(offers, 'offer')} waiting`] : []),
    ...(notices ? [`${plural(notices, 'fine')} to answer`] : []),
  ];

  return (
    <div className="bz-overlay" role="dialog" aria-modal="true" aria-label="While you were away">
      <Card title="While you were away">
        <p className="bz-away-big">{chips.join(' · ')}</p>
        <div className="bz-list">
          {away.items.map((it) => {
            const go = goFor(it, notices > 0);
            return (
              <div className="bz-li" key={it.id}>
                <div className="bz-li-main">
                  <span className="bz-li-title">{it.title}</span>
                  <span className="bz-li-sub">{shortDate(it.day)} · {it.text}</span>
                </div>
                {go && <Button onClick={() => { onClose(); onGo(go.tab); }}>{go.label}</Button>}
              </div>
            );
          })}
        </div>
        <Button variant="primary" onClick={onClose}>Got it</Button>
      </Card>
    </div>
  );
}
