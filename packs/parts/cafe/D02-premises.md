# D02 — Помещение и физика зала (кафе, Нью-Йорк, 2026)

Исследователь D02. Дата: 14 ноября 2026. Фрагмент пакета: `packs/parts/cafe/D02-premises.json`.

**Важное ограничение этой сессии.** Веб-поиск работал, а открывать страницы напрямую сессия не могла: сетевая политика отклоняла любой запрос к сайтам (nyc.gov, amlegal, ada.gov и остальным). Поэтому пометка `verified` в этом фрагменте уже, чем в основном пакете: число показано поисковым инструментом в выдержке из самого первоисточника (текст закона или правила, страница nyc.gov или 311, отчёт Совета города, прайс продавца). У каждой такой записи стоит поле `"checkedVia": "search_excerpt"`: сборщик может одной командой понизить их до `estimate`. Целиком страницы я не читал. Всё остальное — `estimate` с расчётом в `note`.

Пробное слияние фрагмента с `packs/cafe.json` проходит `node build/validate-pack.mjs` с нулём ошибок и нулём предупреждений.

## 1. Вердикт

1. В пакете не было физики зала: ни распределения площади, ни очереди, ни «сидельцев», ни входа, ни инженерных систем. Теперь это 18 статей стартовых затрат, 9 рычагов, 10 срезанных углов, 12 нарушений, 40 событий и 12 механик.
2. Главное исправление: формула «60% площади — зал» неверна для малых помещений. Около 400 sq ft занимает неизменное ядро (стойка, очередь, туалет, мойки и склад, вход). В 500 sq ft помещается примерно 6 мест, а не 16.
3. В законе две ступени, и обе считаются не так, как думает новичок. Двадцатое место (вместе с уличными) требует туалета для гостей. Порог в 75 — это люди, а не стулья: стоящий в очереди считается за 5 sq ft.
4. Вместимость определяют столы, а не стулья: один гость с ноутбуком занимает 2–4 места. Правила про ноутбуки, рассадка и музыка меняют оборот места на 10–40%, и на это есть исследования и рассказы владельцев.
5. Слабое место работы: из 35 чисел в `setup`, `monthlyCosts` и `violations` подтверждены по выдержкам первоисточников только 8. Цены подрядчиков (вентиляция, электрика, жироуловитель, пандус) в Нью-Йорке публично не публикуются, они остались оценками.

## 2. Что добавлено

| Раздел | Записей | Что это |
|---|---|---|
| `sizing` | пересмотрен целиком | `sqftPerUnit` 18 → 21, пороги тесноты и пустоты, расчёты и источники в `note` |
| `setup` | 18 (17 новых, 1 исправлена) | пандус, автоматическая дверь, линия 220 В, усиление электроввода, обратный клапан, жироуловитель, замена кондиционера, прозрачная роллета, навес, зимний тамбур, воздушная завеса, лицензия и конструкция кафе на проезжей части, сертификат Place of Assembly, временный сертификат на одно мероприятие, разрешение Комиссии по памятникам, витринное стекло |
| `monthlyCosts` | 5 | плата городу за уличную посадку (тротуар и проезжая часть), ежегодная проверка обратного клапана, договор на обслуживание кондиционера, сбор за световую вывеску |
| `levers` | 9 | ноутбуки и Wi-Fi; рассадка; очередь и выдача; доступ в туалет; обслуживание вентиляции; вход зимой; уличные места; музыка; ступень у входа |
| `shortcuts` | 10 | лишние стулья сверх 19 мест; туалет без присмотра; открытая дверь при кондиционере; вывеска без разрешения; штендер и скамья на тротуаре; товар на пути эвакуации; пропуск проверки клапана; концерты сверх вместимости; столы в подвале; громкая музыка под квартирами |
| `violations` | 12 | у каждого закон, ведомство, штраф, источник |
| `officials` | 6 (4 новых, 2 расширены) | инспекторы DOB, FDNY, DSNY, Комиссии по правам человека; у DOHMH и DEP дополнен список проверок |
| `reports` | 7 | жалобы на конкурента по каждому новому нарушению |
| `events` | 3 | в стандартном формате: рейд по открытым дверям, волна жалоб на вывески, рост тарифа на воду |
| `ruleCards` | 26 | все не длиннее 280 знаков |
| `roadmap` | 6 | замер зала, выбор числа мест, проверка щитка, воды и вентиляции, проверка входа, статус памятника, заявка на проезжую часть |
| `suppliers` | 5 | вентиляция, вывески и навесы, сантехник с лицензией, консультант по доступности, стекло и роллеты |
| `extra.eventCatalog` | 40 | core 14, deep 17, exotic 9; точка 22, квартал 7, город 11 |
| `extra.mechanics` | 12 | core 6, deep 6; 61 число с источником |
| `extra.floorPlan` | 1 | зоны зала с площадями и таблица «площадь → места» |
| `extra.seatThresholds` | 2 (исправлены) | 20 мест и 75 человек |
| `extra.nonObvious` | 35 | в формате D00: `text`, `why`, `source` |
| `sources` | 93 | 41 из них — законы, правила и страницы города (nyc.gov, 311, свод правил, Dining Out NYC) |

Минимумы задания: `setup` 18 при пороге 12, `levers` 9 при 6, `violations` 12 при 8, событий 43 при 20, механик 12 при 4.

У каждого события каталога есть поле `trigger`: событие либо объявлено заранее и действует на всех, у кого есть уязвимость, либо наступает по календарю, либо следует из решения игрока через заданное число месяцев. Вероятностей нет.

## 3. Пятнадцать самых неочевидных находок

1. **Порог в 75 считает людей, а не стулья.** Строительный кодекс берёт 15 sq ft на человека в зоне столов и 5 sq ft на стоящего. Зона очереди в 70 sq ft — это 14 человек на бумаге. Зал на 48 мест уже даёт 75. Выше порога помещение становится «местом собраний»: второй выход, сертификат DOB и ежегодное разрешение FDNY.
2. **Двадцатое место — самое дорогое.** С 20 мест нужен туалет для гостей (Health Code §81.22(b)), и уличные места входят в счёт. Два столика на тротуаре превращают законный зал на 18 мест в нарушение: $300 на каждой проверке.
3. **Льгота 1977 года.** Помещение, где заведение с разрешением работало 5 декабря 1977 года или раньше, от туалета для гостей освобождено. Льгота пропадает при ремонте, для которого нужно разрешение DOB.
4. **Около 400 sq ft никогда не занимает стул.** Стойка 120, очередь и выдача 70, доступный туалет 60, мойки и склад 120, зона двери 25. Поэтому маленькое помещение теряет на ядро гораздо большую долю, чем крупное.
5. **Один гость с ноутбуком занимает 2–4 места.** Зал из столов на двоих и четверых полон, когда занято меньше половины стульев. Владелец считает 20 мест, человек в дверях не видит свободного стола.
6. **Запрет ноутбуков поднял продажи.** Владелица пекарни-кафе в Вермонте отключила Wi-Fi и запретила экраны в обед. Её слова: люди заходили, не находили стола и уходили — «деньги утекали за дверь». Потерянных гостей не видно, они не доходят до кассы.
7. **Люди смотрят на длину очереди, а не на её скорость.** Это вывод исследования в журнале Management Science (2013). Объединить две короткие очереди в одну длинную и быструю — значит потерять продажи. Умеренно более длинная очередь в черновике статьи приравнена к росту цены на 5%.
8. **Заказ с телефона может уменьшить мощность.** У Starbucks весной 2024 года около 15% мобильных заказов («mid-teens percent») остались невыполненными: бар не справлялся. Приложение добавляет напитки тем же двум рукам в ту же минуту.
9. **Открытая дверь при работающем кондиционере незаконна для любого бизнеса.** Штраф $250 за каждую дверь или окно. В 2024 году город провёл почти 6 300 таких проверок.
10. **Вывеску проще всего «сдать».** В 2018 году анонимные жалобы в 311 на вывески выросли с 310 до 1 046 за год. Мелкие магазины получили штрафы по $6 000 за вывески, висевшие годами. Совет города потом заморозил такие штрафы до 2023 года.
11. **Закон о роллетах отменили за день до срока.** Закон 2009 года требовал к 1 июля 2026 года заменить глухие роллеты на прозрачные на 70%. Владельцам называли $6 000–7 000 за штуку. 30 июня 2026 года Совет отменил срок 51 голосом против нуля. Часть владельцев уже заплатила.
12. **Газ отключают всему зданию.** Если Con Edison находит утечку в трубах дома, счётчик запирают, и арендатор ждёт сантехника арендодателя. В одном случае из прессы ресторан ждал больше шести недель, в другом — четыре месяца. Кафе без газа этой угрозе не подвержено, а решение принимается на ремонте.
13. **Свет записан в санитарном кодексе.** 50 фут-кандел над столом приготовления, 20 у раковины для рук. Модный полутёмный бар не проходит проверку.
14. **Музыку меряют в спальне соседа.** Предел — 42 дБ внутри чужой квартиры. Первый штраф $2 000, и он снижается до нуля только после доказанного исправления.
15. **Подвал — склад с условиями.** Около 60% канализации города общесплавная, в ливень она идёт обратно через подвальные сливы. Продукты, которых коснулась эта вода, выбрасывают. Обычная страховка обратный подпор канализации не покрывает. Столы для гостей в подвале — нарушение сертификата здания.

Остальные 20 пунктов — в `extra.nonObvious`.

## 4. Исправления существующего пакета

| Запись | Было | Стало | Почему |
|---|---|---|---|
| `sizing.sqftPerUnit` | 18 | 21 | Исправляю, потому что 18 давало 26 мест в 800 sq ft. Это выше собственного диапазона заметок пользователя (15–25). Расчёт по зонам даёт 22 места: 480 / 22 = 21. |
| `sizing.crowdPenaltyAbove` | 0.9 | 0.85 | Исправляю, потому что одиночные гости занимают столы на двоих, и зал полон раньше, чем заняты все стулья. Значение игровое. |
| `sizing.emptyPenaltyBelow` | 0.4 | 0.3 | Исправляю, потому что доказательств, что пустой зал отпугивает покупателя кофе, почти нет: одно опросное исследование 2025 года. 60% покупателей не ищут место. Значение игровое. |
| `sizing.unitsServedPerSizeMonth` | 170 | 170 | Число оставлено. Добавлен расчёт: 12 часов, занятость 47%, среднее пребывание 60 минут. |
| `sizing.takeawayShare` | 0.6 | 0.6 | Число оставлено. Публичной доли «с собой» для независимых кофеен нет, это сказано в `note`. |
| `extra.seatThresholds[1]` | «75 мест» | 75 человек, около 48 мест | Исправляю, потому что закон считает людей по площади, а не стулья. Добавлен `setupItemId`. |
| `extra.seatThresholds[0]` | 20 мест | 20 мест, плюс льгота 1977 года и штраф | Уточнение по тексту §81.22(b). |
| `setup.customer_restroom` | без нарушения | `withoutItViolation: no_patron_toilet` | Исправляю, потому что у предмета не было последствия. Цена $12 000 осталась оценкой: публичной цены нет. |
| `officials.health_inspector` | 6 проверок | 9 | Добавлены три нарушения D02. Список в фрагменте полный, старые проверки сохранены. |
| `officials.dep_inspector` | жироуловитель | плюс обратный клапан и шум | То же. |

Что сборщику нужно свести вручную:

- **Срок лицензии на уличную посадку.** В пакете карточка `outdoor_dining_wait` говорит о 19 месяцах (Контролёр города, октябрь 2026). Отчёт Комиссии по пересмотру Хартии 2026 года даёт 6–8 месяцев для тротуара и 3–5 для проезжей части. Первое — факт по уже выданным, второе — оценка срока рассмотрения. Я поставил `waitDays: 120` для проезжей части и не менял 240 для тротуара.
- **Проверка обратного клапана.** Она уже упомянута в существующей строке `maintenance`. Моя строка `backflow_annual_test` ($21 в месяц) с ней пересекается: оставить одну.
- **Расход электричества.** В пакете допущение 3 000–5 000 кВт·ч в месяц. Данные CBECS (по вторичным пересказам) дают для 800 sq ft от 1 930 до 4 190 кВт·ч. Нижняя граница пакета выглядит верной, верхняя завышена.
- **Карточки про 20 мест.** В пакете есть `seats_20`, я добавил `no_patron_toilet` с льготой 1977 года и запретом вести гостей через кухню. Можно объединить.
- **Пересечения с другими исследователями.** Отказ кондиционера и неотложенное обслуживание — с D03. Газ и ожидание Con Edison — с D01. Ливень и подвал, уличный сезон — с D07. Иски о доступности и шум — с D08. Очередь и пропускная способность бариста — с D06.

## 5. Просьбы к ведущему

Механики по важности. Полные формулы и числа — в `extra.mechanics`.

1. **`floor_plan_budget` — площадь как бюджет.** Заменить `floor(sqft × 0.6 / sqftPerUnit)` на `floor((sqft − fixedCoreSqft) / netSqftPerSeat)`. Нужны поля `sizing.fixedCoreSqft` (395; 335 со складом в подвале) и `sizing.netSqftPerSeat` (15, 18 или 22). Пока движок не изменён, `sqftPerUnit: 21` сводит обе формулы при 800 sq ft. Это прямой ответ на слова пользователя «когда прям забито и места мало, это очень плохо».
2. **`effective_seats_and_table_mix` — столы, а не стулья.** Эффективные места = места × доля использования столов (0.75 для столов на двоих и четверых, 0.9 с общим столом и стойкой у окна).
3. **`crowding_curve` — теснота и пустота как наклон.** Вместо двух флагов — плавный рост ухода гостей от загрузки 0.7 до 1.0.
4. **`queue_balking` — видимая очередь.** Один пиковый час в день: приход против выработки бара, место под очередь, потери за каждые пять человек сверх вместимости зоны. Нужны числа D06: доля пикового часа и напитков на бариста в час.
5. **`seat_camping_dwell_mix` — кто сколько сидит.** Оборот места считается из смеси длительностей пребывания. Рычаги меняют её через новое поле варианта `seatTurnsMult`.
6. **`occupancy_thresholds` — две ступени закона.** Уличные места входят в счёт двадцати. Переход через 20 забирает 60 sq ft под туалет.
7. **`outdoor_seating_season`** — геометрия тротуара, лицензия с ожиданием, сезон, плата за квадратный фут по сектору.
8. **`utility_capacity_budget`** — амперы щитка против суммы оборудования, ожидание Con Edison, газ или полностью электрическое помещение.
9. **`accessibility_exposure`** — ступень у входа как висящий риск до объявленной волны исков.
10. **`deferred_building_maintenance`** — у каждого пропущенного обслуживания свой запал в месяцах. Тот же приём годится для оборудования из D03.
11. **`frontage_visibility`** — вывеска, навес и штендер как множитель доли зашедших.
12. **`cellar_storage`** — склад в подвале: плюс три места, минус 3% мощности, риск ливня.

Чего не выражает формат:

- **Поля вариантов рычага:** `seatTurnsMult`, `seatsFitMult`, `outdoorSeats`, `monthsActive`. Сейчас `effects` знает только `quality`, `reputation`, `demand`, `capacity`. Без поля для оборота места рычаги про ноутбуки, рассадку и музыку в движке почти ничего не делают.
- **Эффекты событий вне белого списка:** `seats`, `seatTurns`, разовые деньги (`cash` с `add`), `closureDays`, запуск нарушения (`violation`), `waitDays`. Плюс условие `onlyIf` и поле `trigger`.
- **Ходы игрока в событии:** кроме `lever` и `shortcut` нужны `setup` (купить предмет), `staff` (нанять) и `choice` — разовое решение, которого нет среди рычагов. Пример: «перенести товар наверх перед ливнем».
- **Свойства места на карте:** высота ступени у входа, ширина тротуара и длина фасада, тип коридора или сектор уличной посадки, мощность щитка в амперах, площадь подвала, исторический район.
- **Законность варианта по условию.** Вариант «туалет только для персонала» законен до 19 мест и становится нарушением с 20.
- **Сезонный предмет.** Зимний тамбур покупается каждый год. Я поставил `lifespanMonths: 5`, нужен признак ежегодной покупки.
- **Иск вместо проверки.** Нарушение `accessibility_barrier` находит не инспектор, а истец. Чиновник в записи — заглушка, а главный расход — юристы, для них нет поля.
- **Первое нарушение за $0.** У шума и у части санитарных пунктов первый штраф снимается, если нарушение исправлено. Формула `base + perMonth` этого не выражает.
- **Разовый налоговый кредит** (форма IRS 8826, до $5 000 в год за расходы на доступность).

## 6. Не найдено

Нормы и штрафы:

- Таблица 1004.5 именно в редакции кодекса Нью-Йорка 2022 года. Значения 15 и 5 sq ft взяты из кодекса штата и модельного кодекса.
- Плата за ежегодное разрешение FDNY Place of Assembly и действующая плата DOB за сертификат ($235 — из старого руководства). Штраф за работу без сертификата (§28-117.1).
- Действующая сумма штрафа за вывеску без разрешения. Статус моратория после 1 января 2023 года.
- Действующая шкала штрафов за открытую дверь при кондиционере: суммы $250 и $500 взяты из прессы 2015 года.
- Официальная шкала FDNY за загромождённый выход: $950 взяты из обзора частной компании.
- Официальный штраф DEP за непроверенный обратный клапан. Статус законопроекта Int 0768-2026.
- Штрафы за тамбур вне сезона, за открытый люк подвала, за нарушение правил Комиссии по памятникам.
- Штрафы для лицензированной уличной посадки, вышедшей за границы. Число действующих лицензий на 2026 год. Ширина зоны у бордюра. Промежуточные ставки для проезжей части ($8 и $14 не подтверждены).
- Норма числа унитазов для ресторанов в таблице 403.1 сантехнического кодекса города. Текст §81.21 о раковинах для рук.
- Принят ли тариф на воду на 2027 финансовый год (+6% было предложением).

Цены:

- Строительство туалета для гостей, постоянный пандус, плата за согласие DOT на пандус на тротуаре.
- Официальные цены и сроки Con Edison на усиление ввода. Тарифы SC2 и SC9 из первоисточника.
- Нью-йоркские цены на установку жироуловителя и витринное стекло: взяты национальные справочники.
- Типичная сумма мирового соглашения по иску о доступности к магазину или кафе.

Поведение гостей:

- Доля заказов «с собой» у независимой кофейни. Наблюдательные исследования занятости мест и длительности пребывания именно в кофейнях. Данные Bloom — это устройства в Wi-Fi, а не люди на стульях.
- Точные числа из опубликованной версии исследования очередей и из статьи Миллимана 1986 года о темпе музыки.
- Влияние сквозняка у двери на занятость мест.
- Частота взломов витрин на одно кафе.

Рассказы владельцев: Reddit и форумы поисковый инструмент не отдал. Истории взяты из прессы (NPR, NY1, Gothamist, Streetsblog, местные издания). Этот пробел закрывают D00 и D10.

## 7. Источники

Все 93 ссылки с названиями лежат в `sources` фрагмента. Ниже они сгруппированы по темам.

**Законы, правила и страницы города** (41)

- [NYC Health Code §81.22 Employee and Patron Toilets (American Legal Publishing)](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-46264)
- [24 RCNY Chapter 23, Appendix 23-C: Food Service Establishment Penalty Schedule](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-43593)
- [NYC Health Code §81.19 Lighting and Ventilation](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-46238)
- [NYC Health Department, Chapter 23: Food Service Establishment Sanitary Inspection Procedures and Letter Grading](https://www.nyc.gov/assets/doh/downloads/pdf/about/healthcode/health-code-chapter23.pdf)
- [NYC311: Restaurant Bathroom Rules](https://portal.311.nyc.gov/article/?kanumber=KA-01351)
- [2022 NYC Building Code, Chapter 3: Use and Occupancy Classification (ICC)](https://codes.iccsafe.org/content/NYNYCBC2022P1/chapter-3-use-and-occupancy-classification)
- [2022 NYC Building Code, Chapter 10: Means of Egress (NYC Buildings)](https://www.nyc.gov/assets/buildings/codes-pdf/cons_codes_2022/2022BC_Chapter10_EgressWBwm.pdf)
- [NYC Building Code §1006.2.1 and Table 1006.2.1: spaces with one exit](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-173045)
- [New York State Building Code 2020, Chapter 10, Table 1004.5 (UpCodes)](https://up.codes/viewer/new_york/ibc-2018/chapter/10/means-of-egress)
- [NYC Buildings: Place of Assembly Certificate of Operation](https://www.nyc.gov/site/buildings/property-or-business-owner/place-of-assembly-certificate-of-operation.page)
- [NYC Buildings: Place of Assembly guide (older edition)](https://www.nyc.gov/assets/buildings/pdf/pa_guide.pdf)
- [NYC Business: Temporary Place of Assembly Certificate of Operation](https://nyc-business.nyc.gov/nycbusiness/description/temporary-place-of-assembly-certificate-of-operation)
- [FDNY Restaurant Fire Safety Guide](https://www.nyc.gov/assets/fdny/downloads/pdf/business/restaurant-fire-safety-guide.pdf)
- [OATH/ECB Buildings Penalty Schedule](https://www.nyc.gov/html/ecb/downloads/pdf/BuildingsPenaltySchedule.pdf)
- [1 RCNY §102-01: Buildings violation classification and penalties](https://www.nyc.gov/assets/buildings/rules/1_RCNY_102-01.pdf)
- [NYC Buildings: Storefront Accessibility (presentation)](https://www.nyc.gov/assets/buildings/pdf/Storefront_Accessibility.pdf)
- [NYC DCWP press release, April 2025: Shut the Front Door](https://www.nyc.gov/site/dca/news/012-25/in-honor-earth-day-city-reminds-local-businesses-shut-front-door-keep-doors-and)
- [NYC Buildings: project requirements for signs](https://www.nyc.gov/site/buildings/property-or-business-owner/project-requirements-owner-signs.page)
- [NYC Administrative Code Table 28-112.2: Buildings fees (from the research notes)](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-156650)
- [NYC Landmarks Preservation Commission: storefront applications](https://www.nyc.gov/site/lpc/applications/storefronts.page)
- [NYC Buildings service notice, February 17, 2026: security grille visibility](https://www.nyc.gov/assets/buildings/pdf/security_grille-sn.pdf)
- [NYC311: Blocked Sidewalk or Street](https://portal.311.nyc.gov/article/?kanumber=KA-01980)
- [16 RCNY §19-103: Sanitation Penalty Schedule](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-99532)
- [NYC311: Awning, Canopy, Marquee or Storm Enclosure Complaint](https://portal.311.nyc.gov/article/?kanumber=KA-02227)
- [Dining Out NYC: sidewalk cafe siting clearances](https://www.diningoutnyc.info/rules/sidewalk/siting-clearances)
- [Dining Out NYC: sidewalk cafe setup area](https://www.diningoutnyc.info/rules/sidewalk/siting-setup-area)
- [Dining Out NYC: eligibility and application](https://www.diningoutnyc.info/apply)
- [Dining Out NYC: enforcement (already in the pack)](https://www.diningoutnyc.info/enforcement)
- [NYC DOT Street Design Manual: Clear Path](https://www.nycstreetdesign.info/furniture/clear-path)
- [Dining Out NYC: sidewalk cafe site plan form (corridor types and clearances)](https://www.diningoutnyc.info/sites/default/files/2024-03/sidewalk-cafe-site-plan-form.pdf)
- [NYC Council report: Understanding Delays in New York City's Permanent Outdoor Dining Program (April 2025)](https://council.nyc.gov/press/wp-content/uploads/sites/56/2025/04/outdoor-dining.pdf)
- [NYC Charter Revision Commission: adopted final report, 2026](https://www.nyc.gov/assets/charter/html/coge-adopted-final-report-2026.html)
- [NYC311: Outdoor Dining Information and Application](https://portal.311.nyc.gov/article/?kanumber=KA-03604)
- [NYC DEP: Backflow Prevention Frequently Asked Questions](https://www.nyc.gov/site/dep/about/backflow-prevention-frequently-asked-questions.page)
- [NYC DEP: Disposing of Grease as a Business](https://www.nyc.gov/site/dep/water/disposing-of-grease-as-a-business.page)
- [NYC DEP: How We Bill You (water and sewer rates)](https://www.nyc.gov/site/dep/pay-my-bills/how-we-bill-you.page)
- [NYC DEP: sewer backup report](https://www.nyc.gov/assets/dep/downloads/pdf/water/wastewater/sbu-report.pdf)
- [NYC311: Sewage or Flood Clean-Up](https://portal.311.nyc.gov/article/?kanumber=KA-02997)
- [NYC311: Sidewalk Cellar Door Complaint](https://portal.311.nyc.gov/article/?kanumber=KA-02292)
- [NYC DEP: commercial music noise violation, zero penalty for a first offense](https://www.nyc.gov/assets/dep/downloads/pdf/air/noise/commercial-music-noise-violation-zero-penalty.pdf)
- [NYC Buildings: Single-Occupant Toilet Signage (Local Law 79 of 2016)](https://www.nyc.gov/site/buildings/property-or-business-owner/single-occupant-toilet-signage.page)

**Федеральные нормы и налоги** (5)

- [2010 ADA Standards §226: Dining Surfaces and Work Surfaces](https://www.corada.com/documents/2010ADAStandards/226)
- [U.S. Access Board: Guide to the ADA Standards, Chapter 6: Toilet Rooms](https://www.access-board.gov/ada/guides/chapter-6-toilet-rooms/)
- [ADA requirements for ramps (secondary summary)](https://www.accessibilitychecker.org/blog/ada-requirements-for-ramps/)
- [IRS Form 8826: Disabled Access Credit](https://www.irs.gov/pub/irs-pdf/f8826.pdf)
- [Seyfarth Shaw ADA Title III blog: 2025 federal filing counts](https://www.adatitleiii.com/2026/03/federal-court-website-accessibility-lawsuit-filings-bounce-back-in-2025/)

**Исследования** (10)

- [Secondary summary of CBECS electricity intensity by building type](https://commercialenergyadvisors.com/resources/how-much-commercial-electricity-cost-2026/)
- [Cornell restaurant research: diners are dissatisfied with close-set tables (2009)](https://www.hospitalitynet.org/news/4039649.html)
- [Robson, Kimes, Becker, Evans: Consumers' Responses to Table Spacing in Restaurants, Cornell Hospitality Quarterly 52(3), 2011](https://journals.sagepub.com/doi/10.1177/1938965511410310)
- [Lu, Musalem, Olivares, Schilkrut: Measuring the Effect of Queues on Customer Purchases, Management Science 59(8), 2013](https://pubsonline.informs.org/doi/abs/10.1287/mnsc.1120.1686)
- [Working paper version of the queue study (Columbia Business School, 2011)](https://business.columbia.edu/sites/default/files-efs/pubfiles/4642/deli_paper%200523_2011-%20post.pdf)
- [Waitwhile consumer survey: the state of waiting in line, 2024](https://waitwhile.com/blog/consumer-survey-waiting-in-line-2024/)
- [Bloom Intelligence: coffee shop data, Wi-Fi presence at 25 US coffee shops (2026)](https://bloomintelligence.com/coffee-shop-marketing/)
- [How does background music affect dining duration, tips and bill amounts? A field experiment (2024)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11673941/)
- [Revisiting crowded restaurants in the post-pandemic era, Sustainability 17(18), 2025](https://www.mdpi.com/2071-1050/17/18/8400)
- [Secondary summary of the University of Cincinnati signage study (2012)](https://federalheath.com/company/news-insights/how-important-are-signs-anyway)

**Пресса и рассказы владельцев** (17)

- [NY1: Surge in lawsuits by a small group of plaintiffs with disabilities draws scrutiny (2019)](https://ny1.com/nyc/all-boroughs/news/2019/10/25/surge-in-lawsuits-by-small-group-of-with-disabilities-draws-scrutiny)
- [CBS New York: City Council approves moratorium on fines for awnings and signs](https://www.cbsnews.com/amp/newyork/news/moratorium-on-fines-for-awnings)
- [The Brooklyn Home Reporter: Hard stop on signage fees as Council secures new Awning Act (2018)](https://brooklynreporter.com/2018/12/hard-stop-on-signage-fees-as-city-council-secures-new-awning-act/)
- [NY1: City Council votes to repeal deadline for new roll-down security gates (July 2026)](https://ny1.com/nyc/all-boroughs/news/2026/07/02/city-council-votes-to-repeal-deadline-for-new-roll-down-security-gates)
- [Gothamist: Council scrambles to reverse impending ban on metal storefront security gates (2026)](https://gothamist.com/news/nyc-council-scrambles-to-reverse-impending-ban-on-metal-storefront-security-gates)
- [Streetsblog NYC: Here's how much outdoor dining costs restaurants (April 2025)](https://nyc.streetsblog.org/2025/04/04/fare-fares-heres-how-much-outdoor-dining-costs-restaurants)
- [Streetsblog NYC: Year-round outdoor dining poised to return under Council bill (August 2026)](https://nyc.streetsblog.org/2026/08/13/year-round-outdoor-dining-poised-to-return-under-council-bill)
- [The City Reporter: year-round roadside dining set to return under newly passed bills (August 2026)](https://www.thecityreporter.nyc/2026/08/13/nyc-outdoor-dining-roadside-sheds-new-laws-restaraunts/)
- [W42ST: gas shutoff leaves a Hell's Kitchen restaurant in limbo for over a month](https://w42st.com/post/gas-shutoff-drags-on-at-sesamo-leaving-restaurant-in-limbo-for-over-a-month/)
- [ABC7 New York: restaurant cooking without gas for over a month after an inspection found a leak](https://abc7ny.com/post/popular-hells-kitchen-restaurant-has-been-cooking-gas-month-routine-inspection-found-leak/18837449/)
- [Customer Experience Dive: takeaways from Starbucks' customer experience plans](https://www.customerexperiencedive.com/news/4-takeaways-starbucks-customer-experience/756355/)
- [GeekWire: Starbucks CEO on bringing order to mobile ordering (2024)](https://www.geekwire.com/2024/on-his-first-earnings-call-starbucks-ceo-lays-out-plan-to-bring-order-to-mobile-ordering/)
- [CNN: Starbucks ends its open-door policies (January 2025)](https://www.cnn.com/2025/01/14/food/starbucks-restroom-policy)
- [NPR: No laptops, no Wi-Fi: how one cafe fired up sales (2014)](https://www.npr.org/blogs/alltechconsidered/2014/04/10/300518819/no-laptops-no-wi-fi-how-one-cafe-fired-up-sales)
- [NPR: public restrooms and business owners (2017)](https://www.npr.org/sections/health-shots/2017/05/08/526523520/public-restrooms-become-ground-zero-in-the-opioid-epidemic)
- [Syndicated article: how long you can sit in a coffee shop (cafe chief executive quoted)](https://www.yahoo.com/lifestyle/heres-exactly-long-sit-coffee-070007503.html)
- [Greenpointers: a bakery line blocked neighbors' homes (2024)](https://greenpointers.com/2024/04/01/radio-bakery-stoop-sale/)

**Цены, подрядчики, отраслевые справочники** (20)

- [Reliable Ramps: AlumiRamp threshold ramp price list](https://reliableramps.com/products/alumiramp-threshold-ramp-tr06n)
- [ADA door operator cost guide (vendor)](https://ufiredoors.com/blog/ada-door-operator-cost/)
- [LISC NYC Commercial Corridor Challenge: storefront improvement design guidelines](https://www.lisc.org/media/filer_public/1b/91/1b916163-0300-4298-9439-4981884e9abd/corridor_challenge_storefront_improvement_design_guidelines_-___final.pdf)
- [Permit aggregator: storefront awning filing, East Village (declared job cost)](https://sinra.ai/projects/permits/general-construction-153-second-avenue-manhattan-850583358)
- [Glazier guide: storefront window cost](https://www.insightglass.com/how-much-do-storefront-windows-cost/)
- [NYC fabricator: winter vestibules, prices](https://www.signsny.com/outdoor/winter-vestibules)
- [Cost guide: air curtains](https://www.pickcomfort.com/cost-air-curtain-typical-prices-what-affects-quote/)
- [ACHR News: eatery eliminates cold complaints with air curtains](https://achrnews.com/articles/159663-michigan-eatery-eliminates-cold-complaints-with-air-curtains)
- [1st-line Equipment: commercial espresso machine basic requirements](https://www.1st-line.com/customer-education/commercial-espresso-machine-basic-requirements/)
- [Commercial espresso machine buyer's guide (circuit sizes)](https://foodservicenerd.com/guides/how-to-choose-a-commercial-espresso-machine/)
- [NYC electrical contractor: Con Edison service upgrade guide, 2026](https://triumphelectricinc.com/con-edison-service-upgrade-guide-powering-your-nyc-property-in-2026/)
- [Third-party summary of Con Edison commercial rates](https://nectarclimate.com/rates/consolidated-edison-coned)
- [NYC contractor: commercial HVAC replacement cost, 2026](https://www.vincomechanical.com/hvac-replacement-cost-nyc)
- [HVAC maintenance budget guide (vendor)](https://oxmaint.com/industries/hvac/hvac-maintenance-budget-planning-optimizing-spend)
- [Vendor guide: restaurant seating layout, square feet per seat](https://www.gofoodservice.com/guides/designing-your-restaurant-seating-layout)
- [Toast: how to design a coffee shop floor plan](https://pos.toasttab.com/blog/on-the-line/coffee-shop-floor-plans)
- [Coffee shop layout guide (vendor)](https://therestaurantwarehouse.com/blogs/restaurant-equipment/coffee-shop-layout)
- [Sber: preparing to open a coffee shop (in Russian; 1.6 sq m per guest)](https://www.sberbank.ru/start/articles/coffee/prepare_to_open)
- [Seven principles of designing a coffee bar (in Russian)](https://alataucitybank.kz/business/osim/articles/sem-fundamentalnykh-printsipov-proektirovki-kofeynogo-bara)
- [Fire protection company summary of Fire Department violation categories and penalties (2026)](https://www.tfp1.com/blog/fdny-violation-codes/)
