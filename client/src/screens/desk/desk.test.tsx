import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Action, OfficialView } from '../../../../shared/src/types';
import { DevStore } from '../network/deps';
import { ownerView } from '../network/fixtures';
import { Desk, DeskScreen } from './DeskScreen';
import { simulateDesk } from './dev';
import { officialView, officialViewEmpty, officialViewExposed, packs, queue, TODAY } from './fixtures';
import {
  aiTakeoverText, bribeFacts, bribeWarning, closedText, deskAct, earningsEstimate, foundLines, rankOf, suspension,
  takeAvailability, waitingText,
} from './logic';

afterEach(cleanup);

/** A paused clock keeps the Clock component from ticking during tests. */
const paused = (v: OfficialView): OfficialView => ({ ...v, world: { ...v.world, config: { ...v.world.config, paused: true } } });

function setup(view: OfficialView = officialView) {
  const onAct = vi.fn<(a: Action) => unknown>();
  render(<Desk view={paused(view)} packs={packs} onAct={onAct} />);
  return onAct;
}

const caseRow = (region: string, caseId: string) => screen.getByRole('region', { name: region }).querySelector<HTMLElement>(`[data-case="${caseId}"]`)!;

describe('desk logic', () => {
  it('says how long a case waits and when an AI official takes it', () => {
    const c21 = queue[0];
    expect(waitingText(c21, TODAY)).toBe('Waiting 1 day');
    expect(aiTakeoverText(c21, TODAY)).toBe('An AI official takes it in 2 days');
    expect(waitingText(queue[2], TODAY)).toBe('New today');
    expect(aiTakeoverText({ ...c21, openedDay: TODAY - 5 }, TODAY)).toBe('An AI official takes it today if nobody does');
  });

  it('gives a reason for every case that cannot be taken', () => {
    expect(takeAvailability(queue[0], officialView)).toEqual({ allowed: true });
    expect(takeAvailability(queue[2], officialView).reason).toBe('You checked Fade Factory less than 30 days ago');
    expect(takeAvailability({ ...queue[0], role: 'tax_auditor' }, officialView).reason).toBe('This case needs a tax auditor');
    expect(takeAvailability({ ...queue[0], status: 'taken' }, officialView).reason).toBe('Another official already took this case');
    expect(takeAvailability(queue[0], officialViewExposed).reason).toBe('Internal Affairs exposed you: no new cases');
    const suspended: OfficialView = { ...officialView, official: { ...officialView.official, suspendedUntilDay: TODAY + 3 } };
    expect(takeAvailability(queue[0], suspended).reason).toMatch(/^Suspended until \w{3}, Feb 20$/);
    expect(suspension(suspended).blocked).toBe(true);
    expect(suspension(officialView).blocked).toBe(false);
  });

  it('ranks the official and estimates the share of the bank like the season end does', () => {
    expect(rankOf(officialView)).toEqual({ place: 2, of: 4 });
    // 5% of a $410 bank = $20.50; Dana 40 points, the other human 20 → 2/3.
    expect(earningsEstimate(officialView)).toEqual({ pool: 20.5, amount: 13.67, sharePct: 67 });
    expect(earningsEstimate(officialViewExposed).amount).toBe(0);
    expect(earningsEstimate(officialViewEmpty).amount).toBe(0);
  });

  it('describes the bribe honestly', () => {
    const offer = officialView.mine.find((c) => c.caseId === 'c13')!;
    expect(bribeFacts(offer)).toEqual({ amount: 400, fine: 950, pointsIfTaken: 15, pointsIfRefused: 10, fineIfRefused: 1425 });
    const lines = bribeWarning(offer, officialView, packs).join(' ');
    expect(lines).toContain('Internal Affairs exposes the official who took the most bribes that month');
    expect(lines).toContain('Refuse: the owner pays 1.5× the fine, $1,425');
    expect(lines).toContain('You have taken no bribes this month.');
  });

  it('reads found violations from the packs and explains closed cases', () => {
    const notice = officialView.mine.find((c) => c.caseId === 'c12')!;
    expect(foundLines(notice, packs).map((l) => [l.name, l.law, l.fine])).toEqual([
      ['Evidence of mice or roaches', 'NYC Health Code, Article 81', 700],
      ['Unsanitary food contact surfaces', 'NYC Health Code, Article 81', 300],
    ]);
    expect(foundLines(notice, null)[0].law).toBe('Law name not in the pack yet');
    expect(closedText({ ...notice, status: 'closed', found: [], outcome: 'clean' })).toBe('Nothing found (-5 points)');
    expect(closedText({ ...notice, status: 'closed', outcome: 'fined', fine: 1000 })).toBe('Fine paid: $1,000');
    expect(closedText({ ...notice, status: 'closed', outcome: 'bribed', bribeAmount: 400 })).toBe('You took $400; no fine');
  });

  it('builds the two desk actions', () => {
    expect(deskAct.takeCase('c21')).toEqual({ type: 'take_case', caseId: 'c21' });
    expect(deskAct.answerBribe('c13', false)).toEqual({ type: 'answer_bribe', caseId: 'c13', accept: false });
  });
});

describe('desk screen', () => {
  it('shows role, points, rank, earnings estimate and the game date', () => {
    setup();
    const head = screen.getByRole('region', { name: 'My desk' });
    expect(head.textContent).toContain('Health inspector · Dana Ortiz');
    expect(head.textContent).toContain('NYC Department of Health and Mental Hygiene');
    expect(head.textContent).toContain('40');
    expect(head.textContent).toContain('#2');
    expect(head.textContent).toContain('$13.67');
    expect(head.textContent).toContain('Fri, Feb 17');
  });

  it('takes a case from the queue', () => {
    const onAct = setup();
    const row = caseRow('Case queue', 'c21');
    expect(row.textContent).toContain('Tompkins Grind');
    expect(row.textContent).toContain('Neighbor complaint');
    expect(row.textContent).toContain('Waiting 1 day');
    expect(row.textContent).toContain('sticky counters');
    fireEvent.click(within(row).getByRole('button', { name: /Take case/ }));
    expect(onAct).toHaveBeenCalledWith({ type: 'take_case', caseId: 'c21' });
  });

  it('a case that cannot be taken is off and says why', () => {
    const onAct = setup();
    const row = caseRow('Case queue', 'c23');
    const take = within(row).getByRole('button', { name: /Take case/ }) as HTMLButtonElement;
    expect(take.disabled).toBe(true);
    expect(row.textContent).toContain('You checked Fade Factory less than 30 days ago');
    fireEvent.click(take);
    expect(onAct).not.toHaveBeenCalled();
  });

  it('answers a bribe: take or refuse, with the Internal Affairs warning', () => {
    const onAct = setup();
    const offer = within(caseRow('My cases', 'c13')).getByRole('group', { name: 'Offer from the owner' });
    expect(offer.textContent).toContain('Cuppa Joe East offers you $400');
    expect(offer.textContent).toContain('Internal Affairs');
    fireEvent.click(within(offer).getByRole('button', { name: 'Take $400' }));
    expect(onAct).toHaveBeenLastCalledWith({ type: 'answer_bribe', caseId: 'c13', accept: true });
    fireEvent.click(within(offer).getByRole('button', { name: 'Refuse' }));
    expect(onAct).toHaveBeenLastCalledWith({ type: 'answer_bribe', caseId: 'c13', accept: false });
  });

  it('shows what was found, by which law, the fine and how it works in real life', () => {
    setup();
    const row = caseRow('My cases', 'c12');
    expect(row.textContent).toContain('Fine notice sent');
    expect(row.textContent).toContain('Evidence of mice or roaches');
    expect(row.textContent).toContain('NYC Health Code, Article 81');
    expect(row.textContent).toContain('$1,000');
    expect(row.textContent).toContain('closed for 2 days');
    const rule = within(row).getByRole('complementary', { name: 'Real rule' });
    expect(rule.textContent).toContain('0–13 points earns an A grade');
    expect(caseRow('My cases', 'c11').textContent).toContain('Inspection in progress');
    expect(caseRow('My cases', 'c14').textContent).toContain('Nothing found');
  });

  it('lists officials by points and the city feed', () => {
    setup();
    const ranking = screen.getByRole('region', { name: 'Officials ranking' });
    const rows = ranking.querySelectorAll('li');
    expect(rows[0].textContent).toContain('Inspector Reyes (AI)');
    expect(rows[1].className).toContain('is-me');
    expect(screen.getByRole('region', { name: 'City feed' }).querySelectorAll('li').length).toBeGreaterThan(0);
  });

  it('explains an empty queue', () => {
    setup(officialViewEmpty);
    const q = screen.getByRole('region', { name: 'Case queue' });
    expect(q.textContent).toContain('No cases right now. Cases come from three places');
    expect(q.textContent).toContain('A neighbor reports a business to the city.');
    expect(q.textContent).toContain('goes to an AI official');
    expect(screen.getByRole('region', { name: 'My cases' }).textContent).toContain('No cases yet');
  });

  it('tells an exposed official what happened', () => {
    setup(officialViewExposed);
    expect(screen.getByRole('status').textContent).toContain('Internal Affairs exposed you');
    expect(screen.getByRole('region', { name: 'Case queue' }).textContent).toContain('No cases for you while this lasts.');
    expect(caseRow('My cases', 'c13').textContent).toContain('You took $400; no fine');
  });
});

describe('desk on the store', () => {
  it('renders for an official and moves to the next example state on take_case', async () => {
    render(
      <DevStore view={paused(officialView)} onAct={simulateDesk}>
        <DeskScreen packs={packs} />
      </DevStore>,
    );
    await act(async () => {
      fireEvent.click(within(caseRow('Case queue', 'c21')).getByRole('button', { name: /Take case/ }));
    });
    expect(caseRow('Case queue', 'c21')).toBeNull();
    expect(caseRow('My cases', 'c21').textContent).toContain('Inspection in progress');
  });

  it('tells an owner that the desk is for officials', () => {
    render(
      <DevStore view={ownerView}>
        <DeskScreen packs={packs} />
      </DevStore>,
    );
    expect(screen.getByText('This desk is for city officials')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Work for the city' }).getAttribute('href')).toBe('/start?as=official');
  });
});
