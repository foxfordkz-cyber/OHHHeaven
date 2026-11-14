import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BusinessState, ClientView, IdeaMatch, NicheId, OwnerView, PublicBusiness, Standing } from '@ohh/shared/types';
import { useCatalog, NICHE_META, NICHE_ORDER, type Catalog } from '../../app/catalog';
import { CityMapSlot } from '../../app/slots';
import { NICHE_META as MAP_NICHE } from '../../map/geo';
import { switchMode, useGame, useStoreState, useView } from '../../app/store';
import {
  AiBadge, Badge, Banner, Button, Card, Clock, Feed, Icon, List, ListRow, MoneyText, NICHE_ICON, Skeleton, Stat, formatMoney, formatNumber,
  type IconName, ThemeToggle, Logo, LangToggle, useT , Sheet } from '../../ui';
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
  // hooks stay above the early return below
  const [guide, setGuide] = useState(firstVisit);
  const closeGuide = () => { setGuide(false); try { window.localStorage.setItem(GUIDE_KEY, '1'); } catch { /* private mode */ } };

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

  const lead = view.kind === 'city' || (view.kind === 'owner' && !view.business) ? (
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
  );

  return (
    <main className="screen home">
      <HomeNav demo={view.world.config.demo} onHelp={() => setGuide(true)} />
      <Guide open={guide} onClose={closeGuide} />
      <section className="home-hero">
        <div className="home-hero__strip"><CityStrip view={view} /></div>
        <div className="home-hero__map">
          <CityMapSlot mode="live" places={catalog?.places ?? []} businesses={businesses} myBusinessId={ownerWithBusiness?.business?.id} weather={view.weather[0]} events={view.events} height={300} embedded onExpand={() => navigate('/map')} onOpenBusiness={(id) => navigate('/map?b=' + encodeURIComponent(id))} />
        </div>
        <div className="home-hero__lead">{lead}</div>
        {view.kind !== 'official' && <CityBoard view={view} businesses={businesses} onOpen={(id) => navigate('/map?b=' + encodeURIComponent(id))} onAll={() => navigate('/leaderboards')} />}
      </section>
      <NicheCards view={view} businesses={businesses} catalog={catalog} />
      <section className="home-band">
        <PrizeBank view={view} />
        <HowItWorks />
      </section>
      <section className="home-feed">
        <Card title="City feed" subtitle="Inspections, deals, openings and bankruptcies">
          <Feed items={view.feed} max={8} />
        </Card>
      </section>
      <Footer worldId={view.world.config.id} mode={mode} />
    </main>
  );
}

// ───────────────────────── city board: who leads right now, what just happened ─────────────────────────

function CityBoard({ view, businesses, onOpen, onAll }: { view: Exclude<ClientView, { kind: 'official' }>; businesses: PublicBusiness[]; onOpen: (id: string) => void; onAll: () => void }) {
  const tr = useT();
  const nameOf = new Map(businesses.map((b) => [b.id, b] as const));
  const leaders: Standing[] = Object.values(view.leaderboards)
    .flatMap((list) => (list ?? []).filter((x) => !x.bankrupt).slice(0, 3))
    .sort((a, b) => b.netWorth - a.netWorth)
    .slice(0, 5);
  const news = view.feed.slice(0, 3);
  if (leaders.length === 0 && news.length === 0) return null;
  return (
    <aside className="home-hero__side" aria-label="The city right now">
      {leaders.length > 0 && (
        <div className="city-board">
          <div className="row-between">
            <h2 className="city-board__title">{tr('Leading the city', 'Лидеры города')}</h2>
            <button type="button" className="city-board__all" onClick={onAll}>{tr('All', 'Все')}</button>
          </div>
          <ol className="city-board__list">
            {leaders.map((x) => (
              <li key={x.businessId}>
                <button type="button" className="city-board__row" onClick={() => onOpen(x.businessId)}>
                  <span className="city-board__rank" style={{ background: MAP_NICHE[x.niche]?.color }}>{x.rank}</span>
                  <span className="city-board__name">
                    <b className="truncate">{x.name ?? nameOf.get(x.businessId)?.name ?? 'Business'}</b>
                    <small>{`${NICHE_META[x.niche]?.name ?? x.niche} · ${x.isAi ? tr('AI', 'ИИ') : tr('player', 'игрок')}`}</small>
                  </span>
                  <span className="city-board__worth num">{formatMoney(x.netWorth, { compact: true })}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
      {news.length > 0 && (
        <div className="city-board city-board--news">
          <h2 className="city-board__title">{tr('Just happened', 'Только что')}</h2>
          <ul className="city-board__news">
            {news.map((n) => (
              <li key={n.id}><span className="num">Day {n.day}</span>{n.text}</li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}

// ───────────────────────── first visit: the whole game in four plain sentences ─────────────────────────

const GUIDE_KEY = 'fy-guide-1';
/** True on the very first visit (never in tests: the guide would cover the page under test). */
function firstVisit(): boolean {
  if (import.meta.env.MODE === 'test') return false;
  try { return window.localStorage.getItem(GUIDE_KEY) !== '1'; } catch { return false; }
}

const GUIDE_STEPS: { title: string; text: string; titleRu: string; textRu: string }[] = [
  { title: 'You open a small business', text: 'A coffee shop or a barbershop on a real street in New York. You start with test money, not your own.', titleRu: 'Ты открываешь маленький бизнес', textRu: 'Кофейню или барбершоп на настоящей улице Нью-Йорка. Деньги на старт тестовые, не твои.' },
  { title: 'Everything costs what it really costs', text: 'Rent, equipment, wages, permits and taxes are real New York numbers. You see every step and every bill before you pay it.', titleRu: 'Всё стоит столько, сколько в жизни', textRu: 'Аренда, оборудование, зарплаты, разрешения и налоги — настоящие цифры Нью-Йорка. Каждый шаг и каждый счёт видно до оплаты.' },
  { title: 'The city lives without you', text: 'One game day takes 48 real minutes. You set the rules for your shop once, and it works while you sleep. Come back when you like.', titleRu: 'Город живёт и без тебя', textRu: 'Один игровой день идёт 48 настоящих минут. Один раз задаёшь правила, и заведение работает, пока ты спишь. Заходи, когда удобно.' },
  { title: 'Other people play around you', text: 'Neighbors can make deals with you or report you to the city. Inspectors are players too. The best three shops in each trade win the prize.', titleRu: 'Вокруг играют другие люди', textRu: 'Соседи могут договориться с тобой или пожаловаться на тебя городу. Инспекторы — тоже игроки. Три лучших заведения в каждой нише получают приз.' },
];

function Guide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const tr = useT();
  return (
    <Sheet open={open} onClose={onClose} title={tr('How First Year works', 'Как устроен First Year')} footer={<Button block onClick={onClose}>{tr('Got it — show me the city', 'Понятно — покажи город')}</Button>}>
      <ol className="home-guide">
        {GUIDE_STEPS.map((g, i) => (
          <li key={g.title}>
            <b className="home-guide__n">{i + 1}</b>
            <div><strong>{tr(g.title, g.titleRu)}</strong><p>{tr(g.text, g.textRu)}</p></div>
          </li>
        ))}
      </ol>
      <p className="xsmall muted">{tr('Nothing here can cost you real money. You can read this again: “How it works” at the top.', 'Настоящих денег здесь потерять нельзя. Перечитать можно по ссылке «Как это работает» вверху.')}</p>
    </Sheet>
  );
}

// ───────────────────────── 0. top bar ─────────────────────────

function HomeNav({ demo, onHelp }: { demo: boolean; onHelp: () => void }) {
  const tr = useT();
  const navigate = useNavigate();
  return (
    <nav className="home-nav" aria-label="Main">
      <button type="button" className="home-nav__brand" onClick={() => navigate('/')}>
        <Logo size={32} />
        {demo && <Badge tone="accent" icon="play">{tr('Demo city', 'Демо-город')}</Badge>}
      </button>
      <div className="home-nav__links">
        <button type="button" className="home-nav__link" onClick={() => navigate('/map')}>{tr('City map', 'Карта города')}</button>
        <button type="button" className="home-nav__link" onClick={() => navigate('/leaderboards')}>{tr('Leaderboards', 'Лидеры')}</button>
        <button type="button" className="home-nav__link" onClick={onHelp}>{tr('How it works', 'Как это работает')}</button>
      </div>
      <LangToggle />
      <ThemeToggle />
      <Button size="sm" icon="store" onClick={() => navigate('/start')}>{tr('Start', 'Начать')}</Button>
    </nav>
  );
}

// ───────────────────────── 1. city strip ─────────────────────────

function CityStrip({ view }: { view: ClientView }) {
  const tr = useT();
  const { world } = view;
  return (
    <header className="home-strip">
      <div className="row-between">
        <div className="eyebrow">New York City · Season 0</div>
        {world.config.demo && <Badge tone="accent" icon="play">{tr('Demo city', 'Демо-город')}</Badge>}
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
  const tr = useT();
  return (
    <section className="home-pitch">
      <h1 className="h1">{tr('Test your business idea in real New York.', 'Проверь свою бизнес-идею в настоящем Нью-Йорке.')}</h1>
      <p className="home-pitch__sub">{tr('Real rent, real permits, real taxes. None of your savings at risk.', 'Настоящая аренда, разрешения и налоги. Твои сбережения не рискуют.')}</p>
      <ol className="home-first" aria-label={tr('What you do here', 'Что здесь делать')}>
        <li><b>1</b><span>{tr('Type any small business idea below.', 'Впиши ниже любую идею маленького бизнеса.')}</span></li>
        <li><b>2</b><span>{tr('See a real address, what it costs to open and which permits you need.', 'Увидишь настоящий адрес, сколько стоит открыться и какие нужны разрешения.')}</span></li>
        <li><b>3</b><span>{tr('Run it next to other players. A few minutes a day is enough.', 'Веди бизнес рядом с другими игроками. Хватит нескольких минут в день.')}</span></li>
      </ol>
    </section>
  );
}

function IdeaBox() {
  const tr = useT();
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
      <label className="field__label" htmlFor="idea">{tr('What would you open?', 'Что бы ты открыл?')}</label>
      <div className="idea-box__row">
        <input id="idea" className="input" placeholder={tr('A coffee shop with fresh pastries…', 'Кофейня со свежей выпечкой…')} value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" enterKeyHint="go" />
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
  const tr = useT();
  const navigate = useNavigate();
  return (
    <div className="stack-sm">
      <Button block size="lg" icon="store" onClick={() => navigate('/start')}>{tr('Start my business', 'Открыть свой бизнес')}</Button>
      <Button block variant="secondary" icon="badge" onClick={() => navigate('/start?as=official')}>{tr('Work for the city — free', 'Работать на город — бесплатно')}</Button>
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
    <section className="stack" id="how-it-works">
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
