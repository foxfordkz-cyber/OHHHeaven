import type { OwnerView, Pack } from '../../../../shared/src/types';
import { Pill } from './__stubs__/ui';
import { dayLabel, nichePlural, realWait, usd, WEATHER_ICON } from './format';

export function statusPill(b: NonNullable<OwnerView['business']>) {
  switch (b.status) {
    case 'open': return <Pill tone="good">Open</Pill>;
    case 'setup': return <Pill tone="info">Setting up</Pill>;
    case 'closed': return <Pill tone="bad">Closed until {b.closedUntilDay ? dayLabel(b.closedUntilDay) : 'further notice'}</Pill>;
    case 'bankrupt': return <Pill tone="bad">Bankrupt</Pill>;
  }
}

export function Header({ view, pack }: { view: OwnerView; pack: Pack | null }) {
  const b = view.business!;
  const w = view.world;
  const todayW = view.weather.find((d) => d.day === w.day) ?? view.weather[0];
  const standings = view.leaderboards[b.niche] ?? [];
  const mine = standings.find((s) => s.businessId === b.id);
  const niche = nichePlural(pack?.name ?? b.niche);
  const dayDone = w.config.dayMs > 0 ? Math.max(0, Math.min(1, 1 - w.msToNextDay / w.config.dayMs)) : 0;

  return (
    <header className="bz-head">
      <div className="bz-between">
        <h1 className="bz-head-name">{b.name}</h1>
        {statusPill(b)}
      </div>
      <div className="bz-head-meta">
        <span>{w.date.label}</span>
        {todayW && <span>{WEATHER_ICON[todayW.condition]} {todayW.tempF}°F · {todayW.label}</span>}
        <span>{w.config.paused ? 'City paused' : `Next day ${realWait(w.msToNextDay)}`}</span>
      </div>
      <div className="bz-daybar" aria-label="Game day progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(dayDone * 100)}>
        <i style={{ width: `${Math.round(dayDone * 100)}%` }} />
      </div>
      <div className="bz-head-money">
        <div>
          <div className="bz-small bz-muted">Cash</div>
          <div className={`bz-cash${b.cash < 0 ? ' bz-bad-text' : ''}`}>{usd(b.cash)}</div>
        </div>
        {mine && <div className="bz-small" aria-label="Rank in niche"><b>#{mine.rank}</b> of {standings.length} {niche}</div>}
      </div>
    </header>
  );
}
