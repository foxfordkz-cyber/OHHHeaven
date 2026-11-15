import { useEffect, useState } from 'react';
import type { MonthReport } from '@ohh/shared/types';
import { Icon } from '../../ui';
import { pick } from '../../ui/i18n';
import { Button } from './__stubs__/ui';
import { signedUsd, usd } from './format';
import { markMonthSeen, monthFull, monthStory, seenMonth, unseenReport } from './moments';

/** Counts from zero to the number once `run` turns on; jumps straight to it when motion is off. */
function useCountUp(target: number, run: boolean, ms = 700, delay = 0): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!run) return;
    const still = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (still || typeof window.requestAnimationFrame !== 'function') { setValue(target); return; }
    let frame = 0;
    let start = 0;
    const step = (t: number) => {
      if (!start) start = t + delay;
      const k = Math.min(1, Math.max(0, (t - start) / ms));
      setValue(target * (1 - Math.pow(1 - k, 3)));
      if (k < 1) frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [target, run, ms, delay]);
  return run ? value : 0;
}

const STEP_MS = 140; // each line of the report follows the one before it

/**
 * The month report as an event: a closed envelope on top of Today, opened by the owner.
 * Sales, everything paid, then the result counts up, then the place in the table.
 */
export function MonthReveal({ bizId, history, nicheLabel, total, onBooks, quiet = false }: {
  bizId: string; history: MonthReport[]; nicheLabel: string; total: number; onBooks(month: number): void;
  /** something more urgent holds the dark button of the screen */
  quiet?: boolean;
}) {
  const [seen, setSeen] = useState(() => seenMonth(bizId));
  const [open, setOpen] = useState(false);
  const report = unseenReport(history, seen);
  const profit = useCountUp(report?.profit ?? 0, open && !!report, 700, STEP_MS * 2);
  if (!report) return null;

  const s = monthStory(history, report);
  const [en, ru] = monthFull(s.month);
  const close = () => { markMonthSeen(bizId, s.month); setSeen(s.month); setOpen(false); };

  if (!open) {
    return (
      <section className="bz-card mo-card mo-card--sealed" aria-label={pick('Month report', 'Отчёт месяца')}>
        <span className="mo-seal" aria-hidden="true"><Icon name="doc" size={22} /></span>
        <div className="mo-sealed__text">
          <div className="mo-eyebrow">{pick('Month report', 'Отчёт месяца')}</div>
          <h3 className="mo-title">{pick(`${en} is closed. Your books are in.`, `${ru} закрыт. Книги сведены.`)}</h3>
          <p className="bz-small bz-muted">{pick('What you sold, what you paid, and where it put you in the table.', 'Сколько продал, сколько заплатил и какое место это дало в таблице.')}</p>
        </div>
        <Button variant={quiet ? 'outline' : 'primary'} className="mo-open" onClick={() => setOpen(true)}>{pick('Open the report', 'Открыть отчёт')}</Button>
      </section>
    );
  }

  const good = s.profit >= 0;
  const line = (i: number) => ({ style: { ['--i' as string]: i } });
  return (
    <section className={`bz-card mo-card mo-card--open ${good ? 'mo-card--good' : 'mo-card--bad'}`} aria-label={pick('Month report', 'Отчёт месяца')}>
      <div className="mo-eyebrow">{pick(`Month report · ${en}`, `Отчёт месяца · ${ru}`)}</div>
      <ul className="mo-lines">
        <li {...line(0)}><span>{pick('You sold', 'Продано')}</span><b>{usd(s.revenue)}</b></li>
        <li {...line(1)}><span>{pick('You paid: goods, wages, rent, taxes', 'Заплачено: товар, зарплаты, аренда, налоги')}</span><b>{usd(-s.costs)}</b></li>
      </ul>
      <div className="mo-result" {...line(2)}>
        <span className="mo-result__label">{good ? pick('Profit', 'Прибыль') : pick('Loss', 'Убыток')}</span>
        <span className={`mo-result__value ${good ? 'bz-good-text' : 'bz-bad-text'}`} aria-label={signedUsd(s.profit)}>{signedUsd(Math.round(profit))}</span>
      </div>
      <p className="mo-verdict" {...line(3)}>
        {pick(s.verdict[0], s.verdict[1])}
        {s.monthsOfCash !== null && ` ${pick(`At this pace your cash lasts ${s.monthsOfCash} more ${s.monthsOfCash === 1 ? 'month' : 'months'}.`, `В таком темпе денег хватит ещё на ${s.monthsOfCash} мес.`)}`}
      </p>
      <div className="mo-facts" {...line(4)}>
        <div className="mo-fact">
          <span className="mo-fact__k">{pick('Cash at month end', 'Денег на конец месяца')}</span>
          <b className={s.cashEnd < 0 ? 'bz-bad-text' : ''}>{usd(s.cashEnd)}</b>
          <span className={`bz-small ${s.cashDelta >= 0 ? 'bz-good-text' : 'bz-bad-text'}`}>{signedUsd(s.cashDelta)}</span>
        </div>
        <div className="mo-fact">
          <span className="mo-fact__k">{pick(`Place among ${total} ${nicheLabel}`, `Место среди ${total}`)}</span>
          <b className="mo-place">
            {s.rankBefore !== null && s.rankMove !== 0 && <><s>#{s.rankBefore}</s><Icon name="arrowRight" size={14} /></>}
            <span className="mo-place__now">#{s.rank}</span>
          </b>
          <span className={`bz-small ${s.rankMove > 0 ? 'bz-good-text' : s.rankMove < 0 ? 'bz-bad-text' : 'bz-muted'}`}>
            {s.rankMove > 0 ? pick(`▲ up ${s.rankMove}`, `▲ вверх на ${s.rankMove}`)
              : s.rankMove < 0 ? pick(`▼ down ${-s.rankMove}`, `▼ вниз на ${-s.rankMove}`)
                : s.rankBefore === null ? pick('your first ranking', 'первое место в таблице') : pick('held your place', 'место удержано')}
          </span>
        </div>
      </div>
      <div className="bz-row bz-wrap mo-actions" {...line(5)}>
        <Button variant={quiet ? 'outline' : 'primary'} onClick={close}>{pick('Got it', 'Понятно')}</Button>
        <Button variant="ghost" onClick={() => { const m = s.month; close(); onBooks(m); }}>{pick('See every line in Books', 'Все строки — в «Книгах»')}</Button>
      </div>
    </section>
  );
}
