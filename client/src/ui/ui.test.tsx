import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { worldPublic } from '../app/fixtures';
import { Button, MoneyText, RuleCard, Sheet, Stepper, dayProgress, formatDuration, formatMoney, formatNumber, formatPct, sourceLabel } from './index';

afterEach(cleanup);

describe('formatting', () => {
  it('formats money the American way with a real minus sign', () => {
    expect(formatMoney(38_420)).toBe('$38,420');
    expect(formatMoney(-1_010)).toBe('−$1,010');
    expect(formatMoney(3_240, { signed: true })).toBe('+$3,240');
    expect(formatMoney(6.4)).toBe('$6.40');
    expect(formatMoney(1_250_000, { compact: true })).toBe('$1.3M');
    expect(formatMoney(54_800, { compact: true })).toBe('$54.8k');
    expect(formatMoney(Number.NaN)).toBe('—');
    expect(formatNumber(-3)).toBe('−3');
    expect(formatPct(0.124)).toBe('12%');
  });

  it('describes time to the next game day', () => {
    expect(formatDuration(2_000)).toBe('2s');
    expect(formatDuration(31 * 60_000)).toBe('31 min');
    expect(formatDuration(150 * 60_000)).toBe('2h 30m');
  });

  it('measures how far into the game day we are', () => {
    const w = worldPublic(); // demo: 2 s per day, 800 ms to the next day
    expect(dayProgress(w, 0)).toBeCloseTo(0.6);
    expect(dayProgress(w, 400)).toBeCloseTo(0.8);
    expect(dayProgress(w, 10_000)).toBe(1);
  });

  it('names the source of a rule by its domain', () => {
    expect(sourceLabel('https://www.nyc.gov/site/doh/index.page')).toBe('nyc.gov');
    expect(sourceLabel('not a url')).toBe('source');
  });
});

describe('components', () => {
  it('colors signed money by profit and loss', () => {
    render(<><MoneyText value={500} signed /><MoneyText value={-500} signed /></>);
    expect(screen.getByText('+$500').className).toContain('money--profit');
    expect(screen.getByText('−$500').className).toContain('money--loss');
  });

  it('keeps the stepper inside its limits', () => {
    const onChange = vi.fn();
    render(<Stepper value={3} min={3} max={4} onChange={onChange} label="chairs" />);
    expect((screen.getByRole('button', { name: 'Decrease chairs' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Increase chairs' }));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('shows a busy button as disabled', () => {
    render(<Button loading>Save</Button>);
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('opens a sheet and closes it with Escape', () => {
    const onClose = vi.fn();
    render(<Sheet open title="Permit" onClose={onClose}>Body</Sheet>);
    expect(screen.getByRole('dialog', { name: 'Permit' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('links a real rule to its source', () => {
    render(<RuleCard title="No permit, no coffee" text="You need a permit." source="https://www.nyc.gov/x" law="Health Code" />);
    expect(screen.getByRole('link').getAttribute('href')).toBe('https://www.nyc.gov/x');
    expect(screen.getByText('Real rule')).toBeTruthy();
  });
});
