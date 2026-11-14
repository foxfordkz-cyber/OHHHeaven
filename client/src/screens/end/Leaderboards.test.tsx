import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { cafeEndedView, cafeView } from '../insights/fixtures';
import { Leaderboards, NicheTable, rankingOf, splitText } from './Leaderboards';
import { nicheBoard } from './prizes';

afterEach(cleanup);

describe('leaderboards', () => {
  it('says how the fund is split, also when fewer than three can win', () => {
    expect(splitText([50, 30, 20])).toBe('Top 3 human businesses split it 50 / 30 / 20.');
    expect(splitText([62.5, 37.5])).toBe('Top 2 human businesses split it 62.5 / 37.5.');
    expect(splitText([100])).toBe('The only human business that can win takes it all.');
    expect(splitText([])).toBe('No human business can win it yet.');
  });
  it('a short table pins my row under the top rows', () => {
    const board = nicheBoard(cafeView, 'cafe');
    render(<NicheTable board={board} testMoney limit={2} />);
    const pinned = screen.getByRole('list', { name: 'Your place' });
    expect(within(pinned).getByText('Maya’s Coffee')).toBeTruthy();
    expect(within(pinned).getByText('$13.50')).toBeTruthy();
  });
  it('the officials tab ranks officials by points, from the view', () => {
    expect(rankingOf(cafeEndedView).map((r) => r.points)).toEqual([35, 25, 15, 10, 0]);
    render(<Leaderboards view={cafeEndedView} />);
    fireEvent.click(screen.getByText('Officials'));
    expect(screen.getByText('Dana (inspector)')).toBeTruthy();
    expect(screen.getByText('$1.46')).toBeTruthy();
    expect(screen.getByText(/Officials share \$2\.50 \(5% of the bank\) by points/)).toBeTruthy();
  });
});
