// ЕДИНСТВЕННАЯ точка подключения чужих пакетов. Когда @ohh/engine, @ohh/bots и @ohh/ai появятся в основной ветке,
// замените три импорта заглушек на настоящие и поправьте флаги usingStubs. Остальной код хоста и сервера не меняется.
import { stubEngine } from './__stubs__/engine';
import { stubBots } from './__stubs__/bots';
import { stubAi } from './__stubs__/ai';
import type { AiApi, BotBrain, EngineApi, HostDeps } from './types';

export const engine: EngineApi = stubEngine;
export const bots: BotBrain = stubBots;
export const ai: AiApi = stubAi;

export const usingStubs = { engine: true, bots: true, ai: true } as const;

export function defaultDeps(extra: Partial<HostDeps> = {}): HostDeps {
  return { bots, forecast: ai.forecast, deckEvent: ai.deckEvent, ...extra };
}
