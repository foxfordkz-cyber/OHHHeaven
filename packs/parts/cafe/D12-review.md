| Пакет | Число | Значение | Итог | Что найдено |
|---|---|---|---|---|
| cafe | `startCapital` | 224000 | kept | Совпадает с итогом extra.openingBudget «almostReady». Внешние опоры (через поиск, вторичные): калькуляторы дают для Нью-Йорка $150–561 тыс., для Манхэттена «обычно больше $250 тыс.» за 800–1 200 кв. футов. Первоисточника нет. |
| cafe | `unit.refPrice / cogsPerUnit` | 8.5 / 2.21 | kept | Публичной статистики среднего чека нет (искал). Входные цены проверены: кофе $9.25/фунт, молоко $4.10/галлон (FRED, октябрь 2026), стакан 4.6¢. |
| cafe | `market.unitsPerSlotMonth / priceElasticity / weights` | 6000 / -1.3 | not_found | Игровые значения. Эластичность спроса на кофе в кофейне в первоисточниках не найдена; это часть задания 80 (codex), часть A. |
| cafe | `capacity.unitsPerStaffMonth` | 1700 | not_found | Измерений «заказов на бариста в час» в первоисточниках нет; 10.6 заказа на оплаченный час — расчёт заметок. |
| cafe | `sizing (18 sq ft на место, 170 заказов на место, 60% навынос)` | 18 / 170 / 0.6 | not_found | Норма площади на место для общепита в NYC — в Строительном кодексе (occupant load 15 net sq ft на место за столами), но nyc.gov недоступен; правило «20 мест — гостевой туалет» осталось с первого прохода. |
| cafe | `setup[security_deposit]` | 18000 | kept | Справочник аренды SBS (nyc.gov) недоступен; три месяца — решение заметок, путеводитель говорит «обычно два». |
| cafe | `setup[buildout] + extra.buildout.classes` | 87.5 / 225 / 400 за кв. фут | kept | Опора через поиск: медиана открытия во «втором поколении» помещения ~$73 за кв. фут против ~$193 в новом (национальный опрос, вторичный); сайт подрядчика alphacontractorsny вне сети сессии. Сроки 60/90/180 дней — оценка. |
| cafe | `setup[architect_expediter]` | 7000 | kept | 10% от ремонта — правило заметок, тарифа нет. |
| cafe | `setup[lease_lawyer]` | 3500 | kept | Проверено: SBS даёт бесплатную помощь по договору аренды (NYC Business, открыто). Гонорар $3 500 — оценка заметок. |
| cafe | `setup[grinder] / [decaf_grinder]` | 2099 → 3099 | corrected | E65S снята с производства, нет в наличии; E65W $3 099 (Visions Espresso, открыто). |
| cafe | `setup[water_filtration]` | 500 | not_found | Seattle Coffee Gear вне сети сессии; цены картриджа $192.94 и головы $41.94 не перепроверены. |
| cafe | `setup[refrigeration]` | 2628 | kept | Avantco A-19R-HC $1 199 подтверждён; Atosa MGF8401GR $1 429 не найден на WebstaurantStore (поиск дал только запчасти). |
| cafe | `setup[sinks]` | 1720 → 1519 | corrected | Раковина на три отделения $649, для рук $82.99–89.99, мойка для швабр $234–350 (WebstaurantStore, открыто). |
| cafe | `setup[prep_table_shelving]` | 600 | not_found | Нет списка размеров; оценка заметок. |
| cafe | `setup[pos]` | 1299 | kept | squareup.com отвечает 429; через поиск Square Register $799–899 (NerdWallet и др., вторичные). |
| cafe | `setup[smallwares]` | 2000 | not_found | Корзина без списка; оценка заметок. |
| cafe | `setup[safety_kit]` | 800 | kept | Подтверждено правило: маска для взрослого, детская маска, две пары перчаток (NYC Business, открыто). Сумма — оценка. |
| cafe | `setup[equipment_delivery_tax]` | 3500 | kept | Ставка 8.875% подтверждена (Pub 718); $25 000 оборудования и доставка — расчёт заметок. |
| cafe | `setup[opening_inventory]` | 3000 | kept | Стаканы $45.99 за 1 000 подтверждены; остальное — корзина заметок. |
| cafe | `setup[hiring_training]` | 4000 | kept | При ставке $18: 190 ч × $18 = $3 420 + объявления; $4 000 оставлено. |
| cafe | `setup[insurance_utility_deposits]` | 1500 | kept | Insureon $126 BOP подтверждён; депозиты Con Edison не открывались. |
| cafe | `setup[batch_brewer]` | 1780 | kept | Bunn CWTF15-APS $980 подтверждён (WebstaurantStore); $800 на гриндер и термосы — оценка. |
| cafe | `setup[ice_machine]` | 3500 | not_found | oswaltsupply вне сети; на WebstaurantStore Manitowoc UYF0140A не найден. |
| cafe | `setup[decor_lighting]` | 2000 | not_found | Оценка заметок. |
| cafe | `setup[signage]` | 1500 | kept | Подтверждено правило DOB: вывеска, прикрученная к зданию или с подсветкой, требует одобрения DOB (NYC Business, открыто). Цена — оценка. |
| cafe | `setup[customer_restroom]` | 12000 | not_found | Цены переделки туалета под ADA в первоисточниках нет. |
| cafe | `monthlyCosts[rent]` | 6000 | kept | $90 за кв. фут на боковой улице Бруклина — оценка; страница REBNY рендерится скриптом, цифры коридоров не получены. Через поиск: C&W Q2 2026 Flatiron $306, SoHo $393; Q3 2026 средняя по Манхэттену $730 (первый этаж). |
| cafe | `monthlyCosts[utilities]` | 1100 | kept | NYSERDA отвечает 403. FRED (BLS): электричество для жителей NYC 25–29¢/кВт·ч в 2024 году — выше 23.1¢ штата для бизнеса, поэтому электричество может быть на ~15–20% дороже заметок. |
| cafe | `monthlyCosts[insurance]` | 250 | kept | Insureon: BOP $126, общая ответственность $82 (открыто). $250 — резерв NYC. |
| cafe | `monthlyCosts[supplies]` | 0.17 | kept | Стакан 4.6¢ подтверждён; 2% от продаж — модель заметок. |
| cafe | `monthlyCosts[card_fees] / [card_fixed_fee]` | 0.0255 / 0.135 | kept | Ставки Square подтверждены (2.5% + 15¢ на Plus); доля карт 90% и чаевые $2 000 — допущения. |
| cafe | `monthlyCosts[tips_payroll_tax]` | 0.003 | kept | Правило IRS о чаевых как зарплате — Pub 15 (открыта); сумма чаевых — допущение. |
| cafe | `monthlyCosts[sick_leave_cover]` | 70 → 60 | corrected | Пересчёт от ставки $18. |
| cafe | `monthlyCosts[maintenance]` | 300 | not_found | Полоса $200–500 из заметок. |
| cafe | `monthlyCosts[waste]` | 250 | not_found | Предельные цены перевозчиков по зонам (CWZ) есть только в калькуляторе DSNY на nyc.gov — недоступен. |
| cafe | `monthlyCosts[internet]` | 100 | not_found | verizon.com вне сети. |
| cafe | `monthlyCosts[pos_software]` | 49 | kept | Square Plus $49 в месяц за точку — через поиск (несколько источников); squareup.com 429. |
| cafe | `monthlyCosts[accounting]` | 400 | not_found | Публичного прайса бухгалтера в NYC нет. |
| cafe | `monthlyCosts[payroll_service]` | 85 | kept | Gusto Simple $49 + $6 за человека с 1 марта 2026 (через поиск; gusto.com 403). |
| cafe | `monthlyCosts[marketing]` | 300 | not_found | Бюджет-выбор заметок. |
| cafe | `monthlyCosts[permit_renewals]` | 50 | kept | FSE $280 в год и LLC $25 в год подтверждены. |
| cafe | `staff[barista].hourlyWage` | 21 → 18 | corrected | NY DOL OEWS Q1 2026, NYC, 35-3023: медиана $17.57, средняя $18.90 с чаевыми. |
| cafe | `staff[shift_lead].hourlyWage` | 24 | verified | NY DOL OEWS Q1 2026, NYC, 35-1012: медиана $24.07. |
| cafe | `manager.monthlySalary` | 4800 | kept | $30 × 160 ч. Опоры NY DOL: бригадир — средняя $26.04/ч, управляющий заведением (11-9051) — медиана $44.94/ч. $30 — между ними. |
| cafe | `events[coffee_price_spike]` | 1.05 | kept | Ряды FRED подтверждены; добавлен сигнал — арабика IMF +16.7% за месяц (июнь→июль 2026). |
| cafe | `events[milk_price_up]` | 1.03 | kept | Ряды FRED подтверждены. |
| cafe | `events[restaurant_week]` | 1.05 | kept | Даты 19.01–11.02.2027 и цены $30/45/60 подтверждены; эффект для кофейни не измерен. |
| cafe | `events[sidewalk_shed]` | 0.9 × 3 мес → 0.93 × 6 мес | corrected | Исследование города и Mastercard 2024: −3.5…−9.7% транзакций у ресторанов за шесть месяцев. |
| cafe | `events[summer_power_peak]` | 1.08 | not_found | NYSERDA 403; цифры 22.3¢ и 24.2¢ остаются из заметок. |
| cafe | `events[flu_season]` | 0.92 | not_found | Доли невыходов работников общепита в сезон гриппа в первоисточниках не нашёл. |
| cafe | `benchmarks` | 0.28 / 0.35 / 0.10 / 0.04 | kept | NRA открыт: прибыль до налогов 4.0%, prime cost 65%, аренда 6.0% (город, limited service). 0.28 и 0.10 — модель заметок. |
| cafe | `extra.rentByTier` | 326 / 90 / 45 | kept | Q3 2026 C&W ($326 Flatiron, $409 SoHo) не открыт — сервер C&W вне сети; через поиск Q2 2026: $306 и $393 — порядок совпадает. |
| cafe | `extra.referenceMonth` | wages 13 440 | kept | Нужно пересчитать после смены ставки бариста: 4 × 160 × $18 = $11 520 (−$1 920 в месяц), налоги работодателя −$222. Это делает ведущий (движок). |
| cafe | `extra.footfall (captureRate и др.)` | 0.088 … | not_found | Задание 80 (codex), часть A; в D12 не повторял. |
| cafe | `extra.takeover.multipleOfAnnualSales` | 0.2 → 0.4 | corrected | BizBuySell (через поиск): медиана проданной кофейни 0.41 выручки, 2.2 прибыли владельца. |
| cafe | `levers (5) и shortcuts (8) кафе` | — | kept | У каждого числа теперь source, confidence и расчёт в note; hours.long пересчитан $2 300 → $2 000. |
| _common | `taxes[ny_unemployment]` | 0.0179 | kept | 4.1% и $17 600 подтверждены; эффективная доля зависит от зарплаты (2.09% при $18). |
| _common | `taxes[futa]` | 0.001 | verified | Подтверждено и на 2026 год: Нью-Йорка нет в списке сниженного кредита. |
| _common | `taxes[workers_comp]` | 0.02 | not_found | Ставка для ресторанного кода NY не найдена; общий уровень −21.9% с 1.10.2026. |
| _common | `taxes[disability_pfl]` | 0.0004 | kept | NYSIF $17.68 и минимум $60 в год; PFL 0.432%/$411.91 — подтверждены. |
| _common | `taxes[self_employment_tax]` | 0.1413 | kept | 15.3% × 92.35% — арифметика формы SE. |
| _common | `taxes[income_tax]` | 0.17 | kept | Сводная ставка-оценка; не налоговая консультация. |
| _common | `taxes[nyc_ubt]` | 0 | kept | nyc.gov недоступен; порог $3 400 остаётся с первого прохода. |
| _common | `violations[off_books_payroll] / [misclassification]` | 2.0 / 1.5 × saved | kept | Формулы-оценки; WCB Fair Play: до $2 500 за неверно оформленного работника (это для строительства, к кафе не применимо). |
| _common | `violations[no_i9]` | 1160 → 1152; 11600 → 11444 | corrected | 28 CFR 85.5 (eCFR, открыто). |
| _common | `violations[returns_not_filed]` | 525 + 450/мес | kept | $525 подтверждён на irs.gov; формула — оценка. |
| _common | `shortcuts (12)` | — | kept | У каждого числа теперь source, confidence и расчёт в note. |
| _common | `extra.employerCostExample` | — | kept | Арифметика от проверенных ставок. |
