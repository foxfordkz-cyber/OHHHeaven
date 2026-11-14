# MERGE — сборка пакета кафе из фрагментов D00–D19 (задание D11)

Сборщик: D11, ветка `claude/jolly-volta-dv0cll`, 14 ноября 2026. Сборка воспроизводится одной командой, см. раздел 9.

## 1. Вердикт

<!-- D11:auto:verdict -->
1. `packs/cafe.next.json` собран из основы и 18 файлов фрагментов (D00, D01, D02, D03, D04, D05, D06, D07, D08, D09, D10, D12, D13, D14, D15, D16, D17). Валидатор: **0 ошибок**, 1 предупреждение (раздел 7).
2. Пакет вырос с 6 событий и 5 рычагов до 698 событий с числами в `extra.eventCatalog` (533 откалиброваны в D15–D19), 94 рычагов, 79 срезанных углов, 87 нарушений, 352 карточек правил и плана открытия из 76 шагов по порядку.
3. Повторы склеены: 172 записи под чужими `id` сведены к одному `id`, ещё 102 события склеены по названию и по отметкам калибровщиков (`duplicateOf`). Старые `id` сохранены в `extra.aliases` и в `aliases` у событий.
<!-- /D11:auto:verdict -->
4. Движок на новом пакете работает: из 229 тестов движка падает 1, сквозной прогон игры (smoke) зелёный. Это тест `real-packs` на маржу. Честное кафе с управляющим теперь оставляет $2 300–3 400 в месяц до налогов владельца, тест ждёт от $2 800. Причины и что делать — в разделе 6.
5. Главное для ведущего — 23 механики по важности (раздел 4). Первая из них — ошибка движка, её нашёл D14: места в зале ограничивают и тех, кто берёт кофе с собой.

## 2. Что вошло

### 2.1. Источники сборки

| Фрагмент | Ветка | Файл |
|---|---|---|
| основа | `claude/keen-cray-yytcbp` | `packs/cafe.json` v2 = main v1 + спрос по прохожим, ремонт по площади, покупка готового кафе (`extra.footfall`, `extra.buildout`, `extra.takeover`). Копия: `D11-base.json` |
| D00 | `research/d00-cafe-total-search` | `D00-total-search.json` (342 события, 240 неочевидных, 80 историй, аудит 63 чисел) |
| D01 | `claude/compassionate-hamilton-4ox21k` | `D01-entry-preopening.json` |
| D02 | `claude/serene-carson-9rbdw5` | `D02-premises.json` |
| D03 | `claude/clever-darwin-vbh10q` | `D03-equipment.json` |
| D04 | `claude/eager-hopper-hqtlhu` | `D04-menu-cogs-suppliers-waste.json` |
| D05 | `claude/focused-volta-ebhl7l` | `D05-people.json` |
| D06 | `claude/friendly-gates-gm8x06` | `D06-demand.json` |
| D07 | `claude/dreamy-shannon-a980qa` | `D07-weather-street-city.json` |
| D08 | `claude/sharp-gauss-y0pa2n` | `D08-law.json` |
| D09 | `claude/nifty-planck-ri02xf` | `D09-money.json` |
| D10 | `claude/friendly-dijkstra-sd1mpr` | `D10-deaths-nonobvious-year.json` |
| D12 | `claude/vigilant-lamport-u5wgaj` | `D12-number-check.json` (правки для `_common` — в `D12-number-check.common.json`, в сборку кафе не входят) |
| D13 | `claude/sharp-goldberg-vai9pv` | `D13-formats.json` |
| D14 | `claude/epic-volta-lhqkam` | `D14-mechanics.json`, `D14-mechanics-spec.md` |
| D15 | `claude/awesome-bohr-7697u3` и `claude/sharp-goldberg-vai9pv` | Два исполнителя одного задания: `D15-calibration-premises.json` (awesome-bohr, 195 событий, применяется вторым и выигрывает) и `D15-calibration-premises.sharp.json` (sharp-goldberg, 206 событий). 180 событий у них общие. |
| D16 | `claude/clever-darwin-vbh10q` | `D16-calibration-equipment-food.json` |
| D17 | `claude/inspiring-ptolemy-thi9ip` | `D17-calibration-people-money.json` |
| D18 | `claude/gifted-thompson-lwbuji` | на 18:25 UTC только журнал `D18-calibration-street-demand.md`, JSON нет |
| D19 | — | не начат |

Все файлы фрагментов скопированы в `packs/parts/cafe/` этой ветки скриптом `D11-collect.mjs`.

### 2.2. Счётчики по разделам

<!-- D11:auto:counts -->
| Раздел | main (v1) | записей во фрагментах | уникальных id после склейки | в cafe.next.json | исправлено записей main | вынесено в extra |
|---|---|---|---|---|---|---|
| setup | 33 | 164 | 147 | 107 | 21 | 40 |
| monthlyCosts | 16 | 60 | 62 | 30 | 7 | 32 |
| staff | 2 | 15 | 12 | 8 | 2 | 4 |
| taxes | 1 | 14 | 13 | 12 | 1 | 1 |
| levers | 5 | 165 | 128 | 94 | 5 | 34 |
| shortcuts | 8 | 126 | 90 | 79 | 8 | 11 |
| violations | 11 | 159 | 101 | 87 | 11 | 14 |
| officials | 3 | 43 | 17 | 14 | 3 | 2 |
| reports | 4 | 50 | 35 | 32 | 0 | 3 |
| events | 6 | 74 | 66 | 63 | 4 | 3 |
| ruleCards | 23 | 376 | 352 | 352 | 4 | 0 |
| roadmap | 14 | 99 | 96 | 76 | 2 | 0 |
| suppliers | 12 | 67 | 68 | 60 | 5 | 8 |
<!-- /D11:auto:counts -->

<!-- D11:auto:extraSummary -->
Сверх разделов: `extra.eventCatalog` — 698 событий с числами (в main 0), из них 533 откалиброваны в D15–D19 (применено калибровок: 767, файлы: D15-calibration-premises.sharp.json, D15-calibration-premises.json, D16-calibration-equipment-food.json, D17-calibration-people-money.json); `extra.mechanics` — 145 предложенных механик; `extra.mechanicsRanked` — 23 механик по важности; `extra.effectFields` — словарь 108 полей эффектов. Справочник `D11-reference.json`: 640 неочевидных фактов, 177 историй закрытий, 152 событий без чисел, полные записи всех событий и механик, 110 записей других форматов.

Наборы (с новыми обязательными предметами): lean — <!-- D11:auto:extraSummary -->36 496 (main <!-- D11:auto:extraSummary -->33 882); standard — <!-- D11:auto:extraSummary -->43 780 (main <!-- D11:auto:extraSummary -->41 166); premium — <!-- D11:auto:extraSummary -->73 831 (main <!-- D11:auto:extraSummary -->70 217); стартовый капитал <!-- /D11:auto:extraSummary -->24 000. Цена рычагов по умолчанию — $732 в месяц (раздел 5.2). Вес пакета: 2 007 КБ, в gzip 586 КБ (main — 94 КБ). Источников в пакете 1 038, всего 1 673.
<!-- /D11:auto:extraSummary -->24 000. Цена рычагов по умолчанию — $732 в месяц (раздел 5.2). Вес пакета: 2 006 КБ, в gzip 585 КБ (main — 94 КБ). Источников в пакете 1 038, всего 1 672.
<!-- /D11:auto:extraSummary -->24 000. Цена рычагов по умолчанию — $732 в месяц (раздел 5.2). Вес пакета: 2 005 КБ, в gzip 585 КБ (main — 94 КБ). Источников в пакете 1 038, всего 1 672.
<!-- /D11:auto:extraSummary -->24 000. Цена рычагов по умолчанию — $732 в месяц (раздел 5.2). Вес пакета: 2 005 КБ, в gzip 585 КБ (main — 94 КБ). Источников в пакете 1 038, всего 1 672.
<!-- /D11:auto:extraSummary -->

Новые обязательные предметы, добавлены во все три набора: `dob_alteration_filing_fee` ($915, пошлина Департамента зданий за перепланировку) и `asbestos_survey_acp5` ($900, обследование на асбест перед разрешением). Наборы подорожали на $2 600–3 600: эти два предмета и кофемолка по новой цене.

### 2.3. Как выбиралась запись, если версий несколько

1. Решение сборщика из `D11-decisions.mjs` (`prefer`, `override`).
2. Правка D12 для записи из основы. Задача D12 — проверка чисел по первоисточникам, поэтому её правка важнее оценок других фрагментов.
3. Запись с `verified` важнее записи с `estimate`.
4. Источник с сайта государства или текста закона важнее.
5. Фрагмент-владелец темы важнее: оборудование — D03, деньги — D09, люди — D05, закон — D08, меню — D04, улица — D07.
6. При равенстве — более полная запись.

Записи без обязательных полей раздела считаются правками, а не новыми записями. Например, D00 исправлял в нарушениях только `fine.perMonth`; такие правки накладываются на запись основы. У фрагментов, которые меняли основу (D01–D14), поля движка из ветки keen-cray (`costBasis`, `rate`, `afterBuildout`, `includedInTakeover`) сохраняются.

### 2.4. Главные числа, которые изменились

| Что | main | cafe.next | Откуда и почему |
|---|---|---|---|
| Ставка бариста | $21 | **$18** | D12: NY DOL OEWS, I кв. 2026, NYC, SOC 35-3023 — медиана $17.57, средняя $18.90. $21 был плановой ставкой из заметок. |
| Лестница оплаты | — | стажёр $17, неполный день $18, бариста $18, старший смены $24, помощник управляющего $27 | D05 строил лестницу от $21. D11 перестроил её от $18 D12: стажёр получает минимальную ставку NYC, $17.00. На 1 января 2027 года она не растёт — сработало условие закона, подтверждено поиском. |
| Управляющий | $4 800 | **$5 525** | D05: чтобы управляющему законно не платить сверхурочные, нужен оклад не ниже $1 275 в неделю (NYC, 2026). Это $66 300 в год, $5 525 в месяц. Поиск подтвердил $1 275 по нескольким юридическим источникам. |
| Кофемолка (основная и для декафа) | $2 099 | **$3 099** | D12: модель E65S снята с производства, преемник E65W стоит $3 099 (Visions Espresso). |
| Цена покупки готового кафе | 0,2 × годовой выручки | **0,4 ×**, потолок $300 000 | D12: BizBuySell — медиана проданного кафе 0,41 выручки и 2,2 прибыли владельца. |
| Обслуживание | одна строка $300 | **$45 + 7 отдельных строк**: откачка жироуловителя $75, резерв на ремонт $189, проверка обратного клапана $38, огнетушители $13, жернова, химия $24, посуда $83 | D03 разложил строку по статьям; фильтры и профилактика стали рычагами. |
| Новые расходы на работников | — | замена ушедших $113, подмена отсутствующих $34, напитки смены $36, годовые обучения $5 на человека | D05: текучка и подмены есть в каждом кафе. |
| Вес факторов спроса | цена 0,35, качество 0,25, репутация 0,2, место 0,2 | цена 0,40, качество 0,28, репутация 0,09, место 0,23 | D06, обоснование — `D06-demand.md` и `D11-reference.json → parts.D06.demandEvidence`. Это меняет поведение движка; см. раздел 6. |
| Площадь на место | 18 кв. футов | 21 | D02: нормы выхода и практика. Порог «тесно» 0,90 → 0,85, порог «пусто» 0,40 → 0,30. |
| Леса над тротуаром (событие) | −10% прохожих, 3 месяца | −7%, **6 месяцев** | D12: исследование города и Mastercard 2024 года — от −3,5% до −9,7% транзакций у кафе и ресторанов за полгода. |
| Минимальная зарплата 2027 года (событие) | — | может вырасти до $17,60 **с 1 марта 2027 года** | D09 и D12 против D10 («шаг 1 января»). Поиск подтвердил: на 1 января 2027 года ставка не растёт, губернатор предложил $17,60 с 1 марта, если согласится Законодательное собрание. |
| Долгие часы работы | $2 300 | $2 000 | D12: пересчёт по ставке $18. |

## 3. Что отложено и куда

| Куда | Сколько | Что и почему |
|---|---|---|
| `D11-reference.json → formatRecords` | 110 записей | Тележка, фургон, рынок, киоск, пекарня, сок и bubble tea, винный бар, кухня только для доставки, франшиза (D13 и часть D01). Это другие форматы. В кафе они пригодятся при переходе (D13 `transitions`) и в следующих нишах. Индекс — `extra.formatRecordsIndex`. |
| `extra.conditionalMonthlyCosts` | 22 | Расходы не каждого кафе: платежи по кредитам, кассовый аванс (MCA), комиссия доставки 23%, сборы за уличную посадку, ежегодный рост аренды, свечи, вывеска с подсветкой, своя медстраховка владельца и т. п. Движок списывает каждую строку `monthlyCosts` каждый месяц. Если влить их туда, обычное кафе платило бы чужие кредиты. Сюда же `hvac_service_contract` и `music_license`: их цену уже несут рычаги `hvac_service` и `music`. |
| `extra.preOpeningChoices` | 16 | Решения, которые принимаются один раз до открытия: способ входа, гарантия, бесплатные месяцы аренды, подрядчик, темп ремонта, газ или электричество, форма налогообложения, проверка покупки. Движок спрашивает рычаги каждый месяц, поэтому им нужна механика 2 (раздел 4). |
| `extra.roadmapPaths` | takeover 6, franchise 2, cart 5, popup 2 | Шаги других путей входа. Основной план — 76 шагов открытия с нуля в бывшем кафе, по порядку `roadmapOrder` из решений. |
| `D11-reference.json` | 640 неочевидных, 177 историй, 158 событий без чисел | Справочник: движку не нужен, а клиент скачивает пакет целиком (`/api/packs`). События без чисел вернутся в пакет, когда D18 и D19 дадут им числа: сборка перезапускается одной командой. |
| `D11-reference.json → parts` | исследовательские заметки D00–D16 | Журналы поиска, аудиты, сравнения, «не найдено». |

Ничего не выброшено. Одна запись удалена как точная копия общего пакета: `labor_investigator` уже есть в `_common`. Девять налогов D09 с нулевой ставкой — справочные: они остались в `taxes` и денег не списывают. Пороги и настоящие ставки — в их `note`.

<!-- D11:auto:moved -->
Вынесено из разделов: в `D11-reference.json → formatRecords` — 110, в `extra.conditionalMonthlyCosts` — 22, в `extra.preOpeningChoices` — 20, в `extra.roadmapPaths` — takeover 6, franchise 2, cart 5, popup 2. Варианты, добавленные к рычагам записями `addsOptionsTo`: free_rent_deal +1 (D15), site_due_diligence +2 (D15), contractor_choice +1 (D15), takeover_transition +1 (D15), lease_contingencies +2 (D15), laptop_policy +2 (D15), seating_layout +3 (D15). Расчёт подставлен из каталога для оценок без `note`: events.holdover_after_expiry, events.d00_street_hidden_sign, events.peak_kw_bill_jump.

Ходы игрока в событиях: 1 286; из них 207 ссылаются на рычаг или срезанный угол, которого нет в пакете (помечены `inPack: false`). Это займы и выход из бизнеса (механики 11 и 12), рычаги других форматов и ответы, которые калибровщики D15–D17 придумали для одного события (`*_response`). Движку нужен «ход события» — вариант, который живёт только внутри события (раздел 8).
<!-- /D11:auto:moved -->

## 4. Механики для ведущего — по важности

138 механик из фрагментов сведены в 23. Полный список с полями — `extra.mechanicsRanked`; у каждой механики в `extra.mechanics` есть `cluster`. Объём работы агента: S — до 6 часов, M — 6–12, L — больше 12. Четыре примера пользователя D14 оценил в 32–42 часа вместе (`D14-mechanics-spec.md`).

| # | Механика | Что сделать | Объём | Почему здесь |
|---|---|---|---|---|
| 1 | `seats_vs_takeaway_and_rush` — площадь, места, утренний пик, очередь | Ограничивать местами только тех, кто садится; утренний час пик и уход из очереди; пороги 20 мест, 31 и 75 человек; бюджет площади | M | **Ошибка движка** (D14): лимит мест режет и навынос. На настоящих кварталах карты (341–442 заказа в день) движок теряет 86–187 заказов в день, в жизни 0–17. Пример пользователя 3. |
| 2 | `preopening_rent_clock` — месяцы до открытия | Аренда идёт, выручки нет; бесплатные месяцы; параллельные разрешения, дату задаёт самое длинное; цена задержки; приказ об остановке работ как состояние | M | Касается каждого игрока. Без бесплатных месяцев до первой продажи уходит ≈ $19 700, с обычными тремя — ≈ $4 000 (D14). Пример пользователя 1. Часть уже есть в ветке keen-cray. |
| 3 | `event_effects_runtime` — исполнение событий | Разовые деньги, открытое нарушение, условие «только для кафе с…», счёт позже, у каждого хода цена | L | 695 событий с числами, но движок читает только множитель на 9 полей. Используется 100 полей (`extra.effectFields`): `cash` — 116 событий, `cashOut` — 50, `openingDelayDays` — 43, `violation` — 41, `closureDays` — 27. Без этого слоя каталог не работает. |
| 4 | `winter_at_the_door` — снег и лёд у входа | Часы на уборку после снегопада; штраф DSNY $100 / $150 / $250 ($350 при неявке); падение и иск; рычаг только зимой | S | Пример пользователя 4. Данные готовы: D07, D14 `extra.winterDoor`. |
| 5 | `buy_operating_business` — покупка готового кафе | Цена 0,4 выручки; уведомление о покупке бизнеса (иначе покупатель платит налог продавца); разрешения не переходят; возраст оборудования; рассрочка от продавца | M | Пример пользователя 2. keen-cray продаёт готовые помещения; не хватает долгов, которые переходят. |
| 6 | `cash_is_not_profit` — деньги ≠ прибыль | Календарь платежей; налог с продаж и удержанный налог с зарплат — чужие деньги; месяцы с пятью выплатами | M | Самая частая смерть в историях закрытий (D00, D10): прибыль есть, денег нет. |
| 7 | `inspection_grade_and_hearings` — оценка в витрине | Баллы за нарушения → буква A/B/C → спрос; повторная проверка; суд OATH; повторные нарушения дороже; закрытие | M | Самое видимое правило кафе в NYC; D06 оценил влияние буквы на спрос. |
| 8 | `equipment_wear_and_outages` — износ и аварии | Пропуск обслуживания — поломка в известном месяце; одна машина — одна точка отказа; отключение света и испорченные продукты | M | Делает рычаги обслуживания осмысленными, без кубика. |
| 9 | `staff_model` — люди | Расписание на весь день, рост навыка, текучка, чаевые, больничные, пороги по числу работников, потолки налогов на работника | L | Самая большая статья расходов. |
| 10 | `lease_lifecycle` — аренда на 10 лет | Переговоры, рост аренды, продление, гарантия при выходе | M | Вторая статья расходов; конец договора — частая причина закрытия. |
| 11 | `financing` — займы | SBA 7(a), микрозайм, семья, лизинг, кассовый аванс | M | Сейчас капитал фиксирован; кассовый аванс — классическая спираль. |
| 12 | `exit` — выход | Продажа, закрытие, что остаётся должен владелец | M | Год заканчивается продажей, закрытием или продлением. |
| 13 | `demand_calendar_and_weather` — кто и когда идёт мимо | Типы гостей, офисная неделя, школьный календарь, температура и доля холодных напитков, уличная посадка | M | Один и тот же месяц разный у офиса, кампуса и туристов. |
| 14 | `menu_cogs_and_suppliers` — меню по позициям | 24 позиции, 21 ингредиент с ценовыми сигналами, заказ свежего, недостачи, условия поставщиков, налог по позиции | M | Себестоимость сейчас одно число. |
| 15 | `reputation_and_regulars` — рейтинг и постоянные гости | Рейтинг по отзывам, постоянные растут медленно, память о цене | S | |
| 16 | `owner_hours_and_household` — часы и семья владельца | Часы за стойкой вместо зарплаты, выгорание, своя медстраховка ($807) | S | |
| 17 | `private_lawsuits` — иски людей | Доступность, падение, зарплата, музыка | S | |
| 18 | `channels_and_delivery` — каналы | Доставка с потолком комиссии NYC, кейтеринг, абонементы | S | |
| 19 | `rivals` — соседи-конкуренты | Открытие и закрытие сети рядом | S | keen-cray уже делит прохожих между соседями. |
| 20 | `formats_and_transitions` — другие форматы | Франшиза, тележка, киоск, пекарня, вино, вторая точка | L | Для следующих ниш и переходов (D13). |
| 21 | `insurance` | Что платит страховка; доплата после аудита фонда оплаты труда | S | |
| 22 | `tax_structure_and_debt` | LLC или S-корпорация, взыскание неуплаченного налога, расходы до открытия | S | |
| 23 | `building_environment` | Затопление подвала, мусор и крысы, подвал как склад | S | |

## 5. Противоречия

### 5.1. Решены сборщиком по источнику

Сайты nyc.gov, ny.gov и governor.ny.gov в этой сессии закрыты для прямого чтения: DNS не разрешается. Поэтому проверка шла через веб-поиск, который показывает текст страниц. Такие правки помечены `estimate`, а в `note` написано «search-seen».

| Запись | Спор | Решение | Основание |
|---|---|---|---|
| `violations.sign_without_permit` | D02: $1 250 (класс 2) против D08: $6 000–15 000 | **Штрафа нет, нужно узаконить вывеску**: `pctOfSaved` 1 | Мораторий Департамента зданий: за работу без разрешения на вывеске до 150 кв. футов и 1 200 фунтов гражданский штраф не берут. Введён Local Law 28/2019, продлён LL 43/2023, расширен LL 15/2026. Срок окончания не найден. Для большой или опасной вывески остаётся $1 250. |
| `violations.dirty_sidewalk` | D07: 50/250/500 против D08: 100/50/300 | **$50 → $100 при повторе, $300 при неявке** | Санитарная таблица штрафов, ред. 14.11.2021, §16-118(2)(a). С 19.12.2024 штрафы для повторных нарушителей выросли; новые суммы не найдены. |
| `violations.backflow_not_tested` | D02 $100; D03 $700 + $150 в месяц, до $10 000; D08 $500, до $1 000 | **D08: $500, максимум $1 000** | Таблица штрафов OATH по воде (2021): $500, со смягчением $50, максимум $1 000. Сумма $700–10 000 у D03 взята из законопроекта 2018 года, принятым он не найден. |
| `violations.snow_ice_not_cleared` | D07 против D14 (+$50 в месяц) | **D07: $100, максимум $350** | §16-123: $100, $150, $250, при неявке $350. Рост идёт с каждым новым нарушением за 12 месяцев, а не с каждым месяцем. |
| `violations.illegal_posting` | D06 $1 500 против D07 $750 | **D07 ✓** | D07 посчитал по открытым данным OATH: $75 за листок, каждый листок — отдельная повестка. Таблица DSNY 2021 года даёт $75 / $150 / $200. |
| `violations.pay_frequency_violation` | D05 $1 000, D09 $300, D10 $0 + $20 в месяц | **D10** | Поправка к закону о труде от 9 мая 2025 года: за первое нарушение платят только проценты за задержку, если работникам платили хотя бы дважды в месяц. Полная неустойка — за повторное. |
| `violations.foam_containers` | D04 $50 против D08 $150 | **D08: $150 / $250 / $500** | Страница DSNY. В тексте LL 142 суммы выше: $250 / $500 / $1 000. |
| `setup.sba_guaranty_fee` | D01 $2 550 против D09 $1 700 на $100 000 | **D09** | SBA, уведомление 5000-872051, 2026 ф. г.: займ до $150 000 — 2% от гарантированной части (85%). $2 550 — ставка 3% для займов от $150 001. |
| `setup.landmarks_storefront_permit` | D01 $320 против D02 $0 | **D01 $320** | LPC: $95 за первые $25 000 работ и $5 за каждую следующую $1 000. Разрешение на мелкие работы бесплатно, отсюда $0 у D02. Для ремонта на $70 000 выходит $320. |
| `events.minimum_wage_march_2027` | D09: 1 марта против D10: 1 января | **D09/D12** | Ставка 2027 года на 1 января не выросла: сработало условие закона. Предложено $17,60 с 1 марта — при согласии Законодательного собрания. |
| `setup.con_ed_security_deposit` | D01 $1 600 против D09 $1 800 | **D01 $1 600**, правило дописано в `note` | Брошюра Con Edison о правах небытовых клиентов: депозит не больше двух средних месячных счетов (или двух в пиковый сезон) и возвращается при закрытии счёта без долга. При коммунальных $1 100 в месяц потолок около $2 200 — подходят обе оценки. |
| `extra.conditionalMonthlyCosts.delivery_app_commission` | D13: 23% | **23% — сумма потолков NYC** | DCWP: доставка до 15%, прочие услуги до 5%, приём оплаты до 3%; потолки бессрочные. В апреле 2026 года DCWP взыскал с HungryPanda более $875 000 за нарушение потолков. Платный «расширенный» тариф сверх потолка источники описывают по-разному, подтвердить не удалось. |
| `levers.scheduling` | D05: по умолчанию график на две недели за $400 | **по умолчанию — на неделю, $0** | Закон Fair Workweek касается только сетей от 30 точек по стране (FAQ DCWP). Одиночное кафе под него не подпадает. |

### 5.2. Цена рычагов по умолчанию

Движок каждый месяц списывает цену первого законного варианта у каждого рычага. После склейки рычаги без выбора игрока стоили бы кафе **$2 294 в месяц** (в main — $305). Часть из этого — двойной счёт: работа персонала в уже оплаченные часы. D11 поправил (`leverOptions` в решениях), стало **$732**:

- подметать тротуар, следить за открытым люком подвала: $85 и $45 → $0 — это работа персонала в оплаченные часы;
- снег: $90 за зимний месяц → $30 в среднем за год. Движок пока не знает о сезонных рычагах;
- коврики у входа: $80 без прайса → $43 по прайсу из D14;
- переделка напитков: $250 по меню → $65 по себестоимости;
- по умолчанию теперь бесплатный законный вариант: приём поставок с ключом, график на неделю, обучение на месте, найм через знакомых. Платные варианты остались как выбор.

### 5.3. Все числовые расхождения между фрагментами

Итог — значение в `cafe.next.json`. ✓ — у фрагмента `verified`. Пометка «(D11)» — правка сборщика. «Вынесено в extra» — запись ушла в форматы или в условные расходы.

<!-- D11:auto:contradictions -->
Всего расхождений: 115.

| Запись | Поле | Версии | Итог |
|---|---|---|---|
| `setup.espresso_machine` | lifespanMonths | BASE 96 ✓; D03 120 ✓ | **120** |
| `setup.grinder` | cost | BASE 2099 ✓; D03 2099 ✓; D12 3099 ✓ | **3099** |
| `setup.refrigeration` | lifespanMonths | BASE 96; D03 120 | **120** |
| `setup.pastry_case` | lifespanMonths | BASE 96 ✓; D03 120 ✓ | **120** |
| `setup.sinks` | cost | BASE 1720; D12 1519 | **1519** |
| `setup.fse_permit` | waitDays | BASE 21 ✓; D12 22 ✓; D14 22 ✓ | **22** |
| `setup.decaf_grinder` | cost | BASE 2099 ✓; D03 2099 ✓; D12 3099 ✓ | **3099** |
| `setup.ice_machine` | lifespanMonths | BASE 84; D03 102 | **102** |
| `setup.dishwasher` | lifespanMonths | BASE 96 ✓; D03 90 ✓ | **90** |
| `setup.dob_alteration_filing_fee` | cost | D01 915; D14 (dob_alteration_permit) 970 | **915** |
| `setup.dob_alteration_filing_fee` | waitDays | D01 21; D14 (dob_alteration_permit) 20 | **21** |
| `setup.landmarks_storefront_permit` | cost | D01 (lpc_storefront_permit) 320; D02 0 | **320** |
| `setup.con_ed_security_deposit` | cost | D01 1600; D09 (utility_deposit) 1800 | **1600** (D11) |
| `setup.electrical_service_upgrade` | cost | D01 9000; D02 8000 | **9000** |
| `setup.mfv_unit_permit` | cost | D01 (mobile_food_unit_permit) 75 ✓; D13 200 ✓ | **вынесено в extra** |
| `setup.mfv_unit_permit` | waitDays | D01 (mobile_food_unit_permit) 180 ✓; D13 365 ✓ | **вынесено в extra** |
| `setup.food_cart_new` | cost | D01 (coffee_cart_unit) 16500; D13 15000 | **вынесено в extra** |
| `setup.food_cart_new` | lifespanMonths | D01 (coffee_cart_unit) 84; D13 120 | **вынесено в extra** |
| `setup.tfse_permit` | waitDays | D01 30 ✓; D13 14 ✓ | **вынесено в extra** |
| `setup.takeover_due_diligence` | cost | D01 (acquisition_legal_and_accounting) 6000; D14 7500 | **7500** |
| `setup.restricted_area_permit` | cost | D01 (restricted_area_vending_permit) 75 ✓; D13 200 ✓ | **вынесено в extra** |
| `setup.restricted_area_permit` | waitDays | D01 (restricted_area_vending_permit) 21 ✓; D13 45 ✓ | **вынесено в extra** |
| `setup.sba_guaranty_fee` | cost | D01 2550; D09 (loan_guaranty_fee) 1700 | **1700** |
| `setup.portable_entrance_ramp` | cost | D02 157 ✓; D10 (portable_ramp) 300 | **157** |
| `setup.ac_replacement` | cost | D02 (hvac_replacement) 15000; D03 8500 | **8500** |
| `setup.convection_oven` | cost | D03 390 ✓; D04 (bakeoff_oven) 460 ✓ | **390** |
| `setup.labor_law_posters` | cost | D05 40; D08 (labor_posters_and_notices) 0 | **0** |
| `setup.snow_kit` | cost | D07 160; D14 (ice_melt_and_shovels) 180 | **160** |
| `monthlyCosts.sick_leave_cover` | amount | BASE 70; D12 60 | **60** |
| `monthlyCosts.maintenance` | amount | BASE 300; D03 45 | **45** |
| `monthlyCosts.franchise_royalty` | amount | D01 0.06; D13 0.07 | **вынесено в extra** |
| `monthlyCosts.commissary_fee` | amount | D01 600; D13 750 | **вынесено в extra** |
| `monthlyCosts.backflow_test` | amount | D02 (backflow_annual_test) 21; D03 38 | **38** |
| `monthlyCosts.turnover_replacement` | amount | D05 113; D10 (staff_replacement) 105 | **113** |
| `staff.barista` | hourlyWage | BASE 21; D05 21; D12 18 | **18** |
| `staff.barista` | cashWage | BASE 21; D05 21; D12 18 | **18** |
| `violations.dirty_surfaces` | fine.perMonth | BASE 25 ✓; D00 0 | **0** |
| `violations.pest_activity` | fine.base | BASE 300 ✓; D12 350 ✓ | **350** |
| `violations.pest_activity` | fine.perMonth | BASE 50 ✓; D00 0; D12 50 ✓ | **50** |
| `violations.pest_activity` | fine.max | BASE 450 ✓; D12 550 ✓ | **550** |
| `violations.spoiled_food` | fine.perMonth | BASE 50 ✓; D00 0; D12 50 ✓ | **50** |
| `violations.unapproved_food_source` | fine.perMonth | BASE 50 ✓; D00 0 | **0** |
| `violations.grease_interceptor_neglect` | fine.perMonth | BASE 200 ✓; D00 0 | **0** |
| `violations.work_without_permit` | fine.base | D01 6000; D03 6000 ✓; D08 6000 ✓; D14 5000 | **6000** |
| `violations.work_without_permit` | fine.max | D01 15000; D03 15000 ✓; D08 15000 ✓; D14 13580 | **15000** |
| `violations.work_without_permit` | closureDays | D01 30; D03 0 ✓; D08 0 ✓; D14 20 | **0** |
| `violations.stop_work_order_ignored` | fine.perMonth | D01 (stop_work_order_violation) 0; D08 6000 | **6000** |
| `violations.stop_work_order_ignored` | closureDays | D01 (stop_work_order_violation) 14; D08 0 | **0** |
| `violations.vending_without_license` | closureDays | D01 (unlicensed_mobile_vending) 7; D13 0 | **вынесено в extra** |
| `violations.no_tfse_permit` | fine.base | D01 (no_temporary_food_permit) 200; D13 1000 | **вынесено в extra** |
| `violations.permit_holder_absent` | closureDays | D01 (illegal_permit_rental) 14; D13 30 | **вынесено в extra** |
| `violations.occupancy_contrary_to_co` | fine.base | D01 400 ✓; D02 (cellar_used_for_customers) 1250 ✓; D10 (illegal_occupancy) 1250 | **400** |
| `violations.occupancy_contrary_to_co` | fine.max | D01 25000 ✓; D02 (cellar_used_for_customers) 6250 ✓ | **25000** |
| `violations.occupancy_contrary_to_co` | closureDays | D01 30 ✓; D02 (cellar_used_for_customers) 0 ✓; D10 (illegal_occupancy) 0 | **30** |
| `violations.propane_without_cof` | closureDays | D01 (no_certificate_of_fitness) 0 ✓; D13 3 | **вынесено в extra** |
| `violations.sign_without_permit` | fine.base | D02 1250 ✓; D08 6000 | **0** (D11) |
| `violations.sign_without_permit` | fine.max | D02 6250 ✓; D08 15000 | **null** (D11) |
| `violations.sidewalk_obstruction` | fine.base | D02 50 ✓; D07 50 ✓; D08 (sidewalk_sign_obstruction) 100; D10 100 | **50** |
| `violations.sidewalk_obstruction` | fine.perMonth | D02 50 ✓; D07 250 ✓; D08 (sidewalk_sign_obstruction) 0; D10 100 | **50** |
| `violations.sidewalk_obstruction` | fine.max | D02 100 ✓; D07 500 ✓; D08 (sidewalk_sign_obstruction) 300; D10 300 | **100** |
| `violations.blocked_exit` | fine.max | D02 (blocked_egress) 5000; D08 1000 ✓ | **1000** |
| `violations.backflow_not_tested` | fine.base | D02 100; D03 (backflow_test_overdue) 700; D08 500 ✓ | **500** |
| `violations.backflow_not_tested` | fine.perMonth | D02 0; D03 (backflow_test_overdue) 150; D08 0 ✓ | **0** |
| `violations.backflow_not_tested` | fine.max | D03 (backflow_test_overdue) 10000; D08 1000 ✓ | **1000** |
| `violations.overcrowding` | fine.base | D02 (overcrowding_over_occupancy) 2500 ✓; D08 950 ✓; D14 950 | **950** |
| `violations.overcrowding` | fine.max | D02 (overcrowding_over_occupancy) 12500 ✓; D08 2375 ✓; D14 5000 | **2375** |
| `violations.accessibility_barrier` | fine.base | D02 1000; D08 10000; D10 (access_barrier) 10000 | **10000** |
| `violations.loud_music_noise` | fine.base | D02 (commercial_noise) 2000 ✓; D07 (commercial_music_noise) 0 ✓; D08 2000 ✓; D13 (excessive_noise) 1000 | **2000** |
| `violations.loud_music_noise` | fine.perMonth | D02 (commercial_noise) 0 ✓; D07 (commercial_music_noise) 2000 ✓; D08 0 ✓ | **0** |
| `violations.loud_music_noise` | fine.max | D02 (commercial_noise) 2000 ✓; D07 (commercial_music_noise) 8000 ✓; D08 8000 ✓; D13 (excessive_noise) 8000 | **8000** |
| `violations.foam_containers` | fine.base | D04 (foam_packaging) 50; D08 150 ✓ | **150** |
| `violations.single_use_handouts` | fine.base | D04 (plastic_stirrers_straws) 0; D04 (unrequested_takeout_extras) 0; D08 100 ✓; D13 (plastic_straw_unrequested) 100 ✓ | **100** |
| `violations.single_use_handouts` | fine.perMonth | D04 (plastic_stirrers_straws) 100; D04 (unrequested_takeout_extras) 50; D08 100 ✓ | **100** |
| `violations.single_use_handouts` | fine.max | D04 (plastic_stirrers_straws) 400; D04 (unrequested_takeout_extras) 250; D08 400 ✓; D13 (plastic_straw_unrequested) 400 ✓ | **400** |
| `violations.commercial_waste_in_litter_basket` | fine.base | D04 (trash_in_litter_basket) 25; D07 100; D08 (business_trash_dumped) 100 ✓ | **100** |
| `violations.commercial_waste_in_litter_basket` | fine.perMonth | D04 (trash_in_litter_basket) 75; D07 125; D08 (business_trash_dumped) 100 ✓ | **125** |
| `violations.commercial_waste_in_litter_basket` | fine.max | D04 (trash_in_litter_basket) 350; D07 350; D08 (business_trash_dumped) 300 ✓ | **350** |
| `violations.recycling_not_separated` | fine.base | D04 0; D07 100 | **0** |
| `violations.banned_additive_cbd` | fine.base | D04 (adulterated_drink_additive) 400; D08 200 | **200** |
| `violations.banned_additive_cbd` | fine.perMonth | D04 (adulterated_drink_additive) 200; D08 50 | **50** |
| `violations.banned_additive_cbd` | fine.max | D04 (adulterated_drink_additive) 1200; D08 650 | **650** |
| `violations.deceptive_menu_claims` | fine.perMonth | D04 525; D06 0 | **525** |
| `violations.pay_frequency_violation` | fine.base | D05 1000; D09 300; D10 0 | **0** |
| `violations.pay_frequency_violation` | fine.perMonth | D05 21; D09 10; D10 20 | **20** |
| `violations.retaliation` | fine.base | D05 5000; D08 (retaliation_firing) 10000 ✓ | **5000** |
| `violations.retaliation` | fine.perMonth | D05 3400; D08 (retaliation_firing) 0 ✓ | **3400** |
| `violations.no_disability_pfl_coverage` | fine.perMonth | D05 67 ✓; D09 0 ✓ | **67** |
| `violations.no_harassment_policy_training` | fine.base | D05 400; D08 1000 | **1000** |
| `violations.no_harassment_policy_training` | fine.max | D05 400; D08 3000 | **3000** |
| `violations.job_ad_no_pay_range` | fine.max | D05 1000; D08 3000 | **3000** |
| `violations.illegal_posting` | fine.base | D06 1500; D07 750 ✓ | **750** |
| `violations.illegal_posting` | fine.max | D06 5000; D07 9000 ✓ | **9000** |
| `violations.snow_ice_not_cleared` | fine.perMonth | D07 0 ✓; D14 (sidewalk_snow_not_cleared) 50 | **0** |
| `violations.dirty_sidewalk` | fine.base | D07 50 ✓; D08 100 ✓ | **50** (D11) |
| `violations.dirty_sidewalk` | fine.perMonth | D07 250 ✓; D08 50 ✓ | **50** (D11) |
| `violations.dirty_sidewalk` | fine.max | D07 500 ✓; D08 300 ✓ | **300** (D11) |
| `violations.trash_setout_violation` | fine.max | D07 (improper_trash_setout) 300 ✓; D08 200 ✓ | **200** |
| `violations.unlicensed_music` | fine.base | D08 3000; D10 1500 | **3000** |
| `violations.unlicensed_music` | fine.perMonth | D08 500; D10 0 | **500** |
| `violations.unlicensed_music` | fine.max | D08 30000; D10 150000 | **30000** |
| `violations.alcohol_to_minor` | fine.base | D08 2500 ✓; D13 (sale_to_minor) 3000 ✓ | **вынесено в extra** |
| `events.coffee_price_spike` | effect.mult | BASE 1.05; D04 1.07; D12 1.05 | **1.05** |
| `events.coffee_price_spike` | months | BASE 3; D04 6; D12 3 | **3** |
| `events.milk_price_up` | effect.mult | BASE 1.03; D04 1.01; D12 1.03 | **1.03** |
| `events.sidewalk_shed` | effect.mult | BASE 0.9; D07 0.93; D10 0.9; D12 0.93 | **0.93** |
| `events.sidewalk_shed` | months | BASE 3; D07 12; D10 12; D12 6 | **12** |
| `events.sign_complaint_wave` | effect.mult | D02 1.3; D15 1.5 | **1.5** |
| `events.sign_complaint_wave` | months | D02 3; D15 1 | **1** |
| `events.chain_opens_nearby` | effect.mult | D06 0.93; D10 (chain_opens_next_door) 0.88 | **0.93** |
| `events.chain_opens_nearby` | months | D06 6; D10 (chain_opens_next_door) 12 | **6** |
| `events.january_slump` | effect.mult | D06 0.92; D07 0.92; D10 (january_trough) 0.88 | **0.92** |
| `events.street_dig_long` | effect.mult | D07 0.87; D10 (street_dig) 0.75 | **0.87** |
| `events.street_dig_long` | months | D07 12; D10 (street_dig) 9 | **12** |
| `events.minimum_wage_march_2027` | effect.mult | D09 1.035; D10 (wage_step_january) 1.03 ✓ | **1.035** |
| `events.minimum_wage_march_2027` | months | D09 10; D10 (wage_step_january) 12 ✓ | **10** |
<!-- /D11:auto:contradictions -->
## 6. Что будет с игрой, если подменить пакет

Проверено на копии: `packs/cafe.next.json` подставлен на место `packs/cafe.json`, после проверки `cafe.json` возвращён из git.

- **Тесты:** `npm test` — в движке падает 1 тест из 229. Остальные пакеты рабочего пространства зелёные: ai, host, server, bots и клиент (292 теста, первый прогон сборки).
- **Smoke:** `node scripts/smoke.mjs` — **GREEN**, 8 шагов из 8 на настоящем коде. Владельцы открывают кафе с рекомендованным набором, город живёт 35 дней, проверка находит нарушение, сделка проходит.
- **Падающий тест** — `engine/test/economy/real-packs.test.ts`, «with a hired manager it keeps about $4,000 before owner taxes». Тест ждёт от $2 800 до $5 500 в каждом месяце.

| Честное стандартное кафе, 18 мест, рекомендации по умолчанию | main | cafe.next |
|---|---|---|
| Заказов в день | 200 | 196–199 |
| До налогов владельца, с наёмным управляющим | $3 100–4 300 | **$2 300–3 400** |
| До налогов владельца, владелец сам за стойкой | $8 650–9 570 | $8 580–9 480 |
| Деньги через 12 месяцев, с управляющим | $127 982 | $115 486 |

**Почему меньше:**

- управляющий дороже на $725: законный порог оклада 2026 года;
- текучка, подмены, напитки смены и обучения: +$750;
- обслуживание разложено по статьям: +$180;
- рычаги по умолчанию: +$430;
- зато бариста дешевле на $3 на человеко-час, это −$1 920.

По данным NRA за 2024 год, медиана прибыли до налогов у заведений с обслуживанием у стойки — **4,0% продаж**, около $2 000 при выручке $50 000. Новый пакет ближе к этой медиане, чем main (8%).

**Что решить ведущему:**

- либо снизить нижнюю границу теста до $2 000 (NRA);
- либо вернуть часть новых расходов в условные.

Параметр притока гостей `extra.footfall.captureRate` из keen-cray калибровался на старых расходах. После подмены пакета его стоит перекалибровать на стенде `sim/calibrate.ts` в ветке keen-cray.

**Вес.** Клиент скачивает пакеты целиком (`/api/packs`): main весит 94 КБ в сжатом JSON, cafe.next — 2,0 МБ (583 КБ в gzip). Почти половина — `extra.eventCatalog`. Если вес важен, каталог событий можно отдавать отдельным запросом; движок его пока не читает.

**Интерфейс:** 94 рычага и 79 срезанных углов — для одного экрана много. Предлагаю группировать по темам — у записей в `extra.provenance` (журнал) есть фрагмент-источник — или показывать рычаг, когда случается его событие.

## 7. Предупреждение валидатора

`violations (ventilation_inadequate): ни один shortcut или lever к нему не ведёт`.

Рычаг кондиционера пришёл из трёх фрагментов: D02 `hvac_care`, D03 `hvac_service`, D07 `cooling_plan`. Склеен в один, иначе обслуживание кондиционера списывалось бы дважды ($100 + $55). У варианта «не обслуживать» в формате может быть только одно нарушение. Выбрано `equipment_noise` (D03): соседи жалуются на шум. Нарушение `ventilation_inadequate` (вентиляция неисправна, санитарный кодекс 10D) осталось без пути к нему. Просьба к ведущему — разрешить `causes` списком (раздел 8).

## 8. Просьбы к ведущему: поля и правила формата

1. **`causes` списком** у варианта рычага: отказ от обслуживания кондиционера даёт и шум, и неисправную вентиляцию.
2. **`activeMonths` у рычага** (D07): снег — декабрь–март, уличная посадка — апрель–ноябрь. Сейчас цена размазана на 12 месяцев.
3. **`oneTime` и фаза у рычага** (D01, D08): 16 решений до открытия лежат в `extra.preOpeningChoices`.
4. **Условные ежемесячные расходы** — `activeWhen`, `fromMonth` (D01, D09): 22 строки в `extra.conditionalMonthlyCosts`.
5. **Поля эффектов событий:** 100 полей в `extra.effectFields`, движок понимает 12. Первыми нужны `cash` (разовая сумма), `violation` (открыть нарушение), `closureDays`, `openingDelayDays`, `cashOut` (платёж по формуле в свой срок).
6. **Стандартный раздел `events`:** у 8 из 55 событий поле эффекта вне списка `EffectTarget`: `permitWaitDays`, `buildoutCost`, `equipmentCost`, `freeRentMonths`, `insurance`, `workersComp`, `loanRate`, `cardFixedFee`. Валидатор их пропускает, движок их не применит.
7. **Повторное нарушение как ступень штрафа:** сейчас есть `perMonth`. В жизни растёт не месяц, а номер нарушения за 12 месяцев: DSNY, FDNY, DOHMH, закон о сроках выплаты зарплаты. D00 убрал `perMonth` у пяти нарушений основы по этой причине.
8. **Тест `real-packs`** — новая граница (раздел 6).
9. **Ход внутри события.** Калибровщики дали многим событиям свои варианты ответа (`*_response`, цена и результат); в пакете это не рычаги. Нужен тип «ход события»: вариант с ценой, который предлагается только когда событие наступило.
10. **Налог `paper_bag_fee`** (D04): 5 центов за пакет, собираются с покупателя. Сейчас записан как `fixed` 0,05 в год — движок списывает 5 центов в год, вреда нет. Нужна база «за единицу», как у налога с продаж.

## 9. Как пересобрать

Из корня репозитория:

```bash
node packs/parts/cafe/D11-collect.mjs
```

```bash
node packs/parts/cafe/D11-merge.mjs
```

```bash
node build/validate-pack.mjs packs/cafe.next.json
```

```bash
node packs/parts/cafe/D11-report.mjs
```

- `D11-collect.mjs` подтягивает файлы `packs/parts/cafe/` из всех веток; второй исполнитель того же задания сохраняется с суффиксом ветки.
- `D11-report.mjs` пересчитывает автоматические блоки этого отчёта: вердикт, счётчики, сводку `extra`, переносы, таблицу расхождений.
- `D11-merge.mjs` собирает `packs/cafe.next.json`, `D11-reference.json` и журнал `D11-merge-log.json`: откуда каждая запись, все склейки, переносы, правки ссылок, противоречия.
- Решения сборщика — `D11-decisions.mjs`: склейки `alias`, выбор `prefer`, переносы, правки `override`, порядок плана. Механики — `D11-mechanics-ranked.mjs`.
- Калибровки D15–D19 подхватываются сами, если файл называется `DNN-calibration-*.json`. События ищутся по `id` и по старым `id` из `aliases`. Если калибровщик пометил `duplicateOf`, события склеиваются.

## 10. Не найдено и ограничения

- Срок окончания моратория на штрафы за вывески по Local Law 15 of 2026.
- Новые суммы DSNY для повторных нарушителей с 19 декабря 2024 года.
- Формула пошлины Департамента зданий за перепланировку в 2026 году. Оставлена оценка D01, $915; у D14 было $970.
- Типичная сумма мирового соглашения по иску о доступности входа в NYC. Оставлена оценка D08/D10, $10 000.
- Штраф FDNY за переполнение (категория 10, Appendix A к 3 RCNY 109-03): точной суммы в выдаче поиска нет. Оставлено $950 у D08 (`verified` у D08).
- Прямое чтение nyc.gov, ny.gov и governor.ny.gov в сессии сборщика недоступно. Всё, что D11 исправил сам, помечено `estimate` с пометкой «search-seen».
- D18 (улица, погода, спрос) сдал только журнал без JSON; D19 (закон, проверки) не начат. 158 событий без чисел ждут их в `D11-reference.json`.

## 11. Источники, которые сборщик открыл сам (через веб-поиск)

- Governor NY, минимальная зарплата 2027: https://governor.ny.gov/new-york-state-minimum-wage-2027 и сводка https://gtm.com/business/?p=21088
- Порог оклада освобождённых работников 2026: https://www.seyfarth.com/news-insights/2026-wage-updates-for-new-york-employers.html, https://www.teambridge.com/compliance/new-york/exempt-classification
- Fair Workweek, определение fast food: https://nyc.gov/assets/dca/downloads/pdf/workers/FAQs-FairWorkweek-FastFood.pdf
- Сроки выплаты зарплаты, поправка 2025: https://www.foley.com/insights/publications/2025/06/new-york-legislature-amends-pay-frequency-law-to-limit-damages-for-first-time-off/
- Вывески, мораторий: https://www.nyc.gov/site/buildings/safety/sign.page, https://www.nyc.gov/site/buildings/safety/sign-ll15of2026.page, https://intro.nyc/local-laws/2026-15
- Санитарные штрафы (16-118, 16-123): https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-32876
- Расклейка объявлений (10-119): https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-6172, https://intro.nyc/0302-2024
- Обратный клапан, штраф OATH: https://www.nyc.gov/assets/oath/downloads/pdf/Final-Rule-Updating-OATH_s-Water-Penalty-Schedule-113021.pdf
- Пошлины LPC: https://www.nyc.gov/site/lpc/applications/fees.page
- Пошлины DOB, изменения 2026: https://www.nyc.gov/assets/buildings/pdf/26_alt_fee-sn.pdf
- Сбор SBA 7(a), 2026 ф. г.: https://colemanreport.com/wp-content/uploads/2025/09/Info-Notice-7a-Fees-FY-2026-FINAL-8-28-25.pdf
- NRA, прибыль заведений с обслуживанием у стойки 2024: https://restaurant.org/research-and-media/media/press-releases/new-resource-from-national-restaurant-association-provides-insights-into-operational-realities/
- FDNY, таблица штрафов: https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-102214
- CCHR и иски о доступности: https://www.nyc.gov/site/cchr/enforcement/2023-settlements.page

Источники фрагментов — в их отчётах `DNN-*.md` и в `sources` пакета: 1 053 ссылки в пакете, полный список из 1 635 — `D11-reference.json → sources`.
