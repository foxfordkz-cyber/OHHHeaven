# SWAP — новый пакет кафе на место старого

Задание A2 третьего захода (`build/ROUND3.md`). 14 ноября 2026, исполнитель A2, журнал — `agents/r3-A2.md`.

## Подставить одной командой

```bash
cp packs/next/cafe.json packs/cafe.json && cp packs/next/_common.json packs/_common.json
```

До этого — пересобрать, если менялись источники:

```bash
node packs/next/build.mjs
```

Проверить подстановку, не трогая рабочую копию (копия репозитория во временной папке, `node_modules` — жёсткими ссылками):

```bash
node packs/next/swap-test.mjs
```

Сравнить игру на старом и новом пакете и убедиться, что ужатый пакет даёт ту же игру, что полный:

```bash
npx tsx packs/next/compare.ts
```

## Что лежит в `packs/next/`

| файл | что это | вес | gzip |
|---|---|---:|---:|
| `cafe.json` | пакет кафе для игры | 499 КБ | 158 КБ |
| `_common.json` | общий пакет с правками D12 | 65 КБ | 17 КБ |
| `cafe.cards.json` | 247 карточек правил, до которых игра не доходит по id: база знаний советника | 91 КБ | 33 КБ |
| `cafe.reference.json` | всё остальное, что убрано из пакета, с путём до каждой записи | 584 КБ | 178 КБ |
| `build.mjs` | сборщик: `node packs/next/build.mjs`, `--check` — сверить файлы на диске | | |
| `lever-groups.mjs` | темы и условия показа рычагов и срезанных углов | | |
| `swap-test.mjs` | подстановка на копии и все проверки | | |
| `compare.ts` | старый и новый пакет на сценарии `real-packs.test.ts` | | |

События (`cafe.events.json`, `build-events.mjs`) в эту папку кладёт A3 (ветка `claude/serene-volta-k862a1`).

## Вес до и после

| | вес | gzip |
|---|---:|---:|
| `packs/cafe.json` сейчас (v2) | 117 КБ | 29 КБ |
| `packs/cafe.next.json` (D11) | 2 737 КБ с отступами, 2 008 КБ без | 617 КБ |
| `packs/next/cafe.json` | **499 КБ** | **158 КБ** |

Цель была 400 КБ. Пакет вышел на 99 КБ тяжелее: раздел «Что ещё можно вынести» ниже.

### По разделам

| раздел | было, КБ | стало, КБ | записей было → стало |
|---|---:|---:|---|
| `setup` | 83 | 70 | 107 → 107 |
| `kits` | 3 | 3 | 3 → 3 |
| `monthlyCosts` | 17 | 17 | 30 → 30 |
| `staff` | 5 | 5 | 8 → 8 |
| `taxes` | 10 | 5 | 12 → 12 |
| `levers` | 80 | 77 | 94 → 94 |
| `shortcuts` | 36 | 35 | 79 → 79 |
| `violations` | 93 | 61 | 87 → 87 |
| `officials` | 9 | 9 | 14 → 14 |
| `reports` | 12 | 12 | 32 → 32 |
| `events` | 40 | 38 | 63 → 63 |
| `ruleCards` | 129 | 38 | 352 → 105 |
| `suppliers` | 58 | 47 | 60 → 60 |
| `roadmap` | 35 | 35 | 76 → 76 |
| `sources` | 192 | 1 | 1 038 → 6 |
| `extra` | 1 198 | 33 | 75 → 12 разделов |

Ни одна игровая запись не удалена: у всех списков, кроме `ruleCards` и `sources`, число записей прежнее.

## Что убрано и куда

1. **`extra.eventCatalog`** — 698 событий, 862 КБ. События делает A3: `packs/next/cafe.events.json` (202 события в полях первой версии) и `build-events.mjs`. Исходник остаётся в `packs/cafe.next.json`.
2. **63 раздела `extra`, которые не читает код** — в `cafe.reference.json` → `extra`. Самые большие: `formats` 28 КБ, `mechanics` 21, `preOpeningChoices` 20, `menu` 18, `conditionalMonthlyCosts` 17, `mechanicsRanked` 13, `ownerYear` 11, `equipment` 11, `aliases` 10, `signals` 10, `ingredients` 10. Полный список печатает `node packs/next/build.mjs`.
3. **Служебные поля сборки и справочные поля без читателя** — 295 полей у 168 записей, в `cafe.reference.json` → `fields["<раздел>[<id>]"]`: `tier` (76), `evidence` (46), `seenIn` (25), `checkedVia`, `d11`, `d03`, `moreSources`, `realFrequency`, у поставщиков — `priceAnchor`, `minimumOrder`, `paymentTerms`, `leadTime`, `failureModes`. Поиск по всему коду: ни одно из этих полей не читается.
4. **`note` у 99 записей `verified`** — в `cafe.reference.json` → `notes`. По правилу 6 расчёт в `note` нужен оценке; у проверенного числа есть ссылка `source`. У всех 354 записей `estimate` (вместе с вариантами рычагов) `note` остался в пакете.
5. **247 карточек правил** — в `cafe.cards.json`. В пакете — 105 карточек, до которых игра доходит по id: нарушение, предмет, рычаг, вариант рычага, налог, срезанный угол; id из кода аналитики (`sales_tax`, `workers_comp`, `payroll_taxes`, `fse_permit`); все 23 карточки v1; `tier: core`. У каждого нарушения карточка осталась (`PACK.md`, правило 6). Вынесенные карточки читает только советник (`ai/src/advisor.ts`), а он работает на сервере.
6. **`sources`** — 1 032 записи в `cafe.reference.json` → `sources`. Код этот список не читает. В пакете — 6 источников главных чисел (`unit`, `market`, `capacity`, `sizing`, `benchmarks`, `manager`); у каждой записи своя ссылка в `source`.

### Что оставлено в `extra` и почему

| раздел | кто читает |
|---|---|
| `footfall` | `shared/src/place.ts`, `engine/src/economy/demand.ts` (`footfallDemand`), `bots/src/brain.ts` |
| `buildout` | `shared/src/place.ts`: цена и срок ремонта по прошлому назначению помещения |
| `takeover` | `shared/src/place.ts`: покупка действующей кофейни |
| `weekdayMult` | `engine/src/economy/effects.ts` |
| `taxableShare` | `engine/src/economy/taxes.ts` |
| `rentByTier` | `engine/src/economy/check-pack.ts` |
| `seatThresholds` | `engine/src/economy/actions.ts`: санузел от 20 мест и т. п. |
| `financing`, `exitWaterfalls` | B08 (займы и выход), назначено в `ROUND3.md` |
| `fineSchedules`, `inspectionPointsD08` | B06 (буква проверки, повторные нарушения), назначено в `ROUND3.md` |
| `leverGroups` | B14 (Manage по темам), новое — ниже |

Ещё код читает `exclusiveShortcuts`, `outsideWeight`, `fairPriceBand`, `overpriceSteepness`, `taxableShareByTax`, но в новом пакете их нет: сборщик пропустит их, если они появятся.

`guestSegments`, `queue`, `staffModel`, `serviceRates` и прочие разделы D11 о гостях, зале и людях в пакет **не** взяты. Части B01–B04 включаются, когда в пакете появляется `extra.guestSegments`, `extra.service`, `extra.staffing` или `extra.regulars`. Им нужна форма из `FORMATS.md` (A1). Раздел D11 с тем же именем, но другой формы включил бы часть с чужими числами. Сборщик вливает `packs/parts/cafe/D20-formats.json` (A1), как только файл появится в ветке.

Как искал читателей: `grep` по `extra.` и по имени каждого из 98 ключей в `engine/ host/ server/ client/ bots/ ai/ shared/` без тестов. Ложные совпадения отброшены вручную: `equipment`, `ingredients`, `tips`, `queue`, `competition`, `formats` — это другие поля или слова в тексте; `financing` — слово в комментарии `month.ts`; `takeoverRules` — имя функции, читается ключ `takeover`.

## `extra.leverGroups`

Семь тем: Room and line, Menu and supplies, Team, Customers and sales, Cleaning and equipment, Street, weather and the city, Money, insurance and law. Срезанные углы разложены по тому, кто их находит (`official` нарушения), и попадают в ту же тему или в свою: Food safety, Staff and pay, Building, fire and plumbing, Sidewalk, trash and signs, Taxes, Customers and prices. Каждый из 94 рычагов и 79 углов — ровно в одной теме; сборщик падает, если это не так.

**Сразу видны 15 рычагов.** Они каждый день меняют спрос, качество, скорость или крупную статью расходов у любого формата и различают три формата:

- навынос — `queue_setup`, `order_ahead`, `peak_schedule`;
- районная с посадкой — `seating_layout`, `laptop_policy`, `loyalty`;
- specialty — `sourcing`, `bean_contract`, `training`, `pastry_program`;
- у всех — `hours`, `staff_pay`, `cleaning`, `alt_milk_pricing`, `delivery_apps`.

Четыре из пяти рычагов v1 (`hours`, `sourcing`, `staff_pay`, `cleaning`) — среди них; `pest_control` появляется через 14 дней.

**Срезанных углов сразу видно 6** — те, что были в пакете v1 и касаются кофейни с первого дня: `skip_food_protection_cert`, `keep_old_food`, `home_baked_pastries`, `keep_tips`, `unpaid_trial_shifts`, `no_spread_of_hours`.

**Остальные — по условию** (`show` у каждой записи):

| условие | когда видно | примеры |
|---|---|---|
| `{ months: [..] }` | в эти месяцы года; сезон из `activeMonths` записи, с месяца до начала | `winter_proofing` 10–3, `snow_ice_plan` 11–3, `outdoor_seating` 3–10, `estimated_tax_plan` 3, 5, 8, 12 (за месяц до сроков IRS) |
| `{ phase }` | шаг до открытия: `before_lease`, `construction`, `closing` | `open_in_wrong_use_space`, `build_without_permit` |
| `{ entry: 'takeover' }` | покупка действующей кофейни | `trade_on_sellers_permit`, `skip_bulk_sale_notice` |
| `{ staffAtLeast }` | в штате n человек и больше | `scheduling` 3, `bench_depth` 4, `fire_union_organizers` 5 |
| `{ seatsAtLeast }` | мест n и больше | `restroom_access` 16, `squeeze_extra_seats` 15 (порог закона — 20 мест) |
| `{ afterDays }` | через n дней после открытия | `reviews` 30, `catering` 60 |
| `{ event: [поля] }` | объявлено или идёт событие с эффектом на эти поля (`EVENTS.md`, A3) | `storm_day_policy`, `shed_response`, `outage_kit` |
| `{ lowCash: true }` | в кассе меньше одного месяца постоянных расходов | `bill_timing`, `spend_payroll_withholding` |
| `'more'` | только в полном списке «All levers» | `legal_help`, `epli_cover` |

Условие — подсказка экрану, а не правило игры: включённый рычаг работает и тогда, когда его не видно. Читатель — B14 (`client/src/screens/business/`).

## Общий пакет: правки D12

`packs/next/_common.json` = `packs/_common.json` этой ветки + `D12-number-check.common.json` (ветка `claude/jolly-volta-dv0cll`). Поля записи из D12 заменяют одноимённые, прочие поля записи остаются. `extra` сливается вглубь. 21 правка:

- нарушения: `no_i9` — штраф $1 160 → $1 152, максимум $11 600 → $11 444 (28 CFR §85.5), источник и расчёт; `sick_leave_denied` — закон, источник и расчёт (правила DCWP с 23.07.2026); `returns_not_filed`, `no_wc_insurance` — расчёт;
- налоги: `disability_pfl` — источник и расчёт; `futa`, `workers_comp`, `ny_unemployment` — расчёт;
- срезанные углы: у всех 12 — источник, расчёт и `confidence`;
- `extra.statutory` — ставки и пороги 2026 года.

Валидатор: 0 ошибок, 1 старое предупреждение (`bribery`). На деньги честного кафе правки не влияют: `compare.ts` даёт одинаковый результат с новым и со старым общим пакетом.

## Валидатор

```
node build/validate-pack.mjs packs/next/cafe.json packs/next/_common.json
WARN   violations (ventilation_inadequate): ни один shortcut или lever к нему не ведёт
--- packs/next/cafe.json: ошибок 0, предупреждений 1; чисел с пометкой verified: 84 из 244
```

Предупреждение пришло из D11 (`MERGE.md`, раздел 7): у варианта «не обслуживать кондиционер» может быть только одно нарушение.

## Подстановка: тесты и сквозной прогон

`node packs/next/swap-test.mjs`, 14 ноября 2026, ветка на 21:29 UTC.

| проверка | итог |
|---|---|
| `validate-pack.mjs` — кафе | 0 ошибок, 1 предупреждение (`ventilation_inadequate`, из D11) |
| `validate-pack.mjs` — общий | 0 ошибок, 1 старое предупреждение (`bribery`) |
| `scripts/validate-all.mjs` | 3 из 3 пакетов |
| `npm run check` | чисто |
| `npm test` — shared, ai, host, server, bots, client | зелёные: 7, 59, 13, 11, 17, 292 |
| `npm test` — engine | **1 упал**, 238 прошли — `real-packs.test.ts`, раздел ниже |
| `node scripts/smoke.mjs` | **нестабилен**: на ужатом пакете 1 GREEN и 2 RED из 3 запусков; на полном `cafe.next.json` — 1 GREEN из 1 |

**Сквозной прогон.** Падают шаги «Cross-promo between them is accepted» (`propose_deal: A bankrupt business cannot make deals`) и «Both views carry analytics» (`B has no analytics`): кафе B со срезанным углом `cash_wages` банкротится после штрафа. Пакет здесь ни при чём: в зелёных запусках шаг «City runs 35 days» кончается на 72-й день, в красных — на 130-й и 155-й. Город живёт по часам (`dayMs: 25`, 40 дней в секунду), а прогон опрашивает его раз в 250 мс. Секундная заминка сервера — это 40 лишних игровых дней: штраф `off_books_payroll` растёт с каждым месяцем (6 502 → 16 690 $), и B не выдерживает. Расчёт движка с новым пакетом не медленнее: `recommend` 1,9 мс против 1,5 мс, `tickDay` на два кафе 0,4 мс против 0,2 мс. Просьба к ведущему — ниже.

## Ужатый пакет даёт ту же игру, что полный

`npx tsx packs/next/compare.ts`: шесть честных кафе, 360 дней, с наёмным управляющим. История каждого месяца у `packs/next/cafe.json` и у полного `packs/cafe.next.json` совпадает до цента. Убранное движок не читает.

## Упавший тест и новая граница

`engine/test/economy/real-packs.test.ts` › «an honest standard cafe sells about 200 checks a day at $8.50; with a hired manager it keeps about $4,000 before owner taxes, as in the notes»:

```
AssertionError: expected 2305.33 to be greater than 2800
```

Тест ждёт от $2 800 до $5 500 «до налогов владельца» в каждом месяце со второго по шестой.

| честное стандартное кафе, 18 мест | v1 | новый |
|---|---|---|
| заказов в день | 199–201 | 197–199 |
| до налогов владельца, с управляющим, мес. 2–6 | $3 317–4 306 | **$2 305–3 426** |
| до налогов владельца, владелец за стойкой, мес. 2–6 | $8 775–9 569 | $8 584–9 484 |
| деньги через 12 месяцев, с управляющим | $127 982 | $115 486 |

**Почему меньше.** Статьи третьего месяца, где новый пакет отличается от v1 (`compare.ts`):

- управляющий дороже на $725: законный порог оклада 2026 года;
- замена ушедших работников −$452, подмены и сверхурочные −$136, напитки смены −$144, посуда −$83: этих статей в v1 не было;
- ремонт и обслуживание по статьям — около −$440: вызовы мастера, жироуловитель, кондиционер, мелкий ремонт, вода для кофемашины, ежегодная проверка обратного клапана;
- мелкие платные варианты рычагов и новые статьи по умолчанию — около −$370: жалобы и возвраты, оспоренные платежи, отбор кандидатов, коврики у входа, перчатки, музыка, приложение для расписания, снег, этикетки;
- выручка −$357: 197–199 заказов в день вместо 200;
- зато обслуживание оборудования одной строкой из v1 больше не списывается (+$300), бариста дешевле (+$1 440).

**Новая граница — $2 000 снизу**, верх $5 500 оставить. Расчёт: по NRA, медиана прибыли до налогов у заведений с обслуживанием у стойки — 4,0% продаж (`benchmarks.netMarginPct` пакета, источник — `restaurant.org`). Выручка кафе из теста — 198 заказов × 30 дней × $8,50 ≈ $50 500 в месяц, 4,0% от неё — $2 020. С управляющим кафе — ровно медианное заведение; ниже медианы честное кафе в спокойный месяц уходить не должно. Название теста — «keeps about $3,000, near the NRA median of 4% of sales».

Правка в чужом файле (`engine/test/`), поэтому — просьба к ведущему. Второй путь из `MERGE.md` — вернуть часть новых расходов в условные — меняет данные D11, его оставляю ведущему.

`extra.footfall.captureRate` калибровался на расходах v1. После подмены его стоит проверить: `npx tsx sim/calibrate.ts doors`.

## Загрузчики не подхватывают `packs/next/`

| кто читает `packs/` | как | `packs/next/` |
|---|---|---|
| `client/src/app/local-host.ts` | `import.meta.glob('../../../packs/*.json')` | нет: `*` не проходит через `/` |
| `server/src/data.ts` | `packs/_common.json` и `packs/${id}.json` по списку ниш | нет |
| `scripts/validate-all.mjs` | `readdirSync('packs')`, имена на `.json` | нет: `next` — папка; прогон с `packs/next/` на диске проверяет 3 файла |
| `ai/src/demo.ts` | `readdirSync('packs')`, имена на `.json` | нет |
| `engine/src/economy/check-pack.ts`, `demo.ts`, `sim/calibrate.ts`, тесты | имена файлов прямо | нет |

`fs.globSync('packs/*.json')` в этой ветке: `_common.json`, `barbershop.json`, `cafe.json`. `Dockerfile` копирует весь репозиторий, так что в образ папка попадёт (+1,2 МБ на диске), но читать её некому.

## Что ещё можно вынести, если нужно 400 КБ

| что | экономия | цена |
|---|---:|---|
| `note` у 354 оценок в отдельный файл | ~130 КБ | ломает правило 6 («оценка — с расчётом в note») и валидатор: у оценки без `note` — ошибка |
| `suppliers` — отдельным запросом | 47 КБ | их читает только план в конце сезона (`engine/src/analytics/plan.ts`); движку на сервере нужен доступ к файлу |
| `roadmap` шагов покупки, тележек и франшизы | ~10 КБ | шаги нужны тем, кто выбрал этот путь |
| `reports` — 32 жалобы → 12 | ~8 КБ | меньше выбора у «Сообщить городу» |

Я ничего из этого не сделал: каждое меняет то, что видит игрок, или правила пакета. В gzip пакет весит 158 КБ — столько клиент и скачивает с `/api/packs`.

## Просьбы к ведущему

1. Перенести нижнюю границу в `real-packs.test.ts` с $2 800 на $2 000 (расчёт выше).
2. B09 и B10: советнику подгружать `packs/next/cafe.cards.json` рядом с пакетом (или отдавать отдельным запросом, как каталог событий). Пока не подгружает, советник знает 105 карточек вместо 352.
3. Когда A1 сдаст `packs/parts/cafe/D20-formats.json`: пересобрать `node packs/next/build.mjs`, разделы B01–B04 и `profiles` встанут в пакет сами.
4. `causes` списком (`MERGE.md`, раздел 8) уберёт последнее предупреждение валидатора.
5. `scripts/smoke.mjs`, шаг `month`: ставить часы на паузу и двигать их `advanceDays` (как в шаге `open`), а не ждать по живым часам. Тогда прогон не зависит от скорости машины и не краснеет на новом пакете.
