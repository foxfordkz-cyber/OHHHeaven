import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Action, ClientView } from '@ohh/shared/types';
import { DevStore } from '../../../app/dev';
import { fixtureIdea, fixtureOpenRecommendations, fixturePacks, fixturePlaces, fixtureRoadmapTodo, ownerViewNew, ownerViewSetup } from '../../../app/fixtures';
import { Start } from '../Start';
import { baseChoices, summarize } from './model';

const ANSWERS = { idea: fixtureIdea, roadmap: fixtureRoadmapTodo, recommend_opening: fixtureOpenRecommendations };
const KIT_DRAFT = { step: 'kit' as const, niche: 'cafe' as const, placeId: 'p12', name: 'Jordan’s Coffee', idea: 'coffee', match: fixtureIdea };
const pack = fixturePacks.niches.cafe!;
const place = fixturePlaces.find((p) => p.id === 'p12')!;
const base = summarize(pack, fixturePacks.common, place, baseChoices(pack, place));
const usd = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`;

function renderSetup(onAct: (a: Action, v: ClientView) => ClientView | void = () => undefined) {
  return render(
    <MemoryRouter initialEntries={['/start']}>
      <DevStore view={ownerViewNew} answers={ANSWERS} onAct={onAct}>
        <Start initial={KIT_DRAFT} />
      </DevStore>
    </MemoryRouter>,
  );
}

const next = () => fireEvent.click(screen.getByRole('button', { name: /^(Next|See what it adds up to)/ }));

beforeEach(() => sessionStorage.clear());
afterEach(cleanup);

describe('opening decisions screen', () => {
  it('starts from the least the law allows: nothing is chosen for the player', async () => {
    renderSetup();
    expect((await screen.findByTestId('dx-cash')).textContent).toBe(usd(base.cashLeft));
    expect(screen.getByTestId('dx-monthly').textContent).toBe(usd(base.monthly));
    expect(screen.getByTestId('dx-progress').textContent).toContain('Decision 1 of 7');
    expect(screen.getByText('How many seats?')).toBeTruthy();
    next();
    // an option card: no radio is ticked and the way forward is closed until the player picks one
    const radios = screen.getAllByRole('radio');
    expect(radios.every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true);
    expect(screen.getByRole('button', { name: 'Choose one to go on' }).hasAttribute('disabled')).toBe(true);
  });

  it('a choice moves the numbers on top at once and says by how much', async () => {
    renderSetup();
    await screen.findByTestId('dx-cash');
    next();
    fireEvent.click(screen.getByRole('radio', { name: /Used espresso machine/ }));
    expect(screen.getByTestId('dx-cash').textContent).toBe(usd(base.cashLeft - 6_500));
    expect(screen.getByTestId('dx-delta-cash').textContent).toBe('−$6,500');
    expect(screen.getByRole('radio', { name: /Used espresso machine/ }).getAttribute('aria-checked')).toBe('true');
  });

  it('more seats cost furniture now; more people cost wages every month', async () => {
    renderSetup();
    await screen.findByTestId('dx-cash');
    fireEvent.click(screen.getByRole('button', { name: 'Increase seats' }));
    expect(screen.getByTestId('dx-size').textContent).toBe(String(pack.sizing.min + 1));
    fireEvent.click(screen.getByRole('button', { name: /4\. Team/ }));
    expect(screen.getByText('Who stands behind the counter?')).toBeTruthy();
    const before = screen.getByTestId('dx-monthly').textContent;
    fireEvent.click(screen.getByRole('button', { name: 'Increase Barista' }));
    expect(screen.getByTestId('dx-monthly').textContent).not.toBe(before);
    expect(screen.getByTestId('dx-delta-monthly').textContent).toBe('+$2,720');
  });

  it('marks the option that breaks the law with the real fine', async () => {
    renderSetup();
    await screen.findByTestId('dx-cash');
    fireEvent.click(screen.getByRole('button', { name: /5\. Cleaning/ }));
    const basic = screen.getByRole('radio', { name: /Basic/ });
    expect(within(basic).getByText(/Breaks the law/).textContent).toContain('$300');
    expect(within(screen.getByRole('radio', { name: /Standard/ })).getByText('Recommended')).toBeTruthy();
  });

  it('own choices all the way: the lease carries the items, the standing orders carry team, settings and price', async () => {
    const onAct = vi.fn((a: Action, _v: ClientView) => (a.type === 'open_business' ? ownerViewSetup : undefined));
    renderSetup(onAct);
    await screen.findByTestId('dx-cash');
    fireEvent.click(screen.getByRole('button', { name: 'Increase seats' }));          // 1. seats: one more than the minimum
    next();
    fireEvent.click(screen.getByRole('radio', { name: /Used espresso machine/ }));    // 2. buy the used machine
    next();
    fireEvent.click(screen.getByRole('radio', { name: /Table and chair/ }));          // 3. furniture
    next();
    fireEvent.click(screen.getByRole('button', { name: 'Increase Barista' }));        // 4. team: 2 baristas
    next();
    fireEvent.click(screen.getByRole('radio', { name: /Deep weekly/ }));              // 5. cleaning
    next();
    fireEvent.click(screen.getByRole('radio', { name: /Social media/ }));             // 6. marketing
    next();
    next();                                                                           // 7. price: keep
    expect(screen.getByTestId('dx-verdict').textContent).toMatch(/^You open .* with \$/);
    expect(screen.getByText('Where the money goes')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Sign the lease and pay/ }));
    await waitFor(() => expect(onAct).toHaveBeenCalledTimes(2));
    const size = pack.sizing.min + 1;
    const open = onAct.mock.calls[0][0] as Extract<Action, { type: 'open_business' }>;
    expect(open).toMatchObject({ type: 'open_business', niche: 'cafe', placeId: 'p12', size, name: 'Jordan’s Coffee' });
    expect(open.items).toContainEqual({ id: 'espresso_machine_used', qty: 1 });
    expect(open.items).toContainEqual({ id: 'seating', qty: size });
    expect(onAct.mock.calls[1][0]).toMatchObject({ type: 'set_orders', orders: { staff: { barista: 2, shift_lead: 0 }, levers: { cleaning: 'deep', marketing: 'social' }, price: pack.unit.refPrice } });
  });

  it('"Use recommended for all" is a separate button: it fills every decision and shows the result', async () => {
    const onAct = vi.fn((a: Action, _v: ClientView) => (a.type === 'open_business' ? ownerViewSetup : undefined));
    renderSetup(onAct);
    await screen.findByTestId('dx-cash');
    fireEvent.click(screen.getByRole('button', { name: 'Use recommended for all' }));
    expect(screen.getByText('What you decided')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Sign the lease and pay/ }));
    await waitFor(() => expect(onAct).toHaveBeenCalledTimes(2));
    const open = onAct.mock.calls[0][0] as Extract<Action, { type: 'open_business' }>;
    const rec = fixtureOpenRecommendations[0];
    const expected = new Set([...rec.items.map((i) => i.id), ...pack.setup.filter((s) => s.required).map((s) => s.id)]);
    expect(open.size).toBe(rec.size);
    expect(open.items?.map((i) => i.id).sort()).toEqual([...expected].sort());
    expect(onAct.mock.calls[1][0]).toMatchObject({ type: 'set_orders', orders: { staff: rec.orders.staff } });
  });

  it('keeps the decisions through a reload', async () => {
    const first = renderSetup();
    await screen.findByTestId('dx-cash');
    next();
    fireEvent.click(screen.getByRole('radio', { name: /Used espresso machine/ }));
    first.unmount();
    render(
      <MemoryRouter initialEntries={['/start']}>
        <DevStore view={ownerViewNew} answers={ANSWERS}>
          <Start />
        </DevStore>
      </MemoryRouter>,
    );
    expect((await screen.findByTestId('dx-cash')).textContent).toBe(usd(base.cashLeft - 6_500));
    expect(screen.getByRole('radio', { name: /Used espresso machine/ }).getAttribute('aria-checked')).toBe('true');
  });
});
