import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { cafeRiskyView, cafeSetupView, cafeStrugglingView, cafeView } from './fixtures';
import { InsightsTab } from './InsightsTab';

afterEach(cleanup);
const ask = async () => null;
const show = (v = cafeView) => render(<MemoryRouter><InsightsTab view={v} ask={ask} /></MemoryRouter>);

describe('Insights tab', () => {
  it('shows the four headline numbers, each as a tappable tip', () => {
    show();
    for (const label of ['Profit this month', 'Cash', 'Cash runway', 'Payback']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${label}: .*What is this\\?$`) })).toBeTruthy();
    }
  });
  it('says how many sales break even and shows the payback sentence', () => {
    show();
    const a = cafeView.analytics!;
    expect(screen.getAllByText('You need 5,205 orders a month to break even. You are on track for 6,235.').length).toBeGreaterThan(0);
    expect(screen.getByRole('img', { name: /You need .* orders a month to break even/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Payback: \d+ months\. What is this\?$/ }).textContent).toContain(`${a.paybackMonths} months`);
    expect(screen.getByText('at this pace', { selector: '.ins-facts span' })).toBeTruthy();
  });
  it('compares cost shares with the industry', () => {
    show(cafeStrugglingView);
    const row = screen.getByLabelText('Labor 44% · industry 32% · high');
    expect(within(row).getByText('high')).toBeTruthy();
  });
  it('shows taxes, lost sales and the leaderboard', () => {
    show();
    expect(screen.getByText(/\$11,288 due Thu, Jul 21 · in 38 days/)).toBeTruthy();
    expect(screen.getByText('Your cash ($103,321) covers it.')).toBeTruthy();
    expect(screen.getByText('No open violations: an inspection would find nothing.')).toBeTruthy();
    expect(screen.getByText(/orders lost in the last 30 days/)).toBeTruthy();
    expect(screen.getByText('#3 of 20 coffee shops · 2nd of 10 run by players')).toBeTruthy();
  });
  it('warns when the cash does not cover the next tax', () => {
    show(cafeStrugglingView);
    expect(screen.getByText(/\$13,579 due Fri, Apr 20 · in 5 days/)).toBeTruthy();
    expect(screen.getByText('You are $3,779 short. Keep the sales tax you collect apart from your cash.')).toBeTruthy();
  });
  it('puts the fine if found next to what cash wages saved', () => {
    show(cafeRiskyView);
    expect(screen.getByText('If they find it today you pay $13,312: $7,656 more than you saved.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fines if found today: $13,312. What is this?' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Saved by cutting corners: $5,656. What is this?' })).toBeTruthy();
    expect(screen.getByText('Is paying cash wages worth the risk?')).toBeTruthy();
  });
  it('before opening it explains why there are no numbers yet', () => {
    show(cafeSetupView);
    expect(screen.getByText('Analytics start when your doors open')).toBeTruthy();
    expect(screen.getByText('What permits do I need before I open?')).toBeTruthy();
  });
});
