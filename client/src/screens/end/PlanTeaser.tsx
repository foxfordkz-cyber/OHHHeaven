// The card that leads to the real-world plan from the end screen and the Insights tab: this player's own number and
// the next real-life step, so the reason to open the plan is visible before it is opened.
import { useNavigate } from 'react-router-dom';
import { Button, Card, Skeleton, useT } from '../../ui';
import { money } from '../insights/format';
import { usePlan, type AskFn } from './PlanScreen';
import { loadProgress, nextStep, personalOf, progressKey } from './personal';

export function PlanTeaser({ ask, href }: { ask: AskFn | null; href: string }) {
  const tr = useT();
  const navigate = useNavigate();
  const { plan, loading } = usePlan(ask);
  const me = plan ? personalOf(plan) : null;
  const done = plan ? new Set(loadProgress(progressKey(plan, me)).done) : new Set<string>();
  const next = plan ? nextStep(plan.checklist, done) : null;
  const subtitle = me
    ? tr(`You need ${money(me.summary.cashBeforeFirstSale)} before your first sale${me.place ? ` at ${me.place.address}` : ''}, ${me.summary.weeksToOpen} weeks from the lease, and ${money(me.summary.reserve)} in reserve.`,
      `До первой продажи нужно ${money(me.summary.cashBeforeFirstSale)}${me.place ? ` (${me.place.address})` : ''}, ${me.summary.weeksToOpen} нед. от аренды и ${money(me.summary.reserve)} в запасе.`)
    : tr('Budget, documents in order, suppliers and the lessons of your season. Take it with you.', 'Бюджет, документы по порядку, поставщики и уроки сезона. Заберите с собой.');
  return (
    <Card tone="accent" title={tr('Your real-world plan', 'Ваш план для жизни')} subtitle={subtitle}>
      <div className="stack-sm">
        {loading && <Skeleton height={16} width="70%" />}
        {plan && next && (
          <p className="small" style={{ margin: 0 }} data-testid="plan-teaser-next">
            <strong>{tr('Next in real life', 'Следующий шаг в жизни')}:</strong> {next.title}
            {next.fee != null ? ` · ${next.fee === 0 ? tr('free', 'бесплатно') : money(next.fee)}` : ''}
            {' '}<span className="faint">({plan.checklist.length - plan.checklist.filter((s) => !done.has(s.id)).length}/{plan.checklist.length} {tr('done', 'сделано')})</span>
          </p>
        )}
        <Button block icon="doc" onClick={() => navigate(href)}>{tr('Open my plan', 'Открыть мой план')}</Button>
      </div>
    </Card>
  );
}
