# D07 — Погода, сезон, улица, город

Ниша: кафе. Нью-Йорк, 2026 год. Исследование проведено 14 ноября 2026 года.
Данные: `packs/parts/cafe/D07-weather-street-city.json`.

## 1. Вердикт

1. **Сдано.** 83 события в `extra.eventCatalog` (у каждого — месяцы, настоящий сигнал и ход игрока), 19 рычагов, 9 срезанных углов, 10 нарушений, 25 карточек правил, 7 механик. Наложение фрагмента на `packs/cafe.json` проходит `validate-pack.mjs` с нулём ошибок и нулём предупреждений.
2. **Главное по зиме.** Снег у входа — это не «минус поток», а часы закона: 4 часа на уборку после дневного снегопада, штраф $100–350 за каждый снегопад и иск упавшего со средней суммой $45 000. Всё это следует из решения игрока, а не из кубика.
3. **Главная поправка.** Погода меняет состав заказов сильнее, чем их число: жара не опустошает кофейню, а переводит её на холодные напитки. Значение `heat: 0.95` в погодной модели для кафе неверно.
4. **Ограничение.** Сетевая политика среды закрыла прямой доступ к сайтам, работал только веб-поиск. Поэтому у всех чисел `confidence: "estimate"`, а происхождение показано полем `evidence`. Ни одно число не выдумано: где цифры нет, это записано в разделе 6.
5. **Первое действие.** Открыть доступ к хостам из раздела 5.6 и одним проходом превратить 26 событий и 8 нарушений с пометкой `official_excerpt` в `verified`. Затем подключить механику `sidewalk_clock`: она закрывает пример пользователя про гололёд.

### Как проверялись числа

`WebFetch` на `www.nyc.gov`, `codelibrary.amlegal.com` и остальные хосты вернул отказ: сетевая политика среды. Работал только веб-поиск, который отдаёт выдержки страниц. Поэтому строгого `verified` («сам открыл первоисточник») в этом файле нет ни у одного числа. Вместо этого у каждой записи стоит поле `evidence`:

| `evidence` | Что значит | Событий каталога |
|---|---|---|
| `official_excerpt` | Поиск процитировал число со страницы ведомства, из текста закона или решения суда, названных в `source` | 26 |
| `secondary` | Новости, отраслевая пресса, отчёт страховщика или компании | 34 |
| `calc` | Мой расчёт или игровое значение; расчёт записан в `note` | 23 |

Все множители эффектов событий — игровые значения, выведенные из настоящих чисел. Вывод записан в `note` каждой записи.

## 2. Что добавлено

| Раздел | Записей | Что внутри |
|---|---|---|
| `extra.eventCatalog` | 83 | 25 `core`, 46 `deep`, 12 `exotic`; по масштабу: точка 22, квартал 26, город 27, страна 7, мир 1 |
| `extra.mechanics` | 7 | `sidewalk_clock`, `weather_drink_mix`, `storefront_visibility_stack`, `district_calendar`, `basement_flood_exposure`, `trash_and_rodent_pressure`, `outdoor_seat_days` |
| `extra.claims` | 3 | Иски упавших: на тротуаре, на мокром полу, в открытый люк подвала. Новый тип записи, см. раздел 5 |
| `extra.nonObvious` | 32 | Формат `{ text, why, source }`, как в задании D00 |
| `extra.monthlyClimate`, `drinkMixByTemperature`, `weatherDayEffects` | 3 таблицы | Погода по месяцам, доля холодных напитков, множители по типам дней |
| `extra.officeWeek`, `schoolCalendar2026_27` | 2 таблицы | Офисная неделя и школьный календарь как настоящие сигналы |
| `extra.comparisonsAbroad` | 4 | Германия, Россия и Казахстан, Сиэтл и другие города — для сравнения |
| `extra.fixesToExistingData` | 9 | Поправки к пакету и к колоде событий, см. раздел 4 |
| `levers` | 19 | 9 `core`, 9 `deep`, 1 `exotic` |
| `shortcuts` | 9 | У каждого есть нарушение |
| `violations` | 10 | 9 городских (снег, тротуар, мусор, листовки, вывески, кондиционер, шум) и 1 трудовое |
| `ruleCards` | 25 | Все короче 280 знаков, у каждой источник |
| `officials` | 1 | `sanitation_agent` — агент Департамента санитарии, новая роль инспектора |
| `reports` | 2 | Жалобы в 311 на тротуар и мусор, на открытую дверь с кондиционером |
| `events` | 8 | Короткие версии главных событий для нынешнего движка; одно из них — исправление `sidewalk_shed` |
| `setup` | 4 | Баки с крышками, снежный набор, коврики, стеллажи для подвала |
| `sources` | 119 | Полный список в разделе 7 |

### 2.1. Пять обязательных тем задания

| Тема | Что сделано |
|---|---|
| Погода по месяцам и продажи разных напитков, с числами | Таблица ниже; формула доли холодных напитков; таблица множителей по типам дней; 10 событий о погоде и уличных местах |
| Зима у входа | Механика `sidewalk_clock`; нарушение `snow_ice_not_cleared`; иски `sidewalk_fall_claim` и `wet_floor_fall_claim`; рычаги `snow_ice_plan`, `entrance_floor_safety`, `winter_proofing`, `storm_day_policy`; 13 зимних событий |
| Улица | Механика `storefront_visibility_stack`; 23 события: леса, раскопки, отключение воды, закрытая станция, выходные без метро, ярмарка, съёмки, велодорожка, тележка с кофе, люк подвала, предписание по тротуару, жалоба на шум, взлом, зоны вывоза мусора |
| Городские события | Механика `district_calendar`; 26 событий: офисная неделя, школьный год, туристы, парады, марафон, неделя ООН, чемпионат мира, забастовка железной дороги, календари районов |
| Среда | Механики `basement_flood_exposure` и `trash_and_rodent_pressure`; 11 событий: поломка кондиционера в жару, снижение напряжения, дым, ливень, обратный ток канализации, тропический шторм, засуха, крысы, снос по соседству, мыши, мошки |

### 2.2. Погода по месяцам

Станция Central Park, нормы NOAA за 1991–2020 годы. Пустая клетка — число в этой сессии не подтверждено.

| Месяц | Норма дневного максимума, °F | Снег, дюймов | Осадки, дюймов | Дней от 90 °F | Доля холодных напитков |
|---|---|---|---|---|---|
| Январь | 39,5 | 8,8 | 3,6 | 0 | 19% |
| Февраль | 42,2 | 10,1 | 3,2 | 0 | 23% |
| Март | 49,9 | 5,0 | 4,3 | 0 | 32% |
| Апрель | 61,8 | 0,4 | 4,1 | 0 | 47% |
| Май | 71,5 | 0 | 4,0 | | 58% |
| Июнь | 79,7 | 0 | 4,5 | | 68% |
| Июль | 84,8 | 0 | | 7 | 75% |
| Август | 83,4 | 0 | | 5 | 73% |
| Сентябрь | 76,3 | 0 | | 1 | 64% |
| Октябрь | 64,5 | 0,1 | | 0 | 50% |
| Ноябрь | 54,1 | 0,5 | | 0 | 37% |
| Декабрь | 44,4 | 4,9 | | 0 | 25% |

- **Доля холодных напитков** считается по формуле `0,20 + 0,0122 × (максимум − 40)`, в пределах от 15% до 80%. Наклон измерен: в одной лондонской кофейне каждый градус Цельсия добавлял холодному кофе 2,2 процентных пункта продаж, а температура объясняла 92% колебаний. Опорная точка «20% при 40 °F» — моё допущение. У сетей доля выше: Starbucks называл около 75% летом 2022 года, Dunkin' — больше половины даже зимой.
- **Число заказов** погода двигает слабее, чем состав. Planalytics и Национальная федерация розницы оценивают средний погодный размах продаж кофе в 5%, а в холодную затяжную весну на северо-востоке спрос на кофе на 10% выше обычного.
- **Крайности 2025–2026 годов** важнее норм: зима 2025–26 принесла 43,4 дюйма снега, самая снежная за 11 лет; 2 июля 2026 года в Central Park было 100 °F, впервые с 2012 года; 14 июля 2025 года за час выпало 2,07 дюйма дождя; 16–19 июля 2026 года индекс качества воздуха дошёл до 289.

Множители по типам дней — в `extra.weatherDayEffects`: лёгкий дождь 0,95; сильный дождь 0,90; первый день снега 0,85; неубранный лёд у своей двери 0,85; мороз 0,92; жара 1,00; дым 0,80; первый тёплый выходной 1,10. Измерены дождь и снег, остальное — оценки.

### 2.3. Рычаги

| Рычаг | Варианты и цена в месяц | Уровень |
|---|---|---|
| `snow_ice_plan` | Персонал чистит $90; подрядчик $400; не чистить $0 → нарушение и иск | core |
| `entrance_floor_safety` | Коврики и таблички $80; ничего $0 → иск | core |
| `storm_day_policy` | Работать как обычно; сокращённая смена; закрыться | core |
| `trash_setup` | Баки и вывоз три раза в неделю $0; шесть раз в неделю +$180 | core |
| `sidewalk_care` | Подметать дважды в день $85; ещё и мойка раз в месяц $235; не убирать $0 → нарушение | core |
| `cooling_plan` | Кондиционер обслужен, дверь закрыта $60; без обслуживания $0 → поломка в жару | core |
| `outdoor_seating` | Нет; тротуар $95; проезжая часть $420 | core |
| `flood_protection` | Нет; стеллажи и страховая оговорка $35; клапан, насос и полис $190 | core |
| `seasonal_menu` | Одно меню; сезонная программа $150 | core |
| `shed_response` | Ждать; вывеска на лесах и свет $150; давить на владельца $250 | deep |
| `disruption_playbook` | Ничего; указатели и карта постоянного гостя $200; упор на доставку $100 | deep |
| `event_day_plan` | Обычный день; усиленная смена $120; торговля из двери $60 | deep |
| `holiday_hours` | Закрыто; короткий день с надбавкой $110; обычный день | deep |
| `winter_proofing` | Ничего → лопнувшая труба; трубы и дверь $70; ещё и тамбур $520 | deep |
| `rodent_proofing` | Ничего; герметизация и баки $60 | deep |
| `air_quality_plan` | Ничего; фильтры и маски $40 | deep |
| `outage_kit` | Ничего; набор на случай отключения $15 | deep |
| `night_security` | Только замок; сигнализация и камера $55 | deep |
| `delivery_hatch_rule` | Конусы и человек у люка $45; открыть и уйти → иск | exotic |

Почти все цены — мои плановые значения: прайсов по Нью-Йорку найти не удалось. Это записано в `note` каждого рычага и в разделе 6.

### 2.4. Срезанные углы и нарушения

| Срезанный угол | Нарушение | Закон | Штраф | Кто находит |
|---|---|---|---|---|
| `skip_snow_clearing` | `snow_ice_not_cleared` | Административный кодекс §16-123 | $100 → $150 → $250–350 за каждый снегопад | Агент санитарии |
| `bags_on_curb` | `improper_trash_setout` | §16-120 и правила DSNY о контейнерах | $50 → $100 → $200 | Агент санитарии |
| `dump_in_litter_basket` | `commercial_waste_in_litter_basket` | §16-120(e) | $100 → $250 → $350 | Агент санитарии |
| `skip_recycling` | `recycling_not_separated` | §16-306 | $100 → $200 → $400 | Агент санитарии |
| `flyers_on_poles` | `illegal_posting` | §10-119, §10-121 | $75–150 за каждую листовку | Агент санитарии |
| `sign_in_the_walkway` | `sidewalk_obstruction` | §16-118, §19-136 | $100–300 | Агент санитарии |
| `ac_with_open_door` | `open_door_ac` | §20-910 | $250, до $1 000 | Инспектор DCWP |
| `speaker_on_sidewalk` | `commercial_music_noise` | §24-244(b), §24-231 | Первое $0 при исправлении, затем $2 000 | Инспектор DEP |
| `storm_day_no_call_in_pay` | `call_in_pay_unpaid` | 12 NYCRR §146-1.5 | Долг в двойном размере | Трудовой инспектор |
| рычаг `sidewalk_care = ignore` | `dirty_sidewalk` | §16-118(2)(a) | $50, затем $100, потолок $300 | Агент санитарии |

Формат пакета выражает рост штрафа только через `perMonth`. Настоящая шкала идёт по номеру нарушения, см. просьбу 5.2.

## 3. Пятнадцать самых неочевидных находок

1. **Срок на уборку снега идёт с минуты, когда снег перестал.** Самое короткое окно — 4 часа — выпадает на рабочее время. Снегопад закончился в 10 утра — тротуар должен быть чист к 14:00, в обеденный час, силами тех же двоих, что стоят за стойкой. После метели 25 января 2026 года город выписал больше 4 000 таких повесток.
2. **За упавшего на тротуаре отвечает владелец здания, а платит арендатор.** Кодекс (§7-210) называет владельца, но договор аренды перекладывает расходы на магазин. Суд признаёт виновным самого арендатора в одном случае: когда его собственная уборка сделала хуже. Плохо убрать опаснее, чем не убрать.
3. **Закрыться в метель — всё равно платить.** Работнику, который пришёл на смену, положено минимум три часа по минимальной ставке. Решать надо накануне вечером, а не утром.
4. **Жара не опустошает кофейню.** В жаркие дни рестораны теряют посетителей, а кофейные сети немного набирают. Меняется состав: при 89 °F четыре заказа из пяти холодные. Значит, упираешься не в спрос, а в лёд и стаканы.
5. **Пропущенный в дождь кофе потом не покупают.** Отчёт розничной федерации говорит прямо: ежедневные походы за кофе возвращаются через пару дней, но пропущенные покупки не восполняются.
6. **Леса над входом стоят в среднем полтора года, и об этом можно узнать до подписания аренды.** Средний возраст разрешения — 557 дней. Проверка фасадов идёт по открытому пятилетнему графику для каждого здания выше шести этажей. Потери ресторанов и баров под лесами измерены: 3,5–9,7% недельных чеков.
7. **На лесах можно повесить свою вывеску.** Реклама на них запрещена, но для магазина, чью законную вывеску они закрыли, сделано исключение: временная вывеска прямо перед витриной.
8. **Город не платит ничего, когда его же стройка опустошает улицу.** Так написано в ответах городской службы малого бизнеса. Единственная цифра по Нью-Йорку — минус 10–15% выручки; в других городах кофейни теряли до половины.
9. **Уличная ярмарка на твоём квартале может быть плохим днём.** Палатки стоят между толпой и дверью и сами продают напитки, а поставка не проедет. В колоде ярмарка сейчас даёт просто +20%.
10. **Трасса марафона может отрезать тебя от своих же гостей.** В 2026 году организаторы впервые за 15 лет изменили маршрут в Бронксе и назвали причину: вернуть доступ к местным магазинам.
11. **Выходные без метро стоят пятой части выходной выручки и тянутся годами.** В Гринпойнте линия G не работала примерно 40% выходных с 2024 года; опрошенные магазины теряли в такие дни 20–24%.
12. **Стакан с твоим логотипом в городской урне — улика против тебя.** Закон предполагает, что мусор выбросил тот, чьё имя на нём стоит: $100, $250, $350. Убирать же нужно не только тротуар, но и 18 дюймов проезжей части, даже если намусорил не ты.
13. **Страховка не покрывает оба способа, которыми дождь губит подвал.** Обычный полис исключает и наводнение, и обратный ток канализации. Коллекторы рассчитаны на 1,75 дюйма дождя в час, а в 2023 году этот порог был превышен пять раз.
14. **Снег приносит отключения света через неделю.** Соль с талой водой разъедает кабели под мостовой: 68% «люковых» аварий 2014 года пришлись на январь и февраль.
15. **Кофейня при офисах живёт три дня в неделю и десять месяцев в году.** На пятницу приходится 12% офисных визитов в будни, а август и декабрь идут на треть ниже 2019 года. Перевод часов в ноябре снимает ещё 3,5% дневных трат.

Ещё 17 пунктов — в `extra.nonObvious`.

## 4. Исправления существующих данных

| Где | Было | Стало | Почему |
|---|---|---|---|
| `packs/cafe.json` → `events.sidewalk_shed` | Поток ×0,90 на 3 месяца, обе цифры — оценки | ×0,93 на 12 месяцев | Исправляю, потому что есть измерение: исследование города с Mastercard (август 2024) дало минус 3,5–9,7% недельных чеков, а средний возраст разрешения на леса — 557 дней. Запись сдана тем же `id` |
| `ai/src/data/nyc-climate.json` → `footTrafficMult.heat` и карта `heat_advisory` | 0,95 | 1,00 для кафе, а состав заказов уходит в холодные | Foursquare с AccuWeather: рестораны теряют в жару, кофейные сети немного набирают |
| Карта колоды `street_fair` | Поток квартала +20% | Людей +60%, но доля зашедших −30%, если не торговать из двери; поставок нет | Владельцы годами жалуются, что палатки закрывают витрины |
| Карта `marathon_sunday` | +10% по городу | На трассе: +50% у двери на стороне зрителей, доставка ×0,2 | Маршрут 2026 года изменили, чтобы вернуть доступ к магазинам |
| Карта `world_cup_crowds` | Поток +8%, спрос кафе +5% | +2% только в лучших местах, доставка ×0,97 | Измерено после турнира: спортбары +16%, а заслугу турнира признали только 29% малых бизнесов с хорошим летом |
| Карта `congestion_zone_deliveries` | Себестоимость +2% | +1% и только южнее 60-й улицы | Грузовик платит $14,40 или $21,60 за въезд; на маршрут это центы с точки |
| Карта `con_ed_rates` | Коммунальные +5% в январе–феврале | +3,5% на весь 2026 год | Комиссия штата утвердила трёхлетний план 22 января 2026 года |
| Карта `outdoor_dining_season` | Каждому кафе +4% спроса с 1 апреля | Только тем, у кого есть лицензированные места на улице | Закон от 31 августа 2026 года разрешил веранды на проезжей части круглый год |
| `packs/cafe.json` → `extra.weekdayMult` | Одна неделя для всех мест | Оставить для жилых кварталов; для офисных — `[0,95; 1,2; 1,2; 1,15; 0,6; 0,25; 0,2]` | На пятницу приходится 11,9% офисных визитов в Нью-Йорке |

Файлы колоды и погодной модели я не правил: это общий код. Поправки записаны в `extra.fixesToExistingData`.

## 5. Просьбы к ведущему

### 5.1. Механики по важности

| № | Механика | Что решает игрок | Что считает движок |
|---|---|---|---|
| 1 | `sidewalk_clock` | Кто чистит снег: персонал, подрядчик или никто | Срок от часа окончания снегопада; открытое нарушение до схода льда; один иск за зиму с задержкой 60–120 дней |
| 2 | `weather_drink_mix` | Запас холодных стаканов, мощность льдогенератора, сезонное меню | Долю холодных заказов от дневного максимума; потерю заказов сверх льда |
| 3 | `storefront_visibility_stack` | Смотреть ли в открытые данные до аренды; что делать с лесами и раскопками | Список помех у адреса с настоящими датами; множитель потока как произведение, не ниже 0,6 |
| 4 | `district_calendar` | Выбор адреса: офисный, жилой, туристический или студенческий квартал | Месячный и недельный множитель как смесь четырёх профилей |
| 5 | `basement_flood_exposure` | Уровень защиты подвала | Порог 1,75 дюйма в час против часового максимума осадков; убыток по уровню защиты |
| 6 | `trash_and_rodent_pressure` | Баки и вывоз, герметизация, дезинсектор | Целочисленный счёт давления; при 3 и выше открывается существующее нарушение `pest_activity` |
| 7 | `outdoor_seat_days` | Тротуар, проезжая часть или ничего; оставить ли веранду на зиму | Места считаются только в сухие дни от 55 до 88 °F |

Во всех семи нет вероятностей: исход следует из погодного ряда, данных адреса и распоряжения игрока.

### 5.2. Новые поля

- **События.** `onlyIf` — условие по месту или рычагу; `daily: { days, effects }` — дневные множители рядом с месячными; `add` — разовая сумма вместо множителя; `delayDays` — последствие, которое приходит позже.
- **Цели эффектов сверх белого списка.** `cashOneTime`, `closureDays`, `icedShare`, `outdoorSeats`, `seats`, `seatUse`, `seatTurnover`, `insurance`, `capacity`, `quality`. Полный список — в `extra.summary.newEffectFields`.
- **Рычаги.** `activeMonths` — рычаг платный только в свои месяцы; `showOnlyIf` — рычаг виден, только пока есть помеха; у вариантов `claimRisk`, `failsIn`, `addsSeats`.
- **Нарушения.** `fineSteps` — массив штрафов по номеру нарушения. Сейчас рост выражен через `perMonth`, а это неточно: настоящий снежный штраф — $100, $150, $250 по счёту снегопадов.
- **Иски.** Новый раздел `claims`: падение — это не нарушение, которое находит чиновник, а гражданский иск с задержкой, франшизой и ростом страховой премии. Задание D08 тоже описывает иски; формат стоит согласовать при сборке.

### 5.3. Данные адреса

Нужны поля места: длина фасада и признак углового помещения; подвал и люк на тротуаре; зона ливневого затопления и предел коллектора; этажность здания и год сдачи отчёта о фасаде; список помех с датами; доли профилей квартала; доля потока от станции метро; близость парка; признаки зон (южнее 60-й улицы, Восточный Мидтаун, Таймс-сквер).

Почти всё это есть в открытых данных города: разрешения Департамента зданий, разрешения на уличные работы, карты ливневых затоплений, жалобы 311, разрешения на съёмки, календарь уличных мероприятий.

### 5.4. Погодный ряд

Добавить к дню: час окончания осадков, максимум осадков за час, высоту снега и признак повторного замерзания, индекс качества воздуха.

### 5.5. Сборщику (D11)

- **Комплекты.** Баки с крышками обязательны по закону, но я сдал их с `required: false`, иначе проверка требует их во всех трёх комплектах. Предложение — в `extra.kitAdditions`.
- **Чиновники.** Мои нарушения ссылаются на трёх существующих чиновников. Их списки `checks` нужно дополнить: `dcwp_inspector` ← `open_door_ac`; `dep_inspector` ← `commercial_music_noise`; `labor_investigator` ← `call_in_pay_unpaid`.
- **Пересечения с соседними заданиями.** Поломка кондиционера, лопнувшая труба, отключение света и взлом заходят на территорию D03 и D09; иски — на территорию D08; недельная и месячная кривые спроса — на территорию D06. У меня они даны как следствия погоды и улицы. При споре чисел берите число профильного исследователя.
- **Число рычагов.** 19 рычагов для одной темы — много. Уровни `core`, `deep`, `exotic` проставлены у каждого, чтобы было что отложить.

### 5.6. Доступ в сеть

Чтобы превратить `official_excerpt` в `verified`, сессии нужен доступ к хостам: `www.nyc.gov`, `nyc.gov`, `portal.311.nyc.gov`, `dsny.cityofnewyork.us`, `rules.cityofnewyork.us`, `codelibrary.amlegal.com`, `www.weather.gov`, `www.nycourts.gov`, `dol.ny.gov`, `ag.ny.gov`, `www.governor.ny.gov`, `comptroller.nyc.gov`, `www.schools.nyc.gov`, `dps.ny.gov`, `data.cityofnewyork.us`.

## 6. Не найдено

**Цены.**
- Цена уборки снега подрядчиком для витрины в Нью-Йорке. Нашлись только общие диапазоны продавцов услуг: $350–1 500 за выезд для коммерческих площадок.
- Розничная цена мешка соли в 2026 году.
- Тарифы на вывоз мусора по зонам: у каждой зоны своя таблица предельных ставок, в выдаче её нет.
- Цены ковриков, мойки тротуара, обслуживания кондиционера, тамбура, обратного клапана, полиса от наводнения для бизнеса, сигнализации.

**Закон.**
- Точная шкала штрафа за снег: страница DSNY даёт $100, $150, $250, листовка того же ведомства — до $350.
- Номер раздела правил DSNY о контейнерах; номера разделов о раздельном сборе и о помехах на тротуаре записаны по памяти.
- Действующие штрафы за вывеску на тротуаре: есть только сообщения прессы 2015 года и случай штрафа в $300.
- Шкала штрафов по §24-244(b): таблица в выдаче нечитаема; потолок $8 000 записан по памяти.
- Залог по программе уличных мест и действующая таблица сбора по секторам: в кодексе $5, $8, $14, $25, в прессе $6–31. Взнос $630 за временную лицензию не подтверждён. Зимние правила для веранд ещё пишутся.
- Расстояния, на которых уличный торговец может стоять от входа в магазин.
- Штраф за открытый люк подвала; официальный текст о тамбурах (есть только пересказ продавца).

**Измерения.**
- Месячный индекс продаж независимых кофеен. Есть только Starbucks и общие слова.
- Доля холодных напитков по месяцам по данным касс в США.
- Продажи кафе в дни дыма 2023 и 2026 годов.
- Потери бизнеса в неделю ООН, на парадах, на трассе марафона, при съёмках. Есть только слова владельцев.
- Заполняемость отелей по месяцам.
- Убытки подвалов после ливня 29 сентября 2023 года в долларах.
- Как работали частные вывозчики мусора после метелей 2026 года.
- Сколько дней длилась забастовка LIRR в мае 2026 года.
- Нормы осадков за июль–декабрь и число дней от 90 °F за май–июнь.

**Счётчики, которые можно посчитать по открытым данным, но не из этой сессии.**
- Нарушения с кодами 04L (мыши) и 04N (мошки) по месяцам.
- Число разрешений на снос, число предписаний по тротуару, жалобы на шум по адресам.

**Рассказы владельцев.** Поиск не вернул ни одной ветки Reddit или форума. Голоса владельцев взяты из местных новостей: News 12, amNewYork, Gothamist, DNAinfo.

## 7. Источники

Все ссылки найдены веб-поиском 14 ноября 2026 года; сами страницы не открывались.

1. [ABC7: LIRR workers go on strike, halting the busiest US commuter rail system (May 16, 2026)](https://abc7ny.com/post/lirr-workers-go-strike-halting-busiest-us-commuter-rail-system/19111461/)
2. [ABC7: DSNY working to catch up as trash piles up on snowbanks (February 2026)](https://abc7ny.com/post/mamdani-defends-dsny-trash-piles-snowbanks-parts-nyc/18529761/)
3. [ABC7: Con Edison reduces voltage in parts of the Bronx and Westchester (July 2026)](https://abc7ny.com/post/nyc-extreme-heat-coned-reduces-voltage-parts-bronx-westchester-asks-customers-conserve-energy/19436776/)
4. [DoorDash: severe weather protocol and weather impact fee (January 2026)](https://about.doordash.com/en-us/news/winter-storm-fern)
5. [JPMorgan Chase Institute: Shedding Light on Daylight Saving Time (2016)](https://about.jpmorganchase.com/content/dam/jpmc/jpmorgan-chase-and-co/institute/pdf/jpmc-institute-daylight-savings-report.pdf)
6. [NYC Public Advocate: Orange Sky, Red Alert - review of air quality emergencies](https://advocate.nyc.gov/reports/orange-sky-red-alert-review-air-quality-emergencies-nyc)
7. [NY Attorney General: Wages and pay (call-in pay, three hours for restaurant workers)](https://ag.ny.gov/resources/individuals/workers-rights/wages-pay)
8. [Alatau City Bank: how a cafe can earn in summer (Kazakhstan)](https://alataucitybank.kz/business/osim/articles/kak-zavedeniyu-zarabotat-letom)
9. [Insurance Journal: New York City issues first drought warning in 22 years (November 19, 2024)](https://amp.insurancejournal.com/news/east/2024/11/19/801851.htm)
10. [Insurance Journal: New York City, Northeast swelter in hottest day of the year (July 2, 2026)](https://amp.insurancejournal.com/news/east/2026/07/02/876132.htm)
11. [Gothamist: deportation fears play out in Queens, with an economic cost](https://api-prod.gothamist.com/news/deportation-fears-play-out-in-queens-theres-an-economic-cost-to-that)
12. [Gothamist: NYC will not issue permits for new street fairs due to NYPD overtime costs (October 2024)](https://api-prod.gothamist.com/news/nyc-wont-issue-permits-for-new-street-fairs-due-to-nypd-overtime-costs)
13. [News 12: state approves Con Edison rate hike for gas and electric (January 23, 2026)](https://bronx.news12.com/2026/01/23/state-approves-con-ed-rate-hike-for-gas-and-electric/6dDt72h0hy67PKW8vptuA7)
14. [News 12: Flatbush businesses say fewer customers, higher costs are squeezing their bottom line (August 21, 2026)](https://bronx.news12.com/2026/08/21/flatbush-businesses-say-fewer-customers-higher-costs-are-squeezing-their-bottom-line/6DCqS40HPKdqklRHGkExuh)
15. [News 12 Brooklyn: Greenpoint sales slump during G train shutdown (June 2026)](https://brooklyn.news12.com/greenpoint-sales-slump-during-g-train-shutdown)
16. [NYC Tourism + Conventions: annual report press release (March 2026)](https://business.nyctourism.com/press-media/press-releases/NYC-Tourism-Annual-Report-March-2026)
17. [National Retail Federation: Climate-Proofing Retail (2024)](https://cdn.nrf.com/sites/default/files/2024-06/ClimateProofingRetail_2024.pdf)
18. [NYC Comptroller: Is New York City Ready for Rain?](https://comptroller.nyc.gov/reports/is-new-york-city-ready-for-rain)
19. [NYC Comptroller: review of the Small Business Forward initiative (April 2026)](https://comptroller.nyc.gov/reports/review-of-the-small-business-forward-initiative-and-its-impact-on-violations-enforcement)
20. [Documented: NYC power outage reimbursement (August 14, 2026)](https://documentedny.com/2026/08/14/nyc-power-outage-reimbursement/)
21. [NYS Department of Labor: Hospitality Wage Order FAQ (call-in pay)](https://dol.ny.gov/hospitality-wage-order-faq)
22. [NYS Department of Public Service: Con Edison electric rate case summary (January 2026)](https://dps.ny.gov/system/files/documents/2026/01/con-edison-electric-rate-case-summary.pdf)
23. [DSNY: collection and setout laws for businesses (litter baskets)](https://dsny.cityofnewyork.us/?p=1198)
24. [Foursquare with AccuWeather: Fair Weather Foodies (rain and restaurant visits)](https://foursquare.com/resources/blog/data/fair-weather-foodies/)
25. [Foursquare with AccuWeather: summer weather data and restaurant foot traffic](https://foursquare.com/resources/blog/data/summer-weather-data-reveals-consumer-insights/)
26. [NYC Council Introduction 302 of 2024 (illegal posting penalties under §10-121)](https://intro.nyc/0302-2024)
27. [KING 5: West Seattle coffee shop concerned by construction impact](https://king5.com/article/news/west-seattle-coffeeshop-concerned-by-construction-impact/281-c99589c4-ef19-438c-8396-3794ef4e67d5)
28. [News 12: ice melt shortage ahead of the January 2026 storm](https://longisland.news12.com/2026/01/22/hudson-valley-customers-face-ice-melt-shortage-ahead-of-major-snowstorm/1mt40tbth8IHiDHAC6zw1E)
29. [NYC DOT: The Economic Benefits of Sustainable Streets (2013)](https://nyc.gov/html/dot/downloads/pdf/dot-economic-benefits-of-sustainable-streets.pdf)
30. [Streetsblog NYC: how much outdoor dining costs restaurants (April 2025)](https://nyc.streetsblog.org/2025/04/04/fare-fares-heres-how-much-outdoor-dining-costs-restaurants)
31. [NYC311: Snow or Ice on Sidewalk](https://portal.311.nyc.gov/article/?kanumber=KA-01397)
32. [NYC311: mobile food vending permits (Local Laws 54 and 59 of 2026)](https://portal.311.nyc.gov/article/?kanumber=KA-01830)
33. [NYC311: sidewalk obstruction, A-frame signs within 3 feet](https://portal.311.nyc.gov/article/?kanumber=KA-01980)
34. [NYC311: Con Edison claims for losses from a power outage](https://portal.311.nyc.gov/article/?kanumber=KA-02283)
35. [NYC311: Dining Out NYC license and fees](https://portal.311.nyc.gov/article/?kanumber=KA-03604)
36. [Toast: coffee price and order trends 2025 (cold brew peak in July)](https://pos.toasttab.com/blog/data/coffee-prices-trends-by-state)
37. [QNS: Astoria electeds ask MTA for relief for businesses near shuttered N/W stations (February 2018)](https://qns.com/2018/02/astorias-electeds-call-mta-president-boost-service-provide-relief-business-owners-near-shuttered-n-w-stations)
38. [DSNY final rule: implementation dates for the Brooklyn North and Upper Manhattan commercial waste zones (June 2026)](https://rules.cityofnewyork.us/wp-content/uploads/2026/06/DSNY-Final-Rule-re-Implementation-Dates-for-the-Brooklyn-North-and-Upper-Manhattan-Commercial-Waste-Zones_Final.pdf)
39. [Bloomberg Second Measure: does pumpkin spice drive Starbucks sales](https://secondmeasure.com/datapoints/does-pumpkin-spice-drive-starbucks-sales/)
40. [T-Bank Secrets: a lawsuit over a customer injury (Russia)](https://secrets.tbank.ru/trendy/isk-iz-za-travmy/)
41. [Signs NY: NYC vestibule enclosures, permits and requirements (vendor guide)](https://signsny.com/blog/nyc-vestibule-enclosures-permits-requirements/)
42. [Signs NY: winter vestibules for restaurants, the 25 square foot allowance (vendor guide)](https://signsny.com/blog/restaurant-vestibule-25-sqft-rule-explanation/)
43. [NYC Hospitality Alliance: summer and fall 2024 survey results](https://thenycalliance.org/news-item/summer-fall-2024-survey-results)
44. [Times Square Alliance: New Year's Eve and NYPD information for businesses](https://timessquarenyc.org/nye/nye-business-resource)
45. [Total Food Service / HUB Insurance: how restaurants can avoid sidewalk-law claims](https://totalfood.com/how-restaurants-can-help-avoid-sidewalk-law-related-claims-and-litigation/)
46. [United Baristas: cold coffee demand is more predictable than the British weather (King's Cross cafe analysis)](https://unitedbaristas.com/articles/explainers/cold-coffee-demand-is-more-predictable-than-the-british-weather/)
47. [Al Jazeera: how New York deals with the influx of leaders at the UN General Assembly (September 24, 2025)](https://www.aljazeera.com/news/2025/9/24/how-new-york-deals-with-the-influx-of-leaders-at-the-un-general-assembly)
48. [amNewYork: MTA axes G train shutdowns planned for December after outcry from small businesses](https://www.amny.com/news/mta-axes-g-train-shutdowns-planned-for-december-after-outcry-from-small-businesses/)
49. [amNewYork: sidewalk shoveling rules and tickets after the January 2026 storm](https://www.amny.com/news/nyc-blizzard-sidewalk-shoverling-rules-tickets)
50. [amNewYork (The Villager): water pipe work on West 10th Street hurting business](https://www.amny.com/news/water-pipe-torture-killing-w-10th-st-business)
51. [Bisnow: Morningside Heights faces fall without thousands of Columbia students](https://www.bisnow.com/news/new-york/economy/morningside-heights-look-at-a-fall-without-a-key-economic-driver-many-of-columbia-universitys-students-105624-105625)
52. [Bloomberg: UN week brings Midtown gridlock (September 21, 2025)](https://www.bloomberg.com/news/features/2025-09-21/un-week-brings-midtown-gridlock-snipers-and-secret-service)
53. [Brownstoner: Brooklyn businesses struggle to recover after record-breaking rains (2023)](https://www.brownstoner.com/brooklyn-life/brooklyn-businesses-flood-recovery)
54. [The Hartford: water and freezing damage, burglary lead top five small-business claims (December 9, 2025)](https://www.businesswire.com/news/home/20251209433403/en/Water-And-Freezing-Damage-Burglary-Lead-The-Hartfords-Top-Five-Small-Business-Claims)
55. [CBS New York: extreme heat causes outages, 8% voltage reduction in Brooklyn and Queens (June 2025)](https://www.cbsnews.com/amp/newyork/news/extreme-heat-causing-power-outages)
56. [CBS New York: 2025-2026 was NYC's coldest, snowiest winter in 11 years](https://www.cbsnews.com/newyork/news/2025-2026-nyc-winter-cold-snow)
57. [CBS New York: Garment District business owners irate over water shutdown plan](https://www.cbsnews.com/newyork/news/garment-district-water-shutdown/)
58. [CBS New York: winter weather to blame for many manhole fires](https://www.cbsnews.com/newyork/news/winter-weather-to-blame-for-many-manhole-fires)
59. [Daeryun Law: holiday pay in New York and when it becomes legally owed](https://www.daeryunlaw.com/us/insights/holiday-pay-new-york)
60. [daswetter.com: TheFork study on temperature and restaurant bookings](https://www.daswetter.com/nachrichten/aktuelles/studie-zeigt-wie-sich-kuhlere-temperaturen-auf-ausgeh-abende-auswirken.html)
61. [DNAinfo: illegal posters, Clinton Hill business fined almost $9,000](https://www.dnainfo.com/new-york/20120625/fort-greene/illegal-posters-could-pin-fine-on-hakeem-jeffries-campaign)
62. [DNAinfo: incessant filming hurts small businesses on Crosby Street, owners say](https://www.dnainfo.com/new-york/20151230/soho/incessant-filming-hurts-small-businesses-on-crosby-street-owners-say)
63. [FreightWaves: New York trucking group says Manhattan tolls burden industry (toll schedule)](https://www.freightwaves.com/news/new-york-trucking-group-says-manhattan-tolls-burden-industry)
64. [GlobeSt: hybrid habits hold firm as Friday office visits lag (Placer.ai, November 2025)](https://www.globest.com/amp/2025/11/24/hybrid-habits-hold-firm-as-friday-office-visits-lag/)
65. [Governor of New York: first anniversary of congestion pricing (January 5, 2026)](https://www.governor.ny.gov/news/less-traffic-better-transit-its-first-anniversary-governor-hochul-celebrates-transformational)
66. [Insurance Journal: Hartford 10-year analysis of small-business claims (December 10, 2025)](https://www.insurancejournal.com/news/national/2025/12/10/850545.htm)
67. [Kastle: Back to Work Barometer](https://www.kastle.com/safety-wellness/getting-america-back-to-work/)
68. [NerdWallet: water backup coverage (cost range)](https://www.nerdwallet.com/insurance/homeowners/learn/water-backup-coverage)
69. [Local Law 48 of 2025 (sidewalk shed permits and penalties)](https://www.nyc.gov/assets/buildings/local_laws/ll48of2025.pdf)
70. [NYC Buildings: Local Law 109 of 2022 service notice (rodent extermination before demolition)](https://www.nyc.gov/assets/buildings/pdf/ll109of22-sn.pdf)
71. [NYC: 2026 TCS New York City Marathon street closures](https://www.nyc.gov/assets/cecm/downloads/pdf/tcs-street-closures-marathon-2026.pdf)
72. [DCWP: business flyer, air conditioning law](https://www.nyc.gov/assets/dca/downloads/pdf/businesses/Business-Flyer-Air-Conditioning-Law.pdf)
73. [NYC DDC / Small Business Services FAQ for businesses near construction (2022)](https://www.nyc.gov/assets/ddc/downloads/projects/Outreach-Materials/2022_SBS_FAQs_English_r2.pdf)
74. [NYC DEP: commercial music noise violation, zero penalty for a cured first offense](https://www.nyc.gov/assets/dep/downloads/pdf/air/noise/commercial-music-noise-violation-zero-penalty.pdf)
75. [NYPD CompStat citywide report](https://www.nyc.gov/assets/nypd/downloads/pdf/crime_statistics/cs-en-us-city.pdf)
76. [Preliminary Mayor's Management Report 2026: Department of Environmental Protection (water main breaks)](https://www.nyc.gov/assets/operations/downloads/pdf/pmmr2026/dep.pdf)
77. [NYC DOT: a property owner's guide to address sidewalk defects](https://www.nyc.gov/html/dot/downloads/pdf/nyc-sidewalks-a-property-owners-guide-to-address-sidewalk-defects.pdf)
78. [NYC DOT: sidewalk repair and violations](https://www.nyc.gov/html/dot/html/infrastructure/sidewalkintro.shtml)
79. [NYC DOT: Streets for Recovery, the economic benefits of the Open Streets program (October 2022)](https://www.nyc.gov/html/dot/html/pr2022/outdoor-dining.shtml)
80. [NYC DOT: 2026 Open Streets season kicks off (May 21, 2026)](https://www.nyc.gov/html/dot/html/pr2026/nyc-dot-kicks-off-2026-open-streets-season.shtml)
81. [NYC Mayor's Office: study finds sidewalk sheds cost Manhattan businesses (August 2024)](https://www.nyc.gov/mayors-office/news/2024/08/mayor-adams-releases-new-study-finding-sidewalk-sheds-scaffolding-cost-manhattan-businesses)
82. [NYC Mayor's Office: Executive Order 11 to inventory and cut fines and fees on small businesses (January 14, 2026)](https://www.nyc.gov/mayors-office/news/2026/01/mayor-mamdani-signs-executive-order-to-inventory-and-cut-fines-a.html)
83. [NYC Mayor's Office: taking down sidewalk sheds, 7,427 permitted sheds (August 20, 2026)](https://www.nyc.gov/mayors-office/news/2026/08/mamdani-administration-taking-down-sidewalk-sheds-and-improving-)
84. [NYC Mayor's Office: Mayor Mamdani signs bill making year-round outdoor dining permanent (August 31, 2026)](https://www.nyc.gov/mayors-office/news/2026/08/mayor-mamdani-signs-bill-making-year-round-outdoor-dining-a-perm)
85. [NYC Mayor's Office: World Cup delivered $2 billion economic impact (September 2026)](https://www.nyc.gov/mayors-office/news/2026/09/mayor-mamdani-announces-world-cup-delivered--2-billion-economic-.html)
86. [NYC Mayor's Office: 1,200 sidewalk sheds taken down (October 19, 2026)](https://www.nyc.gov/mayors-office/news/2026/10/mamdani-administration-announces-1-200-sidewalk-sheds-taken-down)
87. [NYC Buildings: construction site signage requirements (temporary business sign on a shed)](https://www.nyc.gov/site/buildings/safety/construction-site-signage-requirements.page)
88. [NYC Citywide Event Coordination and Management: street activity permits (parades, fairs)](https://www.nyc.gov/site/cecm/permitting/permitting.page)
89. [DCWP: Shut the Front Door reminder, 2023 inspection counts](https://www.nyc.gov/site/dca/news/023-24/shut-front-door-city-reminds-local-businesses-keep-doors-windows-closed-when-running)
90. [NYC DEP Commissioner testimony on flooding and stormwater infrastructure (April 26, 2024)](https://www.nyc.gov/site/dep/news/042624/testimony-rohit-t-aggarwala-commissioner-new-york-city-department-environmental-protection)
91. [DSNY: Commercial Waste Zones rollout schedule](https://www.nyc.gov/site/dsny/businesses/cwz/rollout-schedule.page)
92. [DSNY: cleaning rules for businesses](https://www.nyc.gov/site/dsny/businesses/rules-reporting/cleaning-rules-businesses.page)
93. [DSNY: setout rules for businesses](https://www.nyc.gov/site/dsny/businesses/rules-reporting/setout-rules-businesses.page)
94. [DSNY: sidewalk and street rules for businesses](https://www.nyc.gov/site/dsny/businesses/rules-reporting/street-sidewalk-rules-businesses.page)
95. [DSNY: starting March 1, 2024 all businesses must put trash in lidded bins](https://www.nyc.gov/site/dsny/news/24-011/starting-friday-march-1-all-new-york-city-businesses-must-put-trash-lidded-bins-)
96. [DSNY: New York's Strongest delivered a cleaner city in 2025 (rat sighting counts)](https://www.nyc.gov/site/dsny/news/25-042/new-york-s-strongest-delivered-cleaner-more-sustainable-city-2025)
97. [DSNY: Snow and Ice Removal Laws](https://www.nyc.gov/site/dsny/what-we-do/snow-response/snow-laws.page)
98. [NYC Emergency Management: city responds to historic rainfall event (July 15, 2025)](https://www.nyc.gov/site/em/about/press-releases/20250715_pr_nycem-City-Responds-To-Hstoric-Rainfall-Event.page)
99. [NYC Emergency Management: wildfire smoke response concludes (July 19, 2026)](https://www.nyc.gov/site/em/about/press-releases/20260719_pr_NYCEM-Thanks-New-Yorkers-as-Wildfire-Smoke-Response-Concludes.page)
100. [Bing v 296 Third Ave. Group, L.P. (sidewalk liability under Administrative Code §7-210)](https://www.nycourts.gov/REPORTER/3dseries/2012/2012_02424.htm)
101. [Appellate Division decision on a fall through sidewalk cellar doors (2020)](https://www.nycourts.gov/reporter/3dseries/2020/2020_07275.htm)
102. [New York court decision upholding a §24-244(b) summons for music audible on the sidewalk (2010)](https://www.nycourts.gov/reporter/pdfs/2010/2010_30009.pdf)
103. [NYS Comptroller Report 20-2026: employment outcomes of Open Streets in New York City](https://www.osc.ny.gov/files/reports/pdf/report-20-2026.pdf)
104. [Placer.ai: August 2025 office index, an end-of-summer slump](https://www.placer.ai/anchor/articles/august-2025-placer-ai-office-index-an-end-of-summer-slump)
105. [Placer.ai: December 2025 office index, 'tis the season to WFH](https://www.placer.ai/anchor/articles/placer-ai-december-2025-office-index-tis-the-season-to-wfh)
106. [Placer.ai: PSL Day 2026 gives Starbucks its biggest Tuesday of the year](https://www.placer.ai/anchor/articles/psl-day-2026-gives-starbucks-its-biggest-tuesday-of-the-year)
107. [Placer.ai: 2026 office recovery trends across major US markets](https://www.placer.ai/anchor/reports/2026-office-recovery-trends-across-major-u-s-markets)
108. [Planalytics: how weather impacts your sales (coffee swing 5%, Northeast +10% in a cool spring)](https://www.planalytics.com/?p=5995)
109. [PYMNTS Intelligence: host cities score, local customers drive a strong small-business summer (September 2026)](https://www.pymnts.com/study_posts/host-cities-score-local-customers-drive-a-strong-smb-summer/)
110. [US Small Business Administration: Small Business Saturday, November 29, 2025](https://www.sba.gov/article/2025/11/25/sba-encourages-americans-shop-small-small-business-saturdayr-november-29th)
111. [NYC Public Schools: 2026-2027 school year calendar](https://www.schools.nyc.gov/calendar/2026-2027-school-year-calendar)
112. [Tageskarte: Lightspeed analysis of German restaurants in summer](https://www.tageskarte.io/gastronomie/detail/mehr-gaeste-weniger-umsatz-pro-bon-was-restaurants-im-sommer-beachten-sollten.html)
113. [Tea & Coffee Trade Journal: Square data on iced coffee in the May 2026 UK heatwave](https://www.teaandcoffee.net/blog/39416/as-temperatures-rise-more-uk-consumers-grab-iced-coffees/)
114. [The City: manhole explosion season, a century-old problem (February 2020)](https://www.thecity.nyc/2020/02/24/it-s-manhole-explosion-season-what-you-need-to-know-about-a-century-old-problem/)
115. [Vice: how one subway closure in Queens wrecked a community](https://www.vice.com/en/article/how-one-subway-closure-in-queens-wrecked-a-community)
116. [WAMC: Yemeni coffeehouses, community and Ramadan (March 17, 2026)](https://www.wamc.org/news/2026-03-17/yemeni-coffeehouses-community-ramadan)
117. [NWS New York: Central Park daily maximum temperature normals 1991-2020](https://www.weather.gov/media/okx/Climate/CentralPark/DailyMaxTNormals.pdf)
118. [NWS New York: Central Park monthly and seasonal snowfall](https://www.weather.gov/media/okx/Climate/CentralPark/monthlyseasonalsnowfall.pdf)
119. [West Side Rag: UWS Shed Watch, average shed permit age from DOB data (April 2026)](https://www.westsiderag.com/2026/04/23/uws-shed-watch-a-new-monthly-column-from-west-side-rag)

## Приложение. Каталог событий по темам

Названия событий — строки для игрока, поэтому они на английском. Полные записи с текстом, сигналом, эффектами и расчётом — в `extra.eventCatalog`.

### Погода, напитки, места на улице — 10

| id | Название | Месяцы | Масштаб | Уровень | Основание |
|---|---|---|---|---|---|
| `iced_season_switch` | Iced season starts | 4, 5 | город | core | secondary |
| `heat_wave_iced_rush` | Heat wave: everyone wants it iced | 6, 7, 8, 9 | город | core | secondary |
| `rainy_day_mix` | A soaking rainy day | весь год | город | core | secondary |
| `cool_spring_bonus` | A cold, late spring | 4, 5 | город | deep | secondary |
| `arctic_blast` | Arctic blast | 12, 1, 2 | город | core | calc |
| `early_dark` | The clocks go back | 11, 12 | страна | deep | official_excerpt |
| `high_wind_day` | Wind advisory | 10, 11, 12, 1, 2, 3, 4 | город | exotic | calc |
| `park_weather_weekend` | A perfect Saturday | 4, 5, 6, 9, 10 | квартал | deep | calc |
| `outdoor_season_opens` | Outdoor season | 4, 5, 6, 9, 10 | город | core | official_excerpt |
| `roadway_winter_rules_pending` | Keep the roadway cafe up this winter? | 11, 12, 1, 2, 3 | город | deep | official_excerpt |

### Зима у входа — 13

| id | Название | Месяцы | Масштаб | Уровень | Основание |
|---|---|---|---|---|---|
| `snowfall_clear_the_walk` | Snow: the clock starts | 12, 1, 2, 3 | точка | core | official_excerpt |
| `icy_sidewalk_refreeze` | Black ice at the door | 12, 1, 2, 3 | точка | core | calc |
| `sidewalk_fall_claim` | Letter from a lawyer: someone fell on your ice | 1, 2, 3, 4, 5, 6 | точка | core | secondary |
| `wet_floor_inside` | Slush on the floor | 11, 12, 1, 2, 3, 4 | точка | core | calc |
| `blizzard_shutdown` | Blizzard warning: the city tells people to stay home | 12, 1, 2, 3 | город | core | secondary |
| `ice_melt_shortage` | Ice melt sold out | 1, 2 | страна | deep | secondary |
| `corner_lot_double_duty` | Corner shop: twice the snow | 12, 1, 2, 3 | точка | deep | official_excerpt |
| `no_delivery_in_the_storm` | The milk truck does not come | 12, 1, 2, 3 | город | deep | calc |
| `manhole_fire_outage` | Manhole fire: the block goes dark | 1, 2, 3 | квартал | deep | secondary |
| `frozen_pipe` | A pipe bursts overnight | 12, 1, 2 | точка | core | secondary |
| `line_wont_stand_outside` | Nobody queues in the cold | 12, 1, 2 | точка | deep | calc |
| `door_draft_tables` | The tables by the door are empty | 12, 1, 2 | точка | deep | calc |
| `trash_piles_after_snow` | No pickup for a week | 1, 2, 3 | город | deep | secondary |

### Улица — 23

| id | Название | Месяцы | Масштаб | Уровень | Основание |
|---|---|---|---|---|---|
| `shed_goes_up` | A sidewalk shed goes up over your door | весь год | точка | core | official_excerpt |
| `shed_idle_months` | The shed is up and nobody is working | весь год | точка | deep | official_excerpt |
| `shed_comes_down` | The shed comes down | весь год | точка | deep | official_excerpt |
| `subway_weekend_shutdowns` | No trains at your station on weekends | весь год | квартал | core | secondary |
| `station_closed_for_months` | Your subway station closes for renovation | весь год | квартал | deep | secondary |
| `street_dig_long` | The street is dug up for a new water main | весь год | квартал | core | secondary |
| `planned_water_shutoff` | Water off on your block, weekdays 8 to 3 | весь год | квартал | deep | secondary |
| `water_main_break` | Water main breaks on your block | 12, 1, 2, 3 | квартал | deep | official_excerpt |
| `street_resurfacing` | Milling and paving | 4, 5, 6, 7, 8, 9, 10, 11 | квартал | exotic | calc |
| `street_fair_day` | Street fair on your avenue | 5, 6, 7, 8, 9, 10 | квартал | core | secondary |
| `film_shoot_on_block` | A film crew takes the block | весь год | квартал | deep | secondary |
| `open_streets_season` | Your street goes car-free on weekends | 4, 5, 6, 7, 8, 9, 10 | квартал | core | official_excerpt |
| `crz_foot_traffic` | Congestion Relief Zone: more people on foot | весь год | город | deep | official_excerpt |
| `crz_delivery_surcharge` | Suppliers add a congestion surcharge | весь год | город | deep | secondary |
| `bike_lane_replaces_parking` | A protected bike lane replaces the parking | 4, 5, 6, 7, 8, 9, 10 | квартал | exotic | official_excerpt |
| `coffee_cart_at_the_corner` | A coffee cart parks at your corner | весь год | точка | deep | secondary |
| `open_hatch_delivery` | The cellar doors are open again | весь год | точка | deep | secondary |
| `sidewalk_violation_notice` | The city marks your sidewalk | 4, 5, 6, 7, 8, 9, 10 | точка | deep | official_excerpt |
| `noise_complaint_upstairs` | The neighbors upstairs call 311 | 5, 6, 7, 8, 9 | точка | deep | official_excerpt |
| `break_in` | Break-in | весь год | точка | deep | secondary |
| `clogged_catch_basin` | A lake at your corner | 10, 11, 12, 3, 4 | точка | exotic | calc |
| `waste_zone_goes_live` | Your commercial waste zone goes live | весь год | город | deep | official_excerpt |
| `fines_review` | City Hall reviews small-business fines | 1, 7 | город | deep | official_excerpt |

### Городской календарь — 26

| id | Название | Месяцы | Масштаб | Уровень | Основание |
|---|---|---|---|---|---|
| `marathon_on_your_avenue` | Marathon Sunday on your avenue | 11 | квартал | core | secondary |
| `january_slump` | January | 1 | страна | core | secondary |
| `august_office_slump` | August: the offices empty out | 8 | город | core | secondary |
| `summer_weekend_exodus` | Summer weekends: the neighborhood leaves town | 7, 8 | город | core | secondary |
| `school_year_starts` | School is back | 9 | город | core | official_excerpt |
| `school_recess_week` | School recess week | 2, 4, 12 | город | deep | official_excerpt |
| `holiday_dead_week` | The week between Christmas and New Year's | 12 | город | core | secondary |
| `campus_summer` | The students go home | 6, 7, 8 | квартал | deep | secondary |
| `finals_weeks` | Finals | 5, 12 | квартал | exotic | calc |
| `tourist_high_season` | Tourist high season | 6, 7, 8, 11, 12 | город | deep | official_excerpt |
| `tourist_low_season` | January and February: no visitors | 1, 2 | город | deep | calc |
| `pumpkin_launch_day` | Pumpkin spice comes back | 8, 9 | страна | deep | secondary |
| `small_business_saturday` | Small Business Saturday | 11 | страна | exotic | secondary |
| `thanksgiving_parade_morning` | Thanksgiving parade at your corner | 11 | квартал | deep | calc |
| `pride_sunday` | Pride Sunday | 6 | квартал | deep | calc |
| `avenue_parade_day` | A parade closes your avenue | 3, 6, 9, 10 | квартал | deep | calc |
| `bike_tour_and_half_marathon` | Sunday race: streets closed until noon | 3, 5 | квартал | exotic | calc |
| `unga_week` | UN General Assembly week | 9 | город | deep | secondary |
| `new_years_eve_frozen_zone` | New Year's Eve: inside the frozen zone | 12 | квартал | exotic | official_excerpt |
| `world_cup_summer` | World Cup summer | 6, 7 | мир | deep | official_excerpt |
| `commuter_rail_strike` | Commuter rail strike | 5 | город | deep | secondary |
| `ramadan_nights` | Ramadan: the day goes quiet, the night comes alive | 2, 3 | квартал | deep | secondary |
| `high_holidays_and_passover` | The Jewish holidays | 4, 9, 10 | квартал | exotic | calc |
| `lunar_new_year` | Lunar New Year | 1, 2 | квартал | exotic | calc |
| `immigration_enforcement_chill` | People stay home | весь год | страна | deep | secondary |
| `holiday_market_nearby` | A holiday market opens across the square | 11, 12 | квартал | exotic | calc |

### Среда — 11

| id | Название | Месяцы | Масштаб | Уровень | Основание |
|---|---|---|---|---|---|
| `heat_wave_ac_failure` | The air conditioner dies on the hottest day | 6, 7, 8 | точка | deep | calc |
| `voltage_reduction` | Con Edison cuts voltage in your neighborhood | 6, 7, 8 | квартал | deep | secondary |
| `wildfire_smoke_day` | Smoke from Canada | 5, 6, 7, 8, 9 | страна | core | official_excerpt |
| `flash_flood_warning` | Flash flood warning | 6, 7, 8, 9, 10 | город | core | official_excerpt |
| `sewer_backup` | The floor drain runs backwards | 4, 5, 6, 7, 8, 9, 10 | точка | deep | official_excerpt |
| `tropical_storm_watch` | Tropical storm watch | 8, 9, 10 | город | deep | calc |
| `drought_warning` | Drought warning | 10, 11, 12 | город | exotic | secondary |
| `summer_rat_peak` | Rat season | 6, 7, 8, 9 | квартал | core | official_excerpt |
| `demolition_next_door` | The building next door is coming down | весь год | точка | deep | official_excerpt |
| `mice_move_in` | First cold week: the mice come inside | 10, 11 | точка | deep | calc |
| `fruit_fly_summer` | Fruit flies | 6, 7, 8, 9 | точка | deep | calc |
