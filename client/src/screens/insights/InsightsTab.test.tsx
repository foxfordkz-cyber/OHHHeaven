import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { cafeSetupView, cafeStrugglingView, cafeView } from './fixtures';
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
    expect(screen.getAllByText(`You need ${a.breakEvenUnitsMonth!.toLocaleString('en-US')} orders a month to break even. You are on track for 5,420.`).length).toBeGreaterThan(0);
    expect(screen.getByRole('img', { name: /You need .* orders a month to break even/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Payback: \d+ months\. What is this\?$/ }).textContent).toContain(`${a.paybackMonths} months`);
    expect(screen.getByText('at this pace', { selector: '.ins-facts span' })).toBeTruthy();
  });
  it('compares cost shares with the industry', () => {
    show(cafeStrugglingView);
    const row = screen.getByLabelText('Labor 38% · industry 30% · high');
    expect(within(row).getByText('high')).toBeTruthy();
  });
  it('shows taxes, risk, lost sales and the leaderboard', () => {
    show();
    expect(screen.getByText(/\$9,172 due Tue, Jun 20 · in 8 days/)).toBeTruthy();
    expect(screen.getByText('If they find it today you pay $4,230: $1,410 more than you saved.')).toBeTruthy();
    expect(screen.getByText(/orders lost in the last 30 days/)).toBeTruthy();
    expect(screen.getByText('#4 of 18 coffee shops')).toBeTruthy();
  });
  it('before opening it explains why there are no numbers yet', () => {
    show(cafeSetupView);
    expect(screen.getByText('Analytics start when your doors open')).toBeTruthy();
    expect(screen.getByText('What permits do I need before I open?')).toBeTruthy();
  });
});
