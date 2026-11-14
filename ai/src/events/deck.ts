// Fallback events without AI: a fixed deck of 40 NYC events with real occasions and sources (data/deck.json).
// deckEvent is pure: same world state → same answer. At most one new event per game week.
import deckData from '../data/deck.json';
import { RULES, type EngineCtx, type EventEffect, type GameEvent, type WeatherCondition, type WorldState } from '../shared';
import { stream } from '../rng';
import { forecast } from '../weather';

export interface DeckCard {
  id: string; theme: string; kind: GameEvent['kind']; title: string; text: string;
  when: { months?: number[]; date?: { month: number; from: number; to: number }; weather?: WeatherCondition[]; minTempF?: number; maxTempF?: number; startWeekday?: number };
  days: number; scope: 'city' | 'block'; effects: EventEffect[];
  cooldownDays?: number; weight?: number;
  source: string; sourceTitle: string; checked: string; confidence: 'verified' | 'estimate'; effectNote: string; note?: string;
}

export const DECK: DeckCard[] = deckData.cards as DeckCard[];

const DAYS_PER_MONTH = RULES.DAYS_PER_MONTH;
const SEASON_DAYS = DAYS_PER_MONTH * 12;
const NOTICE = RULES.EVENT_NOTICE_DAYS;
const WEEK = 7;
/** Share of game weeks in which a floating (not date-bound) deck event appears; quiet weeks keep the city calm. */
export const FLOATING_EVENT_CHANCE = 0.65;

const monthOf = (day: number) => Math.floor((day - 1) / DAYS_PER_MONTH) % 12 + 1;
const weekdayOf = (day: number) => (day - 1) % WEEK; // 0 = Monday (shared/src/rules.ts dateOf)

/** Game day of a real calendar date in the season that contains `today`. */
function gameDayOf(month: number, dayOfMonth: number, today: number): number {
  const seasonStart = Math.floor((today - 1) / SEASON_DAYS) * SEASON_DAYS;
  return seasonStart + (month - 1) * DAYS_PER_MONTH + Math.min(dayOfMonth, DAYS_PER_MONTH);
}

function nextWeekday(day: number, weekday: number): number {
  return day + ((weekday - weekdayOf(day) + WEEK) % WEEK);
}

function weatherFits(card: DeckCard, seed: number, start: number): boolean {
  const { weather, minTempF, maxTempF } = card.when;
  if (!weather && minTempF === undefined && maxTempF === undefined) return true;
  return forecast(seed, start, card.days).some(w =>
    (!weather || weather.includes(w.condition)) &&
    (minTempF === undefined || w.tempF >= minTempF) &&
    (maxTempF === undefined || w.tempF <= maxTempF));
}

function monthsFit(card: DeckCard, start: number): boolean {
  if (!card.when.months) return true;
  for (let d = start; d < start + card.days; d++) if (!card.when.months.includes(monthOf(d))) return false;
  return true;
}

function cooledDown(card: DeckCard, w: WorldState): boolean {
  const cooldown = card.cooldownDays ?? 45;
  return !w.events.some(e => e.id.startsWith(`deck-${card.id}-`) && w.day - e.announcedDay < cooldown);
}

const CARD_BY_ID = new Map(DECK.map(c => [c.id, c]));

/** Theme of an event already in the world: deck ids are `deck-<card>-d<day>`, AI ids are `ai-<theme>-d<day>-<hash>`. */
export function themeOfEvent(e: GameEvent): string | null {
  const m = /^(deck|ai)-([a-z0-9_]+)-d\d+/.exec(e.id);
  if (!m) return null;
  return m[1] === 'deck' ? CARD_BY_ID.get(m[2])?.theme ?? null : m[2];
}

/** Real calendar events may overlap other events, but not one with the same theme; floating ones avoid their whole kind. */
function clashes(card: DeckCard, w: WorldState, start: number): boolean {
  const end = start + card.days - 1;
  return w.events.some(e => e.startDay <= end && e.endDay >= start &&
    (themeOfEvent(e) === card.theme || (!card.when.date && e.kind === card.kind)));
}

/** Effects limited to niches that exist in this city; a card that loses all its effects is skipped. */
function effectsFor(card: DeckCard, ctx: EngineCtx): EventEffect[] | null {
  const present = Object.keys(ctx.packs?.niches ?? {});
  if (card.effects.length === 0) return [];
  const out: EventEffect[] = [];
  for (const e of card.effects) {
    if (!e.niches || present.length === 0) { out.push({ ...e }); continue; }
    const niches = e.niches.filter(n => present.includes(n));
    if (niches.length > 0) out.push({ ...e, niches });
  }
  return out.length > 0 ? out : null;
}

function build(card: DeckCard, start: number, w: WorldState, ctx: EngineCtx, r: () => number): GameEvent | null {
  const effects = effectsFor(card, ctx);
  if (effects === null) return null;
  let block: string | undefined;
  if (card.scope === 'block') {
    const blocks = [...new Set((ctx.places ?? []).map(p => p.block).filter(Boolean))].sort();
    if (blocks.length === 0) return null;
    block = blocks[Math.floor(r() * blocks.length)];
  }
  const days = Math.min(card.days, 30);
  const text = card.text.replaceAll('{block}', block ?? 'the street');
  return {
    id: `deck-${card.id}-d${start}`, kind: card.kind, title: card.title, text,
    announcedDay: w.day, startDay: start, endDay: start + days - 1,
    effects, origin: 'deck', ...(block ? { block } : {}),
  };
}

/** CONTRACT §8: a deck event announced today, or null. Announcements happen on game Mondays, at most one a week. */
export function deckEvent(w: WorldState, ctx: EngineCtx): GameEvent | null {
  const today = Math.max(1, Math.floor(w.day));
  if (weekdayOf(today) !== 0) return null;
  if (w.events.some(e => e.announcedDay > today - WEEK && e.announcedDay <= today)) return null;
  const seed = w.config.seed;
  const week = Math.floor((today - 1) / WEEK);
  const r = stream(seed, 'deck', week);
  const earliest = today + NOTICE;

  // Real calendar events first, soonest first. Each is announced one or two weeks ahead, so two dates
  // in the same week both get their own Monday.
  const dated: { card: DeckCard; start: number }[] = [];
  for (const card of DECK) {
    const date = card.when.date;
    if (!date) continue;
    let start = gameDayOf(date.month, date.from, today);
    if (card.when.startWeekday !== undefined) start = nextWeekday(start, card.when.startWeekday);
    if (start < earliest && start >= today) start = earliest;
    if (start < earliest || start >= earliest + 2 * WEEK) continue;
    if (!cooledDown(card, w) || clashes(card, w, start) || !weatherFits(card, seed, start)) continue;
    dated.push({ card, start });
  }
  dated.sort((a, b) => a.start - b.start || a.card.id.localeCompare(b.card.id));
  for (const { card, start } of dated) {
    const ev = build(card, start, w, ctx, r);
    if (ev) return ev;
  }

  // Floating cards. A weather warning that matches the forecast always runs; other cards skip some weeks.
  const offset = Math.floor(r() * 4);
  const quietWeek = r() >= FLOATING_EVENT_CHANCE;
  const eligible = (card: DeckCard): { card: DeckCard; start: number } | null => {
    const start = card.when.startWeekday !== undefined ? nextWeekday(earliest, card.when.startWeekday) : earliest + offset;
    if (!monthsFit(card, start) || !cooledDown(card, w) || clashes(card, w, start) || !weatherFits(card, seed, start)) return null;
    return { card, start };
  };
  const floating = DECK.filter(c => !c.when.date);
  const warnings = floating.filter(c => c.when.weather || c.when.minTempF !== undefined || c.when.maxTempF !== undefined)
    .map(eligible).filter((x): x is { card: DeckCard; start: number } => x !== null);
  const candidates = warnings.length > 0 ? warnings
    : quietWeek ? [] : floating.map(eligible).filter((x): x is { card: DeckCard; start: number } => x !== null);
  while (candidates.length > 0) {
    const total = candidates.reduce((s, c) => s + (c.card.weight ?? 1), 0);
    let pick = r() * total;
    let i = 0;
    for (; i < candidates.length - 1; i++) { pick -= candidates[i].card.weight ?? 1; if (pick < 0) break; }
    const ev = build(candidates[i].card, candidates[i].start, w, ctx, r);
    if (ev) return ev;
    candidates.splice(i, 1);
  }
  return null;
}
