// Модуль сделок (агент 13): сделки между игроками, фонд квартала, доли, места и призы.
// Сигнатуры — build/CONTRACT.md, разделы 3 и 4. Все функции чистые и не мутируют вход.
export type { EngineCtx } from './ctx';
export { dealActions, termsText, addOwner } from './actions';
export { dealModifiers, blockFundActive } from './modifiers';
export type { DealModifiers } from './modifiers';
export { dealsDay } from './day';
export { dealsMonthClose, monthProfit } from './month';
export { computeStandings, scoreOf } from './standings';
export { finalizeSeason, computePayouts, splitCents, prizeEligible, PLATFORM_ID } from './season';
export { dealPreview, monthBase } from './preview';
export { schedule as loanScheduleFor, outstanding as loanOutstanding, firstDueDay } from './loans';
export { checkDeal } from './validate';
