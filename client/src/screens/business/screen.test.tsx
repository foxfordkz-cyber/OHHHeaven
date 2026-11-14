import { act as rtlAct, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Ack, Action, OwnerView, Query } from '@ohh/shared/types';
import { cafePack, commonPack } from './__stubs__/cafePack';
import { fakeWhatIf } from './__stubs__/fakeDeps';
import { BusinessScreen } from './BusinessScreen';
import type { BizDeps } from './deps';
import { DevBiz } from './DevBiz';
import { fixture, FIXTURE_NAMES, type FixtureName } from './fixtures';
import { topRecommendations } from './today';
import { useWhatIf } from './useWhatIf';

function makeDeps(view: OwnerView, over: Partial<BizDeps> = {}) {
  const sent: Action[] = [];
  const queries: Query[] = [];
  const deps: BizDeps = {
    view, pack: cafePack, common: commonPack, online: true,
    act: vi.fn(async (a: Action): Promise<Ack> => { sent.push(a); return { ok: true }; }),
    query: vi.fn(async <T,>(q: Query): Promise<Ack<T>> => {
      queries.push(q);
      if (q.type !== 'what_if') return { ok: false, error: 'no' };
      const data = fakeWhatIf(view, cafePack, commonPack, q.orders);
      return data ? { ok: true, data: data as T } : { ok: false, error: 'no forecast' };
    }) as BizDeps['query'],
    navigate: vi.fn(),
    ...over,
  };
  return { deps, sent, queries };
}

const EXPECT: Record<FixtureName, RegExp> = {
  open: /What to change/,
  away: /6 days passed/,
  notice: /Pay \$1,200/,
  setup: /Not open yet/,
  closed: /Closed until/,
  bankrupt: /went bankrupt/,
  none: /don't run a business yet/,
};

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('/biz renders every state from samples', () => {
  for (const name of FIXTURE_NAMES) {
    it(name, () => {
      const { deps } = makeDeps(fixture(name));
      render(<BusinessScreen deps={deps} />);
      expect(screen.getAllByText(EXPECT[name]).length).toBeGreaterThan(0);
    });
  }

  it('header: name, status, cash and place in the niche', () => {
    render(<BusinessScreen deps={makeDeps(fixture('open')).deps} />);
    expect(screen.getByRole('heading', { name: 'Bean There' })).toBeTruthy();
    expect(screen.getByText('Open')).toBeTruthy();
    expect(screen.getByLabelText('Rank in niche').textContent).toBe('#4 of 23 coffee shops');
  });

  it('/dev/biz opens without a server and switches states', () => {
    render(<DevBiz initial="open" />);
    expect(screen.getByText('/dev/biz')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Bankrupt' }));
    expect(screen.getByText(/went bankrupt/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Setup' }));
    expect(screen.getByText('Not open yet')).toBeTruthy();
  });
});

describe('main scenario: look at what happened, apply the advice', () => {
  it('away card → Got it sends read_inbox; Apply all sends every suggestion', async () => {
    const view = fixture('away');
    const { deps, sent } = makeDeps(view);
    render(<BusinessScreen deps={deps} />);
    fireEvent.click(within(screen.getByRole('dialog', { name: 'While you were away' })).getByRole('button', { name: 'Got it' })); // tap 1
    expect(sent[0]).toEqual({ type: 'read_inbox', ids: view.away!.items.map((i) => i.id) });
    const real = screen.queryByText(/Real rule/);
    if (real) fireEvent.click(within(real.closest('section')!).getByRole('button', { name: 'Got it' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply all' }));                  // tap 2
    const expected = topRecommendations(view.recommendations).map((r) => r.suggested);
    await waitFor(() => expect(sent.slice(1)).toEqual(expected));
    await screen.findAllByText(/Applied ✓/);
  });

  it('Apply sends exactly the suggested action of that card', async () => {
    const view = fixture('open');
    const { deps, sent } = makeDeps(view);
    render(<BusinessScreen deps={deps} />);
    const top = topRecommendations(view.recommendations);
    fireEvent.click(screen.getAllByRole('button', { name: 'Apply' })[1]);
    await waitFor(() => expect(sent).toEqual([top[1].suggested]));
  });
});

describe('Manage → Save settings', () => {
  it('price + staff + shortcut make one set_orders', async () => {
    const { deps, sent } = makeDeps(fixture('open'));
    render(<BusinessScreen deps={deps} initialTab="manage" />);
    fireEvent.click(screen.getByRole('button', { name: 'More price' }));
    fireEvent.click(screen.getByRole('button', { name: 'More Barista' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Pay staff in cash, off the books' }));
    expect(screen.getByText(/3 changes/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() => expect(sent).toEqual([{ type: 'set_orders', orders: { price: 6.6, staff: { barista: 4, shift_lead: 1 }, shortcuts: [] } }]));
    await screen.findByText(/your business runs on the new settings/);
  });

  it('offline: banner, Save waits, the draft survives a remount', () => {
    const view = fixture('open');
    const { deps } = makeDeps(view, { online: false });
    const { unmount } = render(<BusinessScreen deps={deps} initialTab="manage" />);
    expect(screen.getByText(/Connection lost/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'More price' }));
    expect((screen.getByRole('button', { name: 'Waiting for connection…' }) as HTMLButtonElement).disabled).toBe(true);
    unmount();
    render(<BusinessScreen deps={makeDeps(view).deps} initialTab="manage" />);
    expect(screen.getByText('$6.60')).toBeTruthy();
  });

  it('forecast shows numbers from what_if', async () => {
    const { deps } = makeDeps(fixture('open'));
    render(<BusinessScreen deps={deps} initialTab="manage" />);
    await screen.findByText(/cash on Apr 30/);
  });
});

describe('what_if is asked at most once per 400 ms', () => {
  it('rapid changes → one query with the last orders', async () => {
    vi.useFakeTimers();
    const query = vi.fn(async () => ({ ok: true, data: undefined })) as unknown as BizDeps['query'];
    const { rerender } = renderHook(({ price }) => useWhatIf(query, { price }), { initialProps: { price: 6.6 } });
    for (const price of [6.7, 6.8, 6.9]) {
      await rtlAct(async () => { vi.advanceTimersByTime(150); });
      rerender({ price });
    }
    expect(query).not.toHaveBeenCalled();
    await rtlAct(async () => { vi.advanceTimersByTime(400); });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith({ type: 'what_if', orders: { price: 6.9 } });
  });
});

describe('fine notice', () => {
  it('Pay and Contest send answer_notice', async () => {
    const { deps, sent } = makeDeps(fixture('notice'));
    render(<BusinessScreen deps={deps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pay $1,200' }));
    await waitFor(() => expect(sent).toEqual([{ type: 'answer_notice', caseId: 'case_17', response: 'pay' }]));
    expect(screen.getByRole('button', { name: 'Contest — lawyer $1,500, fine −30%' })).toBeTruthy();
  });

  it('a bribe needs an amount and comes with a warning', async () => {
    const { deps, sent } = makeDeps(fixture('notice'));
    render(<BusinessScreen deps={deps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Offer a bribe…' }));
    expect(screen.getByText(/This is a crime in real life/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Amount, $'), { target: { value: '300' } });
    fireEvent.click(screen.getByRole('button', { name: 'Offer $300' }));
    await waitFor(() => expect(sent).toEqual([{ type: 'answer_notice', caseId: 'case_17', response: 'bribe', bribeAmount: 300 }]));
  });

  it('outcome is its own card', () => {
    render(<BusinessScreen deps={makeDeps(fixture('closed')).deps} />);
    expect(screen.getByText('Fine paid: $1,200')).toBeTruthy();
  });

  it('Real rule card shows once', () => {
    const { deps } = makeDeps(fixture('notice'));
    const { unmount } = render(<BusinessScreen deps={deps} />);
    const card = screen.getByText(/Real rule/).closest('section')!;
    fireEvent.click(within(card).getByRole('button', { name: 'Got it' }));
    expect(screen.queryByText(/Real rule · Food-contact surfaces/)).toBeNull();
    unmount();
    render(<BusinessScreen deps={makeDeps(fixture('notice')).deps} />);
    expect(screen.queryByText(/Real rule · Food-contact surfaces/)).toBeNull();
  });
});

describe('Books', () => {
  it('month-to-date groups and the cash change', () => {
    const view = fixture('open');
    render(<BusinessScreen deps={makeDeps(view).deps} initialTab="books" />);
    expect(screen.getAllByText('Cash change').length).toBeGreaterThan(0);
    expect(screen.getByText('Taxes you owe')).toBeTruthy();
    expect(screen.getByText(/Every dollar accounted for/)).toBeTruthy();
  });

  it('a tax shortfall is shown big', () => {
    const view = fixture('open');
    const poor: OwnerView = { ...view, business: { ...view.business!, cash: 200 } };
    render(<BusinessScreen deps={makeDeps(poor).deps} initialTab="books" />);
    expect(screen.getByRole('alert').textContent).toMatch(/short/);
  });
});

describe('setup and bankruptcy', () => {
  it('opening before the permit asks for confirmation', async () => {
    const { deps, sent } = makeDeps(fixture('setup'));
    render(<BusinessScreen deps={deps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open the doors' }));
    expect(sent).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Open anyway' }));
    await waitFor(() => expect(sent).toEqual([{ type: 'launch' }]));
  });

  it('bankrupt: see what went wrong and watch the city', () => {
    const { deps } = makeDeps(fixture('bankrupt'));
    render(<BusinessScreen deps={deps} />);
    fireEvent.click(screen.getByRole('button', { name: 'See what went wrong' }));
    fireEvent.click(screen.getByRole('button', { name: 'Watch the city' }));
    expect(deps.navigate).toHaveBeenCalledWith('/end');
    expect(deps.navigate).toHaveBeenCalledWith('/');
  });
});
