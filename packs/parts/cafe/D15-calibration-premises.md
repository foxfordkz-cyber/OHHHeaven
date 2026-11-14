# D15 — калибровка событий: помещение, ремонт, вход в бизнес, аренда

Ниша: кафе. Нью-Йорк, 2026 год. Исследователь D15, 14 ноября 2026.
Файл данных: `packs/parts/cafe/D15-calibration-premises.json` (разбирается как JSON; ключи как у пакета: `levers`, `events`, `extra`, `sources`).
Основа: фрагменты `packs/parts/cafe/` всех веток (D00 из `research/d00-cafe-total-search`, D01, D02, D08, D09, D10, D13, D14) и `packs/cafe.json` ветки `claude/keen-cray-yytcbp` (ремонт по прежнему назначению помещения, покупка готового кафе).

## 1. Вердикт

1. Откалибровано **195 событий** темы (минимум был 60): 190 из каталогов D00–D14 с теми же `id` и 5 новых. Все **87 событий уровня `core`** темы получили числа; список «не удалось откалибровать» среди отобранных пуст.
2. У каждого события есть `effects` с числом, `months`, `durationMonths`, детерминированный `trigger`, источник и `confidence`; у всех 253 ходов игрока есть цена (деньги, дни, места, спрос или риск), бесплатных ходов нет.
3. 38 событий стоят на первоисточниках, которые я открыл сам (законы штата на nysenate.gov, правила и отчёты DOB, LPC, DEP, DOF, SBS, DOHMH); остальные 157 — оценки с расчётом в `note`, многие на тех же проверенных правилах.
4. Главные исправления: штраф за работу без разрешения теперь 21 × пошлина, от $6,000 до $15,000, с разовым прощением для малого бизнеса (D14 считал по старой редакции); DOB одобряет за 25.4 дня, а не 20; закон о прозрачных роллетах отменён; вывески до 150 кв. футов амнистированы (LL15 of 2026); штраф за музыку $3,200, а не $2,000.
5. Для движка нужны 8 механик (`extra.mechanics`): дни аренды до первой продажи с учётом DOB, формула штрафа и прощения, личный долг по гарантии при закрытии, удержание налога продавца при покупке, «датированные» риски здания вместо случайных, пункты договора аренды как флаги, единый словарь полей эффектов.

## 2. Что добавлено, по разделам

| Раздел | Сколько | Что |
|---|---|---|
| `extra.eventCatalog` | 195 | аренда 48, ремонт и разрешения 49, зал и помещение 46, вход в бизнес 36, коммуникации 16; core 87, deep 91, exotic 17; 29 дублей помечены `mergedWith` (одно событие в нескольких фрагментах) |
| — из каких фрагментов | | D00 73, D01 54, D02 34, D14 12, D08 5, D09 4, D10 4, D13 4, новые D15 5 |
| — новые события | 5 | `dob_enforcement_sweep` (core), `asking_rents_climb`, `sign_moratorium_ll15`, `building_gas_inspection_due`, `dob_subsequent_filing_fee` |
| `levers` | 11 записей, 36 вариантов | 4 новых рычага (`lease_negotiation`, `permit_help`, `takeover_terms`, `exit_terms`) и новые варианты к рычагам D01/D02 (`addsOptionsTo`); варианты ходов сведены к уже существующим `id` (D01 `guaranty_type.full_personal`, `site_due_diligence.survey_first`, D09 `insurance_package.full_cover`, D10 `lease_terms.ten_with_option` и др.) |
| `events` (формат `PackEvent`) | 9 | события с полями, которые движок уже понимает (`rent`, `footTraffic`, `inspections`, `utilities`) |
| `extra.mechanics` | 8 | см. раздел 5 |
| `extra.effectFields` | 1 словарь | какие поля эффектов уже есть в движке, какие предложил D01/D02/D14, какие новые у D15 |
| `extra.corrections` | 13 | исправления чужих записей тем же `id` |
| `extra.verifiedFacts` | 34 | факты, которые я сам увидел в первоисточнике |
| `extra.notFound` | 12 | см. раздел 6 |
| `sources` | 116 | 34 проверенных первоисточников и 82 вторичных |
| `extra.calibrationReference` | 1 | эталон для денег в расчётах: 800 кв. футов, аренда $6,000, выручка $51,000, прибыль $9,719 в месяц; день закрытия — $1,700 выручки и $1,200 маржи; день аренды — $200 |

**Как читать событие.** `effects[]` — поле, `mult` или `add` (иногда `set` или `formula`), единица и пояснение; `byBuildoutClass`, `byTier`, `byGuaranty` дают значения по классу ремонта, ярусу места и типу гарантии. `playerMoves[]` — вид хода (`lever`, `shortcut`, `setup`, `choice`, `roadmap`), `cost` (цена хода) и `result` (что он даёт). `months` — месяцы года, когда событие возможно; для событий, которые идут от решения игрока или от даты договора, это все 12 месяцев, а момент задаёт `trigger`. Вероятностей нет: каждое событие объявлено заранее или следует из решения или скрытого свойства помещения.

## 3. Пятнадцать самых неочевидных находок

1. **Штраф за ремонт без разрешения почти всегда упирается в потолок.** Действующая редакция 1 RCNY §102-04: больше из 21 × пошлина и $6,000, но не выше $15,000. Пошлина за лёгкий ремонт на $70,000 — $970, × 21 = $20,372, значит штраф $15,000. Узаконить до нарушения — $6,000; повтор в течение года — вдвое.
2. **Первый раз малому бизнесу штраф прощают.** То же правило (d)(10): владелец бизнеса меньше чем на 100 работников может один раз получить отмену штрафа за работу без разрешения, если помещение занимает только он. Остаются приказ об остановке и ожидание разрешения. Значит настоящая цена срезанного угла в первый раз — время (около 32 дней), а не деньги.
3. **DOB ищет такие работы сам, без жалоб.** С Local Law 74 of 2024 работает отдел, который обходит улицы: приказов об остановке в FY2026 стало на 19% больше (7,882). Отсюда новое событие `dob_enforcement_sweep`: срезанный угол находит не только сосед.
4. **Возражения экзаменатора — норма.** В DOB NOW на 156,389 первых проверок пришлось 111,842 повторных; заявка лежит у самого заявителя на исправлениях в три раза дольше, чем в департаменте. В среднем от подачи до одобрения 25.4 дня (год назад 20.3).
5. **Нью-йоркский арендодатель магазина не обязан пересдавать помещение после ухода арендатора.** Обязанность смягчать убытки закон 2019 года ввёл только для жилья (RPL §227-e, открыл); для коммерции действует решение Holy Properties v. Kenneth Cole (1995). Полная личная гарантия при шести годах остатка — до $432,000 долга лично на владельце.
6. **«Good guy» бывает фальшивым.** Если гарантия требует вернуть бесплатные месяцы, взнос на ремонт или комиссию брокера, это не good guy (городской путеводитель SBS). На эталонном кафе выход дороже на $33,120: $18,000 бесплатной аренды и $15,120 комиссии (пример SBS: 5% годовой аренды за первый год и по 4% за следующие четыре).
7. **Права переуступить договор у кафе нет.** Законное право на субаренду и переуступку есть только у жильцов (RPL §226-b, открыл). Продажа кафе целиком упирается в согласие арендодателя и его цену.
8. **Продав кафе, можно остаться должником.** Если договор аренды переуступлен без освобождения, по долгам нового хозяина платит прежний (SBS: «вы всё равно несёте обязательства»).
9. **Налоговая ловушка покупки.** Покупатель, не уведомивший налоговую за 10 дней (форма AU-196.10), лично отвечает за налог с продаж продавца в пределах цены и с процентами от 14.5% годовых (Tax Law §1141(c) и §1145, открыл). С уведомлением долг просто удерживается из цены не дольше 90 дней.
10. **Разрешение на общепит не переходит к покупателю.** Подать заявление в день сделки — значит 22 дня без продаж (около $26,400 маржи эталонного кафе). Подать за 22 дня до сделки — ноль. Перед подачей нужно оплатить все свои неоплаченные санитарные штрафы.
11. **Вместе с кафе покупаешь чужую историю работодателя.** Рейтинг взносов в страхование от безработицы переходит покупателю, если он взял дело, клиентов и тех же работников (Labor Law §581(4), открыл); остатки больничных работников тоже остаются в силе (правило NYC 2023 года).
12. **Газ — главный срыв сроков, и его можно обойти.** В опросе Сената штата только 17% ресторанов получили газ вовремя, ждали в среднем около 68 дней (отчёт открыл; данные 2017 года, новее нет). Кофейня без кухни может быть полностью электрической. А отключение газа во всём доме имеет дату: проверка газовых труб по Local Law 152 идёт по циклам округов (в 2026 году — округа 4, 6, 8, 9, 16), штраф $5,000 платит хозяин дома.
13. **В 2026 году Манхэттен — рынок арендодателя.** Свободных торговых площадей 9.8% в III квартале — исторический минимум, запрашиваемые ставки на коридорах +5% за год. «Пустые витрины дают рычаг» работает только в дешёвых кварталах; в хороших бесплатные месяцы сокращаются.
14. **Две новые городские отмены.** Закон 2009 года о прозрачных роллетах со сроком 1 июля 2026 года отменён голосованием 51:0 за день до срока: кто заменил решётку заранее, потратил около $6,500 зря. Local Law 15 of 2026 снял штраф за работу без разрешения для вывесок до 150 кв. футов и простил такие штрафы с 2017 года, поэтому прежнее «вывеска без разрешения — $6,000» неверно.
15. **Шум стоит по-разному.** Кондиционер громче 42 дБ(A) у соседа: $560, потом $1,120 и $1,680. Музыка сверх нормы: $3,200, потом $6,400 и $9,600, но первый штраф можно свести к $0, если за 30 дней подтвердить исправление. Работа на стройке вечером без разрешения на сверхурочные: $6,000. Это дороже, чем 15 сэкономленных ночными сменами дней аренды ($3,000).

Ещё, коротко: под охраной LPC 38,550 зданий в 159 исторических районах, но 90% мелких разрешений выдают за 10 рабочих дней, так что исторический район обычно добавляет около двух недель. Для зданий до 1 апреля 1987 года оценка асбеста обязательна до разрешения DOB, то есть почти для всех старых витрин. Если в зоне удаления асбеста идёт сантехника (кроме замены приборов) или сносят стену больше 45 кв. футов, нужно отдельное разрешение на удаление с планом безопасности от архитектора (правила DEP, открыл) — для кафе это почти всегда так; 300 кв. футов плитки уже «крупный проект» (от 160 кв. футов). Если помещение стало непригодным не по вине арендатора, по закону можно съехать и больше не платить (RPL §227), но договор обычно это меняет. Налог на коммерческую аренду (CRT) кафе не касается: порог — $250,000 аренды в год, а малым арендаторам полагается полный кредит. Декларацию налога с продаж нужно подавать и в месяцы ремонта: за неподанную штраф не меньше $50. Клиенту с медицинским диагнозом надо дать служебный туалет, если на смене двое работников (GBL §492).

## 4. Исправления существующего пакета и фрагментов

Исправляю тем же `id`; полный список — `extra.corrections`.

| Что | Было | Стало | Почему |
|---|---|---|---|
| D14 `work_without_permit`, `start_work_before_permit` | 14 × пошлина или $5,000 | 21 × пошлина, от $6,000 до $15,000; узаконивание $6,000; повтор ×2; разовое прощение малому бизнесу | действующая редакция 1 RCNY §102-04 (открыл PDF) |
| D14 `extra.preOpening.dobPermitDays` | 20 | 25 | отчёт мэрии FY2026: 25.4 дня |
| `packs/cafe.json` `setup.fse_permit.waitDays` | 21 | 22 | NYC Business: открыться можно на 22-й день после подачи |
| D02 `roll_down_gate_deadline` | −$6,500 к 1 июля 2026 | отменено (Intro 910-A) | Совет отменил срок 30 июня 2026 |
| D08 `sign_complaint_wave` | $6,000 за вывеску без разрешения | $0 для вывески до 150 кв. футов, $6,000 для остальных | Local Law 15 of 2026 |
| D02 `neighbor_noise_complaint` | первый штраф $2,000 → $0 | $3,200 / $6,400 / $9,600, первый можно $0 | таблица штрафов DEP §31-115 (открыл PDF) |
| D01 `vacancy_leverage` | на всех кварталах | только дешёвый ярус | 9.8% свободных площадей на Манхэттене |
| D01 `hidden_conditions` | ×1.12 | ×1.10 | средние допработы около 10% (Dodge) |
| D01 `landlord_late_delivery` | +60 дней | +45 дней, аренда не идёт до передачи | SBS: «недели или месяцы», платите с момента, когда помещение свободно |
| D01 `fit_out_prices_rise` | ×1.07 | ×1.05 | прогнозы 2026 года: 4.25–5% |
| D14 `takeoverRules.earningsMultiple` | 2.0 | запрос 2.2, продажа на 90% = 2.0 | BizBuySell: средний множитель 2.20 |
| `packs/cafe.json` `setup.sidewalk_cafe_license` | $2,550 | проверить: $1,050 за лицензию на 4 года плюс ежегодная плата по месту и площади | NYC311 |
| D00 события (премисы и др.) | `effects: []`, `months: []` | числа под теми же `id` | задание D15 |

**Противоречия между фрагментами, которые я оставил ведущему.** Вариант D01 `free_rent_deal.six_months_higher_rent` поднимает аренду на 4%, а D14 из равенства выплат арендодателю за 120 месяцев получает 2.6%. Я считаю по D14: 117/114 = 1.026. `tax_escalation_bill` есть в D01, D08 и D10 с одним `id` и разными числами; у меня одна калибровка на все три.

## 5. Просьбы к ведущему — новые механики

По важности (подробно — `extra.mechanics`):

1. **`setup_rent_days` (core).** День открытия = дни ремонта класса (60/90/180, × 0.75 при ночных сменах) + 25 дней одобрения DOB + 22 дня разрешения на общепит. Оплаченные дни = max(0, день открытия − бесплатные дни). При трёх бесплатных месяцах это 17, 47 и 137 дней ($3,400 / $9,400 / $27,400). Сейчас в keen-cray нет 25 дней DOB.
2. **`work_without_permit_penalty` (core).** Формула штрафа выше; флаг `smallBusinessWaiverUsed`; нарушение находят жалоба соседа (DOB отвечает в среднем за 21.5 дня) или объявленный обход `dob_enforcement_sweep`.
3. **`guaranty_exposure_at_closure` (core).** При закрытии с остатком договора владелец лично должен: полная гарантия — вся аренда до конца срока (без пересдачи), good guy — аренда до сдачи ключей плюс 3–6 месяцев уведомления, ловушка с возвратом уступок — ещё $33,120. В итоговом счёте это личный долг.
4. **`bulk_sale_escrow` (core).** Уведомление подано: сумма долга продавца удерживается из цены до 90 дней. Не подано: долг продавца становится личным долгом покупателя под 14.5% годовых.
5. **`building_cycles_as_signals` (deep).** Скрытые свойства места, которые открывает `site_due_diligence.survey_first`: год постройки (асбест до 1987), разрешённое использование в CO, утечка газа и год цикла LL152 по округу, неоплаченный штраф прошлого жильца, исторический район. События срабатывают от них в известные даты, а не случайно. Нужны поля `Place.builtYear`, `communityDistrict`, `historicDistrict`, `coUse`, `hidden.*`.
6. **`lease_clauses_as_flags` (deep).** Рычаг `lease_negotiation` — это набор флагов, которые выбирают один раз при подписании (`BusinessState.lease.clauses[]`). Каждое событие проверяет свой пункт договора.
7. **`d15_effect_field_registry` (core).** Единый словарь полей эффектов (`extra.effectFields`). Из 59 полей 6 уже есть в движке (`rent`, `demand`, `footTraffic`, `utilities`, `inspections`, `staffAvailability`), 19 предложил D01, 3 — D02, 31 новое у D15.
8. **`crt_gate` (exotic).** Налог на коммерческую аренду только для Манхэттена южнее 96-й улицы и аренды от $250,000 в год. Одно кафе всегда под кредитом, поэтому достаточно расхода на подачу декларации.

Ещё три мелочи. Ходам вида `choice` нужен свой экран: это разовое решение, а не рычаг на месяц. Для полей вида `byBuildoutClass` и `byTier` движку нужно правило выбора значения. Событиям с `mergedWith` в сборке (D11) нужно оставить одно главное.

**Сравнение с Россией и Испанией** (`extra.comparisonsAbroad`, источники вторичные).

| Что | Нью-Йорк | Россия | Испания |
|---|---|---|---|
| Бесплатные месяцы на ремонт | 3–6, при тяжёлом ремонте до 12; на Манхэттене в 2026 году меньше | «арендные каникулы» обычно не больше 1–2 месяцев; в законе термина нет, только в договоре | carencia в обмен на работы арендатора; в одном случае 6 месяцев; налоговая считает эти месяцы арендой в натуральной форме |
| Депозит | обычно 2 месяца (SBS), у новичков 6–12 | обеспечительный платёж — обычно 1–2 месяца | не проверял |
| Переходит ли разрешение с бизнесом | нет: разрешение на общепит личное, новые 22 дня | не проверял | лицензия на деятельность привязана к помещению и может перейти при traspaso; в одном случае мэрия отозвала её после 6 месяцев простоя |
| Плата прежнему арендатору | key money, только по запросу; согласие арендодателя всё равно нужно | не проверял | traspaso прежнему арендатору; договор при этом подписывают с собственником; в одном случае €30,000 |

Вывод для игры: нью-йоркская аренда длиннее и дороже на входе (больше бесплатных месяцев, но и больше депозит и личная гарантия), а покупка готового кафе не избавляет от нового разрешения, в отличие от Испании.

## 6. Не найдено

- Опрос рынка о числе бесплатных месяцев в договорах аренды под рестораны в Нью-Йорке за 2025–2026 годы. Есть только юристы и брокеры: 3–6 месяцев, при тяжёлом ремонте до 12.
- Срок уведомления DEP перед удалением асбеста и цена удаления по нью-йоркскому источнику. PDF правил Title 15 отдаёт 404, библиотека amlegal закрыта.
- Срок Con Edison на увеличение мощности для небольшого магазина по его собственным данным. Лист для зарядок электромобилей с цифрой 6–24 месяца недоступен.
- Измерение задержек газа новее 2017 года.
- Типичная частная мировая по иску ADA к маленькому кафе со ступенькой. Нашлись только государственный штраф $20,000 для Katz's Deli и замечания судей.
- Налог на недвижимость на квадратный фут небольшой витрины. Взял $20 как допущение.
- Официальный текст пошлины за разрешение на сверхурочные работы (AHV). Цифры $130–$650 за подачу и $80 в день я видел только в выдержке поиска со страницы DOB.
- Ежегодная плата Dining Out NYC за квадратный фут в 2026 году (сайт закрыт для этой сессии).
- Пошлина и срок письма DOB о законном использовании (Letter of No Objection) для зданий без CO.
- Типичная плата арендодателя за согласие на переуступку договора.
- Штраф пожарных за склад в проходе и штраф DEP за запах.
- Подписан ли Intro 910-A (отмена закона о роллетах) и с какого дня действует Local Law 15 of 2026.

**Чем сеть мешала.** Напрямую открывались nysenate.gov и rules.cityofnewyork.us; nyc.gov через curl отвечал 403 от своей защиты от ботов, и обходить её я не стал. Страницы и PDF nyc.gov читал инструмент чтения страниц: PDF сохранялись, текст я извлекал сам через `pdftotext`. tax.ny.gov, osc.ny.gov, coned.com, diningoutnyc.info, bizbuysell.com из сессии недоступны, поэтому их числа остались `estimate`: я видел их только в выдержках поиска.

## 7. Источники

Полный список с пометкой «проверено» или «оценка» — в `sources` файла данных (116). Первоисточники, которые я открыл сам:

- [NYC311, outdoor dining (Dining Out NYC) licenses and seasons](https://portal.311.nyc.gov/article/?kanumber=KA-03604)
- [DEP, final rule amending the asbestos rules (15 RCNY Chapter 1)](https://rules.cityofnewyork.us/wp-content/uploads/2025/04/Asbestos-Rules-2022-Final.pdf)
- [DEP, Noise Code Penalty Schedule (15 RCNY §31-115)](https://www.nyc.gov/assets/dep/downloads/pdf/air/noise/noise-code-penalty-schedule.pdf)
- [DOB service notice, fee updates in DOB NOW: Build, January 8, 2026](https://www.nyc.gov/assets/buildings/pdf/26fee_updates-sn.pdf)
- [DOB, Project Requirements: Asbestos](https://www.nyc.gov/site/buildings/dob/project-requirements-asbestos.page)
- [DOB, Certificate of Occupancy](https://www.nyc.gov/site/buildings/property-or-business-owner/certificate-of-occupancy.page)
- [DOB service notice, gas piping periodic inspection (Local Law 152), September 26, 2025](https://www.nyc.gov/assets/buildings/pdf/gas_piping-sn.pdf)
- [DOB, Project Requirements: Signs](https://www.nyc.gov/site/buildings/property-or-business-owner/project-requirements-owner-signs.page)
- [DOB, Stop Work Orders](https://www.nyc.gov/site/buildings/property-or-business-owner/stop-work-order.page)
- [DOB, Temporary Certificate of Occupancy](https://www.nyc.gov/site/buildings/property-or-business-owner/temporary-certificate-of-occupancy.page)
- [NYC DOF, Commercial Rent Tax](https://www.nyc.gov/site/finance/business/business-commercial-rent-tax-crt.page)
- [NYC DOF, FY2027 tentative assessment roll, January 15, 2026](https://www.nyc.gov/site/finance/about/press/press-release-fy27-tentative-assessment-roll.page)
- [NYC DOF, property tax rates](https://www.nyc.gov/site/finance/property/property-tax-rates.page)
- [DOHMH, Mobile food vendors](https://www.nyc.gov/site/doh/business/food-operators/mobile-and-temporary-food-vendors.page)
- [NYC Business, Food Service Establishment Permit](https://nyc-business.nyc.gov/nycbusiness/description/food-service-establishment-permit)
- [NY General Business Law §492, access to restroom facilities](https://www.nysenate.gov/legislation/laws/GBS/492)
- [NY General Business Law §683, franchise registration and disclosure](https://www.nysenate.gov/legislation/laws/GBS/683)
- [HPD, The Con Edison load letter](https://www.nyc.gov/assets/hpd/downloads/pdfs/services/hpd-pilot-coned-load-letter.pdf)
- [NY Labor Law §581, transfer of unemployment experience](https://www.nysenate.gov/legislation/laws/LAB/581)
- [NY Lien Law §10, filing of notice of lien](https://www.nysenate.gov/legislation/laws/LIE/10)
- [NY Lien Law §19, discharge of lien by bond](https://www.nysenate.gov/legislation/laws/LIE/19)
- [Mayor's Management Report FY2026, Department of Buildings](https://www.nyc.gov/assets/operations/downloads/pdf/mmr2026/dob.pdf)
- [Mayor's Management Report FY2026, Landmarks Preservation Commission](https://www.nyc.gov/assets/operations/downloads/pdf/mmr2026/lpc.pdf)
- [1 RCNY §102-04, civil penalties for work without a permit and stop work orders](https://www.nyc.gov/assets/buildings/rules/1_RCNY_102-04.pdf)
- [NY RPAPL §711, grounds for summary proceedings (14-day rent demand)](https://www.nysenate.gov/legislation/laws/RPA/711)
- [NY RPAPL §749, warrant and 14-day marshal notice](https://www.nysenate.gov/legislation/laws/RPA/749)
- [NY RPL §223-a, remedies when possession is not delivered](https://www.nysenate.gov/legislation/laws/RPP/223-A)
- [NY RPL §226-b, right to sublease or assign (residential only)](https://www.nysenate.gov/legislation/laws/RPP/226-B)
- [NY RPL §227, when tenant may surrender premises](https://www.nysenate.gov/legislation/laws/RPP/227)
- [NY RPL §232-c, holding over after a term longer than one month](https://www.nysenate.gov/legislation/laws/RPP/232-C)
- [NYC SBS, Comprehensive Guide to Commercial Leasing in New York City](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf)
- [NYS Senate, Cooking Without Gas (2017)](https://www.nysenate.gov/sites/default/files/press-release/attachment/cooking_without_gas.pdf)
- [NY Tax Law §1141(c), bulk sale notice](https://www.nysenate.gov/legislation/laws/TAX/1141)
- [NY Tax Law §1145, penalties and interest](https://www.nysenate.gov/legislation/laws/TAX/1145)

Вторичные источники и выдержки поиска (числа из них помечены `estimate`):

- [15 RCNY Chapter 1 (asbestos), ACP-7 fee tiers](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-23455)
- [European Acustica, soundproofing a cafe (Spain)](https://www.europeanacustica.com/insonorizar-cafeteria/)
- [2010 ADA Standards for Accessible Design](https://www.ada.gov/law-and-regs/design-standards/2010-stds/)
- [NY1, surge in ADA lawsuits by a small group of filers (2019)](https://ny1.com/nyc/all-boroughs/news/2019/10/25/surge-in-lawsuits-by-small-group-of-with-disabilities-draws-scrutiny)
- [DOB, AHV renewal guidelines and fees](https://www.nyc.gov/site/buildings/industry/ahvs-renewal-guidelines-fees.page)
- [ACHR News, air curtains end cold-draft complaints](https://achrnews.com/articles/159663-michigan-eatery-eliminates-cold-complaints-with-air-curtains)
- [Alpha Contractors NY, commercial build-out cost NYC 2026](https://www.alphacontractorsny.com/guides/commercial-build-out-cost-nyc)
- [ASEE paper, change orders impact on project cost](https://peer.asee.org/change-orders-impact-on-project-cost)
- [NYS DTF, Form AU-196.10 instructions](https://tax.ny.gov/pdf/current_forms/st/au196_10.pdf)
- [BizBen, red flags when buying a coffee shop](https://blog.bizben.com/how-to-buy-a-coffee-shop-5-red-flags-you-must-avoid/)
- [BizBuySell, coffee shop and cafe valuation benchmarks](https://www.bizbuysell.com/learning-center/valuation-benchmarks/coffee-shops-cafes/)
- [Bloom Intelligence, Wi-Fi dwell times at US coffee shops 2026](https://bloomintelligence.com/coffee-shop-marketing/)
- [NYS DTF, Tax Bulletin Bulk Sales (TB-ST-70)](https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/bulk_sales.htm)
- [KBTX, cafe closed after a vehicle hits the building (2023)](https://www.kbtx.com/2023/07/09/college-station-coffee-cafe-closed-after-vehicle-hits-building/)
- [CBRE, Manhattan Retail Figures Q3 2026](https://www.cbre.com/insights/figures/manhattan-retail-figures-q3-2026)
- [NYC311, open cellar doors](https://portal.311.nyc.gov/article/?kanumber=KA-02292)
- [City Record, Parks concession award for a park cafe (2024)](https://a856-cityrecord.nyc.gov/RequestDetail/20240628149)
- [Commercial Observer, key money deals](https://commercialobserver.com/2013/08/weighing-in-on-key-money-deals/)
- [DEP, Cross Connection Controls](https://www.nyc.gov/site/dep/about/cross-connection-controls.page)
- [Cushman & Wakefield, Manhattan Retail MarketBeat Q3 2026](https://www.cushmanwakefield.com/en/united-states/insights/us-marketbeats/new-york-city-area-marketbeats/manhattan-retail)
- [Lu, Musalem, Olivares, Schilkrut: measuring the effect of queues on customer purchases (deli counter)](https://business.columbia.edu/sites/default/files-efs/pubfiles/4642/deli_paper%200523_2011-%20post.pdf)
- [DEP, hospitality industry guide to environmental compliance](https://www.nyc.gov/assets/dep/downloads/pdf/air/hospitality-industry-guide-environmental-compliance.pdf)
- [Rhumbix citing Dodge Data & Analytics on change orders](https://www.rhumbix.com/blog/how-much-are-change-orders-costing-your-construction-business)
- [Dining Out NYC, enforcement](https://www.diningoutnyc.info/enforcement)
- [Dining Out NYC, fees](https://www.diningoutnyc.info/apply/fees)
- [Dining Out NYC, public hearing](https://www.diningoutnyc.info/apply/publichearing)
- [NYS DOL, transfers of business and your contribution rate](https://dol.ny.gov/transfers-business-and-your-contribution-rate)
- [1st-line, commercial espresso machine electrical requirements](https://www.1st-line.com/customer-education/commercial-espresso-machine-basic-requirements/)
- [Proskauer, NYC final rule amending ESSTA (successor employers), 2023](https://www.lawandtheworkplace.com/2023/10/new-york-city-adopts-final-rule-amending-the-earned-safe-and-sick-time-act/)
- [Franchise Overview, Dunn Brothers Coffee fees](https://franchiseoverview.com/company/dunn-brothers-coffee)
- [Franchise Chatter, Scooter's Coffee 2026 FDD fees](https://www.franchisechatter.com/2026/09/26/scooters-coffee-franchise-review-2026-costs-fees-news-average-revenues-and-or-profits/)
- [NYC Fire Code, means of egress maintenance](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-144597)
- [Eater NY, fire closes a Nolita bagel shop (2019)](https://ny.eater.com/2019/3/7/18254534/fire-nolita-black-seed-bagels)
- [Cushman & Wakefield, retail fit-out cost guide](https://www.cushmanwakefield.com/en/united-states/insights/retail-fit-out-cost-guide)
- [amNY, MTA retail at Grand Central Madison](https://www.amny.com/transit/mta-master-vendor-grand-central-madison-retail)
- [Insight Glass, storefront window cost](https://www.insightglass.com/how-much-do-storefront-windows-cost/)
- [Daily Coffee News, Gregorys Coffee launches franchising, February 2026](https://dailycoffeenews.com/2026/02/18/backed-by-craveworthy-gregorys-coffee-launches-franchising)
- [NYC Health Code Article 5 (permits; change of ownership)](https://www.nyc.gov/assets/doh/downloads/pdf/about/healthcode/health-code-article5.pdf)
- [NYC Health Code Article 81 (food preparation and food establishments)](https://www.nyc.gov/assets/doh/downloads/pdf/about/healthcode/health-code-article81.pdf)
- [Habitat, holdover rent premiums enforced by NY courts](https://www.thehabitatgroup.com/articles/9654-require-tenants-to-pay-maximum-premium-rent-for-long-holdovers)
- [Hospitality Net, table spacing and diner satisfaction](https://www.hospitalitynet.org/news/4039649.html)
- [The Counter, food incubator closes suddenly](https://thecounter.org/major-food-incubator-closes-suddenly-leaves-175-companies-kitchenless/)
- [DHC Legal via JD Supra, build-out provisions in NYC restaurant leases](https://www.jdsupra.com/legalnews/build-out-provisions-in-nyc-restaurant-1727571/)
- [1010 WINS, Katz's Deli ADA settlement with a $20,000 penalty](https://www.audacy.com/1010wins/news/local/katzs-deli-settles-americans-with-disabilities-act-lawsuit)
- [Nectar, Con Edison rate summary (demand charges)](https://nectarclimate.com/rates/consolidated-edison-coned)
- [NY Labor Law §240 (scaffold law)](https://www.nysenate.gov/legislation/laws/LAB/240)
- [DOB, Accessory Sign Education & Outreach (Local Law 15 of 2026)](https://www.nyc.gov/site/buildings/safety/sign-ll15of2026.page)
- [Local Law 185 of 2019, commercial tenant harassment penalties](https://intro.nyc/local-laws/2019-185)
- [NY1, Council repeals roll-down gate deadline, July 2, 2026](https://ny1.com/nyc/all-boroughs/news/2026/07/02/city-council-votes-to-repeal-deadline-for-new-roll-down-security-gates)
- [DOB, Letter of No Objection](https://www.nyc.gov/site/buildings/property-or-business-owner/letter-of-no-objection-or-completion.page)
- [LPC, storefronts](https://www.nyc.gov/site/lpc/applications/storefronts.page)
- [Metro Manhattan Office Space, security deposits](https://www.metro-manhattan.com/security-deposit/)
- [NPR 2014, cafe without laptops](https://www.npr.org/blogs/alltechconsidered/2014/04/10/300518819/no-laptops-no-wi-fi-how-one-cafe-fired-up-sales)
- [NYCHA store leasing](https://www.nyc.gov/site/nycha/business/store-leasing.page)
- [NYC Hospitality Alliance, Con Edison gas service check before a lease](https://thenycalliance.org/news-item/Con-Edison-Gas-Service)
- [NYC311, odor complaints](https://portal.311.nyc.gov/article/?kanumber=KA-02313)
- [The City Reporter, outdoor dining laws (August 2026)](https://www.thecityreporter.nyc/2026/08/13/nyc-outdoor-dining-roadside-sheds-new-laws-restaraunts/)
- [16 NYCRR §13.7, security deposits of nonresidential utility customers](https://d1tvxue8o4w0fl.cloudfront.net/regulation/new-york-codes-rules-and-regulations/title-16-department-of-public-service/chapter-i-rules-of-procedure/subchapter-b-procedures-and-requirements-concerning-consumer-protections/part-13-rules-governing-the-provision-of-service-by-gas-electric-and-steam-corporations-to-nonresidential-customers/section-137-security-deposits)
- [KPTV, diner reopens months after a kitchen fire (2023)](https://www.kptv.com/2023/11/08/historic-diner-reopens-downtown-portland-months-after-kitchen-fire/)
- [CityLand, unlicensed plumber fined](https://citylandnyc.org/unlicensed-plumber-fined)
- [Robin Zander, lessons from selling a cafe](https://robinpzander.com/lessons-learned-building-and-selling-robins-cafe/)
- [Gothamist, building incident closes a cafe (2017)](https://tollbit.gothamist.com/2017/05/24/kushner_evict_pudge_knuckles.php)
- [Queens Eagle, black-market vending permits (2025)](https://queenseagle.com/all/2025/4/18/roosevelt-ave-crackdown-pushes-street-vendors-toward-pricey-black-market-permits)
- [Mayor's Office, Open for Small Business reforms, July 2026](https://www.nyc.gov/mayors-office/news/2026/07/mayor-mamdani-announces--open-for-small-business---over-50-refor.html)
- [News 12, Riverdale businesses without gas for months (December 2024)](https://brooklyn.news12.com/riverdale-businesses-struggle-without-gas-for-months)
- [InDaily, roaster odor dispute closes a cafe (Adelaide, 2024)](https://www.indailysa.com.au/citymag/food-drink/2024/05/21/bitter-brew-cbd-coffee-spot-to-close-doors)
- [SBS, food establishment pre-operational pathway](https://www.nyc.gov/site/sbs/businesses/food-establishment-form.page)
- [Seyfarth Shaw, ADA Title III federal filings 2025](https://www.jdsupra.com/legalnews/ada-title-iii-federal-lawsuit-filings-2632226/)
- [NYC Business, shared kitchens](https://nyc-business.nyc.gov/nycbusiness/description/shared-kitchens/about)
- [DOB, sidewalk sheds](https://www.nyc.gov/site/buildings/safety/sidewalk-sheds.page)
- [6sqft, Smorgasburg season](https://www.6sqft.com/smorgasburg-returns-for-16th-year-this-april-with-new-vendors/)
- [Whiteford, SBA SOP 50 10 8 key changes (equity injection)](https://www.whitefordlaw.com/news-events/client-alert-sba-issues-sop-50-10-8-key-changes-impacting-sba-7a-lending)
- [NYS DTF, Tax Bulletin Capital Improvements (TB-ST-104)](https://tax.ny.gov/pubs_and_bulls/tg_bulletins/st/capital_improvements.htm)
- [Startland News 2024, SBDC adviser on customers lost after a change of owner](https://www.startlandnews.com/2024/03/kc-small-biz-new-owners)
- [Terrapin Construction Group, restaurant construction cost 2026](https://terrapincg.com/news/average-cost-to-build-high-end-restaurant)
- [NYC Business, temporary Place of Assembly certificate](https://nyc-business.nyc.gov/nycbusiness/description/temporary-place-of-assembly-certificate-of-operation)
- [Triumph Electric, Con Edison service upgrade guide 2026](https://triumphelectricinc.com/con-edison-service-upgrade-guide-powering-your-nyc-property-in-2026/)
- [CommercialSearch on 2026 construction cost outlook (Turner & Townsend 4.25%, JLL)](https://www.commercialsearch.com/news/will-construction-costs-go-up-in-2026/)
- [NYC311, sidewalk storm enclosures](https://portal.311.nyc.gov/article/?kanumber=KA-02227)
- [Lehigh Valley Public Media, cafe closed by water damage](https://www.lehighvalleypublicmedia.org/news/parkland-east-penn/a-bit-overwhelming-nowhere-coffee-co-temporarily-closed-in-emmaus-following-heavy-losses-from-water-damage/)
- [WebstaurantStore, two-group espresso machine price](https://www.webstaurantstore.com/espresso-machine-2gr-appi/238APLCV2.html)
- [DNAinfo, East Village cafe back patio ruled illegal](https://www.dnainfo.com/new-york/20141006/east-village/city-waited-3-decades-rule-yaffa-cafes-back-patio-illegal-manager-says)

## Приложение А. Таблица «событие → эффект → источник»

Порядок: по группам, внутри — core, deep, exotic. Конф.: V — первоисточник открыт мной (`verified`), E — оценка (`estimate`). «Мес.» — месяцы года, «Длит.» — `durationMonths`.

### Аренда и арендодатель (48)

| Событие | Уровень | Из | Эффект | Мес. | Длит. | Источник | Конф. |
|---|---|---|---|---|---|---|---|
| `annual_rent_step` | core | D01 | `rent` ×1.03 | все | 12 | [nyc.gov](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf) | V |
| `assignment_consent_price` | core | D01 | `closingDelayDays` +30; `cash` -2,500; `rent` ×1.1 | все | 1 | [nysenate.gov](https://www.nysenate.gov/legislation/laws/RPP/226-B) | E |
| `d00_closures_nyc_event_building_repair_limbo` | core | D00 | `closureDays` +45; `rent` ×0.0 | все | 2 | [nysenate.gov](https://www.nysenate.gov/legislation/laws/RPP/227) | E |
| `d00_labor_finance_crt_review` | core | D00 | `tax` +0; `tax` ×0.039 если rent >= $250,000/yr and (income > $5M or | все | 0 | [nyc.gov](https://www.nyc.gov/site/finance/business/business-commercial-rent-tax-crt.page) | V |
| `d00_labor_finance_zero_sales_return` | core | D00 | `fine` +50 если return not filed | 3,6,9,12 | 0 | [nysenate.gov](https://www.nysenate.gov/legislation/laws/TAX/1145) | V |
| `d00_premises_guaranty_scope` | core | D00 | `personalLiability` +36,000 (good_guy 36,000, full 432,000, none 0) | все | 0 | [nyc.gov](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf) | E |
| `d00_premises_landlord_access` | core | D00 | `closureDays` +2 | все | 1 | [nyc.gov](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf) | E |
| `d00_premises_landlord_permit` | core | D00 | `openingDelayDays` +30 | все | 1 | [nyc.gov](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf) | E |
| `d00_premises_lease_court` | core | D00 | `cash` -7,500 | все | 3 | [nyc.gov](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf) | E |
| `d00_premises_lease_rent_start ⇢ free_rent_runs_out` | core | D00 | `setupRentDays` +17 (light 17, standard 47, heavy 137) | все | — | [nyc.gov](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf) | E |
| `d00_premises_surrender_clawback` | core | D00 | `cash` -33,120 | все | 0 | [nyc.gov](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf) | V |
| `first_timer_turned_away` | core | D01 | `depositMonths` +3 | все | 0 | [nyc.gov](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf) | E |
| `free_rent_ends ⇢ free_rent_runs_out` | core | D14 | `inbox` +1 | все | 0 | [nyc.gov](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf) | E |
| `free_rent_runs_out` | core | D01 | `setupRentDays` +17 (light 17, standard 47, heavy 137); `rent` ×1.0 | все | — | [nyc.gov](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf) | E |
| `landlord_blocks_the_sale` | core | D09 | `salePrice` ×0.9; `closingDelayDays` +30 | все | 2 | [nysenate.gov](https://www.nysenate.gov/legislation/laws/RPP/226-B) | E |
| `landlord_late_delivery` | core | D01 | `openingDelayDays` +45; `rent` ×0.0; `setupCost` +375 | все | 2 | [nyc.gov](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf) | E |
| `lease_renewal_offer` | core | D10 | `rent` ×1.2 (prime 1.3, mid 1.2, cheap 1.05) | все | 60 | [nyc.gov](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf) | E |
| `rent_default_notice` | core | D08 | `cash` -300; `cash` -2,500; `evictionClockDays` +14 | все | 1 | [nysenate.gov](https://www.nysenate.gov/legislation/laws/RPA/711) | V |
| `rent_step_anniversary ⇢ annual_rent_step` | core | D08 | `rent` ×1.03 | все | 12 | [nyc.gov](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf) | V |
| `asking_rents_climb (новое)` | deep | D15 | `rent` ×1.0125; `freeRentMonths` -1 | 1,4,7,10 | 3 | [cbre.com](https://www.cbre.com/insights/figures/manhattan-retail-figures-q3-2026) | E |
| `building_sold` | deep | D10 | `renewalRentMult` +0.1 | все | 12 | [nyc.gov](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf) | E |
| `d00_closures_nyc_event_bare_handover` | deep | D00 | `cash` -6,000 | все | 0 | [nyc.gov](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf) | E |
| `d00_closures_nyc_event_espresso_exclusivity` | deep | D00 | `demand` ×0.7 | все | 0 | [nyc.gov](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf) | E |
| `d00_closures_nyc_event_owner_landlord_exit` | deep | D00 | `leaseEndsInMonths` +6 | все | 6 | [nyc.gov](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf) | E |
| `d00_closures_nyc_event_pass_through_jump` | deep | D00 | `rentAdd` +281 | 7 | 12 | [nyc.gov](https://www.nyc.gov/site/finance/about/press/press-release-fy27-tentative-assessment-roll.page) | E |
| `d00_closures_nyc_event_relocation_repeats` | deep | D00 | `setupCost` +70,000; `awareness` ×0.5 | все | 0 | [nyc.gov](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf) | E |
| `d00_closures_nyc_event_renewal_fight` | deep | D00 | `leaseEndsInMonths` +6 | все | 6 | [nyc.gov](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf) | V |
| `d00_closures_nyc_event_reopen_after_peak` | deep | D00 | `demand` ×0.7 | 9,10,11,12 | 3 | [tollbit.gothamist.com](https://tollbit.gothamist.com/2017/05/24/kushner_evict_pudge_knuckles.php) | E |
| `d00_closures_nyc_event_repair_dispute_surrender` | deep | D00 | `closureDays` +5; `cash` -3,000 | все | 2 | [nyc.gov](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf) | E |
| `d00_closures_nyc_event_repair_reopening_notice` | deep | D00 | `closureDays` +30 | все | 2 | [ny.eater.com](https://ny.eater.com/2019/3/7/18254534/fire-nolita-black-seed-bagels) | E |
| `d00_closures_nyc_event_shared_basement` | deep | D00 | `inspections` ×1.2; `monthlyFees` +175 | все | 3 | [nyc.gov](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf) | E |
| `d00_closures_nyc_event_sprinkler_stock` | deep | D00 | `cash` -4,000; `closureDays` +5 | все | 1 | [tollbit.gothamist.com](https://tollbit.gothamist.com/2017/05/24/kushner_evict_pudge_knuckles.php) | E |
| `d00_premises_landlord_utility_exit` | deep | D00 | `closureDays` +3 | все | 3 | [nysenate.gov](https://www.nysenate.gov/legislation/laws/RPP/227) | E |
| `d00_premises_lease_hours` | deep | D00 | `defaultNotice` +1 | все | 1 | [nyc.gov](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf) | E |
| `d00_premises_short_tenure_capex` | deep | D00 | `capexValueLost` ×0.6 | все | 0 | [nyc.gov](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf) | E |
| `d00_world_event_insurance_claim_dependencies` | deep | D00 | `closureDays` +21 | все | 2 | [kptv.com](https://www.kptv.com/2023/11/08/historic-diner-reopens-downtown-portland-months-after-kitchen-fire/) | E |
| `d00_world_event_landlord_authority_unclear` | deep | D00 | `leaseSigningDelayDays` +21 | все | 1 | [nyc.gov](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf) | E |
| `d00_world_event_outside_seating_withdrawn` | deep | D00 | `seats` -8 | 4,5,6,7,8,9,10 | 6 | [nyc.gov](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf) | E |
| `d00_world_event_split_premises_dependency` | deep | D00 | `capacity` ×0.8 | все | 3 | [nyc.gov](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf) | E |
| `deposit_kept_by_landlord` | deep | D09 | `depositRefundDelayDays` +45; `depositRefund` -6,000 | все | 2 | [nyc.gov](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf) | E |
| `lease_renewal_reset ⇢ lease_renewal_offer` | deep | D08 | `rent` ×1.2 (prime 1.3, mid 1.2, cheap 1.05); `buildoutValue` ×0.0 | все | 60 | [nyc.gov](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf) | E |
| `letter_of_credit_wait` | deep | D01 | `leaseSigningDelayDays` +18; `monthlyFees` +23 | все | 1 | [nyc.gov](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf) | E |
| `short_lease_left` | deep | D01 | `takeoverPrice` ×0.85; `renewalRentMult` +0.2 | все | 0 | [nyc.gov](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf) | E |
| `still_on_the_lease_after_sale` | deep | D09 | `cash` -18,000; `cash` -3,000 | все | 3 | [nyc.gov](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf) | E |
| `tax_escalation_bill` | deep | D01 | `rentAdd` +52; `rentAdd` +281 | 7 | 12 | [nyc.gov](https://www.nyc.gov/site/finance/about/press/press-release-fy27-tentative-assessment-roll.page) | E |
| `vacancy_leverage` | deep | D01 | `freeRentMonths` +2; `rent` ×0.9 | все | 12 | [cushmanwakefield.com](https://www.cushmanwakefield.com/en/united-states/insights/us-marketbeats/new-york-city-area-marketbeats/manhattan-retail) | E |
| `holdover_after_expiry` | exotic | D08 | `rent` ×1.5 | все | 1 | [thehabitatgroup.com](https://www.thehabitatgroup.com/articles/9654-require-tenants-to-pay-maximum-premium-rent-for-long-holdovers) | E |
| `landlord_pressure` | exotic | D08 | `demand` ×0.9; `closureDays` +2 | все | 3 | [intro.nyc](https://intro.nyc/local-laws/2019-185) | E |

### Ремонт и разрешения (49)

| Событие | Уровень | Из | Эффект | Мес. | Длит. | Источник | Конф. |
|---|---|---|---|---|---|---|---|
| `asbestos_found` | core | D01 | `setupCost` +1,000; `buildoutCost` +6,900 если material found above 10 sq ft / 25 linea; `openingDelayDays` +14 если material found | все | 1 | [nyc.gov](https://www.nyc.gov/site/buildings/dob/project-requirements-asbestos.page) | E |
| `certificate_of_occupancy_mismatch` | core | D01 | `buildoutCost` +15,000; `permitWaitDays` +45 | все | 2 | [nyc.gov](https://www.nyc.gov/site/buildings/property-or-business-owner/certificate-of-occupancy.page) | E |
| `change_orders_pile_up` | core | D01 | `buildoutCost` ×1.08; `openingDelayDays` +10 | все | 1 | [rhumbix.com](https://www.rhumbix.com/blog/how-much-are-change-orders-costing-your-construction-business) | E |
| `d00_premises_asbestos_scope ⇢ asbestos_found` | core | D00 | `buildoutCost` +6,900; `openingDelayDays` +14 | все | 1 | [nyc.gov](https://www.nyc.gov/site/buildings/dob/project-requirements-asbestos.page) | E |
| `d00_premises_bid_after_lease` | core | D00 | `buildoutCost` ×1.2 | все | 0 | [terrapincg.com](https://terrapincg.com/news/average-cost-to-build-high-end-restaurant) | E |
| `d00_premises_design_changes ⇢ change_orders_pile_up` | core | D00 | `buildoutCost` ×1.05; `openingDelayDays` +7 | все | 1 | [rhumbix.com](https://www.rhumbix.com/blog/how-much-are-change-orders-costing-your-construction-business) | E |
| `d00_premises_early_stock` | core | D00 | `cash` -500 | все | 0 | [nyc.gov](https://www.nyc.gov/site/sbs/businesses/food-establishment-form.page) | E |
| `d00_premises_exemption_scope` | core | D00 | `cash` -2,000 | все | 1 | [nyc.gov](https://www.nyc.gov/site/buildings/property-or-business-owner/project-requirements-owner-signs.page) | E |
| `d00_premises_hood_rearrange` | core | D00 | `setupCost` +1,500; `closureDays` +1 | все | 1 | [nyc-business.nyc.gov](https://nyc-business.nyc.gov/nycbusiness/description/food-service-establishment-permit) | E |
| `d00_premises_landmark_repaint` | core | D00 | `cash` -2,000; `permitWaitDays` +14 | все | 1 | [nyc.gov](https://www.nyc.gov/assets/operations/downloads/pdf/mmr2026/lpc.pdf) | E |
| `d00_premises_landmark_terrace` | core | D00 | `permitWaitDays` +14 | 3,4,5 | 1 | [nyc.gov](https://www.nyc.gov/assets/operations/downloads/pdf/mmr2026/lpc.pdf) | E |
| `d00_premises_lpc_incomplete` | core | D00 | `permitWaitDays` +14 | все | 1 | [nyc.gov](https://www.nyc.gov/assets/operations/downloads/pdf/mmr2026/lpc.pdf) | E |
| `d00_premises_old_legal_use ⇢ no_certificate_of_occupancy` | core | D00 | `permitWaitDays` +30; `setupCost` +2,000 | все | 1 | [nyc.gov](https://www.nyc.gov/site/buildings/property-or-business-owner/certificate-of-occupancy.page) | E |
| `d00_premises_prepermit_fail` | core | D00 | `setupCost` +1,000; `openingDelayDays` +0 если fixed before day 22 | все | 1 | [nyc-business.nyc.gov](https://nyc-business.nyc.gov/nycbusiness/description/food-service-establishment-permit) | E |
| `d00_premises_sign_relief_scope` | core | D00 | `fine` +0 если accessory storefront sign up to 150 sq f; `cash` -1,500 если unsafe or larger sign | все | 1 | [nyc.gov](https://www.nyc.gov/site/buildings/property-or-business-owner/project-requirements-owner-signs.page) | E |
| `d00_premises_signoffs_missing` | core | D00 | `permitWaitDays` +30; `setupCost` +1,500 | все | 1 | [nyc.gov](https://www.nyc.gov/site/buildings/property-or-business-owner/certificate-of-occupancy.page) | E |
| `d00_premises_swo_partial` | core | D00 | `openingDelayDays` +14; `fine` +6,000 | все | 1 | [nyc.gov](https://www.nyc.gov/assets/operations/downloads/pdf/mmr2026/dob.pdf) | V |
| `d00_premises_swo_rescission` | core | D00 | `openingDelayDays` +10 | все | 1 | [nyc.gov](https://www.nyc.gov/site/buildings/property-or-business-owner/stop-work-order.page) | V |
| `d00_premises_temporary_occupancy` | core | D00 | `monthlyFees` +43 | все | 3 | [nyc.gov](https://www.nyc.gov/site/buildings/property-or-business-owner/temporary-certificate-of-occupancy.page) | V |
| `d00_premises_use_mismatch ⇢ certificate_of_occupancy_mismatch` | core | D00 | `buildoutCost` +15,000; `permitWaitDays` +45 | все | 2 | [nyc.gov](https://www.nyc.gov/site/buildings/property-or-business-owner/certificate-of-occupancy.page) | E |
| `dob_enforcement_sweep (новое)` | core | D15 | `discoveredBy` =inspection; `fine` +15,000 если work without a permit found; `openingDelayDays` +32 если work without a permit found | все | 1 | [nyc.gov](https://www.nyc.gov/assets/operations/downloads/pdf/mmr2026/dob.pdf) | V |
| `dob_permit_issued` | core | D14 | `permitWaitDays` +25; `setupCost` +970 (light 970, standard 2,103, heavy 3,545) | все | 1 | [nyc.gov](https://www.nyc.gov/assets/operations/downloads/pdf/mmr2026/dob.pdf) | V |
| `hidden_conditions` | core | D01 | `buildoutCost` ×1.1; `openingDelayDays` +14 | все | 1 | [rhumbix.com](https://www.rhumbix.com/blog/how-much-are-change-orders-costing-your-construction-business) | E |
| `plan_examiner_objections` | core | D01 | `permitWaitDays` +19; `setupCost` +1,500 | все | 1 | [nyc.gov](https://www.nyc.gov/assets/operations/downloads/pdf/mmr2026/dob.pdf) | E |
| `seat_20_restroom_line` | core | D14 | `setupCost` +12,000; `seats` -3 | все | 0 | [nyc-business.nyc.gov](https://nyc-business.nyc.gov/nycbusiness/description/food-service-establishment-permit) | E |
| `stop_work_order ⇢ stop_work_order_served` | core | D14 | `fine` +15,000; `openingDelayDays` +32 | все | 1 | [nyc.gov](https://www.nyc.gov/assets/buildings/rules/1_RCNY_102-04.pdf) | V |
| `stop_work_order_served` | core | D01 | `fine` +15,000; `openingDelayDays` +32 | все | 1 | [nyc.gov](https://www.nyc.gov/assets/buildings/rules/1_RCNY_102-04.pdf) | V |
| `allowance_paid_after_the_work` | deep | D01 | `cashFloat` -40,000; `monthlyFees` +333 | все | 2 | [jdsupra.com](https://www.jdsupra.com/legalnews/build-out-provisions-in-nyc-restaurant-1727571/) | E |
| `building_arrears_block_permit` | deep | D01 | `permitWaitDays` +30; `cash` -6,000 если player pays the old penalty to unblock | все | 1 | [nyc.gov](https://www.nyc.gov/assets/buildings/rules/1_RCNY_102-04.pdf) | V |
| `city_cuts_red_tape` | deep | D01 | `permitWaitDays` ×0.9; `fines` ×0.83 | 7 | 12 | [nyc.gov](https://www.nyc.gov/mayors-office/news/2026/07/mayor-mamdani-announces--open-for-small-business---over-50-refor.html) | E |
| `construction_noise_complaint` | deep | D01 | `fine` +6,000 если after-hours work without a variance; `fine` +560 если unreasonable construction noise; `openingDelayDays` +7 | все | 1 | [nyc.gov](https://www.nyc.gov/assets/buildings/rules/1_RCNY_102-04.pdf) | V |
| `contractor_adds_sales_tax` | deep | D01 | `buildoutCost` +3,106 | все | 0 | [tax.ny.gov](https://tax.ny.gov/pubs_and_bulls/tg_bulletins/st/capital_improvements.htm) | E |
| `d00_premises_construction_lien ⇢ mechanics_lien_filed` | deep | D00 | `cash` -8,000 | все | 2 | [nysenate.gov](https://www.nysenate.gov/legislation/laws/LIE/10) | E |
| `d00_premises_outside_scope` | deep | D00 | `buildoutCost` +10,000; `permitWaitDays` +30 | все | 1 | [nyc.gov](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf) | E |
| `d00_premises_toilet_renovation ⇢ renovation_triggers_restroom_rules` | deep | D00 | `buildoutCost` +12,000; `seats` -3 | все | 1 | [nyc-business.nyc.gov](https://nyc-business.nyc.gov/nycbusiness/description/food-service-establishment-permit) | E |
| `failed_trade_inspection` | deep | D01 | `openingDelayDays` +14; `buildoutCost` +12,000; `cash` -5,000 | все | 1 | [citylandnyc.org](https://citylandnyc.org/unlicensed-plumber-fined) | E |
| `fit_out_prices_rise` | deep | D01 | `buildoutCost` ×1.05 | 3 | 12 | [commercialsearch.com](https://www.commercialsearch.com/news/will-construction-costs-go-up-in-2026/) | E |
| `landmark_review` | deep | D01 | `permitWaitDays` +14; `permitWaitDays` +60 если storefront change that needs a public he | все | 1 | [nyc.gov](https://www.nyc.gov/assets/operations/downloads/pdf/mmr2026/lpc.pdf) | V |
| `mechanics_lien_filed` | deep | D01 | `cash` -8,000; `monthlyFees` +0 | все | 2 | [nysenate.gov](https://www.nysenate.gov/legislation/laws/LIE/10) | E |
| `no_certificate_of_occupancy` | deep | D01 | `permitWaitDays` +30; `setupCost` +2,000 | все | 1 | [nyc.gov](https://www.nyc.gov/site/buildings/property-or-business-owner/certificate-of-occupancy.page) | E |
| `pre_permit_inspection_blocked` | deep | D01 | `openingDelayDays` +0 | все | 0 | [nyc-business.nyc.gov](https://nyc-business.nyc.gov/nycbusiness/description/food-service-establishment-permit) | V |
| `renovation_triggers_restroom_rules` | deep | D02 | `buildoutCost` +12,000; `seats` -3 | все | 1 | [nyc-business.nyc.gov](https://nyc-business.nyc.gov/nycbusiness/description/food-service-establishment-permit) | E |
| `sign_complaint_wave` | deep | D02 | `inspections` ×1.5; `fine` +0 если accessory storefront sign up to 150 sq f; `fine` +6,000 если larger or unsafe sign | все | 1 | [nyc.gov](https://www.nyc.gov/site/buildings/safety/sign-ll15of2026.page) | E |
| `sign_moratorium_ll15 (новое)` | deep | D15 | `fine` ×0.0 | все | 12 | [nyc.gov](https://www.nyc.gov/site/buildings/safety/sign-ll15of2026.page) | E |
| `buildings_walk_in_help` | exotic | D01 | `permitWaitDays` ×0.9; `openingDelayDays` +5 | все | 1 | [nyc.gov](https://www.nyc.gov/mayors-office/news/2026/07/mayor-mamdani-announces--open-for-small-business---over-50-refor.html) | E |
| `dob_subsequent_filing_fee (новое)` | exotic | D15 | `setupCost` +325 | 2 | 12 | [nyc.gov](https://www.nyc.gov/assets/buildings/pdf/26fee_updates-sn.pdf) | V |
| `landmark_notice` | exotic | D02 | `cash` -2,600; `permitWaitDays` +14 | все | 1 | [nyc.gov](https://www.nyc.gov/site/lpc/applications/storefronts.page) | E |
| `structural_surprise` | exotic | D01 | `openingDelayDays` +120; `rent` ×1.0 | все | 4 | [nyc.gov](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf) | E |
| `worker_falls_on_site` | exotic | D01 | `cash` -25,000 | все | 1 | [nysenate.gov](https://www.nysenate.gov/legislation/laws/LAB/240) | E |

### Газ, электричество, вода (16)

| Событие | Уровень | Из | Эффект | Мес. | Длит. | Источник | Конф. |
|---|---|---|---|---|---|---|---|
| `breaker_trips_at_peak` | core | D02 | `staffAvailability` ×0.95 | все | 1 | [1st-line.com](https://www.1st-line.com/customer-education/commercial-espresso-machine-basic-requirements/) | E |
| `d00_premises_backflow_install` | core | D00 | `setupCost` +4,000; `permitWaitDays` +30; `monthlyFees` +13 | все | 1 | [nyc.gov](https://www.nyc.gov/site/dep/about/cross-connection-controls.page) | E |
| `d00_premises_gas_sequence ⇢ gas_turn_on_wait` | core | D00 | `openingDelayDays` +68 | все | 2 | [nysenate.gov](https://www.nysenate.gov/sites/default/files/press-release/attachment/cooking_without_gas.pdf) | V |
| `d00_premises_meter_not_live` | core | D00 | `openingDelayDays` +14 | все | 1 | [nyc.gov](https://www.nyc.gov/assets/hpd/downloads/pdfs/services/hpd-pilot-coned-load-letter.pdf) | E |
| `d00_premises_utility_deposit ⇢ utility_deposit_demand` | core | D00 | `cash` -1,800 | все | 12 | [d1tvxue8o4w0fl.cloudfront.net](https://d1tvxue8o4w0fl.cloudfront.net/regulation/new-york-codes-rules-and-regulations/title-16-department-of-public-service/chapter-i-rules-of-procedure/subchapter-b-procedures-and-requirements-concerning-consumer-protections/part-13-rules-governing-the-provision-of-service-by-gas-electric-and-steam-corporations-to-nonresidential-customers/section-137-security-deposits) | E |
| `d00_premises_utility_extra` | core | D00 | `setupCost` +5,000 | все | 0 | [nyc.gov](https://www.nyc.gov/assets/hpd/downloads/pdfs/services/hpd-pilot-coned-load-letter.pdf) | E |
| `electrical_service_too_small` | core | D01 | `setupCost` +10,000; `openingDelayDays` +20; `openingDelayDays` +84 если utility-side upgrade needed | все | 3 | [nyc.gov](https://www.nyc.gov/assets/hpd/downloads/pdfs/services/hpd-pilot-coned-load-letter.pdf) | E |
| `gas_red_tag` | core | D10 | `closureDays` +3 если cafe can switch to electric hot water; `closureDays` +60 если hot water or oven only on gas; `setupCost` +1,500 если emergency electric water heater | все | 2 | [nyc.gov](https://www.nyc.gov/assets/buildings/pdf/gas_piping-sn.pdf) | E |
| `gas_turn_on_wait` | core | D01 | `openingDelayDays` +68; `setupRentDays` +68 если free months already used | все | 2 | [nysenate.gov](https://www.nysenate.gov/sites/default/files/press-release/attachment/cooking_without_gas.pdf) | V |
| `service_upgrade_wait ⇢ electrical_service_too_small` | core | D02 | `openingDelayDays` +84; `setupRentDays` +84 если before opening, free months used | все | 3 | [nyc.gov](https://www.nyc.gov/assets/hpd/downloads/pdfs/services/hpd-pilot-coned-load-letter.pdf) | E |
| `building_gas_inspection_due (новое)` | deep | D15 | `triggers` =gas_red_tag если hidden attribute gasLeak revealed by the; `ownerFine` +5,000 если owner skips the inspection | 10,11,12 | 1 | [nyc.gov](https://www.nyc.gov/assets/buildings/pdf/gas_piping-sn.pdf) | V |
| `building_gas_shutoff ⇢ gas_red_tag` | deep | D02 | `closureDays` +3; `setupCost` +1,500 | все | 2 | [nyc.gov](https://www.nyc.gov/assets/buildings/pdf/gas_piping-sn.pdf) | E |
| `gas_connection_wait ⇢ gas_turn_on_wait` | deep | D14 | `openingDelayDays` +68 | все | 2 | [nysenate.gov](https://www.nysenate.gov/sites/default/files/press-release/attachment/cooking_without_gas.pdf) | V |
| `utility_deposit_demand` | deep | D01 | `cash` -1,800 | все | 12 | [d1tvxue8o4w0fl.cloudfront.net](https://d1tvxue8o4w0fl.cloudfront.net/regulation/new-york-codes-rules-and-regulations/title-16-department-of-public-service/chapter-i-rules-of-procedure/subchapter-b-procedures-and-requirements-concerning-consumer-protections/part-13-rules-governing-the-provision-of-service-by-gas-electric-and-steam-corporations-to-nonresidential-customers/section-137-security-deposits) | E |
| `gas_shut_off_in_building ⇢ gas_red_tag` | exotic | D01 | `closureDays` +3; `setupCost` +1,500 | все | 2 | [nyc.gov](https://www.nyc.gov/assets/buildings/pdf/gas_piping-sn.pdf) | E |
| `peak_kw_bill_jump` | exotic | D02 | `utilities` ×1.1 | все | 12 | [nectarclimate.com](https://nectarclimate.com/rates/consolidated-edison-coned) | E |

### Вход в бизнес: покупка, франшиза, тележка (36)

| Событие | Уровень | Из | Эффект | Мес. | Длит. | Источник | Конф. |
|---|---|---|---|---|---|---|---|
| `buyer_makes_an_offer` | core | D09 | `salePrice` =2.2 x owner earnings of the last 12 months | все | 1 | [bizbuysell.com](https://www.bizbuysell.com/learning-center/valuation-benchmarks/coffee-shops-cafes/) | E |
| `d00_premises_permit_transfer ⇢ permit_gap_at_closing` | core | D00 | `closureDays` +22 | все | 1 | [nyc-business.nyc.gov](https://nyc-business.nyc.gov/nycbusiness/description/food-service-establishment-permit) | V |
| `d00_premises_seller_tax_claim ⇢ sellers_tax_claim` | core | D00 | `escrowHeld` +13,578 | все | 3 | [nysenate.gov](https://www.nysenate.gov/legislation/laws/TAX/1141) | V |
| `d00_premises_takeover_asset_list` | core | D00 | `setupCost` +8,000; `openingDelayDays` +7 | все | 1 | [robinpzander.com](https://robinpzander.com/lessons-learned-building-and-selling-robins-cafe/) | E |
| `franchise_royalty_bite` | core | D01 | `revenueShare` ×0.92 | все | 12 | [franchisechatter.com](https://www.franchisechatter.com/2026/09/26/scooters-coffee-franchise-review-2026-costs-fees-news-average-revenues-and-or-profits/) | E |
| `market_season_ends` | core | D01 | `demand` ×0.0 | 11,12,1,2,3 | 5 | [6sqft.com](https://www.6sqft.com/smorgasburg-returns-for-16th-year-this-april-with-new-vendors/) | E |
| `overstated_cash_sales` | core | D01 | `demand` ×0.8; `overpaid` +46,600 | все | 12 | [blog.bizben.com](https://blog.bizben.com/how-to-buy-a-coffee-shop-5-red-flags-you-must-avoid/) | E |
| `permit_gap_at_closing` | core | D01 | `closureDays` +22 | все | 1 | [nyc-business.nyc.gov](https://nyc-business.nyc.gov/nycbusiness/description/food-service-establishment-permit) | V |
| `regulars_test_new_owner` | core | D01 | `awareness` =0.7 | все | 3 | [startlandnews.com](https://www.startlandnews.com/2024/03/kc-small-biz-new-owners) | E |
| `seller_tax_debt_surfaces ⇢ sellers_tax_debt_inherited` | core | D14 | `liability` +13,578 | все | 1 | [nysenate.gov](https://www.nysenate.gov/legislation/laws/TAX/1141) | V |
| `sellers_tax_claim` | core | D01 | `escrowHeld` +13,578; `closingDelayDays` +0 | все | 3 | [nysenate.gov](https://www.nysenate.gov/legislation/laws/TAX/1141) | V |
| `sellers_tax_debt_inherited` | core | D01 | `liability` +13,578; `liability` ×1.145 | все | 1 | [nysenate.gov](https://www.nysenate.gov/legislation/laws/TAX/1141) | V |
| `supervisory_licenses_released` | core | D01 | `cartPermitWaitMonths` -12 | 7 | 12 | [nyc.gov](https://www.nyc.gov/site/doh/business/food-operators/mobile-and-temporary-food-vendors.page) | V |
| `takeover_listing` | core | D14 | `askingPrice` =2.2 x yearly owner earnings, floor 0.5 x replacement cost, cap 0.57 x yearly sales; `awareness` =0.7 если name kept; `openingDelayDays` +30 | все | 1 | [bizbuysell.com](https://www.bizbuysell.com/learning-center/valuation-benchmarks/coffee-shops-cafes/) | E |
| `acquisition_tax_at_closing` | deep | D01 | `cash` -3,550 | все | 0 | [tax.ny.gov](https://tax.ny.gov/pdf/current_forms/st/au196_10.pdf) | E |
| `bulk_sale_claim ⇢ sellers_tax_claim` | deep | D14 | `escrowHeld` +13,578 | все | 3 | [nysenate.gov](https://www.nysenate.gov/legislation/laws/TAX/1141) | V |
| `commissary_has_no_room` | deep | D01 | `permitWaitDays` +30; `monthlyFees` +300 | все | 1 | [nyc.gov](https://www.nyc.gov/site/doh/business/food-operators/mobile-and-temporary-food-vendors.page) | E |
| `commissary_rent_hike` | deep | D13 | `monthlyFees` ×1.33 | все | 12 | [nyc.gov](https://www.nyc.gov/site/doh/business/food-operators/mobile-and-temporary-food-vendors.page) | E |
| `d00_world_event_planned_pop_up_end` | deep | D00 | `closureDays` +30 | все | 1 | [nyc.gov](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf) | E |
| `d00_world_event_predecessor_brand_confusion` | deep | D00 | `reputation` -0.02 | все | 3 | [startlandnews.com](https://www.startlandnews.com/2024/03/kc-small-biz-new-owners) | E |
| `d00_world_event_seller_addbacks_unverified ⇢ overstated_cash_sales` | deep | D00 | `ownerEarnings` ×0.85 | все | 12 | [bizbuysell.com](https://www.bizbuysell.com/learning-center/valuation-benchmarks/coffee-shops-cafes/) | E |
| `equipment_lien_surprise` | deep | D01 | `cash` -6,000 | все | 1 | [blog.bizben.com](https://blog.bizben.com/how-to-buy-a-coffee-shop-5-red-flags-you-must-avoid/) | E |
| `equity_injection_gap` | deep | D01 | `minOwnCashShare` +0.1 | все | 0 | [whitefordlaw.com](https://www.whitefordlaw.com/news-events/client-alert-sba-issues-sop-50-10-8-key-changes-impacting-sba-7a-lending) | E |
| `franchise_buildout_not_yours` | deep | D01 | `setupCost` ×2.05 | все | 0 | [dailycoffeenews.com](https://dailycoffeenews.com/2026/02/18/backed-by-craveworthy-gregorys-coffee-launches-franchising) | E |
| `franchise_cooling_off` | deep | D01 | `leaseSigningDelayDays` +14 | все | 1 | [nysenate.gov](https://www.nysenate.gov/legislation/laws/GBS/683) | V |
| `host_ends_the_arrangement` | deep | D01 | `closureDays` +30; `awareness` ×0.7 | все | 1 | [nyc-business.nyc.gov](https://nyc-business.nyc.gov/nycbusiness/description/shared-kitchens/about) | E |
| `inherited_sick_leave_balances` | deep | D01 | `liability` +2,720 | все | 12 | [lawandtheworkplace.com](https://www.lawandtheworkplace.com/2023/10/new-york-city-adopts-final-rule-amending-the-earned-safe-and-sick-time-act/) | E |
| `inherited_unemployment_rate` | deep | D01 | `payrollTax` +0.02 | 1 | 12 | [nysenate.gov](https://www.nysenate.gov/legislation/laws/LAB/581) | E |
| `old_equipment_gives_out` | deep | D01 | `cash` -7,600; `closureDays` +2 | все | 1 | [webstaurantstore.com](https://www.webstaurantstore.com/espresso-machine-2gr-appi/238APLCV2.html) | E |
| `permit_holder_takes_back_permit` | deep | D13 | `demand` ×0.0 | все | 1 | [queenseagle.com](https://queenseagle.com/all/2025/4/18/roosevelt-ave-crackdown-pushes-street-vendors-toward-pricey-black-market-permits) | E |
| `rebrand_loses_regulars` | deep | D14 | `awareness` =0.35; `setupCost` +5,000 | все | 3 | [startlandnews.com](https://www.startlandnews.com/2024/03/kc-small-biz-new-owners) | E |
| `sellers_unpaid_health_fines` | deep | D01 | `permitWaitDays` +14 | все | 1 | [nyc.gov](https://www.nyc.gov/assets/doh/downloads/pdf/about/healthcode/health-code-article5.pdf) | E |
| `shared_kitchen_lockout` | deep | D13 | `demand` ×0.3 | все | 1 | [thecounter.org](https://thecounter.org/major-food-incubator-closes-suddenly-leaves-175-companies-kitchenless/) | E |
| `transit_stall_rfp` | deep | D13 | `rent` =15% of gross sales | все | 1 | [amny.com](https://www.amny.com/transit/mta-master-vendor-grand-central-madison-retail) | E |
| `parks_kiosk_rfp` | exotic | D01 | `rent` +3,333 | 5,6 | 2 | [a856-cityrecord.nyc.gov](https://a856-cityrecord.nyc.gov/RequestDetail/20240628149) | E |
| `young_franchise_system` | exotic | D01 | `awareness` ×0.9 | все | 12 | [dailycoffeenews.com](https://dailycoffeenews.com/2026/02/18/backed-by-craveworthy-gregorys-coffee-launches-franchising) | E |

### Зал и помещение (46)

| Событие | Уровень | Из | Эффект | Мес. | Длит. | Источник | Конф. |
|---|---|---|---|---|---|---|---|
| `accessibility_suit_wave ⇢ d00_premises_entrance_step` | core | D02 | `accessExposure` +15,000 если step and no alternative | все | 1 | [ny1.com](https://ny1.com/nyc/all-boroughs/news/2019/10/25/surge-in-lawsuits-by-small-group-of-with-disabilities-draws-scrutiny) | E |
| `d00_premises_ac_neighbor` | core | D00 | `fine` +560; `setupCost` +4,000 если relocate or enclose the unit, estimate | 6,7,8,9 | 2 | [nyc.gov](https://www.nyc.gov/assets/dep/downloads/pdf/air/noise/noise-code-penalty-schedule.pdf) | V |
| `d00_premises_access_route` | core | D00 | `accessExposure` +15,000 | все | 1 | [ada.gov](https://www.ada.gov/law-and-regs/design-standards/2010-stds/) | E |
| `d00_premises_entrance_step` | core | D00 | `accessExposure` +15,000 если step and no alternative; `demand` ×0.99 | все | 12 | [jdsupra.com](https://www.jdsupra.com/legalnews/ada-title-iii-federal-lawsuit-filings-2632226/) | E |
| `d00_premises_exit_storage` | core | D00 | `fine` +1,000 | все | 1 | [codelibrary.amlegal.com](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-144597) | E |
| `d00_premises_medical_restroom` | core | D00 | `obligation` +1 | все | 0 | [nysenate.gov](https://www.nysenate.gov/legislation/laws/GBS/492) | V |
| `d00_premises_odor_home` | core | D00 | `fine` +560; `setupCost` +5,000 если fix: carbon filter or duct extension, es | все | 2 | [portal.311.nyc.gov](https://portal.311.nyc.gov/article/?kanumber=KA-02313) | E |
| `d00_premises_toilet_route` | core | D00 | `inspectionPoints` +5; `fine` +300 | все | 1 | [nyc.gov](https://www.nyc.gov/assets/doh/downloads/pdf/about/healthcode/health-code-article81.pdf) | E |
| `laptop_camp` | core | D02 | `seatTurns` ×0.85 | 1,2,3,10,11,12 | 1 | [bloomintelligence.com](https://bloomintelligence.com/coffee-shop-marketing/) | E |
| `line_out_the_door ⇢ morning_line_out_the_door` | core | D14 | `demand` ×0.9 | все | 1 | [business.columbia.edu](https://business.columbia.edu/sites/default/files-efs/pubfiles/4642/deli_paper%200523_2011-%20post.pdf) | E |
| `morning_line_out_the_door` | core | D02 | `demand` ×0.95 | все | 1 | [business.columbia.edu](https://business.columbia.edu/sites/default/files-efs/pubfiles/4642/deli_paper%200523_2011-%20post.pdf) | E |
| `permit_ready_after_buildout` | core | D14 | `openingDelayDays` +22; `setupCost` +280 | все | 1 | [nyc-business.nyc.gov](https://nyc-business.nyc.gov/nycbusiness/description/food-service-establishment-permit) | V |
| `saturday_room_full` | core | D02 | `demand` ×0.95; `quality` -0.03 | все | 1 | [npr.org](https://www.npr.org/blogs/alltechconsidered/2014/04/10/300518819/no-laptops-no-wi-fi-how-one-cafe-fired-up-sales) | E |
| `seat_count_at_inspection` | core | D02 | `fine` +300; `inspectionPoints` +10 | все | 1 | [nyc.gov](https://www.nyc.gov/assets/doh/downloads/pdf/about/healthcode/health-code-article81.pdf) | E |
| `sidewalk_cafe_season` | core | D02 | `seats` +10; `demand` ×1.03 | 4,5,6,7,8,9,10 | 7 | [portal.311.nyc.gov](https://portal.311.nyc.gov/article/?kanumber=KA-03604) | E |
| `solo_guests_hold_big_tables` | core | D02 | `seats` ×0.75 | все | 1 | [bloomintelligence.com](https://bloomintelligence.com/coffee-shop-marketing/) | E |
| `winter_draft_at_the_door` | core | D02 | `seats` ×0.9; `quality` -0.02 | 12,1,2 | 3 | [achrnews.com](https://achrnews.com/articles/159663-michigan-eatery-eliminates-cold-complaints-with-air-curtains) | E |
| `aisle_too_narrow ⇢ d00_premises_access_route` | deep | D02 | `accessExposure` +15,000 | все | 1 | [ada.gov](https://www.ada.gov/law-and-regs/design-standards/2010-stds/) | E |
| `cellar_hatch_left_open` | deep | D02 | `inspections` ×1.1; `accessExposure` +0 | все | 1 | [portal.311.nyc.gov](https://portal.311.nyc.gov/article/?kanumber=KA-02292) | E |
| `cellar_stairs_tax` | deep | D02 | `staffAvailability` ×0.97; `seats` +3 | все | 12 | [nyc.gov](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf) | E |
| `community_board_review` | deep | D02 | `permitWaitDays` +60 если hearing; `cash` -900 если hearing notice costs | все | 2 | [portal.311.nyc.gov](https://portal.311.nyc.gov/article/?kanumber=KA-03604) | E |
| `d00_premises_event_capacity` | deep | D00 | `fine` +2,500; `setupCost` +250 если temporary certificate bought | все | 1 | [nyc-business.nyc.gov](https://nyc-business.nyc.gov/nycbusiness/description/temporary-place-of-assembly-certificate-of-operation) | E |
| `d00_street_hidden_sign` | deep | D00 | `footTraffic` ×0.9 | все | 12 | [nyc.gov](https://www.nyc.gov/site/buildings/safety/sidewalk-sheds.page) | E |
| `d00_world_event_fan_setting_recheck ⇢ d00_premises_ac_neighbor` | deep | D00 | `fine` +1,120 | 6,7,8,9 | 2 | [nyc.gov](https://www.nyc.gov/assets/dep/downloads/pdf/air/noise/noise-code-penalty-schedule.pdf) | V |
| `d00_world_event_furniture_impact_noise` | deep | D00 | `reputation` -0.01 | все | 1 | [europeanacustica.com](https://www.europeanacustica.com/insonorizar-cafeteria/) | E |
| `d00_world_event_roast_odor_complaint ⇢ d00_premises_odor_home` | deep | D00 | `setupCost` +5,000; `fine` +560 | все | 2 | [indailysa.com.au](https://www.indailysa.com.au/citymag/food-drink/2024/05/21/bitter-brew-cbd-coffee-spot-to-close-doors) | E |
| `d00_world_event_snowmelt_counter_damage` | deep | D00 | `closureDays` +2; `cash` -3,000 | 1,2,3 | 1 | [lehighvalleypublicmedia.org](https://www.lehighvalleypublicmedia.org/news/parkland-east-penn/a-bit-overwhelming-nowhere-coffee-co-temporarily-closed-in-emmaus-following-heavy-losses-from-water-damage/) | E |
| `d00_world_event_storefront_collision` | deep | D00 | `closureDays` +7; `cash` -2,500 | все | 1 | [kbtx.com](https://www.kbtx.com/2023/07/09/college-station-coffee-cafe-closed-after-vehicle-hits-building/) | E |
| `garden_complaint` | deep | D10 | `seats` ×0.7 | 5,6,7,8,9 | 6 | [dnainfo.com](https://www.dnainfo.com/new-york/20141006/east-village/city-waited-3-decades-rule-yaffa-cafes-back-patio-illegal-manager-says) | E |
| `neighbor_noise_complaint` | deep | D02 | `fine` +3,200 | все | 1 | [nyc.gov](https://www.nyc.gov/assets/dep/downloads/pdf/air/noise/noise-code-penalty-schedule.pdf) | V |
| `no_seat_left ⇢ saturday_room_full` | deep | D14 | `demand` ×0.95 | все | 1 | [bloomintelligence.com](https://bloomintelligence.com/coffee-shop-marketing/) | E |
| `open_mic_over_capacity ⇢ d00_premises_event_capacity` | deep | D02 | `fine` +2,500 | все | 1 | [nyc-business.nyc.gov](https://nyc-business.nyc.gov/nycbusiness/description/temporary-place-of-assembly-certificate-of-operation) | E |
| `order_ahead_flood` | deep | D02 | `staffAvailability` ×0.95; `quality` -0.02 | все | 1 | [business.columbia.edu](https://business.columbia.edu/sites/default/files-efs/pubfiles/4642/deli_paper%200523_2011-%20post.pdf) | E |
| `outdoor_setup_out_of_bounds` | deep | D02 | `fine` +200; `seats` -4 | 4,5,6,7,8,9,10 | 1 | [diningoutnyc.info](https://www.diningoutnyc.info/enforcement) | E |
| `quiet_room_afternoons` | deep | D02 | `demand` ×0.98 | все | 1 | [hospitalitynet.org](https://www.hospitalitynet.org/news/4039649.html) | E |
| `restroom_line_of_passers_by` | deep | D02 | `cash` -150 если restroom open to all | все | 12 | [nyc.gov](https://www.nyc.gov/assets/doh/downloads/pdf/about/healthcode/health-code-article81.pdf) | E |
| `restroom_out_of_order` | deep | D02 | `reputation` -0.02; `fine` +300 если inspection while the only toilet is out ; `cash` -250 | все | 1 | [nyc.gov](https://www.nyc.gov/assets/doh/downloads/pdf/about/healthcode/health-code-article81.pdf) | E |
| `roadway_cafes_go_year_round` | deep | D02 | `roadwayMonthsActive` =12; `monthlyFees` ×1.2 | 9 | 12 | [portal.311.nyc.gov](https://portal.311.nyc.gov/article/?kanumber=KA-03604) | V |
| `storefront_glass_broken` | deep | D02 | `cash` -1,150; `closureDays` +1 | все | 1 | [insightglass.com](https://www.insightglass.com/how-much-do-storefront-windows-cost/) | E |
| `tight_tables_reviews` | deep | D02 | `reputation` -0.03 | все | 3 | [hospitalitynet.org](https://www.hospitalitynet.org/news/4039649.html) | E |
| `cafe_fees_by_quarter` | exotic | D02 | `cashTiming` =quarterly | 5 | 12 | [thecityreporter.nyc](https://www.thecityreporter.nyc/2026/08/13/nyc-outdoor-dining-roadside-sheds-new-laws-restaraunts/) | E |
| `d00_premises_public_landlord_use` | exotic | D00 | `leaseAvailable` =False если wet use not allowed | все | 0 | [nyc.gov](https://www.nyc.gov/site/nycha/business/store-leasing.page) | E |
| `line_on_the_neighbors_stoop` | exotic | D02 | `inspections` ×1.2 | 4,5,6,9,10,11,12 | 1 | [business.columbia.edu](https://business.columbia.edu/sites/default/files-efs/pubfiles/4642/deli_paper%200523_2011-%20post.pdf) | E |
| `restroom_occupied_for_an_hour` | exotic | D02 | `staffAvailability` ×0.98; `quality` -0.01 | все | 1 | [nyc.gov](https://www.nyc.gov/assets/doh/downloads/pdf/about/healthcode/health-code-article81.pdf) | E |
| `roll_down_gate_deadline` | exotic | D02 | `cash` +0 | 7 | 0 | [ny1.com](https://ny1.com/nyc/all-boroughs/news/2026/07/02/city-council-votes-to-repeal-deadline-for-new-roll-down-security-gates) | E |
| `vestibule_must_come_down` | exotic | D02 | `inspections` ×1.1 если left up | 4 | 1 | [portal.311.nyc.gov](https://portal.311.nyc.gov/article/?kanumber=KA-02227) | E |

## Приложение Б. Что не откалибровано и почему

Среди отобранных событий темы таких нет: все 190 отобранных и 5 новых получили числа. Ниже — соседние события из тех же каталогов, которые я сознательно оставил другим темам, чтобы не дублировать:

| Событие | Из | Кому | Причина |
|---|---|---|---|
| cloudburst_floods_cellar, grease_backup, ac_fails_in_heat_wave | D02 | D16 / D18 | поломки оборудования и ливни: погода и техника, а не помещение |
| backflow_notice, backflow_penalty_bill | D02 | D19 | ежегодная проверка и штрафы DEP; установку устройства (`d00_premises_backflow_install`) я откалибровал |
| dim_bar_at_inspection, candles_without_a_permit | D02 | D19 | санитарная и пожарная проверка |
| snowfall_overnight, freeze_after_snow, dsny_snow_sweep, slip_claim_letter, blizzard_travel_ban, wet_floor_inside, insurance_renewal_after_claim | D14 | D18 / D19 | зима у входа и иски — темы погоды и закона |
| first_graded_inspection, vending_enforcement_sweep, market_inspector_walks_the_stalls, milk_drinks_change_the_cart_class | D01 | D19 | проверки и их последствия |
| machine_tariff | D01 | D16 | цена оборудования |
| d00_premises_inspector_arrives, ombuds_not_appeal, platform_allergy, poster_languages, dog_papers, dinein_safety, renewal_docs | D00 | D19 | проверки, плакаты, продление разрешения |
| d00_premises_pfe_service_scope, pfe_tag, pest_record, pest_door_gap, delivery_pests | D00 | D16 / D19 | обслуживание огнетушителей и дезинсекция |
| d00_premises_personal_playlist, live_music_license, biometric_camera, wine_layout, alcohol_passed, outdoor_floor, outdoor_heater, penny_change | D00 | D17 / D19 | лицензии на музыку, алкоголь, касса |
| shed_goes_up, shed_idle_months, shed_comes_down, demolition_next_door, corner_lot_double_duty, street_dig | D07 / D10 | D18 | улица и стройки рядом; я калибровал только `d00_street_hidden_sign` как эффект на вывеску |

