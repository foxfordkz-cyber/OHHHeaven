import { describe, expect, it } from 'vitest';
import { DECK, deckEvent, themeOfEvent } from '../src/events/deck';
import { BANNED, MULT_MAX, MULT_MIN, SEASON_WORDS, THEME_BY_ID } from '../src/events/themes';
import { ctx, makeWorld } from '../src/__stubs__/fixtures';
import { RULES, type GameEvent } from '../src/shared';

const TARGETS = ['demand', 'cogs', 'staffAvailability', 'footTraffic', 'utilities', 'deliveryShare', 'rent'];

function runSeason(seed: number) {
  const w = makeWorld(seed, 1);
  for (let d = 1; d <= 360; d++) {
    w.day = d;
    const e = deckEvent(w, ctx);
    if (e) w.events.push(e);
  }
  return w.events;
}

describe('deck data', () => {
  it('has 40 cards with unique ids, sources and English two-sentence texts', () => {
    expect(DECK).toHaveLength(40);
    expect(new Set(DECK.map(c => c.id)).size).toBe(40);
    for (const c of DECK) {
      expect(c.source).toMatch(/^https:\/\//);
      expect(c.sourceTitle.length).toBeGreaterThan(5);
      expect(c.title.length).toBeLessThanOrEqual(60);
      expect(c.text.split(/(?<=[a-z0-9%)'][.!?])\s+(?=[A-Z{])/).length).toBe(2);
      expect(c.text).toMatch(/^[\x20-\x7E]+$/);
      expect(BANNED.test(`${c.title} ${c.text}`)).toBe(false);
    }
  });

  it('covers weather, traffic, supply, city, regulation and staff', () => {
    const kinds = new Set(DECK.map(c => c.kind));
    for (const k of ['weather', 'traffic', 'supply', 'city', 'regulation', 'staff']) expect(kinds.has(k as GameEvent['kind'])).toBe(true);
  });

  it('keeps every card inside its theme: kind, targets, ranges 0.7-1.3, months and season words', () => {
    for (const c of DECK) {
      const t = THEME_BY_ID.get(c.theme);
      expect(t, c.id).toBeDefined();
      expect(c.kind).toBe(t!.kind);
      expect(t!.scopes).toContain(c.scope);
      expect(c.days).toBeLessThanOrEqual(t!.maxDays);
      for (const e of c.effects) {
        expect(TARGETS).toContain(e.target);
        expect(e.mult).toBeGreaterThanOrEqual(MULT_MIN);
        expect(e.mult).toBeLessThanOrEqual(MULT_MAX);
        const range = t!.targets[e.target];
        expect(range, `${c.id} ${e.target}`).toBeDefined();
        expect(e.mult).toBeGreaterThanOrEqual(range![0]);
        expect(e.mult).toBeLessThanOrEqual(range![1]);
      }
      const months = c.when.months ?? [c.when.date!.month];
      for (const m of months) expect(t!.months, `${c.id} month ${m}`).toContain(m);
      for (const s of SEASON_WORDS) if (s.re.test(c.text)) for (const m of months) expect(s.months, `${c.id}`).toContain(m);
    }
  });
});

describe('deckEvent', () => {
  it('is deterministic', () => {
    expect(runSeason(4)).toEqual(runSeason(4));
  });

  it('announces at most one event per game week, only on Mondays, with notice', () => {
    for (const seed of [1, 2, 3]) {
      const events = runSeason(seed);
      expect(events.length).toBeGreaterThan(25);
      const weeks = events.map(e => Math.floor((e.announcedDay - 1) / 7));
      expect(new Set(weeks).size).toBe(weeks.length);
      for (const e of events) {
        expect((e.announcedDay - 1) % 7).toBe(0);
        expect(e.startDay - e.announcedDay).toBeGreaterThanOrEqual(RULES.EVENT_NOTICE_DAYS);
        expect(e.endDay).toBeGreaterThanOrEqual(e.startDay);
        expect(e.origin).toBe('deck');
      }
    }
  });

  it('returns null on other days and when an event was already announced this week', () => {
    const w = makeWorld(1, 9);
    expect(deckEvent(w, ctx)).toBeNull();
    const monday = makeWorld(1, 8, [{ id: 'ai-heavy_rain-d12-x', kind: 'weather', title: 't', text: 't', announcedDay: 6, startDay: 12, endDay: 12, effects: [], origin: 'ai' }]);
    expect(deckEvent(monday, ctx)).toBeNull();
  });

  it('runs real calendar events on their dates', () => {
    const events = runSeason(1);
    const byCard = (id: string) => events.find(e => e.id.startsWith(`deck-${id}-`));
    expect(byCard('marathon_sunday')?.startDay).toBe(301);          // Nov 1
    expect(byCard('pride_march')?.startDay).toBe(178);              // Jun 28
    expect(byCard('july4_fireworks')?.startDay).toBe(184);          // Jul 4
    expect(byCard('unga_gridlock')?.startDay).toBe(261);            // Sep 21
    expect(byCard('minimum_wage_17')?.startDay).toBe(1 + RULES.EVENT_NOTICE_DAYS);
  });

  it('never puts a snow event in summer or a heat event in winter', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      for (const e of runSeason(seed)) {
        const m = Math.floor((e.startDay - 1) / 30) + 1;
        if (/snow|winter storm/i.test(e.title + e.text)) expect([11, 12, 1, 2, 3, 4]).toContain(m);
        if (/heat/i.test(e.title)) expect([5, 6, 7, 8, 9]).toContain(m);
      }
    }
  });

  it('puts block events on a real block and keeps niche filters to niches in the city', () => {
    const blocks = new Set(ctx.places.map(p => p.block));
    for (const e of runSeason(2)) {
      if (e.block) expect(blocks.has(e.block)).toBe(true);
      expect(e.text).not.toContain('{block}');
      for (const x of e.effects) for (const n of x.niches ?? []) expect(Object.keys(ctx.packs.niches)).toContain(n);
    }
  });

  it('drops niche-only cards when the niche is not in the city', () => {
    const noCafe = { ...ctx, packs: { ...ctx.packs, niches: { barbershop: ctx.packs.niches.barbershop } } };
    const w = makeWorld(1, 1);
    for (let d = 1; d <= 360; d++) {
      w.day = d;
      const e = deckEvent(w, noCafe);
      if (e) w.events.push(e);
    }
    expect(w.events.some(e => e.effects.some(x => x.niches?.includes('cafe')))).toBe(false);
  });

  it('maps event ids back to themes', () => {
    expect(themeOfEvent({ id: 'deck-pride_march-d178' } as GameEvent)).toBe('parade');
    expect(themeOfEvent({ id: 'ai-heat_wave-d190-ab12' } as GameEvent)).toBe('heat_wave');
    expect(themeOfEvent({ id: 'other' } as GameEvent)).toBeNull();
  });
});
