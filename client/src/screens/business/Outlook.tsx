// The forecast next to every decision on Manage: what the next 30 days look like now, and with the draft.
// Numbers come from what_if (engine/src/analytics/whatif.ts): the screen only divides by days and compares.
import { dateOf, RULES } from '@ohh/shared/rules';
import type { StandingOrders } from '@ohh/shared/types';
import { Card, Stat } from './__stubs__/ui';
import type { BizDeps } from './deps';
import { dayLabel, num, shortDate, signedUsd, usd, usd2 } from './format';
import { deltaOf, fieldChanged, isolate, outlookOf, signedCount, type FieldKey, type Outlook } from './forecast';
import { useWhatIf, type WhatIfState } from './useWhatIf';
import { pick } from '../../ui/i18n';

export interface OutlookPair {
  /** Next 30 days if nothing changes. */
  base: WhatIfState;
  /** Next 30 days with every change in the draft (same as base when nothing changed). */
  next: WhatIfState;
  changed: boolean;
}

/** Two what_if queries: the shop as it runs and the shop with the draft. Both are asked again each game day. */
export function useOutlook(deps: BizDeps, diff: Partial<StandingOrders>, enabled: boolean): OutlookPair {
  const changed = Object.keys(diff).length > 0;
  const day = deps.view.world.day;
  const base = useWhatIf(deps.query, {}, enabled && deps.online, undefined, day);
  const draft = useWhatIf(deps.query, diff, enabled && deps.online && changed, undefined, day);
  return { base, next: changed ? draft : base, changed };
}

export const unitOf = (deps: BizDeps) => deps.pack?.sizing.unitName ?? 'seat';

export function outlookFrom(s: WhatIfState, unitName: string): Outlook | null {
  return s.data ? outlookOf(s.data.projected, unitName) : null;
}

const tone = (n: number) => (n > 0 ? 'bz-good-text' : n < 0 ? 'bz-bad-text' : 'bz-muted');

/** Top of Manage: the next 30 days now → with your changes, and what limits sales. */
export function OutlookCard({ pair, deps }: { pair: OutlookPair; deps: BizDeps }) {
  const unit = unitOf(deps);
  const now = outlookFrom(pair.base, unit);
  const next = outlookFrom(pair.next, unit);
  const loading = pair.base.status === 'loading' || pair.next.status === 'loading';
  const failed = pair.next.status === 'error' ? pair.next.error : pair.base.status === 'error' ? pair.base.error : null;
  const today = deps.view.world.day;
  const end = today + RULES.DAYS_PER_MONTH;
  const monthEnd = dateOf(today).month * RULES.DAYS_PER_MONTH;
  const order = deps.pack?.unit.name ?? 'order';
  const d = now && next ? deltaOf(now, next) : null;
  const taxDue = pair.next.data?.analytics.taxDueNext;

  return (
    <Card title={pair.changed ? pick('Next 30 days: now → with your changes', 'Следующие 30 дней: сейчас → с твоими изменениями') : pick('Next 30 days if nothing changes', 'Следующие 30 дней, если ничего не менять')}
      aside={loading ? pick('counting…', 'считаю…') : `${shortDate(today + 1)} – ${shortDate(end)}`}>
      {next ? (
        <div className={`bz-forecast${loading ? ' bz-loading' : ''}`} aria-live="polite">
          <div className="bz-stats">
            <Row label={pick(`${cap(order)}s a day`, 'Заказов в день')} now={now ? num(now.ordersPerDay) : '—'} next={num(next.ordersPerDay)} delta={d && pair.changed ? signedCount(d.ordersPerDay) : null} deltaTone={d ? tone(d.ordersPerDay) : ''} />
            <Row label={pick('Profit, 30 days', 'Прибыль за 30 дней')} now={now ? signedUsd(now.profit) : '—'} next={signedUsd(next.profit)} delta={d && pair.changed ? signedUsd(d.profit) : null} deltaTone={d ? tone(d.profit) : ''} />
          </div>
          <p className="bz-forecast-line">
            {pick('Limit', 'Узкое место')}: <b>{next.bottleneck.text}</b>
            {d?.bottleneckChanged && now && pair.changed && <span className="bz-small bz-muted"> ({pick('now', 'сейчас')}: {now.bottleneck.text})</span>}
          </p>
          <p className="bz-small bz-muted">
            {pick('cash on', 'касса на')} {shortDate(monthEnd)}: <span className={next.cashEnd < 0 ? 'bz-bad-text' : ''}>{usd(pair.next.data!.projected.cashEnd)}</span>
            {taxDue && <>{' · '}{pick('tax due', 'налог')} {shortDate(taxDue.day)}: {usd(taxDue.amount)}</>}
            {' · '}{pick('break-even price', 'цена безубыточности')} {pair.next.data!.analytics.breakEvenPrice ? usd2(pair.next.data!.analytics.breakEvenPrice) : '—'}
          </p>
        </div>
      ) : failed ? (
        <p className="bz-bad-text" role="alert">{pick('No forecast right now', 'Прогноза сейчас нет')}: {failed}</p>
      ) : (
        <p className="bz-muted">{pick('Counting the next 30 days…', 'Считаю следующие 30 дней…')}</p>
      )}
      {pair.changed && (
        <p className="bz-small">{pick(`Nothing changes until you press Apply. Then the shop runs on it from ${dayLabel(today + 1)}.`, `Ничего не меняется, пока не нажмёшь «Apply». Потом заведение работает так с ${dayLabel(today + 1)}.`)}</p>
      )}
    </Card>
  );
}

function Row({ label, now, next, delta, deltaTone }: { label: string; now: string; next: string; delta: string | null; deltaTone: string }) {
  return (
    <Stat label={label}
      value={delta !== null ? <><span className="bz-muted">{now} → </span>{next}</> : next}
      sub={delta !== null ? <span className={deltaTone}>{delta}</span> : undefined} />
  );
}

/**
 * One line under the control the player just touched: what this one change does on its own.
 * When it is the only change, the draft forecast already answers and no extra query is sent.
 */
export function ImpactLine({ deps, pair, field, last, diff }: { deps: BizDeps; pair: OutlookPair; field: FieldKey; last: FieldKey | null; diff: Partial<StandingOrders> }) {
  const b = deps.view.business!;
  const draftOrders = { ...b.orders, ...diff, staff: diff.staff ?? b.orders.staff, levers: diff.levers ?? b.orders.levers } as StandingOrders;
  const changed = fieldChanged(b.orders, draftOrders, field);
  const mine = changed && last === field;
  const iso = isolate(b.orders, draftOrders, field);
  const alone = JSON.stringify(iso) === JSON.stringify(diff);
  const own = useWhatIf(deps.query, iso, mine && !alone && deps.online, undefined, deps.view.world.day);
  if (!changed) return null;
  if (!mine) return <p className="bz-small bz-muted">{pick('Changed — the forecast on top counts it.', 'Изменено — прогноз сверху это учитывает.')}</p>;
  const state = alone ? pair.next : own;
  const unit = unitOf(deps);
  const now = outlookFrom(pair.base, unit);
  const next = outlookFrom(state, unit);
  if (state.status === 'error') return <p className="bz-small bz-bad-text" role="alert">{pick('No forecast for this change', 'Нет прогноза для этого изменения')}: {state.error}</p>;
  if (!now || !next || state.status === 'loading') return <p className="bz-small bz-muted" aria-live="polite">{pick('Counting what this does…', 'Считаю, что это даст…')}</p>;
  const d = deltaOf(now, next);
  return (
    <p className="bz-small bz-impact" aria-live="polite">
      {pick('This change', 'Это изменение')}: <b>{num(next.ordersPerDay)}</b> {pick('a day', 'в день')} (<span className={tone(d.ordersPerDay)}>{signedCount(d.ordersPerDay)}</span>)
      {' · '}{pick('profit', 'прибыль')} <span className={tone(d.profit)}>{signedUsd(d.profit)}</span>{pick('/30 days', ' за 30 дней')}
      {' · '}{pick('limit', 'предел')}: {LIMIT_WORD[next.bottleneck.id]()}
    </p>
  );
}

const LIMIT_WORD: Record<Outlook['bottleneck']['id'], () => string> = {
  staff: () => pick('staff', 'персонал'),
  seats: () => pick('seats', 'места'),
  closure: () => pick('closure', 'закрытие'),
  demand: () => pick('customers', 'покупатели'),
};

function cap(s: string) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
