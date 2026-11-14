// Интерфейсы хоста из build/CONTRACT.md. EngineCtx и BotBrain берём из пакетов-владельцев (только типы:
// в браузерную сборку хоста они не тянут кода). EngineApi и AiApi — то, что хост и сервер берут у движка и ИИ.
import type {
  Action, ActionResult, Analytics, BusinessState, CaseCard, CaseNotice, DayWeather, GameEvent, MonthReport,
  NicheId, OpenRecommendation, PackSet, RealWorldPlan, Recommendation, RoadmapItem,
  Standing, StandingOrders, WorldConfig, WorldState, Money,
  AdvisorAnswer, IdeaMatch, Debrief, GameDate, Pack, CommonPack,
} from '@ohh/shared';
import type { EngineCtx } from '@ohh/engine';
import type { BotBrain } from '@ohh/bots';

export type { EngineCtx, BotBrain };
export type BotResident = ReturnType<BotBrain['populate']>[number];

/** CONTRACT §6. `takeQueuedEvent` — моё необязательное расширение: очередь событий от ИИ, которую держит сервер. */
export interface HostDeps {
  bots: BotBrain;
  forecast(seed: number, fromDay: number, days: number): DayWeather[];
  deckEvent(w: WorldState, ctx: EngineCtx): GameEvent | null;
  takeQueuedEvent?(w: WorldState): GameEvent | null;
}

/** Всё, что хост берёт из @ohh/engine (CONTRACT §3 и вспомогательные функции агента 03). */
export interface EngineApi {
  createWorld(config: WorldConfig): WorldState;
  applyAction(w: WorldState, ctx: EngineCtx, playerId: string, a: Action): ActionResult;
  tickDay(w: WorldState, ctx: EngineCtx): WorldState;
  netWorth(b: BusinessState, ctx: EngineCtx): Money;
  analyze(b: BusinessState, w: WorldState, ctx: EngineCtx): Analytics;
  recommend(b: BusinessState, w: WorldState, ctx: EngineCtx): Recommendation[];
  recommendOpening(niche: NicheId, placeId: string, w: WorldState, ctx: EngineCtx): OpenRecommendation[];
  whatIf(w: WorldState, ctx: EngineCtx, businessId: string, orders: Partial<StandingOrders>): { projected: MonthReport; analytics: Analytics };
  roadmapFor(niche: NicheId, b: BusinessState | null, w: WorldState, ctx: EngineCtx): RoadmapItem[];
  realWorldPlan(b: BusinessState, w: WorldState, ctx: EngineCtx): RealWorldPlan;
  managerOrders(b: BusinessState, w: WorldState, ctx: EngineCtx): Partial<StandingOrders>;
  noticesFor(w: WorldState, businessId: string): CaseNotice[];
  queueFor(w: WorldState, ctx: EngineCtx, officialId: string): CaseCard[];
  computeStandings(w: WorldState, ctx: EngineCtx): Standing[];
}

/** @ohh/ai (CONTRACT §8). */
export interface AiApi {
  forecast(seed: number, fromDay: number, days: number): DayWeather[];
  deckEvent(w: WorldState, ctx: EngineCtx): GameEvent | null;
  planEvents(input: { date: GameDate; weather: DayWeather[]; recent: GameEvent[]; niches: NicheId[]; blocks: string[] }): Promise<GameEvent[]>;
  askAdvisor(input: { question: string; business: BusinessState; analytics: Analytics; pack: Pack; common: CommonPack }): Promise<AdvisorAnswer>;
  interpretIdea(input: { text: string; packs: PackSet }): Promise<IdeaMatch>;
  writeDebrief(input: { business: BusinessState; analytics: Analytics; plan: RealWorldPlan; rank: number }): Promise<Debrief>;
}

/** Служебные поля хоста у игрока. Лежат прямо в объекте Player (спред движка их сохраняет). */
export interface PlayerExtra { strategy?: string; seenCash?: Money; seenDay?: number }
