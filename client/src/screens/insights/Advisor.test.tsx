import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { act } from 'react';
import type { Query } from '@ohh/shared/types';
import { advisorAnswer, cafeRiskyView, cafeView } from './fixtures';
import { AdvisorCard, askAdvisor, TIMEOUT_TEXT } from './Advisor';

afterEach(() => { cleanup(); vi.useRealTimers(); localStorage.clear(); });

describe('askAdvisor', () => {
  it('returns the answer, also when it comes wrapped in an Ack', async () => {
    const plain = await askAdvisor(async (q: Query) => advisorAnswer((q as { question: string }).question), 'Is paying cash wages worth the risk?');
    expect(plain).toMatchObject({ origin: 'rules' });
    const wrapped = await askAdvisor(async () => ({ ok: true, data: advisorAnswer('supplier') }), 'x');
    expect(wrapped).toMatchObject({ origin: 'rules' });
  });
  it('gives up after the timeout instead of hanging', async () => {
    vi.useFakeTimers();
    const pending = askAdvisor(() => new Promise(() => {}), 'Why did I lose customers yesterday?', 12_000);
    await vi.advanceTimersByTimeAsync(12_000);
    expect(await pending).toBe('timeout');
  });
  it('reports an error for an empty or failed answer', async () => {
    expect(await askAdvisor(async () => null, 'x')).toBe('error');
    expect(await askAdvisor(async () => { throw new Error('down'); }, 'x')).toBe('error');
  });
});

describe('Ask the advisor card', () => {
  it('a preset question shows the answer, its sources and who answered', async () => {
    render(<AdvisorCard view={cafeRiskyView} ask={async (q: Query) => advisorAnswer((q as { question: string }).question)} />);
    fireEvent.click(screen.getByText('Is paying cash wages worth the risk?'));
    expect(await screen.findByText(/You keep about \$1,414 a month/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /IRS: Trust Fund Recovery Penalty/ }).getAttribute('href')).toBe('https://www.irs.gov/TFRP');
    expect(screen.getByText('From the rule book')).toBeTruthy();
  });
  it('tells the player clearly when the advisor times out', async () => {
    vi.useFakeTimers();
    render(<AdvisorCard view={cafeView} ask={() => new Promise(() => {})} timeoutMs={5_000} />);
    fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'Where do I find a coffee supplier in real life?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
    expect(screen.getByText(/Thinking/)).toBeTruthy();
    // RTL turns the act environment off between its own calls; this manual act() needs it on
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(screen.getByText(TIMEOUT_TEXT, { exact: false })).toBeTruthy();
  });
});
