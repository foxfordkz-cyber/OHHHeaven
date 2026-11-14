import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { askAdvisor, fineAfter, intentOf, MAX_WORDS, selectCards } from '../src/advisor';
import { interpretIdea, scoreNiches, tierOf } from '../src/idea';
import { writeDebrief } from '../src/debrief';
import { aiLog, mockProvider, resetAi, setProvider } from '../src/provider';
import { analytics, business, cafePack, commonPack, packSet, plan } from '../src/__stubs__/fixtures';
import { wordCount } from '../src/text';

const ask = (question: string) => askAdvisor({ question, business, analytics, pack: cafePack, common: commonPack });

beforeEach(() => { resetAi(); delete process.env.AI_TIMEOUT_MS; });
afterEach(() => { setProvider(null); delete process.env.AI_TIMEOUT_MS; });

describe('askAdvisor, rules path', () => {
  it('answers the three example questions with numbers, under 90 words', async () => {
    for (const q of ['Should I hire a third barista?', 'What happens if I pay cash wages?', 'Where do I find a coffee supplier?']) {
      const a = await ask(q);
      expect(a.origin).toBe('rules');
      expect(wordCount(a.answer)).toBeLessThanOrEqual(MAX_WORDS);
      expect(a.answer).toMatch(/\d/);
    }
  });

  it('weighs a hire against lost sales and the wage', async () => {
    const a = await ask('Should I hire a third barista?');
    expect(a.answer).toContain('$2,380');          // 17 × 140
    expect(a.answer).toContain('410');              // lost orders from analytics
    expect(a.sources.some(s => s.url.startsWith('https://dol.ny.gov'))).toBe(true);
  });

  it('is honest about shortcuts: saving, law and fine', async () => {
    const a = await ask('What happens if I pay cash wages?');
    expect(a.answer).toContain('$1,285');           // 18% of $7,140 payroll
    expect(a.answer).toContain('Unreported cash payroll');
    expect(a.answer).toMatch(/fine is about \$11,567/);
    expect(a.answer.toLowerCase()).not.toMatch(/get away|won't get caught/);
  });

  it('names where to find suppliers from the pack', async () => {
    const a = await ask('Where do I find a coffee supplier?');
    expect(a.answer).toContain('wholesale roasters');
  });

  it('classifies intents', () => {
    expect(intentOf('Should I hire a third barista?')).toBe('hire');
    expect(intentOf('What if I pay cash wages?')).toBe('shortcut');
    expect(intentOf('Where can I buy beans?')).toBe('supplier');
    expect(intentOf('Do I need a permit?')).toBe('permit');
    expect(intentOf('Is my rent too high?')).toBe('rent');
    expect(intentOf('Hello')).toBe('general');
  });

  it('selects cards that share words with the question', () => {
    const ids = selectCards('What happens if I pay cash wages?', cafePack, commonPack).map(c => c.id);
    expect(ids).toContain('shortcut:cash_wages');
    expect(selectCards('What about the weather?', cafePack, commonPack)).toEqual([]);
  });

  it('computes fines with the cap', () => {
    const v = cafePack.violations.find(x => x.id === 'no_fse_permit')!;
    expect(fineAfter(v, 2, 0)).toBe(2000);
    expect(fineAfter(v, 20, 0)).toBe(5000);
  });
});

describe('askAdvisor, real pack texts', () => {
  it('does not double the full stop when a supplier text already ends with one', async () => {
    const pack = { ...cafePack, suppliers: cafePack.suppliers.map(s => ({ ...s, whereToFind: `${s.whereToFind.replace(/\.$/, '')}.` })) };
    const a = await askAdvisor({ question: 'Where do I find a coffee supplier?', business, analytics, pack, common: commonPack });
    expect(a.answer).not.toContain('..');
  });
});

describe('askAdvisor, AI path', () => {
  it('uses a grounded short AI answer and maps sources', async () => {
    setProvider(mockProvider({ advisor: () => ({ answer: 'You lost about 410 orders this month. A barista costs about $2,380 a month, so a third one pays off only if the queue stays.', usedIds: ['staff:barista', 'rule:tipped_wage', 'rule:made_up'] }) }));
    const a = await ask('Should I hire a third barista?');
    expect(a.origin).toBe('ai');
    expect(a.sources).toEqual([{ title: 'Tipped wage in NYC', url: 'https://dol.ny.gov/minimum-wage' }]);
  });

  it('rejects answers that are too long, invent numbers, have no number or encourage a violation', async () => {
    const bad = [
      'word '.repeat(95) + '410.',
      'A barista costs about $3,999 a month and you lost 777 orders.',
      'Hiring is a good idea when the queue is long.',
      'Pay cash, nobody will notice, and you save $1,285 a month.',
    ];
    for (const answer of bad) {
      resetAi();
      setProvider(mockProvider({ advisor: () => ({ answer, usedIds: [] }) }));
      const a = await ask('Should I hire a third barista?');
      expect(a.origin, answer).toBe('rules');
      expect(aiLog().at(-1)?.outcome).toBe('invalid');
    }
  });

  it('falls back on timeout and provider errors', async () => {
    process.env.AI_TIMEOUT_MS = '50';
    setProvider(mockProvider({ advisor: () => ({ answer: 'x 410', usedIds: [] }) }, { delayMs: 1000 }));
    expect((await ask('Should I hire a third barista?')).origin).toBe('rules');
    setProvider(mockProvider({ advisor: () => { throw new Error('down'); } }));
    expect((await ask('Should I raise my price?')).origin).toBe('rules');
  });
});

describe('interpretIdea', () => {
  it('maps the example idea to a cafe with a name, tier, kit and notes', async () => {
    const m = await interpretIdea({ text: 'a small vegan coffee place near a subway', packs: packSet });
    expect(m).toMatchObject({ niche: 'cafe', tier: 'mid', kitId: 'lean', origin: 'rules' });
    expect(m.businessName.length).toBeGreaterThan(3);
    expect(m.notes.length).toBeGreaterThanOrEqual(2);
    expect(m.notes.length).toBeLessThanOrEqual(3);
    expect(m.notes.join(' ')).toMatch(/vegan/i);
  });

  it('sends non-playable niches to the closest playable one with an explanation', async () => {
    const m = await interpretIdea({ text: 'a cozy bed and breakfast in Harlem', packs: packSet });
    expect(m.niche).toBe('cafe');
    expect(m.notes[0]).toMatch(/isn't playable/);
    const deli = await interpretIdea({ text: 'a corner deli with sandwiches', packs: packSet });
    expect(deli.notes[0]).toMatch(/Corner store isn't playable/);
  });

  it('scores niches and tiers from words', () => {
    expect(scoreNiches('luxury salon in SoHo').barbershop).toBeGreaterThan(0);
    expect(tierOf('luxury salon in SoHo')).toBe('prime');
    expect(tierOf('a tiny budget shop on a quiet street')).toBe('cheap');
  });

  it('is deterministic and handles empty text', async () => {
    const a = await interpretIdea({ text: 'barbershop for kids', packs: packSet });
    expect(await interpretIdea({ text: 'barbershop for kids', packs: packSet })).toEqual(a);
    expect((await interpretIdea({ text: '', packs: packSet })).niche).toBe('cafe');
  });

  it('uses the AI answer but keeps the niche playable and the kit real', async () => {
    setProvider(mockProvider({ idea: () => ({ niche: 'guesthouse', businessName: 'Harlem Rooms', tier: 'mid', kitId: 'premium', notes: ['Guests stay a few nights at a time.'] }) }));
    const m = await interpretIdea({ text: 'a small hotel in Harlem', packs: packSet });
    expect(m).toMatchObject({ niche: 'cafe', businessName: 'Harlem Rooms', kitId: 'premium', origin: 'ai' });
    expect(m.notes[0]).toMatch(/isn't playable/);
  });
});

describe('writeDebrief', () => {
  it('keeps the three losses from the plan and writes templates without AI', async () => {
    const d = await writeDebrief({ business, analytics, plan, rank: 2 });
    expect(d.origin).toBe('rules');
    expect(d.lostMoneyOn).toEqual(plan.lessons);
    expect(d.headline).toContain('#2');
    expect(d.headline).toContain('$38,600');
    expect(d.didWell.length).toBeGreaterThan(0);
    expect(d.nextTime[0]).toContain('$65,700');
  });

  it('accepts AI text that only uses given numbers and rejects invented ones', async () => {
    setProvider(mockProvider({ debrief: () => ({ headline: 'Second place and $38,600 to show for it', didWell: ['You kept the room busy most days.'], nextTime: ['Keep a $65,700 reserve before you sign a lease.'] }) }));
    const ok = await writeDebrief({ business, analytics, plan, rank: 2 });
    expect(ok.origin).toBe('ai');
    expect(ok.lostMoneyOn).toEqual(plan.lessons);
    resetAi();
    setProvider(mockProvider({ debrief: () => ({ headline: 'You made $99,999', didWell: ['Great job.'], nextTime: ['Hire 7 baristas.'] }) }));
    expect((await writeDebrief({ business, analytics, plan, rank: 2 })).origin).toBe('rules');
  });

  it('names bankruptcy in the headline', async () => {
    const d = await writeDebrief({ business: { ...business, status: 'bankrupt', bankruptDay: 200 }, analytics, plan, rank: 9 });
    expect(d.headline).toMatch(/^Bankrupt in month 7/);
  });
});
