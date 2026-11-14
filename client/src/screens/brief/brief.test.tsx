import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Ack, Action } from '@ohh/shared/types';
import { RULES } from '@ohh/shared/rules';
import { BriefScreen } from './BriefScreen';
import { briefFixture, BRIEF_FIXTURES } from './fixtures';
import { calendarText } from './ics';
import { readMemory, writeMemory } from './memory';
import { happenings, nextReport, pickDecision, resolveSince, rival, snapshotAway, upcoming } from './model';

const NOW = Date.UTC(2026, 10, 15, 9, 0);

function renderBrief(name: Parameters<typeof briefFixture>[0], over: { act?: (a: Action) => Promise<Ack>; key?: string } = {}) {
  const sent: Action[] = [];
  const act = over.act ?? (async (a: Action): Promise<Ack> => { sent.push(a); return { ok: true }; });
  const navigate = vi.fn();
  render(<BriefScreen deps={{ view: briefFixture(name), memoryKey: over.key ?? `t:${name}`, act, navigate, now: () => NOW }} />);
  return { sent, navigate };
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('where "then" comes from', () => {
  it('the server away summary gives cash then = cash now − profit while away', () => {
    const v = briefFixture('away');
    const s = resolveSince(v, {});
    expect(s.source).toBe('away');
    expect(s.day).toBe(74 - 6);
    expect(s.cash).toBe(v.business!.cash - 3_240);
  });

  it('after "Got it" the brief starts from the last look, not from the old away summary', () => {
    const v = briefFixture('away');
    const snap = snapshotAway(v)!;
    const s = resolveSince(v, { away: snap, look: { day: 74, cash: 38_420, rank: 2, months: 1 } });
    expect(s.source).toBe('look');
    expect(s.day).toBe(74);
  });

  it('a frozen away summary survives the poll that clears view.away', () => {
    const v = briefFixture('away');
    const snap = snapshotAway(v)!;
    const s = resolveSince({ ...v, away: null }, { away: snap });
    expect(s.source).toBe('away');
    expect(s.cash).toBe(snap.cashThen);
  });

  it('with no memory and no away summary: since the month began, from the last month report', () => {
    const v = briefFixture('calm');
    const s = resolveSince(v, {});
    expect(s.source).toBe('month');
    expect(s.cash).toBe(v.business!.history[0].cashEnd);
  });

  it('memory survives a broken storage value', () => {
    localStorage.setItem('ohh.brief.v1:x', '{not json');
    expect(readMemory('x')).toEqual({});
    writeMemory('x', { look: { day: 3, cash: 1, rank: null, months: 0 } });
    expect(readMemory('x').look?.day).toBe(3);
  });
});

describe('the one decision', () => {
  it('a fine notice comes first and shows the price of both answers', () => {
    const d = pickDecision(briefFixture('notice'))!;
    expect(d.kind).toBe('notice');
    const contest = RULES.CONTEST_FEE + 1_200 * RULES.CONTEST_FINE_MULT;
    expect(d.options.map((o) => o.action?.type)).toEqual(['answer_notice', 'answer_notice']);
    expect(d.options[1].result).toContain(`$${contest.toLocaleString('en-US')}`);
    // the lawyer costs more than this fine: paying is the recommended answer
    expect(d.options[0].primary).toBe(contest >= 1_200);
  });

  it('an offer from a neighbor: accept or decline, with the loan payments spelled out', () => {
    const d = pickDecision(briefFixture('offer'))!;
    expect(d.kind).toBe('deal');
    expect(d.title).toContain('Ortiz Espresso Bar');
    expect(d.options[0].action).toEqual({ type: 'answer_deal', dealId: 'd-loan-3', accept: true });
    expect(d.options[0].result).toMatch(/\+\$8,000 now/);
  });

  it('otherwise the advice with the biggest effect, applied in one tap', () => {
    const d = pickDecision(briefFixture('away'))!;
    expect(d.kind).toBe('advice');
    expect(d.options[0].action?.type).toBe('set_orders');
    expect(d.options[0].result).toMatch(/Forecast: \+\$1,180 a month/);
  });

  it('nothing urgent: a nudge to try a price in Manage', () => {
    expect(pickDecision(briefFixture('calm'))!.kind).toBe('calm');
  });
});

describe('what happened and what is ahead', () => {
  it('inbox since the gap, events announced or started, neighbors with what it means for me', () => {
    const v = briefFixture('away');
    const h = happenings(v, resolveSince(v, {}));
    expect(h.some((x) => x.title.includes('Cross-promo'))).toBe(true);
    expect(h.some((x) => x.kind === 'event' && x.title === 'Street fair on Avenue A')).toBe(true);
    expect(h.every((x, i) => i === 0 || h[i - 1].day >= x.day)).toBe(true);
  });

  it('the next report: in the live city the rest of the month in real time', () => {
    const v = briefFixture('away');
    const n = nextReport(v);
    expect(n.month).toBe(3);
    expect(n.gameDays).toBe(30 - 14);
    expect(n.ms).toBe(v.world.msToNextDay + 16 * RULES.DAY_MS_LIVE);
  });

  it('dated reasons to come back are sorted by day', () => {
    const u = upcoming(briefFixture('notice'));
    expect(u.length).toBeGreaterThan(1);
    expect(u.every((x, i) => i === 0 || u[i - 1].day <= x.day)).toBe(true);
    expect(u.some((x) => x.id === 'nt:c-health-1')).toBe(true);
  });

  it('the rival is the business right above me', () => {
    const r = rival(briefFixture('away'))!;
    expect(r).toMatchObject({ name: 'Halfmoon Coffee', above: true, rank: 1, gap: 61_300 - 54_800 });
  });

  it('the calendar reminder is set for the moment the report lands', () => {
    const v = briefFixture('away');
    const n = nextReport(v);
    const text = calendarText(n, NOW, 'https://example.test/brief')!;
    const start = new Date(NOW + n.ms!).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    expect(text).toContain(`DTSTART:${start}`);
    expect(text).toContain('March report');
  });
});

describe('/brief on screen', () => {
  for (const name of BRIEF_FIXTURES) {
    it(`renders: ${name}`, () => {
      renderBrief(name);
      expect(screen.getAllByText(name === 'none' ? /No business yet/ : /While you were away/).length).toBeGreaterThan(0);
    });
  }

  it('cash then and now with the change', () => {
    renderBrief('away');
    const card = screen.getByLabelText('Cash then and now');
    expect(card.textContent).toContain('$35,180');
    expect(card.textContent).toContain('$38,420');
    expect(card.textContent).toContain('+$3,240');
  });

  it('a decision is taken on the page and its result is shown in words', async () => {
    const { sent } = renderBrief('notice');
    fireEvent.click(screen.getByRole('button', { name: /Pay \$1,200/ }));
    await waitFor(() => expect(screen.getByLabelText('Decision made')).toBeTruthy());
    expect(sent).toEqual([{ type: 'answer_notice', caseId: 'c-health-1', response: 'pay' }]);
    expect(screen.getByLabelText('Decision made').textContent).toContain('−$1,200 today');
  });

  it('a refused action keeps the choice open and says why', async () => {
    renderBrief('offer', { act: async () => ({ ok: false, error: 'The offer has expired' }) });
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(screen.getByText('The offer has expired')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Decline' })).toBeTruthy();
  });

  it('"Got it" saves the look: the next visit starts from today', () => {
    renderBrief('away', { key: 'k1' });
    fireEvent.click(screen.getByRole('button', { name: /Got it/ }));
    expect(readMemory('k1').look).toMatchObject({ day: 74, cash: 38_420, rank: 2 });
    expect(screen.getByText(/Next time this page starts from here/)).toBeTruthy();
  });

  it('the next report says when it lands and offers a reminder', () => {
    renderBrief('away');
    expect(screen.getByText(/Next: the March report/)).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Remind me' });
    expect(link.getAttribute('download')).toBe('first-year-report-month-3.ics');
  });

  it('a fresh month report is marked new and compared with the month before', () => {
    renderBrief('month');
    expect(screen.getByText('February report')).toBeTruthy();
    expect(screen.getByText('New')).toBeTruthy();
    expect(screen.getByText(/vs last month/)).toBeTruthy();
  });
});
