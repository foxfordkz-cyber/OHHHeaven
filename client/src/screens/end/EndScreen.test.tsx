import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { cafeEndedView, cafeView, DEBRIEF, RULE_CARDS, SEASON_PAYOUTS } from '../insights/fixtures';
import { EndScreen } from './EndScreen';

afterEach(cleanup);
const ask = async () => DEBRIEF;

describe('end of season', () => {
  it('shows the place in the niche and the final payout in test money', async () => {
    render(<MemoryRouter><EndScreen view={cafeEndedView} ask={ask} cards={RULE_CARDS} /></MemoryRouter>);
    expect(screen.getByLabelText('Place 2')).toBeTruthy();
    expect(screen.getByText('of 20 coffee shops')).toBeTruthy();
    const hero = screen.getByLabelText('Place 2').closest('section')!;
    expect(within(hero).getByText('$13.50')).toBeTruthy();
    expect(within(hero).getByText(/You won/)).toBeTruthy();
    expect(within(hero).getByText(/in test money/)).toBeTruthy();
  });
  it('during the season it shows the prize at this place, not a win', () => {
    render(<MemoryRouter><EndScreen view={cafeView} ask={ask} cards={RULE_CARDS} /></MemoryRouter>);
    const hero = screen.getByLabelText('Place 3').closest('section')!;
    expect(within(hero).getByText(/Prize at this place/)).toBeTruthy();
    expect(within(hero).getByText('The table can still change until the last day of the season.')).toBeTruthy();
  });
  it('the debrief lists three losses with amounts, lessons and the real rule', async () => {
    render(<MemoryRouter><EndScreen view={cafeEndedView} ask={ask} cards={RULE_CARDS} /></MemoryRouter>);
    expect(await screen.findByText('Not enough seats in February')).toBeTruthy();
    expect(screen.getByText('Rent while you waited for the permit')).toBeTruthy();
    expect(screen.getByText('Coffee beans up 12% in September and October')).toBeTruthy();
    for (const amount of ['−$8,653', '−$4,200', '−$3,348']) expect(screen.getByText(amount)).toBeTruthy();
    expect(screen.getByText('No permit, no coffee')).toBeTruthy();
    expect(screen.getByText('From the rule book')).toBeTruthy();
    expect(screen.getByText('What worked')).toBeTruthy();
    expect(screen.getByText('Next time')).toBeTruthy();
  });
  it('the leaderboard prizes add up to the prize fund of the view', () => {
    const { container } = render(<MemoryRouter><EndScreen view={cafeEndedView} ask={ask} cards={RULE_CARDS} /></MemoryRouter>);
    const prizes = [...container.querySelectorAll('.lb-row .lb-prize')].map((e) => Number((e.firstChild?.textContent ?? '').replace(/[^0-9.]/g, '')) || 0);
    const cafePool = SEASON_PAYOUTS.filter((p) => p.niche === 'cafe').reduce((s, p) => s + p.amount, 0);
    expect(Math.round(prizes.reduce((s, x) => s + x, 0) * 100)).toBe(Math.round(cafePool * 100));
  });
});
