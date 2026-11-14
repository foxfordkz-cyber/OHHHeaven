import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BusinessState, ClientView, IdeaMatch, NicheId, OwnerView, PublicBusiness, Standing } from '@ohh/shared/types';
import { useCatalog, NICHE_META, NICHE_ORDER, type Catalog } from '../../app/catalog';
import { CityMapSlot } from '../../app/slots';
import { switchMode, useGame, useStoreState, useView } from '../../app/store';
import {
  AiBadge, Badge, Banner, Button, Card, Clock, Feed, Icon, List, ListRow, MoneyText, NICHE_ICON, Skeleton, Stat, formatMoney, formatNumber,
  type IconName,
} from '../../ui';
import './home.css';

const IDEA_EXAMPLES = ['A coffee shop near the subway', 'A barbershop with three chairs', 'A corner store with long hours'];

/** All businesses the viewer may see, as public cards (an owner sees their own business too). */
export function visibleBusinesses(view: ClientView): PublicBusiness[] {
  if (view.kind === 'city') return view.businesses;
  if (view.kind === 'official') return [];
  const own = view.business ? [publicOfOwn(view, view.business)] : [];
  return [...own, ...view.neighbors];
}

function publicOfOwn(view: OwnerView, b: BusinessState): PublicBusiness {
  const rank = view.leaderboards[b.niche]?.find((s) => s.businessId === b.id)?.rank ?? 0;
  return { id: b.id, name: b.name, ownerName: view.me.name, isAi: false, niche: b.niche, placeId: b.placeId, status: b.status, price: b.orders.price, reputation: b.reputation, rankInNiche: rank, trust: b.trust, partners: [] };
}

export function Home() {
  const view = useView();
  const { status, mode } = useStoreState();
  const catalog = useCatalog();
  const navigate = useNavigate();

  if (!view) {
    return (
      <main className="screen home">
        {status === 'offline' ? <OfflineHero mode={mode} /> : <HomeSkeleton />}
        <HowItWorks />
      </main>
    );
  }

  const businesses = visibleBusinesses(view);
  const ownerWithBusiness = view.kind === 'owner' && view.business ? view : null;

  return (
    <main className="screen home">
      <CityStrip view={view} />
      <CityMapSlot mode="live" places={catalog?.places ?? []} businesses={businesses} myBusinessId={ownerWithBusiness?.business?.id} weather={view.weather[0]} events={view.events} height={300} embedded onExpand={() => navigate('/map')} onOpenBusiness={(id) => navigate('/map?b=' + encodeURIComponent(id))} />
      {view.kind === 'city' || (view.kind === 'owner' && !view.business) ? (
        <>
          {view.kind === 'owner' && <ContinueCard />}
          <Pitch />
          <IdeaBox />
          <Ctas />
        </>
      ) : view.kind === 'owner' ? (
        <AwayCard view={view} />
      ) : (
        <DeskCard queue={view.queue.length} mine={view.mine.length} />
      )}
      <PrizeBank view={view} />
      <NicheCards view={view} businesses={businesses} catalog={catalog} />
      <HowItWorks />
      <Card title="City feed" subtitle="Inspections, deals, openings and bankruptcies">
        <Feed items={view.feed} max={8} />
      </Card>
      <Footer worldId={view.world.config.id} mode={mode} />
    </main>
  );
}

// ───────────────────────── 1. city strip ─────────────────────────

function CityStrip({ view }: { view: ClientView }) {
  const { world } = view;
  return (
    <header className="home-strip">
      <div className="row-between">
        <div className="eyebrow">New York City · Season 0</div>
        {world.config.demo && <Badge tone="accent" icon="play">Demo city</Badge>}
      </div>
      <Clock world={world} weather={view.weather[0]} />
      <div className="grid-3 home-counters">
        <Stat small label="Businesses open" value={formatNumber(world.stats.open)} />
        <Stat small label="Owners" value={formatNumber(world.stats.owners)} />
        <Stat small label="City officials" value={formatNumber(world.stats.officials)} />
      </div>
    </header>
  );
}

// ───────────────────────── 3–5. pitch, idea, two buttons ─────────────────────────

function Pitch() {
  return (
    <section className="home-pitch">
      <h1 className="h1">Test your business idea in real New York.</h1>
      <p className="home-pitch__sub">Real rent, real permits, real taxes. None of your savings at risk.</p>
    </section>
  );
}

function IdeaBox() {
  const navigate = useNavigate();
  const { query } = useGame();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const idea = text.trim();
    if (!idea) return;
    setBusy(true);
    const match = await query<IdeaMatch>({ type: 'idea', text: idea });
    setBusy(false);
    navigate('/start', { state: { idea, match } });
  }

  return (
    <form className="idea-box" onSubmit={submit}>
      <label className="field__label" htmlFor="idea">What would you open?</label>
      <div className="idea-box__row">
        <input id="idea" className="input" placeholder="A coffee shop with fresh pastries…" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" enterKeyHint="go" />
        <Button type="submit" aria-label="See my plan" loading={busy} disabled={!text.trim()} className="idea-box__go">
          {!busy && <Icon name="arrowRight" size={20} />}
        </Button>
      </div>
      <div className="row wrap">
        {IDEA_EXAMPLES.map((ex) => (
          <button key={ex} type="button" className="chip" onClick={() => setText(ex)}>
            {ex}
          </button>
        ))}
      </div>
    </form>
  );
}

function Ctas() {
  const navigate = useNavigate();
  return (
    <div className="stack-sm">
      <Button block size="lg" icon="store" onClick={() => navigate('/start')}>Start my business</Button>
      <Button block variant="secondary" icon="badge" onClick={() => navigate('/start?as=official')}>Work for the city — free</Button>
    </div>
  );
}

function ContinueCard() {
  const navigate = useNavigate();
  return (
    <Card tone="accent" title="You joined the city" subtitle="Pick a niche and a place to open your doors.">
      <Button block icon="arrowRight" onClick={() => navigate('/start')}>Continue opening</Button>
    </Card>
  );
}

// ───────────────────────── 10. returning player ─────────────────────────

const INBOX_ICON: Record<string, IconName> = { summary: 'chart', deal: 'handshake', case: 'badge', event: 'bell', money: 'money', system: 'info' };

export function waitingCount(view: OwnerView): number {
  const myId = view.business?.id;
  const notices = view.notices.filter((n) => n.status === 'notice').length;
  const offers = view.deals.filter((d) => d.status === 'proposed' && d.toBusinessId === myId).length;
  return notices + offers;
}

function AwayCard({ view }: { view: OwnerView }) {
  const navigate = useNavigate();
  const b = view.business!;
  const away = view.away;
  const waiting = waitingCount(view);
  const statusBadge = b.status === 'open' ? <Badge tone="profit">Open</Badge> : b.status === 'setup' ? <Badge tone="warn" icon="hourglass">Opening</Badge> : b.status === 'closed' ? <Badge tone="loss">Closed by inspection</Badge> : <Badge tone="loss">Bankrupt</Badge>;
  return (
    <Card tone="accent" title={away ? 'While you were away' : b.name} subtitle={away ? `${formatNumber(away.days)} ${away.days === 1 ? 'day' : 'days'} passed in the city · ${b.name}` : 'Your business keeps running while you are away.'} action={statusBadge}>
      <div className="grid-2">
        {away ? <Stat label="Profit while away" value={<MoneyText value={away.profit} signed />} /> : <Stat label="Place in niche" value={rankLabel(view, b)} />}
        <Stat label="Cash now" value={<MoneyText value={b.cash} />} />
      </div>
      {away && away.items.length > 0 && (
        <List>
          {away.items.slice(0, 3).map((it) => (
            <ListRow key={it.id} icon={INBOX_ICON[it.kind] ?? 'info'} iconTone={it.kind === 'case' ? 'warn' : it.kind === 'deal' ? 'profit' : 'info'} title={it.title} subtitle={it.text} />
          ))}
        </List>
      )}
      {waiting > 0 && (
        <Banner tone="info" icon="bell">
          {waiting} {waiting === 1 ? 'thing waits' : 'things wait'} for your answer
        </Banner>
      )}
      <Button block size="lg" icon="store" onClick={() => navigate('/biz')}>Open my business</Button>
    </Card>
  );
}

function rankLabel(view: OwnerView, b: BusinessState): string {
  const board = view.leaderboards[b.niche] ?? [];
  const me = board.find((s) => s.businessId === b.id);
  return me ? `#${me.rank} of ${board.length}` : '—';
}

function DeskCard({ queue, mine }: { queue: number; mine: number }) {
  const navigate = useNavigate();
  return (
    <Card tone="accent" title="Your desk" subtitle={`${queue} cases in the queue · ${mine} in progress`}>
      <Button block size="lg" icon="badge" onClick={() => navigate('/desk')}>Open my desk</Button>
    </Card>
  );
}

// ───────────────────────── 6. prize bank ─────────────────────────

function PrizeBank({ view }: { view: ClientView }) {
  const { config, bank } = view.world;
  const prizes = bank * config.prizeShare;
  const [first, second, third] = config.nichePrizeTable;
  return (
    <Card title="Prize bank" subtitle="Top 3 in every niche win" action={<span className="home-trophy"><Icon name="trophy" size={22} /></span>}>
      <div className="row-between" style={{ alignItems: 'flex-end' }}>
        <div className="stat">
          <span className="stat__value home-bank">{formatMoney(bank)}</span>
          <span className="stat__hint">{formatMoney(prizes)} goes to prizes · {formatMoney(config.entryFee)} to enter{config.demo ? ' · test money in the demo' : ''}</span>
        </div>
      </div>
      <div className="home-podium" aria-label="Prize split inside each niche">
        {[first, second, third].map((share, i) => (
          <div key={i} className={`home-podium__step home-podium__step--${i + 1}`}>
            <span className="home-podium__place">{i + 1}</span>
            <span className="xsmall muted">{Math.round((share ?? 0) * 100)}%</span>
          </div>
        ))}
      </div>
      <p className="xsmall faint">
        {Math.round(config.prizeShare * 100)}% of the bank is split between niches by the number of paying owners; inside a niche 1st, 2nd and 3rd place take {Math.round((first ?? 0) * 100)}/{Math.round((second ?? 0) * 100)}/{Math.round((third ?? 0) * 100)}. {Math.round(config.officialsShare * 100)}% goes to city officials. AI businesses never win prizes.
      </p>
    </Card>
  );
}

// ───────────────────────── 7. five niches ─────────────────────────

function NicheCards({ view, businesses, catalog }: { view: ClientView; businesses: PublicBusiness[]; catalog: Catalog | null }) {
  const navigate = useNavigate();
  const nameOf = new Map(businesses.map((b) => [b.id, b]));
  const boards = view.kind === 'official' ? {} : view.leaderboards;
  return (
    <section className="stack">
      <div className="row-between">
        <h2 className="h3">Five ways to start</h2>
        <span className="xsmall faint">East Village</span>
      </div>
      <div className="home-niches">
        {NICHE_ORDER.map((niche) => (
          <NicheCard key={niche} niche={niche} catalog={catalog} count={businesses.filter((b) => b.niche === niche && b.status !== 'bankrupt').length} top={(boards[niche] ?? []).filter((s) => !s.bankrupt).slice(0, 3)} nameOf={nameOf} onOpen={() => navigate(`/start?niche=${niche}`)} />
        ))}
      </div>
    </section>
  );
}

function NicheCard({ niche, catalog, count, top, nameOf, onOpen }: { niche: NicheId; catalog: Catalog | null; count: number; top: Standing[]; nameOf: Map<string, PublicBusiness>; onOpen: () => void }) {
  const pack = catalog?.packs.niches[niche];
  const meta = NICHE_META[niche];
  const playable = Boolean(pack);
  const body = (
    <>
      <div className="row-between">
        <span className="home-niche__icon">
          <Icon name={NICHE_ICON[niche]} size={22} />
        </span>
        {playable ? <Badge tone="profit">Open now</Badge> : <Badge>Opening soon</Badge>}
      </div>
      <div>
        <div className="card__title">{pack?.name ?? meta.name}</div>
        <div className="card__subtitle">{pack?.tagline ?? meta.soon}</div>
      </div>
      {playable ? (
        <>
          <div className="grid-2">
            <Stat small label="Starting capital" value={formatMoney(pack!.startCapital, { compact: true })} />
            <Stat small label="In the city" value={`${count} ${count === 1 ? 'business' : 'businesses'}`} />
          </div>
          {top.length > 0 && (
            <ol className="home-top3">
              {top.map((s) => {
                const b = nameOf.get(s.businessId);
                return (
                  <li key={s.businessId}>
                    <span className="home-top3__rank">{s.rank}</span>
                    <span className="truncate grow">{b?.name ?? 'Business'}</span>
                    {s.isAi && <AiBadge />}
                    <span className="num xsmall muted">{formatMoney(s.netWorth, { compact: true })}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      ) : null}
    </>
  );
  return playable ? (
    <button type="button" className="card card--clickable home-niche" onClick={onOpen} aria-label={`Start a ${meta.name.toLowerCase()}`}>
      {body}
    </button>
  ) : (
    <div className="card home-niche home-niche--soon">{body}</div>
  );
}

// ───────────────────────── 8. how it works ─────────────────────────

const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'doc', title: 'Plan', text: 'Documents, money, suppliers — every step with the real agency, fee and wait.' },
  { icon: 'store', title: 'Run', text: '15 minutes a day. The city keeps going while you are away.' },
  { icon: 'wallet', title: 'Take it home', text: 'Your real-world plan: budget, checklist with links, your mistakes in dollars.' },
];

function HowItWorks() {
  return (
    <section className="stack">
      <h2 className="h3">How it works</h2>
      <ol className="home-steps">
        {STEPS.map((s, i) => (
          <li key={s.title} className="home-step">
            <span className="home-step__num">{i + 1}</span>
            <span className="home-step__icon">
              <Icon name={s.icon} size={20} />
            </span>
            <span>
              <span className="home-step__title">{s.title}</span>
              <span className="small muted" style={{ display: 'block' }}>{s.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ───────────────────────── states and footer ─────────────────────────

function HomeSkeleton() {
  return (
    <div className="stack" aria-busy="true" aria-label="Loading the city">
      <Skeleton height={86} />
      <Skeleton height={230} />
      <Pitch />
      <Skeleton height={48} />
      <Skeleton height={54} />
    </div>
  );
}

function OfflineHero({ mode }: { mode: string }) {
  return (
    <>
      <Pitch />
      <Card tone="warn" title="The city server is not reachable" subtitle="You can still play: the same city runs in your browser.">
        {mode === 'remote' && (
          <Button block icon="wifiOff" onClick={() => switchMode('local')}>
            Practice offline
          </Button>
        )}
      </Card>
    </>
  );
}

function Footer({ worldId, mode }: { worldId: string; mode: string }) {
  const navigate = useNavigate();
  return (
    <footer className="home-footer">
      {mode === 'remote' && (
        <Button variant="ghost" size="sm" icon="wifiOff" onClick={() => switchMode('local')}>
          Practice offline
        </Button>
      )}
      <Button variant="ghost" size="sm" icon="map" onClick={() => navigate(`/city/${worldId}`)}>
        Projector screen
      </Button>
      <p className="xsmall faint">A simulation for practice. Numbers are researched estimates — check with the agency before you sign anything.</p>
    </footer>
  );
}
