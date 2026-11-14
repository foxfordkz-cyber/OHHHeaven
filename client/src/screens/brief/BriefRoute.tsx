// /brief wired to the app store: the live view, actions and navigation.
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Skeleton, TopBar, useT } from '../../ui';
import { useGame, useStoreState, useView } from '../../app/store';
import { BriefScreen } from './BriefScreen';

export function BriefRoute() {
  const tr = useT();
  const view = useView();
  const game = useGame();
  const { mode, worldId, status } = useStoreState();
  const navigate = useNavigate();

  useEffect(() => {
    if (view?.kind === 'official') navigate('/desk', { replace: true });
  }, [view?.kind, navigate]);

  if (!view) {
    return (
      <main className="screen stack">
        <TopBar title={tr('While you were away', 'Пока тебя не было')} onBack={() => navigate('/')} />
        {status === 'offline'
          ? <Card tone="warn" title={tr('No connection to the city', 'Нет связи с городом')} subtitle={tr('The brief needs the latest state of your business.', 'Для сводки нужно свежее состояние бизнеса.')}><Button variant="secondary" onClick={() => void game.refresh()}>{tr('Try again', 'Попробовать снова')}</Button></Card>
          : <><Skeleton height={96} /><Skeleton height={160} /><Skeleton height={120} /></>}
      </main>
    );
  }
  if (view.kind !== 'owner') {
    return (
      <main className="screen stack">
        <TopBar title={tr('While you were away', 'Пока тебя не было')} onBack={() => navigate('/')} />
        <Card title={tr('Join the city first', 'Сначала войди в город')} subtitle={tr('The brief is for owners: open a business and come back tomorrow.', 'Сводка — для владельцев: открой бизнес и возвращайся завтра.')}>
          <Button block size="lg" icon="store" onClick={() => navigate('/start')}>{tr('Start my business', 'Открыть свой бизнес')}</Button>
        </Card>
      </main>
    );
  }

  return <BriefScreen deps={{ view, memoryKey: `${mode}:${worldId}:${view.me.id}`, act: game.act, navigate: (to) => navigate(to) }} />;
}
