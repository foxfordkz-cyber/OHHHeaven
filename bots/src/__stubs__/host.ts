// STUB of the pieces of @ohh/host (agent 06) and @ohh/ai (agent 05) that the simulator needs:
// join, a seeded NYC weather forecast and a tiny event deck. Replace when the real packages land.
import type { DayWeather, GameEvent, OfficialRole, Player, WeatherCondition, WorldState } from '../../../shared/src/types';
import { RULES, dateOf } from '../../../shared/src/rules';
import { rngFor } from '../rng';

export function join(w: WorldState, p: { name: string; kind: 'owner' | 'official'; role?: OfficialRole; isAi?: boolean; paid?: boolean }): { world: WorldState; playerId: string } {
  const playerId = `p${w.players.length + 1}`;
  const isAi = p.isAi ?? false;
  const paid = p.kind === 'owner' && (p.paid ?? !isAi);
  const player: Player = { id: playerId, name: p.name, kind: p.kind, isAi, paid, role: p.role, joinedDay: w.day, lastSeenDay: w.day, inbox: [] };
  const officials = p.kind === 'official'
    ? [...w.officials, { id: `o${w.officials.length + 1}`, playerId, name: p.name, isAi, role: p.role ?? 'inspector', points: 0, casesClosed: 0, bribesTaken: 0, bribesThisMonth: 0, exposed: false }]
    : w.officials;
  return { world: { ...w, players: [...w.players, player], officials, bank: w.bank + (paid ? w.config.entryFee : 0), version: w.version + 1 }, playerId };
}

// Monthly mean temperature in Manhattan, °F (estimate from NOAA 1991–2020 normals; agent 05 owns the real forecast).
const MEAN_F = [33, 36, 44, 55, 65, 74, 79, 78, 71, 60, 49, 39];
const TRAFFIC: Record<WeatherCondition, number> = { clear: 1, cloudy: 0.98, rain: 0.85, snow: 0.72, heat: 0.9, storm: 0.65 };

export function forecast(seed: number, fromDay: number, days: number): DayWeather[] {
  const out: DayWeather[] = [];
  for (let day = fromDay; day < fromDay + days; day++) {
    const rng = rngFor(seed, 'wx', day);
    const m = dateOf(day).month - 1;
    const tempF = Math.round(MEAN_F[m % 12] + (rng() - 0.5) * 16);
    const r = rng();
    let condition: WeatherCondition = r < 0.45 ? 'clear' : r < 0.67 ? 'cloudy' : r < 0.93 ? 'rain' : 'storm';
    if (condition === 'rain' && tempF <= 34) condition = 'snow';
    if (tempF >= 88 && condition !== 'storm') condition = 'heat';
    out.push({ day, tempF, condition, footTrafficMult: TRAFFIC[condition], label: `${condition}, ${tempF}°F` });
  }
  return out;
}

export const flatWeather = (fromDay: number, days: number): DayWeather[] =>
  Array.from({ length: days }, (_, i) => ({ day: fromDay + i, tempF: 60, condition: 'clear' as const, footTrafficMult: 1, label: 'clear, 60°F' }));

interface DeckCard { id: string; kind: GameEvent['kind']; title: string; text: string; days: number; effects: GameEvent['effects'] }
const DECK: DeckCard[] = [
  { id: 'street_fair', kind: 'city', title: 'Street fair on Avenue A', text: 'Weekend crowds all over the East Village.', days: 3, effects: [{ target: 'footTraffic', mult: 1.25 }] },
  { id: 'coffee_spike', kind: 'supply', title: 'Coffee beans up 15%', text: 'Wholesale arabica prices jumped.', days: 30, effects: [{ target: 'cogs', mult: 1.15, niches: ['cafe'] }] },
  { id: 'subway_closure', kind: 'traffic', title: 'L train weekend closure', text: 'Fewer people walk in from the subway.', days: 4, effects: [{ target: 'footTraffic', mult: 0.85 }] },
  { id: 'inspection_drive', kind: 'regulation', title: 'Health inspection campaign', text: 'The city is checking more storefronts this month.', days: 10, effects: [{ target: 'demand', mult: 1 }] },
  { id: 'heat_wave', kind: 'weather', title: 'Heat wave', text: 'Cold drinks sell, haircuts wait.', days: 4, effects: [{ target: 'demand', mult: 1.1, niches: ['cafe'] }, { target: 'demand', mult: 0.9, niches: ['barbershop'] }] },
  { id: 'flu_season', kind: 'staff', title: 'Flu going around', text: 'Staff call in sick.', days: 7, effects: [{ target: 'staffAvailability', mult: 0.85 }] },
];

/** Deterministic fallback deck: one card every 15 days, announced RULES.EVENT_NOTICE_DAYS ahead. */
export function deckEvent(w: WorldState): GameEvent | null {
  const day = w.day;
  if (day % 15 !== 0) return null;
  const rng = rngFor(w.config.seed, 'ev', day);
  if (rng() < 0.4) return null;
  const card = DECK[Math.floor(rng() * DECK.length)];
  const startDay = day + RULES.EVENT_NOTICE_DAYS;
  return { id: `e${day}-${card.id}`, kind: card.kind, title: card.title, text: card.text, announcedDay: day, startDay, endDay: startDay + card.days - 1, effects: card.effects, origin: 'deck' };
}
