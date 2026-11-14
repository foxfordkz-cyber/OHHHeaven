// ЕДИНСТВЕННАЯ точка подключения чужих пакетов. Когда @ohh/engine, @ohh/bots и @ohh/ai появятся в основной ветке,
// замените три импорта заглушек на настоящие и поправьте флаги usingStubs. Остальной код хоста и сервера не меняется.
// Склейка (агент 01): ядро движка — настоящее (02), аналитика — настоящая (04), помощники закона noticesFor/queueFor (03)
// и места computeStandings (13) — настоящие. Из заглушки остаётся только то, чего нет в движке.
import { applyAction, createWorld, netWorth, tickDay } from '@ohh/engine';
import { analyze, managerOrders, realWorldPlan, recommend, recommendOpening, roadmapFor, whatIf } from '@ohh/engine/analytics';
import { noticesFor, queueFor } from '@ohh/engine/law';
import { computeStandings } from '@ohh/engine/deals';
import { stubEngine } from './__stubs__/engine';
import { stubBots } from './__stubs__/bots';
import { stubAi } from './__stubs__/ai';
import type { AiApi, BotBrain, EngineApi, HostDeps } from './types';

export const engine: EngineApi = {
  ...stubEngine,
  createWorld, applyAction, tickDay, netWorth,
  analyze, recommend, recommendOpening, whatIf, roadmapFor, realWorldPlan, managerOrders,
  noticesFor, queueFor, computeStandings,
};
export const bots: BotBrain = stubBots;
export const ai: AiApi = stubAi;

export const usingStubs = { engine: true, bots: true, ai: true } as const;
export const realParts = { engineCore: true, analytics: true, law: true, deals: true } as const;

export function defaultDeps(extra: Partial<HostDeps> = {}): HostDeps {
  return { bots, forecast: ai.forecast, deckEvent: ai.deckEvent, ...extra };
}
