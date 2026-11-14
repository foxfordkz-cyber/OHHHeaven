// EngineCtx по build/CONTRACT.md, раздел 3. Когда агент 02 выложит engine/src/index.ts, импорт переедет туда.
import type { PackSet, Place } from '../../../shared/src/types';

export interface EngineCtx { packs: PackSet; places: Place[] }
