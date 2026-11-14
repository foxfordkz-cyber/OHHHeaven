// /pro — First Year Pro: what is free, what is paid, Stripe test checkout. The router finds this module by itself.
import { useMemo } from 'react';
import type { ScreenModule } from '../../app/screens';
import { DevStore } from '../../app/dev';
import { ownerView, ownerViewSetup } from '../../app/fixtures';
import type { OwnerView } from '@ohh/shared/types';
import type { BillingApi, BillingStatus, Stage } from './billing';
import { PaywallRoute } from './PaywallRoute';
import { ProNudge } from './ProNudge';

const TEASER = { businessName: "Maya's Morning Cup", startupTotal: 142_380, monthlyTotal: 31_870, reserveAdvised: 63_740, paybackMonths: 19, steps: 24, stepsWithLinks: 24, suppliers: 9, lessons: 4 };

/** Example statuses for /dev: the same shape the server sends (server/src/billing.ts). */
export function exampleStatus(stage: Stage, over: Partial<BillingStatus> = {}): BillingStatus {
  const pro = stage === 'pro' ? { via: 'test-unlock' as const, interval: 'month' as const, sinceDay: 91 } : null;
  return {
    plan: pro ? 'pro' : 'free', stage, canManage: stage !== 'autopilot', freeEndsDay: stage === 'before_opening' ? null : 90,
    daysLeft: stage === 'free_month' ? 16 : stage === 'before_opening' ? null : 0, advisorLeft: pro ? null : 2, pro,
    checkout: 'test-unlock', prices: { month: 1900, year: null, currency: 'usd' },
    locked: pro ? [] : stage === 'autopilot' ? ['decisions', 'plan', 'niches'] : ['niches'],
    teaser: stage === 'before_opening' ? null : TEASER, stripeConfigured: false, ...over,
  };
}

function exampleApi(initial: BillingStatus): BillingApi {
  let s = initial;
  return {
    status: async () => ({ ok: true, data: s }),
    checkout: async () => {
      s = exampleStatus('pro');
      return { ok: true, data: { unlocked: true, mode: 'test-unlock', status: s } };
    },
    confirm: async () => ({ ok: true, data: { unlocked: true, mode: 'stripe-test', status: s } }),
  };
}

function Dev({ view, status }: { view: OwnerView; status: BillingStatus }) {
  const api = useMemo(() => exampleApi(status), [status]);
  return (
    <DevStore view={view}>
      <PaywallRoute api={api} />
    </DevStore>
  );
}

const later = (v: OwnerView, day: number): OwnerView => ({ ...v, world: { ...v.world, day } });

const NUDGE_APIS = [exampleApi(exampleStatus('free_month')), exampleApi(exampleStatus('autopilot'))];

function DevNudges() {
  return (
    <DevStore view={ownerView}>
      <main className="screen stack">
        {NUDGE_APIS.map((api, i) => <ProNudge key={i} api={api} />)}
      </main>
    </DevStore>
  );
}

export const screen: ScreenModule = {
  routes: [{ path: '/pro', element: <PaywallRoute /> }],
  // after Insights (50): the plan is the last thing on the tab bar, always one tap away
  bizTabs: [{ id: 'pro', label: 'Pro', order: 60, element: <PaywallRoute embedded /> }],
  dev: [
    { id: 'pro', title: 'Pro — free month, 16 days left', render: () => <Dev view={ownerView} status={exampleStatus('free_month')} /> },
    { id: 'pro-autopilot', title: 'Pro — free month over, cafe on autopilot', render: () => <Dev view={later(ownerView, 96)} status={exampleStatus('autopilot', { advisorLeft: 0, locked: ['decisions', 'plan', 'advisor', 'niches'] })} /> },
    { id: 'pro-setup', title: 'Pro — before the doors open', render: () => <Dev view={ownerViewSetup} status={exampleStatus('before_opening')} /> },
    { id: 'pro-paid', title: 'Pro — unlocked', render: () => <Dev view={later(ownerView, 96)} status={exampleStatus('pro')} /> },
    { id: 'pro-nudge', title: 'Pro — nudge cards for Today and the brief', render: () => <DevNudges /> },
  ],
};

export { Paywall } from './Paywall';
export { PaywallRoute } from './PaywallRoute';
export { ProNudge, nudgeFor } from './ProNudge';
export { createBillingApi, isPaywallError } from './billing';
