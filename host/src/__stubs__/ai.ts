// ЗАГЛУШКА @ohh/ai (агент 05): погода по климату Нью-Йорка, колода событий и ответы по шаблонам.
// Без сети. Климат — приблизительные нормы Central Park (оценка; настоящие данные готовит агент 05).
import type {
  AdvisorAnswer, Analytics, BusinessState, CommonPack, DayWeather, Debrief, GameDate, GameEvent, IdeaMatch, NicheId,
  Pack, PackSet, RealWorldPlan, WeatherCondition, WorldState,
} from '../../../shared/src/types';
import { RULES, dateOf } from '../../../shared/src/rules';
import type { AiApi, EngineCtx } from '../types';
import { formatMoney, hash32, rand01 } from '../util';

// Средний дневной максимум, °F, и доля дней с осадками по месяцам — оценка для заглушки.
const AVG_HIGH_F = [39, 42, 50, 62, 71, 80, 85, 83, 76, 65, 54, 44];
const WET_SHARE = [0.36, 0.33, 0.37, 0.37, 0.37, 0.34, 0.34, 0.32, 0.29, 0.29, 0.33, 0.36];
const SNOW_SHARE_OF_WET = [0.45, 0.45, 0.2, 0.03, 0, 0, 0, 0, 0, 0, 0.05, 0.3];
const TRAFFIC: Record<WeatherCondition, number> = { clear: 1, cloudy: 0.97, rain: 0.9, snow: 0.85, heat: 0.95, storm: 0.7 };
const LABEL: Record<WeatherCondition, string> = { clear: 'Clear', cloudy: 'Cloudy', rain: 'Rain', snow: 'Snow', heat: 'Heat', storm: 'Storm' };

export function forecast(seed: number, fromDay: number, days: number): DayWeather[] {
  const out: DayWeather[] = [];
  for (let d = Math.max(1, Math.floor(fromDay)); d < fromDay + days; d++) {
    const m = (dateOf(d).month - 1) % 12;
    const temp = Math.round(AVG_HIGH_F[m] + (rand01(seed, d, 't') - 0.5) * 16);
    const r = rand01(seed, d, 'w');
    let condition: WeatherCondition;
    if (r < WET_SHARE[m]) {
      const s = rand01(seed, d, 's');
      condition = s < SNOW_SHARE_OF_WET[m] && temp < 40 ? 'snow' : s > 0.93 && m >= 5 && m <= 8 ? 'storm' : 'rain';
    } else condition = temp >= 90 ? 'heat' : r < WET_SHARE[m] + 0.2 ? 'cloudy' : 'clear';
    out.push({ day: d, tempF: temp, condition, footTrafficMult: TRAFFIC[condition], label: `${LABEL[condition]}, ${temp}°F` });
  }
  return out;
}

interface DeckCard { id: string; kind: GameEvent['kind']; title: string; text: string; months: number[]; days: number; effects: GameEvent['effects']; perBlock?: boolean }
const DECK: DeckCard[] = [
  { id: 'blizzard', kind: 'weather', title: 'Blizzard warning', text: 'A winter storm is expected. Fewer people will be out on the street.', months: [1, 2, 12], days: 2, effects: [{ target: 'footTraffic', mult: 0.75 }] },
  { id: 'heat_wave', kind: 'weather', title: 'Heat wave', text: 'Temperatures above 90°F for several days. People stay indoors at midday.', months: [6, 7, 8], days: 3, effects: [{ target: 'footTraffic', mult: 0.9 }, { target: 'utilities', mult: 1.2 }] },
  { id: 'street_fair', kind: 'city', title: 'Street fair on your block', text: 'The city closed the street to cars for a weekend fair. Expect crowds.', months: [5, 6, 7, 8, 9], days: 2, effects: [{ target: 'footTraffic', mult: 1.2 }], perBlock: true },
  { id: 'coffee_prices', kind: 'supply', title: 'Coffee prices jump', text: 'Wholesale bean prices rose after a poor harvest. Cups cost more to make.', months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], days: 14, effects: [{ target: 'cogs', mult: 1.12, niches: ['cafe'] }] },
  { id: 'subway_closure', kind: 'traffic', title: 'Subway station closed for repairs', text: 'Weekend repairs close the nearest station. Fewer commuters walk by.', months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], days: 3, effects: [{ target: 'footTraffic', mult: 0.85 }], perBlock: true },
  { id: 'tourist_peak', kind: 'demand', title: 'Tourist season peak', text: 'Hotels are full and visitors fill the neighborhood.', months: [7, 12], days: 5, effects: [{ target: 'demand', mult: 1.1 }] },
  { id: 'marathon', kind: 'city', title: 'Marathon day', text: 'The marathon passes nearby. Spectators line the avenues.', months: [11], days: 1, effects: [{ target: 'footTraffic', mult: 1.15 }] },
  { id: 'flu_season', kind: 'staff', title: 'Flu going around', text: 'Many workers are calling in sick this week.', months: [1, 2, 12], days: 5, effects: [{ target: 'staffAvailability', mult: 0.85 }] },
];

export function deckEvent(w: WorldState, ctx: EngineCtx): GameEvent | null {
  const week = Math.floor(w.day / 7);
  if (rand01(w.config.seed, week, 'deck-skip') < 0.3) return null;
  const month = dateOf(w.day + RULES.EVENT_NOTICE_DAYS).month;
  const cards = DECK.filter((c) => c.months.includes(month));
  if (cards.length === 0) return null;
  const card = cards[hash32(w.config.seed, week, 'deck') % cards.length];
  const blocks = [...new Set(ctx.places.map((p) => p.block))].sort();
  const block = card.perBlock && blocks.length ? blocks[hash32(w.config.seed, week, 'block') % blocks.length] : undefined;
  const startDay = w.day + RULES.EVENT_NOTICE_DAYS + (hash32(w.config.seed, week, 'lead') % 3);
  return {
    id: `deck_${card.id}_${startDay}`, kind: card.kind, title: block ? `${card.title}: ${block}` : card.title, text: card.text,
    announcedDay: w.day, startDay, endDay: startDay + card.days - 1, effects: card.effects.map((e) => ({ ...e })), origin: 'deck', block,
  };
}

export async function planEvents(input: { date: GameDate; weather: DayWeather[]; recent: GameEvent[]; niches: NicheId[]; blocks: string[] }): Promise<GameEvent[]> {
  // Без ключа ИИ событий не придумывает: хост возьмёт событие из колоды. Раз в две недели — одно «событие от ИИ» для проверки очереди.
  if (input.date.day % 14 !== 0) return [];
  const start = input.date.day + RULES.EVENT_NOTICE_DAYS + 1;
  return [{
    id: `ai_farmers_market_${start}`, kind: 'city', title: 'Weekend farmers market', text: 'A farmers market sets up nearby on Saturday. More people walk the area.',
    announcedDay: input.date.day, startDay: start, endDay: start + 1, effects: [{ target: 'footTraffic', mult: 1.1 }], origin: 'ai',
    block: input.blocks[0],
  }];
}

const words = (s: string) => s.toLowerCase().match(/[a-z]+/g) ?? [];

export async function askAdvisor(input: { question: string; business: BusinessState; analytics: Analytics; pack: Pack; common: CommonPack }): Promise<AdvisorAnswer> {
  const q = new Set(words(input.question));
  const cards = [...input.pack.ruleCards, ...input.common.ruleCards]
    .map((c) => ({ c, score: words(`${c.title} ${c.text}`).filter((x) => x.length > 3 && q.has(x)).length }))
    .filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 2).map((x) => x.c);
  const a = input.analytics;
  const be = a.breakEvenUnitsMonth === null ? 'You lose money on every sale at this price.' : `You break even at ${a.breakEvenUnitsMonth} ${input.pack.unit.name}s a month.`;
  const answer = `${be} This month is on track for ${formatMoney(a.revenue)} in sales and ${formatMoney(a.profit)} profit.${cards.length ? ` ${cards[0].text}` : ''}`;
  return { answer: answer.split(/\s+/).slice(0, 90).join(' '), sources: cards.map((c) => ({ title: c.title, url: c.source })), origin: 'rules' };
}

export async function interpretIdea(input: { text: string; packs: PackSet }): Promise<IdeaMatch> {
  const t = input.text.toLowerCase();
  const available = Object.keys(input.packs.niches) as NicheId[];
  const niche: NicheId = /barber|hair|cut|fade|shave/.test(t) && available.includes('barbershop') ? 'barbershop' : available.includes('cafe') ? 'cafe' : available[0];
  const name = input.text.trim().split(/\s+/).slice(0, 3).map((x) => x[0]?.toUpperCase() + x.slice(1)).join(' ') || 'My place';
  return { niche, businessName: name.slice(0, 40), tier: /subway|busy|avenue|main/.test(t) ? 'prime' : 'mid', kitId: 'standard', notes: [`Closest playable kind of business: ${input.packs.niches[niche]?.name ?? niche}`], origin: 'rules' };
}

export async function writeDebrief(input: { business: BusinessState; analytics: Analytics; plan: RealWorldPlan; rank: number }): Promise<Debrief> {
  const p = input.plan;
  return {
    headline: `${input.business.name} finished #${input.rank} with ${formatMoney(input.analytics.netWorth)}`,
    lostMoneyOn: p.lessons.map((l) => ({ title: l.title, amount: l.amount, lesson: l.lesson, ruleCardId: l.ruleCardId })),
    didWell: input.analytics.profit > 0 ? ['Your last month was profitable.'] : [],
    nextTime: [`Keep at least ${formatMoney(p.reserveAdvised)} in reserve before you open.`],
    origin: 'rules',
  };
}

export const stubAi: AiApi = { forecast, deckEvent, planEvents, askAdvisor, interpretIdea, writeDebrief };
