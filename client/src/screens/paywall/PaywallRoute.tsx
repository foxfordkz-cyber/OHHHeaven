// /pro and the Pro tab of /biz: the plan screen bound to my player in this city.
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Card, TopBar, useT } from '../../ui';
import { useOwnerView } from '../../app/store';
import type { BillingApi } from './billing';
import { Paywall } from './Paywall';
import { PRO_NAME } from './logic';
import { useBilling } from './useBilling';

export function PaywallRoute({ api, embedded }: { api?: BillingApi; embedded?: boolean } = {}) {
  const tr = useT();
  const navigate = useNavigate();
  const { search } = useLocation();
  const view = useOwnerView();
  const b = useBilling({ api, day: view?.world.day });
  const handled = useRef(false);

  // Back from Stripe: /pro?world=…&session_id=cs_test_… or &canceled=1
  useEffect(() => {
    if (handled.current) return;
    const q = new URLSearchParams(search);
    const sessionId = q.get('session_id');
    if (q.get('canceled')) {
      handled.current = true;
      b.setResult({ tone: 'warn', text: tr('Checkout was canceled. Nothing was charged; your free plan stays as it was.', 'Оплата отменена. Ничего не списано, бесплатный тариф остался как был.') });
    }
    if (sessionId) {
      handled.current = true;
      void b.confirm(sessionId);
    }
  }, [search, b, tr]);

  if (!view) {
    return (
      <main className="screen stack">
        {!embedded && <TopBar title={PRO_NAME} onBack={() => navigate('/')} />}
        <Card title={tr('Pro belongs to your cafe', 'Pro привязан к вашей кофейне')} subtitle={tr('Join the city and open a coffee shop: the first full month after you open is free.', 'Войдите в город и откройте кофейню: первый полный месяц после открытия — бесплатно.')}>
          <Button variant="secondary" icon="home" onClick={() => navigate('/')}>{tr('Back to the city', 'В город')}</Button>
        </Card>
      </main>
    );
  }

  return (
    <Paywall
      view={view}
      status={b.status}
      statusError={b.offline ? null : b.error}
      offline={b.offline}
      busy={b.busy}
      result={b.result}
      embedded={embedded}
      onBuy={(i) => void b.buy(i)}
      onBack={() => navigate(-1)}
      onManage={() => navigate('/biz/manage')}
      onPlan={() => navigate('/end/plan')}
    />
  );
}
