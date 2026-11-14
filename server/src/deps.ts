// Точка подключения @ohh/ai для сервера. Пока настоящего пакета агента 05 нет в основной ветке, берём заглушку хоста
// (погода по климату, колода, шаблонные ответы). Когда @ohh/ai будет готов: `import * as realAi from '@ohh/ai'`
// и `export const ai: AiApi = realAi;`, флаг usingStubs.ai в host/src/deps.ts — false.
import { ai as stubAi, defaultDeps, usingStubs, type AiApi, type HostDeps } from '@ohh/host';

export const ai: AiApi = stubAi;

export function serverDeps(): HostDeps {
  return defaultDeps({ forecast: ai.forecast, deckEvent: ai.deckEvent });
}

export { usingStubs };

/** Обещание с потолком времени: ИИ никогда не держит запрос дольше `ms`. */
export function withTimeout<T>(p: Promise<T>, ms: number, fallback: () => T): Promise<T> {
  return new Promise<T>((resolve) => {
    const t = setTimeout(() => resolve(fallback()), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, () => { clearTimeout(t); resolve(fallback()); });
  });
}
