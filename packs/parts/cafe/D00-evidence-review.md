# D00 — независимый аудит доказательств cafe

Дата проверки: 2026-11-14. Это замечания к сохранённым исследовательским частям и исходному `packs/cafe.json`, а не внесённые исправления. Чужие части не изменялись. Снимок менялся во время работы; итоговые количества пересчитать после сборки.

В прочитанном снимке частей: 354 событий. Для защиты минимума нужно считать уникальный триггер → последствие → решение, а не число ID. Ниже 11 кластеров; даже консервативное объединение не требует выбрасывать истории и источники. Сначала применить дедупликацию, затем считать минимум.

## 1. Семантическая дедупликация

1. `d00_world_event_successor_not_found` ↔ `d00_closures_nyc_event_succession_gap`. Дата выхода владельца наступила, преемника нет. Оставить один триггер; обе истории сохранить.
   Доказательства: https://www.eldebate.com/espana/castilla-y-leon/20260908/cierra-falta-relevo-emblematico-cafe-universitario-salamanca-casi-medio-siglo-vida_456199_amp.html ; https://ny.eater.com/2018/3/2/17072872/glasers-bake-shop-closing-nyc

2. `d00_world_event_reopening_awareness_lag` ↔ `d00_street_still_closed_online`. Заведение снова открыто, профиль всё ещё показывает закрытие. Оставить одно событие.
   Доказательства: https://augustabusinessdaily.com/after-flooding-ubora-coffee-shop-reopens-to-the-delight-of-patrons/ ; https://support.google.com/business/answer/15300571

3. `d00_premises_music_neighbors` ↔ `d00_street_neighbor_music`. Жалоба соседа на музыку кафе, измерение/снижение звука/медиация. Один триггер и почти одинаковые ответы.
   Доказательства: https://portal.311.nyc.gov/article/?kanumber=KA-01085 ; https://portal.311.nyc.gov/article/?kanumber=KA-01085

4. `d00_premises_app_cashless` ↔ `d00_street_app_only_counter`. App-only оплата физически пришедшего посетителя без наличной альтернативы. Оставить одно событие.
   Доказательства: https://www.nyc.gov/assets/dca/downloads/pdf/businesses/CashlessBanGuidance-AppBasedTransactions.pdf ; https://www.nyc.gov/assets/dca/downloads/pdf/businesses/CashlessBanGuidance-AppBasedTransactions.pdf

5. `d00_premises_pest_door_gap` ↔ `d00_world_event_pest_entry_unsealed`. Неустранённый путь проникновения вредителей. Внешняя дверь — конкретизация того же события; можно сохранить как вариант.
   Доказательства: https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-46269 ; https://www.itv.com/news/meridian/2024-04-27/biker-cafe-with-rat-infestation-fined-6000-after-droppings-found-in-kitchen

6. `d00_premises_platform_allergy` ↔ `d00_equipment_food_online_allergy_field`. Онлайн-заказ без информации об аллергенах и без канала сообщения об аллергии. Сохранить один сценарий, обе применимые нормы.
   Доказательства: https://www.nyc.gov/site/doh/business/food-operators/required-signs.page ; https://healthweb-back.health.ny.gov/environmental/indoors/food_safety/foodallergens.htm

7. `d00_world_event_retail_only_pivot` ↔ `d00_closures_nyc_event_retail_online`. Закрытие кафе с сохранением online retail. Разный товар/страна истории не создают нового игрового решения.
   Доказательства: https://www.indailysa.com.au/citymag/archive/2021/08/12/melbourne-street-cafe-e-for-ethel-is-shutting-up-shop-and-moving-online ; https://www.ilovetheupperwestside.com/matcha-spot-chalait-shutters-its-final-location-on-the-upper-west-side/

8. `d00_world_event_exit_packdown_cost` ↔ `d00_closures_nyc_event_bare_handover`. Сдача помещения требует вывоза оборудования/fit-out и расходов. В нынешнем общем виде один exit-сценарий.
   Доказательства: https://www.sunshinecoastnews.com.au/2026/02/20/beloved-family-cafe-closes-after-more-than-a-decade/ ; https://westviewnews.org/2019/02/04/villagers-speak-as-cornelia-street-cafe-curtain-comes-down/gcapsis/

9. `d00_world_event_neighbor_sprinkler_exposure` ↔ `d00_closures_nyc_event_sprinkler_stock`. Объявленный инцидент в здании с водой sprinkler и обследованием повреждённого кафе. Объединить; конкретные списки повреждений — варианты одного события.
   Доказательства: https://dailycoffeenews.com/2019/01/21/sisters-coffee-opens-wonderfully-reimagined-portland-cafe-after-a-fire/ ; https://tollbit.gothamist.com/2017/05/24/kushner_evict_pudge_knuckles.php

10. `d00_street_wrong_hours` ↔ `d00_street_split_shift_listing`. Фактические часы отличаются от опубликованных. Непоказанный дневной перерыв — частный случай; лучше один событие с вариантами расписания.
   Доказательства: https://support.google.com/business/answer/15300403 ; https://support.google.com/business/answer/15300403

11. `d00_equipment_food_clean_vs_descale` ↔ `d00_equipment_food_taste_before_failure`. Остатки кофе из-за невыполненной процедуры очистки. Ошибочно выбранный descaler и пропущенная очистка различны как причины, но последствие/решение совпадают: объединить либо сформулировать измеримо разные состояния.
   Доказательства: https://urnex.com/faqs ; https://urnex.com/faqs

Условные пересечения — не удалять автоматически:

- `d00_premises_outdoor_floor` / `d00_street_flooring_hidden_debris`: можно сохранить отдельно, если первое строго означает конструкцию без доступа для уборки, второе — доступный пол с пропущенной уборкой. Сейчас первое включает и отсутствие плана, поэтому границу надо сделать явной.
- `d00_street_online_queue` / `d00_street_capacity_threshold`: сохранить разные события только как одновременный всплеск из нескольких каналов и устаревший лимит после сокращения персонала. Не начислять два одинаковых последствия одной очереди.
- `d00_world_event_prime_site_unprofitable` / `d00_closures_nyc_event_relocation_repeats`: повторная релокация сама по себе не новый механизм rent renewal; нужны отдельные невозвратные расходы переезда/новая потеря клиентской базы, подтверждённые источником, либо объединение.
- `d00_labor_finance_insurance_scope` / `d00_labor_finance_no_damage_interruption`: общее неизвестное исключение в полисе не должно второй раз считать конкретное отсутствие covered property damage. У первого уточнить отдельный исключённый риск.
- `d00_labor_finance_db_pfl_gap` / `d00_labor_finance_db_renewal`: можно оставить покупку недостающего вида страхования и lapse существующего договора, если они дают разные документальные шаги; не создавать два события за один и тот же день отсутствия покрытия.

Не считаю дублями разные повреждения/обязательства только из-за общей темы: закупка с залогом и mechanic’s lien; неизвестная температура ночью и просроченный отзыв товара; отпуск владельца и добровольный выход партнёра; pantry allergy cross-contact и аллерген в online menu. Разные болезни/пожары не должны становиться лишь случайными бросками.

## 2. Приоритетные ошибки исходных 63 числовых записей

Проверены все группы: 33 setup, 16 monthlyCosts, 2 staff, 1 taxes, 11 violations. Ниже не полный новый прайс, а конкретные ошибки модели/юридической применимости. Файл-основание: `packs/cafe.json`.

1. **P1 — штрафы растут по игровым месяцам вместо состава нарушения.** `dirty_surfaces.fine.perMonth=25`, `pest_activity=50`, `spoiled_food=50`, `unapproved_food_source=50`, `grease_interceptor_neglect=200`. Первые четыре опираются на condition-level таблицу, а не на месяцы. Для grease источник также не подтверждает месячную лестницу. Убрать автоматическую временную эскалацию либо оставить исключительно как отдельно обозначенную неподтверждённую игровую оценку, не `verified` закон. Реальное условие — выявленная тяжесть, повторность по конкретной норме или иной документированный состав. Источники: https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-43593 ; https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-43524 ; https://nyc-business.nyc.gov/nycbusiness/resources-by-industry/restaurant

2. **P1 — `pest_activity` объединяет две самостоятельные обязанности.** Живые вредители не доказывают отсутствие договора и service records; к штрафу нельзя всегда прибавлять плату за отсутствующий документ. Разделить trigger pest evidence и trigger missing contract/records. Срок `closureDays=2` сам назван оценкой, но вся запись `verified`; закрытие зависит от опасности и remediation, не фиксированных суток. Источники: https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-43593 ; https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-46269

3. **P1 — `no_fse_permit` смешивает отсутствие права работы с отсутствием бумажного permit.** NYC допускает открытие после установленного срока от подачи заявления без pre-permit inspection при выполнении других требований. Условие должно проверять действующее разрешение/иное право, а не наличие объекта setup. `$2,000` — default при неответе на summons, не универсальный потолок за работу без permit; `closureDays=5` и `reputationHit=0.1` — не подтверждённые законом значения. `fse_permit.waitDays=21` сопоставить с текстом «22 days after», не выдавать это за гарантированный срок выпуска permit. Источники: https://nyc-business.nyc.gov/nycbusiness/description/food-service-establishment-permit ; https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-43593

4. **P1 — `spoiled_food` объединяет contamination и cold holding.** `02G` относится к TCS-food, а не к любой холодной еде; `04H` иной состав с иной шкалой. Заголовок «cold food kept above 41°F» слишком широк. Уточнить TCS, legal exceptions и фактически установленный код; не брать максимальную санкцию одного состава за другой. Источник: https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-43593

5. **P1 — `tip_theft`, `unpaid_training_time`, `spread_of_hours_unpaid`: `pctOfSaved=2` не универсальная автоматическая санкция.** Разделить невыплаченные суммы, liquidated damages, interest/fees и отдельные civil penalties. В §198 есть good-faith defense и разные административный/судебный режимы; штраф до двойного размера по §218 не равен автоматически двойной реституции во всех случаях. Сохранить формулу только как явно условную оценку конкретного правоприменения. Источники: https://www.nysenate.gov/legislation/laws/LAB/198 ; https://www.nysenate.gov/legislation/laws/LAB/218

6. **P1 — `unpaid_training_time.note` безусловно обещает три часа каждому вызванному работнику.** В §146-1.5 есть меньшее число часов регулярно повторяющейся короткой смены и отдельные правила нескольких смен; actual attendance и balance оплачиваются по разным основаниям. Исправить фразу на условное правило с исключением; не менять обязанность оплаты реально выполненной работы. Прочитанный текст: https://www.law.cornell.edu/regulations/new-york/12-NYCRR-146-1.5 . Официальный PDF https://dol.ny.gov/system/files/documents/2024/12/cr146.pdf в этой перепроверке вернул 403; не заявляю, что заново прочёл этот PDF.

7. **P1 — единый `verified` маскирует неподтверждённые lifespan/bonus.** В setup `espresso_machine`, `grinder`, `pastry_case`, `chair`, `table_share`, `decaf_grinder`, `dishwasher`, `premium_espresso_machine`, `premium_grinder` цена снабжена источником продавца, но lifespanMonths — отдельная оценка; qualityBonus у upgrades сам назван game value. Аналогично `food_protection_cert.waitDays=14` в note назван оценкой. Нельзя выводить поломку по календарному возрасту или гарантированное качество из цены. Нужна confidence по полям или вся смешанная запись `estimate` с отдельно перечисленными проверенными числами. Доказательство — собственные note перечисленных записей и ссылки на них; страница продавца не является доказательством срока эксплуатации.

8. **P2 — `sidewalk_cafe_license` смешивает расход, возвращаемое обеспечение и срок.** Cost складывает license fee и refundable deposit; это разные денежные состояния. `waitDays=240` даже при поддержке исторической оценкой не срок, гарантированный каждому заявителю, а `qualityBonus=.02` не наблюдаемый эффект закона. Сохранить подтверждённые fee отдельно, пометить timing/bonus оценками; не считать возвратный депозит потреблённой комиссией. Источник: https://www.diningoutnyc.info/apply/fees

9. **P2 — `staff.shift_lead` покрывает FPC только в public opening hours.** Сертифицированный supervision требуется и при receiving/preparation, включая подготовку до открытия. `tipped=true` для shift lead не даёт права включать фактического manager в tip pool: классификация зависит от полномочий, не названия. Источники: https://nyc-business.nyc.gov/nycbusiness/resources-by-industry/restaurant ; https://www.dol.gov/agencies/whd/fact-sheets/15b-managers-supervisors-tips-flsa

10. **P2 — `customer_restroom.name` превращает общий порог в правило без исключений.** §81.22 сохраняет исключение для определённых старых premises и прекращает его при предусмотренной permit-renovation; employee toilet требуется отдельно. Сохранить условность и history premises, не просто seats>=20. Источник: https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-46264

11. **P2 — `taxes.sales_tax`: verified rate не подтверждает taxable share и quarterly для всех.** Сам note признаёт обложение каждого заказа игровым допущением. Ставку сохранить, а долю taxable sales рассчитывать по товару/способу продажи; quarterly — базовый режим, который может измениться по NYS filing criteria. Источники: https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/sales_by_restaurants.htm ; https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/filing_requirements_for_sales_and_use_tax_returns.htm

12. **P2 — `monthlyCosts.waste.note` говорит об обязательном zone carter как о уже едином режиме для любого адреса.** Применимость зависит от адреса и implementation date. Зафиксировать квартал/zone и дату действия; price remains estimate. Источники: https://www.nyc.gov/site/dsny/businesses/cwz/rollout-schedule.page ; https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-130166

13. **P2 — `permit_renewals.note` называет `$25 state LLC fee` без tax classification.** Для disregarded LLC это может быть применимо, для LLC/LLP partnership filing fee зависит от NY source gross income. Не превращать одну величину в универсальную плату любой LLC; добавить entity/tax status. Прочитанный первоисточник: https://www.tax.ny.gov/forms/html-instructions/2025/it/it204lli-2025.htm

14. **P2 — `llc_and_publication.source` не поддерживает всё `$1,675`.** Note правильно отличает частный publication package от государственного сбора, но в записи единственный source — DOS с государственным filing fee. Добавить конкретный прочитанный URL и дату предложения LLC Publishers, либо total estimate. Не объявляю цену неверной, проблема в доказательстве составной суммы. Имеющийся источник: https://dos.ny.gov/node/35506

15. **P2 — `grinder` и `decaf_grinder` используют одну цену discontinued/out-of-stock E65S.** Note сам сообщает недоступность модели. Это исторический ценовой ориентир, не исполнимая новая закупка; стоимость/наличие нуждаются в реальном предложении или явном сценарии used/remaining stock. Источник записи: https://visionsespresso.com/coffee-grinders/brands/mahlkonig/

16. **P2 — `unapproved_food_source.name` слишком легко прочитать как запрет любой независимой зарегистрированной home processor продукции.** NY Agriculture expressly допускает отдельному зарегистрированному processor продавать определённую упакованную и маркированную продукцию кафе; оператор с собственным DOH permit не может использовать это исключение для своей домашней кухни. NYC §81.04 требует approved source. Безопасное исправление: «Food from an unapproved source, including unauthorized home preparation» и проверка supplier registration/product scope; не обещать законность любого home food. Источники: https://agriculture.ny.gov/food-safety/home-processing ; https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-46036

17. **P2 — `monthlyCosts.sick_leave_cover` использует только один размер/тип работодателя.** `$70` назван расчётом для 5–99 работников; это бюджетная оценка, не одинаковая юридическая стоимость каждой микрокофейни. Нужны coverage criteria и отделение paid benefit от дополнительной оплаты replacement cover. Источник: https://www.nyc.gov/site/dca/about/paid-sick-leave-FAQs.page

## 3. Применимость новых частей и масштабы

- Новые qualitative event records в просмотренном снимке помечены `estimate`, без придуманных probabilities, multipliers и durations. Это правильно. `evidenceStatus=opened_primary` описывает просмотр источника, а не доказанность игрового исхода: не поднимать confidence всей строки при сборке.
- `d00_world_event_neighbor_sprinkler_exposure` и `d00_closures_nyc_event_sprinkler_stock` объявляют общий building incident, но scale=point. Допустим point как локальное последствие; общий вход должен иметь единый scenario/building identifier. Нельзя каждому кафе бросать отдельный случайный sprinkler incident. У national coffee/tea market records проверить, что общий bulletin применяется единожды с локальными контрактными последствиями.
- `d00_street_seasonal_choice` не должен вводить обязательное зимнее снятие для всех roadway cafes. В 2026 есть year-round вариант; текущая формулировка seasonal authorization подходит, если её сохранить. Не переносить старые статьи о зимнем запрете в общую действующую норму.
- `d00_premises_platform_allergy` / `d00_equipment_food_online_allergy_field`: даже после объединения различать обязанность и начало summons enforcement. NYC страница говорит о January 2027 enforcement; не создавать автоматический штраф за новый rule в ноябре 2026. Источник: https://www.nyc.gov/site/doh/business/food-operators/required-signs.page
- Ссылка `d00_labor_finance_source_sbaliens` ведёт на широкую SBA lenders page. Страница содержит collateral и servicing resources, однако для конкретного requirement lender consent лучше ссылка на соответствующий loan form/servicing section. Сам сценарий условен реальным залогом и правдоподобен; не считать эту претензию доказательством ложности. Источник: https://www.sba.gov/sba-lenders/

## 4. Истории и снятые подозрения

- `d00_premises_failure_peaches` (Peaches Cafe LLC) и `d00_premises_failure_wanner` (R&R Coffee Cafe / Ryan Wanner) не совпадают с business/name/case в двух closure-shards на момент проверки. Court case доказывает факт открытия/закрытия и contractor dispute, но не доказанную причину коммерческого краха; эту оговорку сохранить. Источники: https://www.nycourts.gov/REPORTER/3dseries/2018/2018_07925.htm ; https://community.squareup.com/t5/Community-News/Let-s-Talk-Business-Losing-Your-Location-with-Ryan-Wanner/ba-p/719865
- В closure-shards присутствуют retirement, location closure, continuation online, temporary shutdown/reopened, owner buyout. Не называть весь массив «банкротствами» или «постоянно умершими бизнесами». Несколько адресов одной сети могут быть отдельными историями premises, но не независимыми доказательствами частоты бизнес-неуспеха.
- Подозрение на ошибку «NYC minimum wage remains $17 in 2027» снято: текущая прочитанная страница DOL прямо подтверждает сохранение ставки из-за statutory off-ramp. Старый текст о ежегодной индексации не опровергает нынешнее решение. Источник: https://dol.ny.gov/minimum-wage
- Отсутствие числовых effects у новых исследовательских levers намеренное; их нельзя импортировать как бесплатные действия с обещанным результатом. Это deferred decision specification до локальной сметы/измерения, что указано в working contract.

## 5. Перепроверка через веб

Поиск продолжался при аудите: `site.dol.ny.gov minimum wage New York City 2027 17.00`; `site.nyc.gov food violations chapter 23 penalty condition level`; `site.dol.ny.gov hospitality industry call in pay regularly scheduled shift`; `site.nysenate.gov labor 198 good faith liquidated damages`; `site.agriculture.ny.gov home processing wholesale restaurants`; `site.tax.ny.gov LLC filing fee $25`; `site.tax.ny.gov sales tax filing monthly quarterly annual`; `site.nyc.gov commercial waste zones 2026 phase implementation`; `site.nyc.gov customer toilets 20 seats prior December 5 1977`; `site.sba.gov borrower sell collateral prior written consent 7a`.

Прочитаны по полным URL и сверены title: DOL minimum wage, текущая NYC penalty table, NYLL198, NY Agriculture Home Processing, NYC FSE permit, Cornell §146-1.5 (официальный wage-order PDF повторно недоступен), NYS IT-204-LL instructions, NYC81.04, SBA lenders. Ссылки из результатов поиска, не открытые заново в этом проходе, не называю newly opened/verified. Аудит не заменяет отдельную проверку всех цен и всех цитат в итоговой сборке.
