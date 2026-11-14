// Модуль закона (агент 03): нарушения, жалобы, дела госслужащих, взятки.
// Контракт: build/CONTRACT.md, разделы 3 и 5. Чистые функции: без Date, Math.random, сети и файлов; вход не мутируется.
export type { EngineCtx } from './ctx';
export { lawActions } from './actions';
export { lawDay, suspiciousNumbers } from './day';
export { lawMonthClose } from './month';
export { shortcutSavings, exposureOf, fineFor, findViolations, savingsOf } from './trails';
export { noticesFor, queueFor, mineFor } from './views';
export { hintsFor } from './cases';
