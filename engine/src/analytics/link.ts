// Единственная точка связи аналитики с чужими модулями. Когда настоящие модули появятся в основной ветке,
// поменять импорты здесь (и только здесь):
//   tickDay, netWorth  → '../index'         (агент 02; сейчас там заглушка агента 01, которая только двигает день)
//   dealModifiers      → '../deals'         (агент 13)
//   exposureOf         → '../law'           (агент 03)
// Крючок KPI ниши уже настоящий: реестр engine/src/niches (агент 01), ниши добавляют агенты 14–16.
import type { BusinessState, NicheKpi, Pack, PackSet, Place } from '../../../shared/src/types';
import { hooksFor } from '../niches';

export interface EngineCtx { packs: PackSet; places: Place[] }

export { tickDay, netWorth, dealModifiers, exposureOf } from './__stubs__/engine';

export function nicheKpisHook(b: BusinessState, pack: Pack): NicheKpi[] | null {
  return hooksFor(b.niche).kpis?.(b, pack) ?? null;
}
