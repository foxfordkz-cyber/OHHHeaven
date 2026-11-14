// lawMonthClose: давность следов, плановые проверки, внутренние расследования.
import type { Case, OfficialState, WorldState } from '../../../shared/src/types';
import { RULES } from '../../../shared/src/rules';
import { LAW } from './constants';
import type { EngineCtx } from './ctx';
import { hasActiveCase, openCase } from './cases';
import { fineFor, trailExpired } from './trails';
import {
  ROLE_LABEL, addFeed, addInbox, charge, clamp01, findBusiness, lastInspectionDay, mapBusiness, mapOfficial, money, monthEndDay,
  monthOfDay, monthStartDay, ownerPlayerIds, usd,
} from './util';

export function lawMonthClose(w: WorldState, ctx: EngineCtx): WorldState {
  const month = monthOfDay(w.day);
  let world: WorldState = {
    ...w,
    businesses: w.businesses.map((b) => {
      const trails = b.trails.filter((t) => !trailExpired(t, month));
      return trails.length === b.trails.length ? b : { ...b, trails };
    }),
  };
  world = routineInspections(world);
  world = internalAffairs(world, ctx, month);
  world = { ...world, officials: world.officials.map((o) => (o.bribesThisMonth === 0 ? o : { ...o, bribesThisMonth: 0 })) };
  return world;
}

/** Плановая проверка инспектора раз в ROUTINE_INSPECTION_EVERY_MONTHS; если она сорвалась — флаг «проверка просрочена». */
function routineInspections(w: WorldState): WorldState {
  let world = w;
  for (const b of w.businesses) {
    if ((b.status !== 'open' && b.status !== 'closed') || b.openedDay === undefined) continue;
    const since = lastInspectionDay(world, b.id, 'inspector') ?? b.openedDay;
    const months = Math.floor((world.day - since + 1) / RULES.DAYS_PER_MONTH);
    if (months < RULES.ROUTINE_INSPECTION_EVERY_MONTHS || hasActiveCase(world, b.id, 'inspector')) continue;
    const overdue = months > RULES.ROUTINE_INSPECTION_EVERY_MONTHS;
    world = openCase(world, {
      businessId: b.id, role: 'inspector', origin: overdue ? 'flag' : 'routine', lead: [overdue ? 'Inspection overdue' : 'Routine inspection'],
    }).world;
  }
  return world;
}

function bribedCases(w: WorldState, o: OfficialState, month: number): Case[] {
  const from = monthStartDay(month);
  const to = monthEndDay(month);
  return w.cases.filter((c) => c.outcome === 'bribed' && c.officialId === o.id && c.closedDay !== undefined && c.closedDay >= from && c.closedDay <= to);
}

/** Служба внутренних расследований: разоблачает того, кто взял больше всех взяток за месяц. */
function internalAffairs(w: WorldState, ctx: EngineCtx, month: number): WorldState {
  const candidates = w.officials.filter((o) => o.bribesThisMonth > 0);
  if (candidates.length === 0) return w;
  const total = (o: OfficialState) => bribedCases(w, o, month).reduce((s, c) => s + (c.bribeAmount ?? 0), 0);
  const top = candidates.reduce((best, o) => (o.bribesThisMonth > best.bribesThisMonth
    || (o.bribesThisMonth === best.bribesThisMonth && total(o) > total(best)) ? o : best));
  const bribes = bribedCases(w, top, month);
  let world = mapOfficial(w, top.id, (o) => ({ ...o, points: 0, exposed: true, suspendedUntilDay: w.day + RULES.DAYS_PER_MONTH }));
  world = {
    ...world,
    cases: world.cases.map((c) => {
      if (c.officialId !== top.id || c.status !== 'taken') return c;
      const { officialId: _o, takenDay: _t, inspectDay: _i, ...rest } = c;
      void _o; void _t; void _i;
      return { ...rest, status: 'open' } as Case;
    }),
  };
  world = addFeed(world, {
    id: `law:ia:${top.id}:${month}`, kind: 'bribe',
    text: `Internal Affairs exposed ${top.name}, ${ROLE_LABEL[top.role].toLowerCase()}: ${top.bribesThisMonth} bribe${top.bribesThisMonth === 1 ? '' : 's'} this month`,
  });
  world = addInbox(world, [top.playerId], {
    id: `law:ia:${top.id}:${month}`, title: 'Exposed by Internal Affairs', kind: 'system',
    text: `You took the most bribes this month. All your points are gone, and you get no cases for ${RULES.DAYS_PER_MONTH} days.`,
  });
  const v = (ctx.packs.common.violations ?? []).find((x) => x.id === 'bribery') ?? (ctx.packs.common.violations ?? []).find((x) => x.id.includes('brib'));
  for (const c of bribes) {
    const b = findBusiness(world, c.businessId);
    if (!b || b.status === 'bankrupt') continue;
    const amount = c.bribeAmount ?? 0;
    const fine = v ? fineFor(v, 1, amount) : money(amount * LAW.BRIBERY_FALLBACK_MULT);
    world = mapBusiness(world, b.id, (x) => ({
      ...charge(x, { id: `bribery:${c.id}`, label: `Fine: ${v?.name ?? 'Bribing a public servant'}`, kind: 'fine', amount: -fine }),
      reputation: clamp01(x.reputation - (v?.reputationHit ?? 0.1)),
    }));
    world = addInbox(world, ownerPlayerIds(b), {
      id: `law:bribery:${c.id}`, title: `Fined ${usd(fine)} for bribery`,
      text: `Internal Affairs exposed the official you paid.${v?.law ? ` Law: ${v.law}.` : ''}`, ref: { type: 'case', id: c.id },
    });
    world = addFeed(world, { id: `law:bribery:${c.id}`, kind: 'bribe', businessId: b.id, text: `${b.name} fined ${usd(fine)} for bribing an official` });
  }
  return world;
}
