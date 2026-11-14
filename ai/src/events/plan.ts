// AI-planned city events. The model picks a theme from the whitelist and writes the words; code checks
// schema, season, forecast, notice, ranges and topics. Anything that fails is dropped; the host then uses the deck.
import * as z from 'zod/v4';
import { RULES, type DayWeather, type EventEffect, type GameDate, type GameEvent, type NicheId } from '../shared';
import { digest } from '../rng';
import { callAi } from '../provider';
import { themeOfEvent } from './deck';
import { BANNED, MAX_START_AHEAD_DAYS, MULT_MAX, MULT_MIN, SEASON_WORDS, THEMES, THEME_BY_ID, monthOfDay } from './themes';

const EFFECT_TARGETS = ['demand', 'cogs', 'staffAvailability', 'footTraffic', 'utilities', 'deliveryShare', 'rent'] as const;
const NICHES = ['cafe', 'barbershop', 'bodega', 'guesthouse', 'rentals'] as const;
const TIERS = ['prime', 'mid', 'cheap'] as const;
const KINDS = ['weather', 'traffic', 'supply', 'city', 'regulation', 'demand', 'staff'] as const;
const MAX_EVENTS = 2;

export const PlannedEventSchema = z.object({
  themeId: z.string(),
  kind: z.enum(KINDS),
  title: z.string(),
  text: z.string(),
  startInDays: z.number().int(),
  durationDays: z.number().int(),
  block: z.string().nullable(),
  effects: z.array(z.object({
    target: z.enum(EFFECT_TARGETS),
    mult: z.number(),
    niches: z.array(z.enum(NICHES)).nullable(),
    tiers: z.array(z.enum(TIERS)).nullable(),
  })),
});
export const PlanSchema = z.object({ events: z.array(PlannedEventSchema) });
export type PlannedEvent = z.infer<typeof PlannedEventSchema>;

export interface PlanInput { date: GameDate; weather: DayWeather[]; recent: GameEvent[]; niches: NicheId[]; blocks: string[] }

const sentences = (s: string) => s.trim().split(/(?<=[a-z0-9%)'"][.!?])\s+(?=[A-Z"])/).filter(Boolean).length;
const MONEY_OR_PERCENT = /[$%€£]|\b\d+(\.\d+)?\s*(percent|dollars?|cents?|usd)\b/i;

/** Checks one planned event; returns the game event or the reason it was dropped. */
export function checkPlanned(p: PlannedEvent, input: PlanInput, accepted: GameEvent[] = []): { ok: true; event: GameEvent } | { ok: false; reason: string } {
  const theme = THEME_BY_ID.get(p.themeId);
  if (!theme) return { ok: false, reason: `unknown theme ${p.themeId}` };
  if (p.kind !== theme.kind) return { ok: false, reason: `kind ${p.kind} does not match theme ${theme.id}` };
  const today = input.date.day;
  if (p.startInDays < RULES.EVENT_NOTICE_DAYS) return { ok: false, reason: `starts in ${p.startInDays} days, notice is ${RULES.EVENT_NOTICE_DAYS}` };
  if (p.startInDays > MAX_START_AHEAD_DAYS) return { ok: false, reason: 'starts too far ahead' };
  if (p.durationDays < 1 || p.durationDays > theme.maxDays) return { ok: false, reason: `duration ${p.durationDays} outside 1-${theme.maxDays}` };
  const start = today + p.startInDays;
  const end = start + p.durationDays - 1;

  const title = p.title.trim();
  const text = p.text.trim().replace(/\s+/g, ' ');
  if (title.length < 3 || title.length > 60) return { ok: false, reason: 'title length' };
  if (text.length < 20 || text.length > 320) return { ok: false, reason: 'text length' };
  if (!/^[\x20-\x7E]+$/.test(title + text)) return { ok: false, reason: 'not plain English' };
  const n = sentences(text);
  if (n < 1 || n > 3) return { ok: false, reason: `${n} sentences` };
  if (BANNED.test(`${title} ${text}`)) return { ok: false, reason: 'banned topic' };
  if (MONEY_OR_PERCENT.test(`${title} ${text}`)) return { ok: false, reason: 'invented money or percent figures' };

  for (let d = start; d <= end; d++) {
    if (!theme.months.includes(monthOfDay(d))) return { ok: false, reason: `${theme.id} is implausible in month ${monthOfDay(d)}` };
    for (const s of SEASON_WORDS) if (s.re.test(`${title} ${text}`) && !s.months.includes(monthOfDay(d))) return { ok: false, reason: `season words implausible in month ${monthOfDay(d)}` };
  }
  if (theme.weather) {
    const window = input.weather.filter(w => w.day >= start && w.day <= end);
    if (window.length > 0 && !window.some(w => theme.weather!.includes(w.condition))) return { ok: false, reason: 'forecast disagrees with the event' };
  }

  let block: string | undefined;
  if (p.block !== null && p.block !== '') {
    if (!theme.scopes.includes('block')) return { ok: false, reason: `${theme.id} is citywide` };
    if (!input.blocks.includes(p.block)) return { ok: false, reason: `unknown block ${p.block}` };
    block = p.block;
  } else if (!theme.scopes.includes('city')) {
    return { ok: false, reason: `${theme.id} needs a block` };
  }

  const allowed = Object.keys(theme.targets);
  if (p.effects.length > 3) return { ok: false, reason: 'too many effects' };
  if (allowed.length === 0 && p.effects.length > 0) return { ok: false, reason: `${theme.id} is information only` };
  if (allowed.length > 0 && p.effects.length === 0) return { ok: false, reason: 'no effects' };
  const effects: EventEffect[] = [];
  const seen = new Set<string>();
  for (const e of p.effects) {
    const range = theme.targets[e.target];
    if (!range) return { ok: false, reason: `target ${e.target} not allowed for ${theme.id}` };
    if (!Number.isFinite(e.mult) || e.mult < MULT_MIN || e.mult > MULT_MAX) return { ok: false, reason: `mult ${e.mult} outside ${MULT_MIN}-${MULT_MAX}` };
    if (e.mult < range[0] || e.mult > range[1]) return { ok: false, reason: `mult ${e.mult} outside ${theme.id} range` };
    if (e.niches && e.niches.some(x => !input.niches.includes(x))) return { ok: false, reason: 'niche not in the city' };
    const key = `${e.target}|${(e.niches ?? []).join(',')}|${(e.tiers ?? []).join(',')}`;
    if (seen.has(key)) return { ok: false, reason: 'duplicate effect' };
    seen.add(key);
    effects.push({ target: e.target, mult: Math.round(e.mult * 100) / 100, ...(e.niches?.length ? { niches: e.niches } : {}), ...(e.tiers?.length ? { tiers: e.tiers } : {}) });
  }

  const clash = [...input.recent, ...accepted].some(e => themeOfEvent(e) === theme.id &&
    ((e.startDay <= end && e.endDay >= start) || Math.abs(e.announcedDay - today) < 7));
  if (clash) return { ok: false, reason: `${theme.id} already running or just announced` };

  return {
    ok: true,
    event: {
      id: `ai-${theme.id}-d${start}-${digest(`${title}|${text}`).slice(0, 6)}`,
      kind: theme.kind, title, text,
      announcedDay: today, startDay: start, endDay: end,
      effects, origin: 'ai', ...(block ? { block } : {}),
    },
  };
}

/** Keeps the valid events (at most two); reasons for the rest go to the call log. */
export function validatePlan(plan: { events: PlannedEvent[] }, input: PlanInput): { events: GameEvent[]; rejected: string[] } {
  const events: GameEvent[] = [];
  const rejected: string[] = [];
  for (const p of plan.events) {
    if (events.length >= MAX_EVENTS) { rejected.push('more than two events'); break; }
    const r = checkPlanned(p, input, events);
    if (r.ok) events.push(r.event);
    else rejected.push(`${p.themeId}: ${r.reason}`);
  }
  return { events, rejected };
}

export const PLAN_SYSTEM = [
  'You plan city events for First Year, a business simulation set in New York City.',
  'Pick one or two events for the coming weeks from the allowed themes. Each event must be plausible for the date, the season and the weather forecast, and it affects every business the same way.',
  'Write in plain American English: a short title (at most 60 characters) and exactly two sentences saying what happened and what it means for local businesses.',
  'Never write about deaths, injuries, disasters, crime, war, politics, protests or disease outbreaks.',
  'Do not write money amounts or percentages: the game computes all effects.',
  'Effects: only the targets listed for the chosen theme, each multiplier inside that theme range (always between 0.7 and 1.3).',
  `Start at least ${RULES.EVENT_NOTICE_DAYS} days after today and within ${MAX_START_AHEAD_DAYS} days. Use a block only for themes that allow one, and only from the given list; otherwise block is null.`,
  'Do not repeat a theme that is already running or was announced in the last week.',
].join('\n');

export function planPrompt(input: PlanInput): string {
  const themes = THEMES.map(t => ({
    id: t.id, kind: t.kind, what: t.label, months: t.months, maxDays: t.maxDays, scopes: t.scopes,
    targets: t.targets, ...(t.weather ? { needsForecast: t.weather } : {}),
  }));
  return JSON.stringify({
    today: { day: input.date.day, label: input.date.label, month: input.date.month },
    forecast: input.weather.map(w => ({ day: w.day, weather: w.label })),
    recentEvents: input.recent.slice(-10).map(e => ({ title: e.title, theme: themeOfEvent(e), startDay: e.startDay, endDay: e.endDay })),
    niches: input.niches,
    blocks: input.blocks,
    themes,
  });
}

/** CONTRACT §8. Never throws; empty list means "use the deck". */
export async function planEvents(input: PlanInput): Promise<GameEvent[]> {
  try {
    const out = await callAi(
      { task: 'plan_events', system: PLAN_SYSTEM, prompt: planPrompt(input), schema: PlanSchema, maxTokens: 4000 },
      plan => {
        const { events, rejected } = validatePlan(plan, input);
        return events.length > 0 ? { ok: true as const, value: events } : { ok: false as const, reason: rejected.join('; ') || 'no events' };
      },
    );
    return out ?? [];
  } catch {
    return [];
  }
}
