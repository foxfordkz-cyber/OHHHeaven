import { useEffect, useState, type ReactNode } from 'react';
import type { DayWeather, FeedItem, NicheId, WeatherCondition, WorldPublic } from '@ohh/shared/types';
import { dateOf } from '@ohh/shared/rules';
import { Icon, type IconName } from './icons';
import { Badge } from './components';

// ───────────────────────── AiBadge ─────────────────────────

export function AiBadge({ label = 'AI' }: { label?: string }) {
  return (
    <Badge tone="ai" icon="sparkle" title="Run by AI. AI businesses do not win prizes.">
      {label}
    </Badge>
  );
}

// ───────────────────────── icons for game things ─────────────────────────

export const WEATHER_ICON: Record<WeatherCondition, IconName> = { clear: 'sun', cloudy: 'cloud', rain: 'rain', snow: 'snow', heat: 'heat', storm: 'storm' };
export const NICHE_ICON: Record<NicheId, IconName> = { cafe: 'coffee', barbershop: 'scissors', bodega: 'basket', guesthouse: 'bed', rentals: 'key' };
export const FEED_ICON: Record<FeedItem['kind'], IconName> = { event: 'bell', inspection: 'badge', report: 'flag', bankruptcy: 'alert', deal: 'handshake', opening: 'store', bribe: 'money', system: 'info' };

// ───────────────────────── RuleCard ─────────────────────────

export function sourceLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'source';
  }
}

/** "Real rule": the real law or number behind a game mechanic, always with a link to the source. */
export function RuleCard({ title, text, source, law, penalty, children }: { title: ReactNode; text: ReactNode; source?: string; law?: string; penalty?: ReactNode; children?: ReactNode }) {
  return (
    <aside className="rule-card" aria-label="Real rule">
      <span className="rule-card__tag">
        <Icon name="doc" size={14} strokeWidth={2.2} /> Real rule
      </span>
      <div className="rule-card__title">{title}</div>
      <div className="rule-card__text">{text}</div>
      {(law || penalty) && (
        <div className="rule-card__meta">
          {law && <Badge icon="gavel">{law}</Badge>}
          {penalty && <Badge tone="loss">{penalty}</Badge>}
        </div>
      )}
      {children}
      {source && (
        <a className="rule-card__link" href={source} target="_blank" rel="noreferrer noopener">
          {sourceLabel(source)} <Icon name="external" size={14} />
        </a>
      )}
    </aside>
  );
}

// ───────────────────────── Feed ─────────────────────────

export function Feed({ items, max = 8, emptyText = 'Nothing happened yet.', onItem }: { items: FeedItem[]; max?: number; emptyText?: string; onItem?: (item: FeedItem) => void }) {
  const list = items.slice(0, max);
  if (!list.length) return <div className="empty">{emptyText}</div>;
  return (
    <ul className="feed" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {list.map((it) => (
        <li key={it.id} className="feed__item" onClick={onItem ? () => onItem(it) : undefined} style={onItem ? { cursor: 'pointer' } : undefined}>
          <span className={`feed__icon feed__icon--${it.kind}`}>
            <Icon name={FEED_ICON[it.kind]} size={16} />
          </span>
          <span>
            <span className="feed__text" style={{ display: 'block' }}>{it.text}</span>
            <span className="feed__day">{dateOf(it.day).label}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

// ───────────────────────── Clock: game date, weather, how far into the day ─────────────────────────

/** Fraction of the current game day that has passed, counted from when the view arrived. */
export function dayProgress(world: Pick<WorldPublic, 'msToNextDay' | 'config'>, elapsedMs: number): number {
  const dayMs = world.config.dayMs;
  if (!dayMs || world.config.paused) return Math.max(0, Math.min(1, 1 - world.msToNextDay / (dayMs || 1)));
  return Math.max(0, Math.min(1, (dayMs - world.msToNextDay + elapsedMs) / dayMs));
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function Clock({ world, weather, live = true }: { world: WorldPublic; weather?: DayWeather; live?: boolean }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    setElapsed(0);
    if (world.config.paused) return;
    const t = setInterval(() => setElapsed(Date.now() - start), world.config.dayMs <= 5_000 ? 100 : 1_000);
    return () => clearInterval(t);
  }, [world.version, world.day, world.config.paused, world.config.dayMs]);
  const progress = dayProgress(world, elapsed);
  const left = Math.max(0, world.msToNextDay - elapsed);
  const icon = weather ? WEATHER_ICON[weather.condition] : 'clock';
  return (
    <div className="clock">
      <span className="clock__weather" aria-hidden="true">
        <Icon name={icon} size={22} />
      </span>
      <span className="grow">
        <span className="clock__date" style={{ display: 'block' }}>
          {world.date.label}
          {weather && <span className="muted" style={{ fontWeight: 500 }}> · {weather.label}</span>}
        </span>
        <span className="clock__meta">
          <span className={`live-dot${live && !world.config.paused ? '' : ' live-dot--off'}`} aria-hidden="true" />
          {world.config.paused ? 'City paused' : world.config.demo ? `Demo speed · 1 day = ${formatDuration(world.config.dayMs)}` : `Next day in ${formatDuration(left)}`}
        </span>
        <span className="clock__bar" aria-hidden="true">
          <div style={{ width: `${progress * 100}%` }} />
        </span>
      </span>
    </div>
  );
}
