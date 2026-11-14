import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PLAN, RULE_CARDS } from '../insights/fixtures';
import { lessonsTitle, PlanView, reserveMonths, shortUrl, splitLead } from './PlanScreen';
import { PLAN_PRINT_CSS as css } from './print';

afterEach(cleanup);
const cards = new Map(RULE_CARDS.map((c) => [c.id, c]));

/** The @media print block of plan.css, comments stripped, whitespace collapsed. */
function printRules(source: string): string {
  const start = source.indexOf('@media print');
  let depth = 0;
  let end = start;
  for (let i = source.indexOf('{', start); i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) { end = i + 1; break; }
  }
  return source.slice(start, end).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
}

describe('real-world plan', () => {
  it('has every part the person takes home', () => {
    render(<PlanView plan={PLAN} cards={cards} />);
    for (const h of ['Your real-world plan', 'Money to start', 'Every month', 'Documents, in this order', 'Where to find suppliers', 'Three lessons from your season']) {
      expect(screen.getByRole('heading', { name: h })).toBeTruthy();
    }
    expect(screen.getByText('$139,500')).toBeTruthy();                 // lead's example: $139,500 to open
    expect(screen.getByText('$30,459')).toBeTruthy();                  // and $30,459 a month
    const note = screen.getByText(/Keep \$84,500 in reserve/).closest('p')!;
    expect(note.textContent).toContain('about 2.8 months of these costs');
    expect(note.textContent).toContain('All in, have $224,000 before you sign a lease.');
    expect(screen.getByText('5,281')).toBeTruthy();
    expect(screen.getByText('23 months')).toBeTruthy();
    for (const amount of ['−$8,653', '−$4,200', '−$3,348']) expect(screen.getByText(amount)).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /Official page/ })).toHaveLength(PLAN.checklist.length);
    expect(screen.getByRole('note').textContent).toContain('learning simulation');
  });
  it('says the reserve in months of the costs shown above it', () => {
    expect(reserveMonths({ reserveAdvised: 84500, monthlyTotal: 30459 })).toBe('2.8 months');
    expect(reserveMonths({ reserveAdvised: 6 * 30459, monthlyTotal: 30459 })).toBe('6 months');   // agent 04: six months of fixed costs
    expect(reserveMonths({ reserveAdvised: 30459, monthlyTotal: 30459 })).toBe('1 month');
    expect(reserveMonths({ reserveAdvised: 1000, monthlyTotal: 0 })).toBeNull();
  });
  it('counts the lessons it has', () => {
    expect([3, 2, 1, 0, 5].map(lessonsTitle)).toEqual(['Three lessons from your season', 'Two lessons from your season', 'One lesson from your season', 'Lessons from your season', 'Three lessons from your season']);
  });
  it('sums: the budget rows add up to the totals shown', () => {
    expect(PLAN.startupBudget.reduce((s, r) => s + r.amount, 0)).toBe(PLAN.startupTotal);
    expect(PLAN.monthlyCosts.reduce((s, r) => s + r.amount, 0)).toBe(PLAN.monthlyTotal);
  });
  it('every printed section is a block; only the two long lists may continue on the next page', () => {
    const { container } = render(<PlanView plan={PLAN} cards={cards} />);
    const blocks = [...container.querySelectorAll('article.plan .plan-block')];
    expect(blocks).toHaveLength(8);
    expect(container.querySelector('article.plan > style[data-plan-print]')?.textContent).toContain('@media print');
    for (const child of container.querySelectorAll('article.plan > :not(style)')) {
      expect(child.classList.contains('plan-block') || child.classList.contains('plan-pair')).toBe(true);
    }
    expect(blocks.filter((b) => b.classList.contains('plan-long')).map((b) => b.querySelector('h2')?.textContent)).toEqual(['Documents, in this order', 'Where to find suppliers']);
    expect(container.querySelectorAll('.plan-pair > .plan-half')).toHaveLength(2);    // the money tables side by side on paper
  });
  it('on paper a long text keeps its first sentence and a link is written out short', () => {
    expect(splitLead('Apply online at least 20 days before your first taxable sale; there is no fee. Selling without it costs $500.'))
      .toEqual(['Apply online at least 20 days before your first taxable sale; there is no fee.', 'Selling without it costs $500.']);
    expect(splitLead('A light renovation runs near $87.50 per sq ft.')).toEqual(['A light renovation runs near $87.50 per sq ft.', '']);
    expect(shortUrl('https://www.tax.ny.gov/bus/doingbus/sell.htm')).toBe('tax.ny.gov/bus/doingbus/sell.htm');
    expect(shortUrl('https://dos.ny.gov/')).toBe('dos.ny.gov');
    const { container } = render(<PlanView plan={PLAN} cards={cards} />);
    const ein = [...container.querySelectorAll('.plan-step')].find((s) => s.textContent?.includes('Get an EIN'))!;
    expect(ein.querySelector('.plan-more')!.textContent).toBe(' You need it to hire and to open a business bank account.');   // hidden in print
    expect(container.querySelector('.plan-step .plan-link')!.getAttribute('data-url')).toBe('dos.ny.gov/articles-organization-domestic-limited-liability-company-0');
  });
  it('print styles keep blocks whole, hide the app around the plan and fit Letter paper', () => {
    const rules = printRules(css);
    expect(rules).toContain('@page { size: letter;');
    expect(rules).toMatch(/\.plan-block \{ break-inside: avoid; page-break-inside: avoid;/);
    expect(rules).toContain('.plan-long { break-inside: auto; page-break-inside: auto; }');
    expect(rules.indexOf('.plan-long {')).toBeGreaterThan(rules.indexOf('.plan-block {'));     // the later rule wins
    expect(rules).toMatch(/\.plan-row, \.plan-step, \.plan-supplier, \.plan-lesson, \.plan-table tr \{ break-inside: avoid;/);
    expect(rules).toContain('.plan-steps > li, .plan-suppliers > li { break-inside: avoid;');
    expect(rules).toContain('.app > :not(.plan-root), .toaster, .bottom-nav, .no-print { display: none !important; }');
    expect(rules).toContain('.plan-more, .plan-examples { display: none; }');
    expect(rules).toContain('.plan-link::after { content: attr(data-url);');
    expect(rules).toMatchSnapshot();
  });
});
