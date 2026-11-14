// Pure helpers for the official's desk (/desk): no React, no network. Every number comes from the view, the packs or RULES.
import type { Action, Case, CaseCard, Money, OfficialRole, OfficialView, PackOfficial, PackSet, PackViolation } from '../../../../shared/src/types';
import { RULES, dateOf } from '../../../../shared/src/rules';
import { money } from '../network/logic';

export const ROLE_LABEL: Record<OfficialRole, string> = { inspector: 'Health inspector', tax_auditor: 'Tax auditor' };

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

export function officialFor(packs: PackSet | null, role: OfficialRole): PackOfficial | undefined {
  return packs?.common.officials.find((o) => o.role === role);
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
  const law = packs?.common.violations.find((v) => v.id === 'bribery' || v.id.includes('brib'));
  return [
    `Take it: the ${money(f.fine)} fine disappears, you keep ${money(f.amount)} and get +${f.pointsIfTaken} points.`,
    'Once a month Internal Affairs exposes the official who took the most bribes that month: all points are gone, no new cases and no share of the bank.',
    taken > 0 ? `You have taken ${plural(taken, 'bribe')} this month already.` : 'You have taken no bribes this month.',
    `Refuse: the owner pays ${RULES.REFUSED_BRIBE_FINE_MULT}× the fine, ${money(f.fineIfRefused)}, and you get +${f.pointsIfRefused} points.`,
    law?.law ? `In real life this is a crime: ${law.law}.` : 'In real life, taking money from a business you inspect is a crime.',
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

// ───────────── actions: the only thing the desk sends ─────────────

export const deskAct = {
  takeCase: (caseId: string): Action => ({ type: 'take_case', caseId }),
  answerBribe: (caseId: string, accept: boolean): Action => ({ type: 'answer_bribe', caseId, accept }),
};
