# FORMATS — три формата кофейни: четыре механики

Задание A1 третьего захода. Исполнитель A1, 14 ноября 2026.

- Данные: `packs/parts/cafe/D20-formats.json` — разделы `extra.guestSegments`, `extra.service`, `extra.staffing`, `extra.regulars`, `extra.profiles`.
- Калькулятор: `node packs/parts/cafe/D20-examples.mjs`. Он печатает все таблицы этого документа из `packs/cafe.json`, `packs/_common.json`, `data/places.json` и `D20-formats.json`. Четыре механики написаны в нём так, как их нужно написать в `engine/src/niches/cafe/*.ts`: это образец расчёта, его можно переносить построчно. Эталонный месяц пакета он воспроизводит до $2 ($9,721 против $9,719).
- Читают: B01 (`service`), B02 (`segments`), B03 (`staffing`), B04 (`regulars`), B07, B11, B12–B15, G1.

**Главный вывод.** Три формата жизнеспособны, но делит их не только тип квартала, а тип квартала вместе с размером двери и ярусом аренды. На 116 витринах карты: районная с посадкой выигрывает на 81 двери, specialty — на 30, навынос — на 5 (все пять — двери, куда не помещается и 12 мест). Настоящего офисного квартала на карте Ист-Виллиджа нет: у самой «офисной» двери 49% гостей — офисные. Подробно — разделы 7 и 8.

---

## 1. Общее для четырёх механик

### 1.1. Что уже считает движок — не учитывать дважды

| Что | Где | Следствие для частей |
|---|---|---|
| Спрос от прохожих, цена (`footfall.priceSensitivity` 2.7), качество (0.93 на единицу), репутация (0.74), реклама, делёж потока с соседями | `engine/src/economy/demand.ts`, `footfallDemand` | `segments` считает только **отклонение** групп от среднего покупателя. У эталонной кофейни (цена $8.50, качество 0.5, 18 мест, никто не ушёл из очереди) соответствие равно ровно 1 |
| Узнаваемость нового заведения: 35% в первый день, постоянная времени 75 дней | `shared/src/place.ts`, `awarenessAt` | `regulars` не растит спрос «за возраст»: у кофейни с качеством 0.5 и репутацией 0.5 множитель равен ровно 1 в любой месяц |
| День недели из пакета (`extra.weekdayMult`) | `weekdayMult`; движок выключает его, когда у ниши есть `demandMult` | профиль недели и года после B02 даёт `segments` (`volume`, раздел 2.3) |
| Якоря места: метро по будням, колледж летом, парк | `anchorDayMult` | пересекается с профилями групп. Просьба к ведущему № 3: оставить в `anchorDayMult` для кафе только парк, больницу и музей |
| Предел людей `staff × 1,700 / 30` и предел мест `size × 170 / 30 / (1 − takeaway)` | `day.ts` | заменяются ответом `capacityDay`. Деление на `(1 − takeaway)` — та самая ошибка |
| Качество: `0.5 + наборы + рычаги + обучение + qualityDelta − теснота − нехватка людей` | `day.ts`, `tradeDay` | `staffing.qualityDelta` добавляет только вклад состава команды |
| Репутация теряет `0.6 × доля потерянных` | `day.ts` | очередь уже бьёт по репутации; `segments` берёт только разницу в терпении групп |
| Рычаг `staff_pay: above` даёт `capacity +0.04` | `leverEffects`, но только в старом пределе людей | `staffing.staffPower` умножает скорость на `leverEffects(b, pack).capacityMult` сам |

### 1.2. Тип места

У `Place` нет типа квартала, и все места карты — Ист-Виллидж. Тип выводится из якорей (`place.anchors`). Общие функции живут в `segments.ts`:

```ts
// engine/src/niches/cafe/segments.ts
export type BlockType = 'residential' | 'office' | 'campus' | 'tourist';
/** Веса четырёх типов квартала у этого места, сумма 1. Без места или без якорей — { residential: 1, остальные 0 }. */
export function blockWeights(place: Place | undefined, pack: Pack): Record<BlockType, number>;
/** Тип с наибольшим весом — для подписи на экране и для таблицы ожиданий. */
export function blockTypeOf(place: Place | undefined, pack: Pack): BlockType;
```

Правило (`extra.guestSegments.blockRules`), `близость = max(0, 1 − distM / reachM)`:

- `residential = 1` всегда;
- `office = min(8, Σ по станциям метро ближе 250 м: ridersPerDay / 2,500 × близость)`; у якоря без `ridersPerDay` берётся 2,500;
- `campus = 8 × близость` ближайшего колледжа (радиус 400 м);
- `tourist = max(музей 8, площадь 6, парк 2) × близость` (радиус 200 м);
- веса делятся на их сумму.

На карте это даёт 67 жилых, 10 офисных, 23 у кампуса и 16 туристических витрин. Состав гостей — смесь четырёх «чистых» составов `mixByBlock` по этим весам.

### 1.3. Порядок расчёта дня

1. `footfallDemand` — месячный спрос от потока, цены, качества, соседей (готово).
2. `demandMult` — произведение частей: `segments` (`volume × fit`) × `regulars`.
3. Спрос дня `dem` = месячный / 30 × погода × события × якоря × рычаги × `demandMult`.
4. `capacityDay` — наименьший из ответов `staffing` (покрытие часов) и `service` (пик, места, труд).
5. `served = floor(min(dem, capacity))`; остальное — в `lost`.
6. `qualityDelta` — `staffing` (состав команды) + `service` (теснота в пик).
7. `notes`, `kpis` — все четыре части.

`service` получает в `d.demand` спрос **до** вычета непокрытых часов. Чтобы не потерять их дважды и не забыть, `service` сам вызывает `coverage(d)` из `./staffing` и считает день от `d.demand × (1 − lostDemandShare)`; `staffing.capacityDay` возвращает то же число `d.demand × (1 − lostDemandShare)`. Наименьший из двух ответов — ответ `service`, и он уже учитывает часы.

### 1.4. Правила для всех частей

- Вход — `CafeDay` из `contract.ts`. Состояния нет: всё считается из `b.orders`, `b.size`, `b.quality`, `b.reputation`, `b.days`, `b.history`, `b.openedDay`.
- Нет раздела `pack.extra.<ключ>` — часть равна `{}`. Проверять в начале каждой функции: `const cfg = (pack.extra as { service?: ServiceCfg } | undefined)?.service; if (!cfg) return null`.
- `kpis(b, pack)` и `notes(b, r, pack)` не получают место и дату. День берите из отчёта (`dateOf(r.day)`). Места нет: до выполнения просьбы к ведущему № 1 считайте в них состав гостей как у жилого квартала (`blockWeights(undefined)`) и показывайте только то, что от места не зависит. Запоминать место между вызовами нельзя: состояния нет.
- Случая нет. Доли ушедших из очереди — доли потока, а не вероятности.

---

## 2. `segments` — группы гостей (B02)

Файл `engine/src/niches/cafe/segments.ts`, ключ `extra.guestSegments`.

### 2.1. Решение игрока

Новой кнопки нет. Игрок читает состав гостей на карточке места до подписания аренды и под него выбирает цену, число мест, набор и рычаги. Одна и та же кофейня получает разный спрос у метро, у колледжа и у музея.

### 2.2. Поля пакета

| Группа | Доля садится | Доля в пик 7–10 | Сидит, часов | Цена | Качество | Посадка | Скорость | Может стать постоянным |
|---|---|---|---|---|---|---|---|---|
| `office` — офисные | 0.10 | 0.55 | 0.25 | +2.7 | −1.2 | 0.03 | 2.0 | 0.55 |
| `residents` — жители (с удалёнщиками) | 0.53 | 0.38 | 0.75 | +0.4 | −0.4 | 0.20 | 0.5 | 0.65 |
| `students` — студенты | 0.80 | 0.20 | 1.5 | +3.6 | −1.0 | 0.40 | 0.5 | 0.40 |
| `tourists` — туристы | 0.50 | 0.15 | 0.5 | −1.0 | +1.2 | 0.12 | 1.0 | 0.05 |

Столбцы «цена», «качество», «посадка», «скорость» — поля `priceShift`, `qualityShift`, `seatPull`, `waitPull`: добавки к чувствительности среднего покупателя, которого уже считает движок. У жителей к `priceShift` и `qualityShift` прибавляется ярус места: `tierPriceShift` (prime −0.8, mid 0, cheap +0.5) и `tierQualityShift` (prime +1.0, mid 0, cheap −0.3).

Откуда числа. Доли посадки, чеки, профили недели и года — D06 (`extra.guestSegments`, `weekdayProfiles`, `monthCurve`, `hourCurve`); профиль метро и индекс подземки D06 посчитал по открытым данным MTA. Чувствительность к цене выведена из чеков D06: цена, на которой одна группа приносит больше всего, должна стоять на её чеке ($6.50 офисные, $9 жители, $6 студенты, $12 туристы) при предельной стоимости заказа около $4.90; расчёт — в `note` каждой группы. Остальное — оценки с расчётом в `note`. Измеренного разбиения покупателей кофеен по группам никто не публикует.

Состав «чистых» кварталов (`mixByBlock`, D06 с удалёнщиками внутри жителей):

| Квартал | Офисные | Жители | Студенты | Туристы |
|---|---|---|---|---|
| `residential` | 0.08 | 0.70 | 0.12 | 0.10 |
| `office` | 0.60 | 0.20 | 0.05 | 0.15 |
| `campus` | 0.15 | 0.35 | 0.45 | 0.05 |
| `tourist` | 0.25 | 0.25 | 0.05 | 0.45 |

Прочие поля: `week[7]` и `months[12]` у каждой группы, `blockRules`, `refSeats` 18, `seatSpan` 12, `waitWindowDays` 7, `multBounds` [0.5, 1.6].

### 2.3. Сигнатуры и формулы

```ts
export interface SegmentCfg {
  id: string; name: string;
  sitShare: number; morningShare: number; dwellHours: number;
  priceShift: number; qualityShift: number; seatPull: number; waitPull: number;
  regularShare: number; week: number[]; months: number[];
}
export interface GuestSegmentsCfg {
  segments: SegmentCfg[];
  mixByBlock: Record<BlockType, Record<string, number>>;
  blockRules: {
    residentialBase: number;
    office: { anchor: 'subway'; reachM: number; ridersRef: number; maxWeight: number };
    campus: { anchor: 'college'; reachM: number; weight: number };
    tourist: { museum: number; plaza: number; park: number; reachM: number };
  };
  tierPriceShift: Record<'prime' | 'mid' | 'cheap', number>;
  tierQualityShift: Record<'prime' | 'mid' | 'cheap', number>;
  refSeats: number; seatSpan: number; waitWindowDays: number; multBounds: [number, number];
}

/** Кто придёт сегодня. Имя и сигнатуру читает service.ts — не менять. */
export function guestMix(d: CafeDay): GuestMix;
/** То же с параметрами групп и объёмом дня: для service.ts (dwellHours) и regulars.ts (regularShare). */
export function guestMixDetailed(d: CafeDay): { volume: number; groups: { id: string; share: number; cfg: SegmentCfg }[] };
/** Подходит ли предложение сегодняшним гостям. Эталонная кофейня получает ровно 1. */
export function segmentFit(d: CafeDay): { mult: number; byGroup: { id: string; share: number; fit: number }[] };
export const part: CafePart;   // demandMult = volume × fit; kpis; notes
```

Формулы:

```
base_g   = Σ_тип blockWeights[тип] × mixByBlock[тип][g]
raw_g    = base_g × week_g[date.weekday] × months_g[date.month − 1]
volume   = Σ_g raw_g                      // день против среднего дня года; в среднем за неделю и год равен 1
share_g  = raw_g / volume

lp       = ln(b.orders.price / pack.unit.refPrice)
seatIdx  = clamp((b.size − refSeats) / seatSpan, −1, 1)
walked   = Σ(lost.size + lost.staff) / Σ demandUnits по последним waitWindowDays дням b.days (0, если дней нет)
u_g      = −(priceShift_g + ярус) × lp + (qualityShift_g + ярус) × (b.quality − 0.5) + seatPull_g × seatIdx − waitPull_g × walked
fit      = clamp(Σ_g share_g × exp(u_g), multBounds)
demandMult = volume × fit
```

Ярус прибавляется только у группы `residents`. `guestMix(d)` возвращает `{ groups: [{ id, share, sitShare, morningShare }] }`.

### 2.4. Место в порядке расчёта

Шаг 2 раздела 1.3. `fit` читает `b.days`, которые движок дописывает в конце дня, — сегодняшняя очередь влияет на завтрашний спрос.

### 2.5. Пример

Насколько предложение подходит «чистому» кварталу, среда, октябрь (`D20-examples.mjs`, раздел D):

| Предложение | residential | office | campus | tourist | residential, ярус prime |
|---|---|---|---|---|---|
| Эталон: $8.50, качество 0.50, 18 мест | 1 | 1 | 1 | 1 | 1 |
| Дешёвая: $6.50, качество 0.45, 18 мест | 1.47 | 1.6 | 1.6 | 1.44 | 1.29 |
| Specialty: $11, качество 0.72, 18 мест | 0.77 | 0.58 | 0.52 | 0.96 | 1.06 |
| Эталон на 30 мест | 1.23 | 1.09 | 1.32 | 1.14 | 1.23 |
| Эталон на 6 мест | 0.82 | 0.92 | 0.77 | 0.89 | 0.82 |

Движок сам даёт specialty за качество и репутацию 0.72 ещё × 1.44, а за цену $11 — × 0.50 к силе притяжения; таблица показывает только поправку групп.

Три месяца у кампуса (место `ev-078`, 75% веса — колледж; районная кофейня, 3 бариста и старший):

| Месяц | Студентов среди гостей | Хотят заказать в день | Обслужено в день | Выручка | Прибыль |
|---|---|---|---|---|---|
| Май | 40% | 301 | 215 | $54,885 | $1,316 |
| Июнь | 28% | 228 | 211 | $53,796 | $581 |
| Июль | 28% | 223 | 211 | $53,683 | $504 |

Летом студенты уходят, спрос падает на четверть. Команда из четырёх человек в мае не обслуживала 86 заказов в день (не хватало часов труда и мест), поэтому продажи почти не изменились: лишний спрос весной — довод нанять на семестр, а не на год.

### 2.6. Проверки

1. Эталонная кофейня (цена `refPrice`, качество 0.5, 18 мест, пустые `b.days`) получает `fit = 1` (с точностью 1e−9) на любом месте, в любой день.
2. Сумма `share` в `guestMix` равна 1 (с точностью 1e−9) на каждом из мест `data/places.json`.
3. Среднее `volume` за 360 дней года равно 1 ± 0.02 на любом месте; среднее за неделю равно `Σ base_g × months_g` этого месяца.
4. Место без якорей даёт состав `residential`. Место в 100 м от колледжа даёт студентов больше 30%.
5. **Готово по заданию B02.** Specialty ($11, качество 0.72, 18 мест): `fit ≥ 0.95` на «чистом» туристическом составе и на жилом ярусе `prime`; `fit ≤ 0.6` на «чистом» офисном составе и у кампуса. У дешёвой ($6.50, качество 0.45) `fit` на офисном и у кампуса не меньше 1.5. «Выигрывает» читается по прибыли: низкая цена всегда поднимает спрос, вопрос в том, окупает ли его чек; по прибыли specialty лучше дешёвой на туристическом месте и хуже у кампуса (раздел 7).
6. Две одинаковые кофейни на одном месте получают одинаковый `demandMult`.
7. Неделя, в которой ушло 10% гостей, снижает `fit` офисной группы на `1 − exp(−0.2)` = 18%, а жителей — на 5%.
8. Без `extra.guestSegments`: `guestMix` равен `defaultGuestMix(pack)`, `part` равен `{}`.

### 2.7. Что показать на экране

- Карточка места (B13): «Who walks here» — четыре полоски с долями групп в средний день и подпись типа: `Mostly residents`, `Commuters from the L train`, `Students (term time)`, `Visitors`.
- Today (B14), `kpis`: `Guests today: 44% residents, 37% students, 13% commuters, 6% visitors` и `Offer fit: 0.84`.
- `notes`, когда `fit` ниже 0.9 и видна причина: `Students find $11 too much: they are 37% of this block`, `Commuters walked away from the line last week`, `Residents want a seat: 8 seats is a counter to them`.

---

## 3. `service` — места и навынос, пик, очередь (B01)

Файл `engine/src/niches/cafe/service.ts`, ключ `extra.service`.

### 3.1. Решение игрока

Число мест (`resize`), состав команды (от него зависит скорость бара в пик), часы работы. Больше мест — больше гостей, которые сидят, и больше работы на заказ: посуда, столы, туалет.

### 3.2. Поля пакета

| Поле | Значение | Источник |
|---|---|---|
| `rushHours` | [7, 8, 9] | D14 `hourProfile` |
| `rushHourWeights` | [0.31, 0.38, 0.31] | D14: 12%, 15%, 12% дня; доли внутри пика |
| `peak15Factor` | 0.75 | D14, оценка: самая плотная четверть часа несёт треть часа |
| `machineOrdersPerHour` | 90 | D14: потолок двухгруппной машины |
| `walkAwayByLine` | (5; 0), (10; 0.1), (15; 0.3), (20; 0.5) | D06 `extra.queue`: исследование очередей Lu и др. (статья открыта D06), пересчёт в доли — оценка D06 |
| `seatPeakHourShare` | 0.14 | D06: пик жилой кривой по часам |
| `seatFill` | 0.85 | оценка |
| `seatBusyHours` | 3 | оценка по кривой D06 |
| `noSeatTakesAway` | 0.6 | D14, оценка |
| `sitInLaborMult` | 1.8 | оценка с расчётом: каждый четвёртый работает в зале |
| `fixedCoreSqft`, `sqftPerSeat` | 395, 18 | D02 `extra.floorPlan` |
| `crowdAbove`, `crowdQualityDrop` | 0.9, 0.08 | пакет и движок |

### 3.3. Сигнатуры и формулы

```ts
export interface ServiceCfg { /* поля таблицы 3.2 */ }
export interface ServiceDay {
  demand: number;                  // после непокрытых часов
  served: number;
  rush: { orders: number; capPerHour: number; line: number; waitMin: number; walked: number; servedShare: number };
  seats: { fit: number; wanted: number; seated: number; tookAway: number; left: number; turns: number; peakUse: number; crowded: boolean };
  lost: { hours: number; queue: number; seats: number; labor: number };
  spare: number;                   // сколько ещё заказов команда успела бы сделать
  bound: 'none' | 'hours' | 'rush' | 'seats' | 'labor';
}
/** Мест помещается: бар, очередь, туалет и подсобка занимают fixedCoreSqft. Без места — b.size. */
export function seatsThatFit(place: Place | undefined, cfg: ServiceCfg): number;
/** Весь день по шагам. null — в пакете нет extra.service. */
export function serviceDay(d: CafeDay): ServiceDay | null;
export const part: CafePart;   // capacityDay, qualityDelta, kpis, notes
```

Формулы (`dem = d.demand × (1 − coverage(d).lostDemandShare)`, группы — из `guestMixDetailed(d)`, команда — `staffPower(d)`):

```
seats      = min(b.size, seatsThatFit(place))          // seatsThatFit = floor((sqft − 395) / 18), не меньше 0
morning    = Σ share_g × morningShare_g
sit        = Σ share_g × sitShare_g
present0   = Σ dem × share_g × sitShare_g × dwellHours_g × seatPeakHourShare   // сидит в самый занятый час, если всем хватит мест
seatRoom   = min(1, seats × seatFill / present0)
labor      = 1 + sit × seatRoom × (sitInLaborMult − 1)   // работы на заказ против заказа навынос
cap        = min(machineOrdersPerHour, staffPower.rushOrdersPerHour) / labor

// 1. утренний пик, по часам
carry = 0; walked = 0
для каждого веса w из rushHourWeights:
  a     = dem × morning × w
  line  = carry + max(0, (a / peak15Factor − cap) / 4)          // людей в очереди в самую плотную четверть часа
  gone  = min(a, walkAway(line) × a × (carry + a > cap ? 1 : 1 / (4 × peak15Factor)))
  walked += gone
  carry = max(0, carry + a − gone − cap)                          // кто остался в очереди, будет обслужен позже
afterQueue = dem − walked

// 2. места: только те, кто садится
wanted   = afterQueue × sit
present  = Σ afterQueue × share_g × sitShare_g × dwellHours_g × seatPeakHourShare
avail    = seats × seatFill
unseated = present > avail ? min(wanted, wanted × seatPeakHourShare × (1 − avail / present) × seatBusyHours) : 0
tookAway = unseated × noSeatTakesAway;  left = unseated − tookAway
seated   = wanted − unseated
afterSeats = afterQueue − left

// 3. труд за день
work      = (afterSeats − seated) + seated × sitInLaborMult
lostLabor = work > staffPower.ordersPerDay ? afterSeats × (1 − staffPower.ordersPerDay / work) : 0
served    = afterSeats − lostLabor
```

`walkAway(line)` — ломаная по точкам `walkAwayByLine`: 0 до 5 человек, 0.5 от 20. `waitMin = 60 × line / cap`. `turns = seated / seats`. `peakUse = min(present, avail) / seats`. `crowded = present / seats > crowdAbove`.

`capacityDay(d)` возвращает `served + spare`, где `spare = max(0, staffPower.ordersPerDay / labor − served)`, если за день никто не потерян, и `served`, если потерян. Число возвращается всегда: иначе движок вернёт старый предел мест. `qualityDelta(d)` = `−crowdQualityDrop`, если `crowded`.

### 3.4. Место в порядке расчёта

Шаг 4 раздела 1.3. `notes` и `kpis` считают `serviceDay` заново от отчёта дня (`r.demandUnits`, `dateOf(r.day)`): состояния нет.

### 3.5. Пример

Один день, среда, октябрь, команда 3 бариста и старший, цена $8.50 (`D20-examples.mjs`, раздел E). Офисное место — `ev-062` (49% офисных), жилое — `ev-004`:

| Место | Хотят заказать | Мест | Заказов в пик | Бар, заказов в час | Очередь | Ждать, мин | Ушли из очереди | Хотят сесть | Не сели, взяли с собой | Не сели, ушли | Не хватило труда | Обслужено | Оборот места |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| офисное | 250 | 6 | 111 | 67 | 0 | 0 | 0 | 74 | 6.3 | 4.2 | 0 | 246 | 10.5 |
| офисное | 250 | 30 | 111 | 62 | 0 | 0 | 0 | 74 | 0 | 0 | 2.2 | 248 | 2.5 |
| офисное | 400 | 6 | 178 | 70 | 5 | 4.3 | 0 | 118 | 17.4 | 11.6 | 129.5 | 259 | 14.8 |
| офисное | 400 | 30 | 178 | 62 | 6.9 | 6.7 | 2.8 | 117 | 0 | 0 | 149.4 | 248 | 3.9 |
| офисное | 550 | 6 | 244 | 72 | 13.4 | 11.2 | 28.8 | 153 | 26.4 | 17.6 | 242.7 | 261 | 18.2 |
| офисное | 550 | 30 | 244 | 62 | 21.8 | 21 | 60.5 | 144 | 0 | 0 | 241.6 | 248 | 4.8 |
| жилое | 250 | 6 | 88 | 68 | 0 | 0 | 0 | 130 | 22.6 | 15.1 | 2.2 | 233 | 15.4 |
| жилое | 250 | 30 | 88 | 54 | 0 | 0 | 0 | 130 | 0 | 0 | 33.9 | 216 | 4.3 |
| жилое | 400 | 6 | 141 | 71 | 0.1 | 0.1 | 0 | 208 | 42.3 | 28.2 | 135.8 | 236 | 23 |

Стойка на 6 мест при 250 заказах обслуживает 246 — старый движок остановил бы её на 85. При спросе выше сил команды стойка обслуживает больше зала на 30 мест с тем же штатом (259 против 248 в офисном квартале): сидящий гость стоит 1.8 заказа навынос по труду. Зал выигрывает не числом обслуженных, а спросом и чеком: раздел 7.

Три месяца на офисном месте, профиль навынос (8 мест, $8):

| Месяц | Команда | Бар в пик, заказов в час | Хотят в день | Не хватило труда в день | Обслужено в день | Зарплаты | Прибыль |
|---|---|---|---|---|---|---|---|
| 1 | 3 бариста + старший | 77 | 316 | 71.2 | 238 | $13,920 | $5,649 |
| 2 | 4 бариста, старшего нет | 68 | 291 | 74.3 | 211 | $13,440 | $1,953 |
| 3 | 4 бариста + старший | 89 | 326 | 37.8 | 281 | $17,280 | $8,596 |

Пятый человек стоит $3,360 зарплаты и возвращает 43 заказа в день.

### 3.6. Проверки

1. **Навынос не упирается в места.** 6 мест, 250 заказов, 3 бариста и старший, офисное место: `served ≥ 240`; `lost.seats ≤ 5`.
2. **Готово по заданию B01.** Офисное место, 400 заказов, 3 бариста и старший: `served` при 8 местах больше, чем при 30.
3. **Места ограничивают только тех, кто садится.** При любых входах `lost.seats ≤ wanted × (1 − noSeatTakesAway)`; при `sit = 0` потерь из-за мест нет.
4. **Долгая посадка занимает зал.** Жилое место, 400 заказов, 18 мест: `lost.seats > 0`; у того же зала на офисном месте — 0.
5. **Очередь растёт от нехватки людей в пик.** 550 заказов на офисном месте: при 2 бариста `rush.walked` больше, чем при 5; при 250 заказах `rush.walked = 0`.
6. **Деньги сходятся.** `served + lost.queue + lost.seats + lost.labor = dem` с точностью 1e−6; `served ≥ 0`.
7. **Зал меньше, чем помещается.** Место 500 кв. футов, `b.size = 24`: `seats.fit = 5`, в `notes` есть `Only 5 seats fit`.
8. **Определённость.** Два вызова с одним входом дают одинаковый результат; в файле нет `Math.random` и `Date`.
9. Без `extra.service` часть равна `{}`; `npx tsx sim/audit/saturation.ts` остаётся PASS.

### 3.7. Что показать на экране

- `kpis`: `Seat turns: 4.3 a day`, `Rush served: 96%`, `Bar in the rush: 62 orders an hour`, `Seats in use at the busiest hour: 54%`.
- `notes` (по одной на причину, самая большая — первой): `Morning rush: 22 in line at 8 am, 21-minute wait, 60 walked on`, `Out of hands: 149 orders not made today — the team makes 248 a day`, `No free seat: 28 guests left, 42 took it to go`, `Only 5 seats fit in 500 sq ft: 19 of your 24 seats have no floor`.
- Manage: под ползунком мест — `Fits 28 seats · a seated guest takes 1.8 times the work of a to-go order`.

---

## 4. `staffing` — роли, навык, покрытие смен (B03)

Файл `engine/src/niches/cafe/staffing.ts`, ключ `extra.staffing`.

### 4.1. Решение игрока

Сколько бариста, нужен ли старший смены, брать ли стажёра дешевле, сколько часов держать двери открытыми. Это закрывает дыру 2: старший смены теперь даёт скорость и качество.

### 4.2. Поля пакета

| Поле | Значение | Источник |
|---|---|---|
| `roles.barista` | скорость 1, качество 0 | — |
| `roles.shift_lead` | скорость 1.1, качество +0.02, `lead` | D05 `skillRamp`: после 12 месяцев 1.1 и +0.02, учит других и открывает один |
| `roles.trainee_barista` | скорость 0.55, со старшим 0.75, качество −0.025, `trainee` | D05 `skillRamp`: 0.4 / 0.7 / 0.85 по неделям; расчёт в `rolesNote` |
| `ordersPerPaidHour` | 14.0 заказа навынос | пакет: 1,700 в месяц / 160 ч = 10.6 при 40% заказов в зале; × (1 + 0.4 × 0.8) |
| `rushOrdersPerPersonHour` | 25 | D14, D06: 30 напитков в час, 1.2 напитка в заказе |
| `rushCrewOwner`, `rushCrewShare` | 1, 0.5 | D14: половина команды на пике; пакет: владелец — пятая пара рук |
| `leadNeededFrom` | 3 | задание B03 |
| `withLead.quality` | +0.03 | оценка |
| `noLead` | скорость × 0.9, качество −0.03 | D05 `stations`: 35 против 40 напитков в час; качество — оценка |
| `minOnFloor` | 2 | пакет `capacity.minStaff` |
| `openHoursPerDay` | standard 12, long 15, short 8 | рычаг `hours` пакета |
| `leverPaidHours.hours.long` | 90 | $2,300 рычага — это 3 часа в день одного человека |
| `ownerHoursPerMonth` | 160 | пакет `extra.referenceMonth` |
| `uncoveredHourWeight` | 0.69 | D06 `hourCurve`: последние 4 часа дня несут 0.23 |
| `leverSpeed.sourcing.specialty` | 0.85 | D06: эспрессо 1 минута, молочный напиток 2; доли меню — оценка |
| `newRoles[]` | `trainee_barista`: $18 в час, 120 часов | D05 |
| `newLeverOptions[]` | `hours: short` (7am–3pm), спрос −0.2 | D06 `hourCurve` |

### 4.3. Сигнатуры и формулы

```ts
export interface RoleCfg { speed: number; quality: number; lead?: boolean; trainee?: boolean; speedWithLead?: number }
export interface StaffingCfg {
  roles: Record<string, RoleCfg>;                 // роли нет в списке — { speed: 1, quality: 0 }
  ordersPerPaidHour: number; rushOrdersPerPersonHour: number;
  rushCrewOwner: number; rushCrewShare: number;
  leadNeededFrom: number; withLead: { quality: number }; noLead: { speedMult: number; quality: number };
  minOnFloor: number; openHoursPerDay: Record<string, number>; leverPaidHours: Record<string, Record<string, number>>;
  ownerHoursPerMonth: number; uncoveredHourWeight: number;
  leverSpeed?: Record<string, Record<string, number>>;
}
export interface TeamCoverage { neededHours: number; paidHours: number; coveredShare: number; lostDemandShare: number }
/** Скорость и качество сегодняшней команды. Имя и сигнатуру читает service.ts — не менять. */
export function staffPower(d: CafeDay): StaffPower;
/** Часы открытия против часов людей. */
export function coverage(d: CafeDay): TeamCoverage;
export const part: CafePart;   // capacityDay, qualityDelta, kpis, notes
```

Формулы (`n_r` — число работников роли, `h_r` — `hoursPerMonth` роли из `pack.staff`, `n = Σ n_r`):

```
hasLead   = есть работник роли с lead
noLead    = !hasLead && n ≥ leadNeededFrom
speed_r   = trainee && hasLead ? speedWithLead : speed
team      = noLead ? noLead.speedMult : 1
lev       = leverEffects(b, pack).capacityMult × Π leverSpeed[рычаг][выбранный вариант]

ordersPerDay      = Σ n_r × h_r × speed_r × ordersPerPaidHour × team × lev / 30          // в заказах навынос
rushOrdersPerHour = rushOrdersPerPersonHour × (rushCrewOwner + rushCrewShare × n) × (Σ n_r × speed_r / n) × team × lev
qualityDelta      = Σ n_r × quality_r / n + (hasLead && n ≥ 2 ? withLead.quality : 0) + (noLead ? noLead.quality : 0)

open        = openHoursPerDay[b.orders.levers.hours] ?? openHoursPerDay.standard
neededHours = open × minOnFloor × 30
paidHours   = ownerHoursPerMonth + leverPaidHours.hours[вариант] + Σ n_r × h_r
coveredShare    = min(1, paidHours / neededHours)
lostDemandShare = (1 − coveredShare) × uncoveredHourWeight
```

`part.capacityDay(d)` = `d.demand × (1 − lostDemandShare)` при `coveredShare < 1`, иначе `null`. `part.qualityDelta(d)` = `staffPower(d).qualityDelta`. Событие `staffAvailability` движок сейчас применяет только к старому пределу людей — просьба к ведущему № 4.

### 4.4. Место в порядке расчёта

`staffPower` и `coverage` вызывает `service` на шаге 4; `qualityDelta` — шаг 6.

### 4.5. Пример

Команды рядом (обычные часы, 12 в день; `D20-examples.mjs`, раздел F):

| Команда | Зарплаты в месяц | Заказов навынос в день | Бар в пик, заказов в час | Качество | Часы покрыты | Спрос потерян из-за закрытых часов |
|---|---|---|---|---|---|---|
| 2 бариста | $6,720 | 149 | 50 | 0 | 67% | 23% |
| 3 бариста | $10,080 | 202 | 56 | −0.03 | 89% | 8% |
| 2 бариста + старший | $10,560 | 231 | 65 | +0.04 | 89% | 8% |
| 4 бариста | $13,440 | 269 | 68 | −0.03 | 100% | 0% |
| 3 бариста + старший | $13,920 | 306 | 77 | +0.03 | 100% | 0% |
| 2 бариста + старший + стажёр | $12,720 | 273 | 72 | +0.03 | 100% | 0% |
| 2 бариста + 2 стажёра | $11,040 | 190 | 52 | −0.04 | 100% | 0% |
| 5 бариста + старший | $20,640 | 455 | 102 | +0.03 | 100% | 0% |

Замена одного из четырёх бариста на старшего стоит $480 в месяц и даёт +37 заказов в день и +0.06 к качеству.

Какая команда приносит больше всего при разной загрузке (жилое место `ev-004`, районная кофейня, цена и места не меняются):

| Прохожих в день | Лучшая команда | Обслужено в день | Прибыль | Вторая | Прибыль | Худшая | Прибыль |
|---|---|---|---|---|---|---|---|
| 2,435 | 2 бариста + старший + стажёр | 173 | −$1,823 | 3 бариста + старший | −$2,623 | 5 бариста + старший | −$10,330 |
| 4,870 | 5 бариста + старший | 316 | $13,821 | 3 бариста + старший | $4,106 | 2 бариста + 2 стажёра | −$6,796 |
| 7,792 | 5 бариста + старший | 329 | $15,987 | 3 бариста + старший | $4,524 | 2 бариста + 2 стажёра | −$6,792 |

Три месяца на офисном месте, профиль навынос:

| Месяц | Команда | Цель качества | Обслужено в день | Потеряно в день | Зарплаты | Прибыль |
|---|---|---|---|---|---|---|
| 1 | 4 бариста | 0.44 | 211 | 82 | $13,440 | $1,880 |
| 2 | 3 бариста + старший | 0.51 | 237 | 72 | $13,920 | $5,460 |
| 3 | 2 бариста + старший + стажёр | 0.50 | 212 | 72 | $12,720 | $2,915 |

### 4.6. Проверки

1. **Дыра 2.** 3 бариста + старший против 4 бариста: `ordersPerDay` выше не меньше чем на 10%, `qualityDelta` выше не меньше чем на 0.05.
2. **Маленькой команде старший не обязателен.** У 2 бариста `noLead` ложно: `qualityDelta = 0`, скорость без штрафа.
3. **Стажёр учится у старшего.** Скорость стажёра 0.75, когда в команде есть старший, и 0.55 без него: «2 бариста + старший + стажёр» делают 273 заказа в день, «2 бариста + 2 стажёра» — 190.
4. **Ни один состав не лучший всегда.** На трёх уровнях потока таблицы выше лучшая команда разная хотя бы дважды.
5. **Покрытие.** 2 бариста при обычных часах: `coveredShare = 0.667`, `lostDemandShare = 0.23`; при `hours: short` — 1 и 0.
6. **Длинные часы оплачены рычагом.** 4 бариста, `hours: long`: `paidHours = 890`, `neededHours = 900`, потеря меньше 1%.
7. **Неизвестная роль** считается обученным бариста; пустой штат даёт `ordersPerDay = 0`.
8. Без `extra.staffing`: `staffPower` равен `defaultStaffPower(b, pack)`, `part` равен `{}`.

### 4.7. Что показать на экране

- `kpis`: `Team makes: 306 to-go orders a day`, `Bar in the rush: 77 orders an hour`, `Open hours covered: 100%`, `Team quality: +0.03`.
- `notes`: `No shift lead on a team of 4: the bar is 10% slower and quality slips`, `Not enough people for 12 open hours: the last hours are dark, 8% of customers find the door closed`, `New barista works at 75% speed while the shift lead trains them`.
- Manage, под штатом: `A shift lead costs $480 more than a barista and adds 37 orders a day`.

---

## 5. `regulars` — постоянные гости (B04)

Файл `engine/src/niches/cafe/regulars.ts`, ключ `extra.regulars`.

### 5.1. Решение игрока

Как поднимать цену — разом или шагами; держать ли качество ровным; рисковать ли закрытием по проверке. Постоянные есть там, где есть жители и офисные; у туристов их почти нет.

### 5.2. Поля пакета

| Поле | Значение | Источник |
|---|---|---|
| `tenureMonths` | 6 | D06: первый месяц продаёт треть шестого; 38% гостей возвращаются за полгода (данные одного поставщика) |
| `maxLift`, `qualitySpan` | 0.2, 0.2 | оценка с расчётом: D06 даёт 20–45% перехода в постоянные по качеству; большая часть уже в движке |
| `priceStepFree` | 0.04 | D06 `price_memory`; Toast: кофе подорожал на 4.3% за год |
| `priceLossPerPoint`, `priceLossMax` | 0.5, 0.3 | D06: скачок цены стоит около 3% спроса на два месяца; расчёт в `priceLossNote` |
| `priceMemoryMonths` | 2 | D06 |
| `closureLossPerDay`, `closureLossMax`, `closureMemoryMonths` | 0.03, 0.3, 3 | оценка с расчётом |
| `steadyShareTarget` | [0.55, 0.65] | D06, Square — для проверки, не вход |
| `multBounds` | [0.6, 1.25] | — |

### 5.3. Сигнатуры и формулы

```ts
export interface RegularsCfg { /* поля таблицы 5.2 */ }
export interface RegularsState {
  potential: number;     // доля сегодняшних гостей, которая может быть постоянной
  tenure: number;        // 0–1: насколько база успела вырасти
  share: number;         // доля постоянных в заказах сейчас
  lift: number; priceLoss: number; closureLoss: number;
  mult: number; why: string[];
}
export function regularsState(d: CafeDay): RegularsState | null;   // null — в пакете нет extra.regulars
export const part: CafePart;   // demandMult, kpis, notes
```

Формулы:

```
potential = Σ_g share_g × regularShare_g                      // guestMixDetailed(d)
months    = (d.day − b.openedDay) / 30
tenure    = 1 − exp(−months / tenureMonths)
lift      = potential × maxLift × tenure × clamp(((b.quality − 0.5) + (b.reputation − 0.5)) / (2 × qualitySpan), −1, 1)

P = [ ...b.history.map(m => m.avgPrice), b.orders.price ]     // цены по месяцам, последняя — сегодняшняя
priceLoss = Σ по i от конца, возраст = (длина − 1 − i) < priceMemoryMonths:
              min(priceLossMax, priceLossPerPoint × max(0, P[i] / P[i−1] − 1 − priceStepFree)) × (1 − возраст / priceMemoryMonths)
priceLoss = min(priceLossMax, priceLoss)

C = [ ...b.history.map(m => 30 × m.lost.closure / max(1, m.demandUnits)), дней с lost.closure > 0 в b.days этого месяца ]
closureLoss = min(closureLossMax, Σ по возрасту < closureMemoryMonths: closureLossPerDay × C[i] × (1 − возраст / closureMemoryMonths))

mult  = clamp(1 + lift − potential × tenure × (priceLoss + closureLoss), multBounds)
share = potential × tenure × (1 − priceLoss − closureLoss) × (1 + lift) / mult
```

«Дни этого месяца» в `b.days` — отчёты с `dateOf(r.day).month === d.date.month`. Месяцы истории без продаж (до открытия) в ряд цен не входят: берите только `history` с `servedUnits > 0`.

### 5.4. Место в порядке расчёта

Шаг 2 раздела 1.3. Узнаваемость (`awarenessAt`) уже в спросе; `regulars` добавляет только то, что зависит от качества, цены и закрытий.

### 5.5. Пример

Жилое место `ev-004`: постоянными могут быть 55% гостей; туристическое `ev-002` — 44% (в его составе только 32% туристов).

Цена: +15% за один месяц против +3% пять месяцев подряд (районная кофейня, 3 бариста и старший; `D20-examples.mjs`, раздел G):

| Месяц | Скачок: цена | Постоянные × | Обслужено в день | Прибыль | Шаги: цена | Постоянные × | Обслужено в день | Прибыль |
|---|---|---|---|---|---|---|---|---|
| 1 | $9.77 | 0.96 | 189 | $6,501 | $8.76 | 0.99 | 216 | $5,723 |
| 2 | $9.77 | 0.99 | 210 | $10,888 | $9.02 | 0.99 | 215 | $7,198 |
| 3 | $9.77 | 1.01 | 215 | $11,901 | $9.29 | 0.99 | 215 | $8,925 |
| 4 | $9.77 | 1.01 | 215 | $11,954 | $9.57 | 1.00 | 215 | $10,699 |
| 5 | $9.77 | 1.01 | 216 | $12,078 | $9.86 | 1.00 | 214 | $12,368 |
| 6 | $9.77 | 1.01 | 213 | $11,612 | $9.86 | 1.01 | 210 | $11,492 |

Скачок уводит часть постоянных на два месяца (−27 заказов в день в первый), шаги не уводят никого. В деньгах скачок всё равно выгоднее: эта кофейня упирается в часы труда (спрос выше сил команды), и более высокая цена полгода работает на тех же 215 заказах. Там, где спрос ниже сил команды, потеря постоянных — чистая потеря.

Три месяца после пяти дней закрытия по проверке:

| Месяц | Дней закрыто | Постоянные × | Доля постоянных | Обслужено в день | Прибыль |
|---|---|---|---|---|---|
| 1 | 5 | 0.90 | 51% | 180 | −$2,110 |
| 2 | 0 | 0.93 | 52% | 215 | $3,944 |
| 3 | 0 | 0.96 | 53% | 215 | $3,978 |
| 4 | 0 | 0.98 | 54% | 215 | $3,996 |

Новая кофейня, первый год, жилое место:

| Месяц | Узнаваемость (движок) | Specialty: постоянные × | Доля постоянных | Средняя кофейня: постоянные × | Доля постоянных |
|---|---|---|---|---|---|
| 1 | 47% | 1.01 | 4% | 1 | 4% |
| 3 | 76% | 1.04 | 19% | 1 | 19% |
| 6 | 93% | 1.06 | 33% | 1 | 33% |
| 12 | 99% | 1.07 | 47% | 1 | 47% |

### 5.6. Проверки

1. **Нет двойного учёта.** Качество 0.5, репутация 0.5, цена не менялась, закрытий нет: `mult = 1` (с точностью 1e−9) на 1-й, 100-й и 360-й день.
2. **Готово по заданию B04.** +15% за месяц даёт `mult` ниже, чем +3% пять месяцев подряд, в месяц подъёма и в следующий; через `priceMemoryMonths` месяцев разницы нет.
3. **Шаг до 4% бесплатен.** Рост цены на 4% за месяц: `priceLoss = 0`. Снижение цены: `priceLoss = 0`.
4. **Жилой против туристического.** На месте без якорей `potential ≥ 0.5`; на «чистом» туристическом составе — меньше 0.4; `lift` при одинаковом качестве больше на жилом.
5. **Закрытие.** 5 дней закрытия: `closureLoss = 0.15` в тот же месяц, 0.10 в следующий, 0.05 через месяц, 0 через три.
6. **Хорошая кофейня набирает.** Качество и репутация 0.7 на жилом месте: `mult` равен 1.0 в первый день, 1.09–1.10 через 12 месяцев, 1.11 через 24 и не выше `multBounds[1]`.
7. **Пустая история.** `b.history = []`, первый день: `mult = 1`, `priceLoss = 0`.
8. Без `extra.regulars` часть равна `{}`.

### 5.7. Что показать на экране

- `kpis`: `Regulars: 47% of orders`, `Regulars possible on this block: 55%`.
- `notes`: `Regulars noticed the price: up 15% in a month. About 5% of them are trying the neighbor; they come back within two months if nothing else changes`, `Five days closed by the Health Department: 15% of your regulars found another place`, `Regulars are coming back: steady quality for six months`.
- Manage, рядом с ценой: `Last month's price: $8.50. A rise of up to 4% a month goes unnoticed`.

---

## 6. Три стартовых профиля (`extra.profiles`)

Это стартовые наборы, а не кнопки: каждое поле — обычное решение игрока.

| | `takeaway` — навынос | `neighborhood` — районная с посадкой | `specialty` |
|---|---|---|---|
| Набор | `lean` | `standard` | `premium` |
| Мест | 8 | 24 | 16 |
| Цена | $8.00 | $8.50 | $10.00 |
| Штат на 250 заказов в день | 3 бариста + старший | 3 бариста + старший | 2 бариста + старший |
| Рычаги | всё обычное | всё обычное | `sourcing: specialty`, `staff_pay: above` |
| Цель качества | 0.50 | 0.53 | 0.73 |
| Площадь двери | 420–560 кв. футов | от 830 | от 690 |
| Главный риск | гости, которым нужно место, уходят; бар в 8 утра | память о цене, закрытие по проверке | студенты и офисные не платят $10 |

Штат в профиле — отправная точка. На двери с 350–400 заказами в день владелец добавляет бариста: в таблицах ниже число бариста подобрано под дверь (от 1 до 7, лучшее по прибыли), столбец «как записано» показывает прибыль со штатом профиля.

Почему у навынос цена $8, а не $6.50 чека офисных: себестоимость заказа в движке постоянна ($2.21 при любой цене), поэтому цена ниже $8 не окупается ни на одной двери карты. Просьба к ведущему № 5.

```ts
export interface CafeProfile {
  id: 'takeaway' | 'neighborhood' | 'specialty';
  name: string; pitch: string; kit: string; size: number; price: number;
  staff: Record<string, number>; levers: Record<string, string>;
  sqft: [number, number]; bestOn: string[]; risk: string;
}
```

---

## 7. Таблица ожиданий

Сложившаяся кофейня (второй год), средний месяц года, прибыль до налогов владельца, число бариста подобрано под дверь. Настоящие места из `data/places.json` (`D20-examples.mjs`, раздел C; ★ — лучший профиль):

| Тип | Место | Профиль | Команда | Хотят в день | Обслужено в день | Нет места | Нет труда и часов | Группы × | Постоянные × | Качество | Выручка | Прибыль | Прибыль со штатом как записано |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| жилой | `ev-004`, 1,380 кв. футов, mid | навынос | 4 + старший | 293 | 272 | 16.2 | 4.6 | 0.88 | 0.99 | 0.50 | $65,241 | $6,246 | $3,310 |
| жилой | `ev-004` | районная ★ | 6 + старший | 349 | 345 | 3.0 | 1.3 | 1.09 | 1.02 | 0.53 | $87,980 | $14,938 | $4,106 |
| жилой | `ev-004` | specialty | 5 + старший | 264 | 259 | 4.2 | 0.7 | 0.82 | 1.11 | 0.73 | $77,805 | $13,276 | −$155 |
| офисный | `ev-062`, 1,220 кв. футов, mid | навынос | 7 + старший | 420 | 404 | 11.8 | 1.3 | 0.98 | 1.00 | 0.50 | $96,959 | $16,507 | $5,232 |
| офисный | `ev-062` | районная ★ | 7 + старший | 411 | 405 | 0 | 1.4 | 1.03 | 1.01 | 0.53 | $103,289 | $22,337 | $8,415 |
| офисный | `ev-062` | specialty | 5 + старший | 290 | 287 | 0 | 2.5 | 0.74 | 1.10 | 0.73 | $86,144 | $20,155 | $4,176 |
| у кампуса | `ev-078`, 1,270 кв. футов, prime | навынос | 5 + старший | 307 | 283 | 22.0 | 2.1 | 0.89 | 0.99 | 0.50 | $67,802 | $1,391 | −$1,066 |
| у кампуса | `ev-078` | районная ★ | 6 + старший | 356 | 335 | 12.3 | 8.9 | 1.11 | 1.01 | 0.53 | $85,456 | $10,513 | $1,076 |
| у кампуса | `ev-078` | specialty | 5 + старший | 266 | 255 | 10.7 | 1.0 | 0.84 | 1.10 | 0.73 | $76,398 | $9,543 | −$3,067 |
| туристический | `ev-002`, 910 кв. футов, mid | навынос | 5 + старший | 355 | 333 | 13.0 | 8.2 | 0.92 | 0.99 | 0.50 | $80,029 | $15,744 | $8,175 |
| туристический | `ev-002` | районная | 6 + старший | 381 | 374 | 0 | 7.7 | 1.05 | 1.01 | 0.53 | $95,258 | $23,454 | $10,089 |
| туристический | `ev-002` | specialty ★ | 6 + старший | 332 | 328 | 1.3 | 2.6 | 0.93 | 1.08 | 0.73 | $98,380 | $27,869 | $5,477 |
| маленькая дверь (жилой) | `ev-085`, 580 кв. футов, mid, помещается 10 мест | навынос | 4 + старший | 291 | 271 | 16.1 | 4.2 | 0.88 | 0.99 | 0.50 | $65,071 | $13,633 | $10,788 |
| маленькая дверь | `ev-085` | районная | 4 + старший | 269 | 257 | 11.8 | 0.7 | 0.86 | 1.01 | 0.53 | $65,431 | $15,050 | $13,351 |
| маленькая дверь | `ev-085` | specialty ★ | 4 + старший | 234 | 225 | 8.7 | 1.1 | 0.74 | 1.11 | 0.73 | $67,367 | $17,168 | $8,143 |

Потери в очереди на этих местах — 0–4 заказа в день: у подобранной команды бар справляется, D14 называет те же 0–17.

Все 116 витрин карты (раздел H калькулятора):

| Тип квартала | Дверь | Ярус | Дверей | Навынос | Районная | Specialty | Лучший профиль в плюсе |
|---|---|---|---|---|---|---|---|
| жилой | обычная | cheap | 28 | 0 | 28 | 0 | 22 |
| жилой | обычная | mid | 29 | 0 | 23 | 6 | 29 |
| жилой | обычная | prime | 1 | 0 | 0 | 1 | 1 |
| жилой | маленькая (меньше 12 мест) | cheap | 1 | 1 | 0 | 0 | 0 |
| жилой | маленькая | mid | 7 | 4 | 0 | 3 | 7 |
| жилой | маленькая | prime | 1 | 0 | 0 | 1 | 1 |
| у кампуса | обычная | mid | 16 | 0 | 14 | 2 | 16 |
| у кампуса | обычная | prime | 5 | 0 | 2 | 3 | 5 |
| у кампуса | маленькая | mid, prime | 2 | 0 | 0 | 2 | 2 |
| офисный | обычная | mid | 7 | 0 | 5 | 2 | 7 |
| офисный | обычная | prime | 3 | 0 | 0 | 3 | 3 |
| туристический | обычная | cheap | 4 | 0 | 3 | 1 | 3 |
| туристический | обычная | mid | 11 | 0 | 6 | 5 | 11 |
| туристический | обычная | prime | 1 | 0 | 0 | 1 | 1 |

Что должно выигрывать и почему:

| Где | Кто выигрывает | Почему |
|---|---|---|
| Жилой квартал, ярус cheap или mid, обычная дверь | районная с посадкой | 70% гостей — жители: больше половины садится, зал на 24 места даёт им +10% спроса; за качество на таком квартале не доплачивают; постоянные — до 55% заказов |
| У кампуса, обычная дверь | районная с посадкой | студентам нужен стол на полтора часа и цена не выше $8.50; на $10 их остаётся половина |
| Туристический квартал, ярус mid или prime | specialty | туристы выбирают по качеству и почти не смотрят на цену; постоянных у них нет, памяти о цене тоже |
| Любой квартал яруса prime | specialty | жители дорогого квартала платят за качество; аренду $326 за кв. фут покрывает только высокий чек |
| Офисный квартал, обычная дверь, ярус mid | районная (на карте); навынос — на настоящем офисном квартале | на карте у «офисных» дверей офисных не больше 49%, остальные хотят сесть. Чем чище офисный состав, тем меньше дают места и тем важнее бар в пик |
| Маленькая дверь (до 600 кв. футов), ярус cheap или mid | навынос | зал не помещается ни у кого; выигрывает тот, кто не платит за набор `premium` и $2,180 в месяц рычагов |
| Маленькая дверь, ярус prime или кампус с туристами | specialty навынос | то же, что на обычной двери: решает состав гостей |

Честные оговорки:

1. **Навынос выигрывает только там, куда не помещается зал.** На одной и той же двери места почти бесплатны ($15 в месяц уборки и стулья), а аренду платят за всю площадь. В жизни навынос живёт за счёт маленькой дешёвой двери — и здесь тоже. Это держится на бюджете площади `seatsThatFit` (раздел 3) и на просьбе № 2.
2. **Профиль недели и года у офисного квартала** (суббота 0.44, воскресенье 0.31, август 0.9) в таблице учтён в среднем месяце. По месяцам разница видна в разделе 2.5.
3. **Копия соседа** в таблицу не входит: делёж потока считает `footfallDemand`, проверяет G1.

Для G1 (`sim/audit/diversity.ts`): берите места этой таблицы (`ev-004`, `ev-062`, `ev-078`, `ev-002`) и маленькую дверь `ev-085`; число бариста подбирайте под дверь. Ожидаемый итог: на четырёх обычных дверях лучшие — районная, районная, районная, specialty; это уже не «один профиль на всех». С пятой, маленькой дверью, и с дверями яруса cheap появляется навынос.

---

## 8. Что вырезать, если механика не укладывается в три часа

| Механика | Обязательное ядро (около двух часов) | Вырезать в таком порядке |
|---|---|---|
| `segments` | `blockWeights`, `guestMix`, `fit` по цене и качеству, проверки 1, 2, 5, 6 | 1) `waitPull` (чтение `b.days`); 2) ярус места; 3) профили недели и года — `volume = 1`, состав постоянен; 4) `seatPull` |
| `service` | места только для сидящих, дневной предел труда с `sitInLaborMult`, `capacityDay`, проверки 1, 2, 3, 6 | 1) `seatBusyHours` и `seatFill` — считать нехватку мест по всему дню; 2) перенос очереди между часами (`carry`) — считать только самый занятый час; 3) `crowded` и `qualityDelta`; 4) `seatsThatFit` (тогда навынос не выигрывает нигде — см. раздел 7) |
| `staffing` | `staffPower` с ролями, старшим и штрафом без старшего, `qualityDelta`, проверки 1, 2, 4 | 1) `leverSpeed`; 2) стажёр (`speedWithLead`); 3) рычаг `hours: short` и `leverPaidHours`; 4) покрытие часов целиком — `coverage` всегда 1 |
| `regulars` | `potential`, `lift`, память о цене, проверки 1, 2, 3 | 1) закрытие по проверке; 2) `share` для `kpis` — показывать только `mult`; 3) `tenure` — считать базу выросшей всегда |

Что нельзя вырезать ни в одной части: возврат `{}` без раздела пакета; ровно 1 у эталонной кофейни; имена и сигнатуры `guestMix` и `staffPower`.

---

## 9. Просьбы к ведущему

1. **`kpis` и `notes` не видят место и день.** Добавить в `CafePart` и `NicheHooks` необязательный третий аргумент `env?: NicheEnv` у `kpis` и четвёртый у `notes`. Без него `segments` и `regulars` не могут показать состав гостей и долю постоянных: место неизвестно.
2. **Максимум мест по площади.** `maxSizeFor` для кафе считать как `floor((sqft − 395) / 18)` (D02 `extra.floorPlan`, поля `service.fixedCoreSqft` и `sqftPerSeat`), а не `floor(sqft × 0.6 / 18)`. До этой правки `service` сам не даёт использовать места, которым нет пола, и пишет заметку.
3. **`anchorDayMult` и профили групп.** Метро по будням (+6% / −7%), колледж летом (−12%) и школа уже есть в профилях групп. После B02 оставить для кафе в `anchorDayMult` парк, больницу и музей.
4. **Множители движка при ответе `capacityDay`.** Сейчас `eventMult('staffAvailability')` и `lev.capacityMult` применяются только к старому пределу людей. Либо движок умножает ответ крючка на `staffAvailability`, либо передаёт множитель в `NicheEnv`. `capacityMult` рычагов `staffing` берёт сам.
5. **Теснота и пустой зал судятся по старому пределу мест.** `util = served / sizeCap`, где `sizeCap = size × 170 / 30 / 0.4`. Стойка на 8 мест с 300 заказами получает `util = 2.6`: вечное «Packed» и −0.08 к качеству. При ответе крючка брать загрузку из части (`ServiceDay.seats.peakUse`): добавить в `CafePart` необязательное `seatUseDay?(d): number`. В расчётах раздела 7 штрафа за тесноту у стойки нет.
6. **Причина потери.** `lost` делится на `size` и `staff` по сравнению с `sizeCap`. У `service` четыре причины (часы, очередь, места, труд). Предлагаю: очередь и труд → `lost.staff`, места → `lost.size`, либо необязательные поля `DayReport.lost.queue`, `lost.seats`, `lost.hours`.
7. **Себестоимость заказа не зависит от цены.** $2.21 при чеке $6.50 и при $12. Поэтому низкая цена не окупается, а рычаг `sourcing: specialty` стоит $750 в месяц при любом объёме. Нужна себестоимость как доля цены или цена сырья на заказ у рычага (данные есть в D04).
8. **Вставить в пакет:** `extra.guestSegments`, `extra.service`, `extra.staffing`, `extra.regulars`, `extra.profiles` из `D20-formats.json`; роль `trainee_barista` в `pack.staff` (`staffing.newRoles`); вариант `short` рычага `hours` (`staffing.newLeverOptions`).
9. **Офисного квартала на карте нет.** Самая «офисная» дверь — 49% офисных. Чтобы формат навынос у офисов можно было проверить, карте нужны несколько дверей у крупного пересадочного узла или в деловом квартале.
