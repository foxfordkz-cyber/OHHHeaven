// Live forecast: one what_if query after the player stops changing settings for 400 ms.
import { useEffect, useRef, useState } from 'react';
import type { Ack, Analytics, MonthReport, Query, StandingOrders } from '@ohh/shared/types';

export interface WhatIf { projected: MonthReport; analytics: Analytics }
export interface WhatIfState { status: 'idle' | 'loading' | 'ok' | 'error'; data: WhatIf | null; error?: string; forKey: string | null }

export const WHAT_IF_DELAY_MS = 400;

export function useWhatIf(
  query: <T>(q: Query) => Promise<Ack<T>>,
  orders: Partial<StandingOrders>,
  enabled = true,
  delayMs = WHAT_IF_DELAY_MS,
): WhatIfState {
  const key = JSON.stringify(orders);
  const [state, setState] = useState<WhatIfState>({ status: 'idle', data: null, forKey: null });
  const seq = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const mine = ++seq.current;
    setState((s) => ({ ...s, status: 'loading' }));
    const t = setTimeout(() => {
      query<WhatIf>({ type: 'what_if', orders: JSON.parse(key) as Partial<StandingOrders> })
        .then((ack) => {
          if (mine !== seq.current) return;
          if (ack.ok && ack.data) setState({ status: 'ok', data: ack.data, forKey: key });
          else setState((s) => ({ ...s, status: 'error', error: ack.error ?? 'No forecast', forKey: key }));
        })
        .catch((e: unknown) => {
          if (mine !== seq.current) return;
          setState((s) => ({ ...s, status: 'error', error: e instanceof Error ? e.message : 'Connection lost', forKey: key }));
        });
    }, delayMs);
    return () => clearTimeout(t);
    // query is stable for a mounted screen; the key carries the orders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, delayMs]);

  return state;
}
