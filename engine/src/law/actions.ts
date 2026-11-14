// Действия закона: report, answer_notice, take_case, dismiss_case, answer_bribe, spend(deep_clean|accountant).
import type { Action, ActionResult, BusinessState, WorldState } from '../../../shared/src/types';
import { RULES } from '../../../shared/src/rules';
import { LAW } from './constants';
import type { EngineCtx } from './ctx';
import { acceptBribe, cooldownOk, dismiss, isAvailable, offerBribe, openCase, refuseBribe, settleFine, takeCase } from './cases';
import {
  addFeed, addInbox, bump, businessOf, charge, findBusiness, findViolation, mapBusiness, money, officialOfPlayer, ownerPlayerIds,
  ownsBusiness, packOf, permitViolationIds, reportsFor, roleOfViolation, usd,
} from './util';

const fail = (w: WorldState, error: string): ActionResult => ({ world: w, error });
const ok = (w: WorldState): ActionResult => ({ world: bump(w) });

export function lawActions(w: WorldState, ctx: EngineCtx, playerId: string, a: Action): ActionResult | null {
  switch (a.type) {
    case 'report': return report(w, ctx, playerId, a.targetBusinessId, a.reportId);
    case 'answer_notice': return answerNotice(w, ctx, playerId, a.caseId, a.response, a.bribeAmount);
    case 'take_case': return take(w, playerId, a.caseId);
    case 'dismiss_case': return dismissCase(w, playerId, a.caseId);
    case 'answer_bribe': return answerBribe(w, ctx, playerId, a.caseId, a.accept);
    case 'spend':
      if (a.kind === 'deep_clean') return deepClean(w, ctx, playerId);
      if (a.kind === 'accountant') return accountant(w, ctx, playerId);
      return null;
    default: return null;
  }
}

function report(w: WorldState, ctx: EngineCtx, playerId: string, targetId: string, reportId: string): ActionResult {
  const me = businessOf(w, playerId);
  if (!me) return fail(w, 'You need a business to report a competitor');
  const target = findBusiness(w, targetId);
  if (!target) return fail(w, 'Business not found');
  if (target.id === me.id || ownsBusiness(target, playerId)) return fail(w, 'You cannot report your own business');
  if (target.status === 'closed' || target.status === 'bankrupt') return fail(w, 'This business is closed');
  if (target.status === 'setup') return fail(w, 'This business has not opened yet');
  const tpl = reportsFor(ctx, target.niche).find((r) => r.id === reportId);
  if (!tpl) return fail(w, 'Unknown report type');
  const recent = w.cases.filter((c) => c.origin === 'report' && c.reporterBusinessId === me.id && w.day - c.openedDay < 7).length;
  if (recent >= RULES.REPORTS_PER_WEEK) return fail(w, `You can file ${RULES.REPORTS_PER_WEEK} report per week`);
  const { world, caseId } = openCase(w, { businessId: target.id, role: tpl.role, origin: 'report', reportId: tpl.id, reporterBusinessId: me.id, lead: [`Complaint: ${tpl.name}`] });
  let next = addInbox(world, ownerPlayerIds(me), {
    id: `law:${caseId}:filed`, title: `Report filed: ${target.name}`,
    text: `${tpl.text} Your name stays hidden unless the report turns out false twice.`, ref: { type: 'case', id: caseId },
  });
  next = addFeed(next, { id: `law:${caseId}:report`, kind: 'report', businessId: target.id, text: `Someone reported ${target.name} to the city` });
  return ok(next);
}

function answerNotice(w: WorldState, ctx: EngineCtx, playerId: string, caseId: string, response: 'pay' | 'contest' | 'bribe', bribeAmount?: number): ActionResult {
  const c = w.cases.find((x) => x.id === caseId);
  if (!c) return fail(w, 'Case not found');
  const b = findBusiness(w, c.businessId);
  if (!b || !ownsBusiness(b, playerId)) return fail(w, 'Not your business');
  if (c.status !== 'notice') return fail(w, 'This notice is not waiting for an answer');
  if (c.answerByDay !== undefined && w.day > c.answerByDay) return fail(w, 'Too late to answer');
  if (response === 'pay') return ok(settleFine(w, ctx, caseId, { mult: 1, response: 'pay' }));
  if (response === 'contest') return ok(settleFine(w, ctx, caseId, { mult: RULES.CONTEST_FINE_MULT, response: 'contest', contestFee: true }));
  const amount = money(bribeAmount ?? 0);
  if (!(amount > 0)) return fail(w, 'Offer an amount');
  if (amount > b.cash) return fail(w, 'Not enough cash');
  return ok(offerBribe(w, caseId, amount));
}

function take(w: WorldState, playerId: string, caseId: string): ActionResult {
  const o = officialOfPlayer(w, playerId);
  if (!o) return fail(w, 'Only officials can take cases');
  if (!isAvailable(o, w.day)) return fail(w, o.exposed ? 'You were exposed by Internal Affairs' : 'You are suspended');
  const c = w.cases.find((x) => x.id === caseId);
  if (!c) return fail(w, 'Case not found');
  if (c.status !== 'open') return fail(w, 'Case is already taken');
  if (c.role !== o.role) return fail(w, 'This case needs another kind of official');
  if (!cooldownOk(w, o.id, c.businessId, c.id)) return fail(w, `You inspected this business less than ${RULES.SAME_TARGET_COOLDOWN_DAYS} days ago`);
  return ok(takeCase(w, caseId, o));
}

function dismissCase(w: WorldState, playerId: string, caseId: string): ActionResult {
  const o = officialOfPlayer(w, playerId);
  if (!o) return fail(w, 'Only officials can dismiss cases');
  const c = w.cases.find((x) => x.id === caseId);
  if (!c) return fail(w, 'Case not found');
  if (c.role !== o.role) return fail(w, 'This case needs another kind of official');
  const mine = c.status === 'taken' && c.officialId === o.id;
  if (c.status !== 'open' && !mine) return fail(w, 'You can dismiss only open cases or your own case before the inspection');
  return ok(dismiss(w, caseId));
}

function answerBribe(w: WorldState, ctx: EngineCtx, playerId: string, caseId: string, accept: boolean): ActionResult {
  const o = officialOfPlayer(w, playerId);
  if (!o) return fail(w, 'Only officials can answer offers');
  const c = w.cases.find((x) => x.id === caseId);
  if (!c || c.officialId !== o.id) return fail(w, 'Not your case');
  if (c.status !== 'bribe_offered') return fail(w, 'No offer on this case');
  return ok(accept ? acceptBribe(w, caseId) : refuseBribe(w, ctx, caseId));
}

/** Санитарные следы: нарушения инспектора, кроме работы без разрешения. */
function isSanitary(ctx: EngineCtx, b: BusinessState, violationId: string): boolean {
  const v = findViolation(ctx, b.niche, violationId);
  return !!v && roleOfViolation(ctx, b.niche, v) === 'inspector' && !permitViolationIds(ctx, b.niche).has(violationId);
}

function deepClean(w: WorldState, ctx: EngineCtx, playerId: string): ActionResult {
  const b = businessOf(w, playerId);
  if (!b) return fail(w, 'You have no business');
  const perMonth = (packOf(ctx, b.niche)?.sizing.cleaningCostPerSizeMonth ?? 0) * b.size;
  const cost = Math.max(LAW.DEEP_CLEAN_MIN_COST, money(perMonth * LAW.DEEP_CLEAN_MONTHS));
  const cleared = b.trails.filter((t) => isSanitary(ctx, b, t.violationId)).length;
  let world = mapBusiness(w, b.id, (x) => ({
    ...charge(x, { id: `deep_clean:${w.day}`, label: 'Deep clean', kind: 'opex', amount: -cost }),
    trails: x.trails.filter((t) => !isSanitary(ctx, x, t.violationId)),
  }));
  world = addInbox(world, ownerPlayerIds(b), {
    id: `law:deep_clean:${b.id}:${w.day}`, kind: 'money', title: `Deep clean done: ${usd(cost)}`,
    text: cleared > 0 ? `Cleared ${cleared} sanitary issue${cleared === 1 ? '' : 's'}. Keep cleaning, or they come back.` : 'The place was already clean.',
  });
  return ok(world);
}

function accountant(w: WorldState, ctx: EngineCtx, playerId: string): ActionResult {
  const b = businessOf(w, playerId);
  if (!b) return fail(w, 'You have no business');
  const tax = b.trails
    .filter((t) => { const v = findViolation(ctx, b.niche, t.violationId); return !!v && roleOfViolation(ctx, b.niche, v) === 'tax_auditor' && t.months > 0; })
    .sort((x, y) => y.saved - x.saved)[0];
  if (!tax) return fail(w, 'No tax issues to fix');
  const v = findViolation(ctx, b.niche, tax.violationId);
  let world = mapBusiness(w, b.id, (x) => {
    let y = charge(x, { id: `back_taxes:${w.day}:${tax.violationId}`, label: `Back taxes: ${v?.name ?? tax.violationId}`, kind: 'tax', amount: -tax.saved });
    y = charge(y, { id: `accountant:${w.day}`, label: 'Accountant: voluntary disclosure', kind: 'other', amount: -LAW.ACCOUNTANT_FEE });
    return { ...y, trails: y.trails.filter((t) => t.violationId !== tax.violationId) };
  });
  world = addInbox(world, ownerPlayerIds(b), {
    id: `law:accountant:${b.id}:${w.day}`, kind: 'money', title: `Back taxes paid: ${usd(tax.saved)}`,
    text: `Your accountant filed the missing ${v?.name ?? 'taxes'} with no penalty. Fee ${usd(LAW.ACCOUNTANT_FEE)}.`,
  });
  return ok(world);
}
