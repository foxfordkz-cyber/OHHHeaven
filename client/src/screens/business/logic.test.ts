import { describe, expect, it, vi } from 'vitest';
import type { Ack, Action, Recommendation, StandingOrders } from '../../../../shared/src/types';
import { cafePack, commonPack } from './__stubs__/cafePack';
import {
  buildSetOrders, diffOrders, draftFrom, hasChanges, knownShortcutIds, loadDraft, mergeOrders, saveDraft,
  setAutopilot, setLever, setPrice, setStaff, toggleShortcut, totalStaff,
} from './orders';
import { groupLines, KIND_ORDER, monthAddsUp, sumLines, taxCoverage, taxRows } from './books';
import { chartSeries, lostReasons, lostTotal, pickDays, topRecommendations, upcomingEvents } from './today';
import { applyAll, applyRecommendation, bribeAction, CONTEST, contestAction, payAction, pendingNotices, readInbox } from './actions';
import { dayLabel, effectIsGood, effectText, multChange, nichePlural, plural, realWait, relDay, shortDate, signedUsd, usd, usd2 } from './format';
import { fixture, FIXTURE_NAMES } from './fixtures';

const base: StandingOrders = {
  price: 6.5, staff: { barista: 3, shift_lead: 1 }, levers: { cleaning: 'full', beans: 'standard', hours: 'standard' },
  shortcuts: ['cash_wages'], blockFund: false, autopilot: 'hold',
};

describe('orders: the form builds a correct set_orders', () => {
  it('sends nothing when nothing changed', () => {
    expect(buildSetOrders(base, draftFrom(base))).toBeNull();
    expect(hasChanges(base, draftFrom(base))).toBe(false);
  });

  it('price only', () => {
    const d = setPrice(draftFrom(base), 6.9, cafePack);
    expect(buildSetOrders(base, d)).toEqual({ type: 'set_orders', orders: { price: 6.9 } });
  });

  it('clamps price to the pack range and rounds to cents', () => {
    expect(setPrice(draftFrom(base), 99, cafePack).price).toBe(cafePack.unit.priceMax);
    expect(setPrice(draftFrom(base), 0.5, cafePack).price).toBe(cafePack.unit.priceMin);
    expect(setPrice(draftFrom(base), 6.456, cafePack).price).toBe(6.46);
  });

  it('staff change sends the whole staff record', () => {
    const d = setStaff(draftFrom(base), 'barista', 4, cafePack);
    expect(buildSetOrders(base, d)).toEqual({ type: 'set_orders', orders: { staff: { barista: 4, shift_lead: 1 } } });
  });

  it('keeps total staff within minStaff..maxStaff', () => {
    let d = setStaff(draftFrom(base), 'barista', 50, cafePack);
    expect(totalStaff(d.staff)).toBe(cafePack.capacity.maxStaff);
    d = setStaff(setStaff(draftFrom(base), 'shift_lead', 0, cafePack), 'barista', 0, cafePack);
    expect(totalStaff(d.staff)).toBe(cafePack.capacity.minStaff);
    expect(setStaff(draftFrom(base), 'barista', -3, cafePack).staff.barista).toBe(0);
  });

  it('lever change sends all levers; unknown option is ignored', () => {
    const d = setLever(draftFrom(base), 'hours', 'long', cafePack);
    expect(buildSetOrders(base, d)?.orders).toEqual({ levers: { cleaning: 'full', beans: 'standard', hours: 'long' } });
    expect(setLever(draftFrom(base), 'hours', 'midnight', cafePack)).toEqual(draftFrom(base));
  });

  it('shortcuts toggle and compare as a set', () => {
    const off = toggleShortcut(draftFrom(base), 'cash_wages', false);
    expect(buildSetOrders(base, off)?.orders).toEqual({ shortcuts: [] });
    const on = toggleShortcut(toggleShortcut(draftFrom(base), 'skip_pest_control', true), 'skip_pest_control', true);
    expect(on.shortcuts.filter((s) => s === 'skip_pest_control')).toHaveLength(1);
    const reordered = { ...draftFrom(base), shortcuts: ['b', 'a'] };
    expect(diffOrders({ ...base, shortcuts: ['a', 'b'] }, reordered)).toEqual({});
  });

  it('manager and block fund', () => {
    const d = setAutopilot(draftFrom(base), 'manager');
    expect(buildSetOrders(base, d)).toEqual({ type: 'set_orders', orders: { autopilot: 'manager' } });
  });

  it('several changes at once', () => {
    let d = setPrice(draftFrom(base), 7, cafePack);
    d = setStaff(d, 'shift_lead', 2, cafePack);
    d = toggleShortcut(d, 'cash_wages', false);
    expect(buildSetOrders(base, d)).toEqual({ type: 'set_orders', orders: { price: 7, staff: { barista: 3, shift_lead: 2 }, shortcuts: [] } });
  });

  it('mergeOrders applies a recommendation patch to the draft', () => {
    const d = mergeOrders(draftFrom(base), { price: 6.9, levers: { hours: 'long' } });
    expect(d.price).toBe(6.9);
    expect(d.levers).toEqual({ cleaning: 'full', beans: 'standard', hours: 'long' });
  });

  it('knows shortcuts from the niche pack and _common', () => {
    expect(knownShortcutIds(cafePack, commonPack)).toEqual(['skip_pest_control', 'underreport_sales', 'cash_wages']);
  });

  it('stored draft survives a reload but not a change on the server', () => {
    localStorage.clear();
    const d = setPrice(draftFrom(base), 7.2, cafePack);
    saveDraft('b1', base, d);
    expect(loadDraft('b1', base)?.price).toBe(7.2);
    expect(loadDraft('b1', { ...base, price: 6.6 })).toBeNull();
    saveDraft('b1', base, draftFrom(base));
    expect(loadDraft('b1', base)).toBeNull();
  });
});

describe('books: grouping adds up', () => {
  it('group totals sum to the sum of all lines, in fixed kind order', () => {
    for (const name of FIXTURE_NAMES) {
      const b = fixture(name).business;
      if (!b) continue;
      for (const lines of [b.mtd.lines, ...b.history.map((m) => m.lines)]) {
        const groups = groupLines(lines);
        expect(sumLines(groups.flatMap((g) => g.lines))).toBeCloseTo(sumLines(lines), 6);
        expect(groups.reduce((a, g) => a + g.total, 0)).toBeCloseTo(sumLines(lines), 6);
        const order = groups.map((g) => KIND_ORDER.indexOf(g.kind));
        expect([...order].sort((a, c) => a - c)).toEqual(order);
        expect(groups.every((g) => g.lines.length > 0)).toBe(true);
      }
    }
  });

  it('unknown kinds go to Other', () => {
    const groups = groupLines([{ id: 'x', label: 'X', kind: 'mystery' as never, amount: 5 }]);
    expect(groups).toEqual([{ kind: 'other', label: 'Other', total: 5, lines: [{ id: 'x', label: 'X', kind: 'mystery', amount: 5 }] }]);
  });

  it('every sample month explains its cash change', () => {
    for (const name of FIXTURE_NAMES) {
      for (const m of fixture(name).business?.history ?? []) expect(monthAddsUp(m).ok).toBe(true);
    }
  });

  it('tax rows: unpaid only, soonest first, names from packs; coverage flags a shortfall', () => {
    const b = fixture('open').business!;
    const rows = taxRows(b, cafePack, commonPack);
    expect(rows.map((r) => r.taxId)).toEqual(['fica_employer', 'sales_tax']);
    expect(rows[1].name).toBe('Sales tax');
    expect(taxCoverage(rows, 100, 97).covered).toBe(false);
    expect(taxCoverage(rows, 1e6, 97)).toEqual({ due: rows[0].amount + rows[1].amount, short: 0, covered: true });
    expect(taxCoverage(rows, 0, 97, 5).due).toBe(0);
  });
});

describe('today', () => {
  it('picks today and yesterday by game day', () => {
    const b = fixture('open').business!;
    const { today, yesterday } = pickDays(b.days, 97);
    expect(today?.day).toBe(97);
    expect(yesterday?.day).toBe(96);
    expect(pickDays([], 97)).toEqual({ today: null, yesterday: null });
  });

  it('names lost customers, biggest reason first', () => {
    const lost = { size: 41, staff: 3, closure: 0 };
    expect(lostTotal(lost)).toBe(44);
    expect(lostReasons(lost, cafePack.sizing).map((r) => `${r.units} ${r.text}`)).toEqual(['41 not enough seats', '3 not enough staff']);
  });

  it('at most three recommendations, critical first', () => {
    const recs = fixture('open').recommendations;
    const top = topRecommendations(recs);
    expect(top).toHaveLength(3);
    expect(top[0].severity).toBe('critical');
    expect(top.map((r) => r.id)).not.toContain('rec_hours');
  });

  it('upcoming events touch my niche and are not over', () => {
    const v = fixture('open');
    const ev = upcomingEvents(v.events, 'cafe', 97);
    expect(ev.map((e) => e.id)).toEqual(['ev_fair', 'ev_beans', 'ev_ltrain']);
    expect(upcomingEvents(v.events, 'barbershop', 97).map((e) => e.id)).not.toContain('ev_beans');
    expect(upcomingEvents(v.events, 'cafe', 500)).toEqual([]);
  });

  it('chart has at most 30 days', () => {
    const s = chartSeries(fixture('open').business!.days);
    expect(s).toHaveLength(30);
    expect(s[29].day).toBe(97);
  });
});

describe('actions: Apply sends suggested', () => {
  const okPort = () => {
    const sent: Action[] = [];
    return { sent, act: vi.fn(async (a: Action): Promise<Ack> => { sent.push(a); return { ok: true }; }) };
  };

  it('Apply sends exactly the suggested action', async () => {
    const port = okPort();
    const rec = fixture('open').recommendations.find((r) => r.id === 'rec_price')!;
    const res = await applyRecommendation(port, rec);
    expect(res).toEqual({ id: 'rec_price', ok: true, error: undefined });
    expect(port.sent).toEqual([rec.suggested]);
  });

  it('Apply all sends suggestions in order and skips cards without one', async () => {
    const port = okPort();
    const recs: Recommendation[] = [
      ...fixture('open').recommendations.slice(0, 2),
      { id: 'no_action', severity: 'info', title: 'Just so you know', text: '…' },
    ];
    const res = await applyAll(port, recs);
    expect(port.sent).toEqual([recs[0].suggested, recs[1].suggested]);
    expect(res.map((r) => r.ok)).toEqual([true, true]);
  });

  it('reports server errors and dropped connections', async () => {
    const rec = fixture('open').recommendations[0];
    expect(await applyRecommendation({ act: async () => ({ ok: false, error: 'Not enough cash' }) }, rec)).toEqual({ id: rec.id, ok: false, error: 'Not enough cash' });
    expect((await applyRecommendation({ act: async () => { throw new Error('offline'); } }, rec)).error).toBe('offline');
  });

  it('notice answers', () => {
    const n = fixture('notice').notices[0];
    expect(payAction(n)).toEqual({ type: 'answer_notice', caseId: 'case_17', response: 'pay' });
    expect(contestAction(n)).toEqual({ type: 'answer_notice', caseId: 'case_17', response: 'contest' });
    expect(bribeAction(n, 400.7)).toEqual({ type: 'answer_notice', caseId: 'case_17', response: 'bribe', bribeAmount: 400 });
    expect(bribeAction(n, 0)).toBeNull();
    expect(bribeAction(n, Number.NaN)).toBeNull();
    expect(pendingNotices(fixture('closed').notices)).toEqual([]);
    expect(CONTEST).toEqual({ fee: 1500, fineCutPct: 30 });
  });

  it('read_inbox marks unread items', () => {
    const items = fixture('away').away!.items;
    expect(readInbox(items)).toEqual({ type: 'read_inbox', ids: items.map((i) => i.id) });
    expect(readInbox(items.map((i) => ({ ...i, read: true })))).toBeNull();
  });
});

describe('format', () => {
  it('money', () => {
    expect(usd(3240)).toBe('$3,240');
    expect(usd(-1200)).toBe('−$1,200');
    expect(usd(-0.2)).toBe('$0');
    expect(usd2(6.4)).toBe('$6.40');
    expect(signedUsd(3240)).toBe('+$3,240');
    expect(signedUsd(-990)).toBe('−$990');
    expect(signedUsd(0.3)).toBe('$0');
  });

  it('effects and words', () => {
    expect(multChange(1.15)).toBe('+15%');
    expect(multChange(0.85)).toBe('−15%');
    expect(effectText({ target: 'cogs', mult: 1.15 })).toBe('+15% cost per order');
    expect(effectIsGood({ target: 'cogs', mult: 1.15 })).toBe(false);
    expect(effectIsGood({ target: 'footTraffic', mult: 1.3 })).toBe(true);
    expect(nichePlural('Coffee shop')).toBe('coffee shops');
    expect(plural(1, 'day')).toBe('1 day');
    expect(plural(6, 'day')).toBe('6 days');
  });

  it('dates and waits', () => {
    expect(dayLabel(97)).toBe('Sat, Apr 7');
    expect(shortDate(110)).toBe('Apr 20');
    expect(relDay(99, 97)).toBe('in 2 days');
    expect(relDay(97, 97)).toBe('today');
    expect(realWait(1200)).toBe('in 1s');
    expect(realWait(31 * 60_000)).toBe('in 31 min');
    expect(realWait(65 * 60_000)).toBe('in 1 h 5 min');
  });
});
