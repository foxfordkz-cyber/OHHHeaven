// Pure helpers for the official's desk (/desk): no React, no network. Every number comes from the view, the packs or RULES.
import type { Action, Case, CaseCard, Money, NicheId, OfficialRole, OfficialView, PackOfficial, PackSet, PackViolation } from '../../../../shared/src/types';
import { RULES, dateOf } from '../../../../shared/src/rules';

/** Whole dollars, $1,234 (same format as the network screen). Own copy: the desk does not lean on other screens' files. */
export const money = (n: Money): string => {
  const s = '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n < 0 ? '−' + s : s;
};

export const NICHE_NAME: Record<NicheId, string> = { cafe: 'Cafe', barbershop: 'Barbershop', bodega: 'Corner store', guesthouse: 'Guesthouse', rentals: 'Rentals' };

/** Same names as the engine (engine/src/law/util.ts). */
export const ROLE_LABEL: Record<OfficialRole, string> = { inspector: 'City inspector', tax_auditor: 'Tax auditor' };

/** What each role checks in the packs (cafe, barbershop, _common). */
export const ROLE_SCOPE: Record<OfficialRole, string> = {
  inspector: 'Health, licenses, sidewalks and trash',
  tax_auditor: 'Payroll, sales tax and labor law',
};

export const ORIGIN_LABEL: Record<Case['origin'], string> = {
  report: 'Neighbor complaint',
  flag: 'Suspicious numbers',
  routine: 'Routine check',
};

export const ORIGIN_TEXT: Record<Case['origin'], string> = {
  report: 'Another owner reported this business to the city.',
  flag: 'The books of this business look off for its size.',
  routine: `Every business is checked about every ${RULES.ROUTINE_INSPECTION_EVERY_MONTHS} months.`,
};

/** CaseCard has no outcome or fine yet (request in agents/12.md); read them if the host sends them. */
export type CaseCardMaybe = CaseCard & { outcome?: Case['outcome']; fine?: Money };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const round2 = (n: number) => Math.round(n * 100) / 100;

export function waitingText(card: CaseCard, today: number): string {
  const d = Math.max(0, today - card.openedDay);
  return d === 0 ? 'New today' : `Waiting ${plural(d, 'day')}`;
}

/** Contract: a case nobody takes in CASE_GRACE_DAYS goes to an AI official. */
export function aiTakeoverText(card: CaseCard, today: number): string {
  const left = card.openedDay + RULES.CASE_GRACE_DAYS - today;
  return left <= 0 ? 'An AI official takes it today if nobody does' : `An AI official takes it in ${plural(left, 'day')}`;
}

export function suspension(view: OfficialView): { blocked: boolean; title?: string; text?: string } {
  const o = view.official;
  if (o.exposed) {
    return {
      blocked: true, title: 'Internal Affairs exposed you',
      text: 'You took the most bribes in a month. Your points are gone, you get no new cases, and no share of the bank at the end of the season.',
    };
  }
  if (o.suspendedUntilDay !== undefined && view.world.day < o.suspendedUntilDay) {
    return { blocked: true, title: `Suspended until ${dateOf(o.suspendedUntilDay).label}`, text: 'You cannot take cases until then.' };
  }
  return { blocked: false };
}

/** Can I take this case, and if not, why. The engine checks the same rules (engine/src/law/actions.ts). */
export function takeAvailability(card: CaseCard, view: OfficialView): { allowed: boolean; reason?: string } {
  const o = view.official;
  const day = view.world.day;
  if (o.exposed) return { allowed: false, reason: 'Internal Affairs exposed you: no new cases' };
  if (o.suspendedUntilDay !== undefined && day < o.suspendedUntilDay) return { allowed: false, reason: `Suspended until ${dateOf(o.suspendedUntilDay).label}` };
  if (card.status !== 'open') return { allowed: false, reason: 'Another official already took this case' };
  if (card.role !== o.role) return { allowed: false, reason: `This case needs a ${ROLE_LABEL[card.role].toLowerCase()}` };
  const recent = view.mine.find((m) => m.business.id === card.business.id && m.caseId !== card.caseId && day - m.openedDay < RULES.SAME_TARGET_COOLDOWN_DAYS);
  if (recent) return { allowed: false, reason: `You checked ${card.business.name} less than ${RULES.SAME_TARGET_COOLDOWN_DAYS} days ago` };
  return { allowed: true };
}

// ───────────── points, rank, earnings ─────────────

export function rankOf(view: OfficialView): { place: number | null; of: number } {
  const sorted = [...view.ranking].sort((a, b) => b.points - a.points);
  const i = sorted.findIndex((r) => !r.isAi && r.name === view.official.name);
  return { place: i >= 0 ? i + 1 : null, of: sorted.length };
}

/**
 * Season end: officialsShare of the bank goes to human officials with points, split by points; an exposed official gets 0
 * (engine/src/deals/season.ts). This is the same split as if the season ended today.
 */
export function earningsEstimate(view: OfficialView): { pool: Money; amount: Money; sharePct: number } {
  const pool = round2(view.world.bank * view.world.config.officialsShare);
  const o = view.official;
  if (o.isAi || o.exposed || o.points <= 0) return { pool, amount: 0, sharePct: 0 };
  const others = view.ranking.filter((r) => !r.isAi && r.points > 0 && r.name !== o.name).reduce((s, r) => s + r.points, 0);
  const share = o.points / (o.points + others);
  return { pool, amount: round2(pool * share), sharePct: Math.round(share * 100) };
}

export const POINTS_RULES = [
  `+${RULES.POINTS_PER_VIOLATION} points for each violation, when the fine is paid`,
  `${RULES.POINTS_EMPTY_INSPECTION} points for an inspection that finds nothing`,
  `+${RULES.POINTS_PER_BRIBE} points for each violation if you take the money, until Internal Affairs finds out`,
];

// ───────────── cases ─────────────

export type CaseStage = 'inspecting' | 'notice' | 'bribe' | 'closed';

export function stageOf(card: CaseCard): CaseStage {
  if (card.status === 'notice') return 'notice';
  if (card.status === 'bribe_offered') return 'bribe';
  if (card.status === 'closed') return 'closed';
  return 'inspecting';
}

export const STAGE_LABEL: Record<CaseStage, string> = {
  inspecting: 'Inspection in progress', notice: 'Fine notice sent', bribe: 'The owner offers money', closed: 'Closed',
};

export function findViolation(packs: PackSet | null, niche: CaseCard['business']['niche'], id: string): PackViolation | undefined {
  if (!packs) return undefined;
  return [...packs.common.violations, ...(packs.niches[niche]?.violations ?? [])].find((v) => v.id === id);
}

/** Officials live in the common pack and in niche packs; a violation names the one who finds it (`PackViolation.official`). */
export function findOfficial(packs: PackSet | null, niche: CaseCard['business']['niche'], id: string): PackOfficial | undefined {
  if (!packs) return undefined;
  return [...(packs.niches[niche]?.officials ?? []), ...packs.common.officials].find((o) => o.id === id);
}

/** The real officials behind what this inspection found, without repeats: for «How it works in real life». */
export function officialsForCase(card: CaseCard, packs: PackSet | null): PackOfficial[] {
  const out: PackOfficial[] = [];
  for (const f of card.found ?? []) {
    const v = findViolation(packs, card.business.niche, f.violationId);
    const o = v ? findOfficial(packs, card.business.niche, v.official) : undefined;
    if (o && !out.some((x) => x.id === o.id)) out.push(o);
  }
  return out;
}

/** Bribery in the common pack (`bribery`), with the official who investigates it. */
export function briberyRule(packs: PackSet | null): { law?: string; official?: PackOfficial } {
  const v = packs?.common.violations.find((x) => x.id === 'bribery') ?? packs?.common.violations.find((x) => x.id.includes('brib'));
  return { law: v?.law, official: v ? packs?.common.officials.find((o) => o.id === v.official) : undefined };
}

export interface FoundLine { id: string; name: string; law: string; fine: Money; closureDays: number; months: number; source?: string }

export function foundLines(card: CaseCard, packs: PackSet | null): FoundLine[] {
  return (card.found ?? []).map((f) => {
    const v = findViolation(packs, card.business.niche, f.violationId);
    return { id: f.violationId, name: v?.name ?? f.violationId, law: v?.law ?? 'Law name not in the pack yet', fine: f.fine, closureDays: f.closureDays, months: f.months, source: v?.source };
  });
}

export const totalFine = (card: CaseCardMaybe): Money => card.fine ?? round2((card.found ?? []).reduce((s, f) => s + f.fine, 0));
export const closureOf = (card: CaseCard): number => Math.max(0, ...(card.found ?? []).map((f) => f.closureDays));

export function noticeText(card: CaseCardMaybe): string {
  const n = card.found?.length ?? 0;
  return `The owner has ${plural(RULES.NOTICE_ANSWER_DAYS, 'day')} to pay or contest; silence means they pay. You get +${RULES.POINTS_PER_VIOLATION * n} points when the fine is paid.`;
}

export interface BribeFacts { amount: Money; fine: Money; pointsIfTaken: number; pointsIfRefused: number; fineIfRefused: Money }

export function bribeFacts(card: CaseCardMaybe): BribeFacts {
  const n = card.found?.length ?? 0;
  const fine = totalFine(card);
  return {
    amount: card.bribeAmount ?? 0, fine,
    pointsIfTaken: RULES.POINTS_PER_BRIBE * n, pointsIfRefused: RULES.POINTS_PER_VIOLATION * n,
    fineIfRefused: round2(fine * RULES.REFUSED_BRIBE_FINE_MULT),
  };
}

/** The honest warning next to «Take $400». */
export function bribeWarning(card: CaseCardMaybe, view: OfficialView, packs: PackSet | null): string[] {
  const f = bribeFacts(card);
  const taken = view.official.bribesThisMonth;
  const { law } = briberyRule(packs);
  return [
    `Take it: the ${money(f.fine)} fine disappears, you keep ${money(f.amount)} and get +${f.pointsIfTaken} points.`,
    'Once a month Internal Affairs exposes the official who took the most bribes that month: all points are gone, no new cases and no share of the bank.',
    taken > 0 ? `You have taken ${plural(taken, 'bribe')} this month already.` : 'You have taken no bribes this month.',
    `Refuse: the owner pays ${RULES.REFUSED_BRIBE_FINE_MULT}× the fine, ${money(f.fineIfRefused)}, and you get +${f.pointsIfRefused} points.`,
    law ? `In real life the owner commits a crime: ${law}. Taking the money is bribe receiving, a crime too.` : 'In real life, taking money from a business you inspect is a crime.',
  ];
}

export function closedText(card: CaseCardMaybe): string {
  const n = card.found?.length ?? 0;
  if (card.outcome === 'fined') return `Fine paid: ${money(totalFine(card))}`;
  if (card.outcome === 'bribed') return `You took ${money(card.bribeAmount ?? 0)}; no fine`;
  if (card.outcome === 'dismissed') return 'Dismissed';
  if (card.outcome === 'clean' || n === 0) return `Nothing found (${RULES.POINTS_EMPTY_INSPECTION} points)`;
  return `Closed with ${plural(n, 'violation')}`;
}

export const EMPTY_QUEUE_TEXT = [
  'A neighbor reports a business to the city.',
  'The books of a business look off for its size.',
  `A routine check comes due (every ${RULES.ROUTINE_INSPECTION_EVERY_MONTHS} months).`,
];

export const EMPTY_QUEUE_NEXT = `New cases appear as the city lives. A case nobody takes in ${plural(RULES.CASE_GRACE_DAYS, 'day')} goes to an AI official, so check in every day or two.`;

// ───────────── today at the desk: one decision, the race, what comes tomorrow ─────────────

export type DeskDecision =
  | { kind: 'bribe'; caseId: string; title: string; detail: string }
  | { kind: 'take'; caseId: string; title: string; detail: string }
  | { kind: 'wait'; caseId?: string; title: string; detail: string }
  | { kind: 'none'; title: string; detail: string };

/**
 * The one thing that waits for the official today, most urgent first: an offer that expires, a case about to go to an
 * AI official, an inspection whose result comes tomorrow, or nothing (and when cases appear).
 */
export function deskDecision(view: OfficialView): DeskDecision {
  const day = view.world.day;
  const offer = view.mine.find((c) => c.status === 'bribe_offered') as CaseCardMaybe | undefined;
  if (offer) {
    const f = bribeFacts(offer);
    return {
      kind: 'bribe', caseId: offer.caseId,
      title: `${offer.business.name} offers you ${money(f.amount)}`,
      detail: `Take it: +${f.pointsIfTaken} points and the risk of Internal Affairs. Refuse: they pay ${money(f.fineIfRefused)}, you get +${f.pointsIfRefused}. No answer within ${plural(RULES.BRIBE_ANSWER_DAYS, 'day')} means you refuse.`,
    };
  }
  const blocked = suspension(view).blocked;
  const takeable = blocked ? [] : view.queue
    .filter((c) => takeAvailability(c, view).allowed)
    .sort((a, b) => a.openedDay - b.openedDay || Number(b.origin === 'report') - Number(a.origin === 'report'));
  if (takeable.length) {
    const c = takeable[0];
    const left = Math.max(0, c.openedDay + RULES.CASE_GRACE_DAYS - day);
    return {
      kind: 'take', caseId: c.caseId,
      title: `Take the case on ${c.business.name}`,
      detail: `${ORIGIN_LABEL[c.origin]}. ${left === 0 ? 'An AI official takes it today' : `An AI official takes it in ${plural(left, 'day')}`} if you do not. +${RULES.POINTS_PER_VIOLATION} points for each violation you find, ${RULES.POINTS_EMPTY_INSPECTION} if the place is clean.`,
    };
  }
  const inspecting = view.mine.find((c) => stageOf(c) === 'inspecting');
  if (inspecting) {
    return {
      kind: 'wait', caseId: inspecting.caseId,
      title: `Inspection at ${inspecting.business.name} is under way`,
      detail: `The result comes to this desk on ${dateOf(inspecting.openedDay + RULES.INSPECTION_DAYS + 1).label} at the latest. If something is found, the owner gets a fine notice and may offer you money.`,
    };
  }
  const notice = view.mine.find((c) => stageOf(c) === 'notice') as CaseCardMaybe | undefined;
  if (notice) {
    return {
      kind: 'wait', caseId: notice.caseId,
      title: `${notice.business.name} has a fine notice of ${money(totalFine(notice))}`,
      detail: `They have ${plural(RULES.NOTICE_ANSWER_DAYS, 'day')} to pay or contest. You get +${RULES.POINTS_PER_VIOLATION * (notice.found?.length ?? 0)} points when it is paid.`,
    };
  }
  if (blocked) return { kind: 'none', title: suspension(view).title ?? 'No cases for you now', detail: suspension(view).text ?? '' };
  return { kind: 'none', title: 'Nothing waits for you right now', detail: EMPTY_QUEUE_NEXT };
}

export interface RankRace { place: number | null; of: number; points: number; above?: { name: string; points: number; gap: number; violations: number }; below?: { name: string; points: number; gap: number } }

/** Who is right above and below me in the officials' ranking, and how many found violations close the gap. */
export function rankRace(view: OfficialView): RankRace {
  const sorted = [...view.ranking].sort((a, b) => b.points - a.points);
  const i = sorted.findIndex((r) => !r.isAi && r.name === view.official.name);
  const points = view.official.points;
  if (i < 0) return { place: null, of: sorted.length, points };
  const up = i > 0 ? sorted[i - 1] : undefined;
  const down = sorted[i + 1];
  const gapUp = up ? up.points - points : 0;
  return {
    place: i + 1, of: sorted.length, points,
    above: up ? { name: up.name, points: up.points, gap: gapUp, violations: Math.max(1, Math.ceil((gapUp + 1) / RULES.POINTS_PER_VIOLATION)) } : undefined,
    below: down ? { name: down.name, points: down.points, gap: points - down.points } : undefined,
  };
}

export function rankRaceText(r: RankRace): string {
  if (r.place == null) return 'You are not in the ranking yet: close your first case to get on it.';
  if (!r.above) return r.below ? `You lead the city's officials. ${r.below.name} is ${plural(r.below.gap, 'point')} behind you.` : 'You lead the city\'s officials.';
  return `#${r.place} of ${r.of}. ${r.above.name} is ${plural(r.above.gap, 'point')} ahead: ${plural(r.above.violations, 'violation')} found and paid puts you past them.`;
}

/** What tomorrow brings to this desk, from the view only: results due, cases about to leave, the next game day. */
export function tomorrowLines(view: OfficialView): string[] {
  const day = view.world.day;
  const out: string[] = [];
  const due = view.mine.filter((c) => stageOf(c) === 'inspecting');
  if (due.length) out.push(`${plural(due.length, 'inspection result')} due: ${due.map((c) => c.business.name).join(', ')}.`);
  const leaving = view.queue.filter((c) => c.status === 'open' && c.openedDay + RULES.CASE_GRACE_DAYS - day <= 1);
  if (leaving.length) out.push(`${plural(leaving.length, 'case')} in the queue go${leaving.length === 1 ? 'es' : ''} to an AI official by tomorrow.`);
  const notices = view.mine.filter((c) => stageOf(c) === 'notice');
  if (notices.length) out.push(`${plural(notices.length, 'owner')} must pay or contest a fine soon: points come when they pay.`);
  if (view.official.bribesThisMonth > 0) out.push(`Internal Affairs looks at this month's bribes at the month's end: you took ${plural(view.official.bribesThisMonth, 'bribe')}.`);
  if (!out.length) out.push('New cases arrive as owners report each other and books look off. Check in every day or two.');
  return out;
}

/** The answer on the case card right after the official acted, before the next picture of the city arrives. */
export function afterActText(a: Action, card: CaseCardMaybe | undefined): string {
  if (a.type === 'take_case') {
    return `Case taken. The inspection takes ${plural(RULES.INSPECTION_DAYS, 'game day')}; the result comes here. +${RULES.POINTS_PER_VIOLATION} points for each violation when the fine is paid.`;
  }
  if (a.type === 'answer_bribe' && card) {
    const f = bribeFacts(card);
    return a.accept
      ? `You took ${money(f.amount)}: +${f.pointsIfTaken} points. The fine is gone. Internal Affairs reviews the month's bribes at the month's end.`
      : `You refused. The owner now owes ${money(f.fineIfRefused)}; you get +${f.pointsIfRefused} points when it is paid.`;
  }
  return 'Done.';
}

// ───────────── actions: the only thing the desk sends ─────────────

export const deskAct = {
  takeCase: (caseId: string): Action => ({ type: 'take_case', caseId }),
  answerBribe: (caseId: string, accept: boolean): Action => ({ type: 'answer_bribe', caseId, accept }),
};
