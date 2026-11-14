import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import type { IdeaMatch, NicheId } from '@ohh/shared/types';
import { useCatalog } from '../../app/catalog';
import { useStoreState, useView } from '../../app/store';
import { Button, Card, ProgressBar, Skeleton, TopBar, useT } from '../../ui';
import { IdeaStep, JoinStep, PlaceStep, PlanStep } from './steps';
import { DecisionsStep, type SetupDraft } from './decisions/Decisions';
import { WaitStep } from './WaitStep';
import './start.css';

export type WizardStep = 'idea' | 'place' | 'plan' | 'kit';
/** `setup` holds the opening decisions made so far for one place: they survive a reload and a step back. */
export interface Draft { step: WizardStep; idea: string; match: IdeaMatch | null; niche: NicheId | null; name: string; placeId: string | null; setup?: SetupDraft | null }

const EMPTY: Draft = { step: 'idea', idea: '', match: null, niche: null, name: '', placeId: null };
// The name and the entry fee are asked after the plan: a newcomer sees the address, the cost and the permits first.
const STEPS = ['Idea', 'Place', 'Plan', 'Join', 'Setup', 'Open'] as const;
const WIZARD_INDEX: Record<WizardStep, number> = { idea: 0, place: 1, plan: 2, kit: 4 };

function draftKey(mode: string, worldId: string) {
  return `ohh.start.draft.v1:${mode}:${worldId}`;
}

function readDraft(key: string): Draft | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<Draft>) } : null;
  } catch {
    return null;
  }
}

/** /start — idea → niche → place → opening plan → the opening decisions → construction and permits → open doors. */
export function Start({ initial }: { initial?: Partial<Draft> }) {
  const view = useView();
  const { mode, worldId, status } = useStoreState();
  const catalog = useCatalog();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const asOfficial = params.get('as') === 'official';
  const key = draftKey(mode, worldId);

  const [draft, setDraft] = useState<Draft>(() => {
    const fromHome = (location.state ?? {}) as { idea?: string; match?: IdeaMatch | null };
    const nicheParam = params.get('niche') as NicheId | null;
    const saved = readDraft(key);
    const base: Draft = { ...EMPTY, ...saved, ...initial };
    if (fromHome.idea) Object.assign(base, { idea: fromHome.idea, match: fromHome.match ?? null, niche: fromHome.match?.niche ?? base.niche, name: fromHome.match?.businessName ?? base.name, step: 'idea' });
    if (nicheParam) Object.assign(base, { niche: nicheParam });
    return base;
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(draft));
    } catch {
      /* private mode: the draft lives in memory only */
    }
  }, [key, draft]);

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  // Where are we: a guest walks idea → place → plan and joins only then; owner without business → wizard;
  // setup → waiting; open → done. A future city official joins at once.
  const phase = useMemo(() => {
    if (!view) return 'loading' as const;
    // nobody can join or open in a finished season: say so before the visitor fills in six steps
    if (view.world.phase === 'ended' && (view.kind === 'city' || (view.kind === 'owner' && !view.business))) return 'ended' as const;
    if (view.kind === 'city') return asOfficial || draft.step === 'kit' ? ('join' as const) : ('wizard' as const);
    if (view.kind === 'official') return 'official' as const;
    if (!view.business) return 'wizard' as const;
    return view.business.status === 'setup' ? ('wait' as const) : ('done' as const);
  }, [view, asOfficial, draft.step]);

  useEffect(() => {
    if (phase === 'official') navigate('/desk', { replace: true });
  }, [phase, navigate]);

  const stepIndex = phase === 'join' ? 3 : phase === 'wizard' ? WIZARD_INDEX[draft.step] : phase === 'wait' ? 5 : 5;
  const back = () => {
    if (phase === 'join' && !asOfficial) return update({ step: 'plan' });
    if (phase !== 'wizard') return navigate('/');
    const order: WizardStep[] = ['idea', 'place', 'plan', 'kit'];
    const i = order.indexOf(draft.step);
    if (i <= 0) navigate('/');
    else update({ step: order[i - 1] });
  };

  return (
    <main className="screen start">
      <TopBar title={asOfficial && phase === 'join' ? 'Work for the city' : 'Open your business'} onBack={back} />
      {phase === 'ended' && view && <SeasonOverCard name={view.world.config.name} demo={view.world.config.demo} />}
      {phase !== 'official' && phase !== 'ended' && !(asOfficial && phase === 'join') && (
        <div className="start-progress" aria-label={`Step ${stepIndex + 1} of ${STEPS.length}: ${STEPS[stepIndex]}`}>
          <div className="row-between xsmall">
            <span className="faint">Step {stepIndex + 1} of {STEPS.length}</span>
            <span className="accent" style={{ fontWeight: 650 }}>{STEPS[stepIndex]}</span>
          </div>
          <ProgressBar value={(stepIndex + 1) / STEPS.length} />
        </div>
      )}

      {phase === 'loading' && (status === 'offline' ? <OfflineCard /> : <div className="stack"><Skeleton height={120} /><Skeleton height={54} /></div>)}
      {phase === 'join' && view && <JoinStep view={view} asOfficial={asOfficial} />}
      {phase === 'wizard' && view && view.kind !== 'official' && catalog && (
        <>
          {draft.step === 'idea' && <IdeaStep draft={draft} update={update} catalog={catalog} />}
          {draft.step === 'place' && <PlaceStep draft={draft} update={update} catalog={catalog} view={view} />}
          {draft.step === 'plan' && <PlanStep draft={draft} update={update} catalog={catalog} today={view.world.day} />}
          {draft.step === 'kit' && view.kind === 'owner' && <DecisionsStep draft={draft} update={update} catalog={catalog} view={view} />}
        </>
      )}
      {phase === 'wait' && view?.kind === 'owner' && catalog && <WaitStep view={view} catalog={catalog} />}
      {phase === 'done' && view?.kind === 'owner' && <DoneCard name={view.business?.name ?? 'Your business'} />}
    </main>
  );
}

function DoneCard({ name }: { name: string }) {
  const navigate = useNavigate();
  return (
    <Card tone="profit" title="Your doors are open" subtitle={`${name} is serving customers. The city keeps going while you are away.`}>
      <Button block size="lg" icon="store" onClick={() => navigate('/biz')}>Go to my business</Button>
    </Card>
  );
}

function SeasonOverCard({ name, demo }: { name: string; demo: boolean }) {
  const navigate = useNavigate();
  const tr = useT();
  return (
    <Card tone="warn" title={tr(`This season of ${name} is over`, `Сезон города ${name} закончился`)}
      subtitle={demo
        ? tr('A new season starts a few minutes after the last one ends. What you chose so far is kept: come back and go on.', 'Новый сезон начинается через несколько минут после конца прошлого. Ваш выбор сохранён: вернитесь и продолжайте.')
        : tr('A finished season takes no new businesses. The next one opens soon.', 'В законченный сезон нельзя открыть бизнес. Следующий скоро начнётся.')}>
      <Button block variant="secondary" icon="trophy" onClick={() => navigate('/end')}>{tr('See how the season ended', 'Посмотреть, чем закончился сезон')}</Button>
    </Card>
  );
}

function OfflineCard() {
  return <Card tone="warn" title="No connection to the city" subtitle='Use "Practice offline" at the top to open your business in the browser.' />;
}
