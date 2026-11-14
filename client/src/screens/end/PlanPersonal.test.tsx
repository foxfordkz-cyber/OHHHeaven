import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { RealWorldPlan } from '@ohh/shared/types';
import { RULE_CARDS } from '../insights/fixtures';
import { PlanView } from './PlanScreen';
import { personalOf } from './personal';
import sample from './plan.sample.json';

const plan = sample as unknown as RealWorldPlan;
const me = personalOf(plan)!;
const cards = new Map(RULE_CARDS.map((c) => [c.id, c]));
const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const verdict = () => document.querySelector('.plan-check__verdict')!;

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('real-world plan of this player (a real engine plan)', () => {
  it('opens with the money before the first sale, the weeks and the reserve, from this season', () => {
    render(<PlanView plan={plan} cards={cards} />);
    expect(screen.getByRole('heading', { name: 'Before your first sale' })).toBeTruthy();
    expect(screen.getByTestId('cash-before').textContent).toBe(usd(me.summary.cashBeforeFirstSale));
    expect(screen.getByText(`${me.summary.weeksToOpen} weeks`)).toBeTruthy();
    for (const p of me.summary.parts) expect(screen.getAllByText(p.label).length).toBeGreaterThan(0);
    expect(document.querySelector('.plan-header')!.textContent).toContain(me.place!.address);
  });

  it('says this address, rent, deposit and build-out instead of the generic room', () => {
    render(<PlanView plan={plan} cards={cards} />);
    const place = screen.getByRole('heading', { name: 'Your place' }).closest('section')!;
    expect(within(place).getByText(`${usd(me.place!.rentMonth)} a month`)).toBeTruthy();
    expect(within(place).getByText(usd(me.place!.deposit!))).toBeTruthy();
    expect(within(place).getByText(me.place!.buildout!.label)).toBeTruthy();
    const team = screen.getByRole('heading', { name: 'Your team and your kit' }).closest('section')!;
    expect(within(team).getByText(usd(me.payrollMonth + me.payrollTaxMonth))).toBeTruthy();
  });

  it('the decision: savings and months of reserve change the verdict at once', () => {
    render(<PlanView plan={plan} cards={cards} />);
    const input = screen.getByLabelText('Your savings for the business');
    fireEvent.change(input, { target: { value: '50k' } });
    expect(verdict().getAttribute('data-verdict')).toBe('short');
    expect(verdict().textContent).toMatch(/run out before the first sale/);
    fireEvent.change(input, { target: { value: String(Math.ceil(me.summary.totalNeeded) + 1000) } });
    expect(verdict().getAttribute('data-verdict')).toBe('ready');
    fireEvent.click(screen.getByRole('button', { name: '9' }));
    expect(verdict().getAttribute('data-verdict')).toBe('thin');
  });

  it('the reason to come back: ticking a real-life step moves the next step and is kept on this device', () => {
    const { unmount } = render(<PlanView plan={plan} cards={cards} />);
    expect(screen.getByText(`Next: ${plan.checklist[0].title}`, { exact: false })).toBeTruthy();
    fireEvent.click(screen.getAllByRole('checkbox', { name: /Done in real life/ })[0]);
    expect(screen.getByText(`Next: ${plan.checklist[1].title}`, { exact: false })).toBeTruthy();
    expect(screen.getByText(`Real life: 1 of ${plan.checklist.length} steps done`)).toBeTruthy();
    unmount();
    render(<PlanView plan={plan} cards={cards} />);
    expect(screen.getByText(`Real life: 1 of ${plan.checklist.length} steps done`)).toBeTruthy();
  });

  it('every step has its status in the season and an official page, or says it has none', () => {
    const { container } = render(<PlanView plan={plan} cards={cards} />);
    const steps = [...container.querySelectorAll('.plan-step')];
    expect(steps).toHaveLength(plan.checklist.length);
    for (const s of steps) expect(!!s.querySelector('.plan-link') || !!s.textContent?.includes('No official page in our data yet')).toBe(true);
    expect(container.querySelectorAll('.plan-status').length).toBe(plan.checklist.filter((s) => me.steps[s.id]).length);
    const lease = plan.checklist.find((s) => s.kind === 'space' && !s.setupItemId)!;
    expect(steps[plan.checklist.indexOf(lease)].textContent).toContain(me.steps[lease.id].mine!);
  });

  it('puts the suppliers this player needs first, each with the reason', () => {
    const { container } = render(<PlanView plan={plan} cards={cards} />);
    const rows = [...container.querySelectorAll('.plan-supplier')];
    const firstPlain = rows.findIndex((r) => !r.hasAttribute('data-mine'));
    expect(firstPlain).toBeGreaterThan(0);
    if (firstPlain > 0) expect(rows.slice(firstPlain).every((r) => !r.hasAttribute('data-mine'))).toBe(true);
    expect(rows[0].textContent).toContain('For you:');
  });

  it('three risks of this place, the costliest first', () => {
    render(<PlanView plan={plan} cards={cards} />);
    const risks = screen.getByRole('heading', { name: /risks? of this place/ }).closest('section')!;
    expect(within(risks).getAllByRole('listitem')).toHaveLength(me.risks.length);
    expect(within(risks).getByText(me.risks[0].title)).toBeTruthy();
  });
});
