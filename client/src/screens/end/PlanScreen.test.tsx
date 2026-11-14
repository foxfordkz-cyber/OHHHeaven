import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PLAN, RULE_CARDS } from '../insights/fixtures';
import { PlanView } from './PlanScreen';
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
    expect(screen.getByText('$48,600')).toBeTruthy();
    expect(screen.getByText(/Keep \$127,284 in reserve/)).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /Official page/ })).toHaveLength(PLAN.checklist.length);
    expect(screen.getByRole('note').textContent).toContain('learning simulation');
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
