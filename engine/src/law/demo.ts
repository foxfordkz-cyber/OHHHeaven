// Демо модуля закона: история одного нарушителя. Запуск: npx tsx engine/src/law/demo.ts
// Данные — примеры из engine/test/fixtures (пока нет packs/cafe.json и packs/_common.json), экономика — заглушка.
import type { WorldState } from '../../../shared/src/types';
import { dateOf } from '../../../shared/src/rules';
import { lawCtx, lawWorld, orders } from '../../test/fixtures/law-world';
import { runDays } from './__stubs__/economy';
import { exposureOf, lawActions, noticesFor, queueFor } from './index';
import { usd } from './util';

const ctx = lawCtx;
const luna = (w: WorldState) => w.businesses.find((b) => b.id === 'luna')!;
const sayOn = (day: number, text: string) => console.log(`${dateOf(Math.max(1, day)).label.padEnd(12)} ${text}`);
const say = (w: WorldState, text: string) => sayOn(w.day, text);
function act(w: WorldState, playerId: string, a: Parameters<typeof lawActions>[3]): WorldState {
  const r = lawActions(w, ctx, playerId, a);
  if (!r || r.error) throw new Error(r?.error ?? 'ignored');
  return r.world;
}

let w = lawWorld({ day: 0, luna: { orders: orders({ shortcuts: ['cash_wages'], levers: { cleaning: 'minimal' } }) } });
console.log('Luna Cafe (owner Maya) pays 4 baristas in cash and cuts cleaning to "wipe and go".\n');

console.log('1. Trails');
for (let m = 1; m <= 6; m++) {
  w = runDays(w, ctx, 30);
  const b = luna(w);
  const kept = b.history.at(-1)!.lines.filter((l) => l.kind === 'saving').reduce((s, l) => s + l.amount, 0);
  const trail = b.trails.map((t) => `${t.violationId} ${t.months} mo, saved ${usd(t.saved)}`).join('; ');
  say(w, `kept ${usd(kept)} this month | ${trail} | exposure ${usd(exposureOf(b, ctx))}`);
}
const routine = w.cases.find((c) => c.businessId === 'luna' && c.origin === 'routine');
if (routine) say(w, `routine health inspection opened (${routine.id})`);

console.log('\n2. Report');
w = runDays(w, ctx, 1);
w = act(w, 'pl_rival', { type: 'report', targetBusinessId: 'luna', reportId: 'report_cash_payroll' });
const caseId = w.cases.at(-1)!.id;
say(w, `Rival Roasters files "Report off-the-books payroll" -> ${caseId}`);
say(w, `feed: ${w.feed.at(-1)!.text}`);

console.log('\n3. Case');
const card = queueFor(w, ctx, 'of_aud').find((c) => c.caseId === caseId)!;
say(w, `auditor queue card: ${card.business.name} | hints: ${card.hints.join(' / ')}`);
for (let i = 0; i < 6 && w.cases.find((c) => c.id === caseId)!.status !== 'notice'; i++) {
  w = runDays(w, ctx, 1);
  const c = w.cases.find((x) => x.id === caseId)!;
  if (c.status === 'taken' && c.takenDay === w.day) say(w, `nobody took it for 3 days -> ${w.officials.find((o) => o.id === c.officialId)!.name} takes it`);
}

console.log('\n4. Notice');
const notice = noticesFor(w, 'luna').find((n) => n.caseId === caseId)!;
say(w, `found: ${notice.found.map((f) => `${f.violationId} (${f.months} mo) ${usd(f.fine)}`).join(', ')}`);
say(w, `fine ${usd(notice.fine)}, answer by ${dateOf(notice.answerByDay).label}`);
say(w, `Maya's inbox: ${w.players.find((p) => p.id === 'pl_luna')!.inbox.at(-1)!.text}`);

console.log('\n5. Outcome');
w = act(w, 'pl_luna', { type: 'answer_notice', caseId, response: 'bribe', bribeAmount: 3000 });
say(w, 'Maya offers the auditor $3,000');
for (let i = 0; i < 5 && w.cases.find((c) => c.id === caseId)!.status !== 'closed'; i++) w = runDays(w, ctx, 1);
const closed = w.cases.find((c) => c.id === caseId)!;
say(w, `the AI auditor never answers: offer refused, fine x1.5 -> ${closed.outcome} ${usd(closed.fine ?? 0)}`);
for (const f of w.feed.filter((x) => x.businessId === 'luna' && x.day >= closed.takenDay!)) sayOn(f.day, `feed: ${f.text}`);
const saved = 6 * 1176;
console.log(`\nCash wages kept ${usd(saved)} over six months; the city took ${usd(closed.fine ?? 0)}. Net: ${usd(saved - (closed.fine ?? 0))}.`);
