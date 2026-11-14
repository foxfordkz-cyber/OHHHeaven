import { useMemo, useState } from 'react';
import type { Action, Deal, OwnerView, PackSet, Place, PublicBusiness } from '../../../../shared/src/types';
import { RULES, dateOf } from '../../../../shared/src/rules';
import { AiBadge, Badge, Button, Card, List, ListRow, MoneyText, ProgressBar, SegmentedControl, Sheet, Skeleton, Toggle } from './ui';
import { CityMapSlot, useGame, useOwnerView } from './deps';
import { usePacks, usePlaces } from './data';
import { Lines, Stars } from './fields';
import { ProposeDealSheet } from './ProposeDealSheet';
import { ReportSheet } from './ReportSheet';
import {
  act, blockFundInfo, daysLeftText, dealEffect, dealEndDay, endEarlyWarning, formatDistance, groupDeals, lastMonthDealMoney,
  monthBase, myReports, neighborRows, NICHE_LABEL, otherId, reportEligibility, reportInboxItems, reportLimit, reportName,
  reportOutcomeText, sideOf, termsSummary, trustLabel, type DealGroups, type NeighborRow, type NetworkExtra,
} from './logic';
import './network.css';

type ViewWithExtra = OwnerView & { extra?: Partial<NetworkExtra> };

export interface NetworkTabProps {
  view: ViewWithExtra;
  places: Place[];
  packs: PackSet | null;
  onAct: (a: Action) => unknown;
}

type Panel =
  | { kind: 'profile'; id: string }
  | { kind: 'deal'; id: string }
  | { kind: 'report'; id?: string }
  | { kind: 'end'; dealId: string }
  | null;

/** The Network tab inside /biz, wired to the app store. Places and packs can be passed in (dev pages, tests). */
export function NetworkTabScreen(props: { places?: Place[]; packs?: PackSet | null }) {
  const view = useOwnerView();
  const game = useGame();
  const places = usePlaces(props.places);
  const packs = usePacks(props.packs);
  if (!view) {
    return (
      <div className="stack" aria-busy="true">
        <Skeleton height={120} />
        <Skeleton height={220} />
      </div>
    );
  }
  return <NetworkTab view={view} places={places} packs={packs} onAct={(a) => void game.act(a)} />;
}

/** Neighbors, deals, block fund and reports. Reads only OwnerView; every change is an Action. */
export function NetworkTab(props: NetworkTabProps) {
  const { view, places, packs, onAct } = props;
  const me = view.business;
  const [mode, setMode] = useState<'list' | 'map'>('list');
  const [panel, setPanel] = useState<Panel>(null);
  const rows = useMemo(() => neighborRows(view, places), [view, places]);
  const groups = useMemo(() => groupDeals(view.deals, me?.id), [view.deals, me?.id]);
  const bizOf = (id: string) => view.neighbors.find((n) => n.id === id);
  const nameOf = (id: string) => bizOf(id)?.name ?? 'a business';
  const rowOf = (id: string) => rows.find((r) => r.biz.id === id);
  const close = () => setPanel(null);
  const panelBiz = panel && 'id' in panel && panel.id ? bizOf(panel.id) : undefined;

  return (
    <div className="stack nw" data-screen="network">
      {me && (
        <div className="row-between">
          <span className="small muted">Every neighbor sees your deal record.</span>
          <Badge tone={me.trust.broken > me.trust.kept ? 'loss' : 'neutral'} icon="handshake" title="Deals kept and broken">{trustLabel(me.trust)}</Badge>
        </div>
      )}
      {!me && <p className="muted">Open your business to make deals with neighbors. You can already look around.</p>}

      {groups.incoming.length > 0 && me && (
        <Card title="Offers for you" subtitle={`${groups.incoming.length} waiting for your answer`} tone="accent" aria-label="Offers for you">
          <div className="stack">
            {groups.incoming.map((d) => (
              <IncomingOffer key={d.id} deal={d} view={view} author={bizOf(d.fromBusinessId)} onAct={onAct} />
            ))}
          </div>
        </Card>
      )}

      <Card
        title="Neighbors" subtitle={`${rows.length} nearby`} aria-label="Neighbors"
        action={<SegmentedControl label="Show neighbors as" value={mode} onChange={setMode} options={[{ value: 'list', label: 'List' }, { value: 'map', label: 'Map' }]} />}
      >
        {mode === 'list' ? (
          rows.length === 0 ? (
            <div className="empty">No neighbors yet. The city fills up as people open businesses.</div>
          ) : (
            <List>
              {rows.map((r) => <NeighborListRow key={r.biz.id} row={r} onOpen={() => setPanel({ kind: 'profile', id: r.biz.id })} />)}
            </List>
          )
        ) : (
          <CityMapSlot
            mode="live" places={places} businesses={view.neighbors} myBusinessId={me?.id}
            weather={view.weather[0]} events={view.events} height={280}
            onOpenBusiness={(id) => { if (id !== me?.id && bizOf(id)) setPanel({ kind: 'profile', id }); }}
          />
        )}
      </Card>

      {me && <MyDeals view={view} groups={groups} nameOf={nameOf} onEndEarly={(dealId) => setPanel({ kind: 'end', dealId })} />}

      {me && view.blockFund && <BlockFundCard view={view} onAct={onAct} />}

      <ReportsCard view={view} packs={packs} nameOf={nameOf} onReport={() => setPanel({ kind: 'report' })} />

      {panel?.kind === 'profile' && rowOf(panel.id) && (
        <NeighborProfile
          row={rowOf(panel.id)!} view={view} places={places} nameOf={nameOf} onClose={close}
          onPropose={() => setPanel({ kind: 'deal', id: panel.id })} onReport={() => setPanel({ kind: 'report', id: panel.id })}
        />
      )}
      {panel?.kind === 'deal' && panelBiz && (
        <ProposeDealSheet key={panelBiz.id} onClose={close} view={view} target={panelBiz} distanceM={rowOf(panelBiz.id)?.distanceM ?? null} onAct={onAct} />
      )}
      {panel?.kind === 'report' && (
        <ReportSheet key={panel.id ?? 'pick'} onClose={close} view={view} packs={packs} target={panelBiz} onAct={onAct} />
      )}
      {panel?.kind === 'end' && me && (
        <Sheet
          open onClose={close} title="End this deal early?"
          footer={
            <div className="grid-2">
              <Button variant="secondary" onClick={close}>Keep the deal</Button>
              <Button variant="danger" onClick={() => { onAct(act.cancelDeal(panel.dealId)); close(); }}>End early</Button>
            </div>
          }
        >
          <p>{endEarlyWarning(me.trust)}</p>
        </Sheet>
      )}
    </div>
  );
}

function StatusBadge({ biz }: { biz: PublicBusiness }) {
  if (biz.status === 'closed') return <Badge tone="loss">Closed by the city</Badge>;
  if (biz.status === 'bankrupt') return <Badge tone="loss">Bankrupt</Badge>;
  if (biz.status === 'setup') return <Badge tone="info">Opening soon</Badge>;
  return null;
}

const price = (n: number) => `$${n.toFixed(2)}`;
const money0 = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

function NeighborListRow({ row, onOpen }: { row: NeighborRow; onOpen: () => void }) {
  const b = row.biz;
  return (
    <ListRow
      onClick={onOpen}
      title={<span className="nw-name">{b.name}{b.isAi && <AiBadge />}<StatusBadge biz={b} /></span>}
      subtitle={`${NICHE_LABEL[b.niche]} · ${formatDistance(row.distanceM)} · ${price(b.price)} · #${b.rankInNiche} in ${NICHE_LABEL[b.niche].toLowerCase()}s`}
      value={<span className="nw-rowvalue"><Stars value={b.reputation} /><span className="xsmall faint">{trustLabel(b.trust)}</span></span>}
    />
  );
}

function NeighborProfile(props: {
  row: NeighborRow; view: ViewWithExtra; places: Place[]; nameOf: (id: string) => string;
  onClose: () => void; onPropose: () => void; onReport: () => void;
}) {
  const b = props.row.biz;
  const place = props.places.find((p) => p.id === b.placeId);
  const report = reportEligibility(props.view.business, b, reportLimit(props.view));
  const canDeal = Boolean(props.view.business) && b.status !== 'bankrupt';
  return (
    <Sheet
      open onClose={props.onClose} title={b.name}
      footer={
        <div className="stack-sm">
          <Button block icon="handshake" onClick={props.onPropose} disabled={!canDeal}>Propose a deal</Button>
          <Button block variant="danger" icon="flag" onClick={props.onReport} disabled={!report.allowed} title={report.reason}>Report to the city</Button>
          {!report.allowed && <p className="xsmall muted nw-center">{report.reason}</p>}
        </div>
      }
    >
      <div className="stack">
        <div className="nw-tags">
          <Badge>{NICHE_LABEL[b.niche]}</Badge>
          {b.isAi ? <AiBadge label="Run by AI" /> : <Badge tone="accent">Run by {b.ownerName}</Badge>}
          <StatusBadge biz={b} />
          {b.grade && <Badge tone={b.grade === 'A' ? 'profit' : 'warn'}>Health grade {b.grade}</Badge>}
        </div>
        <dl className="nw-facts">
          <div><dt>Address</dt><dd>{place?.address ?? '—'}</dd></div>
          <div><dt>Distance</dt><dd>{formatDistance(props.row.distanceM)}</dd></div>
          <div><dt>Price</dt><dd className="num">{price(b.price)}</dd></div>
          <div><dt>Reputation</dt><dd><Stars value={b.reputation} /></dd></div>
          <div><dt>Place in niche</dt><dd className="num">#{b.rankInNiche}</dd></div>
          <div><dt>Deal record</dt><dd>{trustLabel(b.trust)}</dd></div>
        </dl>
        <div>
          <div className="eyebrow">Active partners</div>
          {b.partners.length === 0 ? <p className="small muted">No active deals.</p> : <Lines lines={b.partners.map(props.nameOf)} />}
        </div>
        {b.isAi && <p className="small muted">The computer runs this business. It answers offers by fixed rules and never wins prizes.</p>}
      </div>
    </Sheet>
  );
}

function IncomingOffer(props: { deal: Deal; view: OwnerView; author?: PublicBusiness; onAct: (a: Action) => unknown }) {
  const { deal, view, author } = props;
  const effect = dealEffect(deal.terms, 'to', monthBase(view.business, view.analytics));
  return (
    <div className="nw-offer" data-deal={deal.id}>
      <div className="nw-offer__head">
        <strong>{author?.name ?? 'A neighbor'}</strong>
        {author?.isAi && <AiBadge />}
        <span className="xsmall faint nw-push">{author ? trustLabel(author.trust) : ''}</span>
      </div>
      <div className="nw-offer__terms">{termsSummary(deal.terms)}</div>
      <Lines lines={effect.lines} />
      <div className="row-between">
        <Badge tone="warn" icon="hourglass">{daysLeftText(deal.expiresDay, view.world.day)}</Badge>
        <div className="row">
          <Button size="sm" variant="secondary" onClick={() => props.onAct(act.answerDeal(deal.id, false))}>Decline</Button>
          <Button size="sm" onClick={() => props.onAct(act.answerDeal(deal.id, true))}>Accept</Button>
        </div>
      </div>
    </div>
  );
}

const STATUS_TEXT: Partial<Record<Deal['status'], string>> = { completed: 'Completed', broken: 'Broken', cancelled: 'Ended early', declined: 'Declined', expired: 'Expired' };

function MyDeals(props: { view: OwnerView; groups: DealGroups; nameOf: (id: string) => string; onEndEarly: (dealId: string) => void }) {
  const { view, groups } = props;
  const me = view.business!;
  const base = monthBase(me, view.analytics);
  const history = [...groups.completed, ...groups.broken, ...groups.closed];
  const empty = groups.active.length === 0 && groups.outgoing.length === 0 && history.length === 0;
  return (
    <Card title="My deals" subtitle={`${groups.active.length} of ${RULES.MAX_ACTIVE_DEALS} active`} aria-label="My deals">
      {empty && <div className="empty">No deals yet. Open a neighbor and propose one: cafes buy together, different shops send each other customers.</div>}
      {groups.active.length > 0 && (
        <div className="nw-deals">
          {groups.active.map((d) => {
            const effect = dealEffect(d.terms, sideOf(d, me.id), base);
            const actual = lastMonthDealMoney(me, d.id);
            const end = dealEndDay(d);
            return (
              <div key={d.id} className="nw-deal" data-deal={d.id}>
                <div className="grow">
                  <div className="nw-deal__title">{termsSummary(d.terms)} · {props.nameOf(otherId(d, me.id))}</div>
                  <div className="xsmall muted">
                    {effect.monthly !== null ? <>≈ <MoneyText value={effect.monthly} signed /> a month for you</> : 'Share of their profit, paid monthly'}
                    {actual !== null && <> · last month <MoneyText value={actual} signed /></>}
                    {end !== null && <> · until {dateOf(end).label}</>}
                    {d.terms.type === 'loan' && d.paidBack !== undefined && <> · repaid <MoneyText value={d.paidBack} cents /></>}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => props.onEndEarly(d.id)}>End early</Button>
              </div>
            );
          })}
        </div>
      )}
      {groups.outgoing.length > 0 && (
        <>
          <div className="eyebrow nw-sub">Waiting for an answer</div>
          <List>
            {groups.outgoing.map((d) => (
              <ListRow key={d.id} icon="hourglass" title={`${termsSummary(d.terms)} · ${props.nameOf(d.toBusinessId)}`} subtitle={daysLeftText(d.expiresDay, view.world.day)} />
            ))}
          </List>
        </>
      )}
      {history.length > 0 && (
        <>
          <div className="eyebrow nw-sub">Finished</div>
          <List>
            {history.map((d) => (
              <ListRow
                key={d.id} title={`${termsSummary(d.terms)} · ${props.nameOf(otherId(d, me.id))}`}
                trailing={<Badge tone={d.status === 'completed' ? 'profit' : d.status === 'broken' || d.status === 'cancelled' ? 'loss' : 'neutral'}>{STATUS_TEXT[d.status] ?? d.status}</Badge>}
              />
            ))}
          </List>
        </>
      )}
    </Card>
  );
}

function BlockFundCard(props: { view: OwnerView; onAct: (a: Action) => unknown }) {
  const bf = props.view.blockFund!;
  const info = blockFundInfo(bf);
  const on = props.view.business?.orders.blockFund ?? false;
  return (
    <Card title="Block fund" subtitle={bf.block} tone={info.active ? 'profit' : 'default'} aria-label="Block fund">
      <div className="stack">
        <p className="small muted">
          Neighbors chip in for street cleaning and lights. When {Math.round(RULES.BLOCK_FUND_THRESHOLD * 100)}% of the open businesses on the block pay,
          the whole block gets {info.gives.replace(' for the whole block', '')}, even those who did not pay.
        </p>
        <div className="row-between small">
          <span><strong className="num">{bf.contributors} of {bf.eligible}</strong> neighbors chip in</span>
          <span className="muted">{info.required} needed</span>
        </div>
        <ProgressBar value={bf.eligible ? bf.contributors / bf.eligible : 0} tone={info.active ? 'profit' : 'accent'} label="Neighbors who chip in" />
        <p className={`nw-blockline${info.active ? ' is-active' : ''}`} role="status">{info.line}</p>
        <Toggle label={`Chip in ${money0(info.fee)}/month`} description="Paid from your cash at the start of each month" checked={on} onChange={(v) => props.onAct(act.blockFund(v))} />
      </div>
    </Card>
  );
}

function ReportsCard(props: { view: ViewWithExtra; packs: PackSet | null; nameOf: (id: string) => string; onReport: () => void }) {
  const history = myReports(props.view);
  const inbox = history.length === 0 ? reportInboxItems(props.view) : [];
  const limit = reportLimit(props.view);
  return (
    <Card title="Report to the city" subtitle={`${RULES.REPORTS_PER_WEEK} report a week`} aria-label="Report to the city">
      <div className="stack">
        <p className="small muted">Seen a violation next door? The city sends an official. A false report costs you: a warning first, then {money0(RULES.FALSE_REPORT_FINE)} and your name.</p>
        <Button block variant="danger" icon="flag" onClick={props.onReport} disabled={!props.view.business || !limit.allowed}>Report a business</Button>
        {!limit.allowed && <p className="xsmall muted nw-center">{limit.reason}</p>}
        {(history.length > 0 || inbox.length > 0) && <div className="eyebrow">My reports</div>}
        {history.length > 0 && (
          <List>
            {history.map((r) => (
              <ListRow
                key={`${r.caseId ?? r.reportId}-${r.day}`} title={props.nameOf(r.targetBusinessId)}
                subtitle={`${reportName(props.packs, r.reportId)} · ${dateOf(r.day).label}`}
                trailing={<Badge tone={r.outcome === 'fined' ? 'profit' : r.outcome === 'clean' ? 'warn' : 'neutral'}>{reportOutcomeText(r)}</Badge>}
              />
            ))}
          </List>
        )}
        {inbox.length > 0 && (
          <List>
            {inbox.map((i) => <ListRow key={i.id} icon="flag" title={i.title} subtitle={`${dateOf(i.day).label} · ${i.text}`} />)}
          </List>
        )}
      </div>
    </Card>
  );
}
