import { useState } from 'react';
import type { MonthReport } from '@ohh/shared/types';
import { Button, Card, Stat } from './__stubs__/ui';
import { launchAction } from './actions';
import { groupLines } from './books';
import type { BizDeps } from './deps';
import { dayLabel, plural, relDay, usd } from './format';
import { fineRule, violationById } from './lookup';

/** Before the doors open: what is still pending, and the honest cost of opening early. */
export function SetupPanel({ deps, onRule }: { deps: BizDeps; onRule(id: string): void }) {
  const v = deps.view;
  const b = v.business!;
  const today = v.world.day;
  const packs = { pack: deps.pack, common: deps.common };
  const waiting = b.permits.filter((p) => p.readyDay > today);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const done = v.roadmap.filter((r) => r.status === 'done').length;

  const launch = async () => {
    setBusy(true); setError(null);
    try {
      const ack = await deps.act(launchAction);
      if (!ack.ok) setError(ack.error ?? 'Could not open.');
    } catch {
      setError('Connection lost. Try again.');
    } finally {
      setBusy(false); setConfirm(false);
    }
  };

  return (
    <Card title="Not open yet" aside={v.roadmap.length ? `${done} of ${v.roadmap.length} steps done` : undefined}>
      <p>Rent and other bills already run. You sell nothing until you open the doors.</p>
      {v.roadmap.length > 0 && (
        <div className="bz-list">
          {v.roadmap.map((r) => (
            <div className="bz-li" key={r.id}>
              <div className="bz-li-main">
                <span className="bz-li-title">{r.status === 'done' ? '✓ ' : r.status === 'waiting' ? '⏳ ' : '○ '}{r.title}</span>
                <span className="bz-li-sub">{r.agency ? `${r.agency} · ` : ''}{r.status === 'waiting' && r.readyDay ? `ready ${dayLabel(r.readyDay)} (${relDay(r.readyDay, today)})` : r.text}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {waiting.map((p) => {
        const item = deps.pack?.setup.find((s) => s.id === p.itemId);
        const viol = item?.withoutItViolation ? violationById(packs, item.withoutItViolation) : null;
        return (
          <p key={p.itemId} className="bz-small">
            <b>{item?.name ?? p.itemId}</b> is ready {dayLabel(p.readyDay)}.
            {viol && <> Opening earlier is a violation: <button type="button" className="bz-linkbtn" onClick={() => onRule(viol.id)}>{viol.name}</button> — {fineRule(viol)}{viol.closureDays ? `, up to ${plural(viol.closureDays, 'day')} closed` : ''}.</>}
          </p>
        );
      })}
      {!confirm && <Button variant={waiting.length ? 'outline' : 'primary'} disabled={busy || !deps.online} onClick={() => (waiting.length ? setConfirm(true) : launch())}>Open the doors</Button>}
      {confirm && (
        <div className="bz-card bz-tone-bad">
          <p><b>Open without {plural(waiting.length, 'permit')}?</b> An inspector or a neighbor's complaint can catch it.</p>
          <div className="bz-btn-row">
            <Button onClick={() => setConfirm(false)}>Wait for the permit</Button>
            <Button variant="danger" disabled={busy} onClick={launch}>Open anyway</Button>
          </div>
        </div>
      )}
      {error && <p className="bz-bad-text" role="alert">{error}</p>}
    </Card>
  );
}

/** The biggest money leaks of a month, as the engine booked them. */
function topCosts(m: MonthReport, n = 3) {
  return groupLines(m.lines).filter((g) => g.total < 0).sort((a, b) => a.total - b.total).slice(0, n);
}

export function BankruptScreen({ deps, onBooks }: { deps: BizDeps; onBooks(): void }) {
  const b = deps.view.business!;
  const last = b.history[b.history.length - 1] ?? null;
  const day = b.bankruptDay ?? deps.view.world.day;
  return (
    <div className="bz-pad" style={{ paddingTop: 16 }}>
      <Card tone="bad" title={`${b.name} went bankrupt`} aside={dayLabel(day)}>
        <p>Cash fell to <b>{usd(b.cash)}</b>. A business that cannot pay its bills closes.</p>
        {last && (
          <>
            <div className="bz-stats">
              <Stat label="Cash at the start of the month" value={usd(last.cashStart)} />
              <Stat label="Sales that month" value={usd(last.revenue)} />
              <Stat label="Cash at the end" value={usd(last.cashEnd)} tone="bad" />
            </div>
            <p className="bz-small bz-muted">Where the money went in the last month:</p>
            <div className="bz-list">
              {topCosts(last).map((g) => (
                <div className="bz-li" key={g.kind}>
                  <span>{g.label}</span>
                  <span className="bz-amt bz-bad-text">{usd(g.total)}</span>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="bz-btn-row">
          <Button variant="primary" onClick={() => (deps.navigate ? deps.navigate('/end') : onBooks())}>See what went wrong</Button>
          <Button onClick={() => deps.navigate?.('/')}>Watch the city</Button>
        </div>
      </Card>
    </div>
  );
}

export function NoBusiness({ onOpen }: { onOpen(): void }) {
  return (
    <div className="bz-pad" style={{ paddingTop: 16 }}>
      <Card title="You don't run a business yet">
        <p>Pick a place on the map and open your first business. The city keeps running while you decide.</p>
        <Button variant="primary" onClick={onOpen}>Open a business</Button>
      </Card>
    </div>
  );
}
