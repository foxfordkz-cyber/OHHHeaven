import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Action, Deal, OwnerView } from '../../../../shared/src/types';
import { NetworkTab } from './NetworkTab';
import { RivalStripView } from './RivalStrip';
import { MY_ID, ownerView, ownerViewBusyWeek, ownerViewSetup, packs, places, TODAY } from './fixtures';

afterEach(cleanup);

function setup(view: OwnerView = ownerView) {
  const onAct = vi.fn<(a: Action) => unknown>();
  render(<NetworkTab view={view} places={places} packs={packs} onAct={onAct} />);
  return onAct;
}

const openNeighbor = (name: string) => {
  fireEvent.click(within(screen.getByRole('region', { name: 'Neighbors' })).getByRole('button', { name: new RegExp(`^${name}`) }));
  return screen.getByRole('dialog', { name });
};

const openDealSheet = (name: string) => {
  fireEvent.click(within(openNeighbor(name)).getByRole('button', { name: /All deal kinds/ }));
  return screen.getByRole('dialog', { name: `Deal with ${name}` });
};

const kind = (sheet: HTMLElement, title: string) => within(sheet).getByRole('radio', { name: new RegExp(`^${title}`) });

describe('Network tab: neighbors', () => {
  it('lists neighbors with niche, distance, price, place in niche, deal record and the AI mark', () => {
    setup();
    const row = within(screen.getByRole('region', { name: 'Neighbors' })).getByRole('button', { name: /^Tompkins Grind/ });
    expect(row.textContent).toMatch(/Cafe · \d+ m · \$5\.50 · #6 in cafes/);
    expect(row.textContent).toContain('kept 4 · broke 1');
    expect(within(row).getByText('AI')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Luna Cafe/ })).toBeNull();
    const neighbors = screen.getByRole('region', { name: 'Neighbors' });
    expect(within(neighbors).getByRole('button', { name: /^Cuppa Joe East/ }).textContent).toContain('Shares your street');
    expect(row.textContent).not.toContain('Shares your street');      // Tompkins is a cafe, but far away
  });

  it('shows the closest 12 neighbors first and the rest on request', () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ ...ownerView.neighbors[1], id: `n${i}`, name: `Neighbor ${String(i).padStart(2, '0')}`, partners: [] }));
    setup({ ...ownerView, neighbors: many, deals: [] });
    const list = screen.getByRole('region', { name: 'Neighbors' });
    expect(list.querySelectorAll('.list-row')).toHaveLength(12);
    fireEvent.click(within(list).getByRole('button', { name: 'Show all 15 neighbors' }));
    expect(list.querySelectorAll('.list-row')).toHaveLength(15);
  });

  it('switches to the map and back', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Map' }));
    expect(screen.getByRole('img', { name: 'Map of the neighborhood' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'List' }));
    expect(screen.getByRole('button', { name: /^Fade Factory/ })).toBeTruthy();
  });

  it('shows open data and partners in the profile', () => {
    setup();
    const profile = openNeighbor('Cuppa Joe East');
    expect(profile.textContent).toContain('Run by Maya R.');
    expect(profile.textContent).toContain('Health grade A');
    expect(profile.textContent).toContain('kept 3 · broke 0');
    expect(profile.textContent).toContain('Active partners');
    expect(within(profile).getByRole('button', { name: /^Report$/ })).toBeTruthy();
  });
});

describe('Network tab: propose a deal builds the right Action', () => {
  it('joint purchasing with a cafe', () => {
    const onAct = setup();
    const sheet = openDealSheet('Tompkins Grind');
    expect(kind(sheet, 'Joint purchasing').getAttribute('aria-checked')).toBe('true');
    expect(sheet.textContent).toContain('Ingredients −6% for both while the deal lasts');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Increase Months' }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Send offer' }));
    expect(onAct).toHaveBeenCalledWith({ type: 'propose_deal', toBusinessId: 'b_tompkins', terms: { type: 'joint_purchase', months: 4 } });
    expect(within(screen.getByRole('dialog', { name: 'Deal with Tompkins Grind' })).getByRole('status').textContent).toContain('Offer sent');
  });

  it('cross-promo with a corner store 290 m away', () => {
    const onAct = setup();
    const sheet = openDealSheet('Avenue A Deli & Grocery');
    expect(kind(sheet, 'Cross-promo').getAttribute('aria-checked')).toBe('true');
    expect(sheet.textContent).toContain('About +6% customers for both, small discount');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Decrease Months' }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Send offer' }));
    expect(onAct).toHaveBeenCalledWith({ type: 'propose_deal', toBusinessId: 'b_avea', terms: { type: 'cross_promo', months: 2 } });
  });

  it('loan: amount, monthly interest, term and the payment schedule', () => {
    const onAct = setup();
    const sheet = openDealSheet('Cuppa Joe East');
    expect(kind(sheet, 'Loan').getAttribute('aria-checked')).toBe('true');
    fireEvent.change(within(sheet).getByRole('spinbutton', { name: 'Amount to lend' }), { target: { value: '2500' } });
    fireEvent.change(within(sheet).getByRole('spinbutton', { name: 'Interest per month' }), { target: { value: '2.5' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Increase Months' }));
    const schedule = within(sheet).getByRole('table', { name: 'Payment schedule' });
    expect(schedule.querySelectorAll('tbody tr')).toHaveLength(7);
    expect(sheet.textContent).toContain('If they go bankrupt, the money left in the deal is lost');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Send offer' }));
    expect(onAct).toHaveBeenCalledWith({ type: 'propose_deal', toBusinessId: 'b_cuppa', terms: { type: 'loan', amount: 2500, monthlyRatePct: 2.5, months: 7 } });
  });

  it('partner up: amount and share', () => {
    const onAct = setup();
    const sheet = openDealSheet('Cuppa Joe East');
    fireEvent.click(kind(sheet, 'Partner up'));
    fireEvent.change(within(sheet).getByRole('spinbutton', { name: 'Amount to invest' }), { target: { value: '4000' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Increase Your share' }));
    expect(sheet.textContent).toMatch(/11%/);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Send offer' }));
    expect(onAct).toHaveBeenCalledWith({ type: 'propose_deal', toBusinessId: 'b_cuppa', terms: { type: 'partnership', amount: 4000, sharePct: 11 } });
  });

  it('does not send a loan above the interest limit', () => {
    const onAct = setup();
    const sheet = openDealSheet('Cuppa Joe East');
    fireEvent.change(within(sheet).getByRole('spinbutton', { name: 'Interest per month' }), { target: { value: '6' } });
    expect(within(sheet).getByRole('alert').textContent).toBe('Interest is 0–5% a month');
    const send = within(sheet).getByRole('button', { name: 'Send offer' }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.click(send);
    expect(onAct).not.toHaveBeenCalled();
  });
});

describe('Network tab: unavailable deal kinds follow CONTRACT §4', () => {
  it('same niche: cross-promo is greyed with the reason and cannot be picked', () => {
    setup();
    const sheet = openDealSheet('Cuppa Joe East');
    const cross = kind(sheet, 'Cross-promo');
    expect(cross.getAttribute('aria-disabled')).toBe('true');
    expect(cross.textContent).toContain('Cross-promo needs a different niche within 400 m');
    fireEvent.click(cross);
    expect(cross.getAttribute('aria-checked')).toBe('false');
    expect(kind(sheet, 'Joint purchasing').textContent).toContain('You already have a joint purchasing deal with them');
  });

  it('different niche too far away: no cross-promo; different niche: no joint purchasing', () => {
    setup();
    const sheet = openDealSheet('Bowery Cuts');
    expect(kind(sheet, 'Cross-promo').getAttribute('aria-disabled')).toBe('true');
    expect(kind(sheet, 'Cross-promo').textContent).toMatch(/within 400 m — they are \d+ m away/);
    expect(kind(sheet, 'Joint purchasing').getAttribute('aria-disabled')).toBe('true');
    expect(kind(sheet, 'Joint purchasing').textContent).toContain('Joint purchasing needs the same niche');
    expect(kind(sheet, 'Loan').getAttribute('aria-disabled')).toBe('false');
  });

  it('a business closed by the city: every kind is off and nothing can be sent', () => {
    setup();
    const sheet = openDealSheet('Ninth & Second Coffee');
    for (const t of ['Joint purchasing', 'Cross-promo', 'Loan', 'Partner up']) {
      expect(kind(sheet, t).getAttribute('aria-disabled')).toBe('true');
      expect(kind(sheet, t).textContent).toContain('They are closed by the city right now');
    }
    expect(within(sheet).queryByRole('button', { name: 'Send offer' })).toBeNull();
  });

  it('four active deals is the maximum', () => {
    const active = (id: string, to: string): Deal => ({ id, fromBusinessId: MY_ID, toBusinessId: to, terms: { type: 'loan', amount: 500, monthlyRatePct: 1, months: 3 }, status: 'active', proposedDay: 30, expiresDay: 33, startDay: 31 });
    const view: OwnerView = { ...ownerView, deals: [active('x1', 'b_cuppa'), active('x2', 'b_fade'), active('x3', 'b_avea'), active('x4', 'b_bowery')] };
    setup(view);
    const sheet = openDealSheet('Tompkins Grind');
    expect(kind(sheet, 'Joint purchasing').textContent).toContain('You already have 4 active deals, the maximum');
    expect(kind(sheet, 'Partner up').getAttribute('aria-disabled')).toBe('true');
  });
});

describe('Network tab: offers, my deals, block fund', () => {
  it('accepts and declines incoming offers', () => {
    const onAct = setup();
    const offers = screen.getByRole('region', { name: 'Waiting for your answer' });
    // the most urgent answer shows first; the rest are one tap away
    expect(offers.querySelectorAll('[data-deal]').length).toBe(1);
    expect(offers.querySelector('[data-deal="d2"]')).not.toBeNull();   // Bowery's offer expires first
    fireEvent.click(within(offers).getByRole('button', { name: 'Show all 2' }));
    const fromFade = offers.querySelector<HTMLElement>('[data-deal="d1"]')!;
    expect(fromFade.textContent).toContain('Fade Factory');
    expect(fromFade.textContent).toContain('kept 1 · broke 0');
    fireEvent.click(within(fromFade).getByRole('button', { name: 'Accept' }));
    expect(onAct).toHaveBeenLastCalledWith({ type: 'answer_deal', dealId: 'd1', accept: true });
    fireEvent.click(within(offers.querySelector<HTMLElement>('[data-deal="d2"]')!).getByRole('button', { name: 'Decline' }));
    expect(onAct).toHaveBeenLastCalledWith({ type: 'answer_deal', dealId: 'd2', accept: false });
  });

  it('ends a deal early only after the trust warning', () => {
    const onAct = setup();
    const deals = screen.getByRole('region', { name: 'My deals' });
    expect(deals.textContent).toContain('2 of 4 active');
    fireEvent.click(within(deals.querySelector<HTMLElement>('[data-deal="d3"]')!).getByRole('button', { name: 'End early' }));
    const confirm = screen.getByRole('dialog', { name: 'End this deal early?' });
    expect(confirm.textContent).toContain('Your record becomes kept 2 · broke 2');
    expect(onAct).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole('button', { name: 'End early' }));
    expect(onAct).toHaveBeenCalledWith({ type: 'cancel_deal', dealId: 'd3' });
  });

  it('shows finished and broken deals with their status', () => {
    setup();
    const deals = screen.getByRole('region', { name: 'My deals' });
    expect(deals.textContent).toContain('Completed');
    expect(deals.textContent).toContain('Broken');
    expect(deals.textContent).toContain('Waiting for an answer');
  });

  it('block fund: how many chip in, what is missing, the toggle sends set_orders', () => {
    const onAct = setup();
    const fund = screen.getByRole('region', { name: 'Block fund' });
    expect(fund.textContent).toContain('2 of 7');
    expect(fund.textContent).toContain('3 more neighbors needed');
    fireEvent.click(within(fund).getByRole('switch', { name: /Chip in \$300\/month/ }));
    expect(onAct).toHaveBeenCalledWith({ type: 'set_orders', orders: { blockFund: true } });
  });

  it('block fund before the first count: still lets the owner chip in', () => {
    const onAct = setup({ ...ownerView, blockFund: null });
    const fund = screen.getByRole('region', { name: 'Block fund' });
    expect(fund.textContent).toContain('No count yet: the first one is when this month closes. 2 of the 3 open businesses on the block need to chip in.');
    fireEvent.click(within(fund).getByRole('switch', { name: /Chip in \$300\/month/ }));
    expect(onAct).toHaveBeenCalledWith({ type: 'set_orders', orders: { blockFund: true } });
  });

  it('block fund active: the bonus line, and the toggle turns paying off', () => {
    const onAct = setup(ownerViewBusyWeek);
    const fund = screen.getByRole('region', { name: 'Block fund' });
    expect(fund.textContent).toContain('Active this month: +10% foot traffic for the whole block');
    fireEvent.click(within(fund).getByRole('switch', { name: /Chip in/ }));
    expect(onAct).toHaveBeenCalledWith({ type: 'set_orders', orders: { blockFund: false } });
  });
});

describe('Network tab: report to the city', () => {
  it('reports a business picked in the sheet', () => {
    const onAct = setup();
    const card = screen.getByRole('region', { name: 'Report to the city' });
    expect(card.textContent).toContain('Tompkins Grind');
    expect(card.textContent).toContain('Nothing found — warning');
    fireEvent.click(within(card).getByRole('button', { name: /Report a business/ }));
    const sheet = screen.getByRole('dialog', { name: 'Report to the city' });
    fireEvent.change(within(sheet).getByRole('combobox', { name: 'Business' }), { target: { value: 'b_fade' } });
    fireEvent.click(within(sheet).getByRole('radio', { name: /Report off-the-books wages/ }));
    expect(sheet.textContent).toContain('Checked by: Tax auditor');
    expect(sheet.textContent).toContain('You already have a warning');
    fireEvent.click(within(sheet).getByRole('button', { name: /Send report/ }));
    expect(onAct).toHaveBeenCalledWith({ type: 'report', targetBusinessId: 'b_fade', reportId: 'report_cash_wages' });
  });

  it('reports from a neighbor profile', () => {
    const onAct = setup();
    fireEvent.click(within(openNeighbor('Avenue A Deli & Grocery')).getByRole('button', { name: /^Report$/ }));
    const sheet = screen.getByRole('dialog', { name: 'Report to the city' });
    expect(sheet.textContent).toContain('About Avenue A Deli & Grocery');
    fireEvent.click(within(sheet).getByRole('button', { name: /Send report/ }));
    expect(onAct).toHaveBeenCalledWith({ type: 'report', targetBusinessId: 'b_avea', reportId: 'report_unsanitary' });
  });

  it('one report a week: the button is off with the date of the next one', () => {
    setup(ownerViewBusyWeek);
    const card = screen.getByRole('region', { name: 'Report to the city' });
    expect((within(card).getByRole('button', { name: /Report a business/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(card.textContent).toMatch(/One report a week\. Your next report: \w{3}, Feb \d+/);
    const profile = openNeighbor('Fade Factory');
    expect((within(profile).getByRole('button', { name: /^Report$/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('Network tab: before the doors open', () => {
  it('lets the owner look around but not deal yet', () => {
    const onAct = setup(ownerViewSetup);
    expect(ownerViewSetup.world.day).toBe(TODAY);
    const sheet = openDealSheet('Cuppa Joe East');
    expect(kind(sheet, 'Loan').textContent).toContain('Open your doors first');
    expect(within(sheet).queryByRole('button', { name: 'Send offer' })).toBeNull();
    expect(onAct).not.toHaveBeenCalled();
  });
});

describe('Network tab: rivals and prizes in plain sight', () => {
  it('names the main rival with the two moves and what each gives or costs', () => {
    const onAct = setup();
    const card = screen.getByRole('region', { name: 'Your rival' });
    expect(card.textContent).toContain('Cuppa Joe East');
    expect(card.textContent).toContain('Run by Maya R.');
    const h2h = within(card).getByRole('table', { name: 'You against your rival' });
    const row = (label: string) => [...h2h.querySelectorAll('tr')].find((r) => r.cells[0].textContent === label)!;
    expect([...row('Price').cells].map((c) => c.textContent)).toEqual(['Price', '$5.25', '$4.95']);
    expect(row('Price').cells[2].className).toBe('nw-lead');        // cheaper wins walk-ins
    expect([...row('Net worth').cells].map((c) => c.textContent)).toEqual(['Net worth', '$24,100', '$27,900']);
    expect([...row('Place').cells].map((c) => c.textContent)).toEqual(['Place', '#3', '#2']);
    expect(card.textContent).toMatch(/split one stream of people/);
    expect(card.textContent).toContain('If you are right: they pay $300–$1,000');
    expect(card.textContent).toContain('If you are wrong: you pay $500 and Cuppa Joe East learns your name.');
    // joint purchasing with Cuppa is already running, so «Team up» opens the deal sheet on a loan
    fireEvent.click(within(card).getByRole('button', { name: 'Team up' }));
    const sheet = screen.getByRole('dialog', { name: 'Deal with Cuppa Joe East' });
    expect(kind(sheet, 'Loan').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Send offer' }));
    expect(onAct).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'propose_deal', toBusinessId: 'b_cuppa', terms: expect.objectContaining({ type: 'loan' }) }));
  });

  it('reports the rival straight from the rival card', () => {
    const onAct = setup();
    fireEvent.click(within(screen.getByRole('region', { name: 'Your rival' })).getByRole('button', { name: 'Report' }));
    const sheet = screen.getByRole('dialog', { name: 'Report to the city' });
    fireEvent.click(within(sheet).getByRole('button', { name: /Send report/ }));
    expect(onAct).toHaveBeenCalledWith({ type: 'report', targetBusinessId: 'b_cuppa', reportId: 'report_unsanitary' });
  });

  it('shows my place, the prize today and when the month closes', () => {
    setup();
    const card = screen.getByRole('region', { name: 'Your place' });
    expect(card.textContent).toContain('#3 of 4 cafes'); // Lower East Brew is bankrupt and does not count
    expect(card.textContent).toContain('You are in the prize places today.');
    expect(card.textContent).toContain('#2 Cuppa Joe East');
    expect(card.textContent).toContain('$3,800 ahead of you');
    expect(card.textContent).toMatch(/Month closes in \d+s/);
  });

  it('every neighbor line says what it means for me', () => {
    setup();
    const card = screen.getByRole('region', { name: 'Next door' });
    expect(card.textContent).toContain('Lower East Brew went bankrupt');
    expect(card.textContent).toContain('One less cafe splitting your street');
    expect(card.textContent).toContain('They now buy 6% cheaper');
    expect(card.textContent).not.toContain('Bowery Cuts opened');
  });

  it('a fine notice shows what paying and contesting cost, and sends the answer', () => {
    const notice = { caseId: 'c_fine', role: 'inspector' as const, found: [{ violationId: 'pests', months: 1, fine: 400, closureDays: 2 }], fine: 400, closureDays: 2, answerByDay: TODAY + 2, status: 'notice' as const };
    const onAct = setup({ ...ownerView, notices: [notice] });
    const card = screen.getByRole('region', { name: 'Waiting for your answer' }).querySelector<HTMLElement>('[data-case="c_fine"]')!;
    expect(card.textContent).toContain('Evidence of mice or roaches');
    expect(card.textContent).toContain('You pay $400 now. Closed for 2 days either way.');
    expect(card.textContent).toContain('$1,780 in total, $1,380 more than paying');
    fireEvent.click(within(card).getByRole('button', { name: 'Pay' }));
    expect(onAct).toHaveBeenLastCalledWith({ type: 'answer_notice', caseId: 'c_fine', response: 'pay' });
  });
});

describe('Network tab: a neighbor who reported me falsely', () => {
  it('shows who it was and lets me strike back or team up', () => {
    const reveal = { id: 'law:c7:reveal', day: TODAY - 2, kind: 'case' as const, title: 'The report came from Fade Factory', text: 'Fade Factory reported you to the city, and the inspection found nothing. They were fined $500.', ref: { type: 'business' as const, id: 'b_fade' }, read: false };
    const view = { ...ownerView, me: { ...ownerView.me, inbox: [...ownerView.me.inbox, reveal] } };
    const onAct = setup(view);
    const box = screen.getByRole('region', { name: 'Waiting for your answer' });
    expect(box.querySelector('[data-deal]')).toBeNull();            // who reported me goes before offers
    const card = box.querySelector<HTMLElement>('[data-reveal="b_fade"]')!;
    expect(card.textContent).toContain('The report came from Fade Factory');
    expect(card.textContent).toContain('If you are right: they pay');
    fireEvent.click(within(card).getByRole('button', { name: 'Report' }));
    const sheet = screen.getByRole('dialog', { name: 'Report to the city' });
    expect(sheet.textContent).toContain('About Fade Factory');
    expect(onAct).not.toHaveBeenCalled();
  });

  it('an old reveal (over a game month) is gone', () => {
    const reveal = { id: 'law:c1:reveal', day: TODAY - 31, kind: 'case' as const, title: 'The report came from Fade Factory', text: '', ref: { type: 'business' as const, id: 'b_fade' }, read: true };
    setup({ ...ownerView, me: { ...ownerView.me, inbox: [reveal] } });
    expect(document.querySelector('[data-reveal]')).toBeNull();
  });
});

describe('Rival strip for other screens', () => {
  it('names the rival and my place, and opens the Network tab', () => {
    const onOpen = vi.fn();
    render(<RivalStripView view={ownerView} places={places} packs={packs} onOpen={onOpen} />);
    const card = screen.getByRole('region', { name: 'Rival summary' });
    expect(card.textContent).toContain('Cuppa Joe East');
    expect(card.textContent).toContain('$3,800 ahead of you');
    expect(card.textContent).toMatch(/You are #3 of 4 · prize today \$/);
    fireEvent.click(within(card).getByRole('button', { name: /Team up or report/ }));
    expect(onOpen).toHaveBeenCalled();
  });

  it('renders nothing before I own a business', () => {
    const { container } = render(<RivalStripView view={{ ...ownerView, business: null }} places={places} packs={packs} onOpen={() => {}} />);
    expect(container.textContent).toBe('');
  });
});
