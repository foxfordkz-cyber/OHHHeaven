import { useState } from 'react';
import type { MonthReport, PnlLine } from '@ohh/shared/types';
import { RULES } from '@ohh/shared/rules';
import { Card, Segmented, Stat } from './__stubs__/ui';
import { groupLines, monthAddsUp, sumLines, taxCoverage, taxRows } from './books';
import type { BizDeps } from './deps';
import { dayLabel, relDay, shortDate, signedUsd, usd } from './format';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthName = (m: number) => MONTHS[(m - 1) % 12];

export function LinesTable({ lines }: { lines: PnlLine[] }) {
  const groups = groupLines(lines);
  if (!groups.length) return <p className="bz-muted">No money moved yet.</p>;
  return (
    <div className="bz-list">
      {groups.map((g) => (
        <details className="bz-details bz-li" key={g.kind} style={{ display: 'block' }}>
          <summary className="bz-between">
            <span className="bz-li-title">{g.label}</span>
            <span className={`bz-amt ${g.total < 0 ? 'bz-bad-text' : 'bz-good-text'}`}>{signedUsd(g.total)}</span>
          </summary>
          <div className="bz-list" style={{ paddingLeft: 12 }}>
            {g.lines.map((l) => (
              <div className="bz-li bz-small" key={l.id}>
                <span>{l.label}</span>
                <span className="bz-amt">{signedUsd(l.amount)}</span>
              </div>
            ))}
          </div>
        </details>
      ))}
      <div className="bz-li">
        <b>Cash change</b>
        <b className={`bz-amt ${sumLines(lines) < 0 ? 'bz-bad-text' : 'bz-good-text'}`}>{signedUsd(sumLines(lines))}</b>
      </div>
    </div>
  );
}

function PastMonth({ m }: { m: MonthReport }) {
  const check = monthAddsUp(m);
  return (
    <>
      <div className="bz-stats">
        <Stat label="Sales" value={usd(m.revenue)} />
        <Stat label="Profit" value={signedUsd(m.profit)} tone={m.profit < 0 ? 'bad' : 'good'} />
        <Stat label={`Cash on ${monthName(m.month)} ${RULES.DAYS_PER_MONTH}`} value={usd(m.cashEnd)} tone={m.cashEnd < 0 ? 'bad' : 'neutral'} />
      </div>
      <LinesTable lines={m.lines} />
      <p className={`bz-small ${check.ok ? 'bz-muted' : 'bz-bad-text'}`}>
        {check.ok ? `Every dollar accounted for: cash went from ${usd(m.cashStart)} to ${usd(m.cashEnd)}.` : `Lines add up to ${signedUsd(check.linesTotal)}, cash changed by ${signedUsd(check.cashDelta)}.`}
      </p>
    </>
  );
}

export function BooksTab({ deps, initialMonth }: { deps: BizDeps; initialMonth?: number }) {
  const v = deps.view;
  const b = v.business!;
  const today = v.world.day;
  const past = [...b.history].reverse();
  const [month, setMonth] = useState<string>(String(initialMonth ?? past[0]?.month ?? ''));
  const selected = past.find((m) => String(m.month) === month) ?? past[0] ?? null;
  const rows = taxRows(b, deps.pack, deps.common);
  const cover = taxCoverage(rows, b.cash, today);
  const d = v.world.date;

  return (
    <div className="bz-pad">
      <Card title="This month so far" aside={`${monthName(d.month)} 1–${d.dayOfMonth}`}>
        <LinesTable lines={b.mtd.lines} />
        <p className="bz-small bz-muted">Wages, rent and monthly bills are paid on {monthName(d.month)} {RULES.DAYS_PER_MONTH}.</p>
      </Card>

      <Card tone={cover.covered ? 'neutral' : 'bad'} title="Taxes you owe" aside={rows.length ? `cash now ${usd(b.cash)}` : undefined}>
        {!cover.covered && (
          <p className="bz-bad-text" role="alert" style={{ fontSize: 18 }}>
            <b>You are {usd(cover.short)} short</b> for taxes due in the next 30 days.
          </p>
        )}
        {rows.length === 0 && <p className="bz-muted">Nothing owed right now.</p>}
        <div className="bz-list">
          {rows.map((r) => (
            <div className="bz-li" key={`${r.taxId}-${r.dueDay}`}>
              <div className="bz-li-main">
                <span className="bz-li-title">{r.name}</span>
                <span className="bz-li-sub">due {dayLabel(r.dueDay)} ({relDay(r.dueDay, today)})</span>
              </div>
              <span className="bz-amt">{usd(r.amount)}</span>
            </div>
          ))}
        </div>
        {rows.length > 0 && <p className="bz-small bz-muted">Sales tax you collect sits in your cash, but it belongs to New York State until you pay it.</p>}
      </Card>

      {selected && (
        <Card title="Past months" aside={`closed ${shortDate(selected.month * RULES.DAYS_PER_MONTH)}`}>
          {past.length > 1 && (
            <Segmented label="Month" value={String(selected.month)} onChange={setMonth}
              options={past.map((m) => ({ id: String(m.month), label: monthName(m.month), hint: signedUsd(m.profit) }))} />
          )}
          <PastMonth m={selected} />
        </Card>
      )}
    </div>
  );
}
