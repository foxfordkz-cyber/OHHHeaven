# D01 — Вход в бизнес и месяцы до открытия (кафе, Нью-Йорк, 2026)

Исследователь D01. Файл данных: `packs/parts/cafe/D01-entry-preopening.json`. Дата работы: 14 ноября 2026.

## 1. Вердикт

1. Задание закрыто выше порога: 23 записи `setup`, 32 шага `roadmap`, 59 событий в каталоге, 14 механик, среди них «ремонт без выручки» и «покупка готового бизнеса».
2. Главный вывод по ремонту: бесплатных месяцев аренды (обычно 3–6) не хватает. От подписания до открытия выходит 123 дня для бывшего кафе, 160 для переоборудования и 280 для помещения без общепита; при трёх бесплатных месяцах это $6 600, $14 000 и $38 000 аренды без выручки.
3. Главный вывод по покупке: работающее кафе стоит около двух годовых заработков владельца (медиана 2,0×; 0,41× годовой выручки). Для эталонной точки пакета это примерно $233 000 — втрое дороже лёгкого ремонта, зато продажи идут с первой недели. Текущая оценка в ветке keen-cray (0,2× выручки, потолок $200 000) занижена.
4. Покупателю переходят долги продавца по налогу с продаж (если не подано уведомление AU-196.10), его ставка страхования по безработице и накопленные больничные работников; разрешение на общепит не переходит никогда.
5. **Сверка по первоисточникам сделана частично.** После одобрения окружения с 20 хостами я открыл 37 страниц и дословно сверил числа: 32 числа помечены `verified`, ещё у 28 записей правило прочитано на странице, а само число — мой расчёт. Сайты www.nyc.gov, свод законов города, BizBuySell и FTC отказали автоматическим запросам, поэтому сборы и штрафы Департамента зданий, тексты Health Code и кратные цены продажи остались с пометкой `primary_search_extract` (32 записи).

## 2. Что добавлено

| Раздел | Записей | Что внутри |
|---|---|---|
| `setup` | 23 | Сбор DOB за подачу проекта (формула), асбестовое обследование и удаление, разрешение Landmarks, Letter of No Objection, резерв на непредвиденное, налог с продаж на работы подрядчика, депозит Con Edison, усиление электроввода, консультативная инспекция; цена готового бизнеса, key money, юрист и бухгалтер при покупке, налог с продаж на купленное оборудование, сбор SBA; взнос и обучение франшизы; лицензия, курс, разрешение и сама тележка, разрешение для частной территории, временное разрешение для ярмарок |
| `roadmap` | 32 | Пять путей: с нуля (19 шагов), покупка (6), франшиза (2), тележка (3), временная точка (2). У каждого шага поле `path` и порядковый номер |
| `ruleCards` | 45 | Аренда (10), ремонт и разрешения (16), покупка бизнеса (9), франшиза (2), тележка и временная точка (6), открытие (2) |
| `levers` | 16 | 12 разовых решений (способ входа, гарантия, бесплатная аренда, защитные пункты договора, проверка адреса, газ или электричество, подрядчик, резерв, режим открытия, проверка покупки, срок подачи на разрешение, первый месяц после покупки) и 4 ежемесячных |
| `shortcuts` | 9 | Открытие в помещении без законного назначения под кафе, ремонт без разрешения, работа под Stop Work Order, сантехника и проводка силами разнорабочего, торговля по разрешению продавца, покупка без уведомления налоговой, тележка без разрешения, аренда чужого разрешения, ярмарка без временного разрешения |
| `violations` | 8 | Восемь новых с законом и штрафом. Ещё одно (`no_fse_permit`) уже есть в пакете, на него ссылается срезанный угол при покупке |
| `officials` | 2 | Инспектор Департамента зданий; офицер по уличной торговле |
| `reports` | 2 | Жалоба на стройку без разрешения; жалоба на тележку без лицензии |
| `monthlyCosts` | 7 | Ежегодный рост аренды, доля роста налога на недвижимость, комиссия за аккредитив, роялти и маркетинговый фонд франшизы, плата за стоянку тележки, продление лицензии |
| `events` | 4 | Городские и общенациональные: замедление DOB, рост цен стройки на 7%, пошлина 15% на европейское оборудование, высокая вакантность витрин |
| `suppliers` | 7 | Объявления о продаже бизнеса, юрист, экспедитор и асбестовый инспектор, бесплатная помощь города, франчайзеры, тележки и стоянки, рынки и концессии в парках |
| `extra.eventCatalog` | 59 | 23 `core`, 29 `deep`, 7 `exotic`; 43 на уровне точки, 5 квартала, 8 города, 3 страны. У каждого события причина (`trigger`), настоящий показатель (`realSignal`) и ходы игрока |
| `extra.mechanics` | 14 | 9 `core`, 5 `deep`; 85 чисел с источниками |
| `extra.entryModes` | 8 | Деньги, срок до первой выручки и риски для каждого способа входа |
| `extra.leaseTerms` | 1 | Типичные условия аренды с источником у каждого |
| `extra.preOpeningTimeline` | 13 шагов | Дни по шагам для трёх классов помещения, зависимости и параллельность |
| `extra.takeover` | 1 | Замена оценки цены готового бизнеса |
| `extra.nonObvious` | 45 | Неочевидное: текст, причина, источник |
| `extra.failureStories` | 12 | Истории срывов до открытия и при покупке |
| `extra.fixesExisting` | 8 | Исправления существующего пакета |
| `extra.kitAdditions` | 1 | Что добавить в три набора |
| `extra.newEffectFields` | 23 поля | Новые поля эффектов, которых нет в движке |

Способы входа из `extra.entryModes`:

| Способ | Деньги (типично) | До первой выручки | Главный риск |
|---|---|---|---|
| Бывшее кафе, лёгкий ремонт | $224 000 | 4 месяца | бесплатная аренда кончается раньше открытия |
| Бывший общепит, переоборудование | $412 000 | 5,3 месяца | замечания экзаменатора, электроввод |
| Помещение без общепита | $638 000 | 9,3 месяца | полгода аренды без выручки |
| Покупка работающего кафе | $310 000 | 1 месяц | налоговый долг продавца, завышенные продажи |
| Key money за закрытое кафе | $150 000 | 1,5 месяца | клиентов нет, причина закрытия неизвестна |
| Франшиза | $700 000 | 9 месяцев | 8,5–11% с каждой продажи уходит франчайзеру |
| Кофейная тележка | $19 000 | 2 месяца на частной территории; годы на тротуаре | разрешений ограниченное число |
| Ярмарка или уголок в чужом заведении | $15 000 | 1 месяц | сезон кончается, хозяин расторгает |

## 3. Пятнадцать самых неочевидных находок

1. **Разрешение на общепит не продаётся вместе с кафе.** По Health Code §5.11 оно теряет силу в момент передачи. Покупатель может подать заявку за 22 дня до сделки и не потерять ни дня, но об этом надо знать заранее.
2. **Покупатель лично отвечает за неуплаченный продавцом налог с продаж** — до полной цены покупки, если за 10 дней до оплаты не подал форму AU-196.10. Ответ налоговой приходит за 5 рабочих дней; при претензии деньги лежат в эскроу до 90 дней.
3. **При покупке бизнеса платится налог с продаж 8,875% на мебель и оборудование.** Сумму определяет то, как цена разбита в договоре.
4. **Ставка страхования по безработице продавца переходит к покупателю**, и скрыть покупку от Департамента труда нельзя.
5. **Накопленные больничные работников переходят к новому владельцу**, а продавец и покупатель отвечают за них солидарно.
6. **Город может не выдать покупателю разрешение из-за неоплаченных штрафов продавца**, пока не доказано, что сделка рыночная.
7. **Фраза в договоре аренды о том, кому принадлежат улучшения, решает, облагаются ли работы подрядчика налогом с продаж.** Без неё и формы ST-124 к смете добавляется около 5%.
8. **Штраф за ремонт без разрешения считается от сэкономленного сбора: 21×, минимум $6 000, максимум $15 000.** Разрешение всё равно придётся получить, а объект стоит под Stop Work Order.
9. **Если рабочий упадёт на стройке, отвечать может арендатор.** Суды применяют Labor Law §240 к тому, кто заказал работы.
10. **Асбестовое заключение нужно почти в каждом помещении**: без него Департамент зданий не выдаёт разрешение в домах старше апреля 1987 года.
11. **Долги арендодателя перед городом могут заблокировать разрешение арендатора** (Local Law 160 of 2017).
12. **22 дня до открытия считаются от подачи заявки, а не от конца стройки.** В ветке keen-cray ожидание начинается после ремонта; это лишние три недели аренды.
13. **Кофейне не нужен газ, а выбор газа стоит в среднем 68 дней ожидания.** Полностью электрическая кофейня этого пути не имеет.
14. **Разрешение на тележку стоит $75, но получить его нельзя**: в очереди от 10 000 до 20 000 человек, выдают 2 200 в год. На частной территории очереди нет.
15. **Первому владельцу не сдают лучшие адреса.** Основательница White Noise Coffee не смогла снять даже 200–300 кв. футов и переделала под кафе магазин родителей.

## 4. Исправления существующего пакета

Все восемь лежат в `extra.fixesExisting` со ссылками. Существующие записи я не перезаписывал: исправления описаны текстом, чтобы сборщик применил их осознанно.

| Запись | Исправляю, потому что |
|---|---|
| `extra.takeover` (ветка keen-cray) | 0,2× годовой выручки с потолком $200 000 занижает цену прибыльного кафе. Проданные кафе США в 2021–2025 годах: медиана 0,41× выручки и 2,0× заработка владельца |
| `setup.fse_permit`, поле `afterBuildout` | 22 дня считаются от заявки, инспектор приходит после открытия, город советует подавать заранее. Ожидание может идти параллельно с концом стройки |
| `setup.security_deposit` | Три месяца — нижняя граница для новичка в общепите: брокеры называют 3–6 месяцев при хорошей кредитной истории и 6–12 для новых заведений |
| `setup.architect_expediter` | Госпошлины теперь отдельные записи: сбор DOB, асбестовое обследование, Landmarks |
| `setup.insurance_utility_deposits` | Внутри уже сидит депозит Con Edison; новую запись `con_ed_security_deposit` нельзя начислять вместе с ней |
| `ruleCards.second_generation_space` | Бывшее кафе экономит не только деньги, но и календарь: 3–5 месяцев против 6–9 |
| `roadmap.plan_buildout` | «6–14 недель на разрешения» — это весь путь; само согласование DOB в 2025 году занимало в среднем 20,3 дня |
| `extra.realTimeline` | 3 / 3 / 6 оплаченных месяцев до открытия расходятся с расчётом по шагам: 1,1 / 2,3 / 6,3 месяца при трёх бесплатных |

## 5. Просьбы к ведущему — новые механики

По убыванию важности. Полное описание каждой — в `extra.mechanics`.

1. **Ремонт без выручки** (`buildout_without_revenue`). Аренда идёт с подписания; дата открытия — конец самой длинной цепочки шагов. Нужны поля: дата подписания, бесплатные дни, с какого события они считаются, список путей с остатком дней.
2. **Покупка готового бизнеса** (`buy_existing_business`) и **скрытые обязательства продавца** (`seller_hidden_liabilities`). У объявления есть заявленные и настоящие продажи и скрытые свойства: налоговый долг, залог на оборудование, неоплаченные штрафы, ставка по безработице, остаток срока аренды.
3. **Выбор способа входа** (`entry_mode_choice`). Он определяет, какие записи `setup`, шаги `roadmap` и события применимы. Для этого у записей появились поля `appliesTo` и `path`.
4. **Разовые рычаги** (`one_time_levers`). Нужны поля `oneTime`, `phase` и `oneTimeCost` у вариантов. Сейчас формат знает только ежемесячные рычаги.
5. **Скрытые свойства адреса** (`hidden_address_attributes`). Год постройки, исторический район, наличие Certificate of Occupancy, мощность щитка, прежнее использование, долги здания. Свойства задаются один раз при создании города; проверка перед подписанием их открывает.
6. **Параллельные пути до открытия** (`permit_critical_path`). У шагов `roadmap` нужны `dependsOn`, `durationDays` и признак параллельности.
7. **Условия аренды как запись** (`lease_negotiation`) и **гарантия при выходе** (`personal_guaranty_at_exit`). Депозит, бесплатные месяцы, индексация 3%, тип гарантии и то, что владелец должен при закрытии.
8. **Резерв на непредвиденное** (`contingency_and_overrun`). События стройки списывают резерв; нехватка оплачивается с надбавкой 15–30%.
9. **Стройка под Stop Work Order как состояние** (`stop_work_state`), **газ или электричество** (`utility_path`), **обязательства франшизы** (`franchise_obligations`), **очередь на разрешение для тележки** (`mobile_vending_cap`).

Отдельно:

- В событиях каталога эффекты бывают прибавкой (`add`), а не только множителем (`mult`). Список из 23 новых полей — в `extra.newEffectFields`.
- У события добавлено поле `trigger`: объявлено заранее, следует из свойства адреса или из решения игрока. Вероятностей нет.
- Две новые обязательные записи `setup` (`dob_alteration_filing_fee`, `asbestos_survey_acp5`) нужно добавить во все три набора: `extra.kitAdditions`. Остальные 21 помечены `required: false`.
- В нарушении `bulk_sale_not_notified` «штраф» — это унаследованный долг: `pctOfSaved: 1` означает полную сумму скрытого долга продавца из объявления.

## 6. Не найдено

- **Не открылись четыре сайта первоисточников.** www.nyc.gov, codelibrary.amlegal.com, www.bizbuysell.com и www.ftc.gov возвращают 403 и на обычный запрос, и из встроенного браузера; franchise.gregoryscoffee.com не отвечает. Защиту я не обходил. Не подтверждены открытием страницы: таблица сборов и штрафы Департамента зданий, асбестовое правило, Letter of No Objection, сроки и сборы Landmarks, тексты Health Code (§5.11, статья 5, главы 6 и 21), шкала штрафов за торговлю с тележки, правило о больничных при продаже, Executive Order 18, кратные BizBuySell, правило FTC о 14 днях, условия Gregorys. Полный список — в `extra.verification.stillOnlyInSearchExtracts`.
- Рост цен отделки в Нью-Йорке на 7,0% не подтверждён: на открытой странице Cushman & Wakefield есть $181 за кв. фут, но процента нет.
- Доли вакантности по районам (Бруклин 12,3%, Квинс 9,5%) не нашлись в тексте отчёта Контролёра: они взяты из пресс-релиза.
- Цена коммерческого усиления электроввода (трёхфазный ввод): есть только расценки для квартир, $3 500–$10 000.
- Официальная цена асбестового обследования и удаления для небольшого коммерческого помещения.
- Сбор Департамента зданий за Letter of No Objection.
- Цена предварительного осмотра помещения архитектором и электриком ($2 500 — моя оценка).
- Актуальная плата за место на рынке Smorgasburg: найдена только старая цифра $120–$225 в день.
- Опубликованные цены стоянок для тележек (commissary) и прайс на кофейную тележку, одобренную Департаментом здравоохранения.
- Статистика закрытых сделок key money: есть только цены предложений, от $30 000 до $225 000.
- Доля сделок покупки кафе, в которых всплыл налоговый долг продавца, и типичный размер такого долга.
- Свежие данные о сроках подключения газа: последний замер — опрос Сената штата 2017 года.
- Полный текст пункта Health Code о запрете выдачи разрешения при неоплаченных штрафах продавца: выдержка обрывалась.
- Действующий минимальный штраф за сантехнические работы без лицензии: видна только редакция 2008 года ($2 500 и $5 000).
- К какому классу относится тележка с молочными напитками.
- Число шагов и ведомств для открытия ресторана в Нью-Йорке по отчёту Institute for Justice: в выдержке был только стартовый размер сборов, $2 882.
- Рассказы владельцев на Reddit: поиск их не вернул. Истории взяты из новостей и отраслевой прессы.
- Русскоязычные и испаноязычные рассказы владельцев: по обоим языкам нашлись только справочные статьи. Из испаноязычных взят совет держать резерв 20%.

## 7. Источники

Проверка: 14 ноября 2026. Страницы, которые я открыл и прочитал сам, перечислены с подтверждёнными числами в `extra.verification.openedPages` (37 страниц: налоговая штата, NYC Business, NYC311, Контролёры штата и города, Con Edison, Департамент труда, Inspire Brands, Cushman & Wakefield, Сенат штата, City Record, Генеральный прокурор штата, Корнелл, ABCEats). Остальные источники увидены только в выдержках поиска.

Что изменила сверка:

- Плата за франшизу Dunkin' на странице франчайзера — $40 000, а не диапазон $40 000–$90 000 из пересказов.
- Концессия в парке с платой «$40 000 или 4% выручки» оказалась именно кафе (Dag Hammarskjold Park), с ростом минимума на 5% в год.
- Con Edison депозит с нового клиента требует, а не «может запросить».
- Работы для арендатора освобождаются от налога с продаж, только если договор передаёт улучшения собственнику и не обязывает их демонтировать.
- Опрос о газе — сентябрь 2017 года; средний ущерб от задержки — $140 000 на заведение.
- Закон штата требует вручить документ франшизы за 10 рабочих дней; федеральное правило о 14 днях открыть не удалось.
- Сбор Landmarks расходится в двух городских источниках: на открытой странице NYC Business — $50 и $3 за каждую тысячу сверх $25 000, на странице самой комиссии (только выдержка) — $95 и $5. В пакете оставлено $95 с пометкой о расхождении.
- За удаление асбеста город берёт от $200 до $1 200 по площади; для пола кафе в 800 кв. футов — $800. Запись `asbestos_abatement` пересчитана до $5 600.
- На странице NYC Business «Restaurant» нашлись два требования, которых не было ни в пакете, ни в моём первом проходе: штраф $400–$25 000 за работу вопреки Certificate of Occupancy и обязательный шумовой план на стройке. Оба добавлены.
- Эта же страница содержит шкалу штрафов для ресторанов по всем ведомствам (от $5 до $25 000) и открывается без отказов: она пригодится исследователям D07 и D08 для подтверждения их нарушений.


### Открыты и прочитаны (37)

- https://a816-health.nyc.gov/ABCEatsRestaurants/App/partials/controllers/faq.html — The first graded inspection, unannounced
- https://a856-cityrecord.nyc.gov/RequestDetail/20240628149 — A kiosk in a park; A stall at a seasonal food market, or a city concession for a kiosk or
- https://ag.ny.gov/sites/default/files/publications/franchise_booklet.pdf — Franchise fee (example: Gregorys Coffee)
- https://comptroller.nyc.gov/reports/whos-minding-the-storefronts/ — Empty storefronts are leverage; One storefront in nine is empty
- https://dol.ny.gov/transfers-business-and-your-contribution-rate — You inherit the seller's unemployment record; You inherit the seller's unemployment-insurance record
- https://nyc-business.nyc.gov/nycbusiness/business-services/initiatives/street-vending-in-nyc
- https://nyc-business.nyc.gov/nycbusiness/business-services/legal-assistance/commercial-lease-assistance-program — Get the lease reviewed, free if you qualify; Free lease lawyer
- https://nyc-business.nyc.gov/nycbusiness/description/asbestos-rules-and-regulations — Asbestos abatement (only if the report is positive); The asbestos report comes back positive
- https://nyc-business.nyc.gov/nycbusiness/description/certificate-of-occupancy
- https://nyc-business.nyc.gov/nycbusiness/description/construction-noise-mitigation-plan — A noise plan on the wall of the site; A neighbor complains about construction noise
- https://nyc-business.nyc.gov/nycbusiness/description/food-protection-course-for-mobile-vendors — Food Protection Course for Mobile Vendors
- https://nyc-business.nyc.gov/nycbusiness/description/food-service-establishment-permit — Buying a shop: apply for every permit in your own name; The 22-day clock starts when you apply
- https://nyc-business.nyc.gov/nycbusiness/description/mobile-food-vending-license — Mobile Food Vending License (the vendor's personal license); Cart: take the vendor course and get your license
- https://nyc-business.nyc.gov/nycbusiness/description/mobile-food-vending-unit-permit-full-term — Mobile Food Vending Unit permit (the cart's decal); coffee cart start: cart $16,500 + license $50 + course $53 + permit $7
- https://nyc-business.nyc.gov/nycbusiness/description/mobile-food-vendor-permit-temporary-seasonal
- https://nyc-business.nyc.gov/nycbusiness/description/performing-work-on-a-landmarked-property
- https://nyc-business.nyc.gov/nycbusiness/description/restricted-area-permit — Restricted Area vending permit (cart on private property, no waiting l; Where the cart stands
- https://nyc-business.nyc.gov/nycbusiness/description/shared-kitchens/about — Corner in someone else's shop: work under the host's permit; The host wants the corner back
- https://nyc-business.nyc.gov/nycbusiness/description/small-business-energy-efficiency-program — A project manager who maps your permits and coordinates pre-opening in
- https://nyc-business.nyc.gov/nycbusiness/description/temporary-food-service-establishment-permit — Temporary Food Service Establishment permit (markets, street fairs, po; Pop-up or market stand: get the temporary permit
- https://nyc-business.nyc.gov/nycbusiness/resources-by-industry/restaurant — Running a cafe where the Certificate of Occupancy does not allow one; Open in a space that is not legal for a cafe
- https://nysenate.gov/sites/default/files/press-release/attachment/cooking_without_gas.pdf — Waiting for gas; Gas or all-electric
- https://portal.311.nyc.gov/article/?kanumber=KA-01825 — temporary food permit for a market stand, USD a year; Market stand or a corner in someone else's shop
- https://portal.311.nyc.gov/article/?kanumber=KA-01911
- https://portal.311.nyc.gov/article/?kanumber=KA-02023 — Letter of No Objection for an old building without a Certificate of Oc; The building has no Certificate of Occupancy
- https://portal.311.nyc.gov/article/?kanumber=KA-02955 — Health Department consultative inspection (optional, ungraded); Pass the trade inspections and close out the permit
- https://portal.311.nyc.gov/article/?kanumber=KA-03354 — Cart: get on the waiting list for a supervisory license; Cart permits are capped
- https://www.coned.com/-/media/files/coned/documents/accountandbilling/non-res-rights-english.pdf — Con Edison security deposit for a new business account; Utility deposit
- https://www.coned.com/en/small-medium-size-businesses/gas-and-electric-service-update-guide — Electrical service upgrade for espresso, ice and refrigeration loads; Walk the space with an architect and an electrician
- https://www.cushmanwakefield.com/en/united-states/insights/retail-fit-out-cost-guide — Construction costs up 7%; Contractors raise their prices
- https://www.franchising.inspirebrands.com/dunkin — Franchise: site approval, mandated build-out, training; What a coffee franchise takes
- https://www.law.cornell.edu/nyctap/I08_0054.htm — A worker falls on your job; A worker falls from a ladder on your job
- https://www.osc.ny.gov/press/releases/2026/07/dinapoli-nyc-department-buildings-meets-critical-goals-lags-lower-priority-issues — How long a Buildings permit takes; Buildings permits slow down
- https://www.tax.ny.gov/pdf/current_forms/st/au196_10.pdf
- https://www.tax.ny.gov/pubs_and_bulls/advisory_opinions/sales/24-54s.htm — Sales tax on the contractor's bill (if the work is not a capital impro; The contractor's invoice comes with sales tax
- https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/bulk_sales.htm — Sales tax on the furniture and equipment bought with a business; Bought a business without notifying the Tax Department (bulk sale)
- https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/capital_improvements.htm — Add the clause that saves sales tax on the build-out; Sales tax on your build-out

### Первоисточники, увиденные только в выдержках поиска (38)

- https://a810-bisweb.nyc.gov/bisweb/bispi00.jsp — Look up the address before you fall in love with it
- https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-156650 — Department of Buildings alteration filing fee; The note says the 10% excludes government fees; those fees are now sep
- https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-157685 — civil penalty for work without a permit, multiple of the permit fee (o; minimum civil penalty for work without a permit, USD
- https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-215585 — Vending on a cart permit rented from its holder; Rent a cart permit on the black market
- https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-44016 — Keep trading on the seller's Health permit; Permits do not come with the shop
- https://dol.ny.gov/bizserve/ui/prg/rate/wbarchive — 2026 unemployment-insurance wage base per worker, USD
- https://franchise.gregoryscoffee.com/ — Franchise fee (example: Gregorys Coffee); Franchise training fee and pre-opening travel
- https://nyc.gov/site/lpc/about/pr2025/lpc-releases-new-analysis-20250414.page — share of Landmarks approvals issued at staff level
- https://nyc.gov/VendorEnforcement — Street vending enforcement officer; Roll the cart out without a permit
- https://prd2.nycgovparks.org/opportunities/concessions/rfps-rfbs-rfeis — A stall at a seasonal food market, or a city concession for a kiosk or
- https://www.bizbuysell.com/learning-center/article/buyer-training-after-business-sale/ — Who pays the business broker
- https://www.bizbuysell.com/learning-center/valuation-benchmarks/coffee-shops-cafes/ — Purchase price of an operating coffee shop; Choose how you enter: build, buy, franchise, cart or pop-up
- https://www.ftc.gov/business-guidance/resources/consumers-guide-buying-franchise — Franchise: read the disclosure document and call franchisees; The 14-day rule for franchises
- https://www.naggl.org/wp-content/uploads/2025/08/SBA-Info-5000-872051.7aFees.8.28.25.pdf — SBA loan guaranty fee (if you borrow to buy or build)
- https://www.nyc.gov/assets/buildings/pdf/ll156_sn.pdf — Construction work without a Department of Buildings permit; Renovate without filing plans
- https://www.nyc.gov/assets/buildings/pdf/ll160of2017_sn.pdf — The landlord's unpaid fines block your permit; arrears on a property above which the Buildings Department denies perm
- https://www.nyc.gov/assets/doh/downloads/pdf/about/healthcode/health-code-article5.pdf — The seller left unpaid Health Department fines
- https://www.nyc.gov/assets/doh/downloads/pdf/about/healthcode/health-code-chapter6.pdf — Lattes change the class of your cart
- https://www.nyc.gov/assets/doh/downloads/pdf/rii/mobile-food-vending-unit-penalty-schedule-for-administrative-code.pdf — Vending food from a cart with no license or no unit permit
- https://www.nyc.gov/assets/doh/downloads/pdf/rii/supervisory-licenses-what-vendors-need-to-know.pdf — Supervisory license renewal (cart)
- https://www.nyc.gov/assets/lpc/downloads/pdf/Storefronts_in_Historic_Districts_Fact_Sheet.pdf — Landmarks permit for storefront work (historic districts only); Landmarks staff permit for a complete storefront application, business
- https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf — Fix the deal in a letter of intent
- https://www.nyc.gov/mayors-office/news/2026/07/executive-order-no--18.html — Ask the city for a free project manager; A free city project manager
- https://www.nyc.gov/mayors-office/news/2026/07/mayor-mamdani-announces--open-for-small-business---over-50-refor.html — The city cuts small-business red tape
- https://www.nyc.gov/site/buildings/dob/project-requirements-asbestos.page — Asbestos investigation (ACP-5) before the permit; Order the asbestos investigation
- https://www.nyc.gov/site/buildings/industry/ahvs-renewal-guidelines-fees.page — Construction pace
- https://www.nyc.gov/site/buildings/property-or-business-owner/do-i-need-a-permit.page — Department of Buildings alteration filing fee; Let a handyman do the plumbing and wiring
- https://www.nyc.gov/site/buildings/property-or-business-owner/letter-of-no-objection-or-completion.page — Letter of No Objection for an old building without a Certificate of Oc; Old building with no Certificate of Occupancy: get a Letter of No Obje
- https://www.nyc.gov/site/buildings/safety/swo.page — Buildings inspector; Working against a Stop Work Order
- https://www.nyc.gov/site/dca/about/paid-sick-leave-FAQs.page — Sick leave balances survive a sale; The staff you kept arrive with sick days owed
- https://www.nyc.gov/site/dep/news/26-010/department-environmental-protection-proposes-fiscal-year-2027-water-rate
- https://www.nyc.gov/site/doh/business/food-operators/mobile-and-temporary-food-vendors.page — Cart: sign with a commissary and pass the cart inspection; A cart needs a commissary
- https://www.nyc.gov/site/doh/business/food-operators/temporary-food-service-establishments.page — Selling food at a market or pop-up without a temporary permit; Run a pop-up stand with no temporary permit
- https://www.nyc.gov/site/finance/business/business-commercial-rent-tax-crt.page
- https://www.nyc.gov/site/lpc/applications/fees.page — Storefronts in historic districts
- https://www.nyc.gov/site/lpc/applications/storefronts.page — Landmarks permit for storefront work (historic districts only); In a historic district: get the Landmarks permit first
- https://www.nycctp.com/wp-content/uploads/2021/03/EV-Make-Ready-Information-Sheet-DOT.pdf — utility-side electrical upgrade, months (low; Con Edison 2021 fleet sh; utility-side electrical upgrade, months (high)
- https://www.tax.ny.gov/pdf/current_forms/st/dtf17i.pdf — days before the first taxable sale to apply for the sales-tax Certific

### Вторичные: юристы, брокеры, отраслевая пресса, новости (50)

- https://abc7ny.com/post/popular-hells-kitchen-restaurant-has-been-cooking-gas-month-routine-inspection-found-leak/18837449/ — The gas to the building is shut off; A Hell's Kitchen restaurant cooked without gas for about six weeks in 
- https://acquisitionstars.com/buying-a-business/coffee-shop — The espresso machine belongs to a lender
- https://americasbestfranchises.com/franchises/gregorys-coffee/ — Franchise marketing fund; Gregorys Coffee total initial investment, USD (low)
- https://bisnow.com/new-york/news/retail/owners-of-landmarked-beatnik-caf-sue-landlord-for-constructive-eviction-117169 — A buckling wall stops the job; The relaunched Le Figaro Cafe in Greenwich Village sued its landlord i
- https://blog.bizben.com/how-to-buy-a-coffee-shop-5-red-flags-you-must-avoid/ — Buying a shop: prove the sales and find the liens; First month after buying
- https://blueberrybuilders.com/resources/cost-overruns-in-construction/ — Build-out contingency reserve; Take three bids and sign a contract with a payment schedule
- https://citylandnyc.org/unlicensed-plumber-fined — Plumbing or electrical work by an unlicensed person; The plumbing fails inspection
- https://commercialobserver.com/2013/08/weighing-in-on-key-money-deals/ — Key money for a closed, built-out cafe; Key money
- https://commercialobserver.com/2018/05/artisanal-owes-tf-cornerstone-24m-in-rent-at-387-park-avenue-south — rent a court held a restaurant owed for a Park Avenue South space it n; Artisanal Fromagerie Bistro leased 387 Park Avenue South and never ope
- https://corporate.findlaw.com/business-operations/security-deposit-concerns-for-the-thoughtful-tenant.html — Bank fee for a letter of credit posted as the lease deposit
- https://dailycoffeenews.com/2025/09/05/delonghis-computer-that-makes-coffee-trolls-u-s-tariffs — Tariff on European espresso machines
- https://dailycoffeenews.com/2026/02/18/backed-by-craveworthy-gregorys-coffee-launches-franchising — The brand has never had a franchisee
- https://documentedny.com/2026/03/06/street-vendors-criminal-summons-crackdowns-mamdani/ — Vending enforcement sweeps the corridor
- https://evgrieve.com/2022/04/owner-citys-bureaucratic-red-tape.html — An East Village deli at 75 Second Avenue sat finished but closed for m
- https://freshcup.com/coffee-goods-in-limbo-as-tariffs-impact-gear-manufacturers/ — Order long-lead equipment before the walls close; The espresso machine costs 15% more
- https://itkowitz.com/?p=4676 — Protections written into the lease; The landlord hands over the space late
- https://itkowitz.com/?p=505 — Buying a shop: get the landlord's consent in writing; Selling does not free you from the lease
- https://jerseydigs.com/?p=27849 — Cafe Peanut in Jersey City could not open ten months after signing its
- https://lawyerforbusiness.com/how-much-does-business-sale-lawyer-cost-ny/ — Lawyer and accountant for buying a business; Checks before buying a business
- https://nyrej.com/let-s-talk-money-what-s-the-commission — Who pays the broker
- https://queenseagle.com/all/2025/4/18/roosevelt-ave-crackdown-pushes-street-vendors-toward-pricey-black-market-permits — The black market in cart permits; vendors on the citywide waiting list in October 2023 (Independent Budg
- https://reach.dog/shop/vertical-ledge/products/full-service-mobile-coffee-cart — Coffee cart built to Health Department specifications
- https://riverdalepress.com/stories/small-businesses-need-some-serious-help-now,73068 — months one Bronx owner reported paying rent before opening; A Bronx small-business owner paid rent for 15 months before opening.
- https://sg.news.yahoo.com/papaya-king-settles-latest-legal-024500763.html — Papaya King's owner spent $500,000 on a new space and could not open t
- https://specialtyfoodmagazine.epubxp.com/i/123797/51 — Where the pop-up stands
- https://station-crm-site.pages.dev/blog/restaurant-leasing-nyc-broker-guide — renovation of an existing restaurant build-out, months (low); renovation of an existing restaurant build-out, months (high)
- https://thenycalliance.org/news-item/Con-Edison-Gas-Service — Decide on gas before you sign: check availability or go all-electric
- https://totalfood.com/buying-a-restaurant-watch-out-for-the-sellers-sales-tax-liabilities/ — A tax bill arrives for the previous owner's sales
- https://www.6sqft.com/nyc-street-vendor-advocates-push-to-lift-cap-on-licenses-after-adams-veto/ — people on the waiting list, advocates' estimate
- https://www.6sqft.com/smorgasburg-returns-for-16th-year-this-april-with-new-vendors/ — The market season ends
- https://www.800buycart.com/?p=740 — A cart built to Health Department rules and a permitted commissary to 
- https://www.alphacontractorsny.com/guides/commercial-build-out-cost-nyc — light renovation: days from lease to opening in this model (21 + 21 + ; independent cafe in a former cafe, total starting budget of the pack, 
- https://www.aprio.com/insights-events/bulk-sales-in-new-york-how-a-purchaser-was-left-responsible-for-a-sellers-sales-tax-liability-ins-article-tax/ — Buyers of delis and restaurants were assessed for their sellers' sales
- https://www.bisnow.com/new-york/news/other/key-considerations-for-determining-the-appropriate-security-deposit-and-good-guy-guarantee-77148 — Personal guaranty
- https://www.bizbuysell.com/new-york/coffee-shops-and-cafes-for-sale/ — Listings of operating coffee shops and built-out spaces offered for ke; Three years left on the lease you bought
- https://www.carltonfields.com/leasing-retail-stores-in-new-york-city/ — You pay the landlord's tax increases; Share of the building's property-tax increase (additional rent)
- https://www.commercialcafe.com/blog/good-guy-guarantee-nyc-real-estate/ — Negotiate the personal guaranty; Good guy guaranty
- https://www.cssny.org/news/entry/testimony-street-vendor-justice-will-strengthen-nycs-economy-through-equitable-inclusive-growth — reported black-market rent for a cart permit, USD (low)
- https://www.dnainfo.com/new-york/20150708/flatiron/con-ed-work-delays-slowing-down-new-restaurants-from-opening — A Lower East Side restaurant opened with salads and cold tapas in 2015
- https://www.entrepreneur.com/growth-strategies/no-one-would-rent-me-a-cafe-in-trendy-nyc-neighborhoods/438828 — Landlords will not rent to a first-timer; The founder of White Noise Coffee could not rent even 200-300 sq ft in
- https://www.franchisepayback.com/franchise/caffe-aronne — small-format espresso franchise, lowest total initial investment seen 
- https://www.jdsupra.com/legalnews/build-out-provisions-in-nyc-restaurant-1727571/ — Negotiate free rent and the rent start date; Rent starts before sales do
- https://www.katalystos.com/blog/restaurant-build-out-contract-and-liens — A subcontractor files a lien on the building
- https://www.levelset.com/mechanics-lien/new-york-lien-law-faqs — Your contractor's unpaid bills; Which contractor
- https://www.metro-manhattan.com/blog/rentescalations — Rent goes up every year; Yearly rent increase written into the lease
- https://www.metro-manhattan.com/security-deposit/ — How big the deposit gets; The bank needs three weeks for the letter of credit
- https://www.thehabitatgroup.com/articles/9654-require-tenants-to-pay-maximum-premium-rent-for-long-holdovers — Staying past the lease; holdover rent as a multiple of the last rent (low)
- https://www.webstaurantstore.com/espresso-machine-2gr-appi/238APLCV2.html — The machine you bought with the shop dies
- https://www.westsiderag.com/2014/03/27/bocca-di-bye-bye-restaurant-backs-out-because-of-red-tape — Bocca di Bacco walked away from a signed Upper West Side lease and abo
- https://www.whitefordlaw.com/news-events/client-alert-sba-issues-sop-50-10-8-key-changes-impacting-sba-7a-lending — Borrowing to buy a business; The bank wants 10% of your own money
