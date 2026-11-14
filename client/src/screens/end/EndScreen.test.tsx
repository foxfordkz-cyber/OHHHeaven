import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { cafeEndedView, DEBRIEF, RULE_CARDS } from '../insights/fixtures';
import { EndScreen } from './EndScreen';

afterEach(cleanup);
const ask = async () => DEBRIEF;

describe('end of season', () => {
  it('shows the place in the niche and the final payout in test money', async () => {
    render(<MemoryRouter><EndScreen view={cafeEndedView} ask={ask} cards={RULE_CARDS} /></MemoryRouter>);
    expect(screen.getByLabelText('Place 2')).toBeTruthy();
    expect(screen.getByText('of 18 coffee shops')).toBeTruthy();
    const hero = screen.getByLabelText('Place 2').closest('section')!;
    expect(within(hero).getByText('$16.20')).toBeTruthy();
    expect(within(hero).getByText(/in test money/)).toBeTruthy();
  });
  it('the debrief lists three losses with amounts, lessons and the real rule', async () => {
    render(<MemoryRouter><EndScreen view={cafeEndedView} ask={ask} cards={RULE_CARDS} /></MemoryRouter>);
    expect(await screen.findByText('Rent above the norm')).toBeTruthy();
    expect(screen.getByText('Customers you turned away')).toBeTruthy();
    expect(screen.getByText('Cash wages caught by the tax auditor')).toBeTruthy();
    expect(screen.getByText('Payroll taxes are not optional')).toBeTruthy();
    expect(screen.getByText('What worked')).toBeTruthy();
    expect(screen.getByText('Next time')).toBeTruthy();
  });
  it('the leaderboard prizes add up to the prize fund of the view', () => {
    const { container } = render(<MemoryRouter><EndScreen view={cafeEndedView} ask={ask} cards={RULE_CARDS} /></MemoryRouter>);
    const prizes = [...container.querySelectorAll('.lb-row .lb-prize')].map((e) => Number((e.firstChild?.textContent ?? '').replace(/[^0-9.]/g, '')) || 0);
    const cafePool = cafeEndedView.extra!.payouts!.filter((p) => p.niche === 'cafe').reduce((s, p) => s + p.amount, 0);
    expect(Math.round(prizes.reduce((s, x) => s + x, 0) * 100)).toBe(Math.round(cafePool * 100));
  });
});
