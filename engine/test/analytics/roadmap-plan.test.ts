import { describe, expect, it } from 'vitest';
import type { WorldState } from '../../../shared/src/types';
import { GLOSSARY, analyze, realWorldPlan, roadmapFor } from '../../src/analytics';
import { KIND_ORDER } from '../../src/analytics/roadmap';
import { makeBusiness, makeWorld } from '../../src/analytics/__stubs__/fixtures';
import { ctx, run } from './helpers';

describe('roadmapFor', () => {
  it('lists common and niche steps in real-life order, all todo before opening', () => {
    const steps = roadmapFor('cafe', null, makeWorld([], 1), ctx);
    expect(steps.length).toBe(ctx.packs.common.roadmap.length + ctx.packs.niches.cafe!.roadmap.length);
    const order = steps.map((s) => KIND_ORDER.indexOf(s.kind));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(steps.every((s) => s.status === 'todo')).toBe(true);
  });

  it('shows waiting permits with their ready day and done steps after opening', () => {
    const setup = makeBusiness({ id: 's', placeId: 'p_graham_102', status: 'setup', day: 5 });
    setup.permits = setup.permits.map((p) => (p.itemId === 'fse_permit' ? { ...p, appliedDay: 5, readyDay: 26 } : p));
    const w = makeWorld([setup], 5);
    const fse = roadmapFor('cafe', setup, w, ctx).find((s) => s.setupItemId === 'fse_permit')!;
    expect(fse.status).toBe('waiting');
    expect(fse.readyDay).toBe(26);
    expect(roadmapFor('cafe', setup, w, ctx).find((s) => s.kind === 'launch')!.status).toBe('todo');
    const open = makeBusiness({ id: 'o', placeId: 'p_graham_102' });
    expect(roadmapFor('cafe', open, makeWorld([open], 30), ctx).every((s) => s.status === 'done')).toBe(true);
  });
});

describe('realWorldPlan', () => {
  const w: WorldState = run(makeWorld([makeBusiness({ id: 'p', placeId: 'p_bedford_212', size: 10, orders: { shortcuts: ['cash_wages'] } })]), 65);
  const b = w.businesses[0];
  const plan = realWorldPlan(b, w, ctx);

  it('adds up', () => {
    expect(plan.startupTotal).toBeCloseTo(plan.startupBudget.reduce((s, l) => s + l.amount, 0), 2);
    expect(plan.startupTotal).toBeCloseTo(b.setupSpent, 2);
    expect(plan.monthlyTotal).toBeCloseTo(plan.monthlyCosts.reduce((s, l) => s + l.amount, 0), 2);
    expect(plan.monthlyCosts.length).toBeGreaterThan(5);
  });

  it('advises six months of honest fixed costs as a reserve', () => {
    const honest = analyze({ ...b, orders: { ...b.orders, shortcuts: [] } }, w, ctx).fixedCostsMonth;
    expect(plan.reserveAdvised).toBeCloseTo(6 * honest, 0);
  });

  it('lists documents with agency, fee and link, suppliers, at most three lessons and a disclaimer', () => {
    const fse = plan.checklist.find((s) => s.setupItemId === 'fse_permit')!;
    expect(fse.agency).toBe('NYC DOHMH');
    expect(fse.fee).toBe(280);
    expect(fse.link).toMatch(/^https:\/\//);
    expect(plan.suppliers.length).toBeGreaterThanOrEqual(6);
    expect(plan.lessons.length).toBeGreaterThan(0);
    expect(plan.lessons.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < plan.lessons.length; i++) expect(plan.lessons[i - 1].amount).toBeGreaterThanOrEqual(plan.lessons[i].amount);
    expect(plan.lessons.map((l) => l.title).join(' ')).toMatch(/seats|Rent|staff/);
    expect(plan.disclaimer).toMatch(/not legal, tax or financial advice/);
  });
});

describe('glossary', () => {
  it('explains every analytics field in one English sentence', () => {
    const b = makeBusiness({ id: 'g', placeId: 'p_bedford_212' });
    const w = run(makeWorld([b]), 3);
    const keys = Object.keys(analyze(w.businesses[0], w, ctx)).sort();
    expect(Object.keys(GLOSSARY).sort()).toEqual(keys);
    for (const e of Object.values(GLOSSARY)) {
      expect(e.tip.trim().endsWith('.')).toBe(true);
      expect(e.tip.split(/\.\s+[A-Z]/).length).toBe(1);
      expect(e.tip).toMatch(/^[\x20-\x7E–—’…%$]+$/);
    }
  });
});
