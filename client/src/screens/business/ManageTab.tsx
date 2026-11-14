import { useState } from 'react';
import type { Action, PnlLine, StandingOrders } from '@ohh/shared/types';
import { RULES } from '@ohh/shared/rules';
import { Button, Card, Segmented, Sheet, Stepper, Toggle } from './__stubs__/ui';
import type { BizDeps } from './deps';
import { num, plural, usd, usd2 } from './format';
import { perDayCost, type FieldKey } from './forecast';
import { ImpactLine, OutlookCard, type OutlookPair } from './Outlook';
import { pick } from '../../ui/i18n';
import { allShortcuts, leverViolations, savesRule, trailFor, violationById, whoCatches, type Packs } from './lookup';
import { setAutopilot, setLever, setPrice, setStaff, toggleShortcut, totalStaff, type Draft } from './orders';
import { useWhatIf } from './useWhatIf';

export interface ManageProps {
  deps: BizDeps;
  draft: Draft;
  diff: Partial<StandingOrders>;
  setDraft(d: Draft): void;
  onRule(id: string): void;
  /** The next 30 days now and with the draft (BusinessScreen asks what_if, so Apply can keep the promise). */
  pair: OutlookPair;
}

/** Mean price of the other businesses in my niche, for the slider caption only. */
export function nicheAverage(deps: BizDeps): number | null {
  const b = deps.view.business;
  if (!b) return null;
  const prices = deps.view.neighbors.filter((n) => n.niche === b.niche && n.status === 'open' && n.id !== b.id).map((n) => n.price);
  return prices.length ? prices.reduce((a, p) => a + p, 0) / prices.length : null;
}

/** Saving lines from a what_if with every shortcut on, matched to shortcuts by id or name. */
export function savingFor(lines: PnlLine[] | undefined, shortcutId: string, name: string, violationId: string): number | null {
  if (!lines) return null;
  const hit = lines.filter((l) => l.kind === 'saving' && (l.id.includes(shortcutId) || l.id.includes(violationId) || l.label.toLowerCase().includes(name.toLowerCase())));
  return hit.length ? hit.reduce((a, l) => a + l.amount, 0) : null;
}

export function ManageTab({ deps, draft, diff, setDraft, onRule, pair }: ManageProps) {
  const v = deps.view;
  const b = v.business!;
  const pack = deps.pack;
  const packs: Packs = { pack, common: deps.common };
  const [last, setLast] = useState<FieldKey | null>(null);
  const edit = (field: FieldKey, d: Draft) => { setLast(field); setDraft(d); };
  const impact = (field: FieldKey) => <ImpactLine deps={deps} pair={pair} field={field} last={last} diff={diff} />;
  const shortcuts = allShortcuts(packs);
  const allOn = useWhatIf(deps.query, { shortcuts: shortcuts.map((s) => s.id) }, deps.online && shortcuts.length > 0);
  const avg = nicheAverage(deps);
  const lastAvg = b.history.length ? b.history[b.history.length - 1].avgPrice : null;
  const leverViol = leverViolations(pack);
  const roles = pack?.staff ?? Object.keys(draft.staff).map((id) => ({ id, name: id, hourlyWage: 0, hoursPerMonth: 0 }));

  return (
    <div className="bz-pad">
      <OutlookCard pair={pair} deps={deps} />

      <Card title="Price" aside={pack ? `per ${pack.unit.name}` : undefined}>
        <div className="bz-between">
          <Stepper label="price" value={draft.price} step={0.1} min={pack?.unit.priceMin ?? 0} max={pack?.unit.priceMax ?? 999}
            format={usd2} onChange={(p) => edit('price', setPrice(draft, p, pack))} />
          <span className="bz-small bz-muted">{avg !== null ? `niche average ${usd2(avg)}` : ''}{lastAvg !== null ? `${avg !== null ? ' · ' : ''}last month ${usd2(lastAvg)}` : ''}</span>
        </div>
        {pack && (
          <input className="bz-range" type="range" aria-label="Price slider" min={pack.unit.priceMin} max={pack.unit.priceMax} step={0.05}
            value={draft.price} onChange={(e) => edit('price', setPrice(draft, Number(e.target.value), pack))} />
        )}
        {impact('price')}
      </Card>

      <Card title="Staff" aside={pack ? `${totalStaff(draft.staff)} of max ${pack.capacity.maxStaff}` : undefined}>
        {roles.map((r) => (
          <div key={r.id}>
          <div className="bz-between">
            <div className="bz-li-main">
              <span className="bz-li-title">{r.name}</span>
              {r.hourlyWage > 0 && <span className="bz-li-sub">{usd2(r.hourlyWage)}/hr · {r.hoursPerMonth} h a month</span>}
            </div>
            <Stepper label={r.name} value={draft.staff[r.id] ?? 0} min={0} max={pack?.capacity.maxStaff ?? 99} onChange={(n) => edit(`staff:${r.id}`, setStaff(draft, r.id, n, pack))} />
          </div>
          {impact(`staff:${r.id}`)}
          </div>
        ))}
        {b.mtd.lost.staff > 0 && <p className="bz-small bz-bad-text">This month {num(b.mtd.lost.staff)} customers left because nobody could serve them.</p>}
      </Card>

      {(pack?.levers ?? []).map((l) => (
        <Card key={l.id} title={l.name}>
          <Segmented label={l.name} value={draft.levers[l.id] ?? l.options[0].id}
            options={l.options.map((o) => ({ id: o.id, label: o.label, hint: <>{o.monthlyCost > 0 ? `${usd(o.monthlyCost)}/mo · ${usd2(perDayCost(o.monthlyCost))}${pick(' a day while on', ' в день, пока включено')}` : pick('free', 'бесплатно')}{o.causes ? pick(' · breaks a rule', ' · нарушает правило') : ''}</>, warn: !!o.causes }))}
            onChange={(id) => edit(`lever:${l.id}`, setLever(draft, l.id, id, pack))} />
          <PaidByDay lever={l} chosen={draft.levers[l.id] ?? l.options[0].id} />
          {impact(`lever:${l.id}`)}
          {leverViol.get(`${l.id}:${draft.levers[l.id]}`) && (
            <button type="button" className="bz-linkbtn bz-small bz-bad-text" onClick={() => onRule(leverViol.get(`${l.id}:${draft.levers[l.id]}`)!)}>
              Why this breaks a rule
            </button>
          )}
        </Card>
      ))}

      <SizeCard deps={deps} />

      {shortcuts.length > 0 && (
        <Card tone="warn" title="Cut corners" aside="saves money now">
          <p className="bz-small">Each of these saves money now and breaks a real rule. If someone catches it, the fine grows with every month.</p>
          <div className="bz-list">
            {shortcuts.map((s) => {
              const viol = violationById(packs, s.violation);
              const trail = trailFor(b.trails, s.violation);
              const saved = savingFor(allOn.data?.projected.lines, s.id, s.name, s.violation);
              const on = draft.shortcuts.includes(s.id);
              return (
                <div className="bz-li" key={s.id}>
                  <div className="bz-li-main">
                    <button type="button" className="bz-linkbtn bz-li-title" onClick={() => onRule(s.violation)}>{s.name}</button>
                    <span className="bz-li-sub">saves {saved !== null ? `${usd(saved)}/mo` : savesRule(s)}{viol ? ` · ${whoCatches(packs, viol)}` : ''}</span>
                    {trail && trail.months > 0 && <span className="bz-small bz-bad-text">Breaking it for {plural(trail.months, 'month')} · saved {usd(trail.saved)} so far{trail.discovered ? ' · found' : ''}</span>}
                  </div>
                  <Toggle label={s.name} on={on} onChange={(x) => setDraft(toggleShortcut(draft, s.id, x))} />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <OneOffs deps={deps} />

      <Card title="While you're away">
        <Segmented<StandingOrders['autopilot']> label="Autopilot" value={draft.autopilot} onChange={(m) => setDraft(setAutopilot(draft, m))}
          options={[
            { id: 'hold', label: 'Hold my settings', hint: 'Nothing changes until you come back' },
            { id: 'manager', label: `Hire a manager — ${usd(pack?.manager.monthlySalary ?? 0)}/month`, hint: `Every ${RULES.MANAGER_REVIEW_DAYS} days follows the safe advice. Never cuts corners.` },
          ]} />
      </Card>
    </div>
  );
}

/** The chosen paid option is charged by the day it is on (engine/src/economy/day.ts), not by the setting at month close. */
function PaidByDay({ lever, chosen }: { lever: { options: { id: string; monthlyCost: number }[] }; chosen: string }) {
  const o = lever.options.find((x) => x.id === chosen);
  if (!o || o.monthlyCost <= 0) return null;
  return <p className="bz-small bz-muted">{pick(`Charged only for the days it is on: ${usd2(perDayCost(o.monthlyCost))} a day. Switching it off before the month closes does not erase the days it ran.`, `Списывается только за дни, когда включено: ${usd2(perDayCost(o.monthlyCost))} в день. Выключить перед закрытием месяца — не значит не платить за дни, когда работало.`)}</p>;
}

function SizeCard({ deps }: { deps: BizDeps }) {
  const b = deps.view.business!;
  const pack = deps.pack;
  const sizing = pack?.sizing;
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState(b.size);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const unit = sizing?.unitName ?? 'seat';
  const perUnit = (pack?.setup ?? []).filter((s) => s.scalesWithSize);
  const lostSeats = b.days.reduce((a, d) => a + d.lost.size, 0);
  const util = deps.view.analytics?.sizeUtilization;
  const delta = size - b.size;

  const send = async () => {
    setBusy(true); setMsg(null);
    try {
      const ack = await deps.act({ type: 'resize', size });
      setMsg(ack.ok ? `Done: ${plural(size, unit)} from tomorrow.` : ack.error ?? 'Could not resize.');
      if (ack.ok) setOpen(false);
    } catch {
      setMsg('Connection lost. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Room size" aside={plural(b.size, unit)}>
      <p className="bz-small">
        {lostSeats > 0 ? <><b className="bz-bad-text">{num(lostSeats)}</b> customers walked away in 30 days: not enough {unit}s. </> : null}
        {util !== undefined ? <>Room is full {Math.round(util * 100)}% of the time.</> : null}
      </p>
      <Button onClick={() => { setSize(b.size); setOpen(true); }} disabled={!sizing}>Resize</Button>
      {msg && <p className="bz-small">{msg}</p>}
      {sizing && (
        <Sheet open={open} onClose={() => setOpen(false)} title="Resize the room">
          <div className="bz-between">
            <span>{unit[0].toUpperCase() + unit.slice(1)}s</span>
            <Stepper label={`${unit}s`} value={size} min={sizing.min} max={sizing.max} onChange={setSize} />
          </div>
          {delta > 0 && (
            <div className="bz-list">
              {perUnit.map((s) => (
                <div className="bz-li" key={s.id}><span>{s.name} × {delta}</span><span className="bz-amt">{usd(s.cost * delta)}</span></div>
              ))}
              <p className="bz-small bz-muted">Paid from cash today. The room must fit: {sizing.sqftPerUnit} sq ft per {unit}.</p>
            </div>
          )}
          {delta < 0 && <p className="bz-small">You sell {plural(-delta, unit)} of furniture for {Math.round(RULES.RESALE_SHARE * 100)}% of what it cost.</p>}
          <p className="bz-small">
            Too few {unit}s: a queue and customers who walk away. Too many: an empty room that still costs {usd(sizing.cleaningCostPerSizeMonth)} per {unit} a month to clean.
          </p>
          <Button variant="primary" disabled={busy || delta === 0 || !deps.online} onClick={send}>
            {delta === 0 ? `Keep ${plural(size, unit)}` : `Resize to ${plural(size, unit)}`}
          </Button>
        </Sheet>
      )}
    </Card>
  );
}

const SPEND = [
  { kind: 'marketing' as const, title: 'Ad campaign', text: 'More people hear about you this month.', amounts: [500, 1000, 2500] },
  { kind: 'training' as const, title: 'Staff training', text: 'Better service, better reviews.', amounts: [300, 800] },
  { kind: 'deep_clean' as const, title: 'Professional deep clean', text: 'Clears sanitation problems an inspector could find.', amounts: [] },
  { kind: 'accountant' as const, title: 'Accountant', text: 'Fixes one tax problem: you pay back what you saved, without a fine.', amounts: [] },
];

function OneOffs({ deps }: { deps: BizDeps }) {
  const b = deps.view.business!;
  const pack = deps.pack;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const equipment = (pack?.setup ?? []).filter((s) => (s.kind === 'equipment' || s.kind === 'furniture') && !s.scalesWithSize);
  const owned = (id: string) => b.items.find((i) => i.id === id)?.qty ?? 0;

  const run = async (a: Action, done: string) => {
    setBusy(true); setMsg(null);
    try {
      const ack = await deps.act(a);
      setMsg(ack.ok ? done : ack.error ?? 'Not accepted.');
    } catch {
      setMsg('Connection lost. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="One-off actions" aside="paid today">
      <div className="bz-list">
        {SPEND.map((s) => (
          <div className="bz-li bz-li-col" key={s.kind}>
            <div className="bz-li-main"><span className="bz-li-title">{s.title}</span><span className="bz-li-sub">{s.text}</span></div>
            <div className="bz-row bz-wrap">
              {s.amounts.length
                ? s.amounts.map((amt) => <Button key={amt} disabled={busy || !deps.online} onClick={() => run({ type: 'spend', kind: s.kind, amount: amt }, `${s.title}: ${usd(amt)} spent.`)}>{usd(amt)}</Button>)
                : <Button disabled={busy || !deps.online} onClick={() => run({ type: 'spend', kind: s.kind }, `${s.title} booked.`)}>Book</Button>}
            </div>
          </div>
        ))}
      </div>
      {equipment.length > 0 && (
        <details className="bz-details">
          <summary className="bz-li-title">Equipment</summary>
          <div className="bz-list">
            {equipment.map((e) => (
              <div className="bz-li" key={e.id}>
                <div className="bz-li-main">
                  <span className="bz-li-title">{e.name}</span>
                  <span className="bz-li-sub">{usd(e.cost)} new · you have {owned(e.id)}</span>
                </div>
                <div className="bz-row">
                  <Button disabled={busy || !deps.online} onClick={() => run({ type: 'buy_item', itemId: e.id, qty: 1 }, `Bought: ${e.name}.`)}>Buy</Button>
                  <Button disabled={busy || !deps.online || owned(e.id) === 0} onClick={() => run({ type: 'sell_item', itemId: e.id, qty: 1 }, `Sold: ${e.name}.`)}>Sell</Button>
                </div>
              </div>
            ))}
          </div>
          <p className="bz-small bz-muted">Used equipment sells for {Math.round(RULES.RESALE_SHARE * 100)}% of the new price.</p>
        </details>
      )}
      {msg && <p className="bz-small" role="status">{msg}</p>}
    </Card>
  );
}
