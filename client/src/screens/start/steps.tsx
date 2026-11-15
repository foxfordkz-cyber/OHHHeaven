import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ClientView, IdeaMatch, NicheId, OfficialRole, OpenRecommendation, Pack, Place, RoadmapItem } from '@ohh/shared/types';
import { dateOf } from '@ohh/shared/rules';
import { buildoutOf, isTakeover } from '@ohh/shared/place';
import { NICHE_META, NICHE_ORDER, type Catalog } from '../../app/catalog';
import { CityMapSlot } from '../../app/slots';
import { useGame } from '../../app/store';
import { AiBadge, Badge, Button, Card, Field, Icon, List, ListRow, MoneyText, NICHE_ICON, SegmentedControl, Skeleton, Stat, formatMoney, formatPct, pick, useT } from '../../ui';
import { PlannedPath, stagesOf } from './Path';
import { visibleBusinesses } from '../home/Home';
import { cheapestOpening, competitorsNear, daysToOpen, freePlaces, maxSizeFor, rentPerMonth, trafficLabel } from './kit';
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

/** What stood in the room before: it sets the price and the length of the build-out. */
function wasBefore(pack: Pack, p: Place): string {
  if (isTakeover(pack, p)) return pick('Operating shop for sale', 'Работающее заведение продаётся');
  const label = buildoutOf(pack, p)?.label;
  return label ? label.split(':')[0] : pick('Storefront', 'Помещение');
}

const openDays = (pack: Pack, p: Place): number => daysToOpen(pack, pack.setup.filter((s) => s.required).map((s) => ({ id: s.id, qty: 1 })), p);

export function PlaceStep({ draft, update, catalog, view }: StepProps & { view: ClientView }) {
  const tr = useT();
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
  const outlook = usePlaceOutlook(niche, selected?.id ?? null, pack);

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
          <p className="small" data-testid="place-before">
            <strong>{wasBefore(pack, selected)}.</strong>{' '}
            {isTakeover(pack, selected)
              ? tr(`You buy the room, the equipment and the regulars as they stand; doors reopen in ${openDays(pack, selected)} days.`, `Вы покупаете зал, оборудование и постоянных гостей как есть; двери откроются через ${openDays(pack, selected)} дн.`)
              : tr(`Build-out ${formatMoney(buildoutOf(pack, selected)?.cost ?? 0)}, ${buildoutOf(pack, selected)?.days ?? 0} days of construction; doors open in ${openDays(pack, selected)} days. Rent runs the whole time.`, `Ремонт ${formatMoney(buildoutOf(pack, selected)?.cost ?? 0)}, ${buildoutOf(pack, selected)?.days ?? 0} дн. стройки; открытие через ${openDays(pack, selected)} дн. Аренда идёт всё это время.`)}
          </p>
          <p className={`small ${(costOf.get(selected.id) ?? 0) > budget ? 'loss' : 'muted'}`}>
            {(costOf.get(selected.id) ?? 0) > budget
              ? `Opening here costs at least ${formatMoney(costOf.get(selected.id) ?? 0)}. You start with ${formatMoney(budget)}: pick a smaller or cheaper place.`
              : `Opening here costs from ${formatMoney(costOf.get(selected.id) ?? 0)} of your ${formatMoney(budget)}.`}
          </p>
          {outlook && outlook.placeId === selected.id && (
            <p className={`small ${outlook.tone}`} data-testid="place-outlook">
              <strong>{tr('What it earns', 'Сколько принесёт')}:</strong> {outlook.line}
            </p>
          )}
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
            subtitle={<>
              <span style={{ display: 'block' }}>{wasBefore(pack, p)} · {tr(`doors open in ${openDays(pack, p)} days`, `открытие через ${openDays(pack, p)} дн.`)}</span>
              <span style={{ display: 'block' }}>{p.sqft.toLocaleString('en-US')} sq ft · {tr('rent', 'аренда')} {formatMoney(rentPerMonth(p))}/mo · {competitorsNear(p, niche, businesses, catalog.places)} {tr('rivals', 'соперников')}</span>
            </>}
            value={(costOf.get(p.id) ?? 0) > budget
              ? <Badge tone="loss">{tr('Over budget', 'Не по карману')}</Badge>
              : <span className="num" title={tr('The least it costs to open here', 'Минимум, чтобы открыться здесь')}>{formatMoney(costOf.get(p.id) ?? 0, { compact: true })}</span>}
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

/**
 * The consequence of the first decision, before it is taken (B04 for B07; docs/qa/HOOK.md, docs/qa/BUGS.md #1): what
 * this room earns once the regulars know you and how the first year ends, from the same engine forecast the setup
 * cards use (recommend_opening; its best kit's last line). Guests may ask it: no player is needed.
 */
export interface PlaceOutlook { placeId: string; line: string; tone: 'profit' | 'loss' | '' }
export function usePlaceOutlook(niche: NicheId, placeId: string | null, pack?: Pack): PlaceOutlook | null {
  const { query } = useGame();
  const [outlook, setOutlook] = useState<PlaceOutlook | null>(null);
  useEffect(() => {
    if (!placeId) return;
    let alive = true;
    void query<OpenRecommendation[]>({ type: 'recommend_opening', niche, placeId }).then((recs) => {
      const best = recs?.[0];
      const said = best?.why[best.why.length - 1];
      // the number holds for this setup only: the team is the biggest bill, and the next step lets the player change it
      // (docs/qa/BUGS.md #1: the forecast with three baristas lost money where two made money in play)
      const line = best && said ? `${setupLabel(best, pack)}: ${said.charAt(0).toLowerCase()}${said.slice(1)}` : undefined;
      // a month that loses money is a loss; a good month after a costly first year is plain text; else profit
      if (alive && line) setOutlook({ placeId, line, tone: /^(Even with|Projected loss)/.test(said!) ? 'loss' : /a loss of/.test(said!) ? '' : 'profit' });
    });
    return () => { alive = false; };
  }, [query, niche, placeId, pack]);
  return outlook;
}

/** 'With 18 seats, 3 baristas and 1 shift lead, at $8.50' — the setup a forecast is for: seats, team and price. */
export function setupLabel(rec: OpenRecommendation, pack?: Pack): string {
  const unit = pack?.sizing.unitName ?? 'seat';
  const team = Object.entries(rec.orders.staff).filter(([, n]) => n > 0).map(([id, n]) => {
    const name = (pack?.staff.find((r) => r.id === id)?.name ?? id.replace(/_/g, ' ')).toLowerCase();
    return `${n} ${name}${n === 1 ? '' : 's'}`;
  });
  const parts = [`${rec.size} ${unit}${rec.size === 1 ? '' : 's'}`, ...team];
  const who = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
  return `With ${who}, at ${formatMoney(rec.orders.price, { cents: true })}`;
}

// ───────────────────────── 4. the opening plan ─────────────────────────

/** The plan laid out by the day each step closes at this address. The decision here: go on with this place, or pick another. */
export function PlanStep({ draft, update, catalog, today }: StepProps & { today: number }) {
  const tr = useT();
  const { query } = useGame();
  const niche = draft.niche as NicheId;
  const pack = catalog.packs.niches[niche]!;
  const place = catalog.places.find((p) => p.id === draft.placeId);
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

  const stages = stagesOf(pack, place, items);
  const fees = items.reduce((s, i) => s + (i.fee ?? 0), 0);
  const days = stages.length ? stages[stages.length - 1].day : 0;
  const build = buildoutOf(pack, place);
  const rentDay = place ? rentPerMonth(place) / 30 : 0;
  const takeover = isTakeover(pack, place);

  return (
    <div className="stack-lg">
      <div className="stack-sm">
        <h1 className="h2">{tr(`${days} days from the lease to open doors`, `${days} дней от аренды до открытых дверей`)}</h1>
        <p className="muted">
          {place ? `${place.address}. ` : ''}
          {tr(`Every step a real ${pack.name.toLowerCase()} takes in New York City, on the day it closes here. Tap a day to see its steps.`, `Каждый шаг, который проходит настоящее заведение в Нью-Йорке, в день, когда он закрывается здесь. Нажмите на день, чтобы увидеть шаги.`)}
        </p>
      </div>
      <div className="grid-3">
        <Stat small label={tr('Steps', 'Шагов')} value={items.length} />
        <Stat small label={tr('City fees', 'Сборы города')} value={<MoneyText value={fees} />} />
        <Stat small label={tr('Doors open', 'Открытие')} value={dateOf(today + days).label.replace(/^\w+, /, '')} />
      </div>
      {place && (
        <Card tone="flat" title={tr('What the wait costs at this address', 'Во что обходится ожидание по этому адресу')}>
          <ul className="start-notes">
            {build && <li>{takeover ? tr(`An operating shop: ${build.days} days of handover and cleaning, no construction.`, `Работающее заведение: ${build.days} дней на передачу и уборку, без стройки.`) : `${build.label}: ${tr(`${build.days} days of construction`, `${build.days} дней стройки`)}, ${formatMoney(build.cost)}.`}</li>}
            <li>{tr(`Rent is due from the day you sign: ${days} days × ${formatMoney(rentDay)} = ${formatMoney(rentDay * days)} before the first sale.`, `Аренда идёт со дня подписи: ${days} дн. × ${formatMoney(rentDay)} = ${formatMoney(rentDay * days)} до первой продажи.`)}</li>
            <li>{tr('The build-out is set by what the space was before: another address means another price and another wait.', 'Ремонт зависит от того, чем помещение было раньше: другой адрес — другая цена и другой срок.')}</li>
          </ul>
        </Card>
      )}
      <PlannedPath stages={stages} startDay={today} />
      <div className="stack-sm">
        <Button block size="lg" iconRight="arrowRight" onClick={() => update({ step: 'kit' })}>{tr('Go on with this address', 'Идти дальше с этим адресом')}</Button>
        <Button block variant="ghost" icon="pin" onClick={() => update({ step: 'place' })}>{tr('Pick another place', 'Выбрать другое место')}</Button>
      </div>
    </div>
  );
}
