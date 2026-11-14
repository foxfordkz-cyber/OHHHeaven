// City screen for the projector (/city/:id): live map on two thirds, the city's pulse on the right.
import { useEffect, useMemo, useState } from 'react';
import type { CityView, GameClient, Place } from '../../../../shared/src/types';
import { dateOf } from '../../../../shared/src/rules';
import placesJson from '../../../../data/places.json';
import { CityMap } from '../../map/CityMap';
import { WEATHER_ICON } from '../../map/geo';
import { FEED_ICON, clockState, dayProgress, feedRows, formatCountdown, leaderBoards, money, msLeft, seasonDays } from './cityModel';
import { QrCode } from './QrCode';
import { sendClock, useCityView, type ClockCommand } from './useCityView';
import './city.css';

export interface CityScreenProps {
  view: CityView;
  places: Place[];
  worldId: string;
  joinUrl: string;
  /** Date.now() when this view arrived: drives the local countdown to the next game day. */
  receivedAt?: number;
  onClock?: (cmd: ClockCommand) => void | Promise<unknown>;
  error?: string | null;
  districtName?: string;
}

export function CityScreen({ view, places, worldId, joinUrl, receivedAt, onClock, error, districtName = 'East Village' }: CityScreenProps) {
  const { world } = view;
  const [now, setNow] = useState(() => Date.now());
  const clock = clockState(world);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), clock.demo ? 100 : 1000);
    return () => window.clearInterval(id);
  }, [clock.demo]);
  const since = receivedAt === undefined ? 0 : Math.max(0, now - receivedAt);
  const progress = dayProgress(world, since);
  const left = msLeft(world, since);
  const boards = useMemo(() => leaderBoards(view), [view]);
  const feed = useMemo(() => feedRows(view.feed, 7), [view.feed]);
  const today = view.weather.find((w) => w.day === world.day) ?? view.weather[0];
  const forecast = view.weather.filter((w) => w.day > world.day).slice(0, 6);
  const date = world.date ?? dateOf(world.day);

  return (
    <div className="cs-root">
      <div className="cs-map">
        <CityMap mode="live" places={places} businesses={view.businesses} weather={view.weather} events={view.events} day={world.day} orbit />
      </div>
      <aside className="cs-side" aria-label="City status">
        <header className="cs-head">
          <div className="cs-brand">First Year · New York</div>
          <h1 className="cs-title">{districtName}</h1>
          <div className="cs-date">
            <strong>{date.label}</strong>
            <span>Season day {world.day} of {seasonDays(world)}</span>
            {world.phase === 'ended' && <span className="cs-badge">Season over</span>}
          </div>
        </header>

        {today && (
          <section className="cs-weather" aria-label="Weather">
            <div className="cs-weather__now">
              <span className="cs-weather__icon" aria-hidden="true">{WEATHER_ICON[today.condition]}</span>
              <div>
                <strong>{Math.round(today.tempF)}°F</strong> <span>{today.label}</span>
                <div className={today.footTrafficMult < 1 ? 'cs-down' : 'cs-up'}>
                  Foot traffic {today.footTrafficMult >= 1 ? '+' : '−'}{Math.round(Math.abs(today.footTrafficMult - 1) * 100)}%
                </div>
              </div>
            </div>
            <ol className="cs-forecast">
              {forecast.map((w) => (
                <li key={w.day} title={w.label}>
                  <span>{dateOf(w.day).label.slice(0, 3)}</span>
                  <b aria-hidden="true">{WEATHER_ICON[w.condition]}</b>
                  <span>{Math.round(w.tempF)}°</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="cs-clock" aria-label="Game clock">
          <div className="cs-clock__row">
            <span>{world.config.paused ? 'Paused' : `Next day in ${formatCountdown(left)}`}</span>
            {clock.demo && <span className="cs-badge">Demo ×{clock.speed}</span>}
          </div>
          <div className="cs-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
            <span style={{ width: `${progress * 100}%` }} />
          </div>
          {clock.demo && onClock && (
            <div className="cs-clock__ctl">
              <button type="button" onClick={() => onClock({ paused: !world.config.paused })}>{world.config.paused ? '▶ Resume' : '❚❚ Pause'}</button>
              <button type="button" aria-pressed={clock.speed === 1} onClick={() => onClock({ paused: false, speed: 1 })}>×1</button>
              <button type="button" aria-pressed={clock.speed === 5} onClick={() => onClock({ paused: false, speed: 5 })}>×5</button>
            </div>
          )}
        </section>

        <dl className="cs-kpis" aria-label="City numbers">
          <div><dt>Bank</dt><dd>{money(world.bank)}</dd></div>
          <div><dt>Prizes</dt><dd>{money(world.bank * world.config.prizeShare)}</dd></div>
          <div><dt>Open</dt><dd>{world.stats.open}</dd></div>
          <div><dt>Owners</dt><dd>{world.stats.owners}</dd></div>
          <div><dt>AI</dt><dd>{world.stats.aiBusinesses}</dd></div>
          <div><dt>Bankrupt</dt><dd>{world.stats.bankrupt}</dd></div>
        </dl>

        <section className="cs-leaders" aria-label="Leaders">
          {boards.length === 0 && <p className="cs-empty">No standings yet.</p>}
          {boards.map((b) => (
            <div key={b.niche} className={`cs-board cs-board--${b.niche}`}>
              <h2>{b.label}</h2>
              <ol>
                {b.rows.map((r) => (
                  <li key={r.businessId} className={r.bankrupt ? 'is-out' : ''}>
                    <span className="cs-rank">{r.rank}</span>
                    <span className="cs-name">{r.name}{r.isAi && <i>AI</i>}</span>
                    <span className="cs-net">{money(r.netWorth)}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </section>

        <section className="cs-feed" aria-label="City feed" aria-live="polite">
          <h2>City feed</h2>
          <ul>
            {feed.map((f) => (
              <li key={f.id} className={`cs-feed--${f.kind}`}>
                <span aria-hidden="true">{FEED_ICON[f.kind]}</span>
                <span><small>{dateOf(f.day).label}</small> {f.text}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="cs-join">
          <QrCode value={joinUrl} label="Scan to open your business in this city" />
          <div>
            <strong>Open your business here</strong>
            <span>Scan, pick a real storefront, live your first year.</span>
            <code>{joinUrl.replace(/^https?:\/\//, '')}</code>
          </div>
        </section>
        {error && <div className="cs-error" role="status">Connection lost — showing the last picture ({error}).</div>}
        <div className="cs-world-id" aria-hidden="true">{worldId}</div>
      </aside>
    </div>
  );
}

/** Route container for /city/:id: polls the city picture and wires the demo clock. */
export function CityScreenRoute({ worldId, baseUrl = '', client, places = placesJson as Place[], fallback }: {
  worldId: string; baseUrl?: string; client?: GameClient; places?: Place[]; fallback?: CityView;
}) {
  const { view, receivedAt, error, refresh } = useCityView(worldId, { baseUrl, client, fallback });
  if (!view) return <div className="cs-loading">Loading the city…{error ? ` (${error})` : ''}</div>;
  const origin = typeof location !== 'undefined' ? location.origin : '';
  return (
    <CityScreen
      view={view} places={places} worldId={worldId} joinUrl={`${origin}/start?world=${encodeURIComponent(worldId)}`}
      receivedAt={receivedAt} error={error}
      onClock={async (cmd) => { await sendClock(worldId, cmd, baseUrl); await refresh(); }}
    />
  );
}

export default CityScreenRoute;
