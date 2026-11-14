import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { OwnerView } from '@ohh/shared/types';
import { dateOf } from '@ohh/shared/rules';
import type { Catalog } from '../../app/catalog';
import { useGame } from '../../app/store';
import { Badge, Banner, Button, Card, Clock, Icon, List, ListRow, MoneyText, ProgressBar, RuleCard, Sheet, Stat } from '../../ui';
import { fineLabel, permitsProgress, rentPerMonth, spentSoFar, violationFor } from './kit';

/** Waiting for permits while rent runs. Open doors when everything is ready, or open early and break the law. */
export function WaitStep({ view, catalog }: { view: OwnerView; catalog: Catalog }) {
  const navigate = useNavigate();
  const { act } = useGame();
  const b = view.business!;
  const pack = catalog.packs.niches[b.niche];
  const place = catalog.places.find((p) => p.id === b.placeId);
  const permits = permitsProgress(b, view.world.day, pack);
  const allReady = permits.every((p) => p.ready);
  const pending = permits.filter((p) => !p.ready);
  const lastReady = permits.reduce((m, p) => Math.max(m, p.readyDay), view.world.day);
  const [warn, setWarn] = useState(false);
  const [busy, setBusy] = useState(false);
  const done = view.roadmap.filter((s) => s.status === 'done').length;

  async function launch() {
    setBusy(true);
    const ack = await act({ type: 'launch' });
    setBusy(false);
    if (ack.ok) navigate('/biz');
  }

  return (
    <div className="stack-lg">
      <div className="stack-sm">
        <h1 className="h2">{allReady ? 'Everything is ready' : 'Waiting for permits'}</h1>
        <p className="muted">
          {allReady
            ? `${b.name} can open its doors today.`
            : `${b.name} signed the lease. The city works at its own pace: the last permit arrives ${dateOf(lastReady).label}.`}
        </p>
      </div>

      <Card>
        <Clock world={view.world} weather={view.weather[0]} />
      </Card>

      <Card title="Permits and licenses" subtitle={allReady ? 'All issued' : `${pending.length} still in progress`}>
        <div className="stack">
          {permits.length === 0 && <p className="small muted">No permits to wait for.</p>}
          {permits.map((p) => (
            <div key={p.itemId} className="permit">
              <div className="row-between">
                <span className="row" style={{ minWidth: 0 }}>
                  <Icon name={p.ready ? 'check' : 'hourglass'} size={16} className={p.ready ? 'profit' : 'warn'} />
                  <span className="truncate" style={{ fontWeight: 600 }}>{p.name}</span>
                </span>
                {p.ready ? <Badge tone="profit">Ready</Badge> : <Badge tone="warn">{p.daysLeft} {p.daysLeft === 1 ? 'day' : 'days'} left</Badge>}
              </div>
              <ProgressBar value={p.progress} tone={p.ready ? 'profit' : 'warn'} label={p.name} />
              <span className="xsmall faint">{p.agency ? `${p.agency} · ` : ''}ready {dateOf(p.readyDay).label}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid-2">
        <Card tone="flat">
          <Stat small label="Spent so far" value={<MoneyText value={spentSoFar(b)} />} hint="setup and rent, before a single sale" />
        </Card>
        <Card tone="flat">
          <Stat small label="Cash left" value={<MoneyText value={b.cash} />} hint={place ? `rent $${rentPerMonth(place).toLocaleString('en-US')} a month keeps running` : 'rent keeps running'} />
        </Card>
      </div>

      {view.roadmap.length > 0 && (
        <List>
          <ListRow icon="doc" title="Your opening plan" subtitle={`${done} of ${view.roadmap.length} steps done`} value={<span className="num small muted">{Math.round((done / view.roadmap.length) * 100)}%</span>} chevron={false} />
        </List>
      )}

      <div className="stack-sm">
        <Button block size="lg" icon="store" disabled={!allReady} loading={busy && allReady} onClick={launch}>
          Open doors
        </Button>
        {!allReady && (
          <Button block variant="danger" icon="alert" onClick={() => setWarn(true)}>
            Open early
          </Button>
        )}
        {!allReady && <Banner tone="info" icon="clock">Rent keeps running while you wait. That is how it works in real life too.</Banner>}
      </div>

      <Sheet
        open={warn}
        onClose={() => setWarn(false)}
        title="Open before the permits arrive?"
        footer={
          <>
            <Button block variant="danger" loading={busy} onClick={launch}>Open anyway — I accept the risk</Button>
            <Button block variant="secondary" onClick={() => setWarn(false)}>Wait for the permits</Button>
          </>
        }
      >
        <p className="muted">Working without a permit is a violation. Every day you sell, the trail grows: an inspection or a neighbor's report can find it.</p>
        {pending.map((p) => {
          const item = pack?.setup.find((s) => s.id === p.itemId);
          const v = item && pack ? violationFor(item, pack, catalog.packs.common) : undefined;
          return v ? (
            <RuleCard key={p.itemId} title={v.name} text={`${p.name} arrives in ${p.daysLeft} ${p.daysLeft === 1 ? 'day' : 'days'}. Selling before that breaks the law.`} law={v.law} penalty={fineLabel(v)} source={item?.link ?? v.source} />
          ) : (
            <RuleCard key={p.itemId} title={`No ${p.name.toLowerCase()} yet`} text={`It arrives in ${p.daysLeft} ${p.daysLeft === 1 ? 'day' : 'days'}. Opening without it is a violation the city can fine you for.`} source={item?.link} />
          );
        })}
      </Sheet>
    </div>
  );
}
