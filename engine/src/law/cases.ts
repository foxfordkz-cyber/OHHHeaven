// Жизнь дела: открытие, передача госслужащему, проверка, уведомление, ответы, взятка, закрытие.
import type { BusinessState, Case, FoundViolation, OfficialRole, OfficialState, WorldState } from '../../../shared/src/types';
import { RULES, dateOf } from '../../../shared/src/rules';
import type { EngineCtx } from './ctx';
import { findViolations } from './trails';
import {
  ROLE_LABEL, addFeed, addInbox, charge, clamp01, findBusiness, findViolation, lastInspectionDay, mapBusiness, mapCase,
  mapOfficial, money, monthOfDay, ownerPlayerIds, usd,
} from './util';

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

export function complaintsThisMonth(w: WorldState, businessId: string): number {
  const month = monthOfDay(w.day);
  return w.cases.filter((c) => c.businessId === businessId && c.origin === 'report' && monthOfDay(c.openedDay) === month).length;
}

/** Подсказки госслужащему — только из открытых данных. */
export function hintsFor(w: WorldState, b: BusinessState, role: OfficialRole, lead: string[]): string[] {
  const hints = [...lead];
  const complaints = complaintsThisMonth(w, b.id);
  if (complaints > 0) hints.push(`${plural(complaints, 'complaint')} this month`);
  const last = lastInspectionDay(w, b.id, role);
  const since = last ?? b.openedDay ?? b.createdDay;
  const months = Math.floor((w.day - since + 1) / RULES.DAYS_PER_MONTH);
  if (last === undefined) hints.push(months >= 1 ? `Never inspected, open ${plural(months, 'month')}` : 'Never inspected');
  else if (months >= 1) hints.push(`No inspection in ${plural(months, 'month')}`);
  return [...new Set(hints)];
}

export function hasActiveCase(w: WorldState, businessId: string, role: OfficialRole): boolean {
  return w.cases.some((c) => c.businessId === businessId && c.role === role && c.status !== 'closed');
}

export interface CaseSpec { businessId: string; role: OfficialRole; origin: Case['origin']; reportId?: string; reporterBusinessId?: string; lead: string[] }

export function openCase(w: WorldState, spec: CaseSpec): { world: WorldState; caseId: string } {
  const b = findBusiness(w, spec.businessId);
  const id = `case-${w.cases.length + 1}`;
  const draft: Case = { id, businessId: spec.businessId, role: spec.role, origin: spec.origin, openedDay: w.day, hints: [], status: 'open' };
  if (spec.reportId !== undefined) draft.reportId = spec.reportId;
  if (spec.reporterBusinessId !== undefined) draft.reporterBusinessId = spec.reporterBusinessId;
  let world: WorldState = { ...w, cases: [...w.cases, draft] };
  if (b) {
    const hints = hintsFor(world, b, spec.role, spec.lead);
    world = mapCase(world, id, (c) => ({ ...c, hints }));
  }
  return { world, caseId: id };
}

export function isAvailable(o: OfficialState, day: number): boolean {
  return !o.exposed && !(o.suspendedUntilDay !== undefined && day < o.suspendedUntilDay);
}

/** Один госслужащий не берёт дело на один бизнес чаще, чем раз в SAME_TARGET_COOLDOWN_DAYS. */
export function cooldownOk(w: WorldState, officialId: string, businessId: string, exceptCaseId?: string): boolean {
  return !w.cases.some((c) => c.id !== exceptCaseId && c.officialId === officialId && c.businessId === businessId
    && c.takenDay !== undefined && w.day - c.takenDay < RULES.SAME_TARGET_COOLDOWN_DAYS);
}

export function takeCase(w: WorldState, caseId: string, official: OfficialState): WorldState {
  const c = w.cases.find((x) => x.id === caseId);
  if (!c) return w;
  let world = mapCase(w, caseId, (x) => ({ ...x, status: 'taken', officialId: official.id, takenDay: w.day, inspectDay: w.day + RULES.INSPECTION_DAYS }));
  const b = findBusiness(world, c.businessId);
  world = addInbox(world, [official.playerId], {
    id: `law:${caseId}:taken`, title: `Case taken: ${b?.name ?? c.businessId}`,
    text: `You will inspect ${b?.name ?? 'the business'} on ${dateOf(w.day + RULES.INSPECTION_DAYS).label}.`, ref: { type: 'case', id: caseId },
  });
  return world;
}

/** Первый свободный госслужащий под управлением ИИ нужной роли, которому можно взять этот бизнес. */
export function firstFreeAi(w: WorldState, c: Case): OfficialState | undefined {
  return w.officials.find((o) => o.isAi && o.role === c.role && isAvailable(o, w.day) && cooldownOk(w, o.id, c.businessId, c.id));
}

const officialOf = (w: WorldState, c: Case): OfficialState | undefined => w.officials.find((o) => o.id === c.officialId);

function violationNames(w: WorldState, ctx: EngineCtx, b: BusinessState, found: FoundViolation[]): string {
  void w;
  return found.map((f) => findViolation(ctx, b.niche, f.violationId)?.name ?? f.violationId).join(', ');
}

/** Проверка: найти всё, что относится к роли проверяющего. */
export function inspect(w: WorldState, ctx: EngineCtx, caseId: string): WorldState {
  const c = w.cases.find((x) => x.id === caseId);
  if (!c) return w;
  const b = findBusiness(w, c.businessId);
  if (!b || b.status === 'bankrupt') return dismiss(w, caseId);
  const found = findViolations(b, ctx, c.role, c.origin, w.day);
  if (found.length === 0) return closeClean(w, ctx, c, b);
  const fine = found.reduce((s, f) => s + f.fine, 0);
  const closureDays = Math.max(0, ...found.map((f) => f.closureDays));
  const answerByDay = w.day + RULES.NOTICE_ANSWER_DAYS;
  let world = mapCase(w, caseId, (x) => ({ ...x, status: 'notice', found, fine, closureDays, answerByDay }));
  const names = violationNames(w, ctx, b, found);
  const laws = found.map((f) => findViolation(ctx, b.niche, f.violationId)?.law).filter(Boolean).join('; ');
  world = addInbox(world, ownerPlayerIds(b), {
    id: `law:${caseId}:notice`, title: `Notice of violation: ${usd(fine)} fine`,
    text: `${ROLE_LABEL[c.role]} found: ${names}.${laws ? ` Law: ${laws}.` : ''}${closureDays > 0 ? ` Closure: ${plural(closureDays, 'day')}.` : ''} `
      + `Answer by ${dateOf(answerByDay).label}: pay, contest (${usd(RULES.CONTEST_FEE)} lawyer, fine x${RULES.CONTEST_FINE_MULT}) or make an offer. No answer means you pay.`,
    ref: { type: 'case', id: caseId },
  });
  const official = officialOf(world, c);
  if (official) {
    world = addInbox(world, [official.playerId], {
      id: `law:${caseId}:found`, title: `Found ${plural(found.length, 'violation')} at ${b.name}`,
      text: `${names}. Fine ${usd(fine)}. Waiting for the owner until ${dateOf(answerByDay).label}.`, ref: { type: 'case', id: caseId },
    });
  }
  world = addFeed(world, { id: `law:${caseId}:cited`, kind: 'inspection', businessId: b.id, text: `${ROLE_LABEL[c.role]} cited ${b.name} for ${plural(found.length, 'violation')}` });
  return world;
}

function closeClean(w: WorldState, ctx: EngineCtx, c: Case, b: BusinessState): WorldState {
  let world = mapCase(w, c.id, (x) => ({ ...x, status: 'closed', outcome: 'clean', found: [], fine: 0, closedDay: w.day }));
  if (c.officialId) world = mapOfficial(world, c.officialId, (o) => ({ ...o, points: o.points + RULES.POINTS_EMPTY_INSPECTION, casesClosed: o.casesClosed + 1 }));
  world = addFeed(world, { id: `law:${c.id}:clean`, kind: 'inspection', businessId: b.id, text: `${ROLE_LABEL[c.role]} inspected ${b.name}: no violations` });
  world = addInbox(world, ownerPlayerIds(b), {
    id: `law:${c.id}:clean`, title: 'Inspection passed', text: `${ROLE_LABEL[c.role]} found no violations at ${b.name}.`, ref: { type: 'case', id: c.id },
  });
  const official = officialOf(world, c);
  if (official) {
    world = addInbox(world, [official.playerId], {
      id: `law:${c.id}:empty`, title: `Empty inspection: ${b.name}`, text: `No violations found. ${RULES.POINTS_EMPTY_INSPECTION} points.`, ref: { type: 'case', id: c.id },
    });
  }
  if (c.origin === 'report' && c.reporterBusinessId) world = falseReport(world, ctx, c, b);
  return world;
}

/** Ложная жалоба: первая — предупреждение; со второй — штраф, и цель узнаёт имя жалобщика. */
function falseReport(w: WorldState, ctx: EngineCtx, c: Case, target: BusinessState): WorldState {
  void ctx;
  const r = findBusiness(w, c.reporterBusinessId);
  if (!r) return w;
  const prior = w.cases.filter((x) => x.id !== c.id && x.origin === 'report' && x.reporterBusinessId === r.id
    && x.status === 'closed' && x.outcome === 'clean').length;
  if (prior === 0) {
    return addInbox(w, ownerPlayerIds(r), {
      id: `law:${c.id}:warning`, title: 'Warning: unfounded report',
      text: `${ROLE_LABEL[c.role]} found no violations at ${target.name}. Next unfounded report costs ${usd(RULES.FALSE_REPORT_FINE)}, and ${target.name} will learn it was you.`,
      ref: { type: 'case', id: c.id },
    });
  }
  let world = mapBusiness(w, r.id, (x) => charge(x, { id: `false_report:${c.id}`, label: 'Fine: false report to the city', kind: 'fine', amount: -RULES.FALSE_REPORT_FINE }));
  world = addInbox(world, ownerPlayerIds(r), {
    id: `law:${c.id}:false_fine`, title: `Fined ${usd(RULES.FALSE_REPORT_FINE)} for a false report`,
    text: `Your report about ${target.name} was unfounded again. ${target.name} now knows it was you.`, ref: { type: 'case', id: c.id },
  });
  world = addInbox(world, ownerPlayerIds(target), {
    id: `law:${c.id}:reveal`, title: `The report came from ${r.name}`,
    text: `${r.name} reported you to the city, and the inspection found nothing. They were fined ${usd(RULES.FALSE_REPORT_FINE)}.`,
    ref: { type: 'business', id: r.id },
  });
  return world;
}

/** Оплата штрафа (pay, contest или отказ во взятке): деньги, следы, закрытие, репутация, очки. */
export function settleFine(w: WorldState, ctx: EngineCtx, caseId: string, opts: { mult: number; response: Case['response']; contestFee?: boolean; reason?: string }): WorldState {
  const c = w.cases.find((x) => x.id === caseId);
  if (!c) return w;
  const b = findBusiness(w, c.businessId);
  if (!b) return dismiss(w, caseId);
  const found = c.found ?? [];
  const fine = money((c.fine ?? 0) * opts.mult);
  const foundIds = new Set(found.map((f) => f.violationId));
  const hit = found.reduce((s, f) => s + (findViolation(ctx, b.niche, f.violationId)?.reputationHit ?? 0), 0);
  const closureDays = c.closureDays ?? 0;
  let world = mapBusiness(w, b.id, (x) => {
    let y = x;
    if (opts.contestFee) y = charge(y, { id: `contest:${c.id}`, label: 'Lawyer: contest the notice', kind: 'other', amount: -RULES.CONTEST_FEE });
    if (fine > 0) y = charge(y, { id: `fine:${c.id}`, label: `Fine: ${violationNames(w, ctx, b, found)}`, kind: 'fine', amount: -fine });
    y = {
      ...y,
      reputation: clamp01(y.reputation - hit),
      trails: y.trails.map((t) => (foundIds.has(t.violationId) ? { ...t, months: 0, saved: 0, discovered: true } : t)),
    };
    if (closureDays > 0 && y.status !== 'bankrupt') y = { ...y, status: 'closed', closedUntilDay: Math.max(y.closedUntilDay ?? 0, w.day + closureDays) };
    return y;
  });
  world = mapCase(world, caseId, (x) => ({ ...x, status: 'closed', outcome: 'fined', fine, response: opts.response, closedDay: w.day }));
  const official = officialOf(world, c);
  if (official) {
    const points = RULES.POINTS_PER_VIOLATION * found.length;
    world = mapOfficial(world, official.id, (o) => ({ ...o, points: o.points + points, casesClosed: o.casesClosed + 1 }));
    world = addInbox(world, [official.playerId], {
      id: `law:${caseId}:closed`, title: `Case closed: ${b.name} fined ${usd(fine)}`, text: `+${points} points.`, ref: { type: 'case', id: caseId },
    });
  }
  world = addInbox(world, ownerPlayerIds(b), {
    id: `law:${caseId}:paid`, title: `Fine paid: ${usd(fine)}`,
    text: `${opts.reason ?? ''}${opts.contestFee ? `Contested: lawyer ${usd(RULES.CONTEST_FEE)}, fine cut to ${usd(fine)}. ` : ''}`
      + `${hit > 0 ? `Reputation -${Math.round(hit * 100)} points. ` : ''}${closureDays > 0 ? `Closed for ${plural(closureDays, 'day')}.` : ''}`.trim() || `Paid ${usd(fine)}.`,
    ref: { type: 'case', id: caseId },
  });
  world = addFeed(world, { id: `law:${caseId}:fined`, kind: 'inspection', businessId: b.id, text: `${ROLE_LABEL[c.role]} fined ${b.name} ${usd(fine)}` });
  if (closureDays > 0) {
    world = addFeed(world, { id: `law:${caseId}:closure`, kind: 'inspection', businessId: b.id, text: `${b.name} is closed for ${plural(closureDays, 'day')} by city order` });
  }
  return world;
}

export function dismiss(w: WorldState, caseId: string): WorldState {
  return mapCase(w, caseId, (x) => ({ ...x, status: 'closed', outcome: 'dismissed', closedDay: w.day }));
}

export function offerBribe(w: WorldState, caseId: string, amount: number): WorldState {
  const c = w.cases.find((x) => x.id === caseId);
  if (!c) return w;
  const b = findBusiness(w, c.businessId);
  const answerByDay = w.day + RULES.BRIBE_ANSWER_DAYS;
  let world = mapCase(w, caseId, (x) => ({ ...x, status: 'bribe_offered', response: 'bribe', bribeAmount: amount, answerByDay }));
  const official = officialOf(world, c);
  if (official) {
    world = addInbox(world, [official.playerId], {
      id: `law:${caseId}:offer`, title: `${b?.name ?? 'The owner'} offers ${usd(amount)}`,
      text: `Take it and the ${usd(c.fine ?? 0)} fine disappears. Internal Affairs checks whoever takes the most bribes each month. Answer by ${dateOf(answerByDay).label}.`,
      ref: { type: 'case', id: caseId },
    });
  }
  if (b) {
    world = addInbox(world, ownerPlayerIds(b), {
      id: `law:${caseId}:offer_sent`, title: `Offer sent: ${usd(amount)}`,
      text: `If the official refuses, the fine grows x${RULES.REFUSED_BRIBE_FINE_MULT}.`, ref: { type: 'case', id: caseId },
    });
  }
  return world;
}

export function acceptBribe(w: WorldState, caseId: string): WorldState {
  const c = w.cases.find((x) => x.id === caseId);
  if (!c) return w;
  const b = findBusiness(w, c.businessId);
  const official = officialOf(w, c);
  const amount = c.bribeAmount ?? 0;
  const violations = (c.found ?? []).length;
  let world = w;
  if (b) world = mapBusiness(world, b.id, (x) => charge(x, { id: `bribe:${caseId}`, label: 'Cash to the official', kind: 'other', amount: -amount }));
  if (official) {
    world = mapOfficial(world, official.id, (o) => ({
      ...o, bribesTaken: o.bribesTaken + amount, bribesThisMonth: o.bribesThisMonth + 1,
      points: o.points + RULES.POINTS_PER_BRIBE * violations, casesClosed: o.casesClosed + 1,
    }));
    world = addInbox(world, [official.playerId], {
      id: `law:${caseId}:took`, title: `You took ${usd(amount)} from ${b?.name ?? 'the owner'}`,
      text: `+${RULES.POINTS_PER_BRIBE * violations} points. Internal Affairs checks whoever takes the most bribes this month.`, ref: { type: 'case', id: caseId },
    });
  }
  world = mapCase(world, caseId, (x) => ({ ...x, status: 'closed', outcome: 'bribed', closedDay: w.day }));
  if (b) {
    world = addInbox(world, ownerPlayerIds(b), {
      id: `law:${caseId}:accepted`, title: 'Offer accepted', text: `No fine this time. The violations are still there, and Internal Affairs may come for both of you.`,
      ref: { type: 'case', id: caseId },
    });
  }
  return world;
}

export function refuseBribe(w: WorldState, ctx: EngineCtx, caseId: string): WorldState {
  const c = w.cases.find((x) => x.id === caseId);
  if (!c) return w;
  const b = findBusiness(w, c.businessId);
  let world = settleFine(w, ctx, caseId, { mult: RULES.REFUSED_BRIBE_FINE_MULT, response: 'bribe', reason: 'The official refused your offer. ' });
  const fine = world.cases.find((x) => x.id === caseId)?.fine ?? 0;
  if (b) world = addFeed(world, { id: `law:${caseId}:refused`, kind: 'bribe', businessId: b.id, text: `${ROLE_LABEL[c.role]} refused a bribe from ${b.name}; fine raised to ${usd(fine)}` });
  return world;
}
