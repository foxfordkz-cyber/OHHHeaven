import { describe, expect, it } from 'vitest';
import { glossary, pickEntry } from './glossary';
import { GLOSSARY_STUB } from './glossary.stub';

describe('tap-to-explain texts', () => {
  it('every key the Insights tab uses has a title and an explanation', () => {
    for (const k of ['profit', 'cash', 'runway', 'payback', 'breakEven', 'fixedCostsMonth', 'contributionPerUnit', 'costMix', 'benchmarks', 'trend', 'utilization', 'sizeUtilization', 'lostSales', 'taxes', 'exposure', 'savings', 'nicheKpis']) {
      const g = glossary(k);
      expect(g.title.length).toBeGreaterThan(2);
      expect(g.what.length).toBeGreaterThan(10);
    }
  });
  it("takes agent 04's { label, tip } text under its Analytics field name, keeping our title and why", () => {
    const engine = { cashRunwayMonths: { label: 'Cash runway', tip: 'How many months your cash lasts at the current loss.' } };
    expect(pickEntry(engine, 'runway')).toEqual({ title: GLOSSARY_STUB.runway.title, what: 'How many months your cash lasts at the current loss.', why: GLOSSARY_STUB.runway.why });
    expect(pickEntry({ profit: 'Plain string text.' }, 'profit').what).toBe('Plain string text.');
    expect(pickEntry({}, 'cash')).toEqual(GLOSSARY_STUB.cash);
  });
});
