import { useState } from 'react';
import type { NicheId, OwnerView } from '@shared/types';
import { AiBadge, Badge, Card, Icon, NICHE_ICON, SegmentedControl } from '../../ui';
import { compactMoney, money, nicheName } from '../insights/format';
import { allBoards, officialsBoard, type BoardRow, type NicheBoard } from './prizes';
import './end.css';

export type RankingRow = { name: string; points: number; isAi: boolean };

/** Officials ranking is not in OwnerView yet: take it from `extra` (see agents/11.md, requests). */
export function rankingOf(view: OwnerView): RankingRow[] {
  const extra = (view as OwnerView & { extra?: { officialsRanking?: RankingRow[] } }).extra;
  return extra?.officialsRanking ?? [];
}

function Row({ r, testMoney }: { r: BoardRow; testMoney: boolean }) {
  return (
    <li className={`lb-row${r.podium ? ` lb-row--p${r.podium}` : ''}${r.mine ? ' lb-row--mine' : ''}`} data-rank={r.rank}>
      <span className="lb-rank num" aria-label={`Rank ${r.rank}`}>{r.podium ? <span className={`lb-medal lb-medal--${r.podium}`}>{r.rank}</span> : r.rank}</span>
      <span className="lb-name grow">
        <span className="lb-title">{r.name}{r.mine && <span className="lb-you"> · you</span>}</span>
        <span className="lb-sub">
          {r.isAi ? <AiBadge /> : r.owner}
          {r.bankrupt && <Badge tone="loss">Bankrupt</Badge>}
        </span>
      </span>
      <span className="lb-worth num">{compactMoney(r.netWorth)}</span>
      <span className="lb-prize num" title={r.isAi ? 'AI businesses do not win prizes' : undefined}>
        {r.prize !== null ? money(r.prize, { cents: true }) : r.isAi ? 'no prize' : '—'}
        {r.prize !== null && testMoney && <span className="lb-test">test</span>}
      </span>
    </li>
  );
}

/** One niche: podium highlighted, prize per place, AI marked without prize, my row pinned at the bottom if it is far down. */
export function NicheTable({ board, testMoney, limit }: { board: NicheBoard; testMoney: boolean; limit?: number }) {
  const shown = limit ? board.rows.slice(0, limit) : board.rows;
  const pinned = board.mine && !shown.some((r) => r.mine) ? board.mine : null;
  return (
    <div className="lb">
      <div className="lb-head small faint"><span>#</span><span className="grow">Business</span><span>Net worth</span><span>Prize</span></div>
      <ol className="lb-list">
        {shown.map((r) => <Row key={r.businessId} r={r} testMoney={testMoney} />)}
      </ol>
      {pinned && (
        <ol className="lb-list lb-list--pinned" aria-label="Your place">
          <Row r={pinned} testMoney={testMoney} />
        </ol>
      )}
      <p className="xsmall faint lb-note">
        Prize fund of this niche: {money(board.pool, { cents: true })}. Top 3 human businesses split it 50 / 30 / 20. AI businesses run by the city win nothing.
      </p>
    </div>
  );
}

export function OfficialsTable({ view }: { view: OwnerView }) {
  const ranking = rankingOf(view);
  const { pool, rows } = officialsBoard(view.world, ranking);
  if (!rows.length) return <p className="muted small">No city officials have closed a case yet.</p>;
  return (
    <div className="lb">
      <div className="lb-head small faint"><span>#</span><span className="grow">Official</span><span>Points</span><span>Prize</span></div>
      <ol className="lb-list">
        {rows.map((r) => (
          <li key={r.name} className={`lb-row${r.rank <= 3 && r.prize !== null ? ` lb-row--p${r.rank}` : ''}`}>
            <span className="lb-rank num">{r.rank}</span>
            <span className="lb-name grow"><span className="lb-title">{r.name}</span><span className="lb-sub">{r.isAi ? <AiBadge /> : 'Plays for free'}</span></span>
            <span className="lb-worth num">{r.points}</span>
            <span className="lb-prize num">{r.prize !== null ? money(r.prize, { cents: true }) : r.isAi ? 'no prize' : '—'}</span>
          </li>
        ))}
      </ol>
      <p className="xsmall faint lb-note">Officials share {money(pool, { cents: true })} (5% of the bank) by points. An official caught taking bribes loses all points.</p>
    </div>
  );
}

/** Full leaderboards: a tab per niche and one for city officials. */
export function Leaderboards({ view }: { view: OwnerView }) {
  const boards = allBoards(view);
  const mine = view.business?.niche;
  const [tab, setTab] = useState<string>(mine && boards.some((b) => b.niche === mine) ? mine : boards[0]?.niche ?? 'officials');
  const board = boards.find((b) => b.niche === tab);
  const testMoney = view.world.config.demo;
  return (
    <div className="stack">
      <SegmentedControl label="Leaderboard" value={tab} onChange={setTab}
        options={[...boards.map((b) => ({ value: b.niche as string, label: <span className="row"><Icon name={NICHE_ICON[b.niche as NicheId]} size={16} />{nicheName(b.niche)}</span> })), { value: 'officials', label: 'Officials' }]} />
      {board ? <NicheTable board={board} testMoney={testMoney} /> : <OfficialsTable view={view} />}
      {testMoney && <p className="xsmall faint">Demo city: all money is test money.</p>}
    </div>
  );
}

/** Compact card for the Insights tab: my niche, top 3 and my row. */
export function LeaderboardCard({ view, onOpen }: { view: OwnerView; onOpen?: () => void }) {
  const niche = view.business?.niche;
  const board = allBoards(view).find((b) => b.niche === niche);
  if (!board) return null;
  const mine = board.mine;
  return (
    <Card title="Leaderboard" subtitle={mine ? `#${mine.rank} of ${board.rows.length} ${nicheName(board.niche).toLowerCase()}` : nicheName(board.niche)}
      action={onOpen ? <button type="button" className="chip" onClick={onOpen}>All <Icon name="chevronRight" size={14} /></button> : undefined}>
      <NicheTable board={board} testMoney={view.world.config.demo} limit={3} />
    </Card>
  );
}
