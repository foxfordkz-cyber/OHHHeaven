import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PLAN, RULE_CARDS } from '../insights/fixtures';
import { lessonsTitle, PlanView, reserveMonths } from './PlanScreen';
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
  it('every printed section is an unbreakable block', () => {
    const { container } = render(<PlanView plan={PLAN} cards={cards} />);
    const sections = container.querySelectorAll('article.plan > :not(style)');
    expect(sections.length).toBe(8);
    expect(container.querySelector('article.plan > style[data-plan-print]')?.textContent).toContain('@media print');
    sections.forEach((s) => expect(s.classList.contains('plan-block')).toBe(true));
  });
  it('print styles keep blocks whole, hide the app around the plan and fit Letter paper', () => {
    const rules = printRules(css);
    expect(rules).toContain('@page { size: letter;');
    expect(rules).toMatch(/\.plan-block \{ break-inside: avoid; page-break-inside: avoid;/);
    expect(rules).toMatch(/\.plan-row, \.plan-step, \.plan-lesson, \.plan-table tr \{ break-inside: avoid;/);
    expect(rules).toContain('.app > :not(.plan-root), .toaster, .bottom-nav, .no-print { display: none !important; }');
    expect(rules).toContain(".plan-link::after { content: ' ' attr(data-url);");
    expect(rules).toMatchSnapshot();
  });
});
