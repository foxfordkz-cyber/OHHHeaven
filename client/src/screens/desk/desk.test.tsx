import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Action, OfficialView, PackSet } from '../../../../shared/src/types';
import { DevStore } from '../network/deps';
import { ownerView } from '../network/fixtures';
import { Desk, DeskScreen } from './DeskScreen';
import { simulateDesk } from './dev';
import { officialView, officialViewEmpty, officialViewExposed, packs, queue, TODAY } from './fixtures';
import {
  aiTakeoverText, bribeFacts, briberyRule, bribeWarning, closedText, deskAct, earningsEstimate, foundLines, officialsForCase,
  rankOf, suspension, takeAvailability, waitingText,
} from './logic';

afterEach(cleanup);

/** The bribery rule as packs/_common.json has it (agent 14). */
const packsWithBribery: PackSet = {
  ...packs,
  common: {
    ...packs.common,
    violations: [...packs.common.violations, { id: 'bribery', name: 'Bribing a public servant', law: 'NY Penal Law §200.00 (bribery in the third degree)', official: 'doi_investigator', foundBy: ['complaint'], fine: { base: 0 }, confidence: 'estimate' }],
    officials: [...packs.common.officials, { id: 'doi_investigator', name: 'Integrity investigator', agency: 'NYC Department of Investigation (DOI)', role: 'inspector', checks: ['bribery'], realProcess: 'City inspectors must report every offer of money or gifts.', confidence: 'estimate' }],
  },
};

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

  it('finds the real official behind each violation and the bribery rule', () => {
    const notice = officialView.mine.find((c) => c.caseId === 'c12')!;
    expect(officialsForCase(notice, packs).map((o) => o.id)).toEqual(['health_inspector']);
    expect(officialsForCase({ ...notice, found: [] }, packs)).toEqual([]);
    expect(briberyRule(packs)).toEqual({ law: undefined, official: undefined });
    expect(briberyRule(packsWithBribery).law).toBe('NY Penal Law §200.00 (bribery in the third degree)');
    expect(briberyRule(packsWithBribery).official?.id).toBe('doi_investigator');
    const offer = officialView.mine.find((c) => c.caseId === 'c13')!;
    expect(bribeWarning(offer, officialView, packsWithBribery).at(-1)).toBe('In real life the owner commits a crime: NY Penal Law §200.00 (bribery in the third degree). Taking the money is bribe receiving, a crime too.');
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
    expect(head.textContent).toContain('City inspector · Dana Ortiz');
    expect(head.textContent).toContain('Health, licenses, sidewalks and trash');
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
    // one answer per offer: both buttons lock while it flies
    expect((within(offer).getByRole('button', { name: 'Refuse' }) as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    const onAct2 = setup();
    const offer2 = within(caseRow('My cases', 'c13')).getByRole('group', { name: 'Offer from the owner' });
    fireEvent.click(within(offer2).getByRole('button', { name: 'Refuse' }));
    expect(onAct2).toHaveBeenLastCalledWith({ type: 'answer_bribe', caseId: 'c13', accept: false });
  });

  it('says right away what the answer did, and why when it failed', async () => {
    const ok = vi.fn(async () => ({ ok: true }));
    render(<Desk view={paused(officialView)} packs={packs} onAct={ok} />);
    const offer = within(caseRow('My cases', 'c13')).getByRole('group', { name: 'Offer from the owner' });
    await act(async () => { fireEvent.click(within(offer).getByRole('button', { name: 'Refuse' })); });
    expect(within(offer).getByRole('note').textContent).toMatch(/You refused\. The owner now owes \$\d/);
    cleanup();
    const bad = vi.fn(async () => ({ ok: false, error: 'The offer expired' }));
    render(<Desk view={paused(officialView)} packs={packs} onAct={bad} />);
    const row = caseRow('Case queue', 'c21');
    await act(async () => { fireEvent.click(within(row).getByRole('button', { name: /Take case/ })); });
    expect(within(row).getByRole('note').textContent).toBe('That did not go through: The offer expired.');
  });

  it('puts one decision on top: the open offer first, then the oldest case I can take', () => {
    setup();
    const today = screen.getByRole('region', { name: 'Today at the desk' });
    expect(today.textContent).toContain('Your decision');
    expect(today.textContent).toContain('Cuppa Joe East offers you $400');
    expect(today.textContent).toMatch(/#\d+ of \d+|You lead|not in the ranking/);
    expect(today.textContent).toContain('Tomorrow');
    cleanup();
    const noOffer: OfficialView = { ...officialView, mine: officialView.mine.filter((c) => c.status !== 'bribe_offered') };
    const onAct = setup(noOffer);
    const t2 = screen.getByRole('region', { name: 'Today at the desk' });
    expect(t2.textContent).toMatch(/Take the case on /);
    fireEvent.click(within(t2).getByRole('button', { name: /Take this case/ }));
    expect(onAct).toHaveBeenCalledWith(expect.objectContaining({ type: 'take_case' }));
  });

  it('pauses actions and says so when the connection is lost', () => {
    render(<Desk view={paused(officialView)} packs={packs} onAct={vi.fn()} connection={{ offline: true, error: 'fetch failed' }} />);
    expect(screen.getByRole('status').textContent).toContain('Connection lost');
    const take = within(caseRow('Case queue', 'c21')).getByRole('button', { name: /Take case/ }) as HTMLButtonElement;
    expect(take.disabled).toBe(true);
  });

  it('shows who catches bribes in real life when the packs have the rule', () => {
    render(<Desk view={paused(officialView)} packs={packsWithBribery} onAct={vi.fn()} />);
    const offer = within(caseRow('My cases', 'c13')).getByRole('group', { name: 'Offer from the owner' });
    const rule = within(offer).getByRole('complementary', { name: 'Real rule' });
    expect(rule.textContent).toContain('Who catches it in real life: Integrity investigator');
    expect(rule.textContent).toContain('NY Penal Law §200.00');
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
