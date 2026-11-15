import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { RealWorldPlan } from '@ohh/shared/types';
import { PLAN } from '../insights/fixtures';
import { PlanTeaser } from './PlanTeaser';
import { personalOf, progressKey, saveProgress } from './personal';
import sample from './plan.sample.json';

const real = sample as unknown as RealWorldPlan;
const me = personalOf(real)!;
const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('the card that leads to the plan', () => {
  it('shows this player’s money before the first sale and the next real-life step', async () => {
    saveProgress(progressKey(real, me), { done: [real.checklist[0].id] });
    render(<MemoryRouter><PlanTeaser ask={async () => ({ ok: true, data: real })} href="/end/plan" /></MemoryRouter>);
    expect(await screen.findByText(new RegExp(`You need \\${usd(me.summary.cashBeforeFirstSale)} before your first sale`))).toBeTruthy();
    const next = await screen.findByTestId('plan-teaser-next');
    expect(next.textContent).toContain(real.checklist[1].title);
    expect(next.textContent).toContain(`(1/${real.checklist.length} done)`);
  });

  it('falls back to the general line for a plan without the personal part', async () => {
    render(<MemoryRouter><PlanTeaser ask={async () => ({ ok: true, data: PLAN })} href="/end/plan" /></MemoryRouter>);
    expect(await screen.findByText(/Budget, documents in order/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open my plan' })).toBeTruthy();
  });
});
