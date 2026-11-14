# FORMATS — три формата кофейни: четыре механики

Задание A1 третьего захода (`build/ROUND3.md`). Исполнитель A1, 14 ноября 2026.
Данные: `packs/parts/cafe/D20-formats.json`. Калькулятор примеров: `node packs/parts/cafe/D20-examples.mjs`.

**Состояние документа:** первый пуш — сигнатуры и поля пакета (разделы 1–5). Примеры, проверки, экран, профили, таблица ожиданий и «что вырезать» — следующим пушем.

Читают: B01 (`service`), B02 (`segments`), B03 (`staffing`), B04 (`regulars`), B07 (аналитика), B11 (жители), G1 (`sim/audit/diversity.ts`).

---

## 1. Общее для четырёх механик

### 1.1. Что уже считает движок — не учитывать дважды

| Что | Где | Следствие для частей |
|---|---|---|
| Спрос от прохожих, цена (`footfall.priceSensitivity` 2.7), качество, репутация, реклама, делёж потока с соседями | `engine/src/economy/demand.ts`, `footfallDemand` | `segments.demandMult` считает только **отклонение** групп от среднего покупателя. При эталонной цене, качестве 0.5 и эталонном зале он равен ровно 1 |
| Узнаваемость нового заведения: 35% в первый день, постоянная времени 75 дней | `shared/src/place.ts`, `awarenessAt` | `regulars.demandMult` не растит спрос «за возраст» у средней кофейни: у кофейни с качеством 0.5 и репутацией 0.5 он равен ровно 1 в любой месяц |
| Якоря места по дням недели и месяцам (метро, колледж, парк) | `anchorDayMult` | `segments` меняет **состав** гостей по дню недели и месяцу, но не общий объём: сумма долей всегда 1 |
| День недели из пакета | `weekdayMult`; выключается, когда у ниши есть `demandMult` | у кафе после B02 профиль недели приходит только из якорей и состава гостей |
| Предел людей `staff × 1,700 / 30` и предел мест `size × 170 / 30 / (1 − takeaway)` | `day.ts` | заменяются ответом `capacityDay`; старое деление на `(1 − takeaway)` — та самая ошибка |
| Качество: `0.5 + наборы + рычаги + обучение + qualityDelta − теснота − нехватка людей` | `day.ts`, `tradeDay` | `staffing.qualityDelta` добавляет только вклад состава команды |
| Репутация теряет `0.6 × доля потерянных` | `day.ts` | очередь бьёт по репутации уже сейчас; `segments` берёт только разницу в терпении групп |

### 1.2. Тип места

У `Place` нет поля «тип квартала». Тип выводится из якорей (`place.anchors`), яруса и потока. Общая чистая функция живёт в `segments.ts`, остальные части берут её оттуда:

```ts
// engine/src/niches/cafe/segments.ts
export type BlockType = 'residential' | 'office' | 'campus' | 'tourist';
/** Веса четырёх типов квартала у этого места, сумма 1. Без места или без якорей — { residential: 1 }. */
export function blockWeights(place: Place | undefined, pack: Pack): Record<BlockType, number>;
/** Тип с наибольшим весом — для подписи на экране и для таблицы ожиданий. */
export function blockTypeOf(place: Place | undefined, pack: Pack): BlockType;
```

Правило весов — раздел 2.

### 1.3. Порядок расчёта дня (после подключения всех частей)

1. `footfallDemand` — месячный спрос от потока, цены, качества, соседей (ведущий, готово).
2. `demandMult` — произведение частей: `segments` (подходит ли предложение сегодняшним гостям) × `regulars` (постоянные) × `staffing` нет (покрытие часов идёт через предел, шаг 4).
3. Спрос дня `dem` = месячный / 30 × погода × события × якоря × `demandMult`.
4. `capacityDay` — наименьший из ответов: `service` (пик, очередь, места, скорость команды) и `staffing` (покрытие часов работы).
5. `served = min(dem, capacity)`; потерянное — в `lost`.
6. `qualityDelta` — `staffing` (состав команды) + `service` (теснота в пик).
7. `notes`, `kpis` — все четыре части.

### 1.4. Правила для всех частей

- Вход — `CafeDay` (`b`, `pack`, `place`, `date`, `day`, `demand`) из `contract.ts`. Состояния нет: всё считается из `b.orders`, `b.size`, `b.quality`, `b.reputation`, `b.days`, `b.history`, `b.openedDay`.
- Нет раздела `pack.extra.<ключ>` — часть возвращает пустой `CafePart` (или нейтральные значения: 1, `null`, 0).
- Чтение пакета: `const cfg = (pack.extra as { service?: ServiceCfg } | undefined)?.service`.
- Случая нет. Доли ушедших из очереди — это доли потока, а не вероятности: результат дня определён входом.

---

## 2. `segments` — группы гостей (B02)

Файл `engine/src/niches/cafe/segments.ts`, ключ `extra.guestSegments`.

### 2.1. Сигнатуры

```ts
export interface SegmentCfg {
  id: 'office' | 'residents' | 'students' | 'tourists';
  name: string;
  sitShare: number;        // доля группы, которая садится
  morningShare: number;    // доля заказов группы в утренний пик (7–10)
  dwellHours: number;      // сколько часов занимает место один севший (читает service.ts)
  priceShift: number;      // добавка к чувствительности к цене против среднего покупателя (0 — как средний)
  qualityShift: number;    // добавка к весу качества
  seatPull: number;        // насколько группе важна посадка
  waitPull: number;        // насколько группе важна скорость
  regularShare: number;    // доля группы, которая может стать постоянной (читает regulars.ts)
  week: number[7];         // профиль недели Пн..Вс, сумма 7
  months: number[12];      // профиль года Янв..Дек, среднее 1
}
export interface GuestSegmentsCfg {
  segments: SegmentCfg[];
  mixByBlock: Record<BlockType, Record<string, number>>;   // доли групп для «чистого» типа квартала, сумма 1
  blockRules: {                                            // как якоря места дают веса типов
    residentialBase: number;
    office: { anchor: 'subway'; reachM: number; ridersRef: number; maxWeight: number };
    campus: { anchor: 'college'; reachM: number; weight: number };
    tourist: { museum: number; plaza: number; park: number; reachM: number };
  };
  tierPriceShift: Record<'prime' | 'mid' | 'cheap', number>;  // ярус места двигает чувствительность жителей к цене
  refSeats: number;          // зал, при котором посадка «как у всех» (sizing.default)
  seatSpan: number;          // на сколько мест от эталона эффект посадки насыщается
  waitWindowDays: number;    // за сколько последних дней считается доля ушедших из очереди
  multBounds: [number, number];
}

/** Кто придёт сегодня. Имя и сигнатуру читает service.ts — не менять. */
export function guestMix(d: CafeDay): GuestMix;
/** То же с параметрами групп: для service.ts (dwellHours) и regulars.ts (regularShare). */
export function guestMixDetailed(d: CafeDay): { id: string; share: number; cfg: SegmentCfg }[];
/** Подходит ли предложение сегодняшним гостям. Эталонная кофейня получает ровно 1. */
export function segmentFit(d: CafeDay): { mult: number; byGroup: { id: string; share: number; fit: number }[] };
export const part: CafePart;   // demandMult, kpis, notes
```

### 2.2. Поля пакета `extra.guestSegments`

`segments[4]` (поля выше), `mixByBlock` (4 типа × 4 группы), `blockRules`, `tierPriceShift`, `refSeats`, `seatSpan`, `waitWindowDays`, `multBounds`, `source`, `confidence`, `note`.

---

## 3. `service` — места и навынос, пик, очередь (B01)

Файл `engine/src/niches/cafe/service.ts`, ключ `extra.service`.

### 3.1. Сигнатуры

```ts
export interface ServiceCfg {
  rushHours: number[];             // часы пика: [7, 8, 9]
  rushHourWeights: number[];       // как пик делится по этим часам, сумма 1
  peak15Factor: number;            // час / (4 × самая плотная четверть часа)
  machineOrdersPerHour: number;    // потолок машины и кофемолок
  walkAwayByLine: { upTo: number; share: number }[];   // доля приходящих, которая уходит при такой очереди
  seatPeakHourShare: number;       // доля дневных посадок в самый занятый час
  seatFill: number;                // какую долю мест удаётся занять в этот час (столы на двоих, одиночки)
  noSeatTakesAway: number;         // доля тех, кому не хватило места, но кто взял с собой
  sitInLaborMult: number;          // заказ в зале против заказа навынос по труду (посуда, уборка стола)
  crowdQualityDrop: number;        // вычет из качества, когда в пик занято больше crowdAbove мест
  crowdAbove: number;
}
export interface ServiceDay {
  demand: number;
  served: number;
  rush: { orders: number; served: number; line: number; waitMin: number; walked: number };
  seats: { wanted: number; seated: number; tookAway: number; left: number; turns: number; peakUse: number };
  lostLabor: number;               // не хватило часов труда за день
  bound: 'none' | 'rush' | 'seats' | 'labor';
}
/** Весь день по шагам: пик, очередь, места, дневной предел труда. Чистая функция. */
export function serviceDay(d: CafeDay): ServiceDay | null;   // null — в пакете нет extra.service
export const part: CafePart;   // capacityDay (= serviceDay.served, без ограничения — null), qualityDelta, kpis, notes
```

Читает: `guestMix(d)` и `guestMixDetailed(d)` из `./segments`, `staffPower(d)` из `./staffing`.

### 3.2. Поля пакета `extra.service`

`rushHours`, `rushHourWeights`, `peak15Factor`, `machineOrdersPerHour`, `walkAwayByLine[]`, `seatPeakHourShare`, `seatFill`, `noSeatTakesAway`, `sitInLaborMult`, `crowdQualityDrop`, `crowdAbove`, `source`, `confidence`, `note`.

---

## 4. `staffing` — роли, навык, покрытие смен (B03)

Файл `engine/src/niches/cafe/staffing.ts`, ключ `extra.staffing`.

### 4.1. Сигнатуры

```ts
export interface RoleCfg {
  speed: number;          // скорость против обученного бариста (1)
  quality: number;        // вклад одного такого работника в качество, взвешивается по доле в команде
  lead?: boolean;         // ведёт смену
  trainee?: boolean;      // учится: скорость зависит от того, есть ли старший
  speedWithLead?: number; // скорость стажёра, когда в команде есть старший
}
export interface StaffingCfg {
  roles: Record<string, RoleCfg>;       // по id роли из pack.staff; роли нет в списке — { speed: 1, quality: 0 }
  ordersPerPaidHour: number;            // заказов на оплаченный час обученного бариста в среднем за месяц
  rushOrdersPerPersonHour: number;      // заказов в час на одного человека у бара в пик
  rushCrewShare: number;                // какая доля команды стоит в утренний пик
  minOnFloor: number;                   // сколько человек должно быть в зале каждый открытый час
  leadNeededFrom: number;               // с какого числа работников без старшего падают скорость и качество
  leadSpan: number;                     // сколько человек держит один старший
  noLead: { speedMult: number; quality: number };
  openHoursPerDay: Record<string, number>;   // по варианту рычага hours: { standard: 12, long: 16 }
  ownerHoursPerMonth: number;           // часы владельца за стойкой (при autopilot 'manager' — часы управляющего)
  uncoveredHourWeight: number;          // непокрытый час несёт такую долю среднего часа спроса
}
export interface TeamCoverage { neededHours: number; paidHours: number; coveredShare: number; lostDemandShare: number }
/** Скорость и качество сегодняшней команды. Имя и сигнатуру читает service.ts — не менять. */
export function staffPower(d: CafeDay): StaffPower;
/** Часы открытия против часов людей. */
export function coverage(d: CafeDay): TeamCoverage;
export const part: CafePart;   // capacityDay (покрытие), qualityDelta, kpis, notes
```

### 4.2. Поля пакета `extra.staffing`

`roles{}`, `ordersPerPaidHour`, `rushOrdersPerPersonHour`, `rushCrewShare`, `minOnFloor`, `leadNeededFrom`, `leadSpan`, `noLead`, `openHoursPerDay`, `ownerHoursPerMonth`, `uncoveredHourWeight`, `newRoles[]` (записи для `pack.staff`: `trainee_barista`), `source`, `confidence`, `note`.

---

## 5. `regulars` — постоянные гости (B04)

Файл `engine/src/niches/cafe/regulars.ts`, ключ `extra.regulars`.

### 5.1. Сигнатуры

```ts
export interface RegularsCfg {
  tenureMonths: number;        // постоянная времени роста базы
  maxLift: number;             // потолок прибавки спроса у лучшей кофейни там, где все гости могут стать постоянными
  qualitySpan: number;         // отклонение качества и репутации от 0.5, при котором прибавка достигает потолка
  priceStepFree: number;       // рост цены за месяц, который проходит без ухода
  priceLossPerPoint: number;   // доля постоянных, уходящая за каждый пункт роста сверх порога
  priceLossMax: number;
  priceMemoryMonths: number;   // сколько месяцев держится обида на цену
  closureLossPerDay: number;   // доля постоянных, уходящая за каждый день закрытия по проверке
  closureLossMax: number;
  closureMemoryMonths: number;
  multBounds: [number, number];
}
export interface RegularsState {
  potential: number;     // доля сегодняшних гостей, которая может быть постоянной (из guestMixDetailed)
  share: number;         // доля постоянных в заказах сейчас
  lift: number;          // прибавка или вычет за качество и репутацию
  priceLoss: number;     // вычет за скачок цены
  closureLoss: number;   // вычет за закрытие
  mult: number;
  why: string[];
}
export function regularsState(d: CafeDay): RegularsState | null;   // null — в пакете нет extra.regulars
export const part: CafePart;   // demandMult, kpis, notes
```

### 5.2. Поля пакета `extra.regulars`

`tenureMonths`, `maxLift`, `qualitySpan`, `priceStepFree`, `priceLossPerPoint`, `priceLossMax`, `priceMemoryMonths`, `closureLossPerDay`, `closureLossMax`, `closureMemoryMonths`, `steadyShareTarget`, `multBounds`, `source`, `confidence`, `note`.

---

## 6. Профили `extra.profiles`

```ts
export interface CafeProfile {
  id: 'takeaway' | 'neighborhood' | 'specialty';
  name: string; pitch: string;
  size: number;                      // мест
  price: number;                     // средний чек, $
  staff: Record<string, number>;
  levers: Record<string, string>;
  kit: string;                       // id набора из pack.kits
  sqft: [number, number];            // какая площадь подходит
  bestOn: BlockType[]; risk: string;
}
```

Числа — следующим пушем.
