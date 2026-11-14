// Print-out of the real-world plan: one to two US Letter pages, nothing cut in half, only the plan on paper.
// A real cafe plan has about 25 setup lines, 25 monthly lines and 20 documents, so paper gets its own layout:
// the money tables side by side, documents and suppliers in two columns with only the first sentence of each text
// (.plan-more is the rest) and the link written out. Short blocks never break; the two long lists may continue on
// the next page, but only between whole items. Kept as a string so the plan always carries its own print rules
// and the tests can read them.
export const PLAN_PRINT_CSS = `
@media print {
  @page { size: letter; margin: 9mm 10mm; }
  :root { color-scheme: light !important; }
  html, body, #root { background: #fff !important; color: #111 !important; }
  .app { max-width: none !important; margin: 0 !important; padding: 0 !important; background: #fff !important; min-height: 0 !important; }
  .app > :not(.plan-root), .toaster, .bottom-nav, .no-print { display: none !important; }
  .plan-root { padding: 0 !important; gap: 0 !important; }

  .plan { display: block; color: #111; font-size: 8pt; line-height: 1.18; }
  .plan > * + * { margin-top: 5pt; }
  .plan-pair { display: flex; flex-direction: row; gap: 6pt; align-items: flex-start; }
  .plan-pair > .plan-block { flex: 1 1 0; min-width: 0; }
  .plan-block { break-inside: avoid; page-break-inside: avoid; background: #fff !important; border: 0.75pt solid #b9bec6 !important; border-radius: 4pt !important; box-shadow: none !important; padding: 5pt 7pt !important; }
  .plan-long { break-inside: auto; page-break-inside: auto; }
  .plan-row, .plan-step, .plan-supplier, .plan-lesson, .plan-table tr { break-inside: avoid; page-break-inside: avoid; }
  .plan h1, .plan h2, .plan h3, .plan-kicker { color: #111 !important; break-after: avoid; page-break-after: avoid; }
  .plan h1 { font-size: 13pt; margin: 0 0 1pt; }
  .plan h2, .plan .h3 { font-size: 9.5pt; margin: 0 0 3pt; }
  .plan .muted, .plan .faint, .plan .small, .plan .xsmall, .plan .eyebrow, .plan-step__meta, .plan-note, .plan-disclaimer { color: #333 !important; }
  .plan .small, .plan-table, .plan-suppliers, .plan-note { font-size: 7.5pt; }
  .plan-table { line-height: 1.1; }
  .plan-table td { padding: 0.3pt 0; border-color: #d5d8dd !important; }
  .plan-table td.num { padding-left: 6pt; }
  .plan-total td { border-color: #888 !important; padding-top: 2pt; }
  .plan-note { margin-top: 3pt; }
  .plan-grid { gap: 6pt; }
  .plan-grid > div { display: flex; align-items: baseline; gap: 5pt; flex-wrap: wrap; }
  .plan-big { font-size: 11pt; }
  .plan-more, .plan-examples { display: none; }
  .plan-steps, .plan-suppliers { display: block; columns: 2; column-gap: 12pt; padding: 0; list-style: none; }
  .plan-steps > li, .plan-suppliers > li { break-inside: avoid; page-break-inside: avoid; margin: 0 0 3.5pt; }
  .plan-step { gap: 0.5pt; }
  .plan-step__title { font-size: 8pt; }
  .plan-lessons { gap: 3pt; }
  .plan-loss { color: #b42318 !important; }
  .plan-num { background: #111 !important; color: #fff !important; width: 10pt; height: 10pt; font-size: 6.5pt; margin-right: 4pt; }
  .plan-step__meta, .plan-step > .small, .plan-step > .plan-link { padding-left: 0; margin-left: 14pt; }
  .plan-step__meta span + span::before { margin-right: 4pt; }
  .plan-step__meta { gap: 0 4pt; }
  .plan-link { color: #111 !important; text-decoration: none; }
  .plan-link__label { display: none; }
  .plan-link::after { content: attr(data-url); font-size: 6.5pt; color: #444; overflow-wrap: anywhere; }
  .plan .rule-card { background: #f4f5f7 !important; border: 0.75pt solid #c9cdd3 !important; color: #111 !important; padding: 3pt 5pt !important; box-shadow: none !important; }
  .plan .rule-card * { color: #111 !important; }
  .plan .rule-card__title { font-size: 8pt !important; }
  .plan .rule-card__text { font-size: 7.5pt !important; }
  .plan .rule-card { gap: 1.5pt !important; }
  .plan .rule-card__tag { font-size: 6.5pt !important; }
  .plan .rule-card__link { font-size: 7pt !important; }
  .plan .rule-card__link svg { display: none; }
  .plan svg { color: #333; }
}
`;
