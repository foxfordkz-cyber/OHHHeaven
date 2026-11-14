// /pro: loads the plan status for my player, sends me to Stripe test checkout (or unlocks in test mode) and back.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Card, Skeleton, TopBar, useT } from '../../ui';
import { useGame, useOwnerView, useStoreState } from '../../app/store';
import { createBillingApi, type BillingApi, type BillingStatus, type Interval } from './billing';
import { Paywall, type PaywallProps } from './Paywall';
import { PRO_NAME } from './logic';

export function PaywallRoute({ api: given }: { api?: BillingApi } = {}) {
  const tr = useT();
  const navigate = useNavigate();
  const { search } = useLocation();
  const { mode, worldId } = useStoreState();
  const view = useOwnerView();
  const { refresh, toast } = useGame();
  const api = useMemo(() => given ?? createBillingApi({ mode, worldId }), [given, mode, worldId]);
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PaywallProps['result']>(null);
  const confirmed = useRef(false);

  const load = useCallback(async () => {
    const r = await api.status();
    if (r.ok) { setStatus(r.data); setStatusError(null); } else setStatusError(r.error);
  }, [api]);

  useEffect(() => { void load(); }, [load, view?.world.day]);

  // Back from Stripe: /pro?world=…&session_id=cs_test_… or &canceled=1
  useEffect(() => {
    const q = new URLSearchParams(search);
    const sessionId = q.get('session_id');
    if (q.get('canceled')) setResult({ tone: 'warn', text: tr('Checkout was canceled. Nothing was charged; your free plan stays as it was.', 'Оплата отменена. Ничего не списано, бесплатный тариф остался как был.') });
    if (!sessionId || confirmed.current) return;
    confirmed.current = true;
    setBusy(true);
    void api.confirm(sessionId).then((r) => {
      setBusy(false);
      if (!r.ok) { setResult({ tone: 'warn', text: r.error }); return; }
      if (r.data.status) setStatus(r.data.status);
      setResult(r.data.unlocked
        ? { tone: 'profit', text: tr('Payment went through in Stripe test mode. Every control is open again — change your price or staff now.', 'Тестовая оплата Stripe прошла. Все рычаги снова открыты — меняйте цену или штат прямо сейчас.') }
        : { tone: 'warn', text: tr('Stripe has not confirmed the payment yet. Refresh this page in a minute.', 'Stripe ещё не подтвердил оплату. Обновите страницу через минуту.') });
      void refresh();
    });
  }, [search, api, tr, refresh]);

  const onBuy = async (interval: Interval) => {
    setBusy(true);
    setResult(null);
    const r = await api.checkout(interval);
    if (!r.ok) { setBusy(false); setResult({ tone: 'warn', text: r.error }); return; }
    if (r.data.url) { window.location.assign(r.data.url); return; }
    setBusy(false);
    if (r.data.status) setStatus(r.data.status);
    const text = tr('Pro is open (test mode, nothing charged). Every control is back: change your price or staff now.', 'Pro открыт (тестовый режим, ничего не списано). Все рычаги снова ваши: меняйте цену или штат прямо сейчас.');
    setResult({ tone: 'profit', text });
    toast(text, 'success');
    void refresh();
  };

  if (!view) {
    return (
      <main className="screen stack">
        <TopBar title={PRO_NAME} onBack={() => navigate('/')} />
        <Card title={tr('Pro belongs to your cafe', 'Pro привязан к вашей кофейне')} subtitle={tr('Join the city and open a coffee shop: the first full month is free.', 'Войдите в город и откройте кофейню: первый полный месяц — бесплатно.')}>
          <Skeleton height={12} />
          <Button variant="secondary" icon="home" onClick={() => navigate('/')}>{tr('Back to the city', 'В город')}</Button>
        </Card>
      </main>
    );
  }

  return (
    <Paywall
      view={view}
      status={status}
      statusError={statusError}
      busy={busy}
      result={result}
      onBuy={(i) => void onBuy(i)}
      onBack={() => navigate(-1)}
      onManage={() => navigate('/biz/manage')}
      onPlan={() => navigate('/end/plan')}
    />
  );
}
