# D03 — Оборудование, поломки, обслуживание (кафе)

Исследователь D03, 14 ноября 2026. Фрагмент пакета: `packs/parts/cafe/D03-equipment.json`.

## 1. Вердикт

1. В пакете оборудование покупалось один раз и жило вечно: поле `lifespanMonths` есть, но движок его не читает, поломок нет, а всё обслуживание лежало одной строкой $300. Теперь у каждого предмета есть срок жизни с уходом и без, цена нового, подержанного и в лизинг, и то, что именно в нём ломается.
2. Поломка привязана к решению игрока, а не к кубику: 27 событий наступают в месяц, когда истекает срок пропущенного ухода, 20 событий объявляются заранее (отключения света, воды, кассы, жара).
3. Сбои вне оборудования закрыты настоящими правилами: правило двух часов для холодных продуктов, 12 часов для возмещения от Con Edison, 72 часа по закону штата, 72 часа на выгрузку карточных платежей без интернета.
4. Слабое место — проверка чисел. Страницы целиком открыть не удалось, работал только поиск; `verified` стоит только там, где поиск вернул дословную цитату со страницы первоисточника. Таких чисел 19 из 44 в разделах `setup`, `monthlyCosts`, `violations`.
5. Не найдено главное для механики: статистики «через сколько месяцев ломается» не публикует никто. Сроки в каталоге событий — игровые правила, выведенные из интервалов обслуживания производителей; это помечено в каждой записи.

При слиянии фрагмента с `packs/cafe.json` проверка `validate-pack.mjs` даёт 0 ошибок и 0 предупреждений.

## 2. Что добавлено

| Раздел | Записей | Из них |
|---|---|---|
| `setup` | 28 | 18 новых, 10 исправлений; `lifespanMonths` есть у 26 |
| `monthlyCosts` | 8 | 7 новых и 1 исправление; ещё 7 условных строк в `extra.conditionalMonthlyCosts` |
| `levers` | 8 | все новые |
| `shortcuts` | 7 | 6 ведут к новым нарушениям, 1 — к существующему `spoiled_food` |
| `violations` | 8 | все новые |
| `officials` | 5 | 3 новых (пожарный, строительный, шумовой инспектор), 2 исправления |
| `reports` | 4 | все новые |
| `events` | 6 | объявляемые, на полях, которые движок уже понимает |
| `ruleCards` | 29 | все новые, каждая до 280 знаков |
| `roadmap` | 8 | все новые |
| `suppliers` | 8 | все новые |
| `extra.eventCatalog` | 47 | core 21, deep 22, exotic 4; по масштабу: точка 28, квартал 10, город 5, страна 3, мир 1 |
| `extra.mechanics` | 8 | core 5, deep 3 |
| `extra.equipment` | 15 | таблица «новое / б/у / лизинг / срок / уход / что ломается» |
| `extra.nonObvious` | 38 | с причиной и источником |
| `sources` | 110 | |

**Оборудование (`setup`).** Новые предметы: подержанная кофемашина ($6 500, гарантия 3 месяца против 12–13 у новой), подержанные холодильники, восстановленная кофемолка, сертифицированная установка кофемашины, блендер, диспенсер кипятка, морозильник, конвекционная печь, пресс для панини, микроволновка, скоростная печь без вытяжки ($10 540), кран для колд-брю, датчики температуры, второй платёжный терминал, замена кондиционера ($8 500) и водонагревателя ($3 300), проверка весов для продажи зерна на вес. Все новые предметы — `required: false`, наборы `kits` менять не нужно.

**Расходы (`monthlyCosts`).** Одна строка $300 разложена на восемь: мелкий ремонт $45, откачка жироуловителя $75, вызовы мастеров $189, проверка обратного клапана $38, бирки огнетушителей $13, жернова $0,0026 с заказа, химия для кофемашины $24, бой посуды $83. Профилактика и фильтры ушли в рычаги.

**Рычаги.** Уход за кофемашиной; вода для кофемашины; холодильники и льдогенератор; кондиционер; контроль температуры; резервный интернет; страховка от поломок; лёд (своя машина или аренда). Откуда взята цена каждого варианта — в `extra.leverCostSources`, потому что у вариантов рычага в формате нет поля источника.

**Срезанные углы.** Оставить молоко после тёплой ночи; не проверять обратный клапан; не обновлять бирки огнетушителей; подключить оборудование руками разнорабочего; держать умирающий холодильник; работать без горячей воды; слить льдогенератор в ведро.

**Каталог событий.** Кофемашина, кофемолка и вода — 11, холод и лёд — 6, сантехника — 5, кондиционер и отопление — 4, электричество — 6, вода и газ — 4, касса и интернет — 5, остальное (взломы, тараканы, обжарщик, распродажа, субсидия, налоговый вычет) — 6. У каждого события есть ход игрока; ссылки на рычаги, срезанные углы, предметы и шаги плана проверены скриптом.

## 3. Пятнадцать самых неочевидных находок

1. **Срок жизни фильтра зависит от адреса.** Вода в городе в среднем 1,8 грана жёсткости на галлон, но там, где подмешивают воду Кротона, доходит до 7. Картридж рассчитан на 5 300 гран, а не на месяцы: на мягкой воде его хватает на пять месяцев, на жёсткой — на пять-шесть недель.
2. **Гарантия на новую кофемашину может не действовать с первого дня.** Она снимается, если машину ставил не сертифицированный мастер или нет водоподготовки; накипь исключена всегда.
3. **Шестичасовое отключение света не даёт ничего.** Con Edison платит бизнесу за испорченный товар (до $12 900) только после 12 часов и только при отказе своей сети. Среднее отключение в подземной сети — 6,7 часа, а продукты нужно выбросить через 2.
4. **О собственном отключении света владелец обязан сам сообщить в департамент здоровья** — немедленно, по статье 81.43 санитарного кодекса.
5. **Карты без интернета — риск продавца.** Платежи нужно выгрузить за 72 часа; если карту потом отклонят или бариста выйдет из учётной записи до восстановления связи, деньги пропали.
6. **Подключение без разрешения стоит от $6 000, даже если всё разобрать.** Штраф — 21 сбор за разрешение, не меньше $6 000 и не больше $15 000.
7. **Сгоревший компрессор означает новый холодильник.** Замена компрессора — $1 800–$2 800, а сам шкаф стоит $1 199.
8. **В жару электричество не только пропадает, но и слабеет.** Con Edison снижает напряжение на 8%, нагрев падает примерно на 15%. Машина на 240 В в здании с 208 В теряет четверть мощности навсегда.
9. **С каждого счёта за ремонт берётся налог с продаж 8,875%**, и с каждого лизингового платежа тоже.
10. **Кондиционер могут оштрафовать за то, как он звучит в чужой спальне.** Предел — 42 децибела в квартире соседа, штраф $220–$600.
11. **Самый частый страховой случай малого бизнеса — вода, а не пожар и не кража:** 22% всех случаев, в среднем $34 600 (The Hartford, 2020–2024).
12. **Часть счёта за электричество задаёт самый загруженный момент месяца.** На тарифе для нагрузки примерно от 10 кВт плата за пиковую мощность доходит до $36,50 за кВт летом.
13. **«Бесплатная» машина от обжарщика оплачена ценой зерна.** Условие — обычно 20–40 фунтов кофе в неделю. В Италии, где это норма, суд взыскал штраф с бара за недобор 144 кг в месяц.
14. **При продаже оборудование стоит 10–30% цены покупки.** Покупатель на той же распродаже экономит 30–70%. На кофемолке подержанная покупка экономит всего 9%.
15. **После утечки газа здание остаётся без газа месяцами.** Нью-йоркские рестораны ждали от двух до семи месяцев; кафе без газовых приборов это не касается.

## 4. Исправления существующего пакета

- `espresso_machine`: срок 96 → 120 месяцев при обслуживании и 72 без него. Исправляю, потому что прежняя цифра была оценкой без источника; новая опирается на заявление сервисной компании (5–7 лет без ухода, 10–15 с уходом). Это тоже оценка.
- `refrigeration`, `pastry_case`: 96 → 120 месяцев (типичный срок, принятый Министерством энергетики США, в пересказе отраслевой прессы); без ухода 72.
- `ice_machine`: 84 → 102 месяца (7–10 лет у дилеров); без чистки 54.
- `dishwasher`: 96 → 90 месяцев (5–10 лет при обслуживании).
- `grinder`, `decaf_grinder`: срок не менял, источника не нашёл. Добавил изнашиваемую часть: жернова на 800 кг за $149,99, при 6 000 заказов в месяц — замена раз в 9–10 месяцев. Вторая кофемолка описана как запасная.
- `water_filtration`: в примечании было «картриджи меняют несколько раз в год». Исправляю, потому что ресурс задан в гранах жёсткости и зависит от адреса.
- `pos`: цена Square Register $899 теперь подтверждена цитатой со страницы Square.
- `safety_kit`: добавлены правила FDNY о ежегодной бирке и ежемесячном осмотре.
- `maintenance`: $300 → $45, остальное вынесено в отдельные строки. Сумма всех строк обслуживания выросла с $300 до примерно $483 в месяц, плюс $124 вариантов рычагов по умолчанию. Исправляю, потому что $300 не покрывали вызовы мастеров, а они в среднем стоят $754 каждый.
- `officials.health_inspector`: в `checks` добавлены четыре новых нарушения. `officials.dep_inspector`: переименован в Water and sewer inspector, добавлена проверка обратного клапана.

Следствие для ведущего: `extra.referenceMonth` нужно пересчитать — постоянные расходы эталонного месяца вырастут примерно на $307.

Пять записей `setup` с пометкой `verified` (кофемашина, кофемолки, витрина, посудомойка) унаследовали её от автора пакета: цены я не перепроверял, менял только срок и примечание.

## 5. Просьбы к ведущему

Механики по важности (описаны в `extra.mechanics`):

1. **`equipment_condition_and_failure`** — износ и поломки. Нужны возраст предмета, счётчик месяцев без ухода, поля `lifespanNeglectedMonths`, `warrantyMonths`. Без этого рычаги ухода ничего не меняют.
2. **`downtime_redundancy_and_response`** — простой. Потерянные продажи = дневная выручка × доля заказов, которым нужен сломанный предмет, × дни. Запасная кофемолка или второй терминал обнуляют долю; договор обслуживания сокращает дни с трёх до одного.
3. **`outage_spoilage_and_claims`** — отключения, порча продуктов, заявки на возмещение.
4. **`buy_new_used_lease_or_loan`** — четыре способа получить машину: новая, подержанная, лизинг, программа обжарщика.
5. **`cost_lines_that_depend_on_what_you_own`** — движок сейчас списывает каждую строку `monthlyCosts` со всех. Нужны поля `requiresSetupItem` и `appliesIf`. Поэтому семь условных строк (лизинговый платёж, аренда льдогенератора и посудомойки, лёд в пакетах и другие) я положил в `extra.conditionalMonthlyCosts`, а не в `monthlyCosts`: при слепом слиянии они завысили бы расходы всем.
6. **`water_zone_by_address`** — жёсткость воды как свойство адреса.
7. **`inherited_equipment_age`** — возраст оборудования, доставшегося с помещением.
8. **`replacement_and_tax_life`** — строка износа в аналитике ($348 в месяц для стандартного набора), вычет по Section 179, цена при продаже.

Чего не хватает в формате:

- У вариантов рычага и у срезанных углов нет полей `source`, `confidence`, `note`. Источники лежат в `extra.leverCostSources` и `extra.shortcutNotes`.
- События движка понимают шесть целей: `demand`, `footTraffic`, `staffAvailability`, `cogs`, `rent`, `utilities`. В каталоге использованы ещё `capacity`, `quality`, `reputation`, а также поля `oneTimeCost` и `downtimeDays`. В шести событиях раздела `events` я обошёлся существующими целями.
- В `playerMoves` добавлены виды `setup`, `roadmap` и `action`, кроме `lever` и `shortcut` из образца.
- У каждого события каталога есть поле `cause`: `announced` или `decision` с условием срабатывания.

Допущения, которые должны заменить другие исследователи (`extra.assumptions`): доля заказов, которым нужна кофемашина (65%), доля напитков со льдом летом (50%), расход воды через машины (20 галлонов в день), число вызовов мастера в год (3). Первые два — зона D04 и D06.

Пересечения: электрика и вентиляция — D02; жара и затопления — D07; проверки FDNY, DEP, DOB — D08; страховки, лизинг, налоговый вычет — D09; унаследованное оборудование при покупке бизнеса — D01.

## 6. Не найдено

- Статистика времени до отказа кофемашин, кофемолок, кофеварок и касс. Сроки в каталоге — игровые правила.
- Число вызовов мастера в год для маленького кафе: есть только цена одного вызова.
- Нью-йоркские цены на проверку обратного клапана, договор обслуживания кофемашины и холодильников, замену витринного стекла, ремонт рольставен, доставку льда. Использованы цены из других городов или диапазоны с пометкой.
- Тарифы Con Edison за киловатт-час для малого бизнеса на 2026 год и точный порог перехода на тариф с платой за мощность.
- Суммы штрафов за общие нарушения 10B и 10E санитарного кодекса; принято $200 по аналогии с 10G.
- Действующая редакция статьи о штрафах за обратный клапан: диапазон $700–$10 000 взят из текстов законопроектов городского совета.
- Предел возмещения малому бизнесу по закону штата о долгих отключениях.
- Требуется ли в Нью-Йорке проверка котла кофемашины (в Великобритании требуется).
- Правила FDNY для баллонов азота и углекислого газа в кафе; одобрение FDNY для конкретных печей без вытяжки.
- Каким кодом инспектор записывает грязный льдогенератор; принят код 06D.
- Кто обычно платит за кондиционер по договору аренды в Нью-Йорке.
- Размер пошлин 2025–2026 годов на кофемашины и запчасти.
- Рассказы владельцев от первого лица: Reddit закрыт для поиска. Найдены пересказы в прессе и на отраслевых форумах.

Источники слабого качества, на которые опираются отдельные оценки: страницы цен на адресах `pages.dev` (ставка мастера $250 в час в Нью-Йорке, цены ремонта кофемашины, кондиционера, прочистки стоков, обслуживания огнетушителей). Они похожи на сайты для сбора заявок и помечены в примечаниях как ориентировочные.

## 7. Источники

Как проверялись числа: сеть контейнера не пускает на сайты, страницы целиком открыть не удалось, работал только поиск. `verified` — поиск вернул дословную цитату с числом со страницы первоисточника (nyc.gov, coned.com, irs.gov, свод законов, производитель, карточка товара у продавца). `estimate` — всё остальное: отраслевая пресса, гиды дилеров, моя арифметика, допущения и игровые величины. Язык поиска — английский; для сравнения использованы итальянские и русские источники (аренда кофемашины у обжарщика).

1. [Con Edison: commercial spoilage claim form (outage over 12 hours in 24, local distribution failure)](https://www.coned.com/en/services-and-outages/claim-form/commercial-spoilage-claim-form)
2. [NYC311: power outage, Con Edison claims (commercial maximum $12,900, 30 days)](https://portal.311.nyc.gov/article/?kanumber=KA-02283)
3. [NYC DEP: drinking water FAQ (hardness about 1.8 grains per gallon, up to 7 where Croton water is blended; discolored water)](https://www.nyc.gov/site/dep/water/drinking-water-frequently-asked-questions.page)
4. [NYC DEP: 2018 Drinking Water Supply and Quality Report (hardness 18-116 mg/L, average 27)](https://www.nyc.gov/assets/dep/downloads/pdf/water/drinking-water/drinking-water-supply-quality-report/2018-drinking-water-supply-quality-report.pdf)
5. [Pentair Everpure ESO 7 spec sheet (600 gallons at 150 ppm, 5,300 grains, 0.5 gpm)](https://www.pentair.com/content/dam/extranet/nam/filtration/everpure/commercial/spec-sheets/EV9607-25%20QC7I-ESO7-Spec-Sheet.pdf)
6. [24 RCNY Chapter 23, Appendix 23-B: inspection scoring parameters (codes 02G, 10B, 10E, 04J, 05F)](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-136924)
7. [24 RCNY Chapter 23, Appendix 23-C: penalty schedule (04J, 05D, 05F, 10G)](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-43593)
8. [NYC Health: notice of adoption, Chapter 23 penalty schedule, 2021 (05D text)](https://rules.cityofnewyork.us/wp-content/uploads/2021/09/Full-Text-Chapter-23-NOA_Penalty-Schedule_9-2-21-1.pdf)
9. [NYC Health Code §81.29: dishwashing and ware washing (170°F, 160°F, test kit)](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-46303)
10. [NYC Health Code §81.43: reporting emergency occurrences (fire, power outage, flood)](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-46342)
11. [NYC Health Code §81.21: hand wash sinks with hot and cold running water](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-46257)
12. [NYC Business: restaurant page (02G $250-$600, 7-28 points)](https://nyc-business.nyc.gov/nycbusiness/resources-by-industry/restaurant)
13. [NYS Department of Health: When the Power Goes Out, a guide for food operators (2-hour rule at 41°F)](https://www.health.ny.gov/publications/7082/)
14. [NYC DEP: backflow prevention FAQ (annual test, notification letter)](https://www.nyc.gov/site/dep/about/backflow-prevention-frequently-asked-questions.page)
15. [15 RCNY §20-04: backflow prevention devices (annual test by certified tester employed by a licensed master plumber)](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-129579)
16. [FDNY: Restaurant Fire Safety Guide (extinguisher tags, W-96, hood cleaning every 3 months, suppression every 6 months)](https://www.nyc.gov/assets/fdny/downloads/pdf/business/restaurant-fire-safety-guide.pdf)
17. [3 RCNY §109-03: penalty schedule for FDNY summonses (VC 1, portable fire extinguishers)](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-102214)
18. [NYC Administrative Code §28-213.1.2: penalty for work without a permit (21 times the fee, $6,000-$15,000)](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-157685)
19. [NYC DOB service notice: civil penalties for work without a permit (Local Law 156 of 2017)](https://www.nyc.gov/assets/buildings/pdf/ll156_sn.pdf)
20. [FER magazine: top 10 equipment issues in 2021 (86 Repairs data: reach-in $519.05, HVAC $1,019.90, plumbing $666.28)](https://www.fermag.com/articles/top-10-types-of-equipment-issues-in-2021)
21. [86 Repairs: State of Repairs (average 2024 service request $754.10)](https://www.86repairs.com/state-of-repairs)
22. [86 Repairs blog: average restaurant repair and maintenance costs (technician visit fee $135)](https://blog.86repairs.com/average-restaurant-repair-and-maintenance-costs)
23. [FER magazine: assessing ice machines (average repair $708.41 in 2021)](https://www.fermag.com/articles/assessing-ice-machines/)
24. [IRS Publication 946: Section 179 limit $2,560,000 for 2026, 100% special depreciation after January 19, 2025](https://www.irs.gov/publications/p946)
25. [IRS Chief Counsel memo: asset class 57.0, 5-year recovery, 9-year class life](https://www.irs.gov/pub/irs-wd/1404001.pdf)
26. [Mahlkonig USA: E65S 65 mm steel burrs, about 800 kg, $149.99](https://www.mahlkoenig.us/collections/burrs/grinder-model_e65s)
27. [KL5 Coffee (New York City): on-site service $250 an hour, one-hour minimum](https://kl5-coffee.pages.dev/service)
28. [Ceremony Coffee tech services: $130 an hour, $260 emergency](https://ceremonycoffee.com/pages/tech-services)
29. [Visions Espresso: field and in-shop service $135 an hour](https://visionsespresso.com/terms-of-service/)
30. [Barista Life: espresso machine service plans ($500-$2,000+ a year)](https://baristalife.co/blogs/blog/espresso-machine-service-plans)
31. [Bean & Brew Technologies: maintenance extends machine life from 5-7 to 10-15 years (vendor claim)](https://beanandbrewtech.com/blogs/espresso-machines/espresso-machine-maintenance-guide-extending-equipment-life)
32. [Vixxo: scale is the number one cause of commercial espresso machine failure](https://www.vixxo.com/facilities-management-news/your-coffee-program-has-four-points-of-failure.-heres-how-to-manage-all-of-them)
33. [Southern California coffee repair shop: pump $220-$680, heating element $240-$520, control board $380-$550](https://socalcoffeerepair-site.pages.dev/brands/la-marzocco)
34. [Di Pacci USA: La Marzocco buyer's guide 2026 (used two-group Linea Classic $5,000-$8,000)](https://dipacciusa.com/blogs/news/la-marzocco-buyers-guide-usa)
35. [Fresh Cup: filter for warranties (water outside specification voids the warranty)](https://freshcup.com/filter-for-warranties/)
36. [Voltage Restaurant Supply: La Marzocco warranty terms](https://www.voltagerestaurantsupply.com/pages/la-marzocco-warranty)
37. [Kwipped: two-group espresso machine lease listings ($78-$248 a month)](https://www.kwipped.com/rentals/product/sanremo-zoe--2-group-compact-commercial-espresso-machine/29919)
38. [UseCalcPro: restaurant equipment financing calculator (about 11% for good credit)](https://usecalcpro.com/food/restaurant-equipment-financing-cost-calculator)
39. [My Coffee Explorer: lease vs buy coffee equipment (roaster programs: 20-40 lb a week)](https://mycoffeeexplorer.com/blog/lease-vs-buy-coffee-equipment-guide)
40. [Silver Chef Roaster Advantage (rental built into the bean price; Australia)](https://www.silverchef.com.au/roaster-advantage)
41. [NYS Tax Department Publication 750: sales tax on leases, due on each payment](https://www.tax.ny.gov/pdf/publications/sales/pub750.pdf)
42. [Square: Register $899, Terminal $299, Stand $149](https://squareup.com/us/en/hardware/register)
43. [Square help: offline payments time limits (72 hours; seller bears declined payments)](https://squareup.com/help/us/en/article/8106-offline-payments-time-limits)
44. [TechCrunch: Square day-long outage resolved (September 7-8, 2023)](https://techcrunch.com/2023/09/08/square-day-long-outage-resolved)
45. [Nation's Restaurant News: the AWS outage left many restaurants scrambling (October 20, 2025)](https://www.nrn.com/restaurant-technology/the-aws-outage-left-many-restaurants-scrambling)
46. [NY Public Service Law §73: compensation after 72 hours of a widespread prolonged outage](https://www.nysenate.gov/legislation/laws/PBS/73)
47. [Con Edison: 2025 Annual Report on Electric Service and Power Quality (network 16.6 per 1,000 and 6.70 hours)](https://jointutilitiesofny.org/sites/default/files/2025%20Annual%20Report%20on%20Electric%20Service%20and%20Power%20Quality.pdf)
48. [Bloomberg: Con Edison cut voltage 8% in parts of Brooklyn, Queens and the Bronx (August 2022)](https://www.bloomberg.com/news/articles/2022-08-08/coned-asks-brooklyn-residents-to-conserve-power-amid-high-heat)
49. [Mayor's Management Report FY2025, DEP: 552 water main breaks](https://www.nyc.gov/assets/operations/downloads/pdf/mmr2025/dep.pdf)
50. [NYC DDC: construction inconveniences (water shut-off notices 24 hours ahead)](https://www.nyc.gov/site/ddc/projects/inconveniences.page)
51. [NYC DEP: more Croton water for three weeks from October 16, 2023](https://www.nyc.gov/site/dep/news/23-039/new-york-city-increase-use-downstate-reservoir-water-three-weeks-during-preparation-for)
52. [NYC DEP: safe hydrant use to safeguard water pressure during the 2026 heat wave](https://www.nyc.gov/site/dep/news/26-018/dep-encourages-safe-hydrant-use-safeguard-water-pressure-during-historic-extreme-heatwave)
53. [ABC7: Riverdale businesses without gas for months (2024)](https://abc7ny.com/post/bronx-gas-riverdale-businesses-struggling-damaging-effects-being-gasless-several-months/15636831/)
54. [NBC New York: 60,000 Spectrum customers lose internet in Queens (2017)](https://www.nbcnewyork.com/news/local/nyc-60000-spectrum-customers-queens-lose-cable-internet-after-vandals-cut-cord/188799/)
55. [HighSpeedInternet.com: business backup internet ($30-$35 a month)](https://highspeedinternet.com/business/backup-internet-services)
56. [Con Edison: small business energy efficiency program (up to 70% of the cost)](https://www.coned.com/en/save-money/rebates-incentives-tax-credits/small-business/savings-for-your-small-medium-business)
57. [NYC311: scale inspection ($20 for scales up to 33 lb)](https://portal.311.nyc.gov/article/?kanumber=KA-02965)
58. [NYC DCWP: scale and fuel inspections](https://www.nyc.gov/site/dca/businesses/scale-inspections.page)
59. [Total Food Service (Easy Ice): total cost of commercial ice machine ownership](https://totalfood.com/the-total-cost-of-commercial-ice-machine-ownership/)
60. [KaTom: ice maker cost 2026 (rental $100-$300 a month)](https://www.katom.com/learning-center/ice-maker-cost-2026-pricing-guide.html)
61. [KaTom: how long commercial ice machines last (7-10 years)](https://www.katom.com/learning-center/how-long-do-commercial-ice-machines-last.html)
62. [Burkett: when to replace your ice machine (4-5 years)](https://www.burkett.com/blog/post/how-to-know-when-to-replace-your-ice-machine)
63. [KaTom: commercial ice machine cleaning (at least every six months)](https://www.katom.com/learning-center/commercial-ice-machine-cleaning-maintenance.html)
64. [The Restaurant Warehouse: restaurant refrigerator guide (10-15 years, 8-10 in hard use)](https://therestaurantwarehouse.com/blogs/restaurant-equipment/restaurant-refrigerator-guide)
65. [Contracting Business: DOE took 10 years as the typical life of commercial refrigeration](https://www.contractingbusiness.com/hvacrdb/article/20858457/refrigeration-the-new-commercial-standards)
66. [FE&S: cleaning and maintenance for reach-in refrigerators](https://fesmag.com/products/guide/storage-and-handling/refrigeration/20111-cleaning-and-maintenance-for-reach-in-refrigerators)
67. [KaTom: when to repair or replace commercial refrigeration (50% rule)](https://www.katom.com/learning-center/when-to-repair-vs-replace-commercial-refrigeration.html)
68. [Vitamix: The Quiet One (3-year motor base warranty)](https://www.vitamix.com/us/en_us/commercial/products/the-quiet-one)
69. [KaTom: Vitamix The Quiet One, $1,158.05](https://www.katom.com/491-36019.html)
70. [WebstaurantStore: Avantco AU-27F undercounter freezer, $1,199.00](https://www.webstaurantstore.com/avantco-au-27f-27-undercounter-freezer/178AU27F.html)
71. [WebstaurantStore: Bunn H5X hot water dispenser, $1,087.00](https://www.webstaurantstore.com/bunn-43600-0026-h5x-stainless-steel-5-gallon-212-degree-hot-water-dispenser-120v/234436000026.html)
72. [WebstaurantStore: Avantco PG100 panini grill, $179.99](https://www.webstaurantstore.com/avantco-pg100-commercial-panini-sandwich-grill-with-grooved-plates-and-8-1-2-x-8-1-2-cooking-surface-120v-1750w/177PG100.html)
73. [WebstaurantStore: Solwave 1000W commercial microwave, $235.00](https://www.webstaurantstore.com/solwave-stainless-steel-commercial-microwave-with-push-button-controls-120v-1000w/180MW1000SS.html)
74. [WebstaurantStore: Pratica Fit Express ventless high-speed oven, $10,540.33](https://www.webstaurantstore.com/pratica-fit-101-1-bo-fit-express-electric-ventless-burnt-orange-stainless-steel-high-speed-oven-208-240v-1-phase/72AFITBOH.html)
75. [WebstaurantStore: Avantco CO-16 countertop convection oven, $389.99](https://www.webstaurantstore.com/avantco-co-16-half-size-countertop-convection-oven-1-5-cu-ft-120v-1600w/177CO16.html)
76. [WebstaurantStore: Urnex Cafiza 20 oz, $9.69](https://www.webstaurantstore.com/urnex-12-esp12-20-20-oz-cafiza-espresso-machine-cleaning-powder/999ESP1220.html)
77. [Kegco: two-tap commercial cold brew dispenser, $1,637.37](https://www.kegco.com/two-tap-commercial-javarator-cold-brew-coffee-dispenser-black/)
78. [MOCREO: restaurant temperature monitoring (sensor $28.99, hub $39.99)](https://mocreo.com/?p=6688)
79. [ASHRAE equipment life expectancy chart (rooftop air conditioners 15 years)](https://www.shipleyenergy.com/wp-content/uploads/2025/09/ASHRAE_Chart_HVAC_Life_Expectancy.pdf)
80. [Facility equipment life spans (ASHRAE 2003: gas tank water heater 8-12 years)](https://csu.org/hubfs/39606065/Document%20Library/LifeSpansFacilityEquipment.pdf?hsLang=en)
81. [FE&S: maintaining warewashers (5-10 years)](https://fesmag.com/serviceinsights/19740-maintaining-warewashers)
82. [NYC HVAC contractor: 3-5 ton rooftop unit $5,000-$12,000 installed](https://fixar-html.pages.dev/commercial/rtu)
83. [HomeBlue: water heater replacement cost in New York ($2,400-$3,500)](https://www.homeblue.com/water-heater/new-york-ny-water-heater-replacement-cost.htm)
84. [Latent Insure: restaurant equipment breakdown cover ($150-$500 a year)](https://latentinsure.com/restaurant-insurance/equipment/)
85. [TAGeX Brands: used restaurant equipment sells for 10-30% of original price](https://www.tagexbrands.com/restaurant-equipment-appraisal-value/)
86. [ACCA: refrigerant prices could rise 12-24% by 2029 (EPA analysis)](https://hvac-blog.acca.org/updated-regulations-cause-a-shift-in-the-refrigerant-landscape/)
87. [Vixxo: preventing ice machine and refrigeration failures in summer](https://www.vixxo.com/facilities-management-news/how-to-prevent-commercial-ice-machine-and-refrigeration-failures-during-summer)
88. [NZ Herald: cockroaches in about 10% of serviced coffee machines](https://nzherald.co.nz/nz/club-med-for-cockroaches/YJSYFIJS43CGEZVADWJT2MM6OY)
89. [Home-Barista forum: coffee grounds down the drain ($175 plumber)](https://www.home-barista.com/knockbox/about-those-coffee-grounds-going-down-sink-drain-t79200.html)
90. [NYC drain cleaning cost guide (emergency after hours $400-$1,000)](https://handymen-nyc.pages.dev/guides/cost/drain-cleaning-costs-nyc)
91. [Clark Pest: flies and drains](https://www.clarkpest.com/commercial-service-blog/flies-and-drains-what-you-need-to-know)
92. [QNS, March 2026: burglary crew hits four Maspeth businesses in one morning](https://qns.com/2026/03/burglary-crew-maspeth-shopping-center)
93. [PAK Programs: what happens when your espresso machine breaks on a Saturday](https://pakprograms.com/blog/what-happens-when-your-espresso-machine-breaks-equipment-breakdown-coverage-for-coffee-shops/)
94. [Daily Coffee News: quarterly maintenance kits (quarterly is the bare minimum)](https://dailycoffeenews.com/2018/10/11/caffewerks-launching-espresso-machine-maintenance-kit-subscriptions)
95. [Counter Culture Coffee: wholesale partner support](https://counterculturecoffee.com/pages/partner-with-us)
96. [Italy: court decision on a bar that missed a 144 kg a month coffee commitment](https://www.doctrine.it/decisions/ittribpjt31qqkbp0fnk)
97. [Kontur (Russia): buy or rent a coffee machine](https://kontur.ru/market/spravka/47891-kupit_svou_kofemashinu_ili_vzyat_v_arendu)
98. [Climpson & Sons (UK): pressure system inspection of espresso machines](https://climpsonandsons.com/blogs/technical-guides/is-your-espresso-machines-pressure-system-compliant-why-its-crucial-for-your-business)
99. [NYC fire extinguisher service price list ($15-$25 per unit)](https://empire-fire-services.pages.dev/pricing)
100. [ExpertCE: 208V vs 240V (a 240V heater gives about 75% of its power on 208V)](https://expertce.com/learn-articles/208v-vs-240v-technical-guide/)
101. [Seattle Coffee Gear: Everpure cartridges](https://www.seattlecoffeegear.com/collections/everpure)
102. [The Hartford, December 2025: water and freezing damage 22% of small-business claims, $34,600 on average; burglary and theft 20%; fire $80,000](https://www.businesswire.com/news/home/20251209433403/en/Water-And-Freezing-Damage-Burglary-Lead-The-Hartfords-Top-Five-Small-Business-Claims)
103. [NYC DEP: guide to the Noise Code (a circulating device may not exceed 42 decibels inside a neighbor's home)](https://www.nyc.gov/assets/dep/downloads/pdf/air/noise/noise-code-guide-summary.pdf)
104. [NYS Tax Department: contractors and repair persons (repair and installation services are taxable)](https://www.tax.ny.gov/pubs_and_bulls/publications/sales/contractors.htm)
105. [1st-line Equipment: commercial espresso machine installation requirements (dedicated 20-amp and 30-amp circuits)](https://1st-line.com/customer-education/commercial-espresso-machine-basic-requirements/)
106. [Bunn brewer manual: delime at least every 3 months](https://www.manualsdir.com/manuals/48075/bunn-b10.html?page=9)
107. [Espresso Parts: refurbished Mahlkonig E65S, $1,911.65, 1-year warranty](https://www.espressoparts.com/products/refurbished-mahlkonig-e65s-espresso-grinder-white)
108. [PMQ forum: a dish machine lease quote, $150 a month with service, repairs and chemicals](https://thinktank.pmq.com/t/dishwashing-chemical-cost/7976)
109. [WebstaurantStore: lease or buy a commercial dishwasher](https://www.webstaurantstore.com/blog/4540/dishwashers-leasing-vs-buying.html)
110. [Con Edison: SC 9 Rate 1 demand delivery charges per kW (up to $36.50 in summer, $29.45 in winter)](https://www.coned.com/en/accounts-billing/your-bill/ev-phase-in-rates)
