// Агент 04 — аналитика, советы, план открытия, личный план. Ничего не меняет в мире.
// Сигнатуры — build/CONTRACT.md, раздел 3. Чужие модули подключены только через ./link.ts.
export type { EngineCtx } from './link';
export { analyze } from './analyze';
export { whatIf } from './whatif';
export { recommend, RULE_IDS } from './recommend';
export { recommendOpening } from './opening';
export { roadmapFor } from './roadmap';
export { realWorldPlan, DISCLAIMER } from './plan';
export { managerOrders } from './manager';
export { GLOSSARY } from './glossary';
