import { useEffect, useState } from 'react';
import type { OwnerView, Pack } from '@ohh/shared/types';
import { Pill } from './__stubs__/ui';
import { dayLabel, nichePlural, realWait, usd, WEATHER_ICON } from './format';
import { ThemeToggle } from '../../ui/ThemeToggle';
import { pick } from '../../ui/i18n';
import { nextRank, rankMove, readRank, writeRank, type RankMemory } from './moments';

/** Remembers the place the owner saw last, so a move up or down is shown as news for a game week. */
function useRankMove(bizId: string, rank: number | undefined, day: number): number {
  const [mem, setMem] = useState<RankMemory | null>(() => readRank(bizId));
  useEffect(() => {
    if (rank === undefined) return;
    const next = nextRank(mem, rank, day);
    if (next !== mem) { writeRank(bizId, next); setMem(next); }
  }, [bizId, rank, day, mem]);
  return rank === undefined ? 0 : rankMove(mem, rank, day);
}

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
  const move = useRankMove(b.id, mine?.rank, w.day);
  const dayDone = w.config.dayMs > 0 ? Math.max(0, Math.min(1, 1 - w.msToNextDay / w.config.dayMs)) : 0;

  return (
    <header className="bz-head">
      <div className="bz-between">
        <h1 className="bz-head-name">{b.name}</h1>
        <span className="bz-row" style={{ gap: 8 }}>{statusPill(b)}<ThemeToggle /></span>
      </div>
      <div className="bz-head-meta">
        <span>{w.date.label}</span>
        {todayW && <span>{WEATHER_ICON[todayW.condition]} {todayW.label}</span>}
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
        {mine && (
          <div className="bz-rank">
            {move !== 0 && (
              <span key={mine.rank} className={`bz-rank__move ${move > 0 ? 'bz-rank__move--up' : 'bz-rank__move--down'}`} role="status">
                {move > 0 ? pick(`▲ up ${move}`, `▲ +${move}`) : pick(`▼ down ${-move}`, `▼ −${-move}`)}
              </span>
            )}
            <div className="bz-small" aria-label="Rank in niche"><b key={mine.rank} className="bz-rank__n">#{mine.rank}</b> of {standings.length} {niche}</div>
          </div>
        )}
      </div>
    </header>
  );
}
