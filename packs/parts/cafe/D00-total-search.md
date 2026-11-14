# D00 — кафе: тотальный поиск

Дата среза: 14 ноября 2026 года. Ниша: небольшое кафе одного владельца в Нью-Йорке. Ветка: `research/d00-cafe-total-search`.

## 1. Вердикт в пяти строках

1. Собрано **342 события, 240 неочевидных выводов, 80 историй закрытий и 317 уникальных использованных источников**; все минимумы D00 превышены — [машинный подсчёт](D00-validation.json).
2. Охвачены помещение, ремонт до выручки, оборудование, продукты, люди, деньги, улица, спрос, регулирование и выход; есть проход по дню и году — [фрагмент пакета](D00-total-search.json).
3. Поиск шёл на английском, русском и испанском; первоисточники отделены от новостей, саморассказов и поисковых выдержек — `sources` и `extra.searchLog` в JSON.
4. У каждого события есть наблюдаемый сигнал и как минимум два законных хода; неизвестные цены, сроки поломок и коэффициенты потерь не выдуманы и не включены в расчёт месяца.
5. Это проверяемый исследовательский каталог и исправления пакета; числовая калибровка перечисленных механик остаётся отдельной работой, а утверждение «весь интернет исчерпан» не делается.

## 2. Что добавлено и как проверено

Прочитан весь [NICHE-DEEP](../../../build/NICHE-DEEP.md). Основа — `claude/global-entrepreneur-product-133cix`, коммит `0dd297bd0b9470e616f85c50c0a675ac5f58d862`. Получена и сравнена `claude/keen-cray-yytcbp`, коммит `2b2521f202989e19a40a866de19e54f9250ce6c0`: расчёт ремонта по площади и спроса по пешеходному потоку не повторяется. Сверка существующих и недостающих тем сохранена в `extra.baselineCoverage`.

| Раздел фрагмента | Записей | Назначение |
|---|---:|---|
| `extra.eventCatalog` | 342 | Сигнал, масштаб, выбор, доказательство и границы применимости |
| `extra.researchLevers` | 342 | Варианты законного ответа на каждое событие |
| `extra.nonObvious` | 240 | Вывод, почему новичок его пропустит, ссылка |
| `extra.failureStories` | 80 | Что закрылось, объяснение, урок, короткая цитата и её автор |
| `sources` | 317 | Реестр уникальных использованных URL с доступом и `usedBy` |
| `extra.ownerDay` | 20 | Все часы суток: ночной блок и последовательность рабочих задач |
| `extra.ownerYear` | 12 | Помесячный план проверки обязанностей и спроса |
| `extra.mechanics` | 8 | Предложения ведущему без выдуманных числовых параметров |
| `extra.baselineCoverage` | 16 | Тематическое сравнение с основным пакетом |
| `extra.baselineNumericAudit` | 63 | Проверка статуса доказательств исходных числовых записей |
| `extra.verifiedFacts` | 7 | Отдельно подтверждённые тарифы, налоговая ставка и сумма для конкретного кода нарушения |
| `extra.calendarAnchors` | 4 | Даты из нужных учебных календарей, не прогноз выручки |
| Исправления `setup` / `staff` | 13 / 1 | Уточнение доказательств по тем же ID |
| Исправления `ruleCards` / `shortcuts` / `violations` | 4 / 2 / 11 | Правовая область действия, смысл и неподтверждённые формулы |
| Исправления `monthlyCosts` / `taxes` | 5 / 1 | Область услуг, условия платежей и налоговая применимость |
| Исправления `capacity` / `benchmarks` | по одному объекту | Устранение неверного обоснования |

Счётчики относятся к конечному фрагменту, а не сумме черновиков. Объединены совпадающие события и выводы; слишком общие «неочевидные» пункты исключены. Решения перечислены в [D00-dedup.json](D00-dedup.json); исходные свидетельства сохранены в `D00-evidence/`. Повтор URL с другим трекером, фрагментом или зеркалом `home*.nyc.gov` не даёт ещё один источник. Источник, который нигде не используется, не входит в минимум.

| Масштаб события | Записей |
|---|---:|
| Точка | 309 |
| Квартал | 12 |
| Город | 6 |
| Страна | 8 |
| Мир | 7 |

Каталог включает условия аренды и ремонта, невозможность открытия без согласований, покупку активов и непередаваемые разрешения, скрытые проблемы инженерных систем, ввод оборудования и качество воды, холодовую цепь, аллергенные замены, минимальные заказы и возвраты, трудовые права и страхование, кассовые разрывы, комиссии и офлайн-платежи, гололёд, снег, леса, шум, мусор, городские работы, школьный календарь, переполнение очереди, соседей, отзывы, уход владельца и обязательства после закрытия. Влияние каждого условия определяется состоянием конкретной точки; общий коэффициент «плохая погода уменьшает выручку» не назначен.

### Закрытия: единица учёта

В `failureStories` сохранена терминология задания, но статус описывает реальный исход. Временные остановки, уход на пенсию, переезд, прекращение одного канала и смена оператора явно различаются. Причина со слов владельца не становится результатом финансового аудита; неизвестная причина так и помечена. Настоящие названия используются только как исторические свидетельства.

Из 80 карточек 11 имеют временный статус; остальные 69 также нельзя называть банкротствами. Независимая проверка и оговорки о повторном учёте точек одного бренда — в [аудите историй](D00-closure-audit.md). У каждой карточки есть ссылка и короткая атрибутированная цитата; дополнительные подтверждения состоявшегося закрытия сохранены в `supportingSources`.

### День владельца и команды

Это иллюстративная карта задач, а не исследованный средний график и не предложение одному человеку работать круглосуточно. Часы — организационные метки; обязанности возникают по состоянию бизнеса. Ночной блок покрывает каждый час с полуночи до начала подготовки.

| Время | Задача и возможный сбой | Доказательство механизма |
|---|---|---|
| 00:00–04:00 | Хранение ночью: закрытая дверь не отменяет безопасное хранение продуктов. | [источник](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-46103) |
| 05:00 | До работы с едой проверить присутствие сертифицированного ответственного; приёмка начинается раньше открытия. | [источник](https://nyc-business.nyc.gov/nycbusiness/resources-by-industry/restaurant) |
| 06:00 | Приёмка: состояние, документы, размещение; неподходящую поставку отклонить или сократить меню. | [источник](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-46103) |
| 07:00 | Вход: снег и лёд; срок уборки отсчитывается от окончания осадков, а не открытия кафе. | [источник](https://www.nyc.gov/site/dsny/what-we-do/snow-response/snow-laws.page) |
| 08:00 | Утреннее обслуживание: очередь не должна мешать безопасной работе и выдаче. | [источник](https://nyc-business.nyc.gov/nycbusiness/resources-by-industry/restaurant) |
| 09:00 | Сверка оплаты: продажи в отчёте и деньги на банковском счёте могут не совпасть. | [источник](https://squareup.com/help/us/en/article/8328-troubleshoot-missing-transfers) |
| 10:00 | Контроль продуктов и охлаждения: показание холодильника не заменяет измерение продукта. | [источник](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-46103) |
| 11:00 | Подготовка меню: проверить аллергенную информацию во всех каналах. | [источник](https://www.nyc.gov/site/doh/business/food-operators/required-signs.page) |
| 12:00 | Передача смены: незавершённые заказы и квалифицированное покрытие. | [источник](https://nyc-business.nyc.gov/nycbusiness/resources-by-industry/restaurant) |
| 13:00 | Разогрев: процесс зависит от блюда и дальнейшего способа подачи. | [источник](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-46103) |
| 14:00 | Проверка окружения: фактический школьный календарь меняет план закупки, но не гарантирует спрос. | [источник](https://www.schools.nyc.gov/calendar/2026-2027-school-year-calendar) |
| 15:00 | Учёт налогов: периоды sales tax не равны обычным календарным кварталам. | [источник](https://www.tax.ny.gov/help/calendar/2026.htm) |
| 16:00 | Следующая закупка: учитывать пригодный остаток и уже принятые обязательства. | [источник](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-46103) |
| 17:00 | Решение о поздней работе: к публичным часам добавляются подготовка и уборка. | [источник](https://nyc-business.nyc.gov/nycbusiness/resources-by-industry/restaurant) |
| 18:00 | Завершение обслуживания: сохранить безопасный остаток, списать сомнительный; возраст сам по себе не нарушение. | [источник](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-46103) |
| 19:00 | Кофемашина: очистка кофейных остатков и работа с накипью решают разные задачи. | [источник](https://www.lamarzoccousa.com/news/blog/how-to-backflush-your-espresso-machine/) |
| 20:00 | Закрытие помещения: оборудование, замки, отходы, вход и передача ответственности. | [источник](https://nyc-business.nyc.gov/nycbusiness/resources-by-industry/restaurant) |
| 21:00 | Зарплатный учёт: срок налоговой декларации не заменяет срок перечисления налога. | [источник](https://www.irs.gov/businesses/small-businesses-self-employed/employment-tax-due-dates) |
| 22:00 | Резерв и нагрузка владельца: прибыль до налогов не равна доступному личному доходу. | [источник](https://restaurant.org/research-and-media/media/press-releases/new-resource-from-national-restaurant-association-provides-insights-into-operational-realities) |
| 23:00 | План следующего открытия: нерешённый ремонт требует сервисного решения или изменения меню. | [источник](https://www.lamarzoccousa.com/news/blog/summer-espresso-machine-service/) |

### Год по месяцам

Это план наблюдения и исполнения обязанностей, а не календарь обязательных неприятностей. Частота подачи отчётности, применимость правил и местный состав гостей проверяются отдельно. Фактические даты вынесены в `calendarAnchors`; календарь учебного года нельзя механически переносить на следующий.

| Месяц | Что проверить и что может пойти не так | Источник |
|---|---|---|
| Январь | Завершение зарплатного года и текущие обязанности; прошлогодние сроки нельзя переносить автоматически. | [источник](https://www.irs.gov/businesses/small-businesses-self-employed/employment-tax-due-dates) |
| Февраль | Школьные перерывы и зимнее обслуживание; расходы на помещение продолжаются. | [источник](https://www.schools.nyc.gov/calendar/2025-2026-school-year-calendar) |
| Март | Применимый период sales tax и резерв денег; налоговый квартал имеет собственные границы. | [источник](https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/filing_requirements_for_sales_and_use_tax_returns.htm) |
| Апрель | Платежи владельца и зарплатная отчётность; прибыль точки не равна налоговой базе владельца. | [источник](https://www.tax.ny.gov/help/calendar/2026.htm) |
| Май | Подготовка оборудования к летнему меню; смена ассортимента обнаруживает отложенное обслуживание. | [источник](https://www.lamarzoccousa.com/news/blog/summer-espresso-machine-service/) |
| Июнь | Применимая квартальная отчётность и закупки; высокие продажи могут совпасть со сроком налогового платежа. | [источник](https://www.tax.ny.gov/help/calendar/2026.htm) |
| Июль | Состояние оборудования в жаркий сезон; бюджет на ремонт ещё не означает забронированный сервис. | [источник](https://www.lamarzoccousa.com/news/blog/summer-espresso-machine-service/) |
| Август | Штат и меню перед учебным годом; закупки по прошлому календарю могут не подойти. | [источник](https://www.schools.nyc.gov/calendar/2026-2027-school-year-calendar) |
| Сентябрь | Реальные даты начала занятий и налогового платежа; календарь не гарантирует прирост заказов. | [источник](https://www.schools.nyc.gov/calendar/2026-2027-school-year-calendar) |
| Октябрь | Ответственность за зимний вход; письменный план требует исполнителя. | [источник](https://www.nyc.gov/site/dsny/what-we-do/snow-response/snow-laws.page) |
| Ноябрь | Предстоящие обязательства и праздничные часы; государственный праздник не определяет часы кафе. | [источник](https://www.tax.ny.gov/help/calendar/2026.htm) |
| Декабрь | Инвентаризация, чаевые, выплаты и налоговые записи; обязательства не становятся личной выручкой. | [источник](https://www.irs.gov/businesses/small-businesses-self-employed/employment-tax-due-dates) |

## 3. Пятнадцать самых неочевидных находок

1. Покупка «только оборудования» у закрывающегося кафе может попасть под bulk-sale procedure. Нужно проверять налоговую ответственность покупателя до расчёта и передачи активов. [источник](https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/bulk_sales.htm)

2. Good guy guarantee может ограничивать личную гарантию при соблюдении условий, но не автоматически прекращать обязательства компании-арендатора. [источник](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf)

3. Вода, пригодная для питья, не обязательно соответствует спецификации кофемашины и условиям её гарантии. [источник](https://lamarzoccousa.com/wp-content/uploads/2025/07/MAN.29.1_LINEA_EN_V1.0_ONLINE-1.pdf)

4. Удаление накипи и очистка кофейных масел — разные операции. Название «средство для кофемашины» не доказывает, что процедура обслуживает все её узлы. [источник](https://urnex.com/faqs)

5. Увеличение партии супа меняет задачу охлаждения, а не только закупочную стоимость. Наличие холодильника само по себе не доказывает соблюдение процесса. [источник](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-46103)

6. Правило о пластиковых трубочках не равно полному запрету: предусмотренные трубочки нужно иметь для выдачи по просьбе клиента. [источник](https://www.nyc.gov/site/dsny/businesses/materials-handling/plastic-straws.page)

7. Пластиковая заглушка для отверстия крышки регулируется иначе, чем запрошенная трубочка; замена одного предмета другим не является обходом требования. [источник](https://www.nyc.gov/site/dsny/businesses/materials-handling/plastic-straws.page)

8. Сброс или переустановка кассовой системы может уничтожить ещё не отправленные офлайн-платежи. Сначала нужно разбираться с состоянием платежей. [источник](https://squareup.com/help/us/en/article/7777-process-card-payments-with-offline-mode)

9. Заказ через приложение у стойки не становится автоматически дистанционной покупкой: применимость городского запрета отказа от наличных зависит от фактической ситуации. [источник](https://www.nyc.gov/assets/dca/downloads/pdf/businesses/CashlessBanGuidance-AppBasedTransactions.pdf)

10. Нулевой счётчик пешеходов в данных DOT может означать пропущенное наблюдение. Нельзя превращать его в доказанное отсутствие людей. [источник](https://www.nyc.gov/html/dot/downloads/pdf/bi-annual-ped-count-readme.pdf)

11. Изменение меню в кабинете доставки может быть перезаписано интеграцией с кассой. Исправлять нужно соответствующий источник данных. [источник](https://help.doordash.com/en-us/merchants/article/integration-manage-menu)

12. Сертифицированное ответственное лицо нужно и при приёмке/подготовке до открытия дверей. Сертификат отсутствующего сотрудника не покрывает смену. [источник](https://nyc-business.nyc.gov/nycbusiness/resources-by-industry/restaurant)

13. Дата обязанности по аллергенной информации и дата начала определённого взыскания — разные вещи. Позднее enforcement не означает отсутствие требования сейчас. [источник](https://www.nyc.gov/site/doh/business/food-operators/required-signs.page)

14. Отраслевая медиана прибыли до налогов не равна чистому доходу владельца. Медианы разных долей расходов нельзя вычитать друг из друга как детали одного среднего кафе. [источник](https://restaurant.org/research-and-media/media/press-releases/new-resource-from-national-restaurant-association-provides-insights-into-operational-realities)

15. Разрешённая закупка упакованных продуктов у независимого зарегистрированного домашнего производителя отличается от приготовления собственного меню кафе на домашней кухне владельца. [источник](https://agriculture.ny.gov/food-safety/home-processing)

## 4. Исправления существующего пакета

Все исправления используют прежний `id`. Фрагмент нужно объединять рекурсивно, а массивы — по `id`; он не заменяет основной файл целиком. Неуказанные поля сохраняются. Движок, общий пакет и основной `packs/cafe.json` в этой ветке не изменены.

| Запись | Исправляю, потому что… | Опора |
|---|---|---|
| `capacity` | Требование квалифицированного покрытия не обосновывает универсальный минимум численности. Плановая вместимость и трудозатраты требуют отдельного измерения. | [источник](https://nyc-business.nyc.gov/nycbusiness/resources-by-industry/restaurant) |
| `benchmarks` | Национальная выборка limited-service restaurants не является выборкой малых кафе NYC; прибыль до налогов нельзя переименовывать в чистую. Разность медиан не является медианой разности. | [источник](https://restaurant.org/research-and-media/media/press-releases/new-resource-from-national-restaurant-association-provides-insights-into-operational-realities) |
| `ruleCards.no_food_protection_cert`, `staff.shift_lead` | Приёмка и подготовка требуют покрытия до публичного открытия; должность сама по себе не определяет право на участие в чаевых. | [источник](https://nyc-business.nyc.gov/nycbusiness/resources-by-industry/restaurant) |
| `ruleCards.spoiled_food`, `shortcuts.keep_old_food` | «Вчерашний» продукт не автоматически испорчен. Триггер — неподходящее обращение, состояние или загрязнение. Наследуемая экономия не подтверждена. | [источник](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-46103) |
| `ruleCards.second_generation_space` | Готовая отделка не доказывает передачу разрешений, пригодность активов, согласие арендодателя и налоговую чистоту сделки. | [источник](https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/bulk_sales.htm) |
| `ruleCards.unapproved_food_source`, `shortcuts.home_baked_pastries`, соответствующее нарушение | Нельзя объявлять любой продукт независимого зарегистрированного домашнего производителя запрещённым; проверить продукт, упаковку и статус поставщика. | [источник](https://agriculture.ny.gov/food-safety/home-processing) |
| `violations.dirty_surfaces`, `pest_activity`, `spoiled_food`, `unapproved_food_source` | Уровень условия в таблице нарушения описывает тяжесть/распространённость, а не число прошедших месяцев. Удалено неподтверждённое автоматическое ежемесячное нарастание. Остальные игровые эффекты не повышены до verified. | [источник](https://www.nyc.gov/assets/doh/downloads/pdf/about/healthcode/health-code-chapter23.pdf) |
| `violations.no_fse_permit` | Нужно проверять законное право начать работу, условия после подачи заявления и остальные разрешения; наличие бумаги само по себе не полный триггер. Default judgment не обычный максимальный штраф. | [источник](https://www.nyc.gov/assets/doh/downloads/pdf/about/healthcode/health-code-chapter23.pdf) |
| `violations.grease_interceptor_neglect` | Удалено неподтверждённое помесячное нарастание; шкала привязана к повторным нарушениям. Обычный штраф и взыскание при неявке различаются; расхождение первоисточников по default оставлено нерешённым. | [источник](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-118762) |
| `violations.tip_theft`, `unpaid_training_time`, `spread_of_hours_unpaid` | Недоплата, liquidated damages, проценты и иные санкции имеют разные условия. Игровой множитель и репутационный эффект не универсальны. | [источник](https://www.nysenate.gov/legislation/laws/LAB/198) |
| Часть `setup` | Прайс подтверждает только конкретную цену при конкретных условиях. Он не подтверждает срок службы, бонус качества, наличие или ожидание разрешения. Покупные цены не переписаны без новых доказательств. | Индивидуальные source и note в JSON; аудит ниже |

Проверены все исходные числовые записи, включая отдельные поля и числовые утверждения в примечаниях; точные количества проверок сохранены в `D00-validation.json` → `baselineAudit`. Полевая проверка исходных чисел сохраняется отдельно в `D00-baseline-audit-*.json` и сопоставляется с `extra.baselineNumericAudit`. Статус открытой страницы не равен подтверждению всех полей записи. В частности, товарный прайс не подтверждает срок эксплуатации, штатная ставка не подтверждает часы, законодательная сумма не подтверждает репутационный штраф игры. Не подтверждённые в этой работе коэффициенты не выдаются за новые факты.

В `taxes.sales_tax` сохранена подтверждённая ставка, но снято blanket-verified с периодичности и состава облагаемых заказов. В `monthlyCosts` уточнены выборка страхового брокера, неполный отпускной резерв, буфер в цене payroll, условность LLC-платежа и границы услуг бухгалтера. Подтверждённые компоненты и ссылки находятся в [финансовом аудите](D00-baseline-audit-finance.json).

Дополнительно исправлены неточные ссылки на правила хранения, источник школьного календаря для начала календарного года и описание Black Lab: убытки сообщены совладельцами, а причинная роль тематики заведения не доказана. Подробности — [проверка доказательств](D00-evidence-review.md) и [аудит закрытий](D00-closure-audit.md).

## 5. Просьбы к ведущему — новые механики

`PackLever` требует числовую стоимость, а у найденных решений универсальной цены нет. Поэтому варианты сохранены в `extra.researchLevers` и связаны с событиями через `playerMoves`/`optionId`. Это проверяемые предложения для интеграции; неизвестная цена не заменена бесплатным действием. До калибровки каталог не следует автоматически включать в игровой расчёт.

| Механика | Решение игрока и необходимое состояние |
|---|---|
| Активация доказанного сценария | Использовать записанный сигнал состояния или заранее объявленный общий сценарий. Не вводить случайную частоту неприятностей. |
| Ремонт без выручки | Хранить начало аренды, льготный период, зависимости разрешений, готовность оборудования и фактическое открытие. Считать договорные платежи в каждом ещё не открытом месяце. |
| Покупка работающего кафе | Разделить активы, остатки, согласие по аренде, налоговую процедуру, залоги и новые разрешения; игрок может отказаться до безусловного обязательства. |
| Полный рабочий день | Отдельно учитывать приёмку, подготовку, обслуживание, уборку, оплачиваемое время и квалифицированное покрытие. |
| Даты и ликвидность | Налоговые периоды, перечисления, кассовые поступления, основной долг и ограниченные деньги не заменяются месячной прибылью. |
| Состояние продуктов | Продукт, партия, измерение, история обращения и решение о продаже/изъятии вместо признака «вчерашний». |
| Версия правила | Хранить юрисдикцию, применимость, дату обязанности и дату enforcement; не переносить будущую санкцию назад. |
| Словарь прибыли | Разделить прибыль до налогов, труд владельца, выплаты по основному долгу, собранный налог и личный доход. |

Формулировки расчёта, поля и ссылки находятся в `extra.mechanics`. Это алгоритмические предложения, а не измеренные числовые зависимости. Стоимость ремонта берётся из сметы, аренда — из договора, потери запасов — из состава партии; срок поломки после пропуска обслуживания нельзя назначить без доказанной модели.

При интеграции не начислять одну потерю дважды: устаревший лимит заказов может вызвать тот же фактический затор, который уже описан карточкой очереди. Отдельно различать невозможность открыть пол для уборки и пропуск уборки при доступном полу, отсутствие страхового полиса и истечение действовавшего полиса. Объединённые варианты сохранены как происхождение данных.

Для outdoor dining проверена актуальная редакция: сезонная и круглогодичная лицензии различаются; проект подробных правил не равен уже принятому нормативному акту. Будущие поправки также требуют собственной даты применения. [§19-160](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-236623)

## 6. Не найдено и границы доказательств

- Не установлены универсальные для небольшого кафе NYC цены каждого ремонта, сроки разрешений, продолжительность простоя, время до поломки после экономии на обслуживании, стоимость замены работника и частота закрытий. Нужны конкретная модель, адрес, договор, смета и журнал эксплуатации; они не заменены средними «из головы».
- Не доказаны единые коэффициенты выручки для льда у двери, закрытия станции, жары, дождя, шума, оценки санитарной инспекции, отзывов, запрета ноутбуков и конкурента. Наблюдение события не измеряет его причинный эффект.
- Истории закрытий не представляют случайную выборку и часто не раскрывают бухгалтерию. Споры сторон, слова владельца и установленное судом обстоятельство различаются. Корпус не позволяет рассчитать вероятность банкротства.
- Недоступные полные тексты не выдаются за прочитанные. Для `search_excerpt` сохраняется наблюдавшаяся выдержка и ссылка; числовая или юридическая интеграция требует повторного открытия полноценного первоисточника.
- Условия возврата поставщика зависят от товара и действующего договора; страницы Baldor различались деталями. Общий принцип проверки при приёмке не превращён в универсальный список исключений.
- Требования к туалету, персоналу, отпуску, страхованию, commercial waste zones, налоговой периодичности и лизингу зависят от фактов. Сеть/франшиза, независимое кафе и домашний производитель не объединены в одну правовую категорию.
- Национальные отраслевые отчёты и опыт России, Испании, Аргентины и других мест дают вопросы для проверки, но не нью-йоркские цены, законы и коэффициенты. Reddit и форумы — саморассказы, а не подтверждённая личность или аудит.
- Остаточные предположения основного пакета перечислены в индивидуальном числовом аудите. Понижение `confidence` сообщает об ограничении; оно не делает неверифицированную модель готовой к использованию.

Полный список ограничений находится в `extra.gaps`. Неоткрытая страница помечена именно как неоткрытая; формулировка «данных нигде нет» не используется.

## 7. Источники и воспроизводимость

В итоговом реестре 317 уникальных использованных URL: 204 открытых первоисточников, 74 открытых вторичных источников и 39 источников, доступных по поисковой выдержке. Языки: EN — 304, RU — 8, ES — 5. Эти количества — свойства сохранённого набора, а не оценка охвата интернета; [подсчёт](D00-validation.json).

Поисковые запросы и направления сохранены в `extra.searchLog`; рабочие массивы — в `D00-evidence/`. Реестр ниже показывает качество доступа. В JSON у источника есть `usedBy`, позволяющий перейти от URL к конкретным карточкам. Индивидуальные повторные проверки исходных чисел находятся в файлах аудита и могут включать дополнительные ссылки, которые не использованы для увеличения минимума источников каталога.

Сборка и структурная проверка:

```bash
python packs/parts/cafe/D00-build.py --final
node build/validate-pack.mjs /tmp/d00-cafe-overlay.json packs/_common.json
git diff --check
```

Проверяется объединение фрагмента с исходным пакетом, поскольку неполный фрагмент сам по себе не является самостоятельным игровым пакетом. Проверки ID, источников, уровней, масштаба, вариантов решений, отсутствия новых числовых эффектов и минимальных объёмов проходят. Отдельно проверяется суммарный размер коротких цитат на источник. Автоматическая проверка не доказывает причинность и не заменяет чтение страницы.

Изменения сохранены в отдельной ветке и контрольных коммитах. Повторная публикация итогового коммита отклонена Git с HTTP 403 (доступ к репозиторию запрещён для `diiaanns07-droid`); подключённый GitHub также вернул `Resource not accessible by integration`. Пользователь настраивает доступ. Локальная ветка и переносимый Git bundle сохранены; успешная удалённая публикация не заявляется. Pull request не создаётся по условиям задания.

| ID | Источник | Язык | Доступ |
|---|---|---|---|
| `d00_closures_nyc_source_ashbox` | [Ashbox Cafe closes](https://greenpointers.com/2026/08/24/beloved-greenpoint-staple-ashbox-cafe-closes-its-doors/) | EN | открыт вторичный |
| `d00_closures_nyc_source_lalo` | [Coffee shop to replace Cafe Lalo](https://www.westsiderag.com/2025/10/06/coffee-shop-set-to-replace-iconic-uws-cafe-lalo) | EN | поисковая выдержка |
| `d00_closures_nyc_source_silver` | [Silver Moon Bakery closes its doors](https://www.westsiderag.com/2025/03/24/after-a-quarter-century-uwss-silver-moon-bakery-closes-its-doors) | EN | поисковая выдержка |
| `d00_closures_nyc_source_silver_cause` | [Silver Moon closure announcement](https://www.timeout.com/newyork/news/beloved-silver-moon-bakery-is-permanently-closing-at-the-end-of-the-month-031125) | EN | поисковая выдержка |
| `d00_closures_nyc_source_neils` | [Neil’s Coffee Shop closes](https://ny.eater.com/2023/3/20/23648664/neils-coffee-shop-closes-nyc-diner) | EN | открыт вторичный |
| `d00_closures_nyc_source_joe` | [NYC restaurant closings January 2024](https://ny.eater.com/2024/1/5/24022407/nyc-restaurant-closings-january-2024) | EN | открыт вторичный |
| `d00_closures_nyc_source_compilation` | [NYC restaurant closings November 2022](https://ny.eater.com/2022/11/4/23428427/nyc-restaurant-closings-november-2022) | EN | открыт вторичный |
| `d00_closures_nyc_source_citybakery` | [City Bakery officially closes](https://ny.eater.com/2019/10/21/20924653/city-bakery-closed-nyc) | EN | открыт вторичный |
| `d00_closures_nyc_source_cup` | [Cup & Saucer goes dark](https://bedfordandbowery.com/2017/07/diner-death-notice-cup-saucer-goes-dark/) | EN | поисковая выдержка |
| `d00_closures_nyc_source_cup_cause` | [Cup & Saucer closure announcement](https://www.thelodownny.com/leslog/2017/07/cup-saucer-classic-lower-east-side-diner-is-closing-next-week.html) | EN | поисковая выдержка |
| `d00_closures_nyc_source_beit` | [NYC restaurant closings December 2022](https://ny.eater.com/2022/12/2/23482435/nyc-restaurant-closings-december-2022) | EN | поисковая выдержка |
| `d00_closures_nyc_source_doma` | [Doma Cafe closes with relocation plans](https://ny.eater.com/2012/3/27/6601661/doma-cafe-on-perry-street-closes-with-plans-to-relocate) | EN | поисковая выдержка |
| `d00_closures_nyc_source_orlin` | [Cafe Orlin has closed](https://ny.eater.com/2017/10/17/16483070/cafe-orlin-closed-nyc) | EN | открыт вторичный |
| `d00_closures_nyc_source_saltie` | [Saltie announces closure](https://ny.eater.com/2017/12/19/16796350/saltie-closing-williamsburg-nyc) | EN | открыт вторичный |
| `d00_closures_nyc_source_saltie_confirm` | [Later reporting confirms Saltie closure](https://ny.eater.com/2018/5/21/17377386/clare-collerton-saltie-dead) | EN | поисковая выдержка |
| `d00_closures_nyc_source_glaser_closed` | [Glaser’s Bake Shop closed](https://www.amny.com/lifestyle/eat-and-drink/glasers-bake-shop-closed-1-19539962/) | EN | поисковая выдержка |
| `d00_closures_nyc_source_glaser_retire` | [Glaser’s retirement announcement](https://ny.eater.com/2018/3/2/17072872/glasers-bake-shop-closing-nyc) | EN | поисковая выдержка |
| `d00_closures_nyc_source_zucker_reason` | [Glaser’s and Zucker departure report](https://ny.eater.com/2018/6/29/17517924/glasers-bake-shop-zucker-closing-nyc) | EN | открыт вторичный |
| `d00_closures_nyc_source_zucker_closed` | [Zucker Bakery venue listing](https://ny.eater.com/venue/42656/zucker-bakery) | EN | поисковая выдержка |
| `d00_closures_nyc_source_ost` | [Ost Cafe owner’s closing statement](https://evgrieve.com/2017/02/ost-cafe-closes-on-sunday.html) | EN | открыт вторичный |
| `d00_closures_nyc_source_ost_confirm` | [Eulogy for Ost Cafe](https://www.josephineellen.com/nyc-coffeeshop-ost-cafe/) | EN | поисковая выдержка |
| `d00_closures_nyc_source_ciao` | [Ciao For Now final cafe service](https://evgrieve.com/2018/01/last-day-for-ciao-for-now.html) | EN | открыт вторичный |
| `d00_closures_nyc_source_ciao_after` | [Ciao For Now introduces evening soup service](https://evgrieve.com/2018/03/ciao-for-now-starting-tuesday-evening.html) | EN | поисковая выдержка |
| `d00_closures_nyc_source_absolute` | [Absolute Bagels shuts down](https://abc7ny.com/post/absolute-bagels-beloved-shop-upper-west-side-suddenly-shuts-down-leaving-customers-upset/15652931/) | EN | поисковая выдержка |
| `d00_closures_nyc_source_absolute_choice` | [Absolute employee on decision not to reopen](https://www.columbiaspectator.com/arts-and-culture/2024/12/12/a-huge-loss-absolute-bagels-closes-after-34-years-of-business/) | EN | поисковая выдержка |
| `d00_closures_nyc_source_coretto` | [NYC closures February 2024](https://ny.eater.com/2024/2/2/24053684/nyc-restaurant-closings-february-2024) | EN | открыт вторичный |
| `d00_closures_nyc_source_cranberry` | [Cranberry’s closes](https://ny.eater.com/2020/7/6/21314665/brooklyn-heights-cranberrys-cafe-nyc-closed) | EN | поисковая выдержка |
| `d00_closures_nyc_source_blacklab` | [NYC closures February 2025](https://ny.eater.com/2025/2/7/24356123/nyc-restaurant-closings-february-2025) | EN | открыт вторичный |
| `d00_closures_nyc_source_chalait` | [Chalait shutters final cafe](https://www.ilovetheupperwestside.com/matcha-spot-chalait-shutters-its-final-location-on-the-upper-west-side/) | EN | поисковая выдержка |
| `d00_closures_nyc_source_petit` | [NYC closures August 2024](https://ny.eater.com/2024/8/2/24208696/nyc-restaurant-closings-august-2024) | EN | поисковая выдержка |
| `d00_closures_nyc_source_petit_relocate` | [Le Petit Parisien seeks relocation](https://www.westsiderag.com/2024/08/07/openings-le-petit-parisien-central-park-farm-stand-the-avenue-updog-studios-alices-tea-cup) | EN | поисковая выдержка |
| `d00_closures_nyc_source_edgar` | [NYC closures May 2026](https://ny.eater.com/news/411103/nyc-restaurants-closed-may-2026) | EN | поисковая выдержка |
| `d00_closures_nyc_source_edgar_owner` | [Edgar’s owner explains planned closure](https://www.ilovetheupperwestside.com/a-beloved-upper-west-side-cafe-is-closing-after-nearly-four-decades/) | EN | поисковая выдержка |
| `d00_closures_nyc_source_caffeine` | [Caffeine Underground goes underground](https://grime-square.com/2026/03/30/caffeine-underground-goes-underground/) | EN | открыт вторичный |
| `d00_closures_nyc_source_caffeine_confirm` | [Senator Salazar lists completed local closures](https://www.nysenate.gov/newsroom/press-releases/2026/julia-salazar/senator-salazar-rallies-jimmys-corner-and-small-business?page=0) | EN | поисковая выдержка |
| `d00_closures_nyc_source_vineapple` | [Customers revive Vineapple Cafe](https://www.brownstoner.com/brooklyn-life/brooklyn-heights-vineapple-cafe-restaurant-reopens-71-pineapple-street/) | EN | поисковая выдержка |
| `d00_closures_nyc_source_boris` | [That’s a wrap for now at Boris & Horton](https://evgrieve.com/2024/12/thats-wrap-for-now-at-boris-horton.html) | EN | открыт вторичный |
| `d00_closures_nyc_source_boris_buyer` | [First look at revamped Boris & Horton](https://evgrieve.com/2025/04/first-look-at-revamped-dog-cafe-boris.html) | EN | поисковая выдержка |
| `d00_closures_nyc_source_littleneck` | [The rise and fall of Littleneck](https://www.bkmag.com/2024/03/11/the-setting-of-the-sun-is-a-difficult-time-for-all-fish-the-rise-and-fall-of-littleneck/) | EN | открыт первоисточник |
| `d00_closures_nyc_source_blackseed` | [Fire temporarily shutters Black Seed Bagels in Nolita](https://ny.eater.com/2019/3/7/18254534/fire-nolita-black-seed-bagels) | EN | открыт вторичный |
| `d00_closures_nyc_source_pudge` | [Cafe faces eviction case after sprinkler damage and reconstruction](https://tollbit.gothamist.com/2017/05/24/kushner_evict_pudge_knuckles.php) | EN | открыт вторичный |
| `d00_closures_nyc_source_upright` | [NYC restaurant closings July 2025](https://ny.eater.com/restaurant-closings-2/400141/nyc-restaurant-closings-july-2025) | EN | открыт вторичный |
| `d00_closures_nyc_source_birdbath` | [Birdbath in the Vesuvio storefront has closed](https://www.6sqft.com/birdbath-in-sohos-iconic-green-vesuvio-bakery-has-closed/) | EN | открыт вторичный |
| `d00_closures_nyc_source_pickmeup` | [New tenant enters former Cafe Pick Me Up space](https://www.dnainfo.com/new-york/20151005/east-village/venezuelan-eatery-opening-former-cafe-pick-me-up-space/) | EN | открыт вторичный |
| `d00_closures_nyc_source_white_noise` | [White Noise Coffee FLSA complaint](https://www.dol.gov/sites/dolgov/files/OPA/newsreleases/2024/10/WHD20241833_White_Noise_FLSA_Complaint_.pdf) | EN | поисковая выдержка |
| `d00_closures_nyc_source_vivaldi` | [Caffe Vivaldi closed and furnishings offered as souvenirs](https://www.amny.com/entertainment/caffe-vivaldi-closed-1.19421765/) | EN | открыт вторичный |
| `d00_closures_nyc_source_cornelia` | [Villagers speak as Cornelia Street Cafe closes](https://westviewnews.org/2019/02/04/villagers-speak-as-cornelia-street-cafe-curtain-comes-down/gcapsis/) | EN | открыт первоисточник |
| `d00_closures_nyc_source_cornelia_cause` | [Cornelia Street Cafe history and closure](https://www.timeout.com/newyork/news/did-lady-gaga-actually-work-at-nycs-cornelia-street-cafe-111521) | EN | открыт вторичный |
| `d00_closures_nyc_source_plymouth` | [Plymouth Cafe serves its last sandwich](https://hoodline.com/2026/06/brooklyn-heights-staple-plymouth-cafe-serves-its-last-egg-sandwich-after-42-years/) | EN | поисковая выдержка |
| `d00_closures_nyc_source_espresso_exclusivity` | [Paris Baguette owner reports neighbor’s espresso exclusivity](https://www.dnainfo.com/new-york/20171027/forest-hills/paris-baguette-radioshack-starbucks-107-06-continental-ave-forest-hills/) | EN | открыт вторичный |
| `d00_closures_nyc_source_outpost_reconcept` | [Littleneck Outpost will reopen as Oh Mercy](https://greenpointers.com/2024/03/07/littleneck-outpost-will-reopen-as-oh-mercy/) | EN | поисковая выдержка |
| `d00_world_src_pnin` | [Owner account: Pnin coffee and books](https://t-j.ru/kofe-i-knigi/) | RU | открыт первоисточник |
| `d00_world_src_lighthaus` | [Lighthaus closes amid rising costs](https://london.eater.com/2022/10/3/23385107/lighthaus-cafe-permanently-closed-leyton) | EN | открыт вторичный |
| `d00_world_src_becquer` | [Cafe Becquer closes without a successor](https://www.eldebate.com/espana/castilla-y-leon/20260908/cierra-falta-relevo-emblematico-cafe-universitario-salamanca-casi-medio-siglo-vida_456199_amp.html) | ES | открыт вторичный |
| `d00_world_src_sarah` | [Sarahs Unplugged closes after lease dispute](https://www.sunshinecoastnews.com.au/2026/02/20/beloved-family-cafe-closes-after-more-than-a-decade/) | EN | открыт вторичный |
| `d00_world_src_finch` | [Finchs downtown tea house closes](https://nomsmagazine.com/downtown-vancouvers-finchs-tea-house-closes/) | EN | открыт вторичный |
| `d00_world_src_kofeedavse` | [KofeEdaVse suspended by court](https://www.kommersant.ru/doc/9077653) | RU | открыт вторичный |
| `d00_world_src_zakulisie` | [Zakulisie was a deliberately time-limited cafe](https://www.kommersant.ru/doc/8623812) | RU | открыт вторичный |
| `d00_world_src_townhouse` | [Townhouse Eaton closes](https://www.perthnow.com.au/news/business/small-business/townhouse-coffee-and-cafe-eaton-cafe-closes-just-seven-months-after-opening-citing-lack-of-govt-support-c-22860468) | EN | открыт вторичный |
| `d00_world_src_sandwichez` | [SandwiChez closes Sant Cugat branch](https://metropoliabierta.elespanol.com/gran-barcelona/20250113/sandwichez-cierra-su-cafeteria-de-sant-cugat-del-valles-por-el-elevado-precio-alquiler-local/916158476_0.html) | ES | открыт вторичный |
| `d00_world_src_nowhere` | [Nowhere Coffee temporarily closes after roof leaks](https://www.lehighvalleypublicmedia.org/news/parkland-east-penn/a-bit-overwhelming-nowhere-coffee-co-temporarily-closed-in-emmaus-following-heavy-losses-from-water-damage/) | EN | открыт вторичный |
| `d00_world_src_ubora` | [Ubora reopens after burst-pipe downtime](https://augustabusinessdaily.com/after-flooding-ubora-coffee-shop-reopens-to-the-delight-of-patrons/) | EN | открыт вторичный |
| `d00_world_src_sisters` | [Sisters Coffee returns after upstairs sprinkler damage](https://dailycoffeenews.com/2019/01/21/sisters-coffee-opens-wonderfully-reimagined-portland-cafe-after-a-fire/) | EN | открыт вторичный |
| `d00_world_src_modelt` | [Model T Coffee closes](https://www.pressherald.com/2025/10/23/model-t-coffee-in-portland-arts-district-has-closed/) | EN | поисковая выдержка |
| `d00_world_src_fuel` | [Fuel closes Broadway coffee counter; owner clarifies cause](https://www.capitolhillseattle.com/2024/09/fuel-pulls-plug-on-broadway-coffee-bar/) | EN | поисковая выдержка |
| `d00_world_src_qazaq` | [Qazaq Coffee closes after public language dispute](https://www.masa.media/ru/site/ot-air-astana-do-magnum-yazykovye-feyly-biznesa) | RU | поисковая выдержка |
| `d00_world_src_commissary` | [Main Street Commissary owner reflects on closure](https://www.channelnewsasia.com/cna-insider/voices/cafe-food-and-beverage-fb-business-eatery-singapore-closure-5365741) | EN | открыт первоисточник |
| `d00_world_src_mocha` | [Mocha Motts closes Vineyard Haven while another site survives](https://www.mvtimes.com/2026/01/15/mocha-motts-open-last-time-sunday/) | EN | открыт вторичный |
| `d00_world_src_cafema` | [Cafe Ma closes after nearby low-price competitors arrive](https://www.koreajoongangdaily.com/business/koreas-coffee-war-pits-shop-against-shop-as-prices-plunge/11337595) | EN | открыт вторичный |
| `d00_world_src_common` | [Common Ground workers reopen after abrupt owner closure](https://nextcity.org/urbanist-news/when-a-cafe-owner-shut-down-his-business-workers-revived-it-as-a-co-op) | EN | открыт вторичный |
| `d00_world_src_goodsline` | [The Goodsline closes despite acclaim](https://www.abc.net.au/news/2023-07-11/australian-cafe-casualty-of-cost-of-living-/102586110) | EN | открыт вторичный |
| `d00_world_src_french` | [French Connection cafe closes after roadworks period](https://www.live95fm.ie/news/live95-news/popular-limerick-coffee-shop-announces-closure/) | EN | открыт вторичный |
| `d00_world_src_interval` | [Interval closes after staff report unpaid wages](https://urbanmilwaukee.com/2025/03/28/interval-is-closed-indefinitely/) | EN | открыт вторичный |
| `d00_world_src_forza` | [Forza cafe closes and auctions equipment](https://www.0223.com.ar/nota/2026-8-10-10-0-0-tristeza-cerro-una-conocida-cafeteria-a-un-ano-de-abrir-y-rematan-absolutamente-todo) | ES | открыт вторичный |
| `d00_world_src_flavour_kinky` | [Former Singapore cafe owners discuss burnout](https://www.channelnewsasia.com/cna-insider/big-read/cafe-coffee-shop-dream-career-work-singapore-fb-eatery-closures-5389511) | EN | открыт вторичный |
| `d00_world_src_alfa` | [Alfa Cafe relinquishes kitchen lease](https://www.channelnewsasia.com/singapore/some-retailers-cut-losses-or-shut-stores-rental-rates-rebound-even-higher-pre-covid-5617966) | EN | открыт вторичный |
| `d00_world_src_route1066` | [Route 1066 Cafe voluntarily closes for pest correction](https://www.itv.com/news/meridian/2024-04-27/biker-cafe-with-rat-infestation-fined-6000-after-droppings-found-in-kitchen) | EN | открыт вторичный |
| `d00_world_src_grande` | [Grande Creperie and Kopi Bar close](https://www.sfchronicle.com/food/restaurants/article/bay-area-close-june-2025-20373011.php) | EN | открыт вторичный |
| `d00_world_src_guerilla` | [Guerilla Cafe closes](https://www.sfchronicle.com/food/restaurants/article/guerilla-cafe-berkeley-closed-21221035.php) | EN | открыт вторичный |
| `d00_world_src_fullers` | [Fullers reopens after hood fire and insurance delay](https://www.kptv.com/2023/11/08/historic-diner-reopens-downtown-portland-months-after-kitchen-fire/) | EN | открыт вторичный |
| `d00_world_src_fuwa` | [Fuwa Fuwa closes after break-in and stolen delivery tablets](https://vancouver.citynews.ca/2026/05/05/vancouver-pancake-restaurant-break-in/) | EN | открыт вторичный |
| `d00_world_src_gogh` | [Gogh Gogh temporarily closes after vehicle hits closed shop](https://www.kbtx.com/2023/07/09/college-station-coffee-cafe-closed-after-vehicle-hits-building/) | EN | открыт вторичный |
| `d00_world_src_lawlss` | [Lawlss closure: tax debt and family operating dependence](https://neenahnewsnow.com/wp-content/uploads/2025/02/February-7-2025-Neenah-News.pdf) | EN | открыт вторичный |
| `d00_world_src_aromat` | [Owner of Aromatny Dom describes closure](https://secrets.tbank.ru/trendy/pochemu-zakryvayutsya-kofejni/) | RU | поисковая выдержка |
| `d00_world_src_zolotoy` | [Owner explains closure of Zolotoy Klyuchik ice-cream cafe](https://secrets.tbank.ru/trendy/kafe-zakryvayutsia/) | RU | поисковая выдержка |
| `d00_world_src_comida` | [RNZ confirms earlier Comida cafe closure amid roadworks](https://www.topsouthnow.co.nz/news/6a76a5e32b7137038bf8e275) | EN | открыт вторичный |
| `d00_world_src_investment_contract` | [Former cafe owner describes investment-contract dispute](https://t-j.ru/i-closed-kofeiniu/) | RU | открыт первоисточник |
| `d00_world_src_paddy_roast` | [Paddy Barrys owner describes roasting complaint](https://www.indailysa.com.au/citymag/food-drink/2024/05/21/bitter-brew-cbd-coffee-spot-to-close-doors) | EN | открыт вторичный |
| `d00_world_src_tenryu` | [Tenryu founder explains losing outside seats](https://www.8days.sg/eatanddrink/newsandreviews/mentai-ya-founder-opens-coffee-chirashi-cafe-grab-driver-632991) | EN | открыт вторичный |
| `d00_world_src_extractor` | [Trafford cafe extractor-noise investigation](https://www.lgo.org.uk/decisions/environment-and-regulation/noise/22-016-501) | EN | открыт первоисточник |
| `d00_world_src_bossa_waste` | [Bossa Nova owner describes dumped waste behind cafe](https://www.ealing.news/ealing-council/opinion-enough-is-enough/) | EN | открыт первоисточник |
| `d00_world_src_reddit_expansion` | [Owner describes debt-constrained coffee-shop expansion](https://www.reddit.com/r/smallbusiness/comments/144nqve/expansion_advice/) | EN | открыт первоисточник |
| `d00_world_src_reddit_acquisition` | [Coffee shop acquisition due diligence discussion](https://www.reddit.com/r/smallbusiness/comments/1hugxet/considering_buying_a_coffee_shop_what_red_flags/) | EN | открыт первоисточник |
| `d00_world_src_reddit_landlord` | [Cafe lease negotiation stalls over fit-out funding disclosure](https://www.reddit.com/r/smallbusinessuk/comments/1t5hz8l/looking_for_advice_regarding_a_potential_space/) | EN | открыт первоисточник |
| `d00_world_src_ethel_retail` | [E for Ethel founders plan retail-only online pivot](https://www.indailysa.com.au/citymag/archive/2021/08/12/melbourne-street-cafe-e-for-ethel-is-shutting-up-shop-and-moving-online) | EN | открыт вторичный |
| `d00_world_src_acoustic_furniture` | [Cafe sound sources beyond music](https://www.europeanacustica.com/insonorizar-cafeteria/) | ES | открыт первоисточник |
| `d00_equipment_food_source_linea` | [Linea commercial espresso machine manual](https://lamarzoccousa.com/wp-content/uploads/2025/07/MAN.29.1_LINEA_EN_V1.0_ONLINE-1.pdf) | EN | открыт первоисточник |
| `d00_equipment_food_source_ny_power` | [When the Power Goes Out: A Guide for Food Operators](https://healthweb-back.health.ny.gov/publications/7082/) | EN | открыт первоисточник |
| `d00_equipment_food_source_ny_boil` | [Boil Water Notices: Food Service Establishment Checklist](https://www.health.ny.gov/environmental/water/drinking/boilwater/docs/checklist_food_service_establishments.pdf) | EN | поисковая выдержка |
| `d00_equipment_food_source_snapchill` | [Snapchill canned coffee recall announcement](https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/snapchill-llc-recalls-canned-coffee-products-due-potential-clostridium-botulinum) | EN | открыт первоисточник |
| `d00_equipment_food_source_owner_issues` | [Cafe owners: problems a new owner should know](https://www.reddit.com/r/Coffee/comments/1cla0xp/cafe_owners_what_issue_are_you_facing_that_a_new/) | EN | открыт вторичный |
| `d00_equipment_food_source_flour` | [Handling Flour Safely](https://www.fda.gov/food/buy-store-serve-safe-food/handling-flour-safely-what-you-need-know) | EN | открыт первоисточник |
| `d00_equipment_food_source_haccp` | [Specialized Processes: HACCP Plan Review Checklist](https://www.nyc.gov/assets/doh/downloads/pdf/rii/haccp-plan-checklist.pdf) | EN | открыт первоисточник |
| `d00_equipment_food_source_straws` | [Plastic Straws, Splash Sticks, and Stirrers](https://www.nyc.gov/site/dsny/businesses/materials-handling/plastic-straws.page) | EN | открыт первоисточник |
| `d00_equipment_food_source_noro` | [Norovirus: Facts for Food Workers](https://www.cdc.gov/norovirus/communication-resources/facts-for-food-workers.html) | EN | открыт первоисточник |
| `d00_equipment_food_source_pfas` | [PFAS in Food Packaging](https://dec.ny.gov/environmental-protection/pollution-prevention/pfas-in-food-packaging) | EN | открыт первоисточник |
| `d00_equipment_food_source_skip` | [Utensils, Condiments, Napkins, and Containers](https://www.nyc.gov/site/dsny/businesses/materials-handling/utensils-condiments-napkins.page) | EN | открыт первоисточник |
| `d00_equipment_food_source_baldor_min` | [Business account order minimum](https://help.baldorfood.com/hc/en-us/articles/360022183633-What-is-the-order-minimum-for-business-accounts) | EN | открыт первоисточник |
| `d00_equipment_food_source_baldor_credit` | [Requesting a pickup or credit](https://help.baldorfood.com/hc/en-us/articles/360024349313-How-can-I-request-a-pickup-or-credit) | EN | открыт первоисточник |
| `d00_equipment_food_source_freight` | [Common carrier shipping](https://www.webstaurantstore.com/common_carrier.html) | EN | открыт первоисточник |
| `d00_equipment_food_source_outlet` | [Outlet Scratch and Dent Return Policy](https://www.webstaurantstore.com/outlet-return-policy.html) | EN | открыт первоисточник |
| `d00_equipment_food_source_baldor_order` | [How to Order](https://www.baldorfood.com/how-to-order) | EN | открыт первоисточник |
| `d00_equipment_food_source_baldor_return` | [Delivery Information](https://www.baldorfood.com/help/delivery-informatin) | EN | открыт первоисточник |
| `d00_equipment_food_source_foamban` | [Foam Food Containers and Packing Peanuts](https://www.nyc.gov/site/dsny/businesses/materials-handling/foam-containers.page) | EN | открыт первоисточник |
| `d00_equipment_food_source_filter` | [Replacing commercial water filter cartridges](https://www.pentair.com/en-us/commercial-filtration/resources-and-education/replacing-your-filter-cartridge.html) | EN | открыт первоисточник |
| `d00_equipment_food_source_urnex` | [Coffee equipment cleaning and descaling FAQ](https://urnex.com/faqs) | EN | открыт первоисточник |
| `d00_equipment_food_source_mahlkonig` | [Cleaning Commercial Coffee Grinders](https://www.mahlkoenig.com/en-de/blogs/news/clean-commercial-coffee-grinders) | EN | открыт первоисточник |
| `d00_equipment_food_source_hobart` | [LXnC Chemical Sanitizing Dishwasher Specification](https://www.hobartcorp.com/sites/default/files/webdam-assets/LXnC%20Chemical%20Sanitizing%20Dishwasher%20Spec%20Sheet%20F48663%20%2809-23%29.pdf) | EN | открыт первоисточник |
| `d00_equipment_food_source_hoshizaki` | [KM H-Series commercial icemaker instructions](https://secure.hoshizakiamerica.com/docs/manuals/KM-E_H-Series_instr.pdf) | EN | открыт первоисточник |
| `d00_equipment_food_source_true` | [TFM Installation Manual](https://dc2kentprodcontent.blob.core.windows.net/installationmanuals/TFM/TFM_ENGLISH.pdf) | EN | поисковая выдержка |
| `d00_equipment_food_source_staling` | [Literature review on roasted coffee staling](https://sca.coffee/sca-news/2012/02/15/what-is-the-shelf-life-of-roasted-coffee-a-literature-review-on-coffee-staling-bjcx7) | EN | открыт вторичный |
| `d00_equipment_food_source_milk_forum` | [Question about holding leftover steamed milk](https://www.reddit.com/r/barista/comments/rl6lot/food_safe_question_for_baristassmart_people/) | EN | открыт вторичный |
| `d00_equipment_food_source_square_offline` | [Process offline payments](https://squareup.com/help/us/en/article/7777-process-card-payments-with-offline-mode) | EN | открыт первоисточник |
| `d00_equipment_food_source_juice` | [Juice HACCP Hazards and Controls Guidance](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/guidance-industry-juice-hazard-analysis-critical-control-point-hazards-and-controls-guidance-first) | EN | открыт первоисточник |
| `d00_equipment_food_source_nyc_prep` | [NYC Health Code §81.09: time and temperature control for safety foods](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-46103) | EN | открыт первоисточник |
| `d00_equipment_food_source_ico` | [Public coffee market information](https://ico.org/resources/public-market-information/) | EN | открыт первоисточник |
| `d00_equipment_food_source_fao` | [Climate conditions and world coffee prices](https://www.fao.org/newsroom/detail/adverse-climatic-conditions-drive-coffee-prices-to-highest-level-in-years/en/) | EN | открыт первоисточник |
| `d00_equipment_food_source_eggs` | [Food Price Outlook summary findings](https://www.ers.usda.gov/data-products/food-price-outlook/summary-findings) | EN | открыт первоисточник |
| `d00_equipment_food_source_matcha` | [Message from Ippodo president on tea supply](https://ippodotea.com/blogs/ippodo-tea-blog/presidents-message) | EN | открыт первоисточник |
| `d00_equipment_food_source_cocoa` | [Quarterly cocoa market bulletin](https://www.icco.org/august-2026-quarterly-bulletin-of-cocoa-statistics/) | EN | открыт первоисточник |
| `d00_equipment_food_source_cinnamon` | [Ground cinnamon public health alert](https://www.fda.gov/food/alerts-advisories-safety-information/more-ground-cinnamon-products-added-fda-public-health-alert-due-presence-elevated-levels-lead) | EN | открыт первоисточник |
| `d00_equipment_food_source_berries` | [Frozen strawberries outbreak investigation](https://www.fda.gov/food/outbreaks-foodborne-illness/outbreak-investigation-hepatitis-virus-infections-frozen-strawberries-february-2023) | EN | открыт первоисточник |
| `d00_equipment_food_source_fda_allergens` | [Food allergies and labeling](https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies) | EN | открыт первоисточник |
| `d00_equipment_food_source_ftc` | [Summary of environmental marketing Green Guides](https://www.ftc.gov/business-guidance/resources/environmental-claims-summary-green-guides) | EN | открыт первоисточник |
| `d00_equipment_food_source_epa_waste` | [Tools for preventing and diverting wasted food](https://www.epa.gov/sustainable-management-food/tools-preventing-and-diverting-wasted-food) | EN | открыт первоисточник |
| `d00_equipment_food_source_donation` | [Food donation and food-safety practices](https://www.fda.gov/food/hfp-constituent-updates/new-fda-food-code-reduces-barriers-food-donations) | EN | открыт первоисточник |
| `d00_equipment_food_source_thermometer` | [Checking thermometer accuracy](https://www.thermoworks.com/blogs/learning-center/accuracy-how-to-know-if-your-thermometer-is-accurate) | EN | открыт первоисточник |
| `d00_equipment_food_source_nsf_electric` | [Electrical requirements for foodservice equipment](https://www.nsf.org/knowledge-library/nec-cec-electrical-food-equipment-us-canadian-markets) | EN | открыт первоисточник |
| `d00_equipment_food_source_reusable` | [Refillable and returnable containers](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-97076) | EN | открыт первоисточник |
| `d00_equipment_food_source_ny_allergens` | [Food allergens: establishment requirements](https://healthweb-back.health.ny.gov/environmental/indoors/food_safety/foodallergens.htm) | EN | открыт первоисточник |
| `d00_equipment_food_source_cold_brew_study` | [Microbial safety of cold-brewed black coffee during retail](https://www.eurofins.com/en-us/food-feed-testing/resource-library/microbial-safety-of-cold-brewed-black-coffee-during-retail/) | EN | поисковая выдержка |
| `d00_equipment_food_source_nsf_materials` | [Food equipment standards portfolio](https://www.nsf.org/nsf-standards/standards-portfolio/food-equipment-standards) | EN | открыт первоисточник |
| `d00_equipment_food_source_returns` | [Returns, damages and restocking fees](https://www.webstaurantstore.com/blog/2754/returns-damages-and-restocking-fees.html) | EN | открыт первоисточник |
| `d00_labor_finance_source_notice` | [Notice of Pay Rate](https://dol.ny.gov/notice-pay-rate) | EN | открыт первоисточник |
| `d00_labor_finance_source_wageorder` | [Hospitality Industry Wage Order](https://dol.ny.gov/system/files/documents/2024/12/cr146.pdf) | EN | открыт первоисточник |
| `d00_labor_finance_source_tipped` | [Minimum Wage for Tipped Workers](https://dol.ny.gov/minimum-wage-tipped-workers) | EN | открыт первоисточник |
| `d00_labor_finance_source_rest` | [Day of Rest and Meal Periods](https://dol.ny.gov/day-rest-and-meal-periods) | EN | открыт первоисточник |
| `d00_labor_finance_source_pto` | [Protected Time Off Law FAQs](https://www.nyc.gov/site/dca/about/paid-sick-leave-FAQs.page) | EN | открыт первоисточник |
| `d00_labor_finance_source_ptopolicy` | [Rules for Safe and Sick Leave Policies](https://www.nyc.gov/assets/dca/downloads/pdf/businesses/Paid-Safe-And-Sick-Leave-Policies.pdf) | EN | открыт первоисточник |
| `d00_labor_finance_source_frequency` | [Frequency of Pay](https://dol.ny.gov/node/7016) | EN | открыт первоисточник |
| `d00_labor_finance_source_termination` | [Notices to Employees](https://dol.ny.gov/notices-employees) | EN | открыт первоисточник |
| `d00_labor_finance_source_managertips` | [Managers and Supervisors and Tips](https://www.dol.gov/agencies/whd/fact-sheets/15b-managers-supervisors-tips-flsa) | EN | поисковая выдержка |
| `d00_labor_finance_source_wcbproof` | [How to Resolve a Penalty](https://www.wcb.ny.gov/content/main/Employers/resolve-penalty.jsp) | EN | открыт первоисточник |
| `d00_labor_finance_source_dbpenalty` | [Penalties for No Disability and PFL Coverage](https://www.wcb.ny.gov/content/main/DisabilityBenefits/penalties-no-coverage.jsp) | EN | открыт первоисточник |
| `d00_labor_finance_source_youthpapers` | [Working Papers](https://dol.ny.gov/working-papers) | EN | открыт первоисточник |
| `d00_labor_finance_source_dbinsurance` | [Disability Benefits and Paid Family Leave Insurance](https://www.wcb.ny.gov/content/main/DisabilityBenefits/employer-disability-benefits.jsp) | EN | открыт первоисточник |
| `d00_labor_finance_source_wcviolations` | [Workers Compensation Law Violations](https://www.wcb.ny.gov/content/main/Employers/violations-wclaw.jsp) | EN | открыт первоисточник |
| `d00_labor_finance_source_lactation` | [Lactation Accommodations FAQ](https://www.nyc.gov/site/cchr/law/lactation-faqs.page) | EN | открыт первоисточник |
| `d00_labor_finance_source_p15` | [Publication 15 Employer Tax Guide](https://www.irs.gov/publications/p15) | EN | открыт первоисточник |
| `d00_labor_finance_source_tipreport` | [Tip Recordkeeping and Reporting](https://www.irs.gov/businesses/small-businesses-self-employed/tip-recordkeeping-and-reporting) | EN | открыт первоисточник |
| `d00_labor_finance_source_closeirs` | [Closing a Business](https://www.irs.gov/businesses/small-businesses-self-employed/closing-a-business) | EN | открыт первоисточник |
| `d00_labor_finance_source_youthhours` | [Hours of Work for Minors](https://dol.ny.gov/hours-work-minors) | EN | открыт первоисточник |
| `d00_labor_finance_source_tipsfaq` | [Tips and Gratuities FAQ](https://dol.ny.gov/system/files/documents/2025/01/tips-and-gratuities-frequently-asked-questions.pdf) | EN | открыт первоисточник |
| `d00_labor_finance_source_hospitalityfaq` | [Hospitality Wage Order FAQ](https://dol.ny.gov/system/files/documents/2021/03/hospitality-wage-order-frequently-asked-questions.pdf) | EN | открыт первоисточник |
| `d00_labor_finance_source_uniform` | [Uniform Maintenance Pay Rule](https://regulations.justia.com/states/new-york/title-12/chapter-ii/subchapter-b/part-146/subpart-146-1/section-146-1-7/) | EN | поисковая выдержка |
| `d00_labor_finance_source_salesinfo` | [Business Information for Sales Tax Purposes](https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/business_info.htm) | EN | открыт первоисточник |
| `d00_labor_finance_source_finalsales` | [Filing a Final Sales Tax Return](https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/filing_a_final_sales_tax_return.htm) | EN | открыт первоисточник |
| `d00_labor_finance_source_restaurantsales` | [Sales by Restaurants and Similar Establishments](https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/sales_by_restaurants.htm) | EN | открыт первоисточник |
| `d00_labor_finance_source_amendcertificate` | [Amending or Surrendering a Certificate of Authority](https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/amending_or_surrendering_a_certificate_of_authority.htm) | EN | открыт первоисточник |
| `d00_labor_finance_source_sbaloan` | [7(a) Loans](https://www.sba.gov/loans/7a-loans/) | EN | открыт первоисточник |
| `d00_labor_finance_source_sbaliens` | [SBA Lender Resources](https://www.sba.gov/sba-lenders/) | EN | открыт первоисточник |
| `d00_labor_finance_source_ubt` | [Unincorporated Business Tax](https://www.nyc.gov/site/finance/business/business-unincorporated-business-tax-ubt.page) | EN | открыт первоисточник |
| `d00_labor_finance_source_crt` | [Commercial Rent Tax](https://www.nyc.gov/site/finance/business/business-commercial-rent-tax-crt.page) | EN | открыт первоисточник |
| `d00_labor_finance_source_financecalendar` | [Finance Calendar](https://www.nyc.gov/site/finance/about/finance-calendar.page) | EN | открыт первоисточник |
| `d00_labor_finance_source_reserve` | [Manage Payment Reserves](https://squareup.com/help/us/en/article/6832-reserves-faq) | EN | открыт первоисточник |
| `d00_labor_finance_source_paymentterms` | [Payment Terms](https://squareup.com/us/en/legal/general/payment) | EN | открыт первоисточник |
| `d00_labor_finance_source_disputes` | [Prevent Payment Disputes](https://squareup.com/help/us/en/article/6138-preventing-disputes) | EN | открыт первоисточник |
| `d00_labor_finance_source_disputedocs` | [Prepare Documents to Challenge Disputes](https://squareup.com/help/us/en/article/7891-your-square-document-request-guide) | EN | открыт первоисточник |
| `d00_labor_finance_source_missingtransfer` | [Troubleshoot Missing Transfers](https://squareup.com/help/us/en/article/8328-troubleshoot-missing-transfers) | EN | открыт первоисточник |
| `d00_labor_finance_source_transfers` | [Transfer Options](https://squareup.com/help/us/en/article/3807-deposit-options-with-square) | EN | открыт первоисточник |
| `d00_labor_finance_source_dfsinsurance` | [Information for Small Businesses](https://www.dfs.ny.gov/consumers/small_businesses) | EN | открыт первоисточник |
| `d00_labor_finance_source_naic` | [Business Interruption and BOP](https://content.naic.org/cipr-topics/business-interruptionbusinessowners-policies-bop) | EN | открыт первоисточник |
| `d00_labor_finance_source_mcafraud` | [Cash Advance Firm Settlement](https://www.ftc.gov/news-events/news/press-releases/2021/04/cash-advance-firm-pay-98m-settle-ftc-complaint-it-overcharged-small-businesses) | EN | открыт первоисточник |
| `d00_labor_finance_source_mca` | [Small Business Lending Rule FAQs](https://www.consumerfinance.gov/compliance/compliance-resources/small-business-lending-resources/small-business-lending-collection-and-reporting-requirements/small-business-lending-rule-faqs/) | EN | открыт первоисточник |
| `d00_labor_finance_source_1099k` | [What to Do with Form 1099-K](https://www.irs.gov/businesses/what-to-do-with-form-1099-k) | EN | открыт первоисточник |
| `d00_labor_finance_source_uireport` | [Employer Guide to UI Wage Reporting and Withholding](https://www.tax.ny.gov/forms/publications/wt/nys50.htm) | EN | поисковая выдержка |
| `d00_labor_finance_source_uirate` | [Calculating an Employer Unemployment Insurance Contribution Rate](https://dol.ny.gov/bizserve/ui/prg/rate) | EN | открыт первоисточник |
| `d00_labor_finance_source_training` | [Sexual Harassment Model Policy and Training](https://www.ny.gov/combating-sexual-harassment-workplace/sexual-harassment-prevention-model-policy-and-training) | EN | открыт первоисточник |
| `d00_labor_finance_source_ownercover` | [Cafe Owners Sick and Tired](https://www.reddit.com/r/cafe/comments/1n1ln2q/cafe_owners_sick_and_tired/) | EN | открыт вторичный |
| `d00_labor_finance_source_owneradmin` | [Quiet Drains of Running a Cafe](https://www.reddit.com/r/coffeeshopowners/comments/1q7h0r3/what_part_of_running_a_cafe_quietly_drains_you/) | EN | открыт вторичный |
| `d00_labor_finance_source_ownerfriends` | [First-Year Staffing Changes](https://www.reddit.com/r/coffeeshopowners/comments/1lmtcnh/coming_up_on_our_1_year_and_thinking_over_all_the/) | EN | открыт вторичный |
| `d00_labor_finance_source_ownerseller` | [Coffee Business Seller-Financing Cash Crisis](https://www.reddit.com/r/smallbusiness/comments/1s08cuk/i_took_over_a_coffee_business_through_seller/) | EN | открыт вторичный |
| `d00_labor_finance_source_owneruk` | [Cafe Owner Struggling in Devon](https://www.mumsnet.com/talk/small_business/5415197-any-other-cafe-owners-struggling-right-now) | EN | открыт вторичный |
| `d00_labor_finance_source_industrypress` | [Why Running a Coffee Shop Is Harder](https://perfectdailygrind.com/2026/10/why-running-a-coffee-shop-is-harder/) | EN | открыт вторичный |
| `d00_labor_finance_source_misclass` | [Worker Misclassification](https://dol.ny.gov/worker-misclassification-employee-vs-independent-contractor-fare-grant) | EN | открыт первоисточник |
| `d00_labor_finance_source_salaryrange` | [Salary Transparency Law](https://portal.311.nyc.gov/article/?kanumber=KA-03530) | EN | открыт первоисточник |
| `d00_labor_finance_source_paidmeetings` | [Hours Worked Under the FLSA](https://www.dol.gov/agencies/whd/fact-sheets/22-flsa-hours-worked) | EN | поисковая выдержка |
| `d00_labor_finance_source_estimated` | [Estimated Taxes](https://www.irs.gov/businesses/small-businesses-self-employed/estimated-taxes) | EN | открыт первоисточник |
| `d00_labor_finance_source_salaryhistory` | [Salary History Questions](https://www.nyc.gov/site/cchr/law/salary-history-law.page) | EN | открыт первоисточник |
| `d00_labor_finance_source_retaliation` | [Retaliation](https://dol.ny.gov/retaliation) | EN | открыт первоисточник |
| `d00_labor_finance_source_fairworkweek` | [Fair Workweek Fast Food FAQ](https://www.nyc.gov/assets/dca/downloads/pdf/workers/FAQs-FairWorkweek-FastFood.pdf) | EN | открыт первоисточник |
| `d00_labor_finance_source_guarantee` | [Loan Conditions: Personal Guarantees](https://www.law.cornell.edu/cfr/text/13/120.160) | EN | открыт вторичный |
| `d00_premises_src_bulk` | [Buying a business](https://www.tax.ny.gov/bus/doingbus/buy.htm) | EN | открыт первоисточник |
| `d00_premises_src_lease` | [Commercial Lease Guide](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf) | EN | открыт первоисточник |
| `d00_premises_src_co` | [Certificate of Occupancy](https://nyc-business.nyc.gov/nycbusiness/description/certificate-of-occupancy) | EN | открыт первоисточник |
| `d00_premises_src_fse` | [Food Service Establishment Permit](https://nyc-business.nyc.gov/nycbusiness/description/food-service-establishment-permit) | EN | открыт первоисточник |
| `d00_premises_src_asbestos` | [Project Requirements: Asbestos](https://www.nyc.gov/site/buildings/dob/project-requirements-asbestos.page) | EN | открыт первоисточник |
| `d00_premises_src_swo` | [Stop Work Order](https://www.nyc.gov/site/buildings/property-or-business-owner/stop-work-order.page) | EN | открыт первоисточник |
| `d00_premises_src_loc` | [Letter of No Objection or Completion](https://www.nyc.gov/site/buildings/property-or-business-owner/letter-of-no-objection-or-completion.page) | EN | открыт первоисточник |
| `d00_premises_src_tco` | [Temporary Certificate of Occupancy](https://www.nyc.gov/site/buildings/property-or-business-owner/temporary-certificate-of-occupancy.page) | EN | открыт первоисточник |
| `d00_premises_src_gas` | [Gas Authorization for Restaurants](https://nyc-business.nyc.gov/nycbusiness/description/gas-authorizationrestaurant-equipment) | EN | открыт первоисточник |
| `d00_premises_src_hood_change` | [Rangehood Fire-Suppression Systems](https://nyc-business.nyc.gov/nycbusiness/description/rangehood-fire-suppression-systems) | EN | открыт первоисточник |
| `d00_premises_src_landmark` | [Landmarked Storefronts](https://www.nyc.gov/site/lpc/applications/storefronts.page) | EN | открыт первоисточник |
| `d00_premises_src_backflow` | [Approval of Backflow Prevention Devices](https://nyc-business.nyc.gov/nycbusiness/description/application-for-approval-of-backflow-prevention-devices) | EN | открыт первоисточник |
| `d00_premises_src_preoperation` | [Food Establishment Pre-Operational Inspection Form](https://www.nyc.gov/site/sbs/businesses/food-establishment-form.page) | EN | открыт первоисточник |
| `d00_premises_src_utility_faq` | [Building and Remodeling FAQ](https://www.coned.com/en/small-medium-size-businesses/building-project-center/faq) | EN | открыт первоисточник |
| `d00_premises_src_utility_sequence` | [Gas and Electric Service Step-by-Step Guide](https://www.coned.com/en/small-medium-size-businesses/building-project-center/gas-and-electric-service-update-guide) | EN | открыт первоисточник |
| `d00_premises_src_lpc_express` | [LPC Business Express](https://www.nyc.gov/site/lpc/applications/lpc-business-express.page) | EN | открыт первоисточник |
| `d00_premises_src_sign_moratorium` | [DOB Sign Guidance](https://www.nyc.gov/site/buildings/safety/sign.page) | EN | открыт первоисточник |
| `d00_premises_src_storefront` | [Project Requirements for Owner: Storefronts](https://home4.nyc.gov/site/buildings/property-or-business-owner/project-requirements-owner-storefronts.page) | EN | открыт первоисточник |
| `d00_premises_src_ada_primer` | [ADA Update: A Primer for Small Business](https://www.ada.gov/resources/title-iii-primer/) | EN | открыт первоисточник |
| `d00_premises_src_service_dogs` | [Service Animals](https://www.ada.gov/topics/service-animals/) | EN | открыт первоисточник |
| `d00_premises_src_assembly` | [Place of Assembly Certificate of Operation](https://www.nyc.gov/site/buildings/property-or-business-owner/place-of-assembly-certificate-of-operation.page) | EN | открыт первоисточник |
| `d00_premises_src_noise` | [Noise from Bar, Club, or Restaurant](https://portal.311.nyc.gov/article/?kanumber=KA-01085) | EN | открыт первоисточник |
| `d00_premises_src_exhaust_odor` | [Ventilation or Exhaust System Complaint](https://portal.311.nyc.gov/article/?kanumber=KA-02313) | EN | открыт первоисточник |
| `d00_premises_src_harassment` | [Commercial Tenant Harassment](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-42543) | EN | открыт первоисточник |
| `d00_premises_src_lease_help` | [Commercial Lease Assistance](https://portal.311.nyc.gov/article/?kanumber=KA-01277) | EN | открыт первоисточник |
| `d00_premises_src_toilet_law` | [Employee and Patron Toilets](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-46264) | EN | открыт первоисточник |
| `d00_premises_src_dep_guide` | [Hospitality Environmental Compliance Guide](https://www.nyc.gov/assets/dep/downloads/pdf/air/hospitality-industry-guide-environmental-compliance.pdf) | EN | открыт первоисточник |
| `d00_premises_src_allergy_menu` | [Required Signs: Food Allergies and Intolerances](https://www.nyc.gov/site/doh/business/food-operators/required-signs.page) | EN | открыт первоисточник |
| `d00_premises_src_app_cash` | [Cashless Ban: App-based Transaction Guidance](https://www.nyc.gov/assets/dca/downloads/pdf/businesses/CashlessBanGuidance-AppBasedTransactions.pdf) | EN | открыт первоисточник |
| `d00_premises_src_inspection` | [The Inspection Process](https://www.nyc.gov/site/doh/business/food-operators/the-inspection-process.page) | EN | открыт первоисточник |
| `d00_premises_src_cpr` | [Restaurant CPR Rules](https://portal.311.nyc.gov/article/?kanumber=KA-01352) | EN | открыт первоисточник |
| `d00_premises_src_cash_penny` | [Cashless Ban and Penny Rounding Advisory](https://www.nyc.gov/site/dca/consumers/Prohibition-of-Cashless-Establishments.page) | EN | открыт первоисточник |
| `d00_premises_src_pfe_cert` | [Portable Fire Extinguisher Company Recognition](https://www.nyc.gov/site/fdny/business/all-certifications/portable-fire-extinguishers-company-certificates.page) | EN | открыт первоисточник |
| `d00_premises_src_music` | [Music Licensing for Food and Beverage Establishments](https://www.bmi.com/licensing/restaurant-bar-or-brewery) | EN | открыт первоисточник |
| `d00_premises_src_ombuds` | [Food Service Establishment Ombuds Office](https://home4.nyc.gov/site/doh/business/food-operators/food-service-establishment-ombuds-office.page) | EN | открыт первоисточник |
| `d00_premises_src_peaches` | [Ferrara v Peaches Cafe LLC](https://www.nycourts.gov/REPORTER/3dseries/2018/2018_07925.htm) | EN | открыт первоисточник |
| `d00_premises_src_nycha` | [NYCHA Store Leasing](https://www.nyc.gov/site/nycha/business/store-leasing.page) | EN | открыт первоисточник |
| `d00_premises_src_medical_toilet` | [Access to Restroom Facilities](https://www.nysenate.gov/legislation/laws/GBS/492) | EN | открыт первоисточник |
| `d00_premises_src_ipm` | [Integrated Pest Management](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-46269) | EN | открыт первоисточник |
| `d00_premises_src_rat_deliveries` | [Rat Prevention for Food Service Establishments](https://home4.nyc.gov/site/doh/business/permits-and-licenses/rats-business-owner.page) | EN | открыт первоисточник |
| `d00_premises_src_owner_budget` | [Owner account: early build-out financial roadblock](https://www.reddit.com/r/smallbusiness/comments/owga47/hitting_an_early_financial_roadblock_who_gave_up/) | EN | открыт вторичный |
| `d00_premises_src_owner_alley` | [Owner account: late external-access requirements](https://www.reddit.com/r/smallbusiness/comments/ebot51/advice_for_dealing_with_building/) | EN | открыт вторичный |
| `d00_premises_src_owner_quote` | [Owner discussion: coffee shop build-out](https://www.reddit.com/r/coffeeshopowners/comments/18gcjik/coffee_shop_build_out/) | EN | открыт вторичный |
| `d00_premises_src_wanner` | [Ryan Wanner: Losing Your Location](https://community.squareup.com/t5/Community-News/Let-s-Talk-Business-Losing-Your-Location-with-Ryan-Wanner/ba-p/719865) | EN | открыт вторичный |
| `d00_premises_src_robin` | [Robin Zander: Building and Selling Robin Cafe](https://robinpzander.com/lessons-learned-building-and-selling-robins-cafe/) | EN | открыт первоисточник |
| `d00_premises_src_biometric` | [Customer Biometric Identifier Information](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-131285) | EN | открыт первоисточник |
| `d00_premises_src_sla_change` | [Change Your Liquor License](https://sla.ny.gov/change-your-license) | EN | открыт первоисточник |
| `d00_premises_src_sla_indirect` | [Frequent ABC Law Violations](https://sla.ny.gov/frequent-violations-abc-law-retailers) | EN | открыт первоисточник |
| `d00_premises_src_outdoor_ops` | [Outdoor Cafe Operation and Management Requirements](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-145866) | EN | открыт первоисточник |
| `d00_premises_src_egress` | [Unobstructed and Unimpeded Egress](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-144597) | EN | открыт первоисточник |
| `d00_street_source_snow` | [Snow and Ice Removal Laws](https://www.nyc.gov/site/dsny/what-we-do/snow-response/snow-laws.page) | EN | открыт первоисточник |
| `d00_street_source_gutters` | [Sidewalks and Gutters](https://www.nyc.gov/site/dsny/what-we-do/cleaning/sidewalks-gutters.page) | EN | открыт первоисточник |
| `d00_street_source_setout` | [Setout Rules for Businesses](https://www.nyc.gov/site/dsny/businesses/rules-reporting/setout-rules-businesses.page) | EN | открыт первоисточник |
| `d00_street_source_carter` | [Hiring a Private Carter](https://www.nyc.gov/site/dsny/businesses/setup-operations/hiring-a-private-carter.page) | EN | открыт первоисточник |
| `d00_street_source_roofice` | [Snow or Ice on Building](https://portal.311.nyc.gov/article/?kanumber=KA-03706) | EN | открыт первоисточник |
| `d00_street_source_gtrain` | [Brooklyn business owners rally against G train service shutdowns](https://ny1.com/nyc/brooklyn/news/2026/08/20/brooklyn-business-owners-rally-against-g-train-service-shutdowns) | EN | открыт вторичный |
| `d00_street_source_sidewalkdining` | [Sidewalk Cafe: How to Operate](https://www.diningoutnyc.info/rules/sidewalk/operate) | EN | открыт первоисточник |
| `d00_street_source_sidewalk` | [Sidewalks](https://www.nyc.gov/html/dot/html/infrastructure/sidewalkintro.shtml) | EN | открыт первоисточник |
| `d00_street_source_mta` | [Planned Service Changes](https://www.mta.info/alerts) | EN | открыт первоисточник |
| `d00_street_source_openstreets` | [Open Streets](https://www.nyc.gov/html/dot/html/pedestrians/openstreets.shtml) | EN | открыт первоисточник |
| `d00_street_source_summerstreets` | [Summer Streets Manhattan Community Flyer](https://www.nyc.gov/html/dot/downloads/pdf/summer-streets-manhattan-flyer-2026.pdf) | EN | открыт первоисточник |
| `d00_street_source_floodtypes` | [Flooding and Climate Change](https://www.nyc.gov/site/dep/environment/flood-prevention.page) | EN | открыт первоисточник |
| `d00_street_source_airquality` | [Air Quality Guidance: Fire, Smoke, and High Ozone](https://www.nyc.gov/site/doh/health/health-topics/air-quality-fire-smoke-and-effect-on-air-quality.page) | EN | открыт первоисточник |
| `d00_street_source_prep` | [Expanded Risk Assessment Service](https://nyc-business.nyc.gov/nycbusiness/emergency-preparedness/business-preparedness-and-resiliency-program/expanded-risk-assessment-service) | EN | открыт первоисточник |
| `d00_street_source_sewer` | [Sewer Backup](https://portal.311.nyc.gov/article/?kanumber=KA-01510) | EN | открыт первоисточник |
| `d00_street_source_hybrid` | [Return to Office Survey Results, March 2025](https://pfnyc.org/research/return-to-office-survey-results-march-2025) | EN | открыт первоисточник |
| `d00_street_source_tourism` | [2025 Visitation Annual Report Release](https://www.business.nyctourism.com/press-media/press-releases/NYC-Tourism-Annual-Report-March-2026) | EN | открыт первоисточник |
| `d00_street_source_school` | [School Year Calendar 2026–2027](https://www.schools.nyc.gov/calendar/2026-2027-school-year-calendar) | EN | открыт первоисточник |
| `d00_street_source_marathon` | [Marathon Street Closure Notice](https://www.nyc.gov/assets/cecm/downloads/pdf/tcs-street-closures-marathon-2026.pdf) | EN | открыт первоисточник |
| `d00_street_source_googlehours` | [Edit your business hours](https://support.google.com/business/answer/15300403) | EN | открыт первоисточник |
| `d00_street_source_extortion` | [Report negative review extortion scams](https://support.google.com/business/answer/16404809) | EN | открыт первоисточник |
| `d00_street_source_laptopreddit` | [Losing Business Due to People Working on Laptops](https://www.reddit.com/r/barista/comments/1hs15rk/losing_business_due_to_people_working_on_laptops/) | EN | открыт вторичный |
| `d00_street_source_wificafe` | [As Wi-Fi Becomes Ubiquitous, Some Cafes Are Still Holding Out](https://dailycoffeenews.com/2019/10/23/as-wi-fi-becomes-ubiquitous-some-cafes-are-still-holding-out/) | EN | открыт вторичный |
| `d00_street_source_reviewpolicy` | [Business Profile restrictions for policy violations](https://support.google.com/business/answer/14114287) | EN | открыт первоисточник |
| `d00_street_source_reopened` | [Mark your business as reopened](https://support.google.com/business/answer/15300571) | EN | открыт первоисточник |
| `d00_street_source_ddstatus` | [How to Manage Your Store Status and Availability](https://help.doordash.com/en-us/merchants/article/what-is-my-store-status) | EN | открыт первоисточник |
| `d00_street_source_ddcapacity` | [Operations Settings](https://help.doordash.com/en-us/merchants/article/what-are-operations-settings-and-how-do-i-use-them) | EN | открыт первоисточник |
| `d00_street_source_appterms` | [Restaurants Using Delivery Apps](https://www.nyc.gov/site/dca/businesses/Restaurants-Using-Delivery-Apps.page) | EN | открыт первоисточник |
| `d00_street_source_noiseguide` | [A Guide to NYC's Noise Code](https://www.nyc.gov/assets/dep/downloads/pdf/air/noise/noise-code-guide-summary.pdf) | EN | открыт первоисточник |
| `d00_street_source_restaurantweek` | [Restaurant Week Winter Participation Agreement](https://assets.ctfassets.net/1aemqu6a6t65/42JY7VyYe1cbH1rGIkzGsl/e7e0db95a6d78ebb76f356aeec0300f3/W-26_NYC_Restaurant_Week_Participation_Agreement.pdf) | EN | открыт первоисточник |
| `d00_street_source_aclaw` | [NYC Administrative Code: Air conditioning prohibitions](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-36056) | EN | открыт первоисточник |
| `d00_street_source_shedsign` | [Construction Site Signage Requirements](https://www.nyc.gov/site/buildings/safety/construction-site-signage-requirements.page) | EN | открыт первоисточник |
| `d00_street_source_roadway` | [Roadway Cafe: How to Operate](https://www.diningoutnyc.info/rules/roadway/operate) | EN | открыт первоисточник |
| `d00_street_source_toll` | [Congestion Pricing Program](https://portal.311.nyc.gov/article/?kanumber=KA-03612) | EN | открыт первоисточник |
| `d00_street_source_offhour` | [Off-Hour Delivery Incentives](https://www.nyc.gov/html/dot/html/pr2026/nyc-dot-to-provide-incentives-to-reduce-truck-deliveries-during-busiest-hours.shtml) | EN | открыт первоисточник |
| `d00_street_source_ncacold` | [Coffee consumption and specialty coffee, Fall report](https://www.ncausa.org/Newsroom/NCA-Coffee-tops-beverage-charts-again-specialty-coffee-hits-new-high) | EN | открыт первоисточник |
| `d00_street_source_value` | [Value in off-premises dining](https://www.restaurant.org/education-and-resources/resource-library/value-is-a-big-piece-of-off-premises-dinings-popularity-play/) | EN | открыт первоисточник |
| `d00_street_source_ftc` | [Consumer Reviews and Testimonials Rule: Q&A](https://www.ftc.gov/business-guidance/resources/consumer-reviews-testimonials-rule-questions-answers) | EN | открыт первоисточник |
| `d00_street_source_serviceanimal` | [Service Animals and ADA FAQs](https://www.ada.gov/resources/service-animals-faqs/) | EN | открыт первоисточник |
| `d00_street_source_loyalty` | [Create a loyalty program](https://squareup.com/help/us/en/article/3952-create-a-loyalty-program-with-square) | EN | открыт первоисточник |
| `d00_street_source_footcount` | [Bi-Annual Citywide Pedestrian Counts: README](https://www.nyc.gov/html/dot/downloads/pdf/bi-annual-ped-count-readme.pdf) | EN | открыт первоисточник |
| `d00_street_source_climate` | [Central Park climate normals and extremes](https://www.weather.gov/media/okx/Climate/CentralPark/nycnormals.pdf) | EN | открыт первоисточник |
| `d00_street_source_display` | [Sidewalk and Street Rules for Businesses](https://www.nyc.gov/site/dsny/businesses/rules-reporting/street-sidewalk-rules-businesses.page) | EN | открыт первоисточник |
| `d00_street_source_packaging` | [Increased sales come in the right packages](https://www.restaurant.org/education-and-resources/resource-library/increased-sales-come-in-the-right-packages/) | EN | открыт первоисточник |
| `d00_street_source_rulaptops` | [Люди за ноутбуками: прибыль или проблема](https://business.streamcoffee.ru/people-at-laptops-in-a-coffee-shop) | RU | открыт вторичный |
| `d00_street_source_escold` | [Las bebidas frías han cambiado el flujo de trabajo](https://perfectdailygrind.com/es/2025/10/11/bebidas-frias-cambiado-flujo-trabajo-baristas/) | ES | открыт вторичный |
| `d00_street_source_baridentity` | [Struggling to bring morning traffic to a bar's coffee program](https://www.reddit.com/r/smallbusiness/comments/1xcmkpe/we_are_struggling_getting_morning_traffic_coming/) | EN | открыт вторичный |
| `d00_street_source_socialaudience` | [Followers not translating to cafe visits](https://www.reddit.com/r/InstagramMarketing/comments/1px2bkx/25k_followers_but_nobody_comes_to_my_store/) | EN | открыт вторичный |
| `d00_root_source_checklist` | [NYC SBS: Restaurant checklist](https://nyc-business.nyc.gov/nycbusiness/resources-by-industry/restaurant) | EN | открыт первоисточник |
| `d00_root_source_bulk` | [NY Tax: Bulk sales](https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/bulk_sales.htm) | EN | открыт первоисточник |
| `d00_root_source_taxcalendar` | [NY Tax: 2026 tax filing dates](https://www.tax.ny.gov/help/calendar/2026.htm) | EN | открыт первоисточник |
| `d00_root_source_taxfrequency` | [NY Tax: Filing requirements](https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/filing_requirements_for_sales_and_use_tax_returns.htm) | EN | открыт первоисточник |
| `d00_root_source_nra` | [National Restaurant Association: Operational realities](https://restaurant.org/research-and-media/media/press-releases/new-resource-from-national-restaurant-association-provides-insights-into-operational-realities) | EN | открыт первоисточник |
| `d00_root_source_backflush` | [La Marzocco: Commercial backflushing](https://www.lamarzoccousa.com/news/blog/how-to-backflush-your-espresso-machine/) | EN | открыт первоисточник |
| `d00_root_source_summer` | [La Marzocco: Summer service](https://www.lamarzoccousa.com/news/blog/summer-espresso-machine-service/) | EN | открыт первоисточник |
| `d00_root_source_payroll` | [IRS: Employment tax due dates](https://www.irs.gov/businesses/small-businesses-self-employed/employment-tax-due-dates) | EN | открыт первоисточник |
| `d00_root_source_gusto` | [Gusto: Pricing](https://gusto.com/product/pricing) | EN | открыт первоисточник |
| `d00_root_source_square` | [Square: Pricing](https://squareup.com/us/en/pricing) | EN | открыт первоисточник |
| `d00_root_source_penalty` | [NYC Health: Chapter 23 inspection rules](https://www.nyc.gov/assets/doh/downloads/pdf/about/healthcode/health-code-chapter23.pdf) | EN | открыт первоисточник |
| `d00_root_source_school26` | [NYC Public Schools: Calendar 2025–2026](https://www.schools.nyc.gov/calendar/2025-2026-school-year-calendar) | EN | открыт первоисточник |
| `d00_root_source_menus` | [DoorDash: POS menu integration](https://help.doordash.com/en-us/merchants/article/integration-manage-menu) | EN | открыт первоисточник |
| `d00_root_source_homeprocessor` | [NY Agriculture: Home Processing](https://agriculture.ny.gov/food-safety/home-processing) | EN | открыт первоисточник |
| `d00_root_source_outdoor_2026` | [NYC Administrative Code §19-160: seasonal and year-round outdoor cafes](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-236623) | EN | открыт первоисточник |
| `d00_root_source_grease_schedule` | [NYC rules §56-02: sewer control penalty schedule](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-118762) | EN | открыт первоисточник |
| `d00_root_source_nyc_sales_rate` | [NYC Finance: combined sales and use tax rate](https://www.nyc.gov/site/finance/business/business-nys-sales-tax.page) | EN | открыт первоисточник |
