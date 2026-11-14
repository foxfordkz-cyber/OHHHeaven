import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { OwnerView } from '@ohh/shared/types';
import { DevStore } from '../../app/dev';
import { ownerView, ownerViewSetup } from '../../app/fixtures';
import { createBillingApi, isPaywallError, type BillingApi, type BillingStatus } from './billing';
import { exampleStatus } from './index';
import { compareRows, heroFor, monthsLeft, nextReport, priceLabel, rivalAbove } from './logic';
import { nudgeFor } from './ProNudge';
import { PaywallRoute } from './PaywallRoute';

afterEach(cleanup);
const en = (e: string) => e;
const at = (v: OwnerView, day: number, msToNextDay = 1_000): OwnerView => ({ ...v, world: { ...v.world, day, msToNextDay } });

describe('what the plan screen says', () => {
  it('counts the months left and the time to the next report in this city', () => {
    const v = at(ownerView, 74, 1_500);
    expect(monthsLeft(v)).toBe(v.world.config.seasonMonths - 2);
    const r = nextReport(v);
    expect(r).toMatchObject({ day: 90, inDays: 16 });
    expect(r.ms).toBe(1_500 + 15 * v.world.config.dayMs);
    expect(nextReport(at(ownerView, 90)).inDays).toBe(0);
  });

  it('names the rival right above me and the gap', () => {
    const r = rivalAbove(ownerView);
    expect(r?.me.businessId).toBe(ownerView.business!.id);
    if (r?.above) {
      expect(r.above.rank).toBe(r.me.rank - 1);
      expect(r.gap).toBeGreaterThanOrEqual(0);
      expect(r.above.name).toBeTruthy();
    }
  });

  it('marks what is closed for this player now', () => {
    const free = compareRows(en, exampleStatus('free_month'), 10);
    expect(free.find((r) => r.id === 'year')).toMatchObject({ lockedNow: true, pro: '10 months' });
    expect(free.find((r) => r.id === 'plan')?.lockedNow).toBe(false);
    const auto = compareRows(en, exampleStatus('autopilot'), 9);
    expect(auto.find((r) => r.id === 'plan')?.lockedNow).toBe(true);
    const pro = compareRows(en, exampleStatus('pro'), 9);
    expect(pro.every((r) => !r.lockedNow)).toBe(true);
  });

  it('puts the stakes in the headline: days left, the orders that will freeze, autopilot', () => {
    const s = exampleStatus('free_month');
    const h = heroFor('free_month', s, ownerView, en);
    expect(h.title).toBe('Free month: 16 days left');
    expect(h.text).toContain('day 90');
    expect(h.text).toContain('$6.40');
    expect(heroFor('autopilot', exampleStatus('autopilot'), ownerView, en).title).toBe('Your cafe is on autopilot');
    expect(heroFor('free_month', null, ownerView, en).title).not.toContain('undefined');
    expect(priceLabel(1900, 'month', en)).toBe('$19 / month');
    expect(priceLabel(15_000, 'year', en)).toBe('$150 / year');
  });

  it('nudges only when there is something to decide', () => {
    expect(nudgeFor(exampleStatus('pro'), en)).toBeNull();
    expect(nudgeFor(exampleStatus('before_opening'), en)).toBeNull();
    expect(nudgeFor(exampleStatus('free_month', { daysLeft: 25 }), en)).toBeNull();
    expect(nudgeFor(exampleStatus('free_month'), en)?.title).toBe('Free month: 16 days left');
    expect(nudgeFor(exampleStatus('autopilot'), en)?.cta).toBe('Get Pro — $19 / month');
    expect(isPaywallError('Your free month ended on day 90 … on /pro.')).toBe(true);
    expect(isPaywallError('Not enough cash')).toBe(false);
  });
});

function fakeApi(start: BillingStatus): BillingApi & { bought: number } {
  let s = start;
  const api = {
    bought: 0,
    status: async () => ({ ok: true as const, data: s }),
    checkout: async () => {
      api.bought += 1;
      s = exampleStatus('pro');
      return { ok: true as const, data: { unlocked: true, mode: 'test-unlock' as const, status: s } };
    },
    confirm: async () => ({ ok: true as const, data: { unlocked: true, mode: 'stripe-test' as const, status: exampleStatus('pro', { pro: { via: 'stripe-test', interval: 'month', sinceDay: 96 } }) } }),
  };
  return api;
}

function show(view: OwnerView, api: BillingApi, url = '/pro') {
  render(
    <MemoryRouter initialEntries={[url]}>
      <DevStore view={view}>
        <PaywallRoute api={api} />
      </DevStore>
    </MemoryRouter>,
  );
}

describe('/pro', () => {
  it('autopilot → one decision → the controls are back, said in words', async () => {
    const api = fakeApi(exampleStatus('autopilot'));
    show(at(ownerView, 96), api);
    await screen.findByText('Your cafe is on autopilot');
    expect(screen.getByText(/Test mode: this server takes no payments/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Get Pro — \$19 \/ month/ }));
    await screen.findByText(/Pro is open\. Every control is back/);
    expect(api.bought).toBe(1);
    expect(screen.getByRole('button', { name: /Open Manage/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Get Pro/ })).toBeNull();
  });

  it('shows the player their own plan numbers before they pay', async () => {
    show(ownerView, fakeApi(exampleStatus('free_month')));
    await screen.findByText('Your personal plan, from your game');
    expect(screen.getByText('$142,380')).toBeTruthy();
    expect(screen.getByText(/24 permit and setup steps/)).toBeTruthy();
  });

  it('before opening: the free month has not started, nothing to buy yet but the offer is visible', async () => {
    show(ownerViewSetup, fakeApi(exampleStatus('before_opening')));
    await screen.findByText('Your first month is free');
    expect(screen.getByRole('button', { name: /Get Pro/ })).toBeTruthy();
  });

  it('back from Stripe: the session is checked with the server', async () => {
    const api = fakeApi(exampleStatus('autopilot'));
    const confirm = vi.spyOn(api, 'confirm');
    show(at(ownerView, 96), api, '/pro?world=demo&session_id=cs_test_abc');
    await screen.findByText(/Paid with a Stripe test card: no real money moved/);
    expect(confirm).toHaveBeenCalledWith('cs_test_abc');
  });

  it('a canceled checkout says nothing was charged', async () => {
    show(at(ownerView, 96), fakeApi(exampleStatus('autopilot')), '/pro?world=demo&canceled=1');
    await screen.findByText(/Checkout was canceled\. Nothing was charged/);
  });
});

describe('billing api', () => {
  it('offline practice sells nothing; without a session it asks to join', async () => {
    const local = createBillingApi({ mode: 'local', worldId: 'demo' });
    expect((await local.status()).ok).toBe(false);
    const fetchImpl = vi.fn();
    const remote = createBillingApi({ mode: 'remote', worldId: 'nobody-here', fetchImpl: fetchImpl as unknown as typeof fetch });
    const r = await remote.status();
    expect(r.ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('sends the token and passes the server error through', async () => {
    localStorage.setItem('ohh.sessions.v1', JSON.stringify({ 'remote:w1': { worldId: 'w1', playerId: 'p1', token: 'tok', name: 'A', kind: 'owner' } }));
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: false, error: 'Stripe test checkout is not available right now' }), { status: 502 }));
    const api = createBillingApi({ mode: 'remote', worldId: 'w1', base: '', fetchImpl: fetchImpl as unknown as typeof fetch });
    const r = await api.checkout('month');
    expect(r).toEqual({ ok: false, error: 'Stripe test checkout is not available right now' });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/worlds/w1/billing/checkout');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    localStorage.clear();
  });
});

describe('the Pro tab waits for the status before it shows numbers', () => {
  it('never prints "undefined"', async () => {
    show(ownerView, fakeApi(exampleStatus('free_month')));
    await waitFor(() => expect(document.body.textContent).toContain('16 days left'));
    expect(document.body.textContent).not.toContain('undefined');
  });
});
