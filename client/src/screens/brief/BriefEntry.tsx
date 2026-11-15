// The door to /brief, for any screen a returning owner lands on (home, /biz). One line to place it:
//   import { BriefEntry } from '../brief/BriefEntry';   …   <BriefEntry view={view} />
// It also keeps the server's "while you were away" summary, which the next poll erases,
// so the brief still has it when the player opens it a minute later.
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { OwnerView } from '@ohh/shared/types';
import { Button, Card, MoneyText, useT } from '../../ui';
import { useStoreState } from '../../app/store';
import { briefKey, keepAway, readMemory } from './memory';
import { pickDecision, resolveSince, round2, snapshotAway } from './model';

export function BriefEntry({ view, onOpen }: { view: OwnerView; onOpen?: () => void }) {
  const tr = useT();
  const navigate = useNavigate();
  const { mode, worldId } = useStoreState();
  const key = briefKey(mode, worldId, view.me.id);

  useEffect(() => {
    const snap = snapshotAway(view);
    if (snap) keepAway(key, snap);
  }, [view, key]);

  const b = view.business;
  if (!b) return null;
  const since = resolveSince(view, readMemory(key));
  const days = Math.max(0, view.world.day - since.day);
  const delta = since.cash === null ? null : round2(b.cash - since.cash);
  const decision = pickDecision(view);
  const urgent = decision && decision.kind !== 'calm' && decision.kind !== 'advice' ? decision.title : null;
  const open = onOpen ?? (() => navigate('/brief'));

  return (
    <Card tone="flat" aria-label={tr('Your brief', 'Твоя сводка')}
      title={days > 0 ? tr(`${days === 1 ? '1 day' : `${days} days`} since your last look`, `Дней с прошлого захода: ${days}`) : tr('Your brief for today', 'Сводка на сегодня')}
      subtitle={urgent ?? tr('What changed, one decision for today and when the next report lands.', 'Что изменилось, одно решение на сегодня и когда придёт следующий отчёт.')}
      action={delta === null ? undefined : <MoneyText value={delta} signed />}>
      <Button block variant={urgent ? 'primary' : 'secondary'} icon="clock" onClick={open}>{tr('See what happened', 'Что произошло')}</Button>
    </Card>
  );
}
