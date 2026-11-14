import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Ack, Action } from '@ohh/shared/types';
import { RULES } from '@ohh/shared/rules';
import { BriefScreen } from './BriefScreen';
import { briefFixture, BRIEF_FIXTURES } from './fixtures';
import { calendarText } from './ics';
import { readMemory, writeMemory } from './memory';
import { fixturePlaces } from '../../app/fixtures';
import { dealNews, happenings, monthLength, nearbyIds, nextReport, pickDecision, resolveSince, rival, snapshotAway, upcoming } from './model';

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

  it('closed by inspection: what was found, with the reopening day', () => {
    const d = pickDecision(briefFixture('closed'))!;
    expect(d).toMatchObject({ kind: 'closed', deadlineDay: 77 });
    expect(d.options[0].to).toBe('/biz/today');
  });

  it('bankrupt: see what went wrong first, start again second', () => {
    const d = pickDecision(briefFixture('bankrupt'))!;
    expect(d.kind).toBe('restart');
    expect(d.options.map((o) => o.to)).toEqual(['/end', '/start']);
    expect(d.text).toContain('−$2,496');
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

  it('neighbors: without map data only rivals in my niche, never "your block"', () => {
    const v = briefFixture('away');
    const h = happenings(v, resolveSince(v, {}), null, 20).filter((x) => x.kind === 'neighbor');
    expect(h.some((x) => x.title.startsWith('Blade & Brick'))).toBe(false);          // a barbershop
    expect(h.some((x) => x.title.startsWith("Maya's Morning Cup"))).toBe(false);     // my own news is in the inbox
    expect(h.some((x) => x.title.startsWith('Tin Lantern Coffee'))).toBe(true);
    expect(h.every((x) => !/block/.test(x.text))).toBe(true);
  });

  it('neighbors: with map data, businesses within the radius and what it means for my block', () => {
    const v = briefFixture('away');
    const h = happenings(v, resolveSince(v, {}), new Set(['b09']), 20).filter((x) => x.kind === 'neighbor');
    expect(h.map((x) => x.title.split(' ')[0])).toEqual(['Blade']);
    expect(h[0].text).toMatch(/Within a block of you/);
  });

  it('an offer that expired while I was away is shown as missed; an accepted offer of mine as good news', () => {
    const v = briefFixture('away');
    const since = resolveSince(v, {});
    const deals = [
      { id: 'x1', fromBusinessId: 'b03', toBusinessId: 'b01', terms: { type: 'joint_purchase' as const, months: 2 }, status: 'expired' as const, proposedDay: 69, expiresDay: 72 },
      { id: 'x2', fromBusinessId: 'b01', toBusinessId: 'b04', terms: { type: 'cross_promo' as const, months: 1 }, status: 'active' as const, proposedDay: 70, expiresDay: 73, startDay: 71 },
      { id: 'x3', fromBusinessId: 'b03', toBusinessId: 'b01', terms: { type: 'joint_purchase' as const, months: 2 }, status: 'expired' as const, proposedDay: 60, expiresDay: 63 },
    ];
    const news = dealNews({ ...v, deals }, since);
    expect(news.map((n) => n.id)).toEqual(['missed:x1', 'yes:x2']);
    expect(news[0].title).toBe('Missed: Ortiz Espresso Bar offered joint purchase for 2 months');
    expect(news[1].title).toContain('Little Ember Café accepted');
  });

  it('a same-day letter counts while it is unread', () => {
    const v = briefFixture('calm');
    const look = { day: 74, cash: 1, rank: 2, months: 1 };
    const letter = { id: 'l1', day: 74, kind: 'deal' as const, title: 'Late offer', text: '', read: false };
    expect(happenings({ ...v, me: { ...v.me, inbox: [letter] } }, resolveSince(v, { look })).map((h) => h.title)).toEqual(['Late offer']);
    expect(happenings({ ...v, me: { ...v.me, inbox: [{ ...letter, read: true }] } }, resolveSince(v, { look }))).toEqual([]);
  });

  it('the month length is said from the real day length, not assumed', () => {
    const live = briefFixture('away');
    expect(monthLength(live)).toBe('In this city a month passes in one real day.');
    const demo = { ...live, world: { ...live.world, config: { ...live.world.config, dayMs: RULES.DAY_MS_DEMO } } };
    expect(monthLength(demo)).toBe('In this demo city a month lasts 1 min.');
  });

  it('nearby = places closer than the radius to mine', () => {
    const v = briefFixture('away');
    const all = nearbyIds(v, fixturePlaces, 100_000);
    expect(all.size).toBe(v.neighbors.length);
    expect(nearbyIds(v, fixturePlaces, 1).size).toBe(0);
    expect(nearbyIds({ ...v, business: null }, fixturePlaces, 100_000).size).toBe(0);
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
