import { useEffect, useMemo, useState } from 'react';
import type { StandingOrders } from '@ohh/shared/types';
import { Banner, Button, Card } from './__stubs__/ui';
import { pendingNotices, readInbox } from './actions';
import { AwayCard } from './AwayCard';
import { BooksTab } from './BooksTab';
import type { BizDeps, BizTabId, ExtraTab } from './deps';
import { dayLabel, plural, shortDate, signedUsd } from './format';
import { changeList, deltaOf } from './forecast';
import { outlookFrom, unitOf, useOutlook } from './Outlook';
import { reportDayFor, savePromise } from './promise';
import { Header } from './Header';
import { ruleCardById } from './lookup';
import { ManageTab } from './ManageTab';
import { buildSetOrders, clearDraft, diffOrders, draftFrom, hasChanges, loadDraft, saveDraft, type Draft } from './orders';
import { RealRuleCard, RuleSheet } from './RuleCards';
import { firstUnseen, markRuleSeen } from './seen';
import { BankruptScreen, NoBusiness } from './StatusScreens';
import { TodayTab } from './TodayTab';
import { pick } from '../../ui/i18n';
import { isPaywallError } from '../paywall/billing';
import './biz.css';

/** One plain sentence per tab, shown under the tab bar: a first-time owner should not have to guess. */
const TAB_HINT: Record<string, [string, string]> = {
  today: ['What happened in your shop since you last looked, and what is waiting for your answer.', 'Что произошло в заведении, пока тебя не было, и что ждёт твоего ответа.'],
  manage: ['Your standing orders: price, staff, cleaning. The shop follows them while you are away.', 'Твои постоянные распоряжения: цена, персонал, уборка. Заведение следует им, пока тебя нет.'],
  books: ['Where the money came from and where it went: sales, rent, wages, taxes.', 'Откуда пришли деньги и куда ушли: продажи, аренда, зарплаты, налоги.'],
  network: ['Your neighbors: make a deal, join the block fund, or report a rival to the city.', 'Твои соседи: договорись о сделке, вступи в фонд квартала или пожалуйся на конкурента городу.'],
  insights: ['Is the business worth it: break-even, months of cash left, and an advisor you can ask.', 'Стоит ли бизнес того: точка окупаемости, на сколько месяцев хватит денег и советник, которого можно спросить.'],
};
const TAB_RU: Record<string, string> = { today: 'Сегодня', manage: 'Управление', books: 'Деньги', network: 'Соседи', insights: 'Аналитика' };

const OWN: { id: BizTabId; label: string; order: number }[] = [
  { id: 'today', label: 'Today', order: 10 },
  { id: 'manage', label: 'Manage', order: 20 },
  { id: 'books', label: 'Books', order: 30 },
];
const SLOTS: ExtraTab[] = [
  { id: 'network', label: 'Network', order: 40, element: null },
  { id: 'insights', label: 'Insights', order: 50, element: null },
];

/** My tabs, then the shell's (agents 11, 12 and later ones) by order; Network and Insights always have a slot. */
export function tabList(extra: ExtraTab[] = []): { id: BizTabId; label: string; order: number; element?: ExtraTab['element']; badge?: number }[] {
  const ownIds = new Set(OWN.map((t) => t.id));
  const others = extra.filter((t) => !ownIds.has(t.id));
  const slots = SLOTS.filter((s) => !others.some((t) => t.id === s.id));
  return [...OWN, ...others, ...slots].sort((a, b) => a.order - b.order);
}

/** Keeps the Manage draft across tab switches, reloads and dropped connections. */
function useDraft(businessId: string | null, orders: StandingOrders | null) {
  const ordersKey = orders ? JSON.stringify(orders) : '';
  const [state, setState] = useState<{ base: string; draft: Draft } | null>(() =>
    businessId && orders ? { base: ordersKey, draft: loadDraft(businessId, orders) ?? draftFrom(orders) } : null);

  useEffect(() => {
    if (!businessId || !orders) { setState(null); return; }
    setState((s) => {
      if (!s) return { base: ordersKey, draft: loadDraft(businessId, orders) ?? draftFrom(orders) };
      if (s.base === ordersKey) return s;
      const oldBase = JSON.parse(s.base) as StandingOrders;
      // No local edits: follow the server (Apply, manager, another device). Local edits: keep them.
      return { base: ordersKey, draft: hasChanges(oldBase, s.draft) ? s.draft : draftFrom(orders) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, ordersKey]);

  const setDraft = (d: Draft) => {
    if (!businessId || !orders) return;
    setState({ base: ordersKey, draft: d });
    saveDraft(businessId, orders, d);
  };
  const reset = () => {
    if (!businessId || !orders) return;
    clearDraft(businessId);
    setState({ base: ordersKey, draft: draftFrom(orders) });
  };
  return { draft: state?.draft ?? null, setDraft, reset };
}

export function BusinessScreen({ deps, initialTab = 'today', onTabChange }: { deps: BizDeps; initialTab?: BizTabId; onTabChange?(tab: BizTabId): void }) {
  const v = deps.view;
  const b = v.business;
  const tabs = tabList(deps.tabs);
  const [tab, setTabState] = useState<BizTabId>(tabs.some((t) => t.id === initialTab) ? initialTab : 'today');
  const setTab = (t: BizTabId) => { setTabState(t); onTabChange?.(t); };
  const [awayClosed, setAwayClosed] = useState(false);
  const [ruleId, setRuleId] = useState<string | null>(null);
  const [, setSeenTick] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [bankruptBooks, setBankruptBooks] = useState(false);
  const { draft, setDraft, reset } = useDraft(b?.id ?? null, b?.orders ?? null);
  const packs = { pack: deps.pack, common: deps.common };

  useEffect(() => {
    if (initialTab && tabs.some((t) => t.id === initialTab)) setTabState(initialTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab]);

  const diff = useMemo(() => (b && draft ? diffOrders(b.orders, draft) : {}), [b, draft]);
  const draftKey = draft ? JSON.stringify(draft) : '';
  const showSave = Object.keys(diff).length > 0 && savedKey !== draftKey;
  const pair = useOutlook(deps, diff, !!b && b.status !== 'bankrupt' && (tab === 'manage' || showSave));
  const effect = (() => {
    const unit = unitOf(deps);
    const now = outlookFrom(pair.base, unit), next = outlookFrom(pair.next, unit);
    return now && next && pair.changed && pair.next.forKey === JSON.stringify(diff) ? deltaOf(now, next) : null;
  })();

  if (!b) return <div className="bz-root"><NoBusiness onOpen={() => deps.navigate?.('/start')} /></div>;

  const openRule = (id: string) => setRuleId(id);
  const goto = (t: BizTabId) => setTab(t);

  const ruleCandidates = [
    ...v.notices.flatMap((n) => n.found.map((f) => f.violationId)),
    ...v.recommendations.map((r) => r.ruleCardId).filter((x): x is string => !!x),
    ...b.trails.filter((t) => t.months > 0).map((t) => t.violationId),
    ...(v.away?.items.some((i) => i.kind === 'case') ? ['letter_grade'] : []),
  ].filter((id) => ruleCardById(packs, id));
  const firstRule = firstUnseen(ruleCandidates);
  const firstCard = firstRule ? ruleCardById(packs, firstRule) : null;

  const closeAway = () => {
    setAwayClosed(true);
    const a = v.away ? readInbox(v.away.items) : null;
    if (a) deps.act(a).catch(() => undefined);
  };

  const save = async () => {
    if (!draft) return;
    const a = buildSetOrders(b.orders, draft);
    if (!a) return;
    const changes = changeList(b.orders, draft, deps.pack, deps.common);
    const unit = unitOf(deps);
    const before = outlookFrom(pair.base, unit);
    const after = pair.next.forKey === JSON.stringify(diff) ? outlookFrom(pair.next, unit) : null;
    setSaving(true); setSaveMsg(null);
    try {
      const ack = await deps.act(a);
      if (ack.ok) {
        setSavedKey(draftKey);
        clearDraft(b.id);
        const day = v.world.day;
        const reportDay = reportDayFor(day);
        savePromise({
          businessId: b.id, appliedDay: day, changes,
          before: before && { ordersPerDay: before.ordersPerDay, profit: before.profit },
          after: after && { ordersPerDay: after.ordersPerDay, profit: after.profit },
          reportDay,
        });
        const forecast = after ? pick(` Forecast: about ${after.ordersPerDay} a day.`, ` Прогноз: около ${after.ordersPerDay} в день.`) : '';
        setSaveMsg({
          ok: true,
          text: pick(
            `Applied: ${changes.join('; ')}. The shop runs on it from ${dayLabel(day + 1)}.${forecast} Tomorrow Today shows how the first day went; the whole month is in the report on ${shortDate(reportDay)}.`,
            `Применено: ${changes.join('; ')}. Заведение работает так с ${dayLabel(day + 1)}.${forecast} Завтра во вкладке «Сегодня» — как прошёл первый день; весь месяц — в отчёте ${shortDate(reportDay)}.`,
          ),
        });
      } else {
        setSaveMsg({ ok: false, text: ack.error ?? pick('The city did not accept the change.', 'Город не принял изменение.') });
      }
    } catch {
      setSaveMsg({ ok: false, text: pick('Connection lost. Your changes are kept; press Apply again when you are back online.', 'Связь пропала. Изменения сохранены; нажми «Apply» ещё раз, когда связь вернётся.') });
    } finally {
      setSaving(false);
    }
  };

  const offers = v.deals.filter((d) => d.status === 'proposed' && d.toBusinessId === b.id).length;
  const badge: Record<string, boolean> = { today: pendingNotices(v.notices).length > 0, network: offers > 0 };
  const current = tabs.find((t) => t.id === tab);

  if (b.status === 'bankrupt') {
    return (
      <div className="bz-root">
        <Header view={v} pack={deps.pack} />
        {!bankruptBooks ? <BankruptScreen deps={deps} onBooks={() => setBankruptBooks(true)} /> : (
          <>
            <div className="bz-pad" style={{ paddingTop: 12 }}><Button onClick={() => setBankruptBooks(false)}>← Back</Button></div>
            <div className="bz-tabpanel"><BooksTab deps={deps} /></div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="bz-root">
      <Header view={v} pack={deps.pack} />
      {!deps.online && (
        <div className="bz-pad" style={{ paddingTop: 10 }}>
          <Banner tone="bad">Connection lost. The city keeps running; your unsaved changes are kept on this device.</Banner>
        </div>
      )}
      <nav className="bz-tabs" role="tablist" aria-label="My business">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" className="bz-tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {pick(t.label, TAB_RU[t.id] ?? t.label)}{(badge[t.id] || (t.badge ?? 0) > 0) && <span className="bz-dot" aria-label="needs an answer" />}
          </button>
        ))}
      </nav>

      <div className="bz-tabpanel" role="tabpanel">
        {TAB_HINT[tab] && <p className="bz-hint">{pick(TAB_HINT[tab][0], TAB_HINT[tab][1])}</p>}
        {firstCard && (tab === 'today' || tab === 'manage' || tab === 'books') && (
          <div className="bz-pad" style={{ marginBottom: 12 }}>
            <RealRuleCard card={firstCard} onDone={() => { markRuleSeen(firstCard.id); setSeenTick((n) => n + 1); }} />
          </div>
        )}
        {tab === 'today' && <TodayTab deps={deps} onRule={openRule} onGo={goto} />}
        {tab === 'manage' && draft && <ManageTab deps={deps} draft={draft} diff={diff} setDraft={setDraft} onRule={openRule} pair={pair} />}
        {tab === 'books' && <BooksTab deps={deps} />}
        {tab !== 'today' && tab !== 'manage' && tab !== 'books' && (current?.element ?? <Slot title={current?.label ?? 'Coming soon'} text={SLOT_TEXT[tab] ?? 'This part of your business is on its way.'} />)}
        {saveMsg && !showSave && (
          <div className="bz-pad" style={{ marginTop: 12 }}>
            <Banner tone={saveMsg.ok ? 'good' : 'bad'}>{saveMsg.text}</Banner>
            {!saveMsg.ok && isPaywallError(saveMsg.text) && deps.navigate && (
              <div style={{ marginTop: 8 }}><Button variant="primary" onClick={() => deps.navigate!('/pro')}>{pick('See Pro', 'Посмотреть Pro')}</Button></div>
            )}
          </div>
        )}
      </div>

      {showSave && (
        <div className="bz-savebar">
          <div className="bz-savebar-inner">
            <div className="bz-between bz-small">
              <span>
                {pick(`${plural(Object.keys(diff).length, 'change')} · start ${dayLabel(v.world.day + 1)}`, `Изменений: ${Object.keys(diff).length} · с ${dayLabel(v.world.day + 1)}`)}
                {effect && <>{' · '}<span className={effect.profit > 0 ? 'bz-good-text' : effect.profit < 0 ? 'bz-bad-text' : ''}>{signedUsd(effect.profit)}</span>{pick(' profit / 30 days', ' прибыли за 30 дней')}</>}
              </span>
              {tab !== 'manage' && <button type="button" className="bz-linkbtn" onClick={() => setTab('manage')}>{pick('Review', 'Посмотреть')}</button>}
            </div>
            {saveMsg && !saveMsg.ok && <span className="bz-small bz-bad-text" role="alert">{saveMsg.text}</span>}
            {/* the one place where the player decides to pay: a button, not a path written in text (docs/qa/BUGS.md #14) */}
            {saveMsg && !saveMsg.ok && isPaywallError(saveMsg.text) && deps.navigate && (
              <Button variant="primary" onClick={() => deps.navigate!('/pro')}>{pick('See Pro', 'Посмотреть Pro')}</Button>
            )}
            <div className="bz-btn-row">
              <Button onClick={() => { reset(); setSaveMsg(null); }} disabled={saving}>{pick('Discard', 'Отменить')}</Button>
              <Button variant="primary" onClick={save} disabled={saving || !deps.online}>{!deps.online ? 'Waiting for connection…' : saving ? 'Applying…' : 'Apply'}</Button>
            </div>
          </div>
        </div>
      )}

      <RuleSheet id={ruleId} packs={packs} onClose={() => setRuleId(null)} />
      {v.away && !awayClosed && <AwayCard view={v} onClose={closeAway} onGo={goto} />}
    </div>
  );
}

const SLOT_TEXT: Record<string, string> = {
  network: 'Neighbors, offers and deals.',
  insights: 'Break-even, payback, costs against the industry and the advisor.',
};

function Slot({ title, text }: { title: string; text: string }) {
  return (
    <div className="bz-pad">
      <Card title={title}><p className="bz-muted">{text}</p></Card>
    </div>
  );
}
