import { useMemo, useState } from 'react';
import type { Action, Deal, OwnerView, PackSet, Place, PublicBusiness } from '../../../../shared/src/types';
import { RULES, dateOf } from '../../../../shared/src/rules';
import { AiBadge, Badge, Button, Card, CityMap, ListRow, MoneyText, ProgressBar, SegmentedControl, Sheet, Toggle } from './ui';
import { Lines, Stars } from './fields';
import { ProposeDealSheet } from './ProposeDealSheet';
import { ReportSheet } from './ReportSheet';
import {
  act, blockFundInfo, daysLeftText, dealEffect, dealEndDay, endEarlyWarning, formatDistance, groupDeals, lastMonthDealMoney,
  monthBase, myReports, neighborRows, NICHE_LABEL, otherId, reportEligibility, reportInboxItems, reportLimit, reportName,
  reportOutcomeText, sideOf, termsSummary, trustLabel, type NeighborRow, type NetworkExtra,
} from './logic';
import './network.css';

export interface NetworkTabProps {
  view: OwnerView & { extra?: Partial<NetworkExtra> };
  places: Place[];
  packs: PackSet;
  onAct: (a: Action) => unknown;
}

type Panel =
  | { kind: 'profile'; id: string }
  | { kind: 'deal'; id: string }
  | { kind: 'report'; id?: string }
  | { kind: 'end'; dealId: string }
  | null;

/** Network tab of /biz: neighbors, deals, block fund, report to the city. Reads only OwnerView. */
export function NetworkTab(props: NetworkTabProps) {
  const { view, places, packs, onAct } = props;
  const me = view.business;
  const [mode, setMode] = useState<'list' | 'map'>('list');
  const [panel, setPanel] = useState<Panel>(null);
  const rows = useMemo(() => neighborRows(view, places), [view, places]);
  const groups = useMemo(() => groupDeals(view.deals, me?.id), [view.deals, me?.id]);
  const nameOf = (id: string) => view.neighbors.find((n) => n.id === id)?.name ?? 'a business';
  const bizOf = (id: string) => view.neighbors.find((n) => n.id === id);
  const rowOf = (id: string) => rows.find((r) => r.biz.id === id);
  const close = () => setPanel(null);

  return (
    <div className="nw" data-testid="network-tab">
      <header className="nw-head">
        <h2>Network</h2>
        {me && <span className="nw-head__trust" title="Deals kept and broken. Every neighbor sees this.">Your record: {trustLabel(me.trust)}</span>}
      </header>

      {groups.incoming.length > 0 && me && (
        <Card title="Offers for you" aside={`${groups.incoming.length} waiting`} testId="incoming">
          {groups.incoming.map((d) => (
            <IncomingOffer key={d.id} deal={d} view={view} author={bizOf(d.fromBusinessId)} onAct={onAct} />
          ))}
        </Card>
      )}

      <Card title="Neighbors" aside={<SegmentedControl ariaLabel="Show neighbors as" value={mode} onChange={setMode} options={[{ value: 'list', label: 'List' }, { value: 'map', label: 'Map' }]} />} testId="neighbors">
        {mode === 'list' ? (
          rows.length === 0 ? <p className="ui-muted">No neighbors yet. The city fills up as people open businesses.</p> : rows.map((r) => <NeighborListRow key={r.biz.id} row={r} onOpen={() => setPanel({ kind: 'profile', id: r.biz.id })} />)
        ) : (
          <CityMap mode="live" places={places} businesses={view.neighbors} myBusinessId={me?.id} onOpenBusiness={(id) => id !== me?.id && setPanel({ kind: 'profile', id })} />
        )}
      </Card>

      <MyDeals view={view} groups={groups} nameOf={nameOf} onEndEarly={(dealId) => setPanel({ kind: 'end', dealId })} />

      {view.blockFund && me && <BlockFundCard view={view} onAct={onAct} />}

      <ReportsCard view={view} packs={packs} nameOf={nameOf} onReport={() => setPanel({ kind: 'report' })} />

      {panel?.kind === 'profile' && rowOf(panel.id) && (
        <NeighborProfile
          row={rowOf(panel.id)!} view={view} places={places} nameOf={nameOf} onClose={close}
          onPropose={() => setPanel({ kind: 'deal', id: panel.id })} onReport={() => setPanel({ kind: 'report', id: panel.id })}
        />
      )}
      {panel?.kind === 'deal' && bizOf(panel.id) && (
        <ProposeDealSheet key={panel.id} open onClose={close} view={view} target={bizOf(panel.id)!} distanceM={rowOf(panel.id)?.distanceM ?? null} onAct={onAct} />
      )}
      {panel?.kind === 'report' && (
        <ReportSheet key={panel.id ?? 'pick'} open onClose={close} view={view} packs={packs} target={panel.id ? bizOf(panel.id) : undefined} onAct={onAct} />
      )}
      {panel?.kind === 'end' && me && (
        <Sheet open onClose={close} title="End this deal early?" testId="end-early">
          <p>{endEarlyWarning(me.trust)}</p>
          <div className="nw-actions">
            <Button variant="secondary" onClick={close}>Keep the deal</Button>
            <Button variant="danger" onClick={() => { onAct(act.cancelDeal(panel.dealId)); close(); }}>End early</Button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function StatusBadge({ biz }: { biz: PublicBusiness }) {
  if (biz.status === 'closed') return <Badge tone="bad">Closed by the city</Badge>;
  if (biz.status === 'bankrupt') return <Badge tone="bad">Bankrupt</Badge>;
  if (biz.status === 'setup') return <Badge>Opening soon</Badge>;
  return null;
}

function NeighborListRow({ row, onOpen }: { row: NeighborRow; onOpen: () => void }) {
  const b = row.biz;
  return (
    <ListRow
      onClick={onOpen} testId={`neighbor-${b.id}`} ariaLabel={`Open ${b.name}`}
      title={<>{b.name}{b.isAi && <AiBadge />}<StatusBadge biz={b} /></>}
      subtitle={`${NICHE_LABEL[b.niche]} · ${formatDistance(row.distanceM)} · ${money2(b.price)} · #${b.rankInNiche} in ${NICHE_LABEL[b.niche].toLowerCase()}s`}
      right={<><Stars value={b.reputation} /><div className="nw-trust">{trustLabel(b.trust)}</div></>}
    />
  );
}

const money2 = (n: number) => `$${n.toFixed(2)}`;

function NeighborProfile(props: {
  row: NeighborRow; view: OwnerView & { extra?: Partial<NetworkExtra> }; places: Place[]; nameOf: (id: string) => string;
  onClose: () => void; onPropose: () => void; onReport: () => void;
}) {
  const b = props.row.biz;
  const place = props.places.find((p) => p.id === b.placeId);
  const report = reportEligibility(props.view.business, b, reportLimit(props.view));
  return (
    <Sheet open onClose={props.onClose} title={b.name} testId="neighbor-profile">
      <div className="nw-profile__tags">
        <Badge>{NICHE_LABEL[b.niche]}</Badge>
        {b.isAi ? <AiBadge /> : <Badge tone="accent">Run by {b.ownerName}</Badge>}
        <StatusBadge biz={b} />
        {b.grade && <Badge tone={b.grade === 'A' ? 'good' : 'warn'}>Grade {b.grade}</Badge>}
      </div>
      <dl className="nw-facts">
        <div><dt>Address</dt><dd>{place?.address ?? '—'}{place ? ` · ${place.block}` : ''}</dd></div>
        <div><dt>Distance</dt><dd>{formatDistance(props.row.distanceM)}</dd></div>
        <div><dt>Price</dt><dd>{money2(b.price)}</dd></div>
        <div><dt>Reputation</dt><dd><Stars value={b.reputation} /></dd></div>
        <div><dt>Place in niche</dt><dd>#{b.rankInNiche}</dd></div>
        <div><dt>Deal record</dt><dd>{trustLabel(b.trust)}</dd></div>
      </dl>
      <div className="nw-profile__partners">
        <div className="nw-effect__title">Active partners</div>
        {b.partners.length === 0 ? <p className="ui-muted">No active deals.</p> : <Lines lines={b.partners.map(props.nameOf)} />}
      </div>
      {b.isAi && <p className="ui-muted">This business is run by the computer. It answers offers by its own rules and never wins prizes.</p>}
      <div className="nw-actions nw-actions--stack">
        <Button full onClick={props.onPropose} disabled={!props.view.business}>Propose a deal</Button>
        <Button full variant="danger" onClick={props.onReport} disabled={!report.allowed} title={report.reason}>Report to the city</Button>
        {!report.allowed && <p className="ui-muted">{report.reason}</p>}
      </div>
    </Sheet>
  );
}

function IncomingOffer(props: { deal: Deal; view: OwnerView; author?: PublicBusiness; onAct: (a: Action) => unknown }) {
  const { deal, view, author } = props;
  const effect = dealEffect(deal.terms, 'to', monthBase(view.business, view.analytics));
  return (
    <div className="nw-offer" data-testid={`offer-${deal.id}`}>
      <div className="nw-offer__head">
        <strong>{author?.name ?? 'A neighbor'}</strong>
        {author?.isAi && <AiBadge />}
        <span className="nw-trust">{author ? trustLabel(author.trust) : ''}</span>
      </div>
      <div className="nw-offer__terms">{termsSummary(deal.terms)}</div>
      <Lines lines={effect.lines} />
      <div className="nw-offer__foot">
        <Badge tone="warn">{daysLeftText(deal.expiresDay, view.world.day)}</Badge>
        <div className="nw-actions">
          <Button small variant="secondary" onClick={() => props.onAct(act.answerDeal(deal.id, false))}>Decline</Button>
          <Button small onClick={() => props.onAct(act.answerDeal(deal.id, true))}>Accept</Button>
        </div>
      </div>
    </div>
  );
}

function MyDeals(props: { view: OwnerView; groups: ReturnType<typeof groupDeals>; nameOf: (id: string) => string; onEndEarly: (dealId: string) => void }) {
  const { view, groups } = props;
  const me = view.business;
  if (!me) return null;
  const base = monthBase(me, view.analytics);
  const history = [...groups.completed, ...groups.broken, ...groups.closed];
  const statusText: Partial<Record<Deal['status'], string>> = { completed: 'Completed', broken: 'Broken', cancelled: 'Ended early', declined: 'Declined', expired: 'Expired' };
  return (
    <Card title="My deals" aside={`${groups.active.length} of ${RULES.MAX_ACTIVE_DEALS} active`} testId="my-deals">
      {groups.active.length === 0 && groups.outgoing.length === 0 && history.length === 0 && (
        <p className="ui-muted">No deals yet. Open a neighbor and propose one: cafes buy together, different shops send each other customers.</p>
      )}
      {groups.active.map((d) => {
        const effect = dealEffect(d.terms, sideOf(d, me.id), base);
        const actual = lastMonthDealMoney(me, d.id);
        const end = dealEndDay(d);
        return (
          <div key={d.id} className="nw-deal" data-testid={`deal-${d.id}`}>
            <div className="nw-deal__main">
              <div className="nw-deal__title">{termsSummary(d.terms)} · {props.nameOf(otherId(d, me.id))}</div>
              <div className="nw-deal__sub">
                {effect.monthly !== null ? <>≈ <MoneyText amount={effect.monthly} signed /> a month for you</> : 'Share of profit, paid monthly'}
                {actual !== null && <> · last month <MoneyText amount={actual} signed /></>}
                {end !== null && <> · until {dateOf(end).label}</>}
                {d.terms.type === 'loan' && d.paidBack !== undefined && <> · repaid <MoneyText amount={d.paidBack} cents /></>}
              </div>
            </div>
            <Button small variant="danger" onClick={() => props.onEndEarly(d.id)}>End early</Button>
          </div>
        );
      })}
      {groups.outgoing.length > 0 && <div className="nw-subhead">Waiting for an answer</div>}
      {groups.outgoing.map((d) => (
        <ListRow key={d.id} testId={`deal-${d.id}`} title={`${termsSummary(d.terms)} · ${props.nameOf(d.toBusinessId)}`} subtitle={daysLeftText(d.expiresDay, view.world.day)} />
      ))}
      {history.length > 0 && <div className="nw-subhead">Finished</div>}
      {history.map((d) => (
        <ListRow
          key={d.id} testId={`deal-${d.id}`}
          title={`${termsSummary(d.terms)} · ${props.nameOf(otherId(d, me.id))}`}
          right={<Badge tone={d.status === 'completed' ? 'good' : d.status === 'broken' || d.status === 'cancelled' ? 'bad' : 'neutral'}>{statusText[d.status] ?? d.status}</Badge>}
        />
      ))}
    </Card>
  );
}

function BlockFundCard(props: { view: OwnerView; onAct: (a: Action) => unknown }) {
  const bf = props.view.blockFund!;
  const info = blockFundInfo(bf);
  const on = props.view.business?.orders.blockFund ?? false;
  return (
    <Card title="Block fund" aside={bf.block} testId="block-fund">
      <p className="nw-block__what">Neighbors chip in for street cleaning and lights. When {Math.round(RULES.BLOCK_FUND_THRESHOLD * 100)}% of the open businesses on the block pay, the whole block gets {info.gives.replace(' for the whole block', '')} next month — even those who did not pay.</p>
      <div className="nw-block__count"><strong>{bf.contributors} of {bf.eligible}</strong> neighbors chip in · {info.required} needed</div>
      <ProgressBar value={bf.eligible ? bf.contributors / bf.eligible : 0} marker={RULES.BLOCK_FUND_THRESHOLD} label="Neighbors who chip in" />
      <p className={`nw-block__line${info.active ? ' is-active' : ''}`} role="status">{info.line}</p>
      <Toggle label={<>Chip in <MoneyText amount={info.fee} />/month</>} checked={on} onChange={(v) => props.onAct(act.blockFund(v))} />
    </Card>
  );
}

function ReportsCard(props: { view: OwnerView & { extra?: Partial<NetworkExtra> }; packs: PackSet; nameOf: (id: string) => string; onReport: () => void }) {
  const history = myReports(props.view);
  const inbox = history.length === 0 ? reportInboxItems(props.view) : [];
  const limit = reportLimit(props.view);
  return (
    <Card title="Report to the city" aside={`${RULES.REPORTS_PER_WEEK} per week`} testId="reports">
      <p className="ui-muted">Seen a violation next door? The city sends an official. False reports cost you: a warning first, then {`$${RULES.FALSE_REPORT_FINE}`} and your name.</p>
      <Button variant="danger" full onClick={props.onReport} disabled={!props.view.business || !limit.allowed}>Report a business</Button>
      {!limit.allowed && <p className="ui-muted">{limit.reason}</p>}
      {(history.length > 0 || inbox.length > 0) && <div className="nw-subhead">My reports</div>}
      {history.map((r) => (
        <ListRow key={`${r.caseId ?? r.reportId}-${r.day}`} title={props.nameOf(r.targetBusinessId)} subtitle={`${reportName(props.packs, r.reportId)} · ${dateOf(r.day).label}`} right={<Badge tone={r.outcome === 'fined' ? 'good' : r.outcome === 'clean' ? 'warn' : 'neutral'}>{reportOutcomeText(r)}</Badge>} />
      ))}
      {inbox.map((i) => <ListRow key={i.id} title={i.title} subtitle={`${dateOf(i.day).label} · ${i.text}`} />)}
    </Card>
  );
}
