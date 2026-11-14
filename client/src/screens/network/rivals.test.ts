import { describe, expect, it } from 'vitest';
import type { FeedItem, OwnerView, PackSet } from '../../../../shared/src/types';
import { RULES } from '../../../../shared/src/rules';
import { MY_ID, ownerView, packs, places } from './fixtures';
import {
  changesSince, footfallRadius, ladderLine, ladderOf, lastLook, mainRival, msToMonthClose, noticeChoices, offerChoices,
  reportMove, rivalNews, snapshotOf, teamUpMove, FOOTFALL_RADIUS_FALLBACK_M,
} from './rivals';

const biz = (id: string) => ownerView.neighbors.find((n) => n.id === id)!;
const withFeed = (feed: FeedItem[]): OwnerView => ({ ...ownerView, feed });

describe('footfall radius', () => {
  it('comes from the pack, else 250 m', () => {
    expect(footfallRadius(packs, 'cafe')).toBe(FOOTFALL_RADIUS_FALLBACK_M);
    const withRadius: PackSet = { ...packs, niches: { cafe: { extra: { footfall: { radiusM: 300 } } } as never } };
    expect(footfallRadius(withRadius, 'cafe')).toBe(300);
  });
});

describe('the ladder', () => {
  it('shows my place, who is right above, and the prize forecast', () => {
    const l = ladderOf(ownerView)!;
    expect(l.me?.rank).toBe(3);
    expect(l.above?.businessId).toBe('b_cuppa');
    expect(l.below).toBeNull();
    // three people in the cafe table, three prize places: I am in the prize places today
    expect(l.toPrize).toBe(0);
    expect(l.me?.prize).toBeGreaterThan(0);
    expect(ladderLine(l)).toContain('prize places today');
  });

  it('a fourth human above me pushes me out: the gap to the last prize place is shown', () => {
    const board = [
      { businessId: 'b_x', niche: 'cafe' as const, rank: 1, netWorth: 40_000, isAi: false, bankrupt: false },
      ...ownerView.leaderboards.cafe!.map((s) => ({ ...s, rank: s.rank + 1 })),
    ];
    const view: OwnerView = { ...ownerView, leaderboards: { cafe: board }, neighbors: [...ownerView.neighbors, { ...biz('b_cuppa'), id: 'b_x', name: 'Xpresso', placeId: 'p_e4_bow' }] };
    const l = ladderOf(view)!;
    expect(l.me?.rank).toBe(4);
    expect(l.me?.prize).toBeNull();
    expect(l.cutoff?.businessId).toBe('b_cuppa');
    expect(l.toPrize).toBe(27_900 - 24_100);
    expect(ladderLine(l)).toBe('$3,800 more net worth and you pass Cuppa Joe East into the prize places.');
  });

  it('is empty before I own a business', () => {
    expect(ladderOf({ ...ownerView, business: null })).toBeNull();
  });
});

describe('the main rival', () => {
  it('is the nearest open cafe that splits my foot traffic', () => {
    const r = mainRival(ownerView, places, packs)!;
    expect(r.biz.id).toBe('b_cuppa');
    expect(r.sharesStreet).toBe(true);
    expect(r.gap).toBe(27_900 - 24_100);
    expect(r.why).toMatch(/split one stream of people/);
  });

  it('without a cafe on my street, it is the one right above me in the table', () => {
    const neighbors = ownerView.neighbors.map((n) => (n.id === 'b_cuppa' ? { ...n, placeId: 'p_2av_10' } : n));
    const r = mainRival({ ...ownerView, neighbors }, places, packs)!;
    expect(r.biz.id).toBe('b_cuppa');
    expect(r.sharesStreet).toBe(false);
    expect(r.why).toBe('Right above you in the table, $3,800 ahead. Pass them and you take #2.');
  });
});

describe('two moves with a neighbor', () => {
  it('team up: same trade buys together, with the money for me', () => {
    const t = teamUpMove(ownerView, biz('b_tompkins'), 400);
    expect(t.kind).toBe('joint_purchase');
    // −6% on last month's $7,380 of ingredients
    expect(t.value).toBe('+$443/mo for you: ingredients −6%');
  });

  it('team up skips kinds that are taken or do not fit', () => {
    // joint purchasing with Cuppa is already active; cross-promo needs another trade: a loan is left
    expect(teamUpMove(ownerView, biz('b_cuppa'), 30).kind).toBe('loan');
    // Fade already offered me a cross-promo, so the move falls to a loan
    expect(teamUpMove(ownerView, biz('b_fade'), 60).kind).toBe('loan');
  });

  it('team up is off with the reason when they are closed by the city', () => {
    const t = teamUpMove(ownerView, biz('b_ninth'), 320);
    expect(t.allowed).toBe(false);
    expect(t.reason).toBe('They are closed by the city right now');
  });

  it('report: fines and closure from the packs if right; the false report price if wrong', () => {
    const m = reportMove(ownerView, packs, biz('b_fade'));
    expect(m.allowed).toBe(true);
    expect(m.ifRight).toBe('If you are right: they pay $300–$1,000 and can be closed for up to 3 days. Your name stays hidden.');
    // one false report already on file
    expect(m.ifWrong).toBe(`If you are wrong: you pay $${RULES.FALSE_REPORT_FINE} and Fade Factory learns your name.`);
    const clean = reportMove({ ...ownerView, extra: { myReports: [] } } as OwnerView, packs, biz('b_fade'));
    expect(clean.ifWrong).toMatch(/^If you are wrong: a warning\./);
  });
});

describe('the neighbors feed, with what it means for me', () => {
  it('a cafe opening on my street is bad news; a different trade nearby is a partner', () => {
    const news = rivalNews(withFeed([
      { id: 'a', day: 40, kind: 'opening', text: 'Tompkins Grind opened its doors', businessId: 'b_tompkins' },
      { id: 'b', day: 41, kind: 'opening', text: 'Fade Factory opened its doors', businessId: 'b_fade' },
      { id: 'c', day: 42, kind: 'opening', text: 'Cuppa Joe East opened its doors', businessId: 'b_cuppa' },
    ]), places, packs);
    expect(news.map((n) => [n.id, n.tone])).toEqual([['c', 'bad'], ['b', 'good'], ['a', 'info']]);
    expect(news[0].meaning).toMatch(/^Opens on your street/);
  });

  it('a rival closed by the city or gone bankrupt is good news; a report on me is bad', () => {
    const news = rivalNews(withFeed([
      { id: 'x', day: 44, kind: 'inspection', text: 'Cuppa Joe East is closed for 3 days by city order', businessId: 'b_cuppa' },
      { id: 'y', day: 43, kind: 'bankruptcy', text: 'Lower East Brew went bankrupt', businessId: 'b_les' },
      { id: 'z', day: 45, kind: 'report', text: 'Someone reported Luna Cafe to the city', businessId: MY_ID },
    ]), places, packs);
    expect(news.map((n) => [n.id, n.tone])).toEqual([['z', 'bad'], ['x', 'good'], ['y', 'good']]);
    expect(news[1].meaning).toMatch(/^Closed for 3 days/);
  });

  it('keeps the block fund line of my block and drops lines that do not touch me', () => {
    const news = rivalNews(withFeed([
      { id: 'bf', day: 30, kind: 'deal', text: 'E 7th St, 1st–2nd Ave: 5 of 7 businesses chipped in. Street cleaning and lights next month: +5% foot traffic for the whole block.' },
      { id: 'far', day: 31, kind: 'opening', text: 'Bowery Cuts opened its doors', businessId: 'b_bowery' },
      { id: 'mine', day: 32, kind: 'opening', text: 'Luna Cafe opened its doors', businessId: MY_ID },
    ]), places, packs);
    expect(news.map((n) => n.id)).toEqual(['bf']);
  });

  it('a joint purchase between rivals means they buy cheaper', () => {
    const news = rivalNews(withFeed([{ id: 'j', day: 46, kind: 'deal', text: 'Tompkins Grind and Cuppa Joe East started a joint purchasing deal.', businessId: 'b_tompkins' }]), places, packs);
    expect(news[0].meaning).toBe('They now buy 6% cheaper: room to cut prices against you.');
  });
});

describe('since you last looked', () => {
  it('a price cut on my street and my move in the table', () => {
    const prev = { ...snapshotOf(ownerView), day: 40, myRank: 4 };
    prev.prices.b_cuppa = 5.4;
    const out = changesSince(ownerView, places, packs, prev);
    expect(out[0].text).toBe('You moved up to #3 in cafes (was #4)');
    expect(out[0].tone).toBe('good');
    const cut = out.find((n) => n.businessId === 'b_cuppa')!;
    expect(cut.text).toBe('Cuppa Joe East cut its price: $5.40 → $4.95');
    expect(cut.tone).toBe('bad');
    expect(cut.meaning).toMatch(/^\$0\.30 cheaper than you now\./);
  });

  it('nothing to compare on the first visit', () => {
    expect(changesSince(ownerView, places, packs, null)).toEqual([]);
  });

  it('only a snapshot from an earlier day of this season counts', () => {
    const s = snapshotOf(ownerView);
    expect(lastLook({ ...s, day: 40 }, 47)?.day).toBe(40);
    expect(lastLook(s, 47)).toBeNull();                  // today
    expect(lastLook({ ...s, day: 90 }, 47)).toBeNull();  // another season
    expect(lastLook('garbage', 47)).toBeNull();
  });
});

describe('when to come back', () => {
  it('real time until the month closes', () => {
    // day 47 of month 2: the rest of today plus 13 more days of 2 s
    expect(msToMonthClose(ownerView)).toBe(1_200 + 13 * 2_000);
    expect(msToMonthClose({ ...ownerView, world: { ...ownerView.world, config: { ...ownerView.world.config, paused: true } } })).toBeNull();
  });
});

describe('incoming: what each answer does', () => {
  it('contesting pays off only for big fines', () => {
    const [, big] = noticeChoices(10_000, 0);
    expect(big.outcome).toContain('$8,500 in total, $1,500 less than paying');
    const [pay, small] = noticeChoices(2_000, 3);
    expect(pay.outcome).toBe('You pay $2,000 now. Closed for 3 days either way.');
    expect(small.outcome).toContain('$2,900 in total, $900 more than paying');
  });

  it('declining an offer leaves no mark', () => {
    const [accept, decline] = offerChoices(ownerView.deals[0], ownerView);
    expect(accept.outcome).toMatch(/kept deal/);
    expect(decline.outcome).toBe('Nothing changes for you. Declining leaves no mark on your record.');
  });
});
