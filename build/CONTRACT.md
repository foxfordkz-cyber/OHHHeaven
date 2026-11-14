# CONTRACT — как 13 кусков складываются в одну игру

Ведущий, 14 ноября 2026. Обязателен для всех агентов сборки. Формы данных — `shared/src/types.ts` (единственный источник правды; меняет только ведущий). Формат данных ниши — `build/PACK.md`. Правила работы — `build/PROTOCOL.md`.

## 1. Что строим

Сайт-игра под телефон, на английском, для взрослых 21–45 лет из США. Нью-Йорк, настоящая карта, пять ниш малого бизнеса, сезон из 12 месяцев-раундов. Владелец открывает бизнес и каждый месяц принимает до шести решений; система сама рекомендует комплект для открытия и решения, показывает аналитику как у настоящего бизнеса; ИИ ведёт события города (погода, пробки, буря, цены) и отвечает на вопросы игрока; бесплатные игроки-госслужащие проверяют бизнесы. Деньги и исход считает код, ИИ — только тексты и выбор событий из белого списка.

## 2. Стек и папки

Node 20+, TypeScript (ESM, strict), npm workspaces, тесты — vitest, запуск TS — tsx. Без баз данных: состояние в памяти и снимок в JSON.

| Папка | Пакет | Что | Владелец |
|---|---|---|---|
| корень: `package.json`, `tsconfig.base.json`, `README.md`, `.github/`, `scripts/` | — | workspaces, общие скрипты, деплой, склейка | 01 |
| `shared/` | `@ohh/shared` | типы (`src/types.ts` — ведущий), константы и мелкие чистые утилиты (`src/util/`) | 01 |
| `engine/src/economy/`, `engine/src/index.ts` | `@ohh/engine` | расчёт месяца: спрос, мощность, деньги, налоги, банкротство | 02 |
| `engine/src/compliance/` | `@ohh/engine` | нарушения, проверки, штрафы, взятки, атаки, призы | 03 |
| `engine/src/analytics/` | `@ohh/engine` | аналитика, рекомендации, what-if | 04 |
| `engine/src/niches/<id>.ts` | `@ohh/engine` | особенности ниши | 12, 13, 14 |
| `ai/` | `@ohh/ai` | события, погода, советник, разбор | 05 |
| `server/` | `@ohh/server` | комнаты-сезоны, сокеты, таймер | 06 |
| `bots/`, `sim/` | `@ohh/bots` | боты и симулятор баланса | 07 |
| `client/src/app/`, `client/src/ui/`, `client/src/screens/onboarding/` | `@ohh/client` | оболочка, дизайн-система, вход и открытие | 08 |
| `client/src/map/`, `client/src/screens/projector/`, `data/` | `@ohh/client` | карта, данные мест, экран проектора | 09 |
| `client/src/screens/turn/` | `@ohh/client` | ход месяца, итог, атаки, проверка | 10 |
| `client/src/screens/insights/`, `client/src/screens/official/`, `client/src/screens/end/` | `@ohh/client` | аналитика, советник, госслужащий, конец сезона | 11 |
| `packs/` | — | данные ниш и общий пакет | 12, 13, 14, 03 |

Пока каркаса агента 01 нет в основной ветке, каждый создаёт в своей папке минимальный `package.json` и работает автономно; типы импортирует из `shared/src/types.ts` относительным путём. Когда каркас появится — влей основную ветку и перейди на импорт `@ohh/shared`.

## 3. Движок: одна чистая функция на месяц

```ts
// engine/src/index.ts — агент 02
export interface EngineCtx { packs: PackSet; places: Place[] }
export function createSeason(config: SeasonConfig): SeasonState
export function openBusiness(s: SeasonState, ctx: EngineCtx, p: { ownerId: string; name: string; isBot: boolean; niche: NicheId; placeId: string; size: number; items: { id: string; qty: number }[] }): SeasonState
export function resolveMonth(s: SeasonState, ctx: EngineCtx, decisions: Record<string, MonthDecisions>, official: Record<string, OfficialDecisions>): SeasonState
// engine/src/compliance/index.ts — агент 03
export function accrueShortcuts(b: BusinessState, d: MonthDecisions, ctx: EngineCtx, base: { payroll: Money; revenue: Money; rent: Money; staffCount: number }, month: number): { lines: PnlLine[]; trails: ViolationTrail[] }
export function resolveCompliance(s: SeasonState, ctx: EngineCtx, decisions: Record<string, MonthDecisions>, official: Record<string, OfficialDecisions>): SeasonState
export function finalizeSeason(s: SeasonState): SeasonState            // standings → payouts
// engine/src/analytics/index.ts — агент 04
export function analyze(b: BusinessState, s: SeasonState, ctx: EngineCtx): Analytics
export function recommend(b: BusinessState, s: SeasonState, ctx: EngineCtx): Recommendation[]
export function recommendOpening(niche: NicheId, placeId: string, s: SeasonState, ctx: EngineCtx): OpenRecommendation[]   // lean, standard, premium
export function whatIf(s: SeasonState, ctx: EngineCtx, businessId: string, d: MonthDecisions): { report: MonthReport; analytics: Analytics }
// engine/src/niches/<id>.ts — агенты 12–14
export interface NicheHooks { demandMult?(b: BusinessState, month: number, pack: Pack): number; capacity?(b: BusinessState, pack: Pack): number | null; extraLines?(b: BusinessState, pack: Pack, month: number): PnlLine[]; kpis?(b: BusinessState, pack: Pack): NicheKpi[]; feed?(b: BusinessState, r: MonthReport, pack: Pack): string[] }
export const hooks: NicheHooks
```

Все функции чистые и детерминированные: без `Math.random`, `Date`, сети и файлов. Вход не мутируется. Реестр `engine/src/niches/index.ts` ведёт агент 01: добавляет импорт, когда вливает ветку ниши.

### Порядок расчёта месяца (`resolveMonth`)

1. **Решения.** Нет решения — берётся прошлое. Цена обрезается до `priceMin…priceMax`, штат — до `minStaff…maxStaff`.
2. **События.** Активные `GameEvent` дают множители по `target`; каждый обрезается до 0,5–1,5.
3. **Качество** (0–1) = 0,5 + эффекты рычагов + `qualityBonus` купленных предметов − штраф за очередь − штраф за нехватку людей.
4. **Спрос.** Формула привлекательности — из отчёта `research/reports/43-economy-sim.md`, раздел 1, с весами `pack.market.weights` и `place.footTraffic`. Обязательные свойства (это тесты): одинаковые бизнесы получают равные доли; рост своей цены на 1% при равных долях снижает свой спрос примерно на `|priceElasticity|`%; если цены подняли все, рынок сжимается; бизнесы конкурируют только внутри своей ниши.
5. **Мощность.** `staffCap = Σ работников × unitsPerStaffMonth × staffAvailability`. `sizeCap = size × unitsServedPerSizeMonth ÷ (1 − takeawayShare)`. `capacity = min(staffCap, sizeCap, hardCapUnits) × (1 − closedDays ÷ 30)`. `served = min(demand, capacity)`. Потерянный спрос записывается в `lost.size`, `lost.staff` или `lost.closure` — по тому ограничению, которое сработало.
6. **Размер зала — не бесплатный.** `size` не больше `floor(place.sqft × 0,6 ÷ sqftPerUnit)`. Мало мест: `sizeUtilization > crowdPenaltyAbove` → очередь, качество следующего месяца −0,05, часть потерянных клиентов уходит к конкурентам, в ленте событие. Много мест: больше мебели (`scalesWithSize`), уборки (`cleaningCostPerSizeMonth`, строки `per_size`); `sizeUtilization < emptyPenaltyBelow` → «пустой зал», репутация −0,02.
7. **Деньги.** Выручка = `served × price`. Себестоимость = `served × cogsPerUnit × cogs-множитель`. Зарплата = Σ работников × ставка × часы. Аренда = `place.rentPerSqftYear × place.sqft ÷ 12`. Остальное — строки `monthlyCosts` по `basis`, рычаги, действие игрока. Каждая сумма — отдельная строка `PnlLine`.
8. **Налоги.** Налоги на зарплату — сразу. Sales tax: цена указана без налога; собранный налог приходит в кассу и одновременно ложится в `liabilities` со сроком по `due` — это не деньги владельца. Налог на прибыль начисляется на положительную прибыль и платится раз в квартал. В месяц срока долг списывается с кассы.
9. **Срезанные углы** (агент 03, `accrueShortcuts`): экономия — строка `saving` с плюсом; след `ViolationTrail` растёт: `months += 1`, `saved += экономия`.
10. **Проверки, атаки, взятки, штрафы, репутация** (агент 03, `resolveCompliance`). Проверка находит все следы, которые по `official → role` и `foundBy` относятся к проверяющему: случая нет. Штраф = `base + perMonth × months + pctOfSaved × saved`, не больше `max`. `closureDays` действует в следующем месяце. След гаснет через 6 месяцев после последнего нарушения.
11. **Касса и банкротство.** `cashEnd = cashStart + Σ строк`. `cashEnd < 0` → банкрот: бизнес выбывает, рынок делят оставшиеся.
12. **Места.** Счёт = касса + 50% стоимости мебели и оборудования − неоплаченные `liabilities`. Банкроты — внизу, по месяцу банкротства.

Конец сезона (`finalizeSeason`): `bank × prizeShare` делится по `prizeTable` между небанкротами; `bank × officialsShare` — между госслужащими по очкам (разоблачённый взяточник получает 0); `bank × platformShare` — платформе.

## 4. Госслужащие и взятка

Роли: `inspector` (городские инспекции: санитария, лицензии, жильё), `tax_auditor` (налоги и труд), `journalist`. У каждого `inspectionsPerMonth` проверок. До проверки он видит только открытое: жалобы, цену, оценку, подсказки вида «payroll taxes look low for 5 staff». Очки: +10 за найденное нарушение, −5 за пустую проверку. Владелец заранее ставит `bribeOffer`; если пришли с проверкой и чиновник ответил `accept`, штрафа нет, след остаётся, деньги уходят чиновнику в `bribesTaken` (игровые). Журналист может опубликовать материал о взятке: если она была — чиновник `exposed`, его очки обнуляются, владелец платит штраф по `_common` (взятка) и теряет репутацию; если её не было — журналист теряет очки.

## 5. ИИ (`@ohh/ai`, агент 05)

```ts
export function planEvents(input: { month: number; rounds: number; niches: NicheId[]; weather: WeatherMonth; recent: GameEvent[]; deck: PackEvent[] }): Promise<GameEvent[]>   // 1–2 события на месяц вперёд
export function getWeather(month: number): Promise<WeatherMonth>
export function askAdvisor(input: { question: string; business: BusinessState; analytics: Analytics; pack: Pack; common: CommonPack }): Promise<AdvisorAnswer>
export function writeDebrief(input: { business: BusinessState; analytics: Analytics; pack: Pack; common: CommonPack; rank: number }): Promise<Debrief>
```

Правила: функции никогда не бросают исключение и отвечают не дольше 8 секунд — иначе запасной путь без ИИ (`origin: 'deck'` или `'rules'`). ИИ выбирает события и пишет тексты; числа эффектов проходят проверку схемы и обрезаются движком. Событие объявляется минимум за месяц и действует на всех одинаково. Ключ API — только в переменной окружения сервера; в репозиторий и в клиент не попадает. Без ключа игра работает на запасном пути.

## 6. Сервер (`@ohh/server`, агент 06)

Express + Socket.IO на одном порту (`PORT`, по умолчанию 3000); в продакшене он же раздаёт `client/dist`. События сокета и их типы — `ClientToServer` и `ServerToClient` в `shared/src/types.ts`. После каждого изменения сервер шлёт каждому клиенту его `ClientView` целиком — клиент ничего не считает сам. HTTP: `GET /api/health`, `GET /api/packs` (PackSet), `GET /api/places` (Place[]), `POST /api/season` (создать сезон), `GET /api/season/:id` (SpectatorView).

Фазы: `lobby` → `setup` (выбор ниши, места и комплекта) → 12 × (`decide` на `roundSeconds` → `resolve`) → `ended`. Кто не успел — за него ходит автопилот: прошлое решение, в первый месяц — `OpenRecommendation.firstDecisions`. События на месяц N+1 запрашиваются у ИИ во время `decide` месяца N.

## 7. Клиент (`@ohh/client`, агенты 08–11)

Vite + React + TypeScript, сначала ширина 390. Состояние — один стор с последним `ClientView` (`client/src/app/store.ts`, агент 08) и хук `useView()`; экраны только читают его и шлют события через `client/src/app/socket.ts`. Маршруты: `/` вход, `/play` владелец (экран по `phase`), `/official` госслужащий, `/screen/:id` проектор. Стили — CSS-переменные из `client/src/ui/tokens.css`; готовые компоненты — из `client/src/ui/`. Экран, которому не хватает данных, делает у себя `fixtures.ts` с примером `ClientView` и работает на нём до склейки — так каждый экран открывается отдельно: `/dev/<screen>`.

## 8. Готово — это когда

- `npm test` в твоём пакете зелёный, и в журнале записано, какой командой проверить.
- Публичные функции совпадают с сигнатурами этого файла.
- Чужие папки не тронуты.
