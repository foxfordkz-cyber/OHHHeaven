import type { PackRuleCard } from '../../../../shared/src/types';
import { Button, Card, Sheet } from './__stubs__/ui';
import { fineRule, ruleCardById, violationById, whoCatches, type Packs } from './lookup';

/** "Real rule" card shown once, the first time the player meets a rule. */
export function RealRuleCard({ card, onDone }: { card: PackRuleCard; onDone(): void }) {
  return (
    <Card tone="info" title={<>Real rule · {card.title}</>} aside="New York, 2026">
      <p>{card.text}</p>
      <div className="bz-between">
        <span className="bz-small bz-muted">Source: {card.source}</span>
        <Button onClick={onDone}>Got it</Button>
      </div>
    </Card>
  );
}

/** Sheet with the law and the punishment behind a violation (or a plain rule card). */
export function RuleSheet({ id, packs, onClose }: { id: string | null; packs: Packs; onClose(): void }) {
  if (!id) return null;
  const v = violationById(packs, id);
  const card = ruleCardById(packs, id);
  const title = v?.name ?? card?.title ?? 'Rule';
  return (
    <Sheet open onClose={onClose} title={title}>
      {v && (
        <div className="bz-list">
          <div className="bz-li"><span className="bz-muted">Law</span><b>{v.law}</b></div>
          <div className="bz-li"><span className="bz-muted">Who can catch it</span><span>{whoCatches(packs, v)}</span></div>
          <div className="bz-li"><span className="bz-muted">Fine</span><span>{fineRule(v)}</span></div>
          {v.closureDays ? <div className="bz-li"><span className="bz-muted">Closure</span><span>Up to {v.closureDays} days closed</span></div> : null}
          {v.criminal && <div className="bz-li"><span className="bz-muted">In real life</span><span className="bz-bad-text">{v.criminal}</span></div>}
        </div>
      )}
      {card && <p>{card.text}</p>}
      {card && <p className="bz-small bz-muted">Source: {card.source}</p>}
      {!v && !card && <p className="bz-muted">No details for this rule yet.</p>}
    </Sheet>
  );
}
