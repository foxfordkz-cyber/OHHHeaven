// Single import point for the shared contract (build/CONTRACT.md). Swap to '@ohh/shared' when agent 01's workspace lands.
export * from '../../shared/src/types';
export { RULES, dateOf, isMonthEnd } from '../../shared/src/rules';
import type { PackSet, Place } from '../../shared/src/types';

/** Same shape as EngineCtx in engine/src/index.ts (agent 02). Declared here until the engine package exists. */
export interface EngineCtx { packs: PackSet; places: Place[] }
