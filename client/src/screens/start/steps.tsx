import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ClientView, IdeaMatch, NicheId, OfficialRole, RoadmapItem, RoadmapKind } from '@ohh/shared/types';
import { NICHE_META, NICHE_ORDER, type Catalog } from '../../app/catalog';
import { CityMapSlot } from '../../app/slots';
import { useGame } from '../../app/store';
import { AiBadge, Badge, Button, Card, Field, Icon, List, ListRow, MoneyText, NICHE_ICON, SegmentedControl, Skeleton, Stat, formatMoney, formatPct, type IconName } from '../../ui';
import { visibleBusinesses } from '../home/Home';
import { cheapestOpening, competitorsNear, freePlaces, maxSizeFor, rentPerMonth, trafficLabel } from './kit';
import type { Draft } from './Start';

type StepProps = { draft: Draft; update: (p: Partial<Draft>) => void; catalog: Catalog };

// ───────────────────────── 1. name and join ─────────────────────────

export function JoinStep({ view, asOfficial }: { view: ClientView; asOfficial: boolean }) {
  const { join } = useGame();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [role, setRole] = useState<OfficialRole>('inspector');
  const [busy, setBusy] = useState(false);
  const fee = view.world.config.entryFee;
  const demo = view.world.config.demo;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    const ack = await join(asOfficial ? { name: n, kind: 'official', role } : { name: n, kind: 'owner' });
    setBusy(false);
    if (ack.ok && asOfficial) navigate('/desk');
  }

  return (
    <form className="stack-lg" onSubmit={submit}>
      <div className="stack-sm">
        <h1 className="h2">{asOfficial ? 'Inspect the city, earn your share' : 'Last step before you buy: your name'}</h1>
        <p className="muted">
          {asOfficial
            ? 'City officials play free. Take cases, find real violations and split 5% of the bank by points at the end of the season.'
            : `You join ${view.world.config.name} and get the starting money for your business. Next you pick what to buy.`}
        </p>
      </div>
      <Field label="Your name" hint="Other players see it next to your business.">
        <input className="input" value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} placeholder="Jordan" autoComplete="nickname" autoFocus />
      </Field>
      {asOfficial ? (
        <div className="stack-sm">
          <span className="field__label">Your role</span>
          <SegmentedControl<OfficialRole> label="Role" value={role} onChange={setRole} options={[{ value: 'inspector', label: 'City inspector' }, { value: 'tax_auditor', label: 'Tax auditor' }]} />
          <p className="small muted">{role === 'inspector' ? 'Health and license checks: dirty kitchens, missing permits.' : 'Payroll and sales tax: cash wages, hidden revenue.'}</p>
        </div>
      ) : (
        <Card tone="flat">
          <div className="row-between">
            <span className="row"><Icon name="wallet" size={18} /> Entry fee</span>
            <strong className="num">{formatMoney(fee)}</strong>
          </div>
          <p className="small muted">
            {Math.round(view.world.config.prizeShare * 100)}% of every entry goes to the prize bank. {demo ? 'This is the demo city: the payment is a test, nothing is charged.' : 'Payments are in test mode until launch.'}
          </p>
        </Card>
      )}
      <Button type="submit" block size="lg" loading={busy} disabled={!name.trim()} icon={asOfficial ? 'badge' : 'wallet'}>
        {asOfficial ? 'Join for free' : `Pay ${formatMoney(fee)} (test) and join`}
      </Button>
    </form>
  );
}

// ───────────────────────── 2. idea → niche ─────────────────────────

export function IdeaStep({ draft, update, catalog }: StepProps) {
  const { query } = useGame();
  const [text, setText] = useState(draft.idea);
  const [busy, setBusy] = useState(false);

  async function ask(e?: FormEvent) {
    e?.preventDefault();
    const t = text.trim();
    if (!t) return;
    setBusy(true);
    const match = await query<IdeaMatch>({ type: 'idea', text: t });
    setBusy(false);
    if (match) update({ idea: t, match, niche: catalog.packs.niches[match.niche] ? match.niche : draft.niche, name: draft.name || match.businessName });
  }

  const m = draft.match;
  const canGo = Boolean(draft.niche && catalog.packs.niches[draft.niche] && draft.name.trim());

  return (
    <div className="stack-lg">
      <form className="stack-sm" onSubmit={ask}>
        <h1 className="h2">What would you open?</h1>
        <div className="idea-box__row" style={{ display: 'flex', gap: 8 }}>
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="A coffee shop near the subway…" aria-label="Your idea" />
          <Button type="submit" loading={busy} disabled={!text.trim()} aria-label="Find my niche" style={{ minWidth: 48 }}>
            {!busy && <Icon name="sparkle" size={20} />}
          </Button>
        </div>
      </form>

      {m && (
        <Card tone="accent" title={`Looks like a ${NICHE_META[m.niche].name.toLowerCase()}.`} subtitle={`We suggest "${m.businessName}" with the ${m.kitId} setup on a ${m.tier === 'prime' ? 'busy prime' : m.tier === 'mid' ? 'mid-priced' : 'cheaper side'} street.`} action={m.origin === 'ai' ? <AiBadge /> : <Badge>Rules</Badge>}>
          <ul className="start-notes">
            {m.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Card>
      )}

      <div className="stack-sm">
        <span className="field__label">{m ? 'Or pick the niche yourself' : 'Pick a niche'}</span>
        <List>
          {NICHE_ORDER.map((n) => {
            const pack = catalog.packs.niches[n];
            const selected = draft.niche === n;
            return (
              <ListRow
                key={n}
                icon={NICHE_ICON[n]}
                iconTone={selected ? 'accent' : undefined}
                title={pack?.name ?? NICHE_META[n].name}
                subtitle={pack ? `Start with ${formatMoney(pack.startCapital)}` : 'Opening soon'}
                trailing={selected ? <Badge tone="accent" icon="check">Chosen</Badge> : !pack ? <Badge>Soon</Badge> : undefined}
                chevron={false}
                onClick={pack ? () => update({ niche: n }) : undefined}
              />
            );
          })}
        </List>
      </div>

      <Field label="Business name">
        <input className="input" value={draft.name} onChange={(e) => update({ name: e.target.value.slice(0, 40) })} placeholder="Morning Cup" />
      </Field>

      <Button block size="lg" iconRight="arrowRight" disabled={!canGo} onClick={() => update({ step: 'place', idea: text.trim() || draft.idea })}>
        Choose a place
      </Button>
    </div>
  );
}

// ───────────────────────── 3. place ─────────────────────────

export function PlaceStep({ draft, update, catalog, view }: StepProps & { view: ClientView }) {
  const niche = draft.niche as NicheId;
  const pack = catalog.packs.niches[niche]!;
  const businesses = visibleBusinesses(view);
  // places the starting money can open come first: a newcomer should not learn at the last step that the room is out of reach
  const budget = pack.startCapital;
  const priced = freePlaces(catalog.places, niche, businesses).map((p) => ({ p, cost: cheapestOpening(pack, p) }));
  const costOf = new Map(priced.map((x) => [x.p.id, x.cost]));
  const within = priced.filter((x) => x.cost <= budget).length;
  // within the budget: the cheapest to open first — it leaves the most money to live through the first months
  const free = [...priced].sort((a, b) => Number(a.cost > budget) - Number(b.cost > budget) || (a.cost <= budget ? a.cost - b.cost : 0)).map((x) => x.p);
  const [showAll, setShowAll] = useState(false);
  const selected = catalog.places.find((p) => p.id === draft.placeId) ?? null;
  const list = showAll ? free : free.slice(0, 8);

  return (
    <div className="stack-lg">
      <div className="stack-sm">
        <h1 className="h2">Where will it be?</h1>
        <p className="muted">{within} of {free.length} free storefronts in the East Village fit your {formatMoney(budget)} to start. The cheapest to open come first: the money left over is what you live on until the regulars come.</p>
      </div>
      <CityMapSlot mode="pick" niche={niche} places={catalog.places} businesses={businesses} weather={view.weather[0]} onPick={(placeId) => update({ placeId })} selectedPlaceId={draft.placeId ?? undefined} height={220} />

      {selected && (
        <Card tone="accent" title={selected.address} subtitle={selected.block}>
          <div className="grid-2">
            <Stat small label="Rent" value={<span>{formatMoney(rentPerMonth(selected))}<span className="xsmall muted"> /month</span></span>} hint={`$${selected.rentPerSqftYear}/sq ft a year`} />
            <Stat small label="Size" value={`${selected.sqft.toLocaleString('en-US')} sq ft`} hint={`fits up to ${maxSizeFor(pack, selected)} ${pack.sizing.unitName}s`} />
            <Stat small label="Foot traffic" value={trafficLabel(selected.footTraffic)} hint={`${formatPct(selected.footTraffic)} of the busiest corner`} />
            <Stat small label="Competitors" value={`${competitorsNear(selected, niche, businesses, catalog.places)} nearby`} hint="same niche within 400 m" />
          </div>
          <p className={`small ${(costOf.get(selected.id) ?? 0) > budget ? 'loss' : 'muted'}`}>
            {(costOf.get(selected.id) ?? 0) > budget
              ? `Opening here costs at least ${formatMoney(costOf.get(selected.id) ?? 0)}. You start with ${formatMoney(budget)}: pick a smaller or cheaper place.`
              : `Opening here costs from ${formatMoney(costOf.get(selected.id) ?? 0)} of your ${formatMoney(budget)}.`}
          </p>
          {selected.note && <p className="xsmall faint">Data: {selected.note === 'unverified' ? 'estimate, not yet checked against city records' : selected.note}</p>}
          <Button block size="lg" iconRight="arrowRight" disabled={(costOf.get(selected.id) ?? 0) > budget} onClick={() => update({ step: 'plan' })}>Open here</Button>
        </Card>
      )}

      <List>
        {list.map((p) => (
          <ListRow
            key={p.id}
            icon="pin"
            iconTone={p.id === draft.placeId ? 'accent' : undefined}
            title={p.address}
            subtitle={`${p.sqft.toLocaleString('en-US')} sq ft · ${trafficLabel(p.footTraffic)} · ${competitorsNear(p, niche, businesses, catalog.places)} rivals · rent ${formatMoney(rentPerMonth(p))}/mo`}
            value={(costOf.get(p.id) ?? 0) > budget
              ? <Badge tone="loss">Over budget</Badge>
              : <span className="num"><span className="xsmall faint">opens from </span>{formatMoney(costOf.get(p.id) ?? 0)}</span>}
            onClick={() => update({ placeId: p.id })}
          />
        ))}
      </List>
      {!showAll && free.length > list.length && (
        <Button variant="ghost" onClick={() => setShowAll(true)}>
          Show all {free.length} places
        </Button>
      )}
      {free.length === 0 && <Card tone="warn" title="No free place fits this niche right now" subtitle="Pick another niche or check back: bankrupt businesses free their places." />}
    </div>
  );
}

// ───────────────────────── 4. the opening plan ─────────────────────────

const KIND_ICON: Record<RoadmapKind, IconName> = { idea: 'sparkle', legal: 'doc', permit: 'badge', space: 'building', money: 'money', supplier: 'truck', people: 'users', launch: 'store' };

export function PlanStep({ draft, update, catalog }: StepProps) {
  const { query } = useGame();
  const niche = draft.niche as NicheId;
  const [items, setItems] = useState<RoadmapItem[] | null>(null);

  useEffect(() => {
    let alive = true;
    void query<RoadmapItem[]>({ type: 'roadmap', niche }).then((r) => alive && setItems(r ?? []));
    return () => {
      alive = false;
    };
  }, [niche, query]);

  if (!items) {
    return (
      <div className="stack">
        <Skeleton height={96} />
        <Skeleton height={300} />
      </div>
    );
  }

  const fees = items.reduce((s, i) => s + (i.fee ?? 0), 0);
  const longest = items.reduce((m, i) => Math.max(m, i.waitDays ?? 0), 0);

  return (
    <div className="stack-lg">
      <div className="stack-sm">
        <h1 className="h2">Your path to open doors</h1>
        <p className="muted">Every step a real {catalog.packs.niches[niche]?.name.toLowerCase() ?? 'business'} takes in New York City, in order, with the agency, the fee and the wait.</p>
      </div>
      <div className="grid-3">
        <Stat small label="Steps" value={items.length} />
        <Stat small label="Fees" value={<MoneyText value={fees} />} />
        <Stat small label="Longest wait" value={`${longest} days`} />
      </div>
      <ol className="roadmap">
        {items.map((it, i) => (
          <li key={it.id} className={`roadmap__item roadmap__item--${it.status}`}>
            <span className="roadmap__rail">
              <span className="roadmap__dot">{it.status === 'done' ? <Icon name="check" size={14} strokeWidth={2.6} /> : i + 1}</span>
            </span>
            <div className="roadmap__body">
              <div className="row" style={{ gap: 8 }}>
                <Icon name={KIND_ICON[it.kind]} size={16} className="faint" />
                <span className="roadmap__title">{it.title}</span>
              </div>
              <p className="small muted">{it.text}</p>
              <div className="row wrap" style={{ gap: 6 }}>
                {it.agency && <Badge icon="building">{it.agency}</Badge>}
                {it.fee !== undefined && <Badge tone={it.fee > 0 ? 'warn' : 'profit'}>{it.fee > 0 ? `Fee ${formatMoney(it.fee)}` : 'Free'}</Badge>}
                {it.waitDays ? <Badge icon="hourglass">{it.waitDays} days</Badge> : null}
                {it.status === 'waiting' && <Badge tone="info">In progress</Badge>}
              </div>
              {it.link && (
                <a className="rule-card__link" href={it.link} target="_blank" rel="noreferrer noopener">
                  Official page <Icon name="external" size={14} />
                </a>
              )}
            </div>
          </li>
        ))}
      </ol>
      <Button block size="lg" iconRight="arrowRight" onClick={() => update({ step: 'kit' })}>See what to buy</Button>
    </div>
  );
}
