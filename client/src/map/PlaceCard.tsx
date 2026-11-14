// Card for one place in "pick" mode: the facts a future owner needs before signing a lease, and what they mean.
// Decision: sign here or keep looking. Answer right away: orders a day, who splits the passers-by, cost and days to open.
// Why look again tomorrow: the city is live; a rival may be getting ready next door, or someone signs this lease first.
import type { NicheId, PackSet, Place, PublicBusiness } from '@ohh/shared/types';
import { useT } from '../ui/i18n';
import { NICHE_META, capacityFor, money, occupiedPlaceIds } from './geo';
import { daysLabel, monthlySales, placeFacts, placeStake, rivalMeaning, type PlaceFacts } from './placeFacts';

export interface PlaceCardProps {
  place: Place; places: Place[]; businesses: PublicBusiness[]; niche?: NicheId; packs?: PackSet;
  onOpen?: (placeId: string) => void; onClose: () => void;
  /** Short map frame (a step of a longer page): one summary line and the button; the page shows the details. */
  compact?: boolean;
  /** The player's own business does not count as a rival of its own place. */
  myBusinessId?: string;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const n0 = (x: number) => Math.round(x).toLocaleString('en-US');
const plural = (n: number, unit: string) => (n === 1 || unit.endsWith('s') ? unit : `${unit}s`);

export function PlaceCard({ place, places, businesses, niche, packs, onOpen, onClose, compact = false, myBusinessId }: PlaceCardProps) {
  const tr = useT();
  const taken = occupiedPlaceIds(businesses).has(place.id);
  const fits = niche ? place.suitableFor.includes(niche) : place.suitableFor.length > 0;
  const n = niche && place.suitableFor.includes(niche) ? niche : place.suitableFor[0];
  const pack = n ? packs?.niches[n] : undefined;
  const facts = placeFacts(place, pack, businesses, places, { exceptBusinessId: myBusinessId, taken });
  const cap = n ? capacityFor(place, n, packs) : null;
  const meta = n ? NICHE_META[n] : null;
  const label = taken ? tr('Taken', 'Занято') : !fits ? null : compact ? tr('Choose this place', 'Выбрать это место') : tr('Open here', 'Открыться здесь');
  const notFit = tr(`Not for a ${niche ? NICHE_META[niche].label.toLowerCase() : 'business'}`, 'Не подходит для этого дела');

  return (
    <section className={`cm-card${compact ? ' cm-card--compact' : ''}`} role="dialog" aria-label={`Place at ${place.address}`}>
      <header className="cm-card__head">
        <div>
          <div className="cm-card__eyebrow">{place.block}</div>
          <h3 className="cm-card__title">{place.address}</h3>
        </div>
        <button type="button" className="cm-card__close" onClick={onClose} aria-label={tr('Close', 'Закрыть')}>×</button>
      </header>

      {compact ? (
        <p className="cm-place__summary">
          {facts.ordersDay != null && <><strong>≈{n0(facts.ordersDay)}</strong> {tr('orders/day', 'заказов/день')} · </>}
          {facts.passersBy != null && <>{n0(facts.passersBy)} {tr('walk by', 'прохожих')} · </>}
          {money(facts.rentMonth)}{tr('/mo', '/мес')}
          {facts.opening && <> · {tr('opens in', 'открытие через')} {daysLabel(facts.opening.days, tr)}</>}
        </p>
      ) : (
        <>
          <div className="cm-card__tags">
            <span className={`cm-tag cm-tag--${place.tier}`}>{place.tier}</span>
            <span className="cm-tag">{place.kind === 'building' ? tr('Whole building', 'Здание целиком') : tr('Storefront', 'Витрина')}</span>
            {place.corner && <span className="cm-tag">{tr('Corner', 'Угол')}</span>}
            {place.suitableFor.map((s) => <span key={s} className="cm-tag cm-tag--niche" style={{ color: NICHE_META[s].color }}>{NICHE_META[s].glyph} {NICHE_META[s].label}</span>)}
          </div>
          <PlaceFactsBody facts={facts} cap={cap} unitLabel={meta?.label} place={place} budget={pack?.startCapital} />
        </>
      )}

      <button type="button" className="cm-btn cm-btn--primary" disabled={taken || !fits || !onOpen} onClick={() => onOpen?.(place.id)}>
        {label ?? notFit}{!taken && fits && facts.opening ? ` · ${tr('from', 'от')} ${money(facts.opening.cost)}` : ''}
      </button>
    </section>
  );
}

/** The facts of one place without the card frame: the map card uses it, and a page can show it under a small map. */
export function PlaceFactsBody({ facts: f, cap, unitLabel, place, budget }: { facts: PlaceFacts; cap?: { units: number; unitName: string } | null; unitLabel?: string; place: Place; budget?: number }) {
  const tr = useT();
  const unverified = /unverified/i.test(place.note ?? '');
  const shopWord = (unitLabel ?? 'shop').toLowerCase();
  return (
    <div className="cm-place">
      {f.ordersDay != null && (
        <div className="cm-place__lead">
          <div className="cm-place__big"><strong>≈{n0(f.ordersDay)}</strong> {tr('orders a day', 'заказов в день')}</div>
          <div className="cm-card__sub">
            {tr(
              `estimate for an average ${shopWord} at ${money(f.refPrice)}, once the regulars know it · about ${money(monthlySales(f.ordersDay, f.refPrice))} of sales a month`,
              `оценка для средней точки по ${money(f.refPrice)}, когда постоянные её узнают · около ${money(monthlySales(f.ordersDay, f.refPrice))} продаж в месяц`,
            )}
          </div>
        </div>
      )}

      {f.split && <SplitBar split={f.split} radiusM={f.radiusM} />}

      <p className="cm-place__stake" role="note">{placeStake(f, tr)}</p>

      <dl className="cm-card__grid">
        <div>
          <dt>{tr('Walk by a day', 'Прохожих в день')}</dt>
          <dd>{f.passersBy != null ? n0(f.passersBy) : '—'}</dd>
          <span className="cm-card__sub" title={f.passersNote}>{f.passersBy != null ? tr('weekday, both sidewalks · modelled', 'будний день, обе стороны · расчёт') : tr('no count for this block', 'нет данных по кварталу')}</span>
        </div>
        <div>
          <dt>{tr('Rent', 'Аренда')}</dt><dd>{money(f.rentMonth)}<small>{tr('/mo', '/мес')}</small></dd>
          <span className="cm-card__sub">${place.rentPerSqftYear}{tr('/sq ft/yr', '/кв. фут в год')} · {n0(place.sqft)} sq ft</span>
        </div>
        <div>
          <dt>{tr('Rivals within', 'Соперники в')} {f.radiusM} m</dt>
          <dd>{f.playingRivals.length}<small> {tr('in the game', 'в игре')}</small></dd>
          {f.realRivals && <span className="cm-card__sub">{tr(`+ ${f.realRivals.within150m} real ones within 150 m`, `+ ${f.realRivals.within150m} настоящих в 150 м`)}</span>}
        </div>
        <div>
          <dt>{tr('Doors open in', 'Открытие через')}</dt>
          <dd>{f.opening ? daysLabel(f.opening.days, tr) : '—'}</dd>
          {f.opening && <span className="cm-card__sub">{tr(`${f.opening.days} days from the lease · rent from day one`, `${f.opening.days} дн. от подписания · аренда с первого дня`)}</span>}
        </div>
        {cap && <div><dt>{tr('Fits', 'Вмещает')}</dt><dd>{cap.units}<small> {plural(cap.units, cap.unitName)}</small></dd></div>}
        {f.opening && (
          <div>
            <dt>{tr('Opens from', 'Открытие от')}</dt>
            <dd className={budget && f.opening.cost > budget ? 'cm-down' : undefined}>{money(f.opening.cost)}</dd>
            <span className="cm-card__sub">
              {budget && f.opening.cost > budget
                ? tr(`${money(f.opening.cost - budget)} more than the ${money(budget)} you start with`, `на ${money(f.opening.cost - budget)} больше стартовых ${money(budget)}`)
                : tr(`${f.opening.kitName} kit${budget ? ` · leaves ${money(budget - f.opening.cost)} to live on` : ''}`, `набор ${f.opening.kitName}${budget ? ` · останется ${money(budget - f.opening.cost)} на жизнь` : ''}`)}
            </span>
          </div>
        )}
      </dl>

      {f.former && (
        <p className="cm-place__line">
          <span className="cm-place__k">{tr('Before', 'Раньше')}</span>
          {f.former.takeover
            ? tr(
              `${f.former.label}: asking ${money(f.former.askingPrice ?? 0)}, ${f.former.build.days} days of handover, no build-out.`,
              `действующий бизнес на продаже: просят ${money(f.former.askingPrice ?? 0)}, ${f.former.build.days} дн. на передачу, без ремонта.`,
            )
            : tr(
              `${f.former.build.label}: ${money(f.former.build.cost)}, ${f.former.build.days} days.`,
              `${formerRu(place.formerUse)}. Ремонт: ${money(f.former.build.cost)}, ${f.former.build.days} дн.`,
            )}
        </p>
      )}

      {(f.playingRivals.length > 0 || (f.realRivals?.nearest.length ?? 0) > 0) && (
        <ul className="cm-place__rivals" aria-label={tr('Rivals nearby', 'Соперники рядом')}>
          {f.playingRivals.slice(0, 3).map((r) => (
            <li key={r.id}><strong>{r.name}</strong>{r.isAi ? <i className="cm-place__ai">AI</i> : null} — {rivalMeaning(r, tr)}</li>
          ))}
          {f.realRivals?.nearest.map((r) => (
            <li key={r.name} className="cm-place__real">{r.name} — {tr(`real café, ${r.distM} m`, `настоящее кафе, ${r.distM} м`)}</li>
          ))}
        </ul>
      )}

      {f.neighbours.length > 0 && (
        <ul className="cm-place__near" aria-label={tr('What stands nearby', 'Что рядом')}>
          {f.neighbours.slice(0, 3).map((a) => <li key={`${a.kind}-${a.name}`}><strong>{a.name}</strong> {a.distM} m · {a.effect}</li>)}
        </ul>
      )}

      {unverified && <p className="cm-card__note">{tr('Address and size hand-collected on real streets, not yet checked against city records.', 'Адрес и площадь собраны вручную на настоящих улицах, с городскими записями ещё не сверены.')}</p>}
    </div>
  );
}

function formerRu(u: Place['formerUse']): string {
  return u === 'cafe' ? 'Раньше здесь было кафе' : u === 'food' ? 'Раньше здесь была еда' : u === 'salon' ? 'Раньше здесь был салон' : 'Раньше здесь был магазин';
}

/** Who sells to the same passers-by: this shop, real cafés around, playing rivals, and everywhere else. */
function SplitBar({ split, radiusM }: { split: NonNullable<PlaceFacts['split']>; radiusM: number }) {
  const tr = useT();
  const total = split.you + split.real + split.players + split.outside;
  const parts = [
    { k: 'you', w: split.you, label: tr('You', 'Ты') },
    { k: 'real', w: split.real, label: tr('Real cafés', 'Настоящие кафе') },
    { k: 'players', w: split.players, label: tr('Players', 'Игроки') },
    { k: 'out', w: split.outside, label: tr('Elsewhere', 'В другом месте') },
  ].filter((p) => p.w > 0.001);
  return (
    <div className="cm-split" aria-label={tr(`Your share of people who buy here: ${pct(split.yourShare)}`, `Твоя доля покупающих прохожих: ${pct(split.yourShare)}`)}>
      <div className="cm-split__bar" aria-hidden="true">
        {parts.map((p) => <span key={p.k} className={`cm-split__${p.k}`} style={{ flexGrow: p.w }} />)}
      </div>
      <ul className="cm-split__legend">
        {parts.map((p) => <li key={p.k}><i className={`cm-split__${p.k}`} />{p.label} {pct(p.w / total)}</li>)}
      </ul>
      <div className="cm-card__sub">{tr(`Shops within ${radiusM} m split the same passers-by; the closer, the more they take.`, `Точки в радиусе ${radiusM} м делят тех же прохожих; чем ближе, тем больше забирают.`)}</div>
    </div>
  );
}
