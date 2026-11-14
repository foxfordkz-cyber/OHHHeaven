// roadmapFor: план открытия как в жизни — общие шаги из _common.roadmap и шаги ниши по порядку
// (идея → регистрация → помещение → разрешения → деньги → поставщики → люди → открытие) со статусом.
import type { BusinessState, NicheId, PackRoadmapStep, RoadmapItem, RoadmapKind, WorldState } from '../../../shared/src/types';
import type { EngineCtx } from './link';
import { packOf, staffCount } from './model';

export const KIND_ORDER: RoadmapKind[] = ['idea', 'legal', 'space', 'permit', 'money', 'supplier', 'people', 'launch'];

export function orderedSteps(ctx: EngineCtx, niche: NicheId): PackRoadmapStep[] {
  const steps = [...ctx.packs.common.roadmap, ...packOf(ctx, niche).roadmap];
  return steps.map((s, i) => ({ s, i })).sort((a, b) => KIND_ORDER.indexOf(a.s.kind) - KIND_ORDER.indexOf(b.s.kind) || a.i - b.i).map((x) => x.s);
}

function statusOf(step: PackRoadmapStep, b: BusinessState | null, w: WorldState, ctx: EngineCtx, niche: NicheId): Pick<RoadmapItem, 'status' | 'readyDay'> {
  if (!b) return { status: 'todo' };
  if (step.setupItemId) {
    const permit = b.permits.find((p) => p.itemId === step.setupItemId);
    if (permit) return permit.readyDay > w.day ? { status: 'waiting', readyDay: permit.readyDay } : { status: 'done' };
    return b.items.some((i) => i.id === step.setupItemId) ? { status: 'done' } : { status: 'todo' };
  }
  const opened = b.status === 'open' || b.status === 'closed' || b.openedDay != null;
  switch (step.kind) {
    case 'people': return staffCount(b.orders) >= packOf(ctx, niche).capacity.minStaff ? { status: 'done' } : { status: 'todo' };
    case 'launch': return opened ? { status: 'done' } : { status: 'todo' };
    default: return { status: 'done' };   // идея, регистрация, помещение, деньги, поставщики: бизнес уже заведён
  }
}

export function roadmapFor(niche: NicheId, b: BusinessState | null, w: WorldState, ctx: EngineCtx): RoadmapItem[] {
  return orderedSteps(ctx, niche).map((step) => ({ ...step, ...statusOf(step, b, w, ctx, niche) }));
}
