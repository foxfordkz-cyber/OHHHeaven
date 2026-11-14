// Everything the screen sends goes through BizDeps.act / BizDeps.query. Builders here are pure.
import type { Ack, Action, CaseNotice, InboxItem, Money, Recommendation } from '../../../../shared/src/types';
import { RULES } from '../../../../shared/src/rules';

/** What the /biz screen needs from the app shell. The shell builds it from useView() and GameClient. */
export interface ActPort { act(a: Action): Promise<Ack> }

export interface ApplyResult { id: string; ok: boolean; error?: string }

/** "Apply" sends the recommendation's suggested action exactly as the engine wrote it. */
export async function applyRecommendation(port: ActPort, rec: Recommendation): Promise<ApplyResult> {
  if (!rec.suggested) return { id: rec.id, ok: false, error: 'Nothing to apply' };
  try {
    const ack = await port.act(rec.suggested);
    return { id: rec.id, ok: ack.ok, error: ack.error };
  } catch (e) {
    return { id: rec.id, ok: false, error: e instanceof Error ? e.message : 'Connection lost' };
  }
}

/** "Apply all": one after another, in the order shown; cards without a suggestion are skipped. */
export async function applyAll(port: ActPort, recs: Recommendation[]): Promise<ApplyResult[]> {
  const out: ApplyResult[] = [];
  for (const r of recs) if (r.suggested) out.push(await applyRecommendation(port, r));
  return out;
}

export const payAction = (n: CaseNotice): Action => ({ type: 'answer_notice', caseId: n.caseId, response: 'pay' });
export const contestAction = (n: CaseNotice): Action => ({ type: 'answer_notice', caseId: n.caseId, response: 'contest' });

/** A bribe needs a positive whole-dollar amount; anything else is refused before it leaves the screen. */
export function bribeAction(n: CaseNotice, amount: Money): Action | null {
  const a = Math.floor(amount);
  if (!Number.isFinite(a) || a <= 0) return null;
  return { type: 'answer_notice', caseId: n.caseId, response: 'bribe', bribeAmount: a };
}

/** Notices still waiting for the owner's answer. */
export const pendingNotices = (ns: CaseNotice[]): CaseNotice[] => ns.filter((n) => n.status === 'notice');

/** Contest terms come from the shared rules, not from the screen. */
export const CONTEST = { fee: RULES.CONTEST_FEE, fineCutPct: Math.round((1 - RULES.CONTEST_FINE_MULT) * 100) };
export const REFUSED_BRIBE_MULT = RULES.REFUSED_BRIBE_FINE_MULT;

export const readInbox = (items: InboxItem[]): Action | null => {
  const ids = items.filter((i) => !i.read).map((i) => i.id);
  return ids.length ? { type: 'read_inbox', ids } : null;
};

export const launchAction: Action = { type: 'launch' };
