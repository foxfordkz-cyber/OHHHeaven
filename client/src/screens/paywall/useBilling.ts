// One hook for the /pro page, the Pro tab and the nudge card: status, buying, the return from Stripe.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGame, useStoreState } from '../../app/store';
import { useT } from '../../ui';
import { createBillingApi, type BillingApi, type BillingStatus, type Interval } from './billing';

export interface BillingState {
  status: BillingStatus | null;
  error: string | null;
  busy: boolean;
  result: { tone: 'profit' | 'warn'; text: string } | null;
  buy(interval: Interval): Promise<void>;
  confirm(sessionId: string): Promise<void>;
  setResult(r: BillingState['result']): void;
  /** offline practice: no server, nothing is sold, everything is open */
  offline: boolean;
}

/** Status for offline practice: the server sells Pro, the browser game has no limits. */
export function offlineStatus(): BillingStatus {
  return {
    plan: 'free', stage: 'open_world', canManage: true, freeEndsDay: null, daysLeft: null, advisorLeft: null, pro: null,
    checkout: 'test-unlock', prices: { month: 1900, year: null, currency: 'usd' }, locked: [], teaser: null, stripeConfigured: false,
  };
}

export function useBilling(opts: { api?: BillingApi; day?: number } = {}): BillingState {
  const tr = useT();
  const { mode, worldId, fixture } = useStoreState();
  const { refresh } = useGame();
  const offline = !opts.api && (mode === 'local' || fixture);
  const api = useMemo(() => opts.api ?? createBillingApi({ mode, worldId }), [opts.api, mode, worldId]);
  const [status, setStatus] = useState<BillingStatus | null>(offline ? offlineStatus() : null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BillingState['result']>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true; // StrictMode mounts twice: the second mount must switch it back on
    return () => { alive.current = false; };
  }, []);

  const load = useCallback(async () => {
    if (offline) return;
    const r = await api.status();
    if (!alive.current) return;
    if (r.ok) { setStatus(r.data); setError(null); } else setError(r.error);
  }, [api, offline]);

  // the plan changes with the game day (free month runs out), so reload when the day moves
  useEffect(() => { void load(); }, [load, opts.day]);

  const unlockedText = tr(
    'Pro is open. Every control is back: change your price or staff now and watch the forecast.',
    'Pro открыт. Все рычаги снова ваши: меняйте цену или штат и смотрите прогноз.',
  );

  const buy = useCallback(async (interval: Interval) => {
    setBusy(true);
    setResult(null);
    const r = await api.checkout(interval);
    if (!alive.current) return;
    if (!r.ok) { setBusy(false); setResult({ tone: 'warn', text: r.error }); return; }
    if (r.data.url) { window.location.assign(r.data.url); return; }
    setBusy(false);
    if (r.data.status) setStatus(r.data.status);
    const text = r.data.mode === 'test-unlock' ? `${unlockedText} ${tr('(Test mode: nothing was charged.)', '(Тестовый режим: ничего не списано.)')}` : unlockedText;
    setResult({ tone: 'profit', text });
    void refresh();
  }, [api, refresh, tr, unlockedText]);

  const confirm = useCallback(async (sessionId: string) => {
    setBusy(true);
    const r = await api.confirm(sessionId);
    if (!alive.current) return;
    setBusy(false);
    if (!r.ok) { setResult({ tone: 'warn', text: r.error }); return; }
    if (r.data.status) setStatus(r.data.status);
    setResult(r.data.unlocked
      ? { tone: 'profit', text: `${unlockedText} ${tr('(Paid with a Stripe test card: no real money moved.)', '(Оплачено тестовой картой Stripe: настоящие деньги не списаны.)')}` }
      : { tone: 'warn', text: tr('Stripe has not confirmed the payment yet. Refresh this page in a minute.', 'Stripe ещё не подтвердил оплату. Обновите страницу через минуту.') });
    void refresh();
  }, [api, refresh, tr, unlockedText]);

  return { status, error, busy, result, buy, confirm, setResult, offline };
}
