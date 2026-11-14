import { describe, expect, it } from 'vitest';
import type { Pack, Place } from '@ohh/shared/types';
import { openingCost } from '@ohh/shared/place';
import { realCtx } from '../../../app/local-host';
import { fixtureOpenRecommendations, fixturePacks, fixturePlaces } from '../../../app/fixtures';
import { applyRecommended, baseChoices, buildDecisions, choose, forcedExtras, itemsOf, monthlyBills, pickedOption, receipt, recommendedChoices, setSize, setStaff, summarize } from './model';
import { textsFor } from './texts';

const ctx = realCtx();
const pack = ctx.packs.niches.cafe as Pack;
const common = ctx.packs.common;
const place = ctx.places.find((p) => p.suitableFor.includes('cafe') && p.formerUse === 'cafe' && !p.forSale) as Place;

describe('opening decisions on the real cafe pack', () => {
  it('starts from the least the law allows and lists every required item', () => {
    const c = baseChoices(pack, place);
    const items = itemsOf(pack, c);
    expect(c.size).toBe(pack.sizing.min);
    expect(items.map((i) => i.id).sort()).toEqual(pack.setup.filter((s) => s.required).map((s) => s.id).sort());
    expect(items.find((i) => i.id === 'chair')?.qty).toBe(c.size);
  });

  it('charges on signing exactly what the engine charges for the same items', () => {
    const c = { ...baseChoices(pack, place), size: 18, extras: ['batch_brewer', 'signage'] };
    const s = summarize(pack, common, place, c);
    expect(s.paid).toBe(openingCost(pack, itemsOf(pack, c), c.size, place));
    expect(s.cashLeft).toBe(Math.round((pack.startCapital - s.paid) * 100) / 100);
    expect(receipt(pack, place, c).reduce((sum, l) => sum + l.amount, 0)).toBeCloseTo(s.paid, 2);
  });

  it('every choice moves a number on top: seats and machines cost cash, people and hours cost every month', () => {
    const base = baseChoices(pack, place);
    const before = summarize(pack, common, place, base);
    const ds = buildDecisions(pack, common, place, null, textsFor('cafe'));
    const espresso = ds.find((d) => d.id === 'espresso')!;
    const bigger = summarize(pack, common, place, choose(espresso, 'three', base));
    expect(before.cashLeft - bigger.cashLeft).toBe(espresso.options.find((o) => o.id === 'three')!.upfront);
    expect(bigger.monthly).toBe(before.monthly);
    const hours = ds.find((d) => d.leverId === 'hours')!;
    const long = summarize(pack, common, place, choose(hours, 'long', base));
    expect(long.monthly - before.monthly).toBeCloseTo(hours.options.find((o) => o.id === 'long')!.monthly, 2);
    expect(long.cashLeft).toBe(before.cashLeft);
    const team = summarize(pack, common, place, setStaff(pack, base, 'barista', 4));
    expect(team.monthly).toBeGreaterThan(before.monthly);
    expect(team.teamCapDay!).toBeGreaterThan(before.teamCapDay!);
  });

  it('adds the customer restroom the law requires from 20 seats, and shows it on the receipt', () => {
    const c19 = setSize(pack, place, baseChoices(pack, place), 19);
    const c20 = setSize(pack, place, c19, 20);
    if (c20.size < 20) return; // this room is too small for 20 seats
    expect(forcedExtras(pack, 19)).toEqual([]);
    expect(forcedExtras(pack, 20)).toEqual(['customer_restroom']);
    expect(receipt(pack, place, c20).some((l) => l.id === 'customer_restroom')).toBe(true);
    expect(summarize(pack, common, place, c20).paid - summarize(pack, common, place, c19).paid).toBeGreaterThan(12_000);
  });

  it('rent runs from signing: cash on opening day is cash left minus rent for the build-out days', () => {
    const s = summarize(pack, common, place, baseChoices(pack, place));
    expect(s.days).toBeGreaterThan(0);
    expect(s.rentBeforeOpening).toBeCloseTo(s.rentDay * s.days, 2);
    expect(s.cashAtOpening).toBeCloseTo(s.cashLeft - s.rentBeforeOpening, 2);
  });

  it('a sidewalk license waits 240 days without holding the opening back', () => {
    const base = baseChoices(pack, place);
    const ds = buildDecisions(pack, common, place, null, textsFor('cafe'));
    const sidewalk = ds.find((d) => d.id === 'sidewalk')!;
    const withLicense = choose(sidewalk, 'license', base);
    expect(sidewalk.options.find((o) => o.id === 'license')!.waitDays).toBe(240);
    expect(summarize(pack, common, place, withLicense).days).toBe(summarize(pack, common, place, base).days);
  });

  it('covers every optional item and every lever with a decision, and never repeats one', () => {
    const ds = buildDecisions(pack, common, place, null, textsFor('cafe'));
    const covered = new Set(ds.flatMap((d) => d.groupItems ?? []));
    for (const s of pack.setup.filter((x) => !x.required && x.id !== 'customer_restroom')) expect(covered.has(s.id), s.id).toBe(true);
    for (const l of pack.levers) expect(ds.some((d) => d.leverId === l.id), l.id).toBe(true);
    expect(new Set(ds.map((d) => d.id)).size).toBe(ds.length);
    expect(ds.length).toBeGreaterThanOrEqual(10);
  });

  it('marks what breaks the law with the real fine', () => {
    const ds = buildDecisions(pack, common, place, null, textsFor('cafe'));
    const pest = ds.find((d) => d.leverId === 'pest_control')!;
    const skip = pest.options.find((o) => o.id === 'none')!;
    expect(skip.risk?.fine).toContain('$300');
    expect(pest.recommended).toBe('monthly');
  });

  it('monthly bills hold rent of this address, wages with payroll taxes, and the chosen settings', () => {
    const c = baseChoices(pack, place);
    const bills = monthlyBills(pack, common, place, c);
    expect(bills.find((l) => l.id === 'rent')!.amount).toBeCloseTo((place.sqft * place.rentPerSqftYear) / 12, 1);
    expect(bills.find((l) => l.id === 'payroll_barista')!.amount).toBe(pack.capacity.minStaff * 21 * 160);
    expect(bills.find((l) => l.id === 'payroll_tax')!.amount).toBeGreaterThan(0);
  });
});

describe('opening decisions on the example packs', () => {
  const p = fixturePacks.niches.cafe as Pack;
  const pl = fixturePlaces.find((x) => x.id === 'p12');
  const rec = recommendedChoices(p, fixtureOpenRecommendations[0], pl);

  it('turns the recommended kit into choices and marks the matching option of each decision', () => {
    const ds = buildDecisions(p, fixturePacks.common, pl, rec);
    expect(rec.size).toBe(fixtureOpenRecommendations[0].size);
    for (const d of ds.filter((x) => x.kind === 'items' || x.kind === 'lever')) {
      const c = applyRecommended(d, baseChoices(p, pl), rec);
      if (d.recommended) expect(pickedOption(d, c)).toBe(d.recommended);
    }
  });

  it('a niche with no texts still gets a decision for every optional item', () => {
    const ds = buildDecisions(p, fixturePacks.common, pl, rec);
    const optional = p.setup.filter((s) => !s.required);
    expect(ds.filter((d) => d.kind === 'items').length).toBe(optional.length);
  });
});
