// @ohh/ai — CONTRACT §8. Pure parts (forecast, deckEvent) also live in '@ohh/ai/pure' for the browser.
export { forecast, weatherOn, normalHighF, FOOT_TRAFFIC_MULT } from './weather';
export { deckEvent, DECK, themeOfEvent } from './events/deck';
export { planEvents, validatePlan, checkPlanned } from './events/plan';
export { THEMES } from './events/themes';
export { askAdvisor } from './advisor';
export { interpretIdea } from './idea';
export { writeDebrief } from './debrief';
export { aiConfig, aiLog, resetAi, setProvider, mockProvider, DEFAULT_MODEL } from './provider';
export type { AiProvider, AiRequest, AiLogEntry } from './provider';
