// Client side of server/src/billing.ts: the plan status, Stripe test checkout and the return from it.
import { getSession, type Mode } from '../../app/session';

export type Stage = 'before_opening' | 'free_month' | 'autopilot' | 'pro' | 'open_world';
export type Interval = 'month' | 'year';

export interface PlanTeaser {
  businessName: string; startupTotal: number; monthlyTotal: number; reserveAdvised: number;
  paybackMonths: number | null; steps: number; stepsWithLinks: number; suppliers: number; lessons: number;
}

/** Same shape as Entitlement + teaser in server/src/billing.ts. */
export interface BillingStatus {
  plan: 'free' | 'pro';
  stage: Stage;
  canManage: boolean;
  freeEndsDay: number | null;
  daysLeft: number | null;
  advisorLeft: number | null;
  pro: { via: 'stripe-test' | 'test-unlock'; interval: Interval; sinceDay: number } | null;
  checkout: 'stripe-test' | 'test-unlock';
  prices: { month: number; year: number | null; currency: 'usd' };
  locked: ('decisions' | 'plan' | 'advisor' | 'niches')[];
  teaser: PlanTeaser | null;
  stripeConfigured: boolean;
}

export interface CheckoutResult { unlocked: boolean; mode: 'test-unlock' | 'stripe-test' | 'already'; url?: string; status?: BillingStatus }

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export interface BillingApi {
  status(): Promise<Result<BillingStatus>>;
  checkout(interval: Interval): Promise<Result<CheckoutResult>>;
  confirm(sessionId: string): Promise<Result<CheckoutResult>>;
}

const NO_SERVER = 'Pro is sold in the online city. Offline practice runs in your browser and is free.';

export function createBillingApi(p: { mode: Mode; worldId: string; base?: string; fetchImpl?: typeof fetch }): BillingApi {
  const base = (p.base ?? import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
  const doFetch = p.fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  const path = `${base}/api/worlds/${encodeURIComponent(p.worldId)}/billing`;

  async function call<T>(method: 'GET' | 'POST', url: string, body?: unknown): Promise<Result<T>> {
    if (p.mode === 'local') return { ok: false, error: NO_SERVER };
    const token = getSession('remote', p.worldId)?.token;
    if (!token) return { ok: false, error: 'Join the city first: Pro belongs to your player in this city.' };
    try {
      const res = await doFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: T; error?: string } | null;
      if (!res.ok || !json || json.ok === false) return { ok: false, error: json?.error ?? `${res.status} ${res.statusText}` };
      return { ok: true, data: json.data as T };
    } catch {
      return { ok: false, error: 'No connection to the city server.' };
    }
  }

  return {
    status: () => call<BillingStatus>('GET', path),
    checkout: (interval) => call<CheckoutResult>('POST', `${path}/checkout`, { interval }),
    confirm: (sessionId) => call<CheckoutResult>('POST', `${path}/confirm`, { sessionId }),
  };
}

/** An action or query refused by the plan: the server answers 402 and names /pro in the error. */
export const isPaywallError = (error: string | undefined | null): boolean => !!error && /\/pro\b/.test(error);
