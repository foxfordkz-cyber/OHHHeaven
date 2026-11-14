# EVENTS — события каталога в игре: спецификация первой версии

Задание A3 третьего захода (`build/ROUND3.md`). Исполнитель A3, 14 ноября 2026.
По этому файлу работают B05 (движок), B09 (хост и сервер), B10 (ИИ), B14 (клиент).

Данные: `packs/next/cafe.events.json`. Пересборка: `node packs/next/build-events.mjs`.

**Главная мысль.** Событие каталога превращается в обычный `GameEvent`. Множители, которые движок уже понимает, идут старым путём (`eventMult`) без единой правки `day.ts`. Всё новое — разовые деньги, дни закрытия, нарушение, ход игрока — считает один новый файл `engine/src/economy/catalog.ts`. Пока его не подключили, каталог уже работает наполовину и ничего не ломает.

---

## 1. Поля эффектов первой версии

В каталоге 698 событий и 104 разных поля эффектов. В первой версии — **12 полей**. Событие попадает в `cafe.events.json`, только если после сведения у него остался хотя бы один эффект из этих 12.

### 1.1. Список

| # | Поле | Операция | Что делает | Кто считает |
|---|---|---|---|---|
| 1 | `demand` | `mult` | спрос кофейни | движок сейчас (`eventMult`) |
| 2 | `footTraffic` | `mult` | прохожие у двери | движок сейчас |
| 3 | `cogs` | `mult` | себестоимость заказа | движок сейчас |
| 4 | `wages` | `mult` | фонд оплаты труда | движок сейчас |
| 5 | `rent` | `mult` | строка аренды | движок сейчас |
| 6 | `utilities` | `mult` | строка коммунальных | движок сейчас |
| 7 | `staffAvailability` | `mult` | сколько заказов успевает команда | движок сейчас |
| 8 | `cash` | `add`, доллары | разовые деньги: минус — ушли, плюс — пришли | `catalog.ts`, строка `PnlLine` |
| 9 | `closureDays` | `add`, дни | кофейня закрыта столько дней с начала события | `catalog.ts` |
| 10 | `violation` | `id` | открывает след нарушения из пакета; штраф придёт обычным путём — через проверку | `catalog.ts` |
| 11 | `quality` | `add`, доля | прибавка к цели качества на время события | `catalog.ts` → `qTarget` |
| 12 | `reputation` | `add`, доля | прибавка к цели репутации на время события | `catalog.ts` → `rTarget` |

Правила для чисел:

- `mult` — от 0,5 до 1,5 (так движок режет и сейчас: `clipMult`). Множитель вне диапазона в файл не попадает: скрипт отбора выбрасывает эффект и пишет об этом в журнал отбора.
- `mult` действует каждый день события. Калибровщики D15–D17 уже пересчитали короткие события в месячный множитель («три дня закрыто из тридцати» → `demand` 0,9); у таких эффектов в каталоге стоит `engine: true`.
- `cash` платится один раз. Когда — поле `when`: `start` (в первый день события, по умолчанию), `monthly` (в каждое закрытие месяца, пока событие идёт), `end` (в последний день).
- `quality` и `reputation` — от −0,15 до +0,15 на одно событие. Это прибавка к **цели**, к которой качество и репутация ползут сами (`QUALITY_INERTIA`, `REPUTATION_INERTIA`); скачка нет.
- `violation` принимает только `id`, который есть в `pack.violations` или в `_common.violations`. Сумму штрафа событие не задаёт: её считает модуль закона.
- У любого эффекта может стоять `tiers` — как у `EventEffect` сейчас. Других условий у эффекта в первой версии нет.

Порядок подключения, если ведущему не хватит времени: 1–7 работают сразу; затем 8 (`cash`), 9, 10; последними 11 и 12. Событие, у которого после сведения остались только `quality` или `reputation`, в файл не попадает — чтобы ни одно событие не оказалось пустым, если 11 и 12 не подключат.

### 1.2. Как остальные поля сводятся к этим двенадцати

| Поле каталога | Событий | Что с ним делает скрипт отбора |
|---|---|---|
| `cashOut` с числом | 72 | → `cash` со знаком минус. С формулой вместо числа — отложено |
| `cashIn` | 7 | → `cash` со знаком плюс; ноль выбрасывается |
| `fine` с числом | 20 | → `cash` минус, строка вида `fine` |
| `oneTimeCost` (поле события) | 27 | → `cash` минус, `when: start` |
| `monthlyCost`, `monthlyFees` с числом | 21 | → `cash` минус, `when: monthly` |
| `capacity` | 15 | → `staffAvailability` с тем же множителем: в движке это один и тот же предел (`staffCap × staffAvailability × capacityMult`) |
| `downtimeDays` (поле события или эффект) | 21 | → `closureDays` |
| `violationAccrual`, `violationExposure` | 17 | → `violation`, если `id` есть в пакете; ежедневное начисление отложено |
| `inspections` | 38 | отложено: это `EffectTarget`, но модуль закона его не читает. Эффект выбрасывается, событие остаётся, если есть другие |
| `deliveryShare` | 12 | отложено: читается только в старом пределе зала, который заменяет часть `service` (B01) |
| `openingDelayDays`, `permitWaitDays`, `setupCost`, `buildoutCost`, `setupRentDays`, `freeRentMonths`, `leaseSigningDelayDays`, `equipmentCost`, `takeoverPrice`, `depositMonths` | 103 | отложено до механики «месяцы до открытия» (`MERGE.md`, механика 2). Событие действует на бизнес в состоянии `setup`, а первая версия считает только открытые кофейни |
| `ownerHours`, `ownerDebt`, `ownerNetWorth`, `ownerDraw`, `ownerEarnings`, `ownerHealthInsurance`, `ownerFine` | 29 | отложено: у владельца нет часов и личного кошелька. В ходе игрока `ownerHours` остаётся подписью без расчёта |
| `salePrice`, `saleMultiple`, `askingPrice`, `saleBlocked`, `closingDelayDays`, `closingDelayMonths`, `ownershipShare` | 13 | отложено до выхода из бизнеса (B08) |
| `cashDelayDays`, `cashFrozenDays`, `cashFrozen`, `cashTiming`, `cashShift`, `cashFloat`, `payrollCash`, `salesTaxDue`, `taxableProfit` | 16 | отложено до календаря платежей (`MERGE.md`, механика 6) |
| `rent` с `add` или формулой, `rentAdd`, `renewalRentMult`, `rentFormula`, `leaseEndsInMonths`, `evictionClockDays`, `defaultNotice` | 12 | отложено до жизни договора аренды (механика 10). `rent` с `mult` в диапазоне остаётся |
| `seats`, `seatTurnover`, `outdoorSeats`, `eveningHours`, `icedShare` | 20 | отложено: это вход частей `service` и `segments` (B01, B02) |
| `awareness`, `hiringPool`, `insurance`, `workersComp`, `unemploymentTax`, `cardFees`, `cardFixedFee`, `deliveryCommission`, `loanRate`, `loanAvailable`, `price`, `fairPrice`, `minimumWage` и остальные поля с одним-двумя событиями | 60 | отложено |

Эффект с текстовым условием (`onlyIf`, `appliesIf`, `appliesTo`, `contingent`, `unit`, `on`, `byTier`, `formats`) в первой версии выбрасывается: движок не умеет проверять фразу. Условие `tiers` остаётся.

Полный протокол — что выброшено у каждого события и почему — скрипт пишет в `packs/next/cafe.events.log.json`.

---

## 2. Запуск без случая

*Раздел в работе, будет во втором пуше.*

## 3. Ход игрока внутри события

*Раздел в работе, будет во втором пуше.*

---

## 4. Формы данных

Все новые поля необязательные. Старые события (`origin: 'deck'`, `origin: 'ai'`) и старые экраны работают без правок.

### 4.1. Запись каталога — `CatalogEvent`

Живёт в `packs/next/cafe.events.json` (`{ version, niche, fields, events: CatalogEvent[] }`), в `Pack` не входит и отдаётся отдельным запросом (B09).

```ts
// shared/src/types.ts — дополнения. Меняет ведущий; до тех пор B05 держит копию типов в engine/src/economy/catalog.ts.

export type CatalogScale = 'point' | 'block' | 'city' | 'country' | 'world';

export type CatalogField =
  | 'demand' | 'footTraffic' | 'cogs' | 'wages' | 'rent' | 'utilities' | 'staffAvailability'   // mult
  | 'cash'                                                                                      // add, доллары
  | 'closureDays'                                                                               // add, дни
  | 'violation'                                                                                 // id
  | 'quality' | 'reputation';                                                                   // add, доля

export interface CatalogEffect {
  field: CatalogField;
  mult?: number;                       // для семи множителей: 0,5–1,5
  add?: number;                        // cash — доллары со знаком; closureDays — дни; quality, reputation — доля
  id?: string;                         // violation — id из pack.violations или _common.violations
  when?: 'start' | 'monthly' | 'end';  // только cash; по умолчанию start
  line?: PnlKind;                      // только cash: вид строки; по умолчанию 'other', для штрафа 'fine'
  tiers?: PlaceTier[];                 // как у EventEffect
  note?: string;                       // расчёт числа словами
}

/** Ход игрока: предлагается, только когда событие объявлено. Выбранный ход заменяет эффекты события своими. */
export interface EventMove {
  id: string;                          // уникален внутри события; 'ride_out' — ход по умолчанию
  label: string;                       // строка для игрока, английский
  cost: { cash: Money; monthly?: Money; ownerHours?: number };   // cash — сразу; monthly — в каждое закрытие месяца события
  effects: CatalogEffect[];            // что действует ВМЕСТО эффектов события
  byDay?: number;                      // до какого дня события ход ещё можно выбрать (1 — только до начала); нет — в любой день
  requires?: CatalogRequires;          // кому ход доступен
  note?: string;
}

/** Условие на бизнес. Все заданные поля должны совпасть. */
export interface CatalogRequires {
  lever?: { id: string; optionId: string };   // стоит этот вариант рычага
  shortcut?: string;                           // включён этот срезанный угол
  tiers?: PlaceTier[];
  minStaff?: number;
  minSize?: number;
  status?: BusinessState['status'][];          // по умолчанию ['open']
}

export interface CatalogEvent extends Sourced {
  id: string;                          // id из каталога D11, не меняется при пересборке
  name: string; text: string;          // строки для игрока, английский
  kind: GameEvent['kind'];             // для значка и для правила «не два события одного вида сразу»
  scale: CatalogScale;
  tier: 'core' | 'deep';
  months: number[];                    // месяцы года, когда событие может начаться, 1–12
  durationMonths: number;              // как в каталоге; 0 — один день
  durationDays?: number;               // если событие короче месяца; иначе durationMonths × 30
  noticeDays: number;                  // за сколько дней объявить; не меньше RULES.EVENT_NOTICE_DAYS
  effects: CatalogEffect[];            // что будет, если ничего не делать
  moves: EventMove[];                  // от двух; первый всегда 'ride_out' с нулевой ценой и эффектами события
  requires?: CatalogRequires;          // кого касается событие точки
  signal?: string;                     // настоящий показатель, по которому событие узнают в жизни (подпись на карточке)
  weather?: WeatherCondition[];        // событие стартует только в день с такой погодой по прогнозу
}
```

### 4.2. Событие в мире — дополнения к `GameEvent`

```ts
export interface GameEvent {
  /* … всё, что есть сейчас … */
  origin: 'ai' | 'deck' | 'catalog';   // новое значение
  catalogId?: string;                  // id записи каталога
  scale?: CatalogScale;                // нет поля — как сейчас: город или улица (block)
  businessId?: string;                 // событие точки: кого касается
}
```

Как хост заполняет `GameEvent` из `CatalogEvent`:

| Масштаб | `effects: EventEffect[]` | `block` | `businessId` |
|---|---|---|---|
| `world`, `country`, `city` | семь множителей события (`niches: ['cafe']`) | нет | нет |
| `block` | семь множителей события | улица по расписанию | нет |
| `point` | **пусто** | нет | кофейня по расписанию |

Поэтому старый `eventMult` сразу применяет множители событий от улицы и выше, а событие точки не задевает чужие кофейни. Всё остальное — множители событий точки, поправка на выбранный ход, `cash`, `closureDays`, `violation`, `quality`, `reputation` — считает `catalog.ts` по `catalogId`. Дважды ничего не считается: `catalog.ts` никогда не возвращает базовые множители событий от улицы и выше.

### 4.3. Выбор игрока

```ts
// Action — новое действие (добавляет ведущий)
| { type: 'event_move'; eventId: string; moveId: string }

// До правки Action и после неё выбор хранится в бизнесе:
// b.extra.events = { [eventId]: { moveId: string; day: number; paid: Money } }
export interface EventChoice { moveId: string; day: number; paid: Money }
```

Ход выбирается один раз на событие и не отменяется. Не выбрал — действует `ride_out`.

### 4.4. Что клиент получает для карточки

```ts
// OwnerView — необязательное поле (добавляет ведущий; до тех пор клиент собирает его сам из events и каталога)
eventCards?: EventCard[];

export interface EventCard {
  eventId: string; catalogId: string; scale: CatalogScale;
  title: string; text: string; signal?: string; source?: string; confidence?: 'verified' | 'estimate';
  announcedDay: number; startDay: number; endDay: number;
  effects: CatalogEffect[];                                  // что будет без хода
  moves: (EventMove & { available: boolean; why?: string; costNow: Money })[];
  chosen?: EventChoice;
}
```

---

## 5. Сигнатуры

*Раздел в работе, будет во втором пуше.*

## 6. Пример по дням с деньгами

*Раздел в работе.*

## 7. Проверки

*Раздел в работе.*
