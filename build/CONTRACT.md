# CONTRACT — как куски складываются в одну игру (версия 5, «медленный город»)

Ведущий, 14 ноября 2026, 11:30 UTC. Обязателен для всех агентов сборки. Игра описана в `context/08-game-v5.md` — прочитай её первой. Формы данных — `shared/src/types.ts`, числа правил — `shared/src/rules.ts` (оба файла меняет только ведущий). Формат данных ниши — `build/PACK.md`. Правила работы — `build/PROTOCOL.md`.

## 1. Три идеи, на которых всё держится

1. **Мир идёт сам.** Сервер раз в `dayMs` считает один игровой день для всех бизнесов по их постоянным распоряжениям (`StandingOrders`). Игроков никто не ждёт.
2. **Любой ввод — это `Action`.** Человек, бизнес под управлением ИИ и госслужащий меняют мир только через `applyAction`. Чтение — через `ClientView` и `Query`.
3. **Движок — чистые функции.** Одинаково работает на сервере и в браузере: без сети, файлов, `Date` и `Math.random`. Поэтому игра показывается и без сервера (режим «Practice» в браузере).

## 2. Стек и папки

Node 20+, TypeScript (ESM, strict), npm workspaces, тесты — vitest, запуск TS — tsx. Без баз данных: мир в памяти и снимок в JSON. Клиент ходит на сервер обычными HTTP-запросами и опрашивает `view`; сокетов нет.

| Папка | Пакет | Что | Агент |
|---|---|---|---|
| корень, `scripts/`, `shared/` (кроме `types.ts` и `rules.ts`), `engine/src/niches/index.ts` | `@ohh/shared` | каркас, утилиты, склейка, деплой | 01 |
| `engine/src/economy/`, `engine/src/index.ts` | `@ohh/engine` | день и месяц бизнеса: спрос, зал, деньги, налоги | 02 |
| `engine/src/law/` | `@ohh/engine` | нарушения, жалобы, дела, проверки, взятки | 03 |
| `engine/src/analytics/` | `@ohh/engine` | аналитика, советы, план открытия, личный план | 04 |
| `engine/src/deals/` | `@ohh/engine` | сделки, фонд квартала, доли, места и призы | 13 |
| `ai/` | `@ohh/ai` | погода, события, советник, подбор ниши, разбор | 05 |
| `host/`, `server/` | `@ohh/host`, `@ohh/server` | мир, часы, вход, картина для каждого, HTTP | 06 |
| `bots/`, `sim/` | `@ohh/bots` | жители под управлением ИИ и проверка баланса | 07 |
| `client/` (корень), `src/app/`, `src/ui/`, `src/screens/home/`, `src/screens/start/` | `@ohh/client` | оболочка, базовый интерфейс, главная, вход, открытие | 08 |
| `data/`, `client/src/map/`, `client/src/screens/city/` | | карта, данные мест, экран города | 09 |
| `client/src/screens/business/` | | мой бизнес: сегодня, управление, книги, уведомления | 10 |
| `client/src/screens/insights/`, `client/src/screens/end/` | | аналитика, советник, таблицы, конец сезона и личный план | 11 |
| `client/src/screens/network/`, `client/src/screens/desk/` | | соседи и сделки, жалоба, стол госслужащего | 12 |
| `packs/cafe.json`, `packs/_common.json`, `engine/src/niches/cafe.ts` | | данные кафе и общие законы | 14 |
| `packs/barbershop.json`, `engine/src/niches/barbershop.ts` | | данные барбершопа | 15 |
| `packs/bodega.json`, `guesthouse.json`, `rentals.json` | | данные трёх ниш-карточек | 16 |

Пока каркаса агента 01 нет в основной ветке, каждый создаёт в своей папке минимальный `package.json` и работает автономно; типы импортирует из `shared/src/types.ts` относительным путём.

## 3. Движок

```ts
export interface EngineCtx { packs: PackSet; places: Place[] }

// engine/src/index.ts — агент 02: собирает модули в фиксированном порядке
export function createWorld(config: WorldConfig): WorldState
export function applyAction(w: WorldState, ctx: EngineCtx, playerId: string, a: Action): ActionResult
export function tickDay(w: WorldState, ctx: EngineCtx): WorldState          // один игровой день
export function netWorth(b: BusinessState, ctx: EngineCtx): Money

// каждый модуль экспортирует одинаковую четвёрку; чужое действие — вернуть null
// engine/src/economy/index.ts — 02
export function economyActions(w, ctx, playerId, a): ActionResult | null     // open_business, launch, set_orders, buy_item, sell_item, resize, spend(marketing|training), read_inbox
export function economyDay(w, ctx): WorldState
export function economyMonthClose(w, ctx): WorldState
// engine/src/law/index.ts — 03
export function lawActions(w, ctx, playerId, a): ActionResult | null         // report, answer_notice, take_case, dismiss_case, answer_bribe, spend(deep_clean|accountant)
export function lawDay(w, ctx): WorldState
export function lawMonthClose(w, ctx): WorldState
export function shortcutSavings(b: BusinessState, ctx: EngineCtx, base: { payroll: Money; revenue: Money; rent: Money; staffCount: number }, month: number): { lines: PnlLine[]; trails: ViolationTrail[] }
// engine/src/deals/index.ts — 13
export function dealActions(w, ctx, playerId, a): ActionResult | null        // propose_deal, answer_deal, cancel_deal; set_orders.blockFund проверяет экономика
export function dealModifiers(w, ctx, businessId): { cogsMult: number; demandMult: number; priceMult: number; footTrafficMult: number }
export function dealsDay(w, ctx): WorldState
export function dealsMonthClose(w, ctx): WorldState
export function computeStandings(w, ctx): Standing[]
export function finalizeSeason(w, ctx): WorldState                           // payouts, phase = 'ended'
// engine/src/analytics/index.ts — 04 (ничего не меняет в мире)
export function analyze(b, w, ctx): Analytics
export function recommend(b, w, ctx): Recommendation[]
export function recommendOpening(niche, placeId, w, ctx): OpenRecommendation[]
export function whatIf(w, ctx, businessId, orders: Partial<StandingOrders>): { projected: MonthReport; analytics: Analytics }
export function roadmapFor(niche, b: BusinessState | null, w, ctx): RoadmapItem[]
export function realWorldPlan(b, w, ctx): RealWorldPlan
export function managerOrders(b, w, ctx): Partial<StandingOrders>            // что сделал бы нанятый управляющий: безопасные советы, без нарушений
// engine/src/niches/<id>.ts — 14, 15
export interface NicheHooks { demandMult?(b, date: GameDate, pack): number; capacityDay?(b, pack): number | null; extraLines?(b, pack, month): PnlLine[]; kpis?(b, pack): NicheKpi[]; notes?(b, r: DayReport, pack): string[] }
export const hooks: NicheHooks
```

Все функции детерминированы и не мутируют вход. Чужого модуля ещё нет — заглушка по сигнатуре в `__stubs__/` своего модуля.

### Порядок одного игрового дня (`tickDay`)

1. `day += 1`; сдвиг прогноза погоды (сам прогноз кладёт в мир хост).
2. `dealsDay` — просроченные предложения.
3. `lawDay` — движение дел (раздел 5).
4. `economyDay` для каждого открытого бизнеса:
   - **Спрос дня** = месячный спрос ÷ 30 × множитель дня недели × `weather.footTrafficMult` × события × `dealModifiers`. Формула привлекательности — из `research/reports/43-economy-sim.md`, раздел 1, с весами `pack.market.weights` и `place.footTraffic`. Свойства (тесты): одинаковые бизнесы получают равные доли; рост своей цены на 1% снижает свой спрос примерно на `|priceElasticity|`%; если цены подняли все, рынок сжимается; бизнесы конкурируют только внутри ниши.
   - **Мощность дня.** `staffCap = Σ работников × unitsPerStaffMonth ÷ 30 × staffAvailability`. `sizeCap = size × unitsServedPerSizeMonth ÷ 30 ÷ (1 − takeawayShare)`. `served = min(спрос, staffCap, sizeCap, hardCap ÷ 30)`; закрытый по проверке бизнес не продаёт. Потери — в `lost.size`, `lost.staff`, `lost.closure`.
   - **Зал.** `size ≤ floor(place.sqft × USABLE_FLOOR_SHARE ÷ sqftPerUnit)`. Загрузка выше `crowdPenaltyAbove` — очередь: качество падает, запись в `notes`. Ниже `emptyPenaltyBelow` — пустой зал: репутация падает.
   - **Деньги дня:** выручка `served × price × priceMult`, себестоимость `served × cogsPerUnit × cogs-множители`. Собранный sales tax приходит в кассу и ложится в `liabilities`.
   - Запись `DayReport`, накопление `mtd`.
   - Бизнес в статусе `setup` не продаёт, но платит аренду с первого дня.
5. **Закрытие месяца** (день кратен 30), по порядку: `economyMonthClose` (зарплата, налоги на зарплату, аренда, строки `monthlyCosts`, рычаги, взнос в фонд квартала, зарплата управляющего, экономия от срезанных углов через `shortcutSavings`, налог на прибыль в `liabilities`, уплата долгов с наступившим сроком, `MonthReport`) → `dealsMonthClose` (платежи по займам, доля прибыли партнёрам, фонд квартала на следующий месяц, счёт надёжности) → `lawMonthClose` (давность следов, плановые проверки, внутренние расследования) → банкротство (`cash < 0`) → `computeStandings`.
6. Последний день сезона → `finalizeSeason`.

Каждый доллар — строка `PnlLine`; сумма строк месяца равна изменению кассы за месяц.

## 4. Сделки (агент 13)

Предложение живёт `DEAL_OFFER_DAYS`. Бизнесы под управлением ИИ отвечают по своим правилам (агент 07).

- **joint_purchase** — только одна ниша; пока активна, `cogsMult = JOINT_PURCHASE_COGS_MULT` у обоих.
- **cross_promo** — только разные ниши и расстояние до 400 м; `demandMult = CROSS_PROMO_DEMAND_MULT`, `priceMult = CROSS_PROMO_PRICE_MULT` у обоих.
- **loan** — деньги переходят сразу; равные платежи при закрытии месяца; нечем платить — сделка `broken`, у должника `trust.broken += 1`; банкротство должника — остаток пропал.
- **partnership** — деньги переходят в кассу бизнеса, вкладчик получает долю в `owners`; при закрытии месяца доля положительной прибыли уходит в бизнес вкладчика; доля участвует в призе.
- **Фонд квартала** — `orders.blockFund`; при закрытии месяца со всех согласных списывается `BLOCK_FUND_FEE_MONTH`; если их доля на улице (`place.block`) не меньше `BLOCK_FUND_THRESHOLD`, в следующем месяце `footTrafficMult = BLOCK_FUND_TRAFFIC_MULT` у всех на улице.
- Досрочный выход из сделки — `trust.broken += 1`; сделка, дошедшая до конца, — `trust.kept += 1` обоим.

**Места и призы.** Счёт бизнеса — `netWorth` = касса + `NET_WORTH_ITEMS_SHARE` × стоимость мебели и оборудования − неоплаченные `liabilities` − остаток долга. Места считаются внутри ниши. Призовой фонд `bank × prizeShare` делится между нишами по числу оплативших владельцев, внутри ниши — по `nichePrizeTable` между бизнесами людей (не ИИ, не банкроты); приз бизнеса делится между его владельцами по долям. `bank × officialsShare` — госслужащим-людям по очкам; разоблачённый получает 0.

## 5. Закон, жалобы и дела (агент 03)

- **След нарушения.** Включённый `shortcut`, вариант рычага с `causes`, работа без разрешения (`withoutItViolation`) каждый месяц растят `ViolationTrail`. След гаснет через `TRAIL_EXPIRY_MONTHS` после последнего нарушения.
- **Откуда берутся дела:** жалоба игрока (`report`, не чаще `REPORTS_PER_WEEK`), подозрительные цифры (налоги на зарплату малы для такого штата, выручка мала для такого потока), плановая проверка раз в `ROUTINE_INSPECTION_EVERY_MONTHS`.
- **Жизнь дела:** `open` → госслужащий берёт (`take_case`) или через `CASE_GRACE_DAYS` его берёт госслужащий под управлением ИИ → `taken`, проверка длится `INSPECTION_DAYS` → найдены все следы, которые относятся к роли проверяющего: случая нет.
  - Ничего не найдено: `closed`, `outcome: 'clean'`, очки `POINTS_EMPTY_INSPECTION`; если дело было по жалобе — жалобщику предупреждение, со второй ложной жалобы штраф `FALSE_REPORT_FINE`, и цель узнаёт его имя.
  - Найдено: `notice` владельцу — штраф `base + perMonth × months + pctOfSaved × saved` (не больше `max`) и `closureDays`. Ответ за `NOTICE_ANSWER_DAYS`: `pay`; `contest` (платит `CONTEST_FEE`, штраф × `CONTEST_FINE_MULT`); `bribe` с суммой. Молчание — `pay`.
  - Взятка: госслужащий отвечает за `BRIBE_ANSWER_DAYS`. Принял — штрафа нет, след остаётся, очки `POINTS_PER_BRIBE` за нарушение, `bribesThisMonth += 1`. Отказал или промолчал — штраф × `REFUSED_BRIBE_FINE_MULT`.
- **Очки:** `POINTS_PER_VIOLATION` за каждое найденное нарушение.
- **Внутренние расследования** при закрытии месяца: госслужащий с наибольшим числом взяток за месяц (если оно больше нуля) разоблачён — очки обнуляются, месяц без дел; каждый, кто дал ему взятку в этом месяце, платит штраф за взятку из `_common`.
- **Защита владельца:** `spend: deep_clean` гасит санитарные следы; `spend: accountant` гасит один налоговый след с доплатой сэкономленного без штрафа.
- Один госслужащий не берёт дело на один и тот же бизнес чаще, чем раз в `SAME_TARGET_COOLDOWN_DAYS`.

## 6. Хост и сервер (агент 06)

```ts
// host/src/index.ts — чистый TypeScript, работает и в браузере
export interface HostDeps { bots: BotBrain; forecast(seed: number, fromDay: number, days: number): DayWeather[]; deckEvent(w: WorldState, ctx: EngineCtx): GameEvent | null }
export function newWorld(config: WorldConfig, ctx: EngineCtx, deps: HostDeps): WorldState   // создаёт мир и заселяет бизнесами и госслужащими под управлением ИИ
export function join(w, p: { name: string; kind: 'owner' | 'official'; role?: OfficialRole }): { world: WorldState; playerId: string }
export function act(w, ctx, playerId, a: Action): ActionResult
export function step(w, ctx, deps: HostDeps): WorldState     // один игровой день: прогноз, события, ходы ИИ-жителей, управляющие, tickDay, сводки во входящие
export function viewFor(w, ctx, playerId: string | null): ClientView   // null → CityView
export function answer(w, ctx, playerId, q: Query): unknown   // синхронные запросы: recommend_opening, what_if, roadmap, real_world_plan
```

`viewFor` — единственное место, где решается, кто что видит: владелец получает свой бизнес целиком и только `PublicBusiness` соседей; госслужащий — `CaseCard` без чужих касс.

HTTP (`@ohh/server`, Express): `GET /api/health`; `GET /api/packs`; `GET /api/places`; `GET /api/worlds`; `POST /api/worlds` (демо-город); `POST /api/worlds/:id/join`; `GET /api/worlds/:id/view?v=<version>` (с токеном — вид игрока, без — `CityView`; версия та же — `{ "unchanged": true }`); `POST /api/worlds/:id/action`; `POST /api/worlds/:id/query` (`advisor`, `idea`, `debrief` идут в `@ohh/ai`); `POST /api/worlds/:id/clock` (пауза и скорость, только демо). Токен — заголовок `Authorization: Bearer`. При старте сервер держит два мира: живой `nyc` (48 минут на день) и `demo` (2 секунды на день). Снимок мира в JSON после каждого игрового дня, восстановление при перезапуске. В продакшене сервер раздаёт `client/dist`.

## 7. Жители под управлением ИИ (агент 07)

```ts
export interface BotBrain {
  populate(w: WorldState, ctx: EngineCtx, seed: number): { name: string; kind: 'owner' | 'official'; role?: OfficialRole; niche?: NicheId; placeId?: string; strategy: string }[]
  ownerActions(w: WorldState, ctx: EngineCtx, playerId: string): Action[]      // раз в игровой день
  officialActions(w: WorldState, ctx: EngineCtx, playerId: string): Action[]
}
```

Жители действуют только через `Action` и видят только то, что видел бы человек. Случайность — через сид.

## 8. ИИ (агент 05)

```ts
export function forecast(seed: number, fromDay: number, days: number): DayWeather[]      // чистая функция по климату Нью-Йорка, без сети
export function deckEvent(w: WorldState, ctx: EngineCtx): GameEvent | null               // запасное событие без ИИ
export function planEvents(input: { date: GameDate; weather: DayWeather[]; recent: GameEvent[]; niches: NicheId[]; blocks: string[] }): Promise<GameEvent[]>
export function askAdvisor(input: { question: string; business: BusinessState; analytics: Analytics; pack: Pack; common: CommonPack }): Promise<AdvisorAnswer>
export function interpretIdea(input: { text: string; packs: PackSet }): Promise<IdeaMatch>
export function writeDebrief(input: { business: BusinessState; analytics: Analytics; plan: RealWorldPlan; rank: number }): Promise<Debrief>
```

Функции с ИИ никогда не бросают исключение и отвечают не дольше 8 секунд; иначе — запасной путь (`origin: 'deck'` или `'rules'`). Событие объявляется не позже чем за `EVENT_NOTICE_DAYS` до начала и действует на всех одинаково; эффекты — только `EffectTarget` с множителем 0,7–1,3. Ключ API — только в окружении сервера. Без ключа игра работает полностью.

## 9. Клиент (агенты 08–12)

Vite + React + TypeScript, сначала ширина 390. Все обращения к игре — через интерфейс `GameClient` (`shared/src/types.ts`); его две реализации делает агент 08 в `client/src/app/`: `remote` (HTTP) и `local` (игра в браузере на `@ohh/host`). Стор хранит последний `ClientView` и опрашивает `view` раз в 2 секунды в демо и раз в 15 секунд в живом городе; хук `useView()`. Экраны ничего не считают сами.

Маршруты: `/` главная (`CityView`); `/start` идея → ниша → место → план открытия; `/biz` мой бизнес с вкладками Today, Manage, Books, Network, Insights; `/desk` стол госслужащего; `/city/:id` экран города для проектора; `/end` конец сезона и личный план; `/dev/<screen>` — любой экран на примерах данных без сервера. Каждый агент клиента держит свои примеры `ClientView` в `fixtures.ts` своей папки.

## 10. Готово — это когда

- `npm test` в твоём пакете зелёный, и в журнале записано, какой командой проверить.
- Публичные функции совпадают с сигнатурами этого файла.
- Чужие папки не тронуты.

## 11. Порядок вырезания

Если не успеваешь — режь в порядке раздела 9 файла `context/08-game-v5.md` и пиши об этом в журнал. Первая общая цель — проверка из его раздела 10: два человека в демо-городе открыли кафе, прошёл месяц, жалоба, проверка, штраф, кросс-промо, аналитика.
