// Example states of the brief, built from the shared app fixtures (client/src/app/fixtures.ts).
// The live city config is used: a game day is 48 real minutes, so a month report lands once a real day.
import type { CaseNotice, Deal, MonthReport, OwnerView } from '@ohh/shared/types';
import { RULES } from '@ohh/shared/rules';
import { demoConfig, ownerView, worldPublic } from '../../app/fixtures';

export type BriefFixture = 'away' | 'notice' | 'offer' | 'month' | 'closed' | 'bankrupt' | 'calm' | 'none';
export const BRIEF_FIXTURES: BriefFixture[] = ['away', 'notice', 'offer', 'month', 'closed', 'bankrupt', 'calm', 'none'];

const liveConfig = { ...demoConfig, id: 'live', name: 'New York', demo: false, dayMs: RULES.DAY_MS_LIVE };

const notice: CaseNotice = {
  caseId: 'c-health-1', role: 'inspector', found: [{ violationId: 'cold_holding', months: 1, fine: 1_200, closureDays: 0 }],
  fine: 1_200, closureDays: 0, answerByDay: 76, status: 'notice',
};

const offer: Deal = {
  id: 'd-loan-3', fromBusinessId: 'b03', toBusinessId: 'b01', terms: { type: 'loan', amount: 8_000, monthlyRatePct: 2, months: 6 },
  status: 'proposed', proposedDay: 73, expiresDay: 77,
};

/** February closed at the end of day 60; the player looked on day 55 and comes back on day 61. */
function monthState(): OwnerView {
  const b = ownerView.business!;
  const feb = b.history[0];
  const jan: MonthReport = { ...feb, month: 1, revenue: 31_900, profit: -2_150, servedUnits: 4_980, cashStart: 41_000, cashEnd: 35_180 };
  const mar: MonthReport = { ...feb, month: 2 };
  const shift = 74 - 61;
  return {
    ...ownerView, world: worldPublic(61, 1_100, liveConfig), away: { days: 6, profit: 3_240, items: [] },
    me: { ...ownerView.me, inbox: ownerView.me.inbox.map((i) => ({ ...i, day: i.day - shift })) },
    feed: ownerView.feed.map((f) => ({ ...f, day: f.day - shift })),
    business: { ...b, history: [jan, mar] },
    events: ownerView.events.map((e) => ({ ...e, announcedDay: 58, startDay: 62, endDay: 70 })),
  };
}

export function briefFixture(name: BriefFixture): OwnerView {
  const base: OwnerView = { ...ownerView, world: worldPublic(74, 1_200, liveConfig) };
  switch (name) {
    case 'away': return base;
    case 'notice': return { ...base, notices: [notice] };
    case 'offer': return { ...base, deals: [...base.deals, offer] };
    case 'month': return monthState();
    case 'closed': return { ...base, business: { ...base.business!, status: 'closed', closedUntilDay: 77 } };
    case 'bankrupt': return { ...base, business: { ...base.business!, status: 'bankrupt', bankruptDay: 72, cash: -2_496 }, recommendations: [] };
    case 'calm': return { ...base, away: null, recommendations: [], me: { ...base.me, inbox: [] } };
    case 'none': return { ...base, business: null, away: null };
  }
}
