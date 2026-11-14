// Print-out of the real-world plan: one to two US Letter pages, no block cut in half, only the plan on paper.
// Kept as a string so the plan always carries its own print rules and the tests can read them.
export const PLAN_PRINT_CSS = `
@media print {
  @page { size: letter; margin: 11mm 12mm; }
  :root { color-scheme: light !important; }
  html, body, #root { background: #fff !important; color: #111 !important; }
  .app { max-width: none !important; margin: 0 !important; padding: 0 !important; background: #fff !important; min-height: 0 !important; }
  .app > :not(.plan-root), .toaster, .bottom-nav, .no-print { display: none !important; }
  .plan-root { padding: 0 !important; gap: 0 !important; }

  .plan { display: grid; grid-template-columns: 1fr 1fr; gap: 6pt 8pt; color: #111; font-size: 9pt; line-height: 1.3; }
  .plan > * { grid-column: 1 / -1; }
  .plan > .plan-half { grid-column: auto; }
  .plan-block { break-inside: avoid; page-break-inside: avoid; background: #fff !important; border: 0.75pt solid #b9bec6 !important; border-radius: 4pt !important; box-shadow: none !important; padding: 6pt 8pt !important; }
  .plan-row, .plan-step, .plan-lesson, .plan-table tr { break-inside: avoid; page-break-inside: avoid; }
  .plan h1, .plan h2, .plan h3, .plan-kicker { color: #111 !important; break-after: avoid; page-break-after: avoid; }
  .plan h1 { font-size: 17pt; margin: 0 0 2pt; }
  .plan h2, .plan .h3 { font-size: 10.5pt; margin: 0 0 3pt; }
  .plan .muted, .plan .faint, .plan .small, .plan .xsmall, .plan .eyebrow, .plan-step__meta, .plan-note, .plan-disclaimer { color: #333 !important; }
  .plan .small { font-size: 8.5pt; }
  .plan-table { font-size: 8.5pt; }
  .plan-table td { padding: 1.5pt 0; border-color: #d5d8dd !important; }
  .plan-total td { border-color: #888 !important; }
  .plan-big { font-size: 14pt; }
  .plan-steps, .plan-lessons { gap: 4pt; }
  .plan-suppliers { gap: 2pt; font-size: 8.5pt; }
  .plan-loss { color: #b42318 !important; }
  .plan-num { background: #111 !important; color: #fff !important; width: 13pt; height: 13pt; font-size: 7.5pt; margin-right: 5pt; }
  .plan-step__meta, .plan-step > .small, .plan-step > .plan-link { padding-left: 0; margin-left: 18pt; }
  .plan-link { color: #111 !important; text-decoration: none; }
  .plan-link svg { display: none; }
  .plan-link::after { content: ' ' attr(data-url); font-size: 7.5pt; color: #444; word-break: break-all; }
  .plan .rule-card { background: #f4f5f7 !important; border: 0.75pt solid #c9cdd3 !important; color: #111 !important; padding: 4pt 6pt !important; box-shadow: none !important; }
  .plan .rule-card * { color: #111 !important; }
  .plan .rule-card__title { font-size: 9pt !important; }
  .plan .rule-card__text { font-size: 8.5pt !important; }
  .plan svg { color: #333; }
}
`;
