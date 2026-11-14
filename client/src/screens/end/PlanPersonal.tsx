// The parts of the real-world plan built from this player's own season (B09): what it takes before the first sale,
// the savings check (the decision on this page), the place, the team and the equipment, and the risks of this address.
import { useId, useState } from 'react';
import type { PackRoadmapStep } from '@ohh/shared/types';
import { Icon, SegmentedControl, useT } from '../../ui';
import { int, money } from '../insights/format';
import { RESERVE_CHOICES, aheadOf, nextStep, parseMoney, readiness, type PersonalPlan, type PlanStepMine, type ReserveMonths } from './personal';

const shortMoney = (n: number) => money(n);
const weeks = (n: number) => `${n} ${n === 1 ? 'week' : 'weeks'}`;

/** The top of the plan: how much, on what, how long, how much in reserve. */
export function PlanSummaryBlock({ me }: { me: PersonalPlan }) {
  const tr = useT();
  const s = me.summary;
  const max = Math.max(1, ...s.parts.map((p) => p.amount));
  return (
    <section className="plan-block plan-summary" aria-labelledby="plan-summary">
      <h2 id="plan-summary" className="h3">{tr('Before your first sale', 'До первой продажи')}</h2>
      <div className="plan-summary__head">
        <div>
          <div className="plan-kicker">{tr('Money you need', 'Нужно денег')}</div>
          <div className="plan-big num" data-testid="cash-before">{shortMoney(s.cashBeforeFirstSale)}</div>
        </div>
        <div>
          <div className="plan-kicker">{tr('From lease to first sale', 'От аренды до первой продажи')}</div>
          <div className="plan-big num">{weeks(s.weeksToOpen)}</div>
          <div className="small muted">{int(s.daysToOpen)} {tr('days', 'дн.')}{s.opened ? tr(' in your season', ' в вашем сезоне') : tr(' expected', ' ожидается')}</div>
        </div>
        <div>
          <div className="plan-kicker">{tr('Keep in reserve', 'Держать в запасе')}</div>
          <div className="plan-big num">{shortMoney(s.reserve)}</div>
          <div className="small muted">{tr(`${s.reserveMonths} months of fixed costs`, `${s.reserveMonths} мес. постоянных расходов`)}</div>
        </div>
      </div>
      <ul className="plan-parts" aria-label={tr('Where the money goes', 'На что уходят деньги')}>
        {s.parts.map((p) => (
          <li key={p.id} className="plan-part">
            <span className="plan-part__label">{p.label}</span>
            <span className="plan-part__bar" aria-hidden="true"><span style={{ width: `${Math.max(2, (p.amount / max) * 100)}%` }} /></span>
            <span className="num plan-part__amount">{money(p.amount)}</span>
          </li>
        ))}
      </ul>
      <p className="plan-note">
        {tr('All in, have', 'Всего нужно')} <strong className="num">{money(s.totalNeeded)}</strong> {tr('before you sign the lease.', 'до подписания аренды.')}
        {s.realLife && <> {tr(`In real life the build-out often runs longer than in the game: the research notes budget ${s.realLife.rentMonths} months of rent before opening for a space like this, ${money(s.realLife.amount)}.`, `В жизни ремонт часто дольше, чем в игре: исследование закладывает ${s.realLife.rentMonths} мес. аренды до открытия для такого помещения — ${money(s.realLife.amount)}.`)}</>}
      </p>
    </section>
  );
}

/** The decision on this page: how much the person has and how many months they keep aside. The verdict follows at once. */
export function SavingsCheck({ me, savings, reserveMonths, onSavings, onReserve }: { me: PersonalPlan; savings: number | null; reserveMonths: ReserveMonths; onSavings: (n: number | null) => void; onReserve: (m: ReserveMonths) => void }) {
  const tr = useT();
  const id = useId();
  const [text, setText] = useState(savings != null ? String(savings) : '');
  const r = savings != null ? readiness(me.summary, savings, reserveMonths) : null;
  return (
    <section className="plan-block plan-check" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="h3">{tr('Can you open it with your savings?', 'Хватит ли ваших сбережений?')}</h2>
      <div className="plan-check__inputs">
        <label className="field plan-check__field" htmlFor={`${id}-in`}>
          <span className="field__label">{tr('Your savings for the business', 'Ваши сбережения на бизнес')}</span>
          <input id={`${id}-in`} className="input num" inputMode="decimal" placeholder="$120,000" value={text}
            onChange={(e) => { setText(e.target.value); onSavings(parseMoney(e.target.value)); }} />
        </label>
        <div className="field">
          <span className="field__label">{tr('Months of reserve', 'Месяцев запаса')}</span>
          <SegmentedControl label={tr('Months of reserve', 'Месяцев запаса')} value={String(reserveMonths) as `${ReserveMonths}`}
            options={RESERVE_CHOICES.map((m) => ({ value: String(m) as `${ReserveMonths}`, label: `${m}` }))}
            onChange={(v) => onReserve(Number(v) as ReserveMonths)} />
        </div>
      </div>
      <div className="plan-check__verdict" role="status" aria-live="polite" data-verdict={r?.verdict ?? 'none'}>
        {!r && <span className="muted">{tr('Type what you could put in. Nothing leaves this device.', 'Введите, сколько готовы вложить. Число остаётся на этом устройстве.')}</span>}
        {r && r.verdict === 'short' && (
          <><Icon name="alert" size={16} /> <span><strong>{tr(`Short by ${money(-r.gap)}.`, `Не хватает ${money(-r.gap)}.`)}</strong> {r.carries !== null && savings! >= me.summary.cashBeforeFirstSale
            ? tr(`After opening you would have ${r.carries} months of costs in the bank: one slow season closes the shop.`, `После открытия на счету останется ${r.carries} мес. расходов: один слабый сезон закроет кафе.`)
            : tr(`You run out before the first sale. Look for a cheaper door, a smaller room, or a partner.`, `Деньги кончатся до первой продажи. Ищите помещение дешевле, зал меньше или партнёра.`)}</span></>
        )}
        {r && r.verdict === 'thin' && (
          <><Icon name="info" size={16} /> <span><strong>{tr(`You can open, with ${money(-r.gap)} less reserve than you chose.`, `Открыться можно, но запас на ${money(-r.gap)} меньше выбранного.`)}</strong> {tr(`Your savings carry ${r.carries} months of costs after opening.`, `Сбережений хватит на ${r.carries} мес. расходов после открытия.`)}</span></>
        )}
        {r && r.verdict === 'ready' && (
          <><Icon name="check" size={16} /> <span><strong>{tr(`Covered, with ${money(r.gap)} to spare.`, `Хватает, и остаётся ${money(r.gap)}.`)}</strong> {tr(`Your savings carry ${r.carries} months of costs after opening.`, `Сбережений хватит на ${r.carries} мес. расходов после открытия.`)}</span></>
        )}
      </div>
    </section>
  );
}

/** The address, the room, the team and the equipment, with this player's prices. */
export function PlanPlaceBlock({ me }: { me: PersonalPlan }) {
  const tr = useT();
  const [kitOpen, setKitOpen] = useState(false);
  const p = me.place;
  return (
    <div className="plan-pair">
      <section className="plan-block plan-half" aria-labelledby="plan-place">
        <h2 id="plan-place" className="h3">{tr('Your place', 'Ваше помещение')}</h2>
        {p ? (
          <table className="plan-table"><tbody>
            <tr className="plan-row"><td>{tr('Address', 'Адрес')}</td><td className="num plan-wrap">{p.address}</td></tr>
            <tr className="plan-row"><td>{tr('Size', 'Площадь')}</td><td className="num">{int(p.sqft)} sq ft · {me.size} {me.sizeUnit}s</td></tr>
            <tr className="plan-row"><td>{tr('Rent', 'Аренда')}</td><td className="num">{money(p.rentMonth)} {tr('a month', 'в месяц')}</td></tr>
            {p.deposit != null && <tr className="plan-row"><td>{tr('Deposit', 'Депозит')}{p.depositMonths ? ` (${p.depositMonths} ${tr('months', 'мес.')})` : ''}</td><td className="num">{money(p.deposit)}</td></tr>}
            {p.takeoverPrice != null && <tr className="plan-row"><td>{tr('Buying the operating business', 'Покупка действующего бизнеса')}</td><td className="num">{money(p.takeoverPrice)}</td></tr>}
            {p.buildout && <tr className="plan-row"><td>{tr('Build-out', 'Ремонт')}<div className="xsmall muted">{p.buildout.label}</div></td><td className="num">{money(p.buildout.cost)}<div className="xsmall muted">{money(p.buildout.perSqft, { cents: p.buildout.perSqft % 1 !== 0 })}/sq ft · {p.buildout.days} {tr('days', 'дн.')}</div></td></tr>}
            {p.pedestriansPerDay != null && <tr className="plan-row"><td>{tr('People passing a day', 'Прохожих в день')}</td><td className="num">{int(p.pedestriansPerDay)}</td></tr>}
            <tr className="plan-row"><td>{tr('Coffee shops nearby', 'Кофейни рядом')}</td><td className="num">{p.rivals.real150m + p.rivals.players}{p.rivals.nearest ? <div className="xsmall muted">{tr('nearest', 'ближайшая')}: {p.rivals.nearest.name}, {p.rivals.nearest.distM} m</div> : null}</td></tr>
          </tbody></table>
        ) : <p className="small muted">{tr('The place is not on the map any more.', 'Этого места больше нет на карте.')}</p>}
      </section>
      <section className="plan-block plan-half" aria-labelledby="plan-team">
        <h2 id="plan-team" className="h3">{tr('Your team and your kit', 'Ваша команда и оборудование')}</h2>
        <table className="plan-table"><tbody>
          {me.staff.map((r) => <tr key={r.roleId} className="plan-row"><td>{r.count} × {r.name} · {money(r.hourlyWage, { cents: r.hourlyWage % 1 !== 0 })}/h · {r.hoursPerMonth} h</td><td className="num">{money(r.monthly)}</td></tr>)}
          {me.payrollTaxMonth > 0 && <tr className="plan-row"><td>{tr('Payroll taxes', 'Налоги на зарплату')}</td><td className="num">{money(me.payrollTaxMonth)}</td></tr>}
        </tbody>
          <tfoot><tr className="plan-row plan-total"><td>{tr('Team a month', 'Команда в месяц')}</td><td className="num">{money(me.payrollMonth + me.payrollTaxMonth)}</td></tr></tfoot>
        </table>
        <div className="plan-kit" data-open={kitOpen || undefined}>
          <button type="button" className="plan-kit__toggle small no-print" aria-expanded={kitOpen} onClick={() => setKitOpen((x) => !x)}>
            {tr(`${me.equipment.length} pieces of equipment and furniture, ${money(me.equipmentTotal)} new`, `${me.equipment.length} единиц оборудования и мебели, ${money(me.equipmentTotal)} новыми`)}
          </button>
          <table className="plan-table plan-kit__list"><tbody>
            {me.equipment.map((e) => <tr key={e.id} className="plan-row"><td>{e.qty > 1 ? `${e.name} × ${e.qty}` : e.name}</td><td className="num">{money(e.total)}</td></tr>)}
          </tbody></table>
        </div>
        {me.firstOrder && <p className="plan-note">{tr('First order', 'Первый заказ')}: <strong className="num">{money(me.firstOrder.amount)}</strong>{me.firstOrder.sourcing ? ` — ${me.firstOrder.sourcing}` : ''}. {tr(`You sell at ${money(me.price, { cents: true })} each.`, `Цена: ${money(me.price, { cents: true })} за заказ.`)}</p>}
      </section>
    </div>
  );
}

/** The three risks of this address, from this player's own season. */
export function PlanRisks({ me }: { me: PersonalPlan }) {
  const tr = useT();
  if (!me.risks.length) return null;
  return (
    <section className="plan-block" aria-labelledby="plan-risks">
      <h2 id="plan-risks" className="h3">{tr(`${['One risk', 'Two risks', 'Three risks'][Math.min(3, me.risks.length) - 1]} of this place`, `Главные риски этого места`)}</h2>
      <ol className="plan-lessons">
        {me.risks.map((r, i) => (
          <li key={r.id} className="plan-row plan-lesson">
            <div className="plan-lesson__head"><span className="plan-num" aria-hidden="true">{i + 1}</span><strong className="grow">{r.title}</strong>{r.amount != null && <span className="num plan-loss">{money(r.amount)}</span>}</div>
            <div className="small">{r.why}</div>
            <div className="small"><strong>{tr('What to do', 'Что делать')}:</strong> {r.fix}</div>
          </li>
        ))}
      </ol>
    </section>
  );
}

const STATUS_LABEL = { done: ['done in your season', 'сделано в сезоне'], waiting: ['waiting', 'ждёт'], todo: ['ahead', 'впереди'] } as const;

/** Status in the game and this player's line for one step. */
export function StepMine({ mine, day }: { mine?: PlanStepMine; day?: number }) {
  const tr = useT();
  if (!mine) return null;
  const [en, ru] = STATUS_LABEL[mine.status];
  const wait = mine.status === 'waiting' && mine.readyDay != null && day != null ? ` · ${mine.readyDay - day} ${tr('days', 'дн.')}` : '';
  return (
    <div className="plan-step__mine small">
      <span className={`plan-status plan-status--${mine.status}`}>{tr(en, ru)}{wait}</span>
      {mine.mine && <span className="plan-step__yours"><strong>{tr('Yours', 'У вас')}:</strong> {mine.mine}</span>}
    </div>
  );
}

/** The reason to come back: the next step to do in real life, and how far along the person is. */
export function NextRealStep({ steps, done }: { steps: PackRoadmapStep[]; done: ReadonlySet<string> }) {
  const tr = useT();
  const next = nextStep(steps, done);
  const ahead = aheadOf(steps, done);
  const n = steps.length - ahead.count;
  return (
    <div className="plan-next" role="status">
      <div className="plan-kicker">{tr(`Real life: ${n} of ${steps.length} steps done`, `В жизни: сделано ${n} из ${steps.length}`)}</div>
      <div className="plan-next__bar" aria-hidden="true"><span style={{ width: `${steps.length ? (n / steps.length) * 100 : 0}%` }} /></div>
      {next ? (
        <p className="small" style={{ margin: 0 }}>
          <strong>{tr('Next', 'Следующий шаг')}: {next.title}</strong>
          {next.agency ? ` — ${next.agency}` : ''}{next.fee != null ? `, ${next.fee === 0 ? tr('free', 'бесплатно') : money(next.fee, { cents: next.fee % 1 !== 0 })}` : ''}{next.waitDays ? `, ${next.waitDays} ${tr('days', 'дн.')}` : ''}.
          {' '}{tr(`Still ahead: ${money(ahead.fees)} in fees, the longest wait ${ahead.longestWait} days.`, `Впереди: ${money(ahead.fees)} пошлин, самое долгое ожидание — ${ahead.longestWait} дн.`)}
        </p>
      ) : <p className="small" style={{ margin: 0 }}><strong>{tr('Every step is done. Open your doors.', 'Все шаги сделаны. Открывайте двери.')}</strong></p>}
      <p className="xsmall faint" style={{ margin: 0 }}>{tr('Tick a step when you have done it for real. Saved on this device.', 'Отмечайте шаг, когда сделали его в жизни. Сохраняется на этом устройстве.')}</p>
    </div>
  );
}
