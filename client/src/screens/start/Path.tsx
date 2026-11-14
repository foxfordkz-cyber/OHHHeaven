// The opening plan as a path the player walks: a step is done, a step waits (and for how many days), a step is ahead.
// Before the lease is signed the same steps are laid out by the day they will close at this address.
import { useState } from 'react';
import type { Pack, Place, RoadmapItem, RoadmapKind } from '@ohh/shared/types';
import { dateOf } from '@ohh/shared/rules';
import { buildoutOf, buildoutRules, daysToOpenOf } from '@ohh/shared/place';
import { Badge, Button, Icon, ProgressBar, cx, formatMoney, useT, type IconName } from '../../ui';

const KIND_ICON: Record<RoadmapKind, IconName> = { idea: 'sparkle', legal: 'doc', permit: 'badge', space: 'building', money: 'money', supplier: 'truck', people: 'users', launch: 'store' };

export interface PathStage { day: number; steps: RoadmapItem[] }

/**
 * When each step closes, counted in days from signing the lease — the way the engine will mark them: the build-out
 * after its construction days, a permit after its wait (some only start when the room is finished), opening the
 * doors on the first legal day, everything else on the day of signing.
 */
export function stagesOf(pack: Pack, place: Place | undefined, steps: RoadmapItem[]): PathStage[] {
  const build = buildoutOf(pack, place)?.days ?? 0;
  const buildId = buildoutRules(pack)?.itemId;
  const required = pack.setup.filter((s) => s.required).map((s) => ({ id: s.id, qty: 1 }));
  const openDay = place ? daysToOpenOf(pack, required, place) : required.reduce((m, r) => Math.max(m, pack.setup.find((s) => s.id === r.id)?.waitDays ?? 0), 0);
  const dayOf = (s: RoadmapItem): number => {
    if (s.kind === 'launch') return openDay;
    const item = s.setupItemId ? pack.setup.find((x) => x.id === s.setupItemId) : undefined;
    if (!item) return 0;
    if (item.id === buildId) return build;
    if (!item.required) return 0;   // optional paperwork (a sidewalk license) is the player's own decision, made at Setup
    return item.waitDays ? (item.afterBuildout ? build : 0) + item.waitDays : 0;
  };
  const byDay = new Map<number, RoadmapItem[]>();
  for (const s of steps) {
    const d = dayOf(s);
    byDay.set(d, [...(byDay.get(d) ?? []), s]);
  }
  return [...byDay].sort((a, b) => a[0] - b[0]).map(([day, list]) => ({ day, steps: list }));
}

function StepRow({ step, today, index }: { step: RoadmapItem; today?: number; index?: number }) {
  const tr = useT();
  const [open, setOpen] = useState(false);
  const left = step.status === 'waiting' && step.readyDay != null && today != null ? Math.max(0, step.readyDay - today) : null;
  const total = step.waitDays && step.waitDays > 0 ? step.waitDays : null;
  return (
    <li className={cx('roadmap__item', `roadmap__item--${step.status}`)}>
      <span className="roadmap__rail">
        <span className="roadmap__dot">{step.status === 'done' ? <Icon name="check" size={14} strokeWidth={2.6} /> : step.status === 'waiting' ? <Icon name="hourglass" size={14} /> : index ?? ''}</span>
      </span>
      <div className="roadmap__body">
        <button type="button" className="path-step" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <Icon name={KIND_ICON[step.kind]} size={16} className="faint" />
          <span className="roadmap__title">{step.title}</span>
          {step.status === 'done' && <Badge tone="profit">{tr('Done', 'Сделано')}</Badge>}
          {left != null && <Badge tone="warn" icon="hourglass">{tr(`${left} ${left === 1 ? 'day' : 'days'} left`, `ещё ${left} дн.`)}</Badge>}
          {step.status === 'todo' && today != null && <Badge>{tr('Ahead', 'Впереди')}</Badge>}
        </button>
        {left != null && total != null && <ProgressBar value={Math.min(1, (total - left) / total)} tone="warn" label={step.title} />}
        {left != null && step.readyDay != null && <span className="xsmall faint">{step.agency ? `${step.agency} · ` : ''}{tr('ready', 'будет готово')} {dateOf(step.readyDay).label}</span>}
        {open && (
          <>
            <p className="small muted">{step.text}</p>
            <div className="row wrap" style={{ gap: 6 }}>
              {step.agency && <Badge icon="building">{step.agency}</Badge>}
              {step.fee !== undefined && <Badge tone={step.fee > 0 ? 'warn' : 'profit'}>{step.fee > 0 ? `${tr('Fee', 'Сбор')} ${formatMoney(step.fee)}` : tr('Free', 'Бесплатно')}</Badge>}
              {step.waitDays ? <Badge icon="hourglass">{tr(`${step.waitDays} days`, `${step.waitDays} дн.`)}</Badge> : null}
            </div>
            {step.link && (
              <a className="rule-card__link" href={step.link} target="_blank" rel="noreferrer noopener">
                {tr('Official page', 'Официальная страница')} <Icon name="external" size={14} />
              </a>
            )}
          </>
        )}
      </div>
    </li>
  );
}

/** The plan of a business that exists: what waits on the city first, then what is still ahead, then what is behind. */
export function WalkedPath({ steps, today }: { steps: RoadmapItem[]; today: number }) {
  const tr = useT();
  const [showDone, setShowDone] = useState(false);
  const waiting = steps.filter((s) => s.status === 'waiting').sort((a, b) => (a.readyDay ?? 0) - (b.readyDay ?? 0));
  const ahead = steps.filter((s) => s.status === 'todo');
  const done = steps.filter((s) => s.status === 'done');
  return (
    <div className="stack">
      {waiting.length > 0 && (
        <section className="stack-sm" aria-label={tr('Waiting on the city', 'Ждёт город')}>
          <span className="field__label">{tr(`Waiting: ${waiting.length}`, `Ждёт: ${waiting.length}`)}</span>
          <ol className="roadmap">{waiting.map((s) => <StepRow key={s.id} step={s} today={today} />)}</ol>
        </section>
      )}
      {ahead.length > 0 && (
        <section className="stack-sm" aria-label={tr('Still ahead', 'Ещё впереди')}>
          <span className="field__label">{tr(`Ahead: ${ahead.length}`, `Впереди: ${ahead.length}`)}</span>
          <ol className="roadmap">{ahead.map((s) => <StepRow key={s.id} step={s} today={today} />)}</ol>
        </section>
      )}
      <section className="stack-sm" aria-label={tr('Done', 'Сделано')}>
        <div className="row-between">
          <span className="field__label">{tr(`Done: ${done.length} of ${steps.length}`, `Сделано: ${done.length} из ${steps.length}`)}</span>
          {done.length > 0 && <Button variant="ghost" size="sm" onClick={() => setShowDone((v) => !v)}>{showDone ? tr('Hide', 'Скрыть') : tr('Show', 'Показать')}</Button>}
        </div>
        <ProgressBar value={steps.length ? done.length / steps.length : 0} tone="profit" label={tr('Opening plan', 'План открытия')} />
        {showDone && <ol className="roadmap">{done.map((s) => <StepRow key={s.id} step={s} today={today} />)}</ol>}
      </section>
    </div>
  );
}

/** The plan before the lease is signed: the same steps by the day they close at this address. */
export function PlannedPath({ stages, startDay }: { stages: PathStage[]; startDay: number }) {
  const tr = useT();
  const [openStage, setOpenStage] = useState<number | null>(stages.length > 1 ? stages[1].day : null);
  let n = 0;
  return (
    <div className="path-stages">
      {stages.map((st) => {
        const open = openStage === st.day;
        const first = n + 1;
        n += st.steps.length;
        const fees = st.steps.reduce((s, x) => s + (x.fee ?? 0), 0);
        const isLast = st.steps.some((s) => s.kind === 'launch');
        return (
          <section key={st.day} className={cx('path-stage', open && 'path-stage--open')}>
            <button type="button" className="path-stage__head" aria-expanded={open} onClick={() => setOpenStage(open ? null : st.day)}>
              <span className="path-stage__day num">{st.day === 0 ? tr('Day 0', 'День 0') : tr(`Day ${st.day}`, `День ${st.day}`)}</span>
              <span className="path-stage__what">
                <span className="path-stage__title">
                  {st.day === 0 ? tr('The day you sign the lease', 'День подписи аренды') : isLast ? tr('Your doors can open', 'Можно открывать двери') : st.steps.map((s) => s.title).join(', ')}
                </span>
                <span className="small muted">
                  {dateOf(startDay + st.day).label} · {tr(`${st.steps.length} ${st.steps.length === 1 ? 'step' : 'steps'}`, `шагов: ${st.steps.length}`)}{fees > 0 ? ` · ${tr('fees', 'сборы')} ${formatMoney(fees)}` : ''}
                </span>
              </span>
              <Icon name="chevronRight" size={16} className={cx('faint', 'path-stage__chev')} />
            </button>
            {open && <ol className="roadmap">{st.steps.map((s, i) => <StepRow key={s.id} step={s} index={first + i} />)}</ol>}
          </section>
        );
      })}
    </div>
  );
}
