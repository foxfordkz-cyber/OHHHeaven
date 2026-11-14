# D14 — отчёт: четыре примера пользователя как механики

Ниша: кафе, Нью-Йорк, 2026. Исследователь D14. Спецификация — `D14-mechanics-spec.md`, данные — `D14-mechanics.json`, расчёты — `D14-examples.mjs`.

## 1. Вердикт

1. Все четыре примера пользователя описаны как механики с полями пакета, изменениями типов, местом в расчёте месяца, примером на три месяца и 9–10 проверками у каждой. Объём — 32–42 часа агента.
2. Самая важная находка — ошибка движка: место за столом ограничивает и тех, кто берёт с собой. При спросе настоящих кварталов карты кафе теряет 86–187 заказов в день «из-за мест», а в жизни 0–17.
3. Месяцы до открытия сейчас дороже, чем в жизни: аренда идёт с подписания без бесплатных месяцев (−$19,658 за 3 месяца против −$4,034 при обычных для Нью-Йорка трёх бесплатных). Чтобы выбор был честным, бесплатные месяцы нужно учитывать в итоговом счёте как заём арендодателя.
4. Покупка готового кафе в keen-cray стоит вдвое дешевле настоящей (0.2 × выручки против 2.0 × заработка по сделкам 2021–2025) и оставляет 90% клиентов вместо примерно 70%. Нет налогового долга продавца, сроков сделки и учёта goodwill в счёте.
5. Зима у входа: из прогноза погоды и одного рычага выводятся штрафы DSNY ($100/$150/$250), потерянные гости и иск ($45,000 в среднем) без единой вероятности. Фрагмент вместе с пакетом проходит проверку: 0 ошибок, 0 предупреждений, и с основной веткой, и с keen-cray.

## 2. Что добавлено

| Раздел | Новых | Исправленных (тот же `id`) | Что |
|---|---|---|---|
| `setup` | 5 | 1 | `dob_alteration_permit`, `ice_melt_and_shovels`, `takeover_due_diligence`, `lease_assignment_consent`, `bulk_sale_notice`; исправлен `fse_permit` (ожидание 21 → 22 дня) |
| `kits` | 0 | 3 | в `lean`, `standard`, `premium` добавлено обязательное `dob_alteration_permit` |
| `levers` | 4 | 0 | `snow_clearing`, `entrance_mats`, `seat_density`, `laptop_policy` |
| `shortcuts` | 2 | 0 | `start_work_before_permit`, `pack_the_line_inside` |
| `violations` | 3 | 0 | `work_without_permit`, `sidewalk_snow_not_cleared`, `overcrowding` |
| `officials` | 3 | 0 | `dsny_enforcement`, `dob_inspector`, `fdny_inspector` |
| `reports` | 3 | 0 | `report_unshoveled_sidewalk`, `report_work_without_permit`, `report_overcrowding` |
| `events` | 1 | 0 | `snowstorm_month` |
| `ruleCards` | 13 | 0 | переполненный зал, снег за 4 часа, тротуар §7-210, «буря ещё идёт», бесплатная аренда, газ до аренды, §195, стройка без разрешения, уведомление о покупке, разрешение не переходит, цена кофейни, нагрузка по кодексу, место для очереди |
| `roadmap` | 8 | 0 | газ до аренды, торг за бесплатные месяцы, разрешение DOB, четыре шага покупки, подготовка к зиме |
| `extra.preOpening` | 1 блок | | варианты аренды, расходы до открытия, DOB, газ, ускорение, §195, good guy guaranty, стоимость договора в счёте |
| `extra.takeoverRules` | 1 блок | заменяет `extra.takeover` keen-cray | цена, сроки сделки, рассрочка, что переходит, goodwill |
| `extra.floorZones` | 1 блок | | зоны зала, плотность, кодекс, профиль пика, пропускная способность, терпение, очередь на улице |
| `extra.winterDoor` | 1 блок | | климат, окно уборки, варианты уборки, штрафы, проверка DSNY, порог иска, страховка |
| `extra.eventCatalog` | 19 | | все со `realSignal` и ходом игрока |
| `extra.mechanics` | 6 | | четыре основных, §195, рассрочка продавца |
| `extra.failureStories` | 8 | | настоящие случаи по трём механикам: Artisanal ($24 млн аренды), 75 Second Ave, The Clam, Delancey Street, Bocca di Bacco, перепродажа кофейни, долг продавца, Angen v De Jesus |

## 3. Неочевидные находки (18)

1. **Бесплатная аренда — это заём арендодателя.** Ставку поднимают так, чтобы за 10 лет он получил столько же: при 6 бесплатных месяцах $6,158 вместо $6,000. В сезоне из 12 месяцев остаток договора не виден, и больше бесплатных месяцев выигрывает всегда — если не учесть договор в итоговом счёте.
2. **Бесплатный период обычно начинается с подписания, а не с разрешений.** Медленное разрешение съедает бесплатные месяцы ещё до начала стройки. Опытный арендатор пишет в договор «позднее из даты и выдачи разрешений плюс 90–150 дней».
3. **Расходы до открытия — не обычный убыток.** По §195 сразу вычитается только $5,000 (и ничего, если расходов больше $55,000), остальное — по 1/180 в месяц. Движок же переносит весь убыток до открытия на будущую прибыль и занижает налог.
4. **Штраф за неубранный снег получает и арендатор.** §16-123 обязывает «владельца, арендатора, жильца». Ответственность за падение по §7-210 на владельце здания, но договор аренды почти всегда перекладывает её на арендатора.
5. **Опасен не снег, а лёд на следующее утро.** Пока буря идёт и разумное время после неё, никто не отвечает за падение. Пять часов суд счёл разумными; 12 часов после бури с заморозком — нет. Поэтому в механике снежный день даёт половину риска, а каждый ледяной день после — полный.
6. **Средний иск о падении вырос с $20,000 (2015) до $45,000 (2020–2024).** Доля таких случаев среди страховых случаев малого бизнеса удвоилась: с 10% до 20%.
7. **Строгость DSNY зависит от зимы.** После бури Fern в январе 2026 — больше 4,500 штрафов; за лёгкую зиму 2023–24 только 75 коммерческим зданиям.
8. **Разрешение на общепит не переходит к покупателю.** Попытка передать его аннулирует разрешение. Подай заявку за 22 дня до закрытия сделки — откроешься без перерыва.
9. **Бесплатная форма спасает от чужого долга.** Без формы AU-196.10 за 10 дней до оплаты неуплаченный налог с продаж продавца становится долгом покупателя.
10. **Покупка в keen-cray слишком дешёвая.** 0.2 × выручки ниже нижнего квартиля настоящих сделок (0.30). Медиана — 2.0 × заработка владельца или 0.41 × выручки, и покупатели платят 90% запрошенного.
11. **Покупатель не платит аренду, пока сделка не закрыта.** Кафе работает и платит продавец. Месяцев без выручки у покупателя почти нет — за это и платят дороже. Но около 30% клиентов уходит при смене владельца, а цену считают по заработку со всеми клиентами: покупатель переплачивает за тех, кто уйдёт.
12. **Смена вывески после покупки — худший путь.** Постоянные клиенты думают, что кафе закрылось: известность падает с 0.7 до 0.35. За 3 месяца −$178,301 кассы против −$156,584 у того, кто сохранил имя.
13. **Очередь возникает только в самые плотные четверти часа.** При 200 заказах в день и двух людях на пике очереди нет. С одним — 4 человека, 9 минут, 5 ушедших в день. Второй человек на 7–10 утра стоит $1,890 в месяц: при 200 заказах он возвращает только $860 маржи, а при 442 заказах третий человек возвращает $2,580. Совет «поставь ещё человека на пик» верен не везде.
14. **20-е место стоит больше одного стула.** На 20 местах нужен туалет на 56 кв. футов — это почти 4 места при 15 кв. футах на место. Каждое место ещё и забирает площадь у очереди: при тесной посадке очередь раньше выходит на улицу.
15. **Эспрессо-бару не нужен газ.** В опросе 2017 года у 82% ресторанов была задержка с газом — в среднем 68 дней, до года, потери около $140,000. Кафе без кухни просто обходит эту проблему, а Con Edison до подписания аренды говорит, есть ли газ по адресу и сколько стоит его провести (платна ли проверка — не нашёл).
16. **Сравнение с другими странами.** В Германии работники переходят к покупателю бизнеса по закону (BGB §613a); в Нью-Йорке нет. В России «арендные каникулы» на ремонт обычно 1–2 месяца и закон их не определяет; в Нью-Йорке 3–6 месяцев, при тяжёлом ремонте до 12.
17. **Плохая уборка хуже, чем никакая — для иска.** Без закона и договора арендатор не обязан убирать снег. Но если его работники убрали плохо и всё замёрзло, он отвечает сам (Angen v De Jesus, 2025). Поэтому вариант `staff` в игре включает соль после лопаты.
18. **Договор аренды переживает план.** Сыроварня-бистро Artisanal на Park Avenue South так и не открылась, а суд присудил арендодателю около $24 млн аренды до 2031 года. Гарантия «good guy» ограничивает личный долг владельца; полная гарантия — нет.

## 4. Исправления существующего пакета

| Что | Было | Стало | Почему |
|---|---|---|---|
| `setup.fse_permit.waitDays` | 21 | 22 | Источник самой записи: «можно открыться через 22 дня после подачи». Движок считает `readyDay = appliedDay + waitDays`, и с 21 открывает на день раньше. |
| `kits.*.items` | без разрешения DOB | `+ dob_alteration_permit` | Стройка в витрине требует разрешения Департамента зданий; пошлина $970 за ремонт на $70,000. |
| `sizing` и `maxSizeFor` | `sqft × 0.6 / 18` = 26 мест на 800 кв. футов; мощность зала `size × 170 / 30 / (1 − takeaway)` | зоны: склад 35%, бар 120, туалет 56 от 20 мест, очередь 8.5 на человека → 19 мест при 15 кв. футах; места ограничивают только тех, кто сидит | Деление на `(1 − takeaway)` переносит предел мест на вынос: стойка на 6 мест упирается в 85 заказов в день. Это правка движка (крючок ниши), данные — в `extra.floorZones`. |
| `extra.takeover` (keen-cray) | 0.2 × выручки, $80,000–$200,000, известность 0.9, аренда с подписания, 10 + 21 день | 2.0 × заработка в пределах [0.5 × замена; 0.57 × выручки], известность 0.7, закрытие через 30 дней, аренду до закрытия платит продавец | BizBuySell: медиана 2.00 к заработку, 0.41 к выручке, нижний квартиль 0.30. SBDC: около 30% клиентов уходят при смене владельца. |
| Аренда до открытия (основная ветка) | полная с подписания | бесплатные месяцы по договору (0/3/6) | Обычная практика нью-йоркских договоров под ресторан: 3–6 месяцев. |
| Налог на прибыль до открытия | убыток переносится целиком | §195: $5,000 + 1/180 в месяц | IRC §195. |
| `extra.realTimeline.preOpeningRentMonths` | 3 / 3 / 6 оплаченных месяцев | оставить как «после бесплатных месяцев», но в игре считать по договору | Бюджет исследования уже предполагает бесплатные месяцы («Rent before opening, after free rent»), а движок их не даёт. |

## 5. Просьбы к ведущему — новые механики

1. **Договор аренды в мире:** `BusinessState.lease`; `open_business.leaseOptionId`. Стоимость договора в `netWorth`: `(рынок − ставка) × оставшиеся месяцы`. Без этого выбор бесплатных месяцев тривиален.
2. **Расходы до открытия:** `PackMonthlyCost.duringSetupShare`, `EconExtra.startupCosts`, вычет §195.
3. **Срезанные углы на время, а не на деньги:** `saves.basis: 'days'` и однократные углы на этапе `setup` (`startBeforePermit`). Сейчас формат даёт только месячную экономию; в данных стоит приближение `pct_rent 0.67`.
4. **Покупка бизнеса:** `Action.buy_business`, статус `sold`, `items[].boughtDay`, правила перехода следов и долгов, рассрочка продавца через существующий `loan`.
5. **Goodwill в итоговом счёте** одинаково для всех открытых бизнесов: `0.5 × 2.0 × заработок_3мес × 4`. Без этого купленное кафе в день покупки теряет в счёте всю цену клиентов (−$29,561 против $64,076 с goodwill).
6. **Крючок `NicheHooks.serveDay`** и `DayReport.lost.queue / seats`; `StandingOrders.rushStaff`. Правило зон в `maxSizeFor` для кафе.
7. **Стоимость по погоде:** `PackLeverOption.costPerWeatherDay`, `EconExtra.winter`. Плановое дело DSNY утром после снежного дня на кварталах от 5,000 пешеходов.
8. **`EffectTarget` += `'insurance'`** — для события «страховка дороже после иска».
9. **Срезанный угол «без страховки ответственности»** — не нарушение закона, а нарушение договора аренды (арендодатель требует страховку). Нужен отдельный вид последствия: иск без страховки −$45,000. Предлагаю обсудить.
10. **Профиль пика по соседям:** у keen-cray есть `anchors` (метро, школа, вуз). Пик у метро острее (`peak15Factor` меньше), у вуза летом мягче.

## 6. Не найдено

- Страницы nyc.gov, amlegal.com, bizbuysell.com, tax.ny.gov не открывались в этой сессии; все числа с них прочитаны в выдержках поиска. Их нужно открыть и пометить `verified`.
- Текст правила 1 RCNY §102-04 целиком: формула «14 × пошлина или $5,000» прочитана в выдержке, часть про частичную работу обрезана. Форумная версия «21×, от $6,000 до $15,000» ему противоречит.
- Цена договора на уборку снега для одной витрины в Нью-Йорке. Нашлись только общенациональные $25–$75 в час и сомнительные $12,000–$30,000 за сезон для зданий Манхэттена.
- Частота падений на пешехода на ледяном тротуаре; порог иска 40,000 «ледяных проходов» — проектное значение.
- Правило ECB о том, кто ответчик по штрафу за снег у арендуемой витрины. Есть только слова представителя DSNY («скорее владельцу») и практика договоров (владелец взыскивает с арендатора).
- Штраф за сброс снега на проезжую часть (сказано только «нельзя»).
- Порядок столбцов в таблице FDNY 3 RCNY §109-03 для категории 10 (переполненный зал): $950 / $475 / $1,000 / $2,375 / $1,185 / $5,000 прочитаны по структуре таблицы, заголовки не видны.
- Точный порог второго выхода в нью-йоркском строительном кодексе для зала (49 — из модельного IBC).
- Выборка распределения продаж кофейни по часам. Есть один пример (42% с 7 до 9), непроверяемое «50–60% с 6 до 10» и посещения сетей по Placer.ai (43.1% с 5 до 11).
- Доля уходящих из уличной очереди за кофе; в мороз и без мороза.
- Исследование доли клиентов, остающихся при смене владельца: есть только оценка консультанта SBDC (уходят около 30%) и правило оценщиков (скидка 20–50%).
- Срок и плата за согласие арендодателя на переуступку договора.
- Свежие (2025–2026) сроки подключения газа Con Edison; есть только опрос 2017 года (68 дней в среднем) и случаи 2015 года.
- Доплата за налог на недвижимость в первый год маленькой витрины — по практике 0, числа нет.
- Надбавка подрядчика за ночные смены на ремонте ресторана; есть только старое общее исследование (час, выигранный сверхурочно, стоит около 300% обычной ставки) — отсюда оценка +25%.

## 7. Источники

Все проверены поиском 14 ноября 2026; прямой доступ к страницам в этой сессии закрыт.

Зима у входа
- DSNY, правила уборки снега: https://www.nyc.gov/site/dsny/what-we-do/snow-response/snow-laws.page
- NYC 311, снег на тротуаре: https://portal.311.nyc.gov/article/?kanumber=KA-01397
- 16 RCNY §19-103, таблица санитарных штрафов: https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-99532
- Admin Code §16-123 (2006): https://law.justia.com/newyork/codes/2006/new-york-city-administrative-code-new/adc016-123_16-123.html
- Показания DSNY, 27.02.2026: https://www.nyc.gov/assets/dsny/downloads/about/news/testimony/2026/dsny-oversight-hearing-testimony-022726.pdf
- Комитет Совета по санитарии, январь 2025: https://citymeetings.nyc/city-council/2025-01-22-1000-am-committee-on-sanitation-and-solid-waste-management/chapter/snow-removal-violation-statistics-for-recent-snow-seasons
- Ответственность арендатора и владельца (§7-210): https://www.newyorkappellatedigest.com/2019/10/24/pursuant-to-the-nyc-administrative-code-out-of-possession-landlords-are-responsible-for-the-removal-of-ice-and-snow-from-the-abutting-city-sidewalks-notwithstanding-an-agreement-making-the-tenant-re/
- Cruz v Heights Broadway (2023): https://nycourts.gov/reporter/3dseries/2023/2023_02612.htm
- Angen v De Jesus (2025): https://www.nycourts.gov/reporter/3dseries/2025/2025_06802.htm
- Dembele v 373-381 Park Ave S. (2020): https://www.newyorkappellatedigest.com/2020/04/09/notwithstanding-the-tenants-lease-obligation-to-keep-the-sidewalk-free-of-ice-and-snow-the-landlord-had-the-nondelegable-duty-to-keep-a-ramp-leading-to-the-sidewalk-in-a-safe-condition-in-this-slip/
- «Буря ещё идёт», 12 часов: https://www.newyorkappellatedigest.com/2017/07/19/storm-in-progress-rule-did-not-apply-storm-stopped-12-hours-before-the-slip-and-fall-2nd-dept/
- The Hartford, 2025, через Insurance Journal: https://www.insurancejournal.com/news/national/2025/12/10/850545.htm
- Avero, шторм Stella: https://averoinc.com/avero-index-snowstorm-stella-and-restaurant-sales/
- Fiserv, Winter Storm Fern, январь 2026: https://www.fiserv.com/en/insights/small-business-index-resources/winter-storm-fern-fiserv-special-report-january-2026.html
- Нормы Центрального парка: https://www.weather.gov/media/okx/Climate/CentralPark/monthlyseasonalsnowfall.pdf ; https://www.climate-zone.com/climate/united-states/new-york/new-york-central-park
- Памятка DSNY о штрафах: https://www.nyc.gov/assets/em/downloads/pdf/dsny_snow_removal_one_pager.pdf
- Кому пишут штраф (amNY): https://www.amny.com/news/nyc-snow-removal-1-16444764/
- Ледотающая смесь, WebstaurantStore: https://www.webstaurantstore.com/snow-joe-melt50eb-premium-environmentally-friendly-blend-ice-melt-with-cma-and-resealable-bag-50-lb/200MELT50EB.html
- Уборка снега, цены по стране: https://www.lawnstarter.com/blog/?p=34935 ; https://www.fridayparts.com/blog/how-much-does-snow-removal-cost-in-2025
- Коврики у входа: https://chainstoreage.com/news/reducing-slips-trips-and-falls-retail-environment-0
- Страховка кофейни: https://www.insureon.com/food-business-insurance/coffee-shops-cafes/cost ; https://www.quotesweep.com/blog/coffee-shop-insurance-cost
- Рост страховки после иска: https://www.latentinsure.com/blog/restaurant-liability-insurance-cost

Месяцы до открытия
- Бесплатная аренда на ремонт: https://www.jdsupra.com/legalnews/build-out-provisions-in-nyc-restaurant-1727571/
- Налоговые доплаты в договоре: https://www.carltonfields.com/insights/expect-focus/2017/leasing-retail-stores-in-new-york-city
- Mayor's Management Report 2025, DOB: https://www.nyc.gov/assets/operations/downloads/pdf/mmr2025/dob.pdf
- Контролёр штата о DOB, 2026: https://www.osc.ny.gov/press/releases/2026/07/dinapoli-nyc-department-buildings-meets-critical-goals-lags-lower-priority-issues
- Пошлины DOB 2026: https://www.nyc.gov/assets/buildings/pdf/26fee_updates-sn.pdf
- Приказ об остановке работ: https://www.nyc.gov/site/buildings/property-or-business-owner/stop-work-order.page
- Штраф за работу без разрешения, 1 RCNY §102-04: https://www.nyc.gov/assets/buildings/rules/1_RCNY_102-04.pdf
- Сенат штата, «Cooking without gas»: https://nysenate.gov/sites/default/files/press-release/attachment/cooking_without_gas.pdf
- amNY об опросе 2017 года: https://www.amny.com/news/gas-service-delays-burden-city-restaurants-force-layoffs-study-1-14409788
- Artisanal, $24 млн аренды: https://therealdeal.com/2018/05/02/cheese-restaurant-owes-tf-cornerstone-24m-on-387-pas-space
- 75 Second Ave: https://evgrieve.com/2022/04/owner-citys-bureaucratic-red-tape.html
- Con Edison, проверка газа до аренды: https://thenycalliance.org/news-item/Con-Edison-Gas-Service
- NBAT, открытие на 75 дней раньше: https://www.nyc.gov/office-of-the-mayor/news/327-14/de-blasio-administration-celebrates-grand-opening-2-000th-food-establishment-open-with
- Налог на коммерческую аренду, отчёт DOF 2025: https://www.nyc.gov/assets/finance/downloads/pdf/25pdf/2025-crt-report.pdf
- Good guy guaranty: https://www.metro-manhattan.com/good-guy-guaranty/
- IRC §195, CRS: https://www.everycrsreport.com/reports/IF12970.html
- Депозит Con Edison для нежилых клиентов: https://www.coned.com/-/media/files/coned/documents/accountandbilling/non-res-rights-english.pdf
- Арендные каникулы, СберБизнес: https://sberbusiness.live/kursy/urok-5-3-kak-zaklyuchit-dogovor

Покупка готового бизнеса
- BizBuySell, кофейни: https://www.bizbuysell.com/learning-center/valuation-benchmarks/coffee-shops-cafes/
- Bulk sale, NYS DTF: https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/bulk_sales.htm ; форма: https://tax.ny.gov/pdf/current_forms/st/au196_10.pdf
- Покупатель отвечает за долг продавца: https://www.aprio.com/insights-events/bulk-sales-in-new-york-how-a-purchaser-was-left-responsible-for-a-sellers-sales-tax-liability-ins-article-tax/
- Разрешение на общепит: https://nyc-business.nyc.gov/nycbusiness/description/food-service-establishment-permit
- Key money: https://commercialobserver.com/2013/08/weighing-in-on-key-money-deals/
- Клиенты после смены владельца (SBDC): https://www.startlandnews.com/2024/03/kc-small-biz-new-owners
- Рассрочка продавца в объявлении: https://www.bizquest.com/business-for-sale/well-established-coffee-house/BW2498150/
- SBA SOP 50 10 8: https://www.whitefordlaw.com/news-events/client-alert-sba-issues-sop-50-10-8-key-changes-impacting-sba-7a-lending
- Стоимость проверки: https://www.peony.ink/blog/due-diligence-cost-breakdown
- Германия, переход работников и Ablöse: https://g-wie-gastro.de/unternehmensfuehrung/10-tipps-ubernahme-einer-bestehenden-gastronomie ; https://www.mtrlegal.com/wiki/abstandszahlung/
- Россия, подводные камни покупки: https://spmag.ru/articles/pokupka-gotovogo-biznesa-podvodnye-kamni-sp

Площадь и теснота
- Площадь на место, Toast: https://pos.toasttab.com/blog/on-the-line/average-restaurant-square-footage
- Нагрузка по кодексу: https://www.nyc.gov/assets/buildings/pdf/code_notes_eatinge_drinking_establishment.pdf ; https://idighardware.com/ibc-occupant-load-estimator
- Очередь, уровень C: https://wsdot.wa.gov/publications/manuals/fulltext/M3082/410.pdf
- Напитков в час: https://www.seattlecoffeegear.com/blogs/scg-blog/drinks-per-hour
- Терпение в очереди: https://whitehutchinson.com/news/agrinews/2024/january/article102.shtml
- Уходы из видимой очереди: https://knowledge.wharton.upenn.edu/article/losing-patience-and-patients-what-makes-people-wait-in-line-or-decide-to-bail/
- Плотность и траты: https://ideas.repec.org/a/eee/jouret/v93y2017i4p541-549.html
- Ноутбуки в кафе: https://www.swinburne.edu.au/news/2023/01/Youre-about-to-see-a-growing-trend-of-laptop-workers-in-cafes-new-research-reveals-why/
- Туалет по ADA: https://archive.ada.gov/archive/NPRM2008/longdesc/plan1b.html
- Продажи по часам: https://mcpanalytics-website.pages.dev/blogs/what-we-learned-analyzing-square-stores-with-hourly-performance-analysis.html
- Посещения кофеен по часам, Placer.ai: https://www.placer.ai/anchor/articles/dutch-bros-sets-its-sights-on-the-breakfast-rush
- Штрафы FDNY, 3 RCNY §109-03: https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-102214
- Один выход для зала до 49 человек (BCNYS 2020, форум): https://www.thebuildingcodeforum.com/forum/threads/single-exits-2020-bcnys-sec-1006-3.36998/latest
