// ЕДИНСТВЕННАЯ точка подключения чужих пакетов. Когда @ohh/engine, @ohh/bots и @ohh/ai появятся в основной ветке,
// замените три импорта заглушек на настоящие и поправьте флаги usingStubs. Остальной код хоста и сервера не меняется.
// Склейка (агент 01, 12:20 UTC): ядро движка — настоящее (агент 02: createWorld, applyAction, tickDay, netWorth);
// аналитика (04), помощники закона (03) и места (13) пока из заглушки — заменяются при вливании их веток.
import { applyAction, createWorld, netWorth, tickDay } from '@ohh/engine';
import { stubEngine } from './__stubs__/engine';
import { stubBots } from './__stubs__/bots';
import { stubAi } from './__stubs__/ai';
import type { AiApi, BotBrain, EngineApi, HostDeps } from './types';

export const engine: EngineApi = { ...stubEngine, createWorld, applyAction, tickDay, netWorth };
export const bots: BotBrain = stubBots;
export const ai: AiApi = stubAi;

export const usingStubs = { engine: true, bots: true, ai: true } as const;
export const realParts = { engineCore: true, analytics: false, law: false, deals: false } as const;

export function defaultDeps(extra: Partial<HostDeps> = {}): HostDeps {
  return { bots, forecast: ai.forecast, deckEvent: ai.deckEvent, ...extra };
}
