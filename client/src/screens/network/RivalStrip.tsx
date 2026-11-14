// A one-card summary of the rivalry for other screens (Today, the return brief): who my rival is, where I stand,
// and one tap to the Network tab where the two moves are. Reads the app store; renders nothing without a business.
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { OwnerView, PackSet, Place } from '../../../../shared/src/types';
import { AiBadge, Button, Card, useT } from './ui';
import { useCatalog, useOwnerView } from './deps';
import { formatDistance, money } from './logic';
import { ladderOf, mainRival } from './rivals';

const NO_PLACES: Place[] = [];

/** Wired to the store and the catalog; `/biz/network` is the Network tab. */
export function RivalStrip() {
  const view = useOwnerView();
  const catalog = useCatalog();
  const navigate = useNavigate();
  if (!view?.business) return null;
  return <RivalStripView view={view} places={catalog?.places ?? NO_PLACES} packs={catalog?.packs ?? null} onOpen={() => navigate('/biz/network')} />;
}

export function RivalStripView(props: { view: OwnerView; places: Place[]; packs: PackSet | null; onOpen: () => void }) {
  const tr = useT();
  const { view, places, packs } = props;
  const ladder = useMemo(() => ladderOf(view), [view]);
  const rival = useMemo(() => mainRival(view, places, packs, ladder), [view, places, packs, ladder]);
  if (!view.business || (!rival && !ladder?.me)) return null;
  const me = ladder?.me;
  return (
    <Card title={tr('Your rival', 'Ваш соперник')} aria-label="Rival summary" tone={rival?.sharesStreet ? 'warn' : 'default'}>
      <div className="stack-sm">
        {rival && (
          <p className="small nw-strip">
            <strong>{rival.biz.name}</strong>{rival.biz.isAi && <AiBadge />} · {formatDistance(rival.distanceM)}
            {rival.gap !== null && <> · {rival.gap >= 0 ? tr(`${money(rival.gap)} ahead of you`, `на ${money(rival.gap)} впереди`) : tr(`${money(-rival.gap)} behind you`, `на ${money(-rival.gap)} позади`)}</>}
          </p>
        )}
        {me && ladder && (
          <p className="small muted nw-strip">
            {tr(`You are #${me.rank} of ${ladder.total}`, `Вы #${me.rank} из ${ladder.total}`)}
            {me.prize !== null ? tr(` · prize today ${money(me.prize, { cents: me.prize < 100 })}`, ` · приз сегодня ${money(me.prize, { cents: me.prize < 100 })}`) : ladder.toPrize !== null ? tr(` · ${money(ladder.toPrize)} to a prize place`, ` · ${money(ladder.toPrize)} до призового места`) : ''}
          </p>
        )}
        <Button size="sm" variant="secondary" iconRight="arrowRight" onClick={props.onOpen}>{tr('Team up or report', 'Объединиться или пожаловаться')}</Button>
      </div>
    </Card>
  );
}
