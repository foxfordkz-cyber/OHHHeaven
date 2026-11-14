// ЕДИНСТВЕННАЯ точка подключения чужих пакетов. Когда @ohh/engine, @ohh/bots и @ohh/ai появятся в основной ветке,
// замените три импорта заглушек на настоящие и поправьте флаги usingStubs. Остальной код хоста и сервера не меняется.
// Склейка (агент 01): ядро движка — настоящее (02), аналитика — настоящая (04), помощники закона noticesFor/queueFor (03)
// и места computeStandings (13) — настоящие.
import { applyAction, createWorld, netWorth, openEstablished, tickDay } from '@ohh/engine';
import { analyze, managerOrders, realWorldPlan, recommend, recommendOpening, roadmapFor, whatIf } from '@ohh/engine/analytics';
import { noticesFor, queueFor } from '@ohh/engine/law';
import { computeStandings } from '@ohh/engine/deals';
import { stubEngine } from './__stubs__/engine';
import { createBotBrain } from '@ohh/bots';
import { deckEvent, forecast } from '@ohh/ai/pure';
import { stubAi } from './__stubs__/ai';
import type { AiApi, BotBrain, EngineApi, HostDeps } from './types';

export const engine: EngineApi = {
  ...stubEngine,
  createWorld, applyAction, openEstablished, tickDay, netWorth,
  analyze, recommend, recommendOpening, whatIf, roadmapFor, realWorldPlan, managerOrders,
  noticesFor, queueFor, computeStandings,
};
// Жители — настоящие (07). Погода и колода событий — настоящие (05, браузерная часть '@ohh/ai/pure', без SDK);
// асинхронные функции ИИ в хосте остаются заглушкой: советник, подбор и разбор зовёт сервер прямо из '@ohh/ai'.
// жители считают открытие настоящим советчиком движка: по состоянию помещения и настоящей аренде
export const bots: BotBrain = createBotBrain({ recommendOpening: (niche, placeId, w, ctx) => recommendOpening(niche, placeId, w, ctx) });
export const ai: AiApi = { ...stubAi, forecast, deckEvent };

export const usingStubs = { engine: false, bots: false, ai: true } as const;
export const realParts = { engineCore: true, analytics: true, law: true, deals: true, bots: true, weather: true, deck: true } as const;

export function defaultDeps(extra: Partial<HostDeps> = {}): HostDeps {
  return { bots, forecast: ai.forecast, deckEvent: ai.deckEvent, ...extra };
}
