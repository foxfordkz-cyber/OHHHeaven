// A free player after the free month opens the plan: its own numbers and one button to Pro (docs/qa/BUGS.md #13).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PlanScreen } from './PlanScreen';

afterEach(cleanup);

const teaser = { businessName: 'Maya Coffee', startupTotal: 139_500, monthlyTotal: 30_459, reserveAdvised: 84_500, paybackMonths: 14, steps: 24, stepsWithLinks: 24, suppliers: 6, lessons: 3 };

describe('plan in Pro', () => {
  it('shows what the plan holds and a See Pro button instead of "not ready yet"', async () => {
    const onPro = vi.fn();
    render(<PlanScreen ask={async () => null} locked={{ teaser }} onPro={onPro} />);
    expect(await screen.findByTestId('plan-locked')).toBeTruthy();
    expect(screen.queryByText(/not ready yet/)).toBeNull();
    expect(screen.getByText(/\$139,500/)).toBeTruthy();
    expect(screen.getByText(/24 real-life steps in order, 24 with the official page/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /See Pro/ }));
    expect(onPro).toHaveBeenCalledTimes(1);
  });

  it('a player with no business still hears "not ready yet"', async () => {
    render(<PlanScreen ask={async () => null} locked={null} />);
    expect(await screen.findByText(/not ready yet/)).toBeTruthy();
  });
});
