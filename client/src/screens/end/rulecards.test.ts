import { describe, expect, it } from 'vitest';
import type { PackSet } from '@shared/types';
import { fixturePacks } from '../../app/fixtures';
import { RULE_CARDS } from '../insights/fixtures';
import { cardsFromPacks, packInfo } from './rulecards';

describe('pack info', () => {
  it('collects rule cards and the names of taxes and violations from every pack', () => {
    const info = packInfo(fixturePacks);
    expect(info.cards.size).toBe(cardsFromPacks(fixturePacks).length);
    const cafe = fixturePacks.niches.cafe!;
    const all = [...fixturePacks.common.violations, ...cafe.violations];
    // a niche's own name wins over the common pack's
    expect(info.taxName('sales_tax')).toBe(cafe.taxes.find((t) => t.id === 'sales_tax')?.name ?? fixturePacks.common.taxes.find((t) => t.id === 'sales_tax')?.name);
    expect(info.violationName(all[0].id)).toBe([...all].reverse().find((x) => x.id === all[0].id)!.name);
    expect(info.taxName('no_such_tax')).toBeUndefined();
  });
  it('cards passed in win over the packs; no packs means no names', () => {
    const info = packInfo(null, RULE_CARDS);
    expect([...info.cards.keys()]).toEqual(RULE_CARDS.map((c) => c.id));
    expect(info.taxName('sales_tax')).toBeUndefined();
    expect(packInfo({ common: undefined, niches: {} } as unknown as PackSet).cards.size).toBe(0);
  });
});
