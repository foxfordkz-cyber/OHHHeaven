import { useEffect, useMemo, useState } from 'react';
import type { NicheId, OpenRecommendation, OwnerView, Pack, PackSetupItem } from '@ohh/shared/types';
import type { Catalog } from '../../app/catalog';
import { useGame } from '../../app/store';
import { Badge, Button, Card, Icon, MoneyText, RuleCard, SegmentedControl, Sheet, Skeleton, Stat, Stepper, Toggle, formatMoney } from '../../ui';
import { daysToOpen, fineLabel, groupLines, kitLines, kitTotal, maxSizeFor, requiredIds, toggleItem, violationFor, type KitItems } from './kit';
import type { Draft } from './Start';

const KIT_NAME: Record<OpenRecommendation['kitId'], string> = { lean: 'Lean', standard: 'Standard', premium: 'Premium' };

export function KitStep({ draft, catalog, view }: { draft: Draft; update: (p: Partial<Draft>) => void; catalog: Catalog; view: OwnerView }) {
  const { query, act } = useGame();
  const niche = draft.niche as NicheId;
  const pack = catalog.packs.niches[niche]!;
  const place = catalog.places.find((p) => p.id === draft.placeId);
  const [recs, setRecs] = useState<OpenRecommendation[] | null>(null);
  const [customizing, setCustomizing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!draft.placeId) return;
    void query<OpenRecommendation[]>({ type: 'recommend_opening', niche, placeId: draft.placeId }).then((r) => alive && setRecs(r ?? []));
    return () => {
      alive = false;
    };
  }, [niche, draft.placeId, query]);

  const recommended = useMemo(() => {
    if (!recs?.length) return null;
    return recs.find((r) => r.kitId === (draft.match?.kitId ?? 'standard')) ?? recs[0];
  }, [recs, draft.match]);

  async function open(kitId: OpenRecommendation['kitId'], size: number, items: KitItems) {
    if (!draft.placeId) return;
    setBusy(true);
    await act({ type: 'open_business', niche, placeId: draft.placeId, name: draft.name.trim() || 'My business', kitId, size, items });
    setBusy(false);
  }

  if (!recs) {
    return (
      <div className="stack">
        <Skeleton height={44} />
        <Skeleton height={420} />
      </div>
    );
  }
  if (!recommended) return <Card tone="warn" title="No setup available for this place" subtitle="Go back and pick another place." />;

  return (
    <div className="stack-lg">
      <div className="stack-sm">
        <h1 className="h2">What you buy to open</h1>
        <p className="muted">
          {pack.name} at {place?.address ?? 'your place'} · you start with <MoneyText value={pack.startCapital} />
        </p>
      </div>

      <KitCard pack={pack} rec={recommended} commonViolations={catalog.packs.common} />

      <div className="stack-sm">
        <Button block size="lg" icon="store" loading={busy} onClick={() => open(recommended.kitId, recommended.size, recommended.items)}>
          Open with recommended setup
        </Button>
        <Button block variant="secondary" icon="edit" onClick={() => setCustomizing(true)}>
          Customize
        </Button>
        <p className="xsmall faint" style={{ textAlign: 'center' }}>Rent starts the day you sign. Permits take {recommended.daysToOpen} days; you cannot legally open before them.</p>
      </div>

      {customizing && (
        <CustomizeSheet pack={pack} recs={recs} start={recommended} maxSize={maxSizeFor(pack, place)} common={catalog.packs.common} busy={busy} onClose={() => setCustomizing(false)} onOpen={(k, s, i) => open(k, s, i)} />
      )}
      <p className="xsmall faint">Numbers shown are the plan before opening. The city's books record what you actually pay.</p>
      {view.world.config.demo && <p className="xsmall faint">Demo city: one game day passes every {view.world.config.dayMs / 1000} seconds.</p>}
    </div>
  );
}

/** The recommended setup, open by default: size, purchases by group with prices, total, cash left, days to open, why. */
export function KitCard({ pack, rec, commonViolations }: { pack: Pack; rec: OpenRecommendation; commonViolations?: Catalog['packs']['common'] }) {
  const lines = kitLines(pack, rec.items, rec.size);
  const groups = groupLines(lines);
  const [rule, setRule] = useState<PackSetupItem | null>(null);
  return (
    <Card tone="accent" title={`Recommended: ${KIT_NAME[rec.kitId]}`} subtitle={`${rec.size} ${pack.sizing.unitName}${rec.size === 1 ? '' : 's'} · ready in ${rec.daysToOpen} days`} action={<Badge tone="accent" icon="sparkle">Best fit</Badge>}>
      <ul className="start-why">
        {rec.why.map((w) => (
          <li key={w}>
            <Icon name="check" size={16} strokeWidth={2.4} className="profit" />
            <span>{w}</span>
          </li>
        ))}
      </ul>
      <div className="kit-groups">
        {groups.map(({ group, lines: ls, subtotal }) => (
          <section key={group.id} className="kit-group" aria-label={group.label}>
            <header className="kit-group__head">
              <span className="row"><Icon name={group.icon} size={16} /> {group.label}</span>
              <MoneyText value={subtotal} className="muted" />
            </header>
            {ls.map((l) => (
              <div key={l.item.id} className="kit-line">
                <span className="kit-line__name">
                  {l.item.required && (
                    <button type="button" className="kit-lock" aria-label={`Required: ${l.item.name}`} onClick={() => setRule(l.item)}>
                      <Icon name="lock" size={14} />
                    </button>
                  )}
                  <span>{l.item.name}</span>
                  {l.units > 1 && <span className="faint"> ×{l.units}</span>}
                </span>
                <MoneyText value={l.cost} />
              </div>
            ))}
          </section>
        ))}
      </div>
      <div className="kit-total">
        <div className="row-between">
          <span>Total to open</span>
          <strong className="num" data-testid="kit-total">{formatMoney(rec.total)}</strong>
        </div>
        <div className="row-between">
          <span className="muted">Cash left after opening</span>
          <MoneyText value={rec.cashLeft} className={rec.cashLeft < pack.startCapital * 0.15 ? 'warn' : 'profit'} />
        </div>
        <div className="row-between">
          <span className="muted">Days until you can open</span>
          <span className="num">{rec.daysToOpen}</span>
        </div>
      </div>
      <RuleSheet item={rule} pack={pack} common={commonViolations} onClose={() => setRule(null)} />
    </Card>
  );
}

function RuleSheet({ item, pack, common, onClose }: { item: PackSetupItem | null; pack: Pack; common?: Catalog['packs']['common']; onClose: () => void }) {
  if (!item) return null;
  const v = violationFor(item, pack, common);
  return (
    <Sheet open title={item.name} onClose={onClose} footer={<Button block onClick={onClose}>Got it</Button>}>
      {v ? (
        <RuleCard title={`Without it: ${v.name.toLowerCase()}`} text={`You cannot open without "${item.name}". If an inspector finds out, you pay a fine and may be closed.`} law={v.law} penalty={fineLabel(v)} source={item.link ?? v.source} />
      ) : (
        <RuleCard title="Required to open" text={`Every ${pack.name.toLowerCase()} needs "${item.name}". It cannot be removed from the setup.`} source={item.link ?? item.source} />
      )}
      {item.agency && <p className="small muted">Issued by {item.agency}{item.waitDays ? `, usually in about ${item.waitDays} days` : ''}.</p>}
    </Sheet>
  );
}

/** "Customize": another kit, another size (recalculated), optional items off. Required items stay locked. */
export function CustomizeSheet({ pack, recs, start, maxSize, common, busy, onClose, onOpen }: { pack: Pack; recs: OpenRecommendation[]; start: OpenRecommendation; maxSize: number; common?: Catalog['packs']['common']; busy: boolean; onClose: () => void; onOpen: (kitId: OpenRecommendation['kitId'], size: number, items: KitItems) => void }) {
  const [kitId, setKitId] = useState(start.kitId);
  const [size, setSize] = useState(Math.min(start.size, maxSize));
  const [items, setItems] = useState<KitItems>(start.items);
  const [rule, setRule] = useState<PackSetupItem | null>(null);
  const required = requiredIds(pack);

  const pickKit = (id: OpenRecommendation['kitId']) => {
    const r = recs.find((x) => x.kitId === id);
    if (!r) return;
    setKitId(id);
    setSize(Math.min(r.size, maxSize));
    setItems(r.items);
  };

  const total = kitTotal(pack, items, size);
  const cashLeft = pack.startCapital - total;
  const wait = daysToOpen(pack, items);
  const chosen = new Set(items.map((i) => i.id));
  const candidates = pack.setup.filter((s) => chosen.has(s.id) || !s.required);

  return (
    <Sheet
      open
      onClose={onClose}
      title="Customize your setup"
      footer={
        <>
          <div className="row-between">
            <span>Total to open</span>
            <strong className="num" data-testid="custom-total">{formatMoney(total)}</strong>
          </div>
          <div className="row-between small">
            <span className="muted">Cash left · ready in {wait} days</span>
            <MoneyText value={cashLeft} className={cashLeft < 0 ? 'loss' : cashLeft < pack.startCapital * 0.15 ? 'warn' : 'profit'} />
          </div>
          <Button block size="lg" icon="store" loading={busy} disabled={cashLeft < 0} onClick={() => onOpen(kitId, size, items)}>
            {cashLeft < 0 ? 'Not enough starting capital' : 'Open with this setup'}
          </Button>
        </>
      }
    >
      <SegmentedControl label="Setup" value={kitId} onChange={pickKit} options={recs.map((r) => ({ value: r.kitId, label: KIT_NAME[r.kitId] }))} />
      <div className="row-between">
        <span>
          <span style={{ display: 'block', fontWeight: 600 }}>Size</span>
          <span className="small muted">This place fits up to {maxSize} {pack.sizing.unitName}s</span>
        </span>
        <Stepper value={size} min={pack.sizing.min} max={maxSize} onChange={setSize} label={pack.sizing.unitName} />
      </div>
      <div className="stack-sm">
        {candidates.map((item) => {
          const on = chosen.has(item.id);
          const locked = required.has(item.id);
          const qty = items.find((i) => i.id === item.id)?.qty ?? 1;
          const cost = item.cost * (item.scalesWithSize ? size : qty);
          return locked ? (
            <div key={item.id} className="kit-item kit-item--locked">
              <button type="button" className="kit-lock" aria-label={`Required: ${item.name}`} onClick={() => setRule(item)}>
                <Icon name="lock" size={14} />
              </button>
              <span className="grow">
                <span style={{ display: 'block', fontWeight: 600 }}>{item.name}</span>
                <span className="xsmall faint">Required · tap the lock to see the rule</span>
              </span>
              <MoneyText value={cost} />
            </div>
          ) : (
            <Toggle key={item.id} checked={on} onChange={(v) => setItems((cur) => toggleItem(cur, item.id, v))} label={`${item.name} · ${formatMoney(item.cost)}${item.scalesWithSize ? ` per ${pack.sizing.unitName}` : ''}`} description={on ? `Adds ${formatMoney(cost)}` : 'Optional'} />
          );
        })}
      </div>
      <Stat small label="Starting capital" value={<MoneyText value={pack.startCapital} />} />
      <RuleSheet item={rule} pack={pack} common={common} onClose={() => setRule(null)} />
    </Sheet>
  );
}
