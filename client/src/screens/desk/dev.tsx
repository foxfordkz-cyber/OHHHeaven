// /dev/desk pages: the official's desk on example data, no server. Taking a case and answering an offer move the
// example to its next state. A stand-in for the engine, only for trying the screen by hand.
import type { Action, ClientView, OfficialView } from '../../../../shared/src/types';
import { DevStore } from '../../app/dev';
import { DeskScreen } from './DeskScreen';
import { officialView, officialViewEmpty, officialViewExposed, packs } from './fixtures';
import { bribeFacts, type CaseCardMaybe } from './logic';

export function simulateDesk(a: Action, current: ClientView): ClientView | void {
  if (current.kind !== 'official') return;
  const v: OfficialView = current;
  const bump = (next: OfficialView): OfficialView => ({ ...next, world: { ...next.world, version: next.world.version + 1 } });
  if (a.type === 'take_case') {
    const c = v.queue.find((x) => x.caseId === a.caseId);
    if (!c) return;
    return bump({ ...v, queue: v.queue.filter((x) => x.caseId !== a.caseId), mine: [{ ...c, status: 'taken' }, ...v.mine] });
  }
  if (a.type === 'answer_bribe') {
    const c = v.mine.find((x) => x.caseId === a.caseId) as CaseCardMaybe | undefined;
    if (!c) return;
    const f = bribeFacts(c);
    const closed: CaseCardMaybe = a.accept
      ? { ...c, status: 'closed', outcome: 'bribed' }
      : { ...c, status: 'closed', outcome: 'fined', fine: f.fineIfRefused };
    const o = v.official;
    const official = a.accept
      ? { ...o, points: o.points + f.pointsIfTaken, bribesTaken: o.bribesTaken + f.amount, bribesThisMonth: o.bribesThisMonth + 1, casesClosed: o.casesClosed + 1 }
      : { ...o, points: o.points + f.pointsIfRefused, casesClosed: o.casesClosed + 1 };
    const ranking = v.ranking.map((r) => (!r.isAi && r.name === o.name ? { ...r, points: official.points } : r));
    return bump({ ...v, official, ranking, mine: v.mine.map((x) => (x.caseId === c.caseId ? closed : x)) });
  }
  return;
}

function Page({ view }: { view: OfficialView }) {
  return (
    <DevStore view={view} onAct={simulateDesk}>
      <DeskScreen packs={packs} />
    </DevStore>
  );
}

export const DevDesk = () => <Page view={officialView} />;
export const DevDeskEmpty = () => <Page view={officialViewEmpty} />;
export const DevDeskExposed = () => <Page view={officialViewExposed} />;
