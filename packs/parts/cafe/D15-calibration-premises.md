# D15 — калибровка событий: помещение, ремонт, вход в бизнес, аренда (кафе, Нью-Йорк, 2026)

Исследователь D15. Данные: `packs/parts/cafe/D15-calibration-premises.json`. Дата проверки ссылок — 14 ноября 2026.

**Ограничение сессии.** Прямые запросы к nyc.gov, ny.gov, sla.ny.gov и большинству сайтов блокировались прокси сессии. Все числа взяты через веб-поиск, который показывает выдержку со страницы. Пометка `verified` стоит только там, где число видно в выдержке с первоисточника (страницы DOB, DOF, Налоговой штата, NYC Business, BizBuySell, таблица штрафов за шум). Всё остальное — `estimate` с расчётом в `note`. Если D12 или D11 откроют страницы напрямую, начинать перепроверку стоит с чисел с пометкой `verified`.

## 1. Вердикт в пяти строках

1. Откалибровано **206 событий темы**, в том числе **все 92 события уровня core**. Минимум задания был 60. Охвачены D00, D01, D02, D08, D09, D10, D13 и D14.
2. Каждое событие получило `effects`, `months`, `durationMonths`, условие срабатывания (`trigger`), пример в долларах на эталонном кафе и ходы игрока с ценой и результатом. Бесплатных ходов нет: у хода с нулевой ценой в деньгах есть поле `price` с ценой в днях, спросе, местах или риске.
3. Главная денежная ось темы — **время до открытия**. День задержки до открытия стоит $230 (аренда $200 и накладные расходы $30). День закрытия работающего кафе стоит $1 258 валовой маржи плюс аренда. Через эти две цены выражены почти все события ремонта, разрешений и коммуникаций.
4. Исправлено 11 событий. Три противоречия между фрагментами сведены к одной модели: продление аренды (×2, ×1,5 и ×1,25 → центральный случай ×1,3), счёт за налог на недвижимость (×1,02, ×1,3 и +$60 → +$60 в месяц или разовые $1 800), потеря постоянных гостей при смене названия (×0,5 → ×0,7). Одно событие устарело: требование «прозрачных» роллет отменено 30 июня 2026 года.
5. Что не удалось: четыре события отданы другим темам (D16, D18, D19). Нет современной статистики сроков подключения газа (последние опросы — 2015 и 2017 годов) и статистики роста аренды при продлении. Найдены позже и уже внесены в события: бесплатная аренда на время ремонта ресторана — обычно 3–6 месяцев; штраф арендодателю за преследование — $10 000–50 000 за помещение (закон 2019 года). Суммы штрафов FDNY за выход и по Air Code за запах найдены, но подписи колонок в таблицах не видны.

## 2. Что сделано

| Что | Сколько |
|---|---|
| Откалиброванные события | 206: core 92 · deep 94 · exotic 20 |
| Статус | новые числа — 90 (у D00 и D14 их не было) · подтверждены, добавлены месяцы, длительность и цена ходов — 105 · исправлены — 11 |
| По фрагментам | D00 — 79 · D01 — 56 · D02 — 41 · D14 — 12 · D08 — 6 · D13 — 5 · D10 — 4 · D09 — 3 |
| Достоверность | verified — 16 · estimate — 190 |
| Ходы игрока | у каждого хода есть `cost` (`usd`, `usdMonthly`, `days`) и `result`; ходы с нулевой ценой в деньгах несут `price` |
| Механики в `extra.mechanics` | 6: реестр полей эффектов; разовые суммы вместо множителя аренды; единая модель продления аренды; события от состояния игрока; часы до открытия; кластеры повторов для D11 |
| Не откалибровано (с причиной) | `extra.notCalibrated` — 4 события и 2 группы, отданные D16, D17, D18 и D19 |
| Источники | 180 разных ссылок в полях `source` и `supportingSources` |

**Эталонное кафе** для примеров `cashExampleUSD`: среднее по цене помещение в 800 кв. футов, аренда $6 000 в месяц (`packs/cafe.json`), выручка $51 000 в месяц, себестоимость 26%, лёгкий ремонт $70 000 (фрагмент D01).

**Проверки.** Все `id` существуют в своих фрагментах. У каждого события есть `months` и хотя бы один ход. Множители спроса и расходов лежат в границах 0,7–1,3. Исключение — пять событий с полем `outOfBoundsReason`, где источник даёт больше: удержание помещения после конца аренды (×1,5), инвестиции во франшизу (×2,05), закрытый сезон рынка (×0), закрытие на 180 дней при отключении газа и вариант продления «горячий квартал» (×2 — только как объявляемый вариант).

## 3. Исправления существующих событий

| Фрагмент | Событие | Было | Стало | Почему |
|---|---|---|---|---|
| D10 | `lease_renewal_offer` | аренда ×2 | ×1,3 (центральный случай); ×2 — только как объявляемый вариант «горячий квартал» | ×2 — нижняя граница отдельных историй (Sippy Cafe), а не типичное значение; статистики продлений нет; запрашиваемые аренды на торговых улицах Манхэттена выросли на 3% за год (CBRE, I кв. 2026) |
| D08 | `lease_renewal_reset` | аренда ×1,5 | ×1,3 | одна модель продления для D08, D10 и D01 |
| D10 | `tax_escalation_bill` | аренда ×1,3 на месяц | разовый платёж $1 800 | размер тот же (2,5% годовой аренды), но множитель аренды движок применил бы ко всем следующим месяцам |
| D08 | `tax_escalation_bill` | аренда ×1,02 ($120 в месяц) | +$60 в месяц | расчёт по ставке Class 4 и росту налогооблагаемой стоимости на 4,7% даёт $56 в месяц; совпадает с D01 |
| D01 | `franchise_royalty_bite` | выручка ×0,915 | расход 8,5% выручки (`fees`, `pct_revenue`) | роялти — это расход, а не падение спроса |
| D14 | `rebrand_loses_regulars` | спрос ×0,5 | ×0,7 | D01 даёт 0,63 постоянных гостей при смене названия против 0,9 при тихой передаче: отношение 0,7 |
| D13 | `commissary_rent_hike` | ×1,33 | ×1,25 | в границах 0,7–1,3 без источника |
| D01 | `asbestos_found` | +$5 600 к ремонту | +$9 800 | обследование ACP-5 стоит $400–1 500, удаление — $5–20 за кв. фут; D01 брал $6 за кв. фут, ниже наблюдаемого диапазона |
| D10 | `gas_red_tag` | закрытие на 6 месяцев | 180 дней, только если на газе готовка и горячая вода; 3 дня, если на газе только водонагреватель | электрическое кафе не должно закрываться на полгода |
| D02 | `accessibility_suit_wave` | только флаг нарушения | $10 000 гонорара адвокату истца + пандус $6 500, если барьер остался | в найденных нью-йоркских мировых соглашениях с ресторанами — $10 000 гонорара и пандус; пандус стоил $3 000–10 000 по материалам суда (S.D.N.Y.) |
| D02 | `roll_down_gate_deadline` | −$6 500 за новую решётку | без эффекта | Совет отменил требование «прозрачных» роллет (Intro 910-A, 51:0, 30 июня 2026 года) за день до срока 1 июля 2026 года |

Ещё одно уточнение без изменения чисел. В `stop_work_order_served` (D01) правило «21 × сбор за разрешение, минимум $6 000» на страницах DOB не нашлось. DOB называет $6 000 за первое и $12 000 за повторное нарушение запрета работ, поэтому $6 000 оставлено и привязано к этому правилу.

## 4. Просьбы к ведущему (из `extra.mechanics`)

1. **Реестр полей эффектов** (`d15_effect_field_registry`). Нужны поля:
   - сроки: `openingDelayDays`, `closureDays`, `closingDelayDays`, `permitWaitDays`, `leaseSigningDelayDays`;
   - деньги: `buildoutCost`, `setupCost`, `cash`, `depositMonths`, `fees`, `salePrice`, `askingPrice`, `rentFormula`;
   - зал: `seats`, `seatTurns`;
   - аренда и гости: `exitLiability`, `awareness`;
   - проверки: `violation`, `violationExposure`;
   - прочее: `milestone`.

   Без них движок не может применить события входа и ремонта.
2. **Часы до открытия** (`d15_preopening_clock`). День открытия = дата подписания аренды + сумма `openingDelayDays`. Аренда начинается с подписания, с передачи помещения или с разрешения — по выбранному пункту договора — за вычетом бесплатных месяцев. День задержки стоит $230 до открытия и $1 458 после открытия.
3. **Единая модель продления аренды** (`d15_lease_renewal_model`):
   - без опциона на продление: ×1,3, объявляется за 6 месяцев;
   - с записанным опционом: ×1,03;
   - удержание после конца аренды: ×1,5.
4. **События от состояния игрока** (`d15_state_triggered_consequences`). Поле `trigger` у каждого события называет условие срабатывания. Объявление за месяц — там, где в жизни бывает уведомление: письмо о продлении, счёт за налог, отключение газа в здании.
5. **Разовые суммы — через `cash`**, не множителем аренды (`d15_one_off_vs_monthly`).
6. **Кластеры повторов** (`d15_duplicate_clusters`). 14 групп «одно явление — несколько `id`». Внутри группы числа уже совпадают, D11 оставляет одно событие на группу. Особо: `tax_escalation_bill` есть в трёх фрагментах под одним `id`, а `vending_enforcement_sweep` в D01 и D13 означает разное.

## 5. Не откалибровано и почему

| Событие | Фрагмент | Причина |
|---|---|---|
| `machine_tariff` | D01 | цена оборудования — тема D16 |
| `market_inspector_walks_the_stalls` | D01 | проверка и штраф — тема D19 |
| `first_graded_inspection` | D01 | санитарная оценка буквой — тема D19 |
| `d00_world_event_business_park_access` | D00 | дорожные работы и подъезд к кафе — тема D18 |
| 16 событий D00 из группы `premises_law` (`inspector_arrives`, `poster_languages`, `penny_change`, `dog_papers`, `ombuds_not_appeal`, `platform_allergy`, `pfe_service_scope`, `pfe_tag`, `personal_playlist`, `live_music_license`, `medical_restroom`, `delivery_pests`, `pest_record`, `dinein_safety`, `alcohol_passed`, `biometric_camera`) | D00 | по содержанию это проверки, обязательные таблички, лицензии и платежи; оставлены D19 и D17, чтобы одно событие не калибровали дважды |
| `frozen_pipe`, `flash_flood_warning`, `sewer_backup`, `sidewalk_violation_notice`, `door_draft_tables` | D07 | погода — тема D18; затопление подвала со стороны помещения откалибровано здесь через D02 `cloudburst_floods_cellar` |

## 6. Не найдено

- Сроки подключения газа Con Edison новее опросов 2015–2017 годов. По опросу 2015 года 69% ресторанов ждали газ не меньше 30 дней, по опросу 2017 года среднее ожидание — 68 дней. Общего срока от заявки до подачи электричества в источниках нет: есть только «около недели до ответа» и «около 20 дней на проверку мощности» в пилоте HPD.
- Статистика роста аренды при продлении для кафе и магазинов Нью-Йорка: нашлись только отдельные истории и рост запрашиваемых аренд.
- Точные подписи колонок в таблицах штрафов FDNY (группа VC 9 «выходы») и Air Code (24-141, запах). Суммы найдены — $950 / $475 / $1 000 и $400 / $620 / $1 000 — и уже стоят в событиях `d00_premises_exit_storage` и `d00_premises_odor_home`. Но соответствие колонок я вывел из порядка чисел, поэтому пометка `estimate`. Таблица Air Code датирована 2010 годом.
- Цена доработки системы пожаротушения под вытяжкой и ремонта выхлопа от запаха — в данных стоят мои оценки ($2 500 и $8 000).
- Фактические сроки изменения разрешения на использование помещения (amended CO) — оценка 90 дней.

## 7. Главные источники

- **Стройка и разрешения.**
  - DOB: [запрет работ](https://www.nyc.gov/site/buildings/property-or-business-owner/stop-work-order.page), [письмо «без возражений»](https://www.nyc.gov/site/buildings/property-or-business-owner/letter-of-no-objection-or-completion.page), [временное разрешение на использование](https://www.nyc.gov/site/buildings/property-or-business-owner/temporary-certificate-of-occupancy.page), [асбест](https://www.nyc.gov/site/buildings/dob/project-requirements-asbestos.page).
  - Стоимость письма «без возражений» — $130 ([Fontan Architecture](https://fontanarchitecture.com/?p=12518)).
  - Дорожание отделки — [Cushman & Wakefield, III кв. 2026](https://www.cushmanwakefield.com/en/united-states/insights/us-marketbeats/new-york-city-area-marketbeats/manhattan-retail).
- **Налоги.**
  - Налог на коммерческую аренду: [страница DOF](https://nyc.gov/site/finance/business/business-commercial-rent-tax-crt.page) и [инструкция CR-A 2025-26](https://www.nyc.gov/assets/finance/downloads/pdf/commercial_rent/cr-a-instructions-2025-26.pdf).
  - Ставка налога на недвижимость Class 4 — [Rosenberg & Estis](https://www.rosenbergestis.com/media/blog/nyc-property-tax/new-york-city-property-tax-levy-and-provisional-rates-for-fiscal-year-2027-final-rates-could-still-change); даты счетов — [NYC311](https://portal.311.nyc.gov/article/?kanumber=KA-01252).
  - Покупка бизнеса и уведомление налоговой штата — [TB-ST-70](https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/bulk_sales.htm); штраф $50 за опоздание с нулевой декларацией — [инструкция ST-100](https://www.tax.ny.gov/pdf/2020/st/st100i_220.pdf).
- **Аренда и покупка бизнеса.**
  - [Справочник SBS по коммерческой аренде](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf).
  - [Закон о преследовании арендаторов](https://intro.nyc/local-laws/2019-185) (Local Law 185 of 2019: $10 000–50 000 за помещение).
  - Бесплатная аренда на время ремонта ресторана, 3–6 месяцев — [JD Supra, Davidoff Hutcher & Citron](https://www.jdsupra.com/legalnews/build-out-provisions-in-nyc-restaurant-1727571/).
  - Удержание помещения после конца аренды — [The Habitat Group](https://www.thehabitatgroup.com/articles/9654-require-tenants-to-pay-maximum-premium-rent-for-long-holdovers).
  - Цены продажи кофеен — [BizBuySell](https://www.bizbuysell.com/learning-center/valuation-benchmarks/coffee-shops-cafes/).
- **Коммуникации.**
  - Газ: [доклад сената штата](https://nysenate.gov/sites/default/files/press-release/attachment/cooking_without_gas.pdf), [разрешение на газовое оборудование](https://nyc-business.nyc.gov/nycbusiness/description/gas-authorizationrestaurant-equipment).
  - Con Edison: [FAQ по подключению](https://www.coned.com/en/small-medium-size-businesses/building-project-center/faq), [депозит](https://www.coned.com/-/media/files/coned/documents/accountandbilling/non-res-rights-english.pdf).
  - Защита от обратного тока воды — [R&P](https://randpc.com/ask/mep/backflow).
- **Помещение и соседи.**
  - Доступность: [Стандарты ADA 2010](https://www.ada.gov/law-and-regs/design-standards/2010-stds/), [мировое соглашение E.D.N.Y.](https://www.adatitleiii.com/wp-content/uploads/sites/25/2025/02/2-NATOSHA-DUNSTON-Plaintiff-v-243-DEKALB-AVE-LLC-and-243-DEKALB-AVE-REST-CORP_-003.pdf), [цена пандуса S.D.N.Y.](https://law.justia.com/cases/federal/district-courts/new-york/nysdce/1:2010cv07592/369172/53).
  - Штрафы за шум — [таблица штрафов](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-30850).
  - Запах: [таблица штрафов Air Code](https://www.nyc.gov/html/ecb/downloads/pdf/AirCodePenaltySchedule.pdf), [OATH](https://www.nyc.gov/assets/oath/downloads/pdf/oath-ecb-boardmeeting-12082022.pdf).
  - Выходы — [таблица штрафов FDNY](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-102214).
  - Отмена закона о роллетах — [News 12, 3 июля 2026](https://brooklyn.news12.com/2026/07/03/see-through-security-gate-requirement-repealed-for-businesses-as-part-of-city-budget/MkkqJRrsd0jocdLjctpIt).

Полный перечень источников — в полях `source` и `supportingSources` каждого события JSON.

## 8. Таблица «событие → эффект → источник»

Колонки: фрагмент, уровень, статус (new — числа поставлены впервые, confirmed — подтверждены, revised — исправлены), событие, эффект, месяцы и длительность, пример в долларах на эталонном кафе, источник и достоверность (v — verified, e — estimate). Цены ходов игрока — в JSON.

| Фрагмент | Уровень | Статус | Событие | Эффект | Месяцы; длительность | Пример, $ | Источник |
|---|---|---|---|---|---|---|---|
| D00 | core | new | `d00_closures_nyc_event_building_repair_limbo` | closureDays +60 | круглый год; 2 мес. | −87,480 | [ny.eater.com](https://ny.eater.com/2024/2/2/24053684/nyc-restaurant-closings-february-2024) e |
| D00 | core | new | `d00_labor_finance_crt_review` | taxFiling = CRT returns; cash −$500 | круглый год; 12 мес. | −500 | [nyc.gov](https://nyc.gov/site/finance/business/business-commercial-rent-tax-crt.page) v |
| D00 | core | new | `d00_labor_finance_zero_sales_return` | cash −$50 | круглый год; 3 мес. | −50 | [tax.ny.gov](https://www.tax.ny.gov/pdf/2020/st/st100i_220.pdf) v |
| D00 | core | new | `d00_premises_ac_neighbor` | cash −$220 | круглый год; 3 мес. | −220 | [codelibrary.amlegal.com](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-30850) v |
| D00 | core | new | `d00_premises_access_route` | violationExposure → accessibility_barrier | круглый год; 1 мес. | 0 | [ada.gov](https://www.ada.gov/law-and-regs/design-standards/2010-stds/) e |
| D00 | core | new | `d00_premises_asbestos_scope` | openingDelayDays +21; buildoutCost +$9,800 | круглый год; 1 мес. | −14,630 | [nyc.gov](https://www.nyc.gov/site/buildings/dob/project-requirements-asbestos.page) e |
| D00 | core | new | `d00_premises_backflow_install` | setupCost +$7,350; openingDelayDays +30 | круглый год; 2 мес. | −14,250 | [randpc.com](https://randpc.com/ask/mep/backflow) e |
| D00 | core | new | `d00_premises_bid_after_lease` | buildoutCost ×1.15 | круглый год; 1 мес. | −10,500 | [reddit.com](https://www.reddit.com/r/smallbusiness/comments/owga47/hitting_an_early_financial_roadblock_who_gave_up/) e |
| D00 | core | new | `d00_premises_design_changes` | buildoutCost ×1.1; openingDelayDays +14 | круглый год; 1 мес. | −10,220 | [reddit.com](https://www.reddit.com/r/coffeeshopowners/comments/18gcjik/coffee_shop_build_out/) e |
| D00 | core | new | `d00_premises_early_stock` | cash −$500; openingDelayDays +7 | круглый год; 1 мес. | −2,110 | [nyc.gov](https://www.nyc.gov/site/sbs/businesses/food-establishment-form.page) e |
| D00 | core | new | `d00_premises_entrance_step` | violationExposure → accessibility_barrier; demand ×0.99 | круглый год; 1 мес. | −4,529 | [ada.gov](https://www.ada.gov/resources/title-iii-primer/) e |
| D00 | core | new | `d00_premises_exemption_scope` | cash −$1,250; openingDelayDays +21 | круглый год; 1 мес. | −6,080 | [home4.nyc.gov](https://home4.nyc.gov/site/buildings/property-or-business-owner/project-requirements-owner-storefronts.page) e |
| D00 | core | new | `d00_premises_exit_storage` | violationExposure → blocked_egress; cash −$950 (если FDNY finds the blocked route) | круглый год; 1 мес. | −950 | [codelibrary.amlegal.com](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-102214) e |
| D00 | core | new | `d00_premises_gas_sequence` | openingDelayDays +68 | круглый год; 3 мес. | −15,640 | [nyc-business.nyc.gov](https://nyc-business.nyc.gov/nycbusiness/description/gas-authorizationrestaurant-equipment) e |
| D00 | core | new | `d00_premises_guaranty_scope` | exitLiability = remaining_lease_rent | круглый год; 1 мес. | −576,000 | [nyc.gov](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf) e |
| D00 | core | new | `d00_premises_hood_rearrange` | setupCost +$2,500 | круглый год; 1 мес. | −2,500 | [nyc-business.nyc.gov](https://nyc-business.nyc.gov/nycbusiness/description/rangehood-fire-suppression-systems) e |
| D00 | core | new | `d00_premises_landlord_access` | closureDays +14; cash −$5,000 | круглый год; 1 мес. | −25,412 | [intro.nyc](https://intro.nyc/local-laws/2019-185) e |
| D00 | core | new | `d00_premises_landlord_permit` | openingDelayDays +30 | круглый год; 1 мес. | −6,900 | [codelibrary.amlegal.com](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-42543) e |
| D00 | core | new | `d00_premises_landmark_repaint` | openingDelayDays +15; setupCost +$95 | круглый год; 1 мес. | −3,545 | [nyc.gov](https://www.nyc.gov/site/lpc/applications/storefronts.page) e |
| D00 | core | new | `d00_premises_landmark_terrace` | openingDelayDays +21 | 4,5,6,7,8,9,10; 1 мес. | −1,071 | [nyc.gov](https://www.nyc.gov/site/lpc/applications/storefronts.page) e |
| D00 | core | new | `d00_premises_lease_court` | cash −$10,000; quality −0.01 | круглый год; 6 мес. | −10,000 | [portal.311.nyc.gov](https://portal.311.nyc.gov/article/?kanumber=KA-01277) e |
| D00 | core | new | `d00_premises_lease_rent_start` | rent ×1.0 | круглый год; 3 мес. | −6,600 | [jdsupra.com](https://www.jdsupra.com/legalnews/build-out-provisions-in-nyc-restaurant-1727571/) e |
| D00 | core | new | `d00_premises_lpc_incomplete` | openingDelayDays +21 | круглый год; 1 мес. | −4,830 | [nyc.gov](https://www.nyc.gov/site/lpc/applications/lpc-business-express.page) e |
| D00 | core | new | `d00_premises_meter_not_live` | openingDelayDays +14 | круглый год; 1 мес. | −3,220 | [coned.com](https://www.coned.com/en/small-medium-size-businesses/gas-and-electric-service-update-guide) e |
| D00 | core | new | `d00_premises_odor_home` | cash −$400; inspections ×1.2 | круглый год; 2 мес. | −8,400 | [nyc.gov](https://www.nyc.gov/html/ecb/downloads/pdf/AirCodePenaltySchedule.pdf) e |
| D00 | core | new | `d00_premises_old_legal_use` | openingDelayDays +30; setupCost +$2,630 | круглый год; 1 мес. | −9,530 | [nyc.gov](https://www.nyc.gov/site/buildings/property-or-business-owner/letter-of-no-objection-or-completion.page) v |
| D00 | core | new | `d00_premises_permit_transfer` | closureDays +22 | круглый год; 1 мес. | −27,676 | [tax.ny.gov](https://www.tax.ny.gov/bus/doingbus/buy.htm) e |
| D00 | core | new | `d00_premises_pest_door_gap` | inspections ×1.1; violationExposure → pest_activity | круглый год; 1 мес. | −150 | [codelibrary.amlegal.com](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-46269) e |
| D00 | core | new | `d00_premises_prepermit_fail` | openingDelayDays +14; setupCost +$2,000 | круглый год; 1 мес. | −5,220 | [nyc-business.nyc.gov](https://nyc-business.nyc.gov/nycbusiness/description/food-service-establishment-permit) e |
| D00 | core | new | `d00_premises_renewal_docs` | permitWaitDays +14 | круглый год; 1 мес. | −280 | [nyc-business.nyc.gov](https://nyc-business.nyc.gov/nycbusiness/description/food-service-establishment-permit) e |
| D00 | core | new | `d00_premises_seller_tax_claim` | closingDelayDays +90 | круглый год; 3 мес. | −18,000 | [tax.ny.gov](https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/bulk_sales.htm) v |
| D00 | core | new | `d00_premises_sign_relief_scope` | cash −$1,250 | круглый год; 1 мес. | −1,250 | [nyc.gov](https://www.nyc.gov/site/buildings/safety/sign.page) e |
| D00 | core | new | `d00_premises_signoffs_missing` | openingDelayDays +30 | круглый год; 1 мес. | −6,900 | [nyc.gov](https://www.nyc.gov/site/buildings/property-or-business-owner/letter-of-no-objection-or-completion.page) e |
| D00 | core | new | `d00_premises_surrender_clawback` | cash −$38,000 | круглый год; 1 мес. | −38,000 | [nyc.gov](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf) e |
| D00 | core | new | `d00_premises_swo_partial` | openingDelayDays +21 | круглый год; 1 мес. | −4,830 | [nyc.gov](https://www.nyc.gov/site/buildings/property-or-business-owner/stop-work-order.page) v |
| D00 | core | new | `d00_premises_swo_rescission` | openingDelayDays +10 | круглый год; 1 мес. | −2,300 | [nyc.gov](https://www.nyc.gov/site/buildings/property-or-business-owner/stop-work-order.page) v |
| D00 | core | new | `d00_premises_takeover_asset_list` | setupCost +$10,000 | круглый год; 1 мес. | −10,000 | [robinpzander.com](https://robinpzander.com/lessons-learned-building-and-selling-robins-cafe/) e |
| D00 | core | new | `d00_premises_temporary_occupancy` | setupCost +$130; openingDelayDays +0 | круглый год; 3 мес. | −2,630 | [nyc.gov](https://www.nyc.gov/site/buildings/property-or-business-owner/temporary-certificate-of-occupancy.page) v |
| D00 | core | new | `d00_premises_toilet_route` | setupCost +$8,000; openingDelayDays +14 | круглый год; 1 мес. | −11,220 | [codelibrary.amlegal.com](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-46264) e |
| D00 | core | new | `d00_premises_use_mismatch` | openingDelayDays +90; setupCost +$7,500 | круглый год; 3 мес. | −28,200 | [nyc-business.nyc.gov](https://nyc-business.nyc.gov/nycbusiness/description/certificate-of-occupancy) e |
| D00 | core | new | `d00_premises_utility_deposit` | cash −$1,600; openingDelayDays +7 | круглый год; 1 мес. | −3,210 | [coned.com](https://www.coned.com/en/small-medium-size-businesses/building-project-center/faq) e |
| D00 | core | new | `d00_premises_utility_extra` | setupCost +$5,000 | круглый год; 1 мес. | −5,000 | [coned.com](https://www.coned.com/en/small-medium-size-businesses/building-project-center/faq) e |
| D01 | core | confirmed | `annual_rent_step` | rent ×1.03 | круглый год; 12 мес. | −2,160 | [metro-manhattan.com](https://www.metro-manhattan.com/blog/rentescalations) e |
| D01 | core | revised | `asbestos_found` | openingDelayDays +21; buildoutCost +$9,800 | круглый год; 1 мес. | −14,630 | [nyc-business.nyc.gov](https://nyc-business.nyc.gov/nycbusiness/description/asbestos-rules-and-regulations) e |
| D01 | core | confirmed | `assignment_consent_price` | rent ×1.1; depositMonths +2 | круглый год; 12 мес. | −19,200 | [itkowitz.com](https://itkowitz.com/?p=505) e |
| D01 | core | confirmed | `certificate_of_occupancy_mismatch` | openingDelayDays +30 | круглый год; 1 мес. | −6,900 | [nyc-business.nyc.gov](https://nyc-business.nyc.gov/nycbusiness/resources-by-industry/restaurant) e |
| D01 | core | confirmed | `change_orders_pile_up` | buildoutCost ×1.2; openingDelayDays +21 | круглый год; 2 мес. | −18,830 | [blueberrybuilders.com](https://blueberrybuilders.com/resources/cost-overruns-in-construction/) e |
| D01 | core | confirmed | `electrical_service_too_small` | openingDelayDays +28; buildoutCost +$9,000 | круглый год; 1 мес. | −15,440 | [coned.com](https://www.coned.com/en/small-medium-size-businesses/gas-and-electric-service-update-guide) e |
| D01 | core | confirmed | `first_timer_turned_away` | depositMonths +3 | круглый год; 1 мес. | −18,000 | [entrepreneur.com](https://www.entrepreneur.com/growth-strategies/no-one-would-rent-me-a-cafe-in-trendy-nyc-neighborhoods/438828) e |
| D01 | core | revised | `franchise_royalty_bite` | fees 8.5% выручки | круглый год; 12 мес. | −52,020 | [franchise.gregoryscoffee.com](https://franchise.gregoryscoffee.com/) e |
| D01 | core | confirmed | `free_rent_runs_out` | rent ×1.0 | круглый год; 2 мес. | −6,600 | [jdsupra.com](https://www.jdsupra.com/legalnews/build-out-provisions-in-nyc-restaurant-1727571/) e |
| D01 | core | confirmed | `gas_turn_on_wait` | openingDelayDays +68 | круглый год; 3 мес. | −15,640 | [nysenate.gov](https://nysenate.gov/sites/default/files/press-release/attachment/cooking_without_gas.pdf) e |
| D01 | core | confirmed | `hidden_conditions` | buildoutCost ×1.12; openingDelayDays +14 | круглый год; 1 мес. | −11,620 | [blueberrybuilders.com](https://blueberrybuilders.com/resources/cost-overruns-in-construction/) e |
| D01 | core | confirmed | `landlord_late_delivery` | openingDelayDays +60 | круглый год; 2 мес. | −13,800 | [itkowitz.com](https://itkowitz.com/?p=4676) e |
| D01 | core | confirmed | `market_season_ends` | demand ×0 | 11,12,1,2,3; 5 мес. | 0 | [6sqft.com](https://www.6sqft.com/smorgasburg-returns-for-16th-year-this-april-with-new-vendors/) e |
| D01 | core | confirmed | `overstated_cash_sales` | demand ×0.8 | круглый год; 12 мес. | −46,600 | [blog.bizben.com](https://blog.bizben.com/how-to-buy-a-coffee-shop-5-red-flags-you-must-avoid/) e |
| D01 | core | confirmed | `permit_gap_at_closing` | closureDays +22 | круглый год; 1 мес. | −27,676 | [codelibrary.amlegal.com](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-44016) e |
| D01 | core | confirmed | `plan_examiner_objections` | openingDelayDays +21 | круглый год; 1 мес. | −4,830 | [osc.ny.gov](https://www.osc.ny.gov/press/releases/2026/07/dinapoli-nyc-department-buildings-meets-critical-goals-lags-lower-priority-issues) e |
| D01 | core | confirmed | `regulars_test_new_owner` | awareness ×0.7 | круглый год; 3 мес. | −11,322 | [blog.bizben.com](https://blog.bizben.com/how-to-buy-a-coffee-shop-5-red-flags-you-must-avoid/) e |
| D01 | core | confirmed | `sellers_tax_claim` | closingDelayDays +90 | круглый год; 3 мес. | −18,000 | [tax.ny.gov](https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/bulk_sales.htm) v |
| D01 | core | confirmed | `sellers_tax_debt_inherited` | cash −$30,000 | круглый год; 1 мес. | −30,000 | [totalfood.com](https://totalfood.com/buying-a-restaurant-watch-out-for-the-sellers-sales-tax-liabilities/) e |
| D01 | core | confirmed | `stop_work_order_served` | openingDelayDays +45; cash −$6,000 | круглый год; 2 мес. | −16,350 | [nyc.gov](https://www.nyc.gov/site/buildings/safety/swo.page) e |
| D01 | core | confirmed | `supervisory_licenses_released` | cartPermitWaitMonths −12 | 7; 1 мес. | 0 | [portal.311.nyc.gov](https://portal.311.nyc.gov/article/?kanumber=KA-03354) e |
| D01 | core | confirmed | `vending_enforcement_sweep` | cash −$1,000; closureDays +7 | круглый год; 1 мес. | −1,000 | [documentedny.com](https://documentedny.com/2026/03/06/street-vendors-criminal-summons-crackdowns-mamdani/) e |
| D02 | core | confirmed | `ac_fails_in_heat_wave` | demand ×0.9; cash −$15,000 (если the unit has to be replaced) | 7,8; 1 мес. | −18,774 | [vincomechanical.com](https://www.vincomechanical.com/hvac-replacement-cost-nyc) e |
| D02 | core | revised | `accessibility_suit_wave` | cash −$10,000 (если an entrance step or route barrier remains); setupCost +$6,500 (если barrier remains) | круглый год; 2 мес. | −16,500 | [adatitleiii.com](https://www.adatitleiii.com/wp-content/uploads/sites/25/2025/02/2-NATOSHA-DUNSTON-Plaintiff-v-243-DEKALB-AVE-LLC-and-243-DEKALB-AVE-REST-CORP_-003.pdf) e |
| D02 | core | confirmed | `breaker_trips_at_peak` | staffAvailability ×0.95 | круглый год; 1 мес. | −1,887 | [1st-line.com](https://www.1st-line.com/customer-education/commercial-espresso-machine-basic-requirements/) e |
| D02 | core | confirmed | `cloudburst_floods_cellar` | cash −$1,500; closureDays +2 | 7,8,9; 1 мес. | −4,016 | [portal.311.nyc.gov](https://portal.311.nyc.gov/article/?kanumber=KA-02997) e |
| D02 | core | confirmed | `grease_backup` | closureDays +1; violation → grease_interceptor_neglect | круглый год; 1 мес. | −1,258 | [nyc.gov](https://www.nyc.gov/site/dep/water/disposing-of-grease-as-a-business.page) e |
| D02 | core | confirmed | `laptop_camp` | seatTurns ×0.85 | 1,2,3,10,11,12; 1 мес. | −260 | [bloomintelligence.com](https://bloomintelligence.com/coffee-shop-marketing/) e |
| D02 | core | confirmed | `morning_line_out_the_door` | demand ×0.95 | круглый год; 1 мес. | −1,887 | [pubsonline.informs.org](https://pubsonline.informs.org/doi/abs/10.1287/mnsc.1120.1686) e |
| D02 | core | confirmed | `saturday_room_full` | demand ×0.95; quality −0.03 | круглый год; 1 мес. | −472 | [npr.org](https://www.npr.org/blogs/alltechconsidered/2014/04/10/300518819/no-laptops-no-wi-fi-how-one-cafe-fired-up-sales) e |
| D02 | core | confirmed | `seat_count_at_inspection` | violation → no_patron_toilet | круглый год; 1 мес. | −300 | [nyc.gov](https://www.nyc.gov/site/doh/business/food-operators/operating-a-restaurant.page) e |
| D02 | core | confirmed | `service_upgrade_wait` | openingDelayDays +84 | круглый год; 3 мес. | −19,320 | [triumphelectricinc.com](https://triumphelectricinc.com/con-edison-service-upgrade-guide-powering-your-nyc-property-in-2026/) e |
| D02 | core | confirmed | `sidewalk_cafe_season` | seats +10; demand ×1.03 | 4,5,6,7,8,9,10; 7 мес. | +7,925 | [diningoutnyc.info](https://www.diningoutnyc.info/apply/fees) e |
| D02 | core | confirmed | `solo_guests_hold_big_tables` | seats ×0.75 | круглый год; 1 мес. | 0 | [yahoo.com](https://www.yahoo.com/lifestyle/heres-exactly-long-sit-coffee-070007503.html) e |
| D02 | core | confirmed | `winter_draft_at_the_door` | seats ×0.9; quality −0.02 | 12,1,2; 3 мес. | −128 | [achrnews.com](https://achrnews.com/articles/159663-michigan-eatery-eliminates-cold-complaints-with-air-curtains) e |
| D08 | core | confirmed | `rent_default_notice` | cash −$1,500 | круглый год; 4 мес. | −1,500 | [legalservicesnyc.org](https://www.legalservicesnyc.org/resources/how-can-i-fight-a-commercial-eviction/) e |
| D08 | core | confirmed | `rent_step_anniversary` | rent ×1.03 | круглый год; 12 мес. | −2,160 | [metro-manhattan.com](https://www.metro-manhattan.com/blog/rentescalations) e |
| D09 | core | confirmed | `landlord_blocks_the_sale` | salePrice ×0.5 | круглый год; 2 мес. |  | [metro-manhattan.com](https://www.metro-manhattan.com/subleasing-assignment/) e |
| D10 | core | revised | `gas_red_tag` | closureDays +180 (если cooking and hot water depend on gas); closureDays +3 (если only the water heater is gas) | круглый год; 6 мес. | −262,440 | [brooklynpaper.com](https://www.brooklynpaper.com/two-sheepshead-bay-businesses-closed-for-months-after-nearby-gas-leak) e |
| D10 | core | revised | `lease_renewal_offer` | rent ×1.3 | круглый год; 12 мес. | −21,600 | [greenpointers.com](https://greenpointers.com/2025/08/21/greenpoint-coffee-shop-sippy-cafe-will-close-this-october/) e |
| D10 | core | revised | `tax_escalation_bill` | cash −$1,800 | 7,1; 1 мес. | −1,800 | [thelodownny.com](https://www.thelodownny.com/?p=111961) e |
| D13 | core | confirmed | `gas_turn_on_delay` | demand ×0.8 | круглый год; 3 мес. | −22,644 | [nysenate.gov](https://nysenate.gov/sites/default/files/press-release/attachment/cooking_without_gas.pdf) e |
| D14 | core | new | `dob_permit_issued` | milestone = construction may start; free-rent clock starts if the lease says so | круглый год; 1 мес. | 0 | [osc.ny.gov](https://www.osc.ny.gov/press/releases/2026/07/dinapoli-nyc-department-buildings-meets-critical-goals-lags-lower-priority-issues) e |
| D14 | core | new | `free_rent_ends` | rent ×1.0 | круглый год; 1 мес. | −6,000 | [jdsupra.com](https://www.jdsupra.com/legalnews/build-out-provisions-in-nyc-restaurant-1727571/) e |
| D14 | core | new | `line_out_the_door` | demand ×0.95 | круглый год; 1 мес. | −1,887 | [knowledge.wharton.upenn.edu](https://knowledge.wharton.upenn.edu/article/losing-patience-and-patients-what-makes-people-wait-in-line-or-decide-to-bail/) e |
| D14 | core | new | `permit_ready_after_buildout` | openingDelayDays = max(0, 22 - days since the FSE application) | круглый год; 1 мес. | −5,060 | [nyc-business.nyc.gov](https://nyc-business.nyc.gov/nycbusiness/description/food-service-establishment-permit) v |
| D14 | core | new | `seat_20_restroom_line` | violation → no_patron_toilet (если seats >= 20 and no patron restroom) | круглый год; 1 мес. | −12,000 | [nyc.gov](https://www.nyc.gov/site/doh/business/food-operators/operating-a-restaurant.page) e |
| D14 | core | new | `seller_tax_debt_surfaces` | cash −$30,000 | круглый год; 1 мес. | −30,000 | [aprio.com](https://www.aprio.com/insights-events/bulk-sales-in-new-york-how-a-purchaser-was-left-responsible-for-a-sellers-sales-tax-liability-ins-article-tax/) e |
| D14 | core | new | `stop_work_order` | openingDelayDays +45; cash −$6,000 | круглый год; 2 мес. | −16,350 | [nyc.gov](https://www.nyc.gov/site/buildings/property-or-business-owner/stop-work-order.page) e |
| D14 | core | new | `takeover_listing` | askingPrice = 0.46 x the address's annual sales (BizBuySell average revenue multiple), 2025 median sale $176,500 | круглый год; 1 мес. | −176,500 | [bizbuysell.com](https://www.bizbuysell.com/learning-center/valuation-benchmarks/coffee-shops-cafes/) v |
| D00 | deep | new | `d00_closures_nyc_event_arrears_catchup` | cash −$1,500 | круглый год; 12 мес. | −18,000 | [ny.eater.com](https://ny.eater.com/2023/3/20/23648664/neils-coffee-shop-closes-nyc-diner) e |
| D00 | deep | new | `d00_closures_nyc_event_bare_handover` | cash −$5,000 | круглый год; 1 мес. | −5,000 | [westviewnews.org](https://westviewnews.org/2019/02/04/villagers-speak-as-cornelia-street-cafe-curtain-comes-down/gcapsis/) e |
| D00 | deep | new | `d00_closures_nyc_event_espresso_exclusivity` | demand ×0.8 | круглый год; 12 мес. | −7,548 | [dnainfo.com](https://www.dnainfo.com/new-york/20171027/forest-hills/paris-baguette-radioshack-starbucks-107-06-continental-ave-forest-hills/) e |
| D00 | deep | new | `d00_closures_nyc_event_flagship_nontransfer` | demand ×0.8 | круглый год; 6 мес. | −45,288 | [ny.eater.com](https://ny.eater.com/2024/1/5/24022407/nyc-restaurant-closings-january-2024) e |
| D00 | deep | new | `d00_closures_nyc_event_insurer_rent_timing` | cashFrozenDays +90 | круглый год; 3 мес. | −18,000 | [tollbit.gothamist.com](https://tollbit.gothamist.com/2017/05/24/kushner_evict_pudge_knuckles.php) e |
| D00 | deep | new | `d00_closures_nyc_event_menu_revenue_ceiling` | rentToSalesCheck | круглый год; 3 мес. | 0 | [evgrieve.com](https://evgrieve.com/2017/02/ost-cafe-closes-on-sunday.html) e |
| D00 | deep | new | `d00_closures_nyc_event_owner_landlord_exit` | leaseEndsInMonths = 6 | круглый год; 6 мес. | −18,000 | [ny.eater.com](https://ny.eater.com/2017/10/17/16483070/cafe-orlin-closed-nyc) e |
| D00 | deep | new | `d00_closures_nyc_event_pass_through_jump` | rent ×1.08 | круглый год; 12 мес. | −5,760 | [thelodownny.com](https://www.thelodownny.com/leslog/2017/07/cup-saucer-classic-lower-east-side-diner-is-closing-next-week.html) e |
| D00 | deep | new | `d00_closures_nyc_event_relocation_repeats` | awareness ×0.7; openingDelayDays +90 | круглый год; 3 мес. | −90,700 | [ilovetheupperwestside.com](https://www.ilovetheupperwestside.com/a-beloved-upper-west-side-cafe-is-closing-after-nearly-four-decades/) e |
| D00 | deep | new | `d00_closures_nyc_event_renewal_fight` | leaseEndsInMonths = 6 | круглый год; 6 мес. | −88,000 | [timeout.com](https://www.timeout.com/newyork/news/beloved-silver-moon-bakery-is-permanently-closing-at-the-end-of-the-month-031125) e |
| D00 | deep | new | `d00_closures_nyc_event_reopen_after_peak` | closureDays +45 | 5,6,7,8,9; 3 мес. | −65,610 | [tollbit.gothamist.com](https://tollbit.gothamist.com/2017/05/24/kushner_evict_pudge_knuckles.php) e |
| D00 | deep | new | `d00_closures_nyc_event_repair_dispute_surrender` | closureDays +30 | круглый год; 2 мес. | −37,740 | [westsiderag.com](https://www.westsiderag.com/2025/10/06/coffee-shop-set-to-replace-iconic-uws-cafe-lalo) e |
| D00 | deep | new | `d00_closures_nyc_event_shared_basement` | inspections ×1.2; violationExposure → pest_activity | круглый год; 3 мес. | −1,500 | [bkmag.com](https://www.bkmag.com/2024/03/11/the-setting-of-the-sun-is-a-difficult-time-for-all-fish-the-rise-and-fall-of-littleneck/) e |
| D00 | deep | new | `d00_closures_nyc_event_sprinkler_stock` | cash −$3,000; closureDays +3 | круглый год; 1 мес. | −6,774 | [tollbit.gothamist.com](https://tollbit.gothamist.com/2017/05/24/kushner_evict_pudge_knuckles.php) e |
| D00 | deep | new | `d00_premises_construction_lien` | cash −$8,800 | круглый год; 3 мес. | −8,800 | [katalystos.com](https://www.katalystos.com/blog/restaurant-build-out-contract-and-liens) e |
| D00 | deep | new | `d00_premises_event_capacity` | violationExposure → overcrowding_over_occupancy | круглый год; 1 мес. | −250 | [nyc-business.nyc.gov](https://nyc-business.nyc.gov/nycbusiness/description/temporary-place-of-assembly-certificate-of-operation) e |
| D00 | deep | new | `d00_premises_landlord_utility_exit` | closureDays +3; reputation −0.01 | круглый год; 2 мес. | −8,748 | [community.squareup.com](https://community.squareup.com/t5/Community-News/Let-s-Talk-Business-Losing-Your-Location-with-Ryan-Wanner/ba-p/719865) e |
| D00 | deep | new | `d00_premises_lease_hours` | cash −$1,500 | круглый год; 1 мес. | −1,500 | [nycourts.gov](https://www.nycourts.gov/REPORTER/3dseries/2018/2018_07925.htm) e |
| D00 | deep | new | `d00_premises_noise_test_shutdown` | cash −$100 | круглый год; 1 мес. | −100 | [nyc.gov](https://www.nyc.gov/assets/dep/downloads/pdf/air/hospitality-industry-guide-environmental-compliance.pdf) e |
| D00 | deep | new | `d00_premises_outdoor_floor` | violation → outdoor_cafe_noncompliant | 4,5,6,7,8,9,10; 1 мес. | −200 | [codelibrary.amlegal.com](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-145866) e |
| D00 | deep | new | `d00_premises_outdoor_heater` | cash −$500 | 10,11,12,1,2,3; 1 мес. | −500 | [codelibrary.amlegal.com](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-145866) e |
| D00 | deep | new | `d00_premises_outside_scope` | setupCost +$15,000; openingDelayDays +30 | круглый год; 1 мес. | −21,900 | [reddit.com](https://www.reddit.com/r/smallbusiness/comments/ebot51/advice_for_dealing_with_building/) e |
| D00 | deep | new | `d00_premises_short_tenure_capex` | writeOffRisk = capex x (1 - months left / 60) | круглый год; 1 мес. | −21,000 | [community.squareup.com](https://community.squareup.com/t5/Community-News/Let-s-Talk-Business-Losing-Your-Location-with-Ryan-Wanner/ba-p/719865) e |
| D00 | deep | new | `d00_premises_toilet_renovation` | cash −$12,000; seats −3 | круглый год; 1 мес. | −12,000 | [nyc.gov](https://www.nyc.gov/assets/doh/downloads/pdf/about/healthcode/health-code-article81.pdf) e |
| D00 | deep | new | `d00_premises_wine_layout` | openingDelayDays +45 | круглый год; 2 мес. | −1,500 | [sla.ny.gov](https://sla.ny.gov/change-your-license) e |
| D00 | deep | new | `d00_world_event_expansion_before_debt_recovery` | cashBufferRequired +30000 | круглый год; 6 мес. | −30,000 | [reddit.com](https://www.reddit.com/r/smallbusiness/comments/144nqve/expansion_advice/) e |
| D00 | deep | new | `d00_world_event_fan_setting_recheck` | cash −$220 | круглый год; 2 мес. | −3,220 | [lgo.org.uk](https://www.lgo.org.uk/decisions/environment-and-regulation/noise/22-016-501) e |
| D00 | deep | new | `d00_world_event_furniture_impact_noise` | reputation −0.01 | круглый год; 1 мес. | −800 | [europeanacustica.com](https://www.europeanacustica.com/insonorizar-cafeteria/) e |
| D00 | deep | new | `d00_world_event_landlord_authority_unclear` | leaseSigningDelayDays +21 | круглый год; 1 мес. | −1,000 | [reddit.com](https://www.reddit.com/r/smallbusinessuk/comments/1t5hz8l/looking_for_advice_regarding_a_potential_space/) e |
| D00 | deep | new | `d00_world_event_layout_crossflow` | inspections ×1.1 | круглый год; 1 мес. | −5,000 | [kommersant.ru](https://www.kommersant.ru/doc/9077653) e |
| D00 | deep | new | `d00_world_event_outside_seating_withdrawn` | seats −10; demand ×0.97 | 4,5,6,7,8,9,10; 7 мес. | −10,710 | [8days.sg](https://www.8days.sg/eatanddrink/newsandreviews/mentai-ya-founder-opens-coffee-chirashi-cafe-grab-driver-632991) e |
| D00 | deep | new | `d00_world_event_predecessor_brand_confusion` | demand ×0.95 | круглый год; 2 мес. | −5,100 | [pressherald.com](https://www.pressherald.com/2025/10/23/model-t-coffee-in-portland-arts-district-has-closed/) e |
| D00 | deep | new | `d00_world_event_roast_odor_complaint` | inspections ×1.2 | круглый год; 2 мес. | −10,000 | [indailysa.com.au](https://www.indailysa.com.au/citymag/food-drink/2024/05/21/bitter-brew-cbd-coffee-spot-to-close-doors) e |
| D00 | deep | new | `d00_world_event_snowmelt_counter_damage` | cash −$7,600; closureDays +5 | 2,3; 1 мес. | −13,890 | [lehighvalleypublicmedia.org](https://www.lehighvalleypublicmedia.org/news/parkland-east-penn/a-bit-overwhelming-nowhere-coffee-co-temporarily-closed-in-emmaus-following-heavy-losses-from-water-damage/) e |
| D00 | deep | new | `d00_world_event_split_premises_dependency` | demand ×0.9 | круглый год; 3 мес. | −3,700 | [channelnewsasia.com](https://www.channelnewsasia.com/singapore/some-retailers-cut-losses-or-shut-stores-rental-rates-rebound-even-higher-pre-covid-5617966) e |
| D00 | deep | new | `d00_world_event_storefront_collision` | closureDays +3; cash −$1,000 | круглый год; 1 мес. | −4,774 | [kbtx.com](https://www.kbtx.com/2023/07/09/college-station-coffee-cafe-closed-after-vehicle-hits-building/) e |
| D01 | deep | confirmed | `acquisition_tax_at_closing` | cash −$3,550 | круглый год; 1 мес. | −3,550 | [tax.ny.gov](https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/bulk_sales.htm) e |
| D01 | deep | confirmed | `allowance_paid_after_the_work` | cash −$20,000 | круглый год; 3 мес. | −600 | [jdsupra.com](https://www.jdsupra.com/legalnews/build-out-provisions-in-nyc-restaurant-1727571/) e |
| D01 | deep | confirmed | `building_arrears_block_permit` | openingDelayDays +14 | круглый год; 1 мес. | −3,220 | [nyc.gov](https://www.nyc.gov/assets/buildings/pdf/ll160of2017_sn.pdf) e |
| D01 | deep | confirmed | `city_cuts_red_tape` | permitWaitDays ×0.9 | 7; 12 мес. | 0 | [nyc.gov](https://www.nyc.gov/mayors-office/news/2026/07/mayor-mamdani-announces--open-for-small-business---over-50-refor.html) e |
| D01 | deep | confirmed | `commissary_has_no_room` | permitWaitDays +30; monthlyFees +$300 | круглый год; 1 мес. | −3,600 | [nyc.gov](https://www.nyc.gov/site/doh/business/food-operators/mobile-and-temporary-food-vendors.page) e |
| D01 | deep | confirmed | `construction_noise_complaint` | cash −$440 | круглый год; 1 мес. | −440 | [nyc-business.nyc.gov](https://nyc-business.nyc.gov/nycbusiness/description/construction-noise-mitigation-plan) e |
| D01 | deep | confirmed | `contractor_adds_sales_tax` | buildoutCost ×1.053 | круглый год; 1 мес. | −3,728 | [tax.ny.gov](https://www.tax.ny.gov/pubs_and_bulls/advisory_opinions/sales/24-54s.htm) e |
| D01 | deep | confirmed | `equipment_lien_surprise` | cash −$6,000 | круглый год; 1 мес. | −6,000 | [acquisitionstars.com](https://acquisitionstars.com/buying-a-business/coffee-shop) e |
| D01 | deep | confirmed | `equity_injection_gap` | minOwnCashShare +0.1 | круглый год; 12 мес. | −30,000 | [whitefordlaw.com](https://www.whitefordlaw.com/news-events/client-alert-sba-issues-sop-50-10-8-key-changes-impacting-sba-7a-lending) e |
| D01 | deep | confirmed | `failed_trade_inspection` | openingDelayDays +14; buildoutCost +$12,000; cash −$5,000 | круглый год; 1 мес. | −20,220 | [citylandnyc.org](https://citylandnyc.org/unlicensed-plumber-fined) e |
| D01 | deep | confirmed | `fit_out_prices_rise` | buildoutCost ×1.07 | 3; 12 мес. | −4,900 | [cushmanwakefield.com](https://www.cushmanwakefield.com/en/united-states/insights/us-marketbeats/new-york-city-area-marketbeats/manhattan-retail) v |
| D01 | deep | confirmed | `franchise_buildout_not_yours` | setupCost ×2.05 | круглый год; 1 мес. | −235,150 | [franchising.inspirebrands.com](https://www.franchising.inspirebrands.com/dunkin) e |
| D01 | deep | confirmed | `franchise_cooling_off` | openingDelayDays +14 | круглый год; 1 мес. | −3,220 | [ftc.gov](https://www.ftc.gov/business-guidance/resources/consumers-guide-buying-franchise) v |
| D01 | deep | confirmed | `host_ends_the_arrangement` | closureDays +30; awareness ×0.7 | круглый год; 1 мес. | −12,000 | [nyc-business.nyc.gov](https://nyc-business.nyc.gov/nycbusiness/description/shared-kitchens/about) e |
| D01 | deep | confirmed | `inherited_sick_leave_balances` | cash −$1,680 | круглый год; 12 мес. | −1,680 | [nyc.gov](https://www.nyc.gov/site/dca/about/paid-sick-leave-FAQs.page) e |
| D01 | deep | confirmed | `inherited_unemployment_rate` | payrollTax +0.02 | круглый год; 12 мес. | −1,408 | [dol.ny.gov](https://dol.ny.gov/transfers-business-and-your-contribution-rate) e |
| D01 | deep | confirmed | `landmark_review` | openingDelayDays +21; setupCost +$320 | круглый год; 1 мес. | −5,150 | [nyc.gov](https://www.nyc.gov/site/lpc/applications/storefronts.page) e |
| D01 | deep | confirmed | `letter_of_credit_wait` | leaseSigningDelayDays +18; monthlyFees +$23 | круглый год; 1 мес. | −276 | [metro-manhattan.com](https://www.metro-manhattan.com/security-deposit/) e |
| D01 | deep | confirmed | `mechanics_lien_filed` | cash −$8,800 | круглый год; 1 мес. | −8,800 | [katalystos.com](https://www.katalystos.com/blog/restaurant-build-out-contract-and-liens) e |
| D01 | deep | confirmed | `no_certificate_of_occupancy` | openingDelayDays +30 | круглый год; 1 мес. | −6,900 | [portal.311.nyc.gov](https://portal.311.nyc.gov/article/?kanumber=KA-02023) e |
| D01 | deep | confirmed | `old_equipment_gives_out` | cash −$7,600; closureDays +2 | круглый год; 1 мес. | −10,116 | [webstaurantstore.com](https://www.webstaurantstore.com/espresso-machine-2gr-appi/238APLCV2.html) e |
| D01 | deep | confirmed | `pre_permit_inspection_blocked` | openingDelayDays +7 | круглый год; 1 мес. | −1,610 | [portal.311.nyc.gov](https://portal.311.nyc.gov/article/?kanumber=KA-02955) e |
| D01 | deep | confirmed | `sellers_unpaid_health_fines` | permitWaitDays +14 | круглый год; 1 мес. | −3,220 | [nyc.gov](https://www.nyc.gov/assets/doh/downloads/pdf/about/healthcode/health-code-article5.pdf) e |
| D01 | deep | confirmed | `short_lease_left` | rent ×1.25 | круглый год; 12 мес. | −18,000 | [bizbuysell.com](https://www.bizbuysell.com/new-york/coffee-shops-and-cafes-for-sale/) e |
| D01 | deep | confirmed | `tax_escalation_bill` | rent +60 | 7,1; 12 мес. | −720 | [carltonfields.com](https://www.carltonfields.com/leasing-retail-stores-in-new-york-city/) e |
| D01 | deep | confirmed | `utility_deposit_demand` | cash −$1,600 | круглый год; 1 мес. | −1,600 | [coned.com](https://www.coned.com/-/media/files/coned/documents/accountandbilling/non-res-rights-english.pdf) e |
| D01 | deep | confirmed | `vacancy_leverage` | freeRentMonths +1 | круглый год; 6 мес. | +6,000 | [comptroller.nyc.gov](https://comptroller.nyc.gov/reports/whos-minding-the-storefronts/) e |
| D02 | deep | confirmed | `aisle_too_narrow` | exposure → accessibility_barrier | круглый год; 1 мес. | 0 | [ada.gov](https://www.ada.gov/law-and-regs/design-standards/2010-stds/) e |
| D02 | deep | confirmed | `backflow_notice` | violation → backflow_not_tested | круглый год; 1 мес. | −250 | [nyc.gov](https://www.nyc.gov/site/dep/about/backflow-prevention-frequently-asked-questions.page) e |
| D02 | deep | confirmed | `building_gas_shutoff` | closureDays +3 (если the water heater is gas); demand ×0.9 (если the oven is gas) | круглый год; 2 мес. | −3,774 | [w42st.com](https://w42st.com/post/gas-shutoff-drags-on-at-sesamo-leaving-restaurant-in-limbo-for-over-a-month/) e |
| D02 | deep | confirmed | `cellar_hatch_left_open` | inspections ×1.1 | круглый год; 1 мес. | 0 | [portal.311.nyc.gov](https://portal.311.nyc.gov/article/?kanumber=KA-02292) e |
| D02 | deep | confirmed | `cellar_stairs_tax` | staffAvailability ×0.97; seats +3 | круглый год; 12 мес. | 0 | [alataucitybank.kz](https://alataucitybank.kz/business/osim/articles/sem-fundamentalnykh-printsipov-proektirovki-kofeynogo-bara) e |
| D02 | deep | confirmed | `community_board_review` | cash −$900 (если the player goes to the hearing); waitDays +60 (если hearing) | круглый год; 2 мес. | −900 | [diningoutnyc.info](https://www.diningoutnyc.info/apply/publichearing) e |
| D02 | deep | confirmed | `neighbor_noise_complaint` | violation → commercial_noise | круглый год; 1 мес. | 0 | [nyc.gov](https://www.nyc.gov/assets/dep/downloads/pdf/air/noise/commercial-music-noise-violation-zero-penalty.pdf) e |
| D02 | deep | confirmed | `open_mic_over_capacity` | violation → overcrowding_over_occupancy | круглый год; 1 мес. | −2,500 | [nyc-business.nyc.gov](https://nyc-business.nyc.gov/nycbusiness/description/temporary-place-of-assembly-certificate-of-operation) e |
| D02 | deep | confirmed | `order_ahead_flood` | staffAvailability ×0.95; quality −0.02 | круглый год; 1 мес. | 0 | [customerexperiencedive.com](https://www.customerexperiencedive.com/news/4-takeaways-starbucks-customer-experience/756355/) e |
| D02 | deep | confirmed | `outdoor_setup_out_of_bounds` | violation → outdoor_cafe_noncompliant; seats −4 | 4,5,6,7,8,9,10; 1 мес. | −200 | [diningoutnyc.info](https://www.diningoutnyc.info/enforcement) v |
| D02 | deep | confirmed | `quiet_room_afternoons` | demand ×0.98 | круглый год; 1 мес. | −755 | [mdpi.com](https://www.mdpi.com/2071-1050/17/18/8400) e |
| D02 | deep | confirmed | `renovation_triggers_restroom_rules` | cash −$12,000; seats −3 | круглый год; 1 мес. | −12,000 | [nyc.gov](https://www.nyc.gov/assets/doh/downloads/pdf/about/healthcode/health-code-article81.pdf) e |
| D02 | deep | confirmed | `restroom_line_of_passers_by` | cash −$150 (если restroom open to all) | круглый год; 12 мес. | −1,800 | [cnn.com](https://www.cnn.com/2025/01/14/food/starbucks-restroom-policy) e |
| D02 | deep | confirmed | `restroom_out_of_order` | reputation −0.02; violation → toilet_not_supplied | круглый год; 1 мес. | 0 | [codelibrary.amlegal.com](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-43593) e |
| D02 | deep | confirmed | `roadway_cafes_go_year_round` | roadwayMonthsActive = 12 | 9; 12 мес. | −1,000 | [portal.311.nyc.gov](https://portal.311.nyc.gov/article/?kanumber=KA-03604) e |
| D02 | deep | confirmed | `sign_complaint_wave` | inspections ×1.3; violation → sign_without_permit | круглый год; 3 мес. | −1,250 | [brooklynreporter.com](https://brooklynreporter.com/2018/12/hard-stop-on-signage-fees-as-city-council-secures-new-awning-act/) e |
| D02 | deep | confirmed | `storefront_glass_broken` | cash −$1,150; closureDays +1 | круглый год; 1 мес. | −2,408 | [insightglass.com](https://www.insightglass.com/how-much-do-storefront-windows-cost/) e |
| D02 | deep | confirmed | `tight_tables_reviews` | reputation −0.03 | круглый год; 2 мес. | 0 | [hospitalitynet.org](https://www.hospitalitynet.org/news/4039649.html) e |
| D08 | deep | revised | `lease_renewal_reset` | rent ×1.3 | круглый год; 12 мес. | −21,600 | [brooklyn.news12.com](https://brooklyn.news12.com/greenpoint-coffee-shop-sippy-caf-closing-after-rent-nearly-triples) e |
| D08 | deep | revised | `tax_escalation_bill` | rent +60 | 7,1; 12 мес. | −720 | [metro-manhattan.com](https://www.metro-manhattan.com/blog/rentescalations) e |
| D09 | deep | confirmed | `deposit_kept_by_landlord` | cash −$5,000 | круглый год; 1 мес. | −5,000 | [metro-manhattan.com](https://www.metro-manhattan.com/blog/what-is-the-good-guy-guarantee-in-new-york-city-commercial-real-estate/) e |
| D09 | deep | confirmed | `still_on_the_lease_after_sale` | cash −$36,000 | круглый год; 6 мес. | −36,000 | [metro-manhattan.com](https://www.metro-manhattan.com/subleasing-assignment/) e |
| D10 | deep | confirmed | `building_sold` | rent ×1.0 | круглый год; 1 мес. | 0 | [brooklyn.news12.com](https://brooklyn.news12.com/2025/12/10/popular-juice-shop-in-crown-heights-closes-its-doors/1nmkac7r25b71vtq38DmnB) e |
| D13 | deep | confirmed | `building_gas_shutoff` | demand ×0.85 | круглый год; 2 мес. | −11,322 | [bronx.news12.com](https://bronx.news12.com/con-ed-illegal-gas-plumbing-work-forces-service-shutdown-for-fordham-restaurant-tenants-41500504) e |
| D13 | deep | revised | `commissary_rent_hike` | commissary_fee ×1.25 | 1,7; 12 мес. | −2,280 | [nyc.gov](https://www.nyc.gov/site/doh/business/food-operators/mobile-and-temporary-food-vendors.page) e |
| D13 | deep | confirmed | `park_kiosk_rfp` | rentFormula = max(minimum/12, share x revenue) | 2,7; 2 мес. | −20,000 | [static.nycgovparks.org](https://static.nycgovparks.org/images/pagefiles/203/Harlem-Meer-Step-2-NPH-Final-approved-__676adfc6612a7.pdf) e |
| D13 | deep | confirmed | `transit_stall_rfp` | rentFormula = 0.15 x revenue | 3,9; 2 мес. | −36,000 | [mta.info](https://www.mta.info/document/186826) e |
| D14 | deep | new | `bulk_sale_claim` | closingDelayDays +90 | круглый год; 3 мес. | −18,000 | [tax.ny.gov](https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/bulk_sales.htm) v |
| D14 | deep | new | `gas_connection_wait` | openingDelayDays +68 | круглый год; 2 мес. | −15,640 | [nysenate.gov](https://nysenate.gov/sites/default/files/press-release/attachment/cooking_without_gas.pdf) e |
| D14 | deep | new | `no_seat_left` | demand ×0.95; quality −0.03 | круглый год; 1 мес. | −472 | [swinburne.edu.au](https://www.swinburne.edu.au/news/2023/01/Youre-about-to-see-a-growing-trend-of-laptop-workers-in-cafes-new-research-reveals-why/) e |
| D14 | deep | revised | `rebrand_loses_regulars` | demand ×0.7 | круглый год; 3 мес. | −33,966 | [bizbuysell.com](https://www.bizbuysell.com/learning-center/valuation-benchmarks/coffee-shops-cafes/) e |
| D00 | exotic | new | `d00_premises_public_landlord_use` | leaseSigningDelayDays +30 | круглый год; 1 мес. | 0 | [nyc.gov](https://www.nyc.gov/site/nycha/business/store-leasing.page) e |
| D01 | exotic | confirmed | `buildings_walk_in_help` | permitWaitDays ×0.9; openingDelayDays +5 | круглый год; 12 мес. | −1,150 | [nyc.gov](https://www.nyc.gov/mayors-office/news/2026/07/executive-order-no--18.html) e |
| D01 | exotic | confirmed | `gas_shut_off_in_building` | quality ×0.9; capacity ×0.85 | круглый год; 2 мес. | −11,322 | [abc7ny.com](https://abc7ny.com/post/popular-hells-kitchen-restaurant-has-been-cooking-gas-month-routine-inspection-found-leak/18837449/) e |
| D01 | exotic | confirmed | `milk_drinks_change_the_cart_class` | setupCost +$5,000; permitWaitDays +21 | круглый год; 1 мес. | −5,000 | [nyc.gov](https://www.nyc.gov/assets/doh/downloads/pdf/about/healthcode/health-code-chapter6.pdf) e |
| D01 | exotic | confirmed | `parks_kiosk_rfp` | rent +3333 | 5,6; 12 мес. | −40,000 | [a856-cityrecord.nyc.gov](https://a856-cityrecord.nyc.gov/RequestDetail/20240628149) v |
| D01 | exotic | confirmed | `structural_surprise` | openingDelayDays +120 | круглый год; 4 мес. | −27,600 | [bisnow.com](https://bisnow.com/new-york/news/retail/owners-of-landmarked-beatnik-caf-sue-landlord-for-constructive-eviction-117169) e |
| D01 | exotic | confirmed | `worker_falls_on_site` | cash −$25,000 | круглый год; 1 мес. | −25,000 | [law.cornell.edu](https://www.law.cornell.edu/nyctap/I08_0054.htm) e |
| D01 | exotic | confirmed | `young_franchise_system` | awareness ×0.9 | круглый год; 12 мес. | −3,774 | [dailycoffeenews.com](https://dailycoffeenews.com/2026/02/18/backed-by-craveworthy-gregorys-coffee-launches-franchising) e |
| D02 | exotic | confirmed | `backflow_penalty_bill` | fineBase = 1000 | круглый год; 12 мес. | 0 | [nyc.gov](https://www.nyc.gov/site/dep/about/backflow-prevention-frequently-asked-questions.page) e |
| D02 | exotic | confirmed | `cafe_fees_by_quarter` | cashTiming = quarterly | 5; 12 мес. | 0 | [diningoutnyc.info](https://www.diningoutnyc.info/apply/fees) e |
| D02 | exotic | confirmed | `candles_without_a_permit` | cash −$210 | круглый год; 1 мес. | −210 | [codelibrary.amlegal.com](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-102214) e |
| D02 | exotic | confirmed | `dim_bar_at_inspection` | cash −$100 | круглый год; 1 мес. | −100 | [codelibrary.amlegal.com](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-43593) e |
| D02 | exotic | confirmed | `landmark_notice` | cash −$2,600 (если the awning or sign has to be remade) | круглый год; 1 мес. | −2,600 | [nyc.gov](https://www.nyc.gov/site/lpc/applications/storefronts.page) e |
| D02 | exotic | confirmed | `line_on_the_neighbors_stoop` | inspections ×1.2 | 4,5,6,9,10,11,12; 2 мес. | −40 | [diningoutnyc.info](https://www.diningoutnyc.info/enforcement) e |
| D02 | exotic | confirmed | `peak_kw_bill_jump` | utilities ×1.1 | круглый год; 12 мес. | −960 | [coned.com](https://www.coned.com/en/small-medium-size-businesses/gas-and-electric-service-update-guide) e |
| D02 | exotic | confirmed | `restroom_occupied_for_an_hour` | staffAvailability ×0.98; quality −0.01 | круглый год; 1 мес. | 0 | [cnn.com](https://www.cnn.com/2025/01/14/food/starbucks-restroom-policy) e |
| D02 | exotic | revised | `roll_down_gate_deadline` | none | 2,3,4,5,6; 0 мес. | 0 | [brooklyn.news12.com](https://brooklyn.news12.com/2026/07/03/see-through-security-gate-requirement-repealed-for-businesses-as-part-of-city-budget/MkkqJRrsd0jocdLjctpIt) e |
| D02 | exotic | confirmed | `vestibule_must_come_down` | inspections ×1.1 (если the vestibule is left up) | 4; 1 мес. | −200 | [diningoutnyc.info](https://www.diningoutnyc.info/enforcement) e |
| D08 | exotic | confirmed | `holdover_after_expiry` | rent ×1.5 | круглый год; 2 мес. | −6,000 | [thehabitatgroup.com](https://www.thehabitatgroup.com/articles/9654-require-tenants-to-pay-maximum-premium-rent-for-long-holdovers) e |
| D08 | exotic | confirmed | `landlord_pressure` | demand ×0.95 | круглый год; 3 мес. | −7,650 | [intro.nyc](https://intro.nyc/local-laws/2019-185) e |
