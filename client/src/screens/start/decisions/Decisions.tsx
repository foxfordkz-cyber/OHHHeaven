// The Setup step: one card per decision that has a choice in real life. Three numbers stay on top — cash left,
// the opening day, the monthly bills — and move with every tap. Nothing is chosen for the player: the recommended
// option carries a mark, and "Use recommended" is a separate button.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { NicheId, OpenRecommendation, OwnerView, Pack, Place, PublicBusiness } from '@ohh/shared/types';
import { RULES, dateOf } from '@ohh/shared/rules';
import { footfallParams, isTakeover, rivalsOf, setupItemCost } from '@ohh/shared/place';
import type { Catalog } from '../../../app/catalog';
import { useGame } from '../../../app/store';
import { Badge, Banner, Button, Card, Icon, Skeleton, Slider, Stepper, cx, formatMoney, useLang, useT } from '../../../ui';
import { distanceM, maxSizeFor } from '../kit';
import type { Draft } from '../Start';
import {
  afterSigning, applyRecommended, baseChoices, baselineOf, buildDecisions, choose, closestKit, forcedExtras, pickedOption, receipt, recommendedChoices,
  seatRules, setPrice, setSize, setStaff, signingItems, staffCount, summarize,
  type Choices, type Decision, type DecisionOption, type Summary,
} from './model';
import { textsFor } from './texts';
import './decisions.css';

type Tr = (en: string, ru: string) => string;
export interface SetupDraft { niche: NicheId; placeId: string; choices: Choices; decided: string[]; at: number }

const money = (v: number) => formatMoney(Math.round(v));
const signed = (v: number) => `${v > 0 ? '+' : '−'}${formatMoney(Math.abs(Math.round(v)))}`;

export function DecisionsStep({ draft, update, catalog, view }: { draft: Draft; update: (p: Partial<Draft>) => void; catalog: Catalog; view: OwnerView }) {
  const tr = useT();
  const lang = useLang();
  const { query, act } = useGame();
  const niche = draft.niche as NicheId;
  const pack = catalog.packs.niches[niche]!;
  const common = catalog.packs.common;
  const place = catalog.places.find((p) => p.id === draft.placeId);
  const [recs, setRecs] = useState<OpenRecommendation[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!draft.placeId) return;
    void query<OpenRecommendation[]>({ type: 'recommend_opening', niche, placeId: draft.placeId }).then((r) => alive && setRecs(r ?? []));
    return () => {
      alive = false;
    };
  }, [niche, draft.placeId, query]);

  // the engine ranks its kits by the first-year forecast: the first one is its advice for this address
  const rec = useMemo(() => (recs?.length ? recommendedChoices(pack, recs[0], place) : null), [recs, pack, place]);
  const saved = draft.setup && draft.setup.placeId === draft.placeId && draft.setup.niche === niche ? draft.setup : null;
  const [choices, setChoices] = useState<Choices>(() => saved?.choices ?? baseChoices(pack, place));
  const [decided, setDecided] = useState<string[]>(() => saved?.decided ?? []);
  const [at, setAt] = useState<number>(() => saved?.at ?? 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the words follow the language switch
  const decisions = useMemo(() => buildDecisions(pack, common, place, rec, textsFor(niche), choices.size), [pack, common, place, rec, niche, lang, choices.size]);
  const summary = useMemo(() => summarize(pack, common, place, choices), [pack, common, place, choices]);
  const delta = useDelta(summary);

  useEffect(() => {
    if (draft.placeId) update({ setup: { niche, placeId: draft.placeId, choices, decided, at } });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `update` is recreated on every render of the wizard
  }, [choices, decided, at, niche, draft.placeId]);

  if (!place) return <Card tone="warn" title={tr('Pick a place first', 'Сначала выберите место')} subtitle={tr('Go back one step and choose where you open.', 'Вернитесь на шаг назад и выберите, где открываетесь.')} />;
  if (!recs) {
    return (
      <div className="stack">
        <Skeleton height={72} />
        <Skeleton height={360} />
      </div>
    );
  }

  const count = decisions.length;
  const index = Math.min(at, count);
  const go = (i: number) => {
    setAt(i);
    // a new card starts from its question, not from where the last one was scrolled to
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') try { window.scrollTo({ top: 0 }); } catch { /* jsdom */ }
  };
  const d = index < count ? decisions[index] : null;
  const openDate = dateOf(view.world.day + summary.days).label;
  const mark = (id: string) => setDecided((cur) => (cur.includes(id) ? cur : [...cur, id]));
  const left = decisions.filter((x) => !decided.includes(x.id));

  function useRecommended() {
    if (!rec) return;
    let c = choices;
    for (const x of left) c = applyRecommended(x, c, rec);
    setChoices(c);
    setDecided(decisions.map((x) => x.id));
    go(count);
  }

  async function sign() {
    if (!draft.placeId) return;
    setBusy(true);
    const signing = signingItems(pack, place, choices);
    const ack = await act({ type: 'open_business', niche, placeId: draft.placeId, name: draft.name.trim() || 'My business', kitId: closestKit(pack, choices), size: signing.size, items: signing.items });
    // team, pay, roaster, hours and price are standing orders: they go in as soon as the lease is signed;
    // in an operating shop the purchases, the seats and the sales follow the same way
    if (ack.ok) for (const a of afterSigning(pack, place, choices)) await act(a);
    setBusy(false);
  }

  return (
    <div className="dx">
      <SummaryBar summary={summary} delta={delta} openDate={openDate} tr={tr} />
      {isTakeover(pack, place) && index === 0 && (
        <Banner tone="info" icon="info">
          {tr(`You are buying an operating shop: its ${baselineOf(pack, place).size} ${pack.sizing.unitName}s, its equipment and its regulars come with the price. Keep what stands there, add to it, or sell it — a sale brings back ${Math.round(RULES.RESALE_SHARE * 100)}% of the price.`,
            `Вы покупаете работающее заведение: его ${baselineOf(pack, place).size} мест, оборудование и постоянные гости входят в цену. Оставьте, что там стоит, докупите или продайте — продажа возвращает ${Math.round(RULES.RESALE_SHARE * 100)}% цены.`)}
        </Banner>
      )}

      {d ? (
        <>
          <section className="card dx-card" aria-label={d.title}>
            <div className="row-between">
              <span className="xsmall faint" data-testid="dx-progress">{tr(`Decision ${index + 1} of ${count}`, `Решение ${index + 1} из ${count}`)} · {d.title}</span>
              {decided.includes(d.id) && <Badge tone="profit" icon="check">{tr('Decided', 'Решено')}</Badge>}
            </div>
            <div className="stack-sm">
              <h1 className="h2">{d.question}</h1>
              {d.why && <p className="small muted">{d.why}</p>}
            </div>
            <DecisionBody d={d} pack={pack} place={place} choices={choices} rec={rec} summary={summary} view={view} catalog={catalog} tr={tr}
              decided={decided.includes(d.id)} onChange={(c) => { setChoices(c); mark(d.id); }} />
          </section>

          <Dots decisions={decisions} decided={decided} index={index} onGo={go} tr={tr} />

          <div className="dx-actions">
            <Button variant="secondary" icon="arrowLeft" disabled={index === 0} onClick={() => go(index - 1)} aria-label={tr('Previous decision', 'Предыдущее решение')} />
            <Button block size="lg" iconRight="arrowRight" disabled={(d.kind === 'items' || d.kind === 'lever') && !decided.includes(d.id)}
              onClick={() => { mark(d.id); go(index + 1); }}>
              {(d.kind === 'items' || d.kind === 'lever') && !decided.includes(d.id)
                ? tr('Choose one to go on', 'Выберите вариант')
                : index + 1 < count ? `${tr('Next', 'Дальше')}: ${decisions[index + 1].title}` : tr('See what it adds up to', 'Посмотреть итог')}
            </Button>
          </div>
          {rec && left.length > 0 && (
            <Button variant="ghost" icon="sparkle" onClick={useRecommended}>
              {left.length === count ? tr('Use recommended for all', 'Взять рекомендованное для всего') : tr(`Use recommended for the other ${left.length}`, `Взять рекомендованное для остальных ${left.length}`)}
            </Button>
          )}
        </>
      ) : (
        <Review pack={pack} place={place} choices={choices} summary={summary} decisions={decisions} decided={decided} openDate={openDate} busy={busy} tr={tr}
          onEdit={go} onSign={sign} demo={view.world.config.demo ? view.world.config.dayMs / 1000 : null} />
      )}
    </div>
  );
}

// ───────────────────────── the three numbers on top ─────────────────────────

interface Delta { cash: number; days: number; monthly: number; key: number }

/** What the last tap did to the three numbers; fades after a moment. */
function useDelta(s: Summary): Delta | null {
  const prev = useRef(s);
  const [d, setD] = useState<Delta | null>(null);
  useEffect(() => {
    const p = prev.current;
    prev.current = s;
    const cash = s.cashLeft - p.cashLeft, days = s.days - p.days, monthly = s.monthly - p.monthly;
    if (!cash && !days && !monthly) return;
    setD((cur) => ({ cash, days, monthly, key: (cur?.key ?? 0) + 1 }));
    const t = setTimeout(() => setD(null), 2600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the three numbers matter
  }, [s.cashLeft, s.days, s.monthly]);
  return d;
}

function SummaryBar({ summary: s, delta, openDate, tr }: { summary: Summary; delta: Delta | null; openDate: string; tr: Tr }) {
  return (
    <div className="dx-bar" role="status" aria-label={tr('Your numbers so far', 'Ваши числа сейчас')}>
      <div className="dx-bar__cell">
        <span className={cx('dx-bar__value num', s.cashLeft < 0 && 'loss')} data-testid="dx-cash">{money(s.cashLeft)}</span>
        <span className="dx-bar__label">{tr('cash left after signing', 'останется после подписи')}</span>
        {delta && delta.cash !== 0 && <span key={delta.key} className={cx('dx-bar__delta num', delta.cash < 0 ? 'loss' : 'profit')} data-testid="dx-delta-cash">{signed(delta.cash)}</span>}
      </div>
      <div className="dx-bar__cell">
        <span className="dx-bar__value num" data-testid="dx-open">{openDate.replace(/^\w+, /, '')}</span>
        <span className="dx-bar__label">{tr(`doors open, in ${s.days} days`, `открытие, через ${s.days} дн.`)}</span>
        {delta && delta.days !== 0 && <span key={delta.key} className={cx('dx-bar__delta num', delta.days > 0 ? 'loss' : 'profit')}>{delta.days > 0 ? '+' : '−'}{Math.abs(delta.days)} {tr('days', 'дн.')}</span>}
      </div>
      <div className="dx-bar__cell">
        <span className="dx-bar__value num" data-testid="dx-monthly">{money(s.monthly)}</span>
        <span className="dx-bar__label">{tr('bills a month once open', 'счета в месяц после открытия')}</span>
        {delta && delta.monthly !== 0 && <span key={delta.key} className={cx('dx-bar__delta num', delta.monthly > 0 ? 'loss' : 'profit')} data-testid="dx-delta-monthly">{signed(delta.monthly)}</span>}
      </div>
    </div>
  );
}

function Dots({ decisions, decided, index, onGo, tr }: { decisions: Decision[]; decided: string[]; index: number; onGo: (i: number) => void; tr: Tr }) {
  return (
    <nav className="dx-dots" aria-label={tr('All decisions', 'Все решения')}>
      {decisions.map((x, i) => (
        <button key={x.id} type="button" className={cx('dx-dot', decided.includes(x.id) && 'dx-dot--done', i === index && 'dx-dot--here')} aria-label={`${i + 1}. ${x.title}${decided.includes(x.id) ? ` — ${tr('decided', 'решено')}` : ''}`} aria-current={i === index ? 'step' : undefined} onClick={() => onGo(i)} />
      ))}
    </nav>
  );
}

// ───────────────────────── one decision ─────────────────────────

interface BodyProps { d: Decision; pack: Pack; place: Place; choices: Choices; rec: Choices | null; summary: Summary; view: OwnerView; catalog: Catalog; tr: Tr; decided: boolean; onChange: (c: Choices) => void }

function DecisionBody(p: BodyProps) {
  if (p.d.kind === 'size') return <SizeBody {...p} />;
  if (p.d.kind === 'staff') return <StaffBody {...p} />;
  if (p.d.kind === 'price') return <PriceBody {...p} />;
  return <OptionsBody {...p} />;
}

function optionPrice(o: DecisionOption, kind: Decision['kind'], tr: Tr): { main: string; sub: string } {
  if (kind === 'lever') return o.monthly > 0 ? { main: money(o.monthly), sub: tr('a month', 'в месяц') } : { main: '$0', sub: tr('a month', 'в месяц') };
  if (o.standing) return { main: '$0', sub: tr('as it stands', 'как стоит сейчас') };
  if (o.upfront < 0) return { main: `+${money(-o.upfront)}`, sub: tr('back from the sale', 'вернётся с продажи') };
  return o.upfront > 0 ? { main: money(o.upfront), sub: tr('on signing', 'при подписи') } : { main: '$0', sub: tr('nothing extra', 'без доплаты') };
}

function optionFacts(o: DecisionOption, tr: Tr): string[] {
  const out: string[] = [];
  if (o.quality) out.push(tr(`Quality ${o.quality > 0 ? '+' : '−'}${Math.abs(o.quality)} of 100`, `Качество ${o.quality > 0 ? '+' : '−'}${Math.abs(o.quality)} из 100`));
  if (o.demand) out.push(tr(`${o.demand > 0 ? '+' : '−'}${Math.abs(Math.round(o.demand * 100))}% guests`, `${o.demand > 0 ? '+' : '−'}${Math.abs(Math.round(o.demand * 100))}% гостей`));
  if (o.capacity) out.push(tr(`+${Math.round(o.capacity * 100)}% orders the team can make`, `+${Math.round(o.capacity * 100)}% заказов, которые успевает команда`));
  if (o.waitDays) out.push(tr(`The city takes about ${o.waitDays} days; your opening does not wait for it`, `Город рассматривает около ${o.waitDays} дней; открытие этого не ждёт`));
  return out;
}

function OptionsBody({ d, choices, decided, onChange, tr }: BodyProps) {
  const picked = decided ? pickedOption(d, choices) : null;
  return (
    <div className="dx-opts" role="radiogroup" aria-label={d.question}>
      {d.options.map((o) => {
        const on = picked === o.id;
        const price = optionPrice(o, d.kind, tr);
        const facts = optionFacts(o, tr);
        return (
          <button key={o.id} type="button" role="radio" aria-checked={on} className={cx('dx-opt', on && 'dx-opt--on', o.risk && 'dx-opt--risk')} onClick={() => onChange(choose(d, o.id, choices))}>
            <span className="dx-opt__tick" aria-hidden="true">{on && <Icon name="check" size={14} strokeWidth={2.6} />}</span>
            <span className="dx-opt__main">
              <span className="dx-opt__label">{o.label}</span>
              {d.recommended === o.id && <span className="dx-opt__rec"><Badge tone="accent" icon="sparkle">{tr('Recommended', 'Рекомендуем')}</Badge></span>}
              {o.detail && <span className="dx-opt__detail">{o.detail}</span>}
              {facts.length > 0 && <span className="dx-opt__facts">{facts.join(' · ')}</span>}
              {o.risk && (
                <span className="dx-opt__law">
                  <Icon name="alert" size={14} /> {tr('Breaks the law', 'Нарушение закона')}: {o.risk.name}. {tr('If an inspector finds it', 'Если найдёт инспектор')}: {o.risk.fine}.
                </span>
              )}
            </span>
            <span className="dx-opt__price">
              <span className="num">{price.main}</span>
              <span className="dx-opt__sub">{price.sub}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function RecommendedChip({ label, onUse, tr }: { label: string; onUse: () => void; tr: Tr }) {
  return (
    <button type="button" className="chip dx-recchip" onClick={onUse}>
      <Icon name="sparkle" size={14} /> {tr('Recommended', 'Рекомендуем')}: {label}
    </button>
  );
}

function SizeBody({ d, pack, place, choices, rec, summary, onChange, tr }: BodyProps) {
  const unit = pack.sizing.unitName;
  const max = maxSizeFor(pack, place);
  const base = baselineOf(pack, place);
  const perSeat = base.takeover
    ? pack.setup.filter((s) => s.scalesWithSize).reduce((s, x) => s + x.cost, 0)
    : pack.setup.filter((s) => s.required && s.scalesWithSize).reduce((s, x) => s + setupItemCost(pack, x, place), 0);
  const forced = forcedExtras(pack, choices.size);
  const set = (n: number) => onChange(setSize(pack, place, choices, n));
  return (
    <div className="stack">
      <div className="dx-big">
        <Stepper value={choices.size} min={pack.sizing.min} max={max} onChange={set} label={`${unit}s`} format={(v) => <span className="dx-big__value num" data-testid="dx-size">{v}</span>} />
        <span className="small muted">{tr(`${unit}s · this ${place.sqft.toLocaleString('en-US')} sq ft room fits up to ${max}`, `мест · в этот зал ${place.sqft.toLocaleString('en-US')} кв. футов помещается до ${max}`)}</span>
      </div>
      <Slider value={choices.size} min={pack.sizing.min} max={max} onChange={set} label={tr(`Number of ${unit}s`, 'Число мест')} marks={[String(pack.sizing.min), String(max)]} />
      {rec && d.recommended && <RecommendedChip label={`${rec.size} ${unit}s`} onUse={() => set(rec.size)} tr={tr} />}
      <ul className="dx-facts">
        {base.takeover ? (
          <li>
            <span>{tr(`The shop has ${base.size}. A ${unit} you add costs ${money(perSeat)}; one you remove sells for ${money(perSeat * RULES.RESALE_SHARE)}`, `В заведении ${base.size}. Добавить место — ${money(perSeat)}; убранное продаётся за ${money(perSeat * RULES.RESALE_SHARE)}`)}</span>
            <span className="num">{choices.size === base.size ? '$0' : choices.size > base.size ? money(perSeat * (choices.size - base.size)) : `+${money(perSeat * (base.size - choices.size) * RULES.RESALE_SHARE)}`}</span>
          </li>
        ) : (
          <li><span>{tr(`Furniture, ${money(perSeat)} a ${unit}`, `Мебель, ${money(perSeat)} за место`)}</span><span className="num">{money(perSeat * choices.size)}</span></li>
        )}
        <li><span>{tr(`Cleaning, ${money(pack.sizing.cleaningCostPerSizeMonth)} a ${unit} a month`, `Уборка, ${money(pack.sizing.cleaningCostPerSizeMonth)} за место в месяц`)}</span><span className="num">{money(pack.sizing.cleaningCostPerSizeMonth * choices.size)}</span></li>
        <li><span>{tr('The room can turn, with guests who take away', 'Зал пропускает, вместе с теми, кто берёт с собой')}</span><span className="num">{tr(`${summary.seatsCapDay} orders a day`, `${summary.seatsCapDay} заказов в день`)}</span></li>
        {summary.cornerOrdersDay != null && <li><span>{tr('An average, known shop on this corner sells', 'Средняя известная кофейня на этом углу продаёт')}</span><span className="num">{tr(`${summary.cornerOrdersDay} a day`, `${summary.cornerOrdersDay} в день`)}</span></li>}
      </ul>
      {seatRules(pack).filter((r) => r.setupItemId && r.seats <= max).map((r) => {
        const item = pack.setup.find((s) => s.id === r.setupItemId);
        if (!item) return null;
        const active = forced.includes(item.id);
        return (
          <Banner key={r.seats} tone={active ? 'warn' : 'info'} icon={active ? 'alert' : 'info'}>
            {active
              ? tr(`${r.seats} ${unit}s or more: the law adds "${item.name}" — ${money(setupItemCost(pack, item, place))} on signing.`, `${r.seats} мест и больше: закон добавляет «${item.name}» — ${money(setupItemCost(pack, item, place))} при подписи.`)
              : tr(`From ${r.seats} ${unit}s the law adds "${item.name}": ${money(setupItemCost(pack, item, place))}.`, `С ${r.seats} мест закон добавляет «${item.name}»: ${money(setupItemCost(pack, item, place))}.`)}
            {r.law ? ` ${r.law}.` : ''}
          </Banner>
        );
      })}
    </div>
  );
}

function StaffBody({ d, pack, choices, rec, summary, onChange, tr }: BodyProps) {
  const total = staffCount(choices.staff);
  const people = summary.bills.filter((l) => l.group === 'people').reduce((s, l) => s + l.amount, 0);
  return (
    <div className="stack">
      {pack.staff.map((role) => {
        const wage = (role.tipped && role.cashWage != null ? role.cashWage : role.hourlyWage);
        return (
          <div key={role.id} className="row-between dx-role">
            <span>
              <span className="dx-role__name">{role.name}</span>
              <span className="small muted">{tr(`$${wage} an hour · ${money(wage * role.hoursPerMonth)} a month each`, `$${wage} в час · ${money(wage * role.hoursPerMonth)} в месяц на человека`)}</span>
            </span>
            <Stepper value={choices.staff[role.id] ?? 0} min={0} max={pack.capacity.maxStaff} onChange={(n) => onChange(setStaff(pack, choices, role.id, n))} label={role.name} />
          </div>
        );
      })}
      {rec && d.recommended && <RecommendedChip label={d.recommended} onUse={() => onChange({ ...choices, staff: { ...rec.staff } })} tr={tr} />}
      <ul className="dx-facts">
        <li><span>{tr(`Wages and payroll taxes for ${total}`, `Зарплаты и налоги на фонд, ${total} чел.`)}</span><span className="num">{tr(`${money(people)} a month`, `${money(people)} в месяц`)}</span></li>
        {summary.teamCapDay != null && <li><span>{tr('This team can make', 'Эта команда успевает')}</span><span className="num" data-testid="dx-teamcap">{tr(`${summary.teamCapDay} orders a day`, `${summary.teamCapDay} заказов в день`)}</span></li>}
        {summary.cornerOrdersDay != null && <li><span>{tr('An average, known shop on this corner sells', 'Средняя известная кофейня на этом углу продаёт')}</span><span className="num">{tr(`${summary.cornerOrdersDay} a day`, `${summary.cornerOrdersDay} в день`)}</span></li>}
      </ul>
      <p className="xsmall faint">{tr(`At least ${pack.capacity.minStaff}, at most ${pack.capacity.maxStaff}. Orders the team cannot make are guests who leave.`, `Не меньше ${pack.capacity.minStaff} и не больше ${pack.capacity.maxStaff}. Заказы, которые команда не успела, — это ушедшие гости.`)}</p>
    </div>
  );
}

/** Shops of the same niche close enough to share the passers-by: players and residents first, then real shops from city records. */
function rivalsNear(place: Place, niche: NicheId, neighbors: PublicBusiness[], places: Place[], radiusM: number): { name: string; distM: number; price?: number }[] {
  const byId = new Map(places.map((x) => [x.id, x]));
  const playing = neighbors.filter((b) => b.niche === niche && b.status !== 'bankrupt' && b.placeId !== place.id).flatMap((b) => {
    const at = byId.get(b.placeId);
    const distM = at ? Math.round(distanceM(at, place)) : Infinity;
    return distM <= radiusM ? [{ name: b.name, distM, price: b.price }] : [];
  }).sort((a, b) => a.distM - b.distM);
  if (playing.length) return playing.slice(0, 3);
  return (rivalsOf(place, niche)?.nearest ?? []).slice(0, 3).map((r) => ({ name: r.name, distM: Math.round(r.distM) }));
}

function PriceBody({ d, pack, place, choices, rec, summary, view, catalog, onChange, tr }: BodyProps) {
  const unit = pack.unit;
  const radius = footfallParams(pack)?.radiusM ?? 250;
  const rivals = rivalsNear(place, pack.id, view.neighbors, catalog.places, radius);
  const set = (v: number) => onChange(setPrice(pack, choices, v));
  return (
    <div className="stack">
      <div className="dx-big">
        <span className="dx-big__value num" data-testid="dx-price">{formatMoney(choices.price, { cents: true })}</span>
        <span className="small muted">{tr(`an average ${unit.name}`, 'средний заказ')}</span>
      </div>
      <Slider value={choices.price} min={unit.priceMin} max={unit.priceMax} step={0.25} onChange={set} label={tr('Price', 'Цена')} format={(v) => formatMoney(v, { cents: true })} marks={[formatMoney(unit.priceMin), formatMoney(unit.priceMax)]} />
      {rec && d.recommended && <RecommendedChip label={formatMoney(rec.price, { cents: true })} onUse={() => set(rec.price)} tr={tr} />}
      <ul className="dx-facts">
        <li><span>{tr('You keep from each order, after ingredients, cup and card fees', 'С каждого заказа остаётся после продуктов, стакана и комиссии')}</span><span className="num" data-testid="dx-margin">{formatMoney(summary.marginPerOrder, { cents: true })}</span></li>
        <li><span>{tr('Orders a day that pay your monthly bills', 'Заказов в день, чтобы покрыть счета месяца')}</span><span className="num" data-testid="dx-breakeven">{summary.breakEvenDay ?? '—'}</span></li>
        {summary.cornerOrdersDay != null && <li><span>{tr(`An average, known shop on this corner sells at ${formatMoney(unit.refPrice, { cents: true })}`, `Средняя известная кофейня на этом углу продаёт по ${formatMoney(unit.refPrice, { cents: true })}`)}</span><span className="num">{tr(`${summary.cornerOrdersDay} a day`, `${summary.cornerOrdersDay} в день`)}</span></li>}
      </ul>
      {rivals.length > 0 && (
        <div className="stack-sm">
          <span className="field__label">{rivals[0].price != null ? tr('Who you share the sidewalk with', 'С кем вы делите прохожих') : tr('Real coffee shops on this block (city records)', 'Настоящие кофейни в этом квартале (данные города)')}</span>
          <ul className="dx-facts">
            {rivals.map((r) => (
              <li key={`${r.name}-${r.distM}`}><span>{r.name} · {r.distM} m</span><span className="num">{r.price != null ? formatMoney(r.price, { cents: true }) : ''}</span></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── the result: why this much money is left ─────────────────────────

function chosenLabel(d: Decision, c: Choices, pack: Pack, tr: Tr): string {
  if (d.kind === 'size') return `${c.size} ${pack.sizing.unitName}s`;
  if (d.kind === 'price') return formatMoney(c.price, { cents: true });
  if (d.kind === 'staff') return pack.staff.filter((r) => (c.staff[r.id] ?? 0) > 0).map((r) => `${c.staff[r.id]} × ${r.name.toLowerCase()}`).join(', ');
  return d.options.find((o) => o.id === pickedOption(d, c))?.label ?? tr('not decided', 'не решено');
}

function Review({ pack, place, choices, summary: s, decisions, decided, openDate, busy, tr, onEdit, onSign, demo }: { pack: Pack; place: Place; choices: Choices; summary: Summary; decisions: Decision[]; decided: string[]; openDate: string; busy: boolean; tr: Tr; onEdit: (i: number) => void; onSign: () => void; demo: number | null }) {
  const lines = receipt(pack, place, choices);
  const f = footfallParams(pack);
  const undecided = decisions.filter((d) => !decided.includes(d.id));
  const short = s.cashLeft < 0;
  const thin = !short && s.cashAtOpening < s.monthly;
  const risks = decisions.flatMap((d) => {
    const o = decided.includes(d.id) ? d.options.find((x) => x.id === pickedOption(d, choices)) : undefined;
    return o?.risk ? [{ title: d.title, risk: o.risk }] : [];
  });
  return (
    <div className="stack-lg">
      <div className="stack-sm">
        <h1 className="h2" data-testid="dx-verdict">
          {short
            ? tr(`This setup costs ${money(-s.cashLeft)} more than you have`, `Этот набор стоит на ${money(-s.cashLeft)} больше, чем у вас есть`)
            : tr(`You open ${openDate.replace(/^\w+, /, '')} with ${money(s.cashAtOpening)} in the bank`, `Вы открываетесь ${openDate.replace(/^\w+, /, '')} с ${money(s.cashAtOpening)} в банке`)}
        </h1>
        <p className="muted">{tr(`${place.address}. Every line below is a choice you made or a rule of the city.`, `${place.address}. Каждая строка ниже — ваш выбор или правило города.`)}</p>
      </div>

      <Card title={tr('Where the money goes', 'Куда уходят деньги')}>
        <ul className="dx-receipt">
          <li className="dx-receipt__top"><span>{tr('You start with', 'У вас на старте')}</span><span className="num">{money(s.capital)}</span></li>
          {lines.map((l) => (
            <li key={l.id}>
              <span>{l.label}{l.yours && <span className="dx-receipt__yours"> · {tr('your choice', 'ваш выбор')}</span>}</span>
              <span className="num">{l.amount < 0 ? `+${money(-l.amount)}` : `−${money(l.amount)}`}</span>
            </li>
          ))}
          <li className="dx-receipt__sum"><span>{tr('Cash left after signing', 'Останется после подписи')}</span><span className={cx('num', short && 'loss')} data-testid="dx-review-cash">{money(s.cashLeft)}</span></li>
          <li><span>{tr(`Rent until the doors open: ${s.days} days × ${money(s.rentDay)}`, `Аренда до открытия дверей: ${s.days} дн. × ${money(s.rentDay)}`)}</span><span className="num">−{money(s.rentBeforeOpening)}</span></li>
          <li className="dx-receipt__sum"><span>{tr('In the bank on opening day', 'В банке в день открытия')}</span><span className={cx('num', s.cashAtOpening < 0 && 'loss')} data-testid="dx-review-opening">{money(s.cashAtOpening)}</span></li>
        </ul>
      </Card>

      <Card title={tr('Your bet', 'Ваша ставка')} tone={thin ? 'warn' : 'default'}>
        <ul className="dx-facts">
          <li><span>{tr('Bills every month once the doors are open', 'Счета каждый месяц после открытия')}</span><span className="num">{money(s.monthly)}</span></li>
          <li><span>{tr('Orders a day that pay those bills', 'Заказов в день, чтобы их покрыть')}</span><span className="num">{s.breakEvenDay ?? '—'}</span></li>
          {s.cornerOrdersDay != null && <li><span>{tr('An average, known shop on this corner sells', 'Средняя известная кофейня на этом углу продаёт')}</span><span className="num">{tr(`${s.cornerOrdersDay} a day`, `${s.cornerOrdersDay} в день`)}</span></li>}
          {s.monthsOfBills != null && <li><span>{tr('Months of bills your opening-day cash covers with no sales', 'На сколько месяцев счетов хватит денег без единой продажи')}</span><span className="num">{s.monthsOfBills}</span></li>}
          <li><span>{tr('Quality of what you set up (the usual shop is 50)', 'Качество того, что вы собрали (обычная кофейня — 50)')}</span><span className="num" data-testid="dx-quality">{tr(`${Math.round(s.quality * 100)} of 100`, `${Math.round(s.quality * 100)} из 100`)}</span></li>
        </ul>
        {f && f.awarenessStart < 1 && (
          <p className="small muted">{tr(
            `A new shop starts with about ${Math.round(f.awarenessStart * 100)}% of the crowd it will have once the block knows it, and closes most of the gap in about ${f.rampDays} days. The cash above has to carry you through that climb.`,
            `Новая кофейня начинает примерно с ${Math.round(f.awarenessStart * 100)}% гостей, которые будут у неё, когда квартал её узнает, и закрывает большую часть разрыва примерно за ${f.rampDays} дней. Денег выше должно хватить на этот подъём.`)}</p>
        )}
        {risks.map((r) => (
          <Banner key={r.title} tone="warn">{tr('You chose to break the law', 'Вы решили нарушить закон')} — {r.title}: {r.risk.name}. {tr('If an inspector finds it', 'Если найдёт инспектор')}: {r.risk.fine}.</Banner>
        ))}
        {thin && <Banner tone="warn">{tr('Less than one month of bills in the bank on opening day. A slow first month ends the business. Go back and cut something, or pick a cheaper place.', 'В день открытия в банке меньше одного месяца счетов. Один медленный месяц — и бизнес закрыт. Вернитесь и сократите что-нибудь или выберите место дешевле.')}</Banner>}
      </Card>

      <Card title={tr('What you decided', 'Что вы решили')} subtitle={tr('Tap a line to change it.', 'Нажмите на строку, чтобы изменить.')}>
        <ul className="dx-list">
          {decisions.map((d, i) => (
            <li key={d.id}>
              <button type="button" className="dx-list__row" onClick={() => onEdit(i)}>
                <span className="dx-list__title">{d.title}</span>
                <span className={cx('dx-list__value', !decided.includes(d.id) && 'warn')}>{decided.includes(d.id) ? chosenLabel(d, choices, pack, tr) : tr('not decided yet', 'ещё не решено')}</span>
                <Icon name="chevronRight" size={16} className="faint" />
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <div className="stack-sm">
        <Button block size="lg" icon="doc" loading={busy} disabled={short || undecided.length > 0} onClick={onSign}>
          {short ? tr('Not enough money: change a decision', 'Не хватает денег: измените решение')
            : undecided.length > 0 ? tr(`${undecided.length} decisions left`, `Осталось решений: ${undecided.length}`)
            : tr(`Sign the lease and pay ${money(s.paid)}`, `Подписать аренду и заплатить ${money(s.paid)}`)}
        </Button>
        <p className="xsmall faint" style={{ textAlign: 'center' }}>
          {tr('Rent starts the day you sign. Wages start on opening day. Team, pay, roaster, hours and price can be changed any day; what you bought can be sold back at a loss.', 'Аренда идёт со дня подписи. Зарплаты — со дня открытия. Команду, оплату, обжарщика, часы и цену можно менять в любой день; купленное можно продать с потерей.')}
          {demo != null ? ` ${tr(`Demo city: one game day passes every ${demo} seconds.`, `Демо-город: игровой день проходит каждые ${demo} секунд.`)}` : ''}
        </p>
      </div>
    </div>
  );
}
