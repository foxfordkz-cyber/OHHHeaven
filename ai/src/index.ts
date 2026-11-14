// @ohh-stub — placeholder by agent 01, signatures from build/CONTRACT.md §8. Owner: agent 05 replaces this file.
import type {
  AdvisorAnswer, Analytics, BusinessState, CommonPack, DayWeather, Debrief, GameDate, GameEvent, IdeaMatch,
  NicheId, Pack, PackSet, RealWorldPlan, WorldState,
} from '@ohh/shared';
import type { EngineCtx } from '@ohh/engine';

export function forecast(_seed: number, fromDay: number, days: number): DayWeather[] {
  return Array.from({ length: Math.max(0, days) }, (_, i) => ({
    day: fromDay + i, tempF: 55, condition: 'clear' as const, footTrafficMult: 1, label: 'Clear, 55°F',
  }));
}

export function deckEvent(_w: WorldState, _ctx: EngineCtx): GameEvent | null {
  return null;
}

export async function planEvents(_input: { date: GameDate; weather: DayWeather[]; recent: GameEvent[]; niches: NicheId[]; blocks: string[] }): Promise<GameEvent[]> {
  return [];
}

export async function askAdvisor(_input: { question: string; business: BusinessState; analytics: Analytics; pack: Pack; common: CommonPack }): Promise<AdvisorAnswer> {
  return { answer: 'The advisor is not connected yet.', sources: [], origin: 'rules' };
}

export async function interpretIdea(input: { text: string; packs: PackSet }): Promise<IdeaMatch> {
  const niche: NicheId = /barber|hair|cut/i.test(input.text) ? 'barbershop' : 'cafe';
  return { niche, businessName: niche === 'cafe' ? 'Corner Cafe' : 'Corner Barbers', tier: 'mid', kitId: 'standard', notes: [], origin: 'rules' };
}

export async function writeDebrief(input: { business: BusinessState; analytics: Analytics; plan: RealWorldPlan; rank: number }): Promise<Debrief> {
  return { headline: `${input.business.name} finished the season ranked #${input.rank}.`, lostMoneyOn: [], didWell: [], nextTime: [], origin: 'rules' };
}
