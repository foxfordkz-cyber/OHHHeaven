// Единственная точка связи аналитики с чужими модулями. Когда настоящие модули появятся в основной ветке,
// поменять импорты здесь (и только здесь):
//   tickDay, netWorth  → '../index'         (агент 02)
//   dealModifiers      → '../deals'         (агент 13)
//   exposureOf         → '../law'           (агент 03)
//   nicheKpisHook      → крючок kpis из '../niches' (агенты 01 и 14)
import type { PackSet, Place } from '../../../shared/src/types';

export interface EngineCtx { packs: PackSet; places: Place[] }

export { tickDay, netWorth, dealModifiers, exposureOf, nicheKpisHook } from './__stubs__/engine';
