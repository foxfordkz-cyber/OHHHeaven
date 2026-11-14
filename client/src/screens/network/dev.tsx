// /dev/network pages: the Network tab on example data, no server. Actions move the example view to its next state,
// so offers, reports and the block fund can be tried by hand. This is a stand-in for the engine, not game logic.
import type { Action, ClientView, Deal, OwnerView } from '../../../../shared/src/types';
import { RULES } from '../../../../shared/src/rules';
import { DevStore } from './deps';
import { NetworkTabScreen } from './NetworkTab';
import { ownerView, ownerViewBusyWeek, ownerViewSetup, packs, places } from './fixtures';
import type { NetworkExtra } from './logic';

type View = OwnerView & { extra?: Partial<NetworkExtra> };

export function simulateNetwork(a: Action, current: ClientView): ClientView | void {
  if (current.kind !== 'owner' || !current.business) return;
  const v = current as View;
  const me = v.business!;
  const day = v.world.day;
  const bump = (next: View): View => ({ ...next, world: { ...next.world, version: next.world.version + 1 } });
  const setDeal = (id: string, patch: Partial<Deal>) => v.deals.map((d) => (d.id === id ? { ...d, ...patch } : d));
  switch (a.type) {
    case 'propose_deal': {
      const deal: Deal = { id: `dev_${v.world.version}`, fromBusinessId: me.id, toBusinessId: a.toBusinessId, terms: a.terms, status: 'proposed', proposedDay: day, expiresDay: day + RULES.DEAL_OFFER_DAYS };
      return bump({ ...v, deals: [deal, ...v.deals] });
    }
    case 'answer_deal':
      return bump({ ...v, deals: setDeal(a.dealId, a.accept ? { status: 'active', startDay: day } : { status: 'declined' }) });
    case 'cancel_deal':
      return bump({ ...v, deals: setDeal(a.dealId, { status: 'cancelled', endDay: day }), business: { ...me, trust: { ...me.trust, broken: me.trust.broken + 1 } } });
    case 'set_orders': {
      if (a.orders.blockFund === undefined || !v.blockFund) return;
      const on = a.orders.blockFund;
      const was = me.orders.blockFund;
      const contributors = Math.max(0, v.blockFund.contributors + (on === was ? 0 : on ? 1 : -1));
      return bump({ ...v, business: { ...me, orders: { ...me.orders, blockFund: on } }, blockFund: { ...v.blockFund, contributors } });
    }
    case 'report': {
      const myReports = [{ caseId: `dev_case_${v.world.version}`, targetBusinessId: a.targetBusinessId, reportId: a.reportId, day, status: 'open' as const }, ...(v.extra?.myReports ?? [])];
      return bump({ ...v, extra: { ...v.extra, myReports } });
    }
    default:
      return;
  }
}

function Page({ view, title }: { view: View; title: string }) {
  return (
    <DevStore view={view} onAct={simulateNetwork}>
      <main className="screen stack">
        <div className="eyebrow">Example data · {title}</div>
        <NetworkTabScreen places={places} packs={packs} />
      </main>
    </DevStore>
  );
}

export const DevNetwork = () => <Page view={ownerView} title="offers waiting, deals running" />;
export const DevNetworkWeek = () => <Page view={ownerViewBusyWeek} title="block fund on, report used this week" />;
export const DevNetworkSetup = () => <Page view={ownerViewSetup} title="business not open yet" />;
