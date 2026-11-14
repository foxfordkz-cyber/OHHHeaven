# D07 — Погода, сезон, улица, город

Ниша: кафе. Нью-Йорк, 2026 год. Исследование проведено 14 ноября 2026 года.
Данные: `packs/parts/cafe/D07-weather-street-city.json`.

## 1. Вердикт

1. **Сдано.** 83 события в `extra.eventCatalog` (у каждого — месяцы, настоящий сигнал и ход игрока), 19 рычагов, 9 срезанных углов, 10 нарушений, 25 карточек правил, 7 механик. Наложение фрагмента на `packs/cafe.json` проходит `validate-pack.mjs` с нулём ошибок и нулём предупреждений.
2. **Главное по зиме.** Снег у входа — это не «минус поток», а часы закона: 4 часа на уборку после дневного снегопада, повестка на $100 за каждый снегопад, $350 при неявке и иск упавшего со средней суммой $45 000. Всё это следует из решения игрока, а не из кубика.
3. **Главная поправка.** Погода меняет состав заказов сильнее, чем их число: жара не опустошает кофейню, а переводит её на холодные напитки. Значение `heat: 0.95` в погодной модели для кафе неверно.
4. **Что проверено.** После открытия доступа я сам открыл 30 источников и посчитал штрафы по открытым данным города. `verified` теперь у 8 нарушений из 10, у 15 событий из 83 и у 21 числа механик из 56. Проверка изменила три вещи: шкалу штрафов за тротуар, формулу холодных напитков и повышение тарифа Con Edison.
5. **Чего проверить не удалось.** Сайты `www.nyc.gov`, `www.nycourts.gov` и свод законов города сами отклоняют автоматические запросы. Всё, что опирается только на них, осталось оценкой с пометкой `official_excerpt`. Эти ссылки должен открыть человек.

### Как проверялись числа

Проверка шла в два прохода.

**Первый проход — только веб-поиск.** Среда закрывала все внешние хосты. Числа этого прохода записаны как `estimate`, а их происхождение показывает поле `evidence`.

**Второй проход — открытые страницы и данные.** Владелец разрешил 20 хостов. Я скачал страницы и документы и выполнил запросы к открытым данным города. Числа, которые я увидел сам, записаны как `verified`.

| `evidence` | Что значит | `confidence` | Событий каталога |
|---|---|---|---|
| `opened_official` | Я открыл страницу ведомства или официальный документ и увидел число | `verified` | 11 |
| `open_data_query` | Я сам посчитал число запросом к открытым данным города; запрос описан в `note` | `verified` | 4 |
| `official_excerpt` | Поиск процитировал число с официальной страницы, но саму страницу открыть не удалось | `estimate` | 14 |
| `secondary_opened` | Я открыл статью отраслевой прессы, которая пересказывает чужое исследование | `estimate` | 3 |
| `secondary` | Новости, отраслевая пресса, отчёт компании; страница не открывалась | `estimate` | 30 |
| `calc` | Мой расчёт или игровое значение; расчёт записан в `note` | `estimate` | 21 |

Что я открыл сам:

- **NYC311**, 11 статей: уборка снега, мусор бизнеса, грязный тротуар, вывески на тротуаре, уличные веранды, возмещение Con Edison, разрешения уличным торговцам, предписания по тротуару.
- **Национальная метеослужба**: 12 месячных альманахов Central Park, таблица дней от 90 °F, таблица снега по сезонам.
- **Штат**: страница генерального прокурора о зарплате, релиз губернатора о платном въезде, сводка Департамента общественных услуг по тарифу Con Edison.
- **Город**: четыре отчёта Комптроллера, итоговое правило DSNY о зонах вывоза мусора, школьный календарь.
- **Открытые данные города**, пять наборов: слушания OATH (штрафы), проверки ресторанов, обращения 311, разрешения Департамента зданий, разрешения на съёмки.
- **United Baristas** — первоисточник наклона доли холодных напитков.

Все множители эффектов событий — игровые значения, выведенные из настоящих чисел. Вывод записан в `note` каждой записи.

### Что изменил второй проход

| Что | Было после поиска | Стало после проверки | Откуда |
|---|---|---|---|
| Штраф за снег | $100, $150, $250–350 по номеру нарушения | $100 за каждый снегопад; $350, если повестку проигнорировать | Данные OATH: $100 в 18 026 случаях, $350 в 14 548 случаях неявки |
| Грязный тротуар у бизнеса | $50, затем $100, потолок $300 | $50, затем $300, затем $500; $450 при неявке по первой повестке | Данные OATH, коммерческие коды |
| Вывеска или товар на тротуаре | $100–300 по прессе 2015 года | $50, $300, $500; не дальше 3 футов от стены и не выше 5 футов | Данные OATH и NYC311 |
| Листовки на столбах | $75–150 за штуку | $75 за штуку; $125 при неявке | Данные OATH |
| Открытая дверь с кондиционером | $250, до $1 000 | $250 в большинстве случаев; сетям $500–1 500; около 40 повесток за два года | Данные OATH |
| Шум | Потолок $8 000 по памяти | $2 000; $0 при исправлении; $8 000 при неявке; второе нарушение $4 000 | Данные OATH |
| Доля холодных напитков | Опора «20% при 40 °F» — моё допущение | Опора «20% при 59 °F» измерена; сверху моя поправка на Нью-Йорк +15 пунктов | United Baristas |
| Тариф Con Edison в 2026 году | +3,5% | +3,1% для коммерческого счёта; +2,2% в 2027; +2,3% в 2028 | Сводка Департамента общественных услуг |
| Мыши | Октябрь–ноябрь, без чисел | Октябрь–январь; пик в январе | Данные проверок ресторанов за 2025 год |
| Мошки | Июнь–сентябрь, без чисел | Июнь–ноябрь; пик в октябре | Те же данные |

## 2. Что добавлено

| Раздел | Записей | Что внутри |
|---|---|---|
| `extra.eventCatalog` | 83 | 25 `core`, 46 `deep`, 12 `exotic`; по масштабу: точка 22, квартал 26, город 27, страна 7, мир 1 |
| `extra.mechanics` | 7 | `sidewalk_clock`, `weather_drink_mix`, `storefront_visibility_stack`, `district_calendar`, `basement_flood_exposure`, `trash_and_rodent_pressure`, `outdoor_seat_days` |
| `extra.claims` | 3 | Иски упавших: на тротуаре, на мокром полу, в открытый люк подвала. Новый тип записи, см. раздел 5 |
| `extra.nonObvious` | 37 | Формат `{ text, why, source }`, как в задании D00 |
| `extra.monthlyClimate`, `drinkMixByTemperature`, `weatherDayEffects` | 3 таблицы | Погода по месяцам, доля холодных напитков, множители по типам дней |
| `extra.officeWeek`, `schoolCalendar2026_27` | 2 таблицы | Офисная неделя и школьный календарь как настоящие сигналы |
| `extra.comparisonsAbroad` | 4 | Германия, Россия и Казахстан, Сиэтл и другие города — для сравнения |
| `extra.fixesToExistingData` | 12 | Поправки к пакету, к колоде событий и к погодной модели, см. раздел 4 |
| `levers` | 19 | 9 `core`, 9 `deep`, 1 `exotic` |
| `shortcuts` | 9 | У каждого есть нарушение |
| `violations` | 10 | 9 городских (снег, тротуар, мусор, листовки, вывески, кондиционер, шум) и 1 трудовое; 8 из 10 — `verified` |
| `ruleCards` | 25 | Все короче 280 знаков, у каждой источник |
| `officials` | 1 | `sanitation_agent` — агент Департамента санитарии, новая роль инспектора |
| `reports` | 2 | Жалобы в 311 на тротуар и мусор, на открытую дверь с кондиционером |
| `events` | 8 | Короткие версии главных событий для нынешнего движка; одно из них — исправление `sidewalk_shed` |
| `setup` | 4 | Баки с крышками, снежный набор, коврики, стеллажи для подвала |
| `sources` | 134 | Из них 30 открыты мной; полный список в разделе 7 |

### 2.1. Пять обязательных тем задания

| Тема | Что сделано |
|---|---|
| Погода по месяцам и продажи разных напитков, с числами | Таблица ниже; формула доли холодных напитков; таблица множителей по типам дней; 10 событий о погоде и уличных местах |
| Зима у входа | Механика `sidewalk_clock`; нарушение `snow_ice_not_cleared`; иски `sidewalk_fall_claim` и `wet_floor_fall_claim`; рычаги `snow_ice_plan`, `entrance_floor_safety`, `winter_proofing`, `storm_day_policy`; 13 зимних событий |
| Улица | Механика `storefront_visibility_stack`; 23 события: леса, раскопки, отключение воды, закрытая станция, выходные без метро, ярмарка, съёмки, велодорожка, тележка с кофе, люк подвала, предписание по тротуару, жалоба на шум, взлом, зоны вывоза мусора |
| Городские события | Механика `district_calendar`; 26 событий: офисная неделя, школьный год, туристы, парады, марафон, неделя ООН, чемпионат мира, забастовка железной дороги, календари районов |
| Среда | Механики `basement_flood_exposure` и `trash_and_rodent_pressure`; 11 событий: поломка кондиционера в жару, снижение напряжения, дым, ливень, обратный ток канализации, тропический шторм, засуха, крысы, снос по соседству, мыши, мошки |

### 2.2. Погода по месяцам

Станция Central Park, нормы NOAA за 1991–2020 годы. Температура, осадки и снег проверены по месячным альманахам Национальной метеослужбы. Дни от 90 °F — средние за весь период наблюдений.

| Месяц | Норма дневного максимума, °F | Осадки, дюймов | Снег, дюймов | Дней от 90 °F | Холодные напитки: Нью-Йорк | Холодные напитки: измерено в Лондоне |
|---|---|---|---|---|---|---|
| Январь | 39,5 | 3,64 | 8,8 | 0 | 11% | 2% |
| Февраль | 42,2 | 3,19 | 10,1 | 0 | 15% | 2% |
| Март | 49,9 | 4,29 | 5,0 | 0 | 24% | 9% |
| Апрель | 61,8 | 4,09 | 0,4 | 0 | 38% | 23% |
| Май | 71,4 | 3,96 | 0 | 1 | 50% | 35% |
| Июнь | 79,7 | 4,54 | 0 | 3 | 60% | 45% |
| Июль | 84,9 | 4,60 | 0 | 7 | 67% | 52% |
| Август | 83,3 | 4,56 | 0 | 4 | 65% | 50% |
| Сентябрь | 76,2 | 4,31 | 0 | 1 | 56% | 41% |
| Октябрь | 64,5 | 4,38 | 0,1 | 0 | 42% | 27% |
| Ноябрь | 54,0 | 3,58 | 0,5 | 0 | 29% | 14% |
| Декабрь | 44,3 | 4,38 | 4,9 | 0 | 17% | 2% |

- **Формула.** `доля = 0,20 + 0,0122 × (максимум − 59) + 0,15`, в пределах от 10% до 80%.
- **Что в ней измерено.** United Baristas разобрали продажи одной кофейни в Лондоне за январь–июнь: каждый градус Цельсия добавляет холодному кофе 2,2 процентных пункта, температура объясняет 92% колебаний, при 15 °C холодных 20%, при 28 °C — больше половины. Это столбец «измерено в Лондоне».
- **Что в ней допущение.** Поправка +15 пунктов на привычки Нью-Йорка — моя. Основание — слова сетей: Starbucks называл около 75% холодных напитков летом 2022 года, Dunkin' — больше половины даже зимой. Месячного ряда по кассам в США найти не удалось.
- **Число заказов** погода двигает слабее, чем состав. Planalytics и Национальная федерация розницы оценивают средний погодный размах продаж кофе в 5%; в холодную затяжную весну на северо-востоке спрос на кофе на 10% выше обычного.
- **Годы не похожи друг на друга.** Дней от 90 °F было 24 в 2022 году, 12 в 2023, 21 в 2024 и 14 в 2025. Снега выпало 2,3 дюйма за сезон 2022–23, 7,5 за 2023–24 и 12,9 за 2024–25 при норме 29,8. Зима 2025–26, по сообщениям прессы, принесла 43,4 дюйма.

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

| Срезанный угол | Нарушение | Закон | Штраф | При неявке | Проверено |
|---|---|---|---|---|---|
| `skip_snow_clearing` | `snow_ice_not_cleared` | Административный кодекс §16-123 | $100 за каждый снегопад | $350 | да |
| рычаг `sidewalk_care = ignore` | `dirty_sidewalk` | §16-118 | $50 → $300 → $500 | $450 | да |
| `bags_on_curb` | `improper_trash_setout` | §16-120 | $50 → $100 → $200 | $300 | да |
| `sign_in_the_walkway` | `sidewalk_obstruction` | §16-118 | $50 → $300 → $500 | $450 | да |
| `flyers_on_poles` | `illegal_posting` | §10-119 | $75 за каждую листовку | $125 | да |
| `ac_with_open_door` | `open_door_ac` | §20-910(b) | $250; в отдельных случаях $400–550; сетям $500–1 500 | — | да |
| `speaker_on_sidewalk` | `commercial_music_noise` | §24-231, §24-244(b) | $0 при исправлении, иначе $2 000 | $8 000 | да |
| `storm_day_no_call_in_pay` | `call_in_pay_unpaid` | Приказ о зарплате в общепите | Три часа по минимальной ставке, долг в двойном размере | — | да |
| `dump_in_litter_basket` | `commercial_waste_in_litter_basket` | §16-120(e) | $100 → $250 → $350 по странице DSNY | — | нет |
| `skip_recycling` | `recycling_not_separated` | §16-306 | $100 → $200 → $400 по странице DSNY | — | нет |

Формат пакета выражает рост штрафа только через `perMonth`. Настоящие шкалы я записал в новое поле `fineSteps`, см. просьбу 5.2.

Нарушение с урной на деле почти не применяют: за два года в данных OATH семь повесток. Шкала со страницы DSNY по ним не подтвердилась.

## 3. Пятнадцать самых неочевидных находок

1. **Срок на уборку снега идёт с минуты, когда снег перестал.** Самое короткое окно — 4 часа — выпадает на рабочее время. Снегопад закончился в 10 утра — тротуар должен быть чист к 14:00, в обеденный час, силами тех же двоих, что стоят за стойкой. За январь–март 2026 года город выписал 9 456 таких повесток и получил 54 089 жалоб в 311.
2. **Повестка, на которую не ответили, растёт сама.** Снежная повестка на $100 превратилась в $350 в 41% случаев: на неё просто не ответили. Повестка за грязный тротуар вырастает с $50 до $450, за баки — с $50 до $300. Это видно в данных городских слушаний с января 2025 года.
3. **Вторая повестка за тротуар или вывеску в шесть раз дороже первой.** Для бизнеса шкала такая: $50, $300, $500. Цифры «$50, потом $100», которые повторяет пресса, относятся к жилым домам.
4. **За упавшего на тротуаре отвечает владелец здания, а платит арендатор.** Кодекс (§7-210) называет владельца, но договор аренды перекладывает расходы на магазин. Суд признаёт виновным самого арендатора в одном случае: когда его собственная уборка сделала хуже.
5. **Закрыться в метель — всё равно платить.** Работнику ресторана, который пришёл на смену и был отправлен домой, положено три часа по минимальной ставке. Решать надо накануне вечером.
6. **Жара не опустошает кофейню.** В жаркие дни рестораны теряют посетителей, а кофейные сети немного набирают. Меняется состав: при 90 °F холодных заказов почти три четверти. Упираешься не в спрос, а в лёд и стаканы.
7. **Крысы — летняя беда на улице и зимняя на кухне.** Жалобы на грызунов в 311 достигают пика в июне (3 694 в 2025 году) и падают к декабрю (1 133). В актах проверок ресторанов всё наоборот: следы крыс и мышей чаще всего находят в декабре и январе.
8. **Мошки — осеннее нарушение.** В актах проверок 2025 года их больше всего в октябре (438 случаев) и ещё много в ноябре (351); в феврале — 64.
9. **Леса над входом стоят в среднем полтора года, и об этом можно узнать до подписания аренды.** 14 ноября 2026 года действующее разрешение на леса было у 6 889 зданий, из них 3 117 в Манхэттене. Проверка фасадов идёт по открытому пятилетнему графику для каждого здания выше шести этажей.
10. **Город не платит ничего, когда его же стройка опустошает улицу.** Так написано в ответах городской службы малого бизнеса. Единственная цифра по Нью-Йорку — минус 10–15% выручки; в других городах кофейни теряли до половины.
11. **Уличная ярмарка и трасса марафона могут быть плохим днём.** Палатки стоят между толпой и дверью и сами продают напитки, а поставка не проедет. В 2026 году марафон впервые за 15 лет изменил маршрут в Бронксе, чтобы вернуть доступ к местным магазинам.
12. **Выходные без метро стоят пятой части выходной выручки и тянутся годами.** В Гринпойнте линия G не работала примерно 40% выходных с 2024 года; опрошенные магазины теряли в такие дни 20–24%.
13. **Страховка не покрывает оба способа, которыми дождь губит подвал.** Обычный полис исключает и наводнение, и обратный ток канализации. Коллекторы рассчитаны на 1,75 дюйма дождя в час, а 29 сентября 2023 года в Бруклине лило больше 3 дюймов в час.
14. **Con Edison возмещает испорченные продукты только при своей аварии.** Условия: свет пропал больше чем на 12 часов за сутки, виновато оборудование компании, заявка подана за 30 дней со списком. Потолок для бизнеса — $12 900. За отключение из-за шторма не платят.
15. **Кофейня при офисах живёт три дня в неделю и десять месяцев в году.** На пятницу приходится 12% офисных визитов в будни, а август и декабрь идут на треть ниже 2019 года.

Ещё 22 пункта — в `extra.nonObvious`. Среди них: самый мелкий бизнес вправе делить вывозчика мусора с соседями; на лесах можно повесить свою вывеску; снег приносит отключения света через неделю.

## 4. Исправления существующих данных

| Где | Было | Стало | Почему |
|---|---|---|---|
| `packs/cafe.json` → `events.sidewalk_shed` | Поток ×0,90 на 3 месяца, обе цифры — оценки | ×0,93 на 12 месяцев | Исправляю, потому что есть измерение: исследование города с Mastercard (август 2024) дало минус 3,5–9,7% недельных чеков, а средний возраст разрешения на леса — 557 дней. Запись сдана тем же `id` |
| `ai/src/data/nyc-climate.json` → `footTrafficMult.heat` и карта `heat_advisory` | 0,95 | 1,00 для кафе, а состав заказов уходит в холодные | Foursquare с AccuWeather: рестораны теряют в жару, кофейные сети немного набирают |
| `nyc-climate.json` → `hotDays` | Июль: 6 | Июль: 7; всего 15 в год | Таблица Национальной метеослужбы, открыта |
| `nyc-climate.json` → `tmaxF` | Шесть месяцев отличаются на 0,1 °F | Значения месячных альманахов | Альманахи Национальной метеослужбы, открыты |
| `nyc-climate.json` → осадки | Семь месяцев помечены оценкой | Месячные суммы проверены: от 3,19 до 4,60 дюйма | Те же альманахи. Число дней с осадками не перепроверялось |
| Карта колоды `street_fair` | Поток квартала +20% | Людей +60%, но доля зашедших −30%, если не торговать из двери; поставок нет | Владельцы годами жалуются, что палатки закрывают витрины |
| Карта `marathon_sunday` | +10% по городу | На трассе: +50% у двери на стороне зрителей, доставка ×0,2 | Маршрут 2026 года изменили, чтобы вернуть доступ к магазинам |
| Карта `world_cup_crowds` | Поток +8%, спрос кафе +5% | +2% только в лучших местах, доставка ×0,97 | Измерено после турнира: спортбары +16%, а заслугу турнира признали только 29% малых бизнесов с хорошим летом |
| Карта `congestion_zone_deliveries` | Себестоимость +2% | +1% и только южнее 60-й улицы | Грузовик платит $14,40 или $21,60 за въезд; на маршрут это центы с точки. Скорость грузовиков в зоне выросла на 5,6% |
| Карта `con_ed_rates` | Коммунальные +5% в январе–феврале | +3,1% на весь 2026 год | Сводка Департамента общественных услуг, открыта: коммерческий счёт на 10 800 кВт·ч |
| Карта `outdoor_dining_season` | Каждому кафе +4% спроса с 1 апреля | Только тем, у кого есть лицензированные места на улице | Веранды на тротуаре разрешены круглый год; с 2026 года — и на проезжей части |
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

- **Неявка по повестке.** Самая важная находка проверки: штраф при неявке в три–девять раз выше обычного. В игре на уведомление о штрафе по умолчанию идёт ответ «оплатить» — это правильно, и это стоит показать игроку числом. Если появится вариант «не отвечать», нужна сумма при неявке; она записана в `fineSteps`.
- **Нарушения.** `fineSteps` — настоящая шкала: первое, второе, третье нарушение и сумма при неявке. Поле `perMonth` выражает её неточно.
- **События.** `onlyIf` — условие по месту или рычагу; `daily: { days, effects }` — дневные множители рядом с месячными; `add` — разовая сумма вместо множителя; `delayDays` — последствие, которое приходит позже.
- **Цели эффектов сверх белого списка.** `cashOneTime`, `closureDays`, `icedShare`, `outdoorSeats`, `seats`, `seatUse`, `seatTurnover`, `insurance`, `capacity`, `quality`. Полный список — в `extra.summary.newEffectFields`.
- **Рычаги.** `activeMonths` — рычаг платный только в свои месяцы; `showOnlyIf` — рычаг виден, только пока есть помеха; у вариантов `claimRisk`, `failsIn`, `addsSeats`.
- **Иски.** Новый раздел `claims`: падение — это не нарушение, которое находит чиновник, а гражданский иск с задержкой, франшизой и ростом страховой премии. Задание D08 тоже описывает иски; формат стоит согласовать при сборке.

### 5.3. Данные адреса

Нужны поля места: длина фасада и признак углового помещения; подвал и люк на тротуаре; зона ливневого затопления и предел коллектора; этажность здания и год сдачи отчёта о фасаде; список помех с датами; доли профилей квартала; доля потока от станции метро; близость парка; признаки зон (южнее 60-й улицы, Восточный Мидтаун, Таймс-сквер).

Почти всё это есть в открытых данных города, и запросы к ним работают без ключа. Я проверил пять наборов: разрешения Департамента зданий (`rbx6-tga4`), слушания OATH (`jz4z-kudi`), проверки ресторанов (`43nn-pn8j`), обращения 311 (`erm2-nwe9`), разрешения на съёмки (`tg4x-b46p`).

### 5.4. Погодный ряд

Добавить к дню: час окончания осадков, максимум осадков за час, высоту снега и признак повторного замерзания, индекс качества воздуха.

### 5.5. Сборщику (D11)

- **Комплекты.** Баки с крышками обязательны по закону, но я сдал их с `required: false`, иначе проверка требует их во всех трёх комплектах. Предложение — в `extra.kitAdditions`.
- **Чиновники.** Мои нарушения ссылаются на трёх существующих чиновников. Их списки `checks` нужно дополнить: `dcwp_inspector` ← `open_door_ac`; `dep_inspector` ← `commercial_music_noise`; `labor_investigator` ← `call_in_pay_unpaid`.
- **Пересечения с соседними заданиями.** Поломка кондиционера, лопнувшая труба, отключение света и взлом заходят на территорию D03 и D09; иски — на территорию D08; недельная и месячная кривые спроса — на территорию D06. У меня они даны как следствия погоды и улицы. При споре чисел берите число профильного исследователя.
- **Число рычагов.** 19 рычагов для одной темы — много. Уровни `core`, `deep`, `exotic` проставлены у каждого, чтобы было что отложить.

### 5.6. Что осталось открыть человеку

Три сайта отклоняют автоматические запросы собственной защитой, и обходить её я не стал: `www.nyc.gov`, `www.nycourts.gov`, `codelibrary.amlegal.com`. Ещё два хоста из разрешённых не ответили: `dsny.cityofnewyork.us` и `about.jpmorganchase.com`.

Пометка `official_excerpt` осталась у 14 событий и 2 нарушений. Главные ссылки для проверки глазами:

- исследование города о лесах с Mastercard (август 2024) и счёт лесов за август и октябрь 2026 года;
- местные законы 48 и 51 от 2025 года о лесах;
- ответы службы малого бизнеса о возмещении при стройке;
- показания главы DEP от 26 апреля 2024 года (пять ливней выше предела за 2023 год);
- релиз о дыме 19 июля 2026 года и релиз о ливне 15 июля 2025 года;
- страница DSNY со штрафами за урну и за раздельный сбор;
- текст §7-210 и решение суда о тротуаре;
- отчёт JPMorgan Chase Institute о переводе часов.

## 6. Не найдено

**Цены.**
- Цена уборки снега подрядчиком для витрины в Нью-Йорке. Нашлись только общие диапазоны продавцов услуг: $350–1 500 за выезд для коммерческих площадок.
- Розничная цена мешка соли в 2026 году.
- Тарифы на вывоз мусора по зонам: у каждой зоны своя таблица предельных ставок, в выдаче её нет.
- Цены ковриков, мойки тротуара, обслуживания кондиционера, тамбура, обратного клапана, полиса от наводнения для бизнеса, сигнализации.

**Закон.**
- Штрафы за второй и третий неубранный снегопад. В данных есть один код и одна сумма — $100; статья 311 говорит «до $250».
- Действующие штрафы за бизнес-мусор в городской урне и за отказ от раздельного сбора: страница DSNY не открылась, а в данных слушаний таких дел почти нет.
- Номер раздела правил о раздельном сборе записан по памяти.
- Залог по программе уличных мест и действующая таблица сбора по секторам: в кодексе $5, $8, $14, $25, в прессе $6–31. Взнос $630 за временную лицензию не подтверждён. Зимние правила для веранд ещё пишутся.
- Штраф за открытый люк подвала; официальный текст о тамбурах (есть только пересказ продавца).
- Текст приказа о зарплате в общепите про оплату вызова: страница Департамента труда штата открылась, но нужного места в ней я не нашёл. Правило подтверждено страницей генерального прокурора.

**Измерения.**
- Месячный индекс продаж независимых кофеен. Есть только Starbucks и общие слова.
- Доля холодных напитков по месяцам по данным касс в США. Отсюда моя поправка +15 пунктов.
- Продажи кафе в дни дыма 2023 и 2026 годов.
- Потери бизнеса в неделю ООН, на парадах, на трассе марафона, при съёмках. Есть только слова владельцев.
- Заполняемость отелей по месяцам.
- Убытки подвалов после ливня 29 сентября 2023 года в долларах.
- Как работали частные вывозчики мусора после метелей 2026 года.
- Сколько дней длилась забастовка LIRR в мае 2026 года.
- Итог снега за сезон 2025–26 в таблице метеослужбы: строка была неполной, 43,4 дюйма — цифра прессы.
- Средний возраст лесов по моему собственному счёту: в наборе есть даты разрешений, но одно здание получает новое разрешение каждые 90 дней, и срок жизни лесов из них напрямую не выводится. Оставлена цифра West Side Rag — 557 дней.

**Рассказы владельцев.** Поиск не вернул ни одной ветки Reddit или форума. Голоса владельцев взяты из местных новостей: News 12, amNewYork, Gothamist, DNAinfo.

## 7. Источники

Пометка «открыт» значит, что я сам скачал страницу или выполнил запрос к набору данных 14 ноября 2026 года. Остальные ссылки найдены веб-поиском и не открывались.

1. [ABC7: LIRR workers go on strike, halting the busiest US commuter rail system (May 16, 2026)](https://abc7ny.com/post/lirr-workers-go-strike-halting-busiest-us-commuter-rail-system/19111461/)
2. [ABC7: DSNY working to catch up as trash piles up on snowbanks (February 2026)](https://abc7ny.com/post/mamdani-defends-dsny-trash-piles-snowbanks-parts-nyc/18529761/)
3. [ABC7: Con Edison reduces voltage in parts of the Bronx and Westchester (July 2026)](https://abc7ny.com/post/nyc-extreme-heat-coned-reduces-voltage-parts-bronx-westchester-asks-customers-conserve-energy/19436776/)
4. [DoorDash: severe weather protocol and weather impact fee (January 2026)](https://about.doordash.com/en-us/news/winter-storm-fern)
5. [JPMorgan Chase Institute: Shedding Light on Daylight Saving Time (2016)](https://about.jpmorganchase.com/content/dam/jpmc/jpmorgan-chase-and-co/institute/pdf/jpmc-institute-daylight-savings-report.pdf)
6. [NYC Public Advocate: Orange Sky, Red Alert - review of air quality emergencies](https://advocate.nyc.gov/reports/orange-sky-red-alert-review-air-quality-emergencies-nyc)
7. [NY Attorney General: Wages and pay (call-in pay, three hours for restaurant workers)](https://ag.ny.gov/resources/individuals/workers-rights/wages-pay) — открыт
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
18. [NYC Comptroller: audit of DEP's leak detection program (water main breaks)](https://comptroller.nyc.gov/reports/audit-of-the-new-york-city-department-of-environmental-protections-leak-detection-program) — открыт
19. [NYC Comptroller: Is New York City Ready for Rain?](https://comptroller.nyc.gov/reports/is-new-york-city-ready-for-rain) — открыт
20. [NYC Comptroller: review of the Small Business Forward initiative (April 2026)](https://comptroller.nyc.gov/reports/review-of-the-small-business-forward-initiative-and-its-impact-on-violations-enforcement) — открыт
21. [NYC Comptroller: Streets for People, Open Streets and the future of public space management](https://comptroller.nyc.gov/reports/streets-for-people) — открыт
22. [NYC Open Data: DOHMH New York City Restaurant Inspection Results (queried November 14, 2026)](https://data.cityofnewyork.us/d/43nn-pn8j) — открыт
23. [NYC Open Data: 311 Service Requests from 2010 to Present (queried November 14, 2026)](https://data.cityofnewyork.us/d/erm2-nwe9) — открыт
24. [NYC Open Data: OATH Hearings Division Case Status (queried November 14, 2026)](https://data.cityofnewyork.us/d/jz4z-kudi) — открыт
25. [NYC Open Data: DOB NOW Build - Approved Permits (queried November 14, 2026)](https://data.cityofnewyork.us/d/rbx6-tga4) — открыт
26. [NYC Open Data: Film Permits (queried November 14, 2026)](https://data.cityofnewyork.us/d/tg4x-b46p) — открыт
27. [Documented: NYC power outage reimbursement (August 14, 2026)](https://documentedny.com/2026/08/14/nyc-power-outage-reimbursement/)
28. [NYS Department of Labor: Hospitality Wage Order FAQ (call-in pay)](https://dol.ny.gov/hospitality-wage-order-faq)
29. [NYS Department of Public Service: Con Edison electric rate case summary (January 2026)](https://dps.ny.gov/system/files/documents/2026/01/con-edison-electric-rate-case-summary.pdf) — открыт
30. [DSNY: collection and setout laws for businesses (litter baskets)](https://dsny.cityofnewyork.us/?p=1198)
31. [Foursquare with AccuWeather: Fair Weather Foodies (rain and restaurant visits)](https://foursquare.com/resources/blog/data/fair-weather-foodies/)
32. [Foursquare with AccuWeather: summer weather data and restaurant foot traffic](https://foursquare.com/resources/blog/data/summer-weather-data-reveals-consumer-insights/)
33. [NYC Council Introduction 302 of 2024 (illegal posting penalties under §10-121)](https://intro.nyc/0302-2024)
34. [KING 5: West Seattle coffee shop concerned by construction impact](https://king5.com/article/news/west-seattle-coffeeshop-concerned-by-construction-impact/281-c99589c4-ef19-438c-8396-3794ef4e67d5)
35. [News 12: ice melt shortage ahead of the January 2026 storm](https://longisland.news12.com/2026/01/22/hudson-valley-customers-face-ice-melt-shortage-ahead-of-major-snowstorm/1mt40tbth8IHiDHAC6zw1E)
36. [NYC DOT: The Economic Benefits of Sustainable Streets (2013)](https://nyc.gov/html/dot/downloads/pdf/dot-economic-benefits-of-sustainable-streets.pdf)
37. [Streetsblog NYC: how much outdoor dining costs restaurants (April 2025)](https://nyc.streetsblog.org/2025/04/04/fare-fares-heres-how-much-outdoor-dining-costs-restaurants)
38. [NYC311: Snow or Ice on Sidewalk](https://portal.311.nyc.gov/article/?kanumber=KA-01397) — открыт
39. [NYC311: Sidewalk Violation](https://portal.311.nyc.gov/article/?kanumber=KA-01506) — открыт
40. [NYC311: Sidewalk Repair by the City](https://portal.311.nyc.gov/article/?kanumber=KA-01786) — открыт
41. [NYC311: Waste Disposal for Businesses](https://portal.311.nyc.gov/article/?kanumber=KA-01787) — открыт
42. [NYC311: Dirty Sidewalk](https://portal.311.nyc.gov/article/?kanumber=KA-01803) — открыт
43. [NYC311: mobile food vending permits (Local Laws 54 and 59 of 2026)](https://portal.311.nyc.gov/article/?kanumber=KA-01830) — открыт
44. [NYC311: sidewalk obstruction, A-frame signs within 3 feet](https://portal.311.nyc.gov/article/?kanumber=KA-01980) — открыт
45. [NYC311: Poster or Sticker Complaint](https://portal.311.nyc.gov/article/?kanumber=KA-02140) — открыт
46. [NYC311: Con Edison claims for losses from a power outage](https://portal.311.nyc.gov/article/?kanumber=KA-02283) — открыт
47. [NYC311: Dirty Sidewalk or Gutter (enforcement routing times)](https://portal.311.nyc.gov/article/?kanumber=KA-02443) — открыт
48. [NYC311: Dining Out NYC license and fees](https://portal.311.nyc.gov/article/?kanumber=KA-03604) — открыт
49. [Toast: coffee price and order trends 2025 (cold brew peak in July)](https://pos.toasttab.com/blog/data/coffee-prices-trends-by-state)
50. [QNS: Astoria electeds ask MTA for relief for businesses near shuttered N/W stations (February 2018)](https://qns.com/2018/02/astorias-electeds-call-mta-president-boost-service-provide-relief-business-owners-near-shuttered-n-w-stations)
51. [DSNY final rule: implementation dates for the Brooklyn North and Upper Manhattan commercial waste zones (June 2026)](https://rules.cityofnewyork.us/wp-content/uploads/2026/06/DSNY-Final-Rule-re-Implementation-Dates-for-the-Brooklyn-North-and-Upper-Manhattan-Commercial-Waste-Zones_Final.pdf) — открыт
52. [Bloomberg Second Measure: does pumpkin spice drive Starbucks sales](https://secondmeasure.com/datapoints/does-pumpkin-spice-drive-starbucks-sales/)
53. [T-Bank Secrets: a lawsuit over a customer injury (Russia)](https://secrets.tbank.ru/trendy/isk-iz-za-travmy/)
54. [Signs NY: NYC vestibule enclosures, permits and requirements (vendor guide)](https://signsny.com/blog/nyc-vestibule-enclosures-permits-requirements/)
55. [Signs NY: winter vestibules for restaurants, the 25 square foot allowance (vendor guide)](https://signsny.com/blog/restaurant-vestibule-25-sqft-rule-explanation/)
56. [NYC Hospitality Alliance: summer and fall 2024 survey results](https://thenycalliance.org/news-item/summer-fall-2024-survey-results)
57. [Times Square Alliance: New Year's Eve and NYPD information for businesses](https://timessquarenyc.org/nye/nye-business-resource)
58. [Total Food Service / HUB Insurance: how restaurants can avoid sidewalk-law claims](https://totalfood.com/how-restaurants-can-help-avoid-sidewalk-law-related-claims-and-litigation/)
59. [United Baristas: cold coffee demand is more predictable than the British weather (King's Cross cafe analysis)](https://unitedbaristas.com/articles/explainers/cold-coffee-demand-is-more-predictable-than-the-british-weather/) — открыт
60. [Al Jazeera: how New York deals with the influx of leaders at the UN General Assembly (September 24, 2025)](https://www.aljazeera.com/news/2025/9/24/how-new-york-deals-with-the-influx-of-leaders-at-the-un-general-assembly)
61. [amNewYork: MTA axes G train shutdowns planned for December after outcry from small businesses](https://www.amny.com/news/mta-axes-g-train-shutdowns-planned-for-december-after-outcry-from-small-businesses/)
62. [amNewYork: sidewalk shoveling rules and tickets after the January 2026 storm](https://www.amny.com/news/nyc-blizzard-sidewalk-shoverling-rules-tickets)
63. [amNewYork (The Villager): water pipe work on West 10th Street hurting business](https://www.amny.com/news/water-pipe-torture-killing-w-10th-st-business)
64. [Bisnow: Morningside Heights faces fall without thousands of Columbia students](https://www.bisnow.com/news/new-york/economy/morningside-heights-look-at-a-fall-without-a-key-economic-driver-many-of-columbia-universitys-students-105624-105625)
65. [Bloomberg: UN week brings Midtown gridlock (September 21, 2025)](https://www.bloomberg.com/news/features/2025-09-21/un-week-brings-midtown-gridlock-snipers-and-secret-service)
66. [Brownstoner: Brooklyn businesses struggle to recover after record-breaking rains (2023)](https://www.brownstoner.com/brooklyn-life/brooklyn-businesses-flood-recovery)
67. [The Hartford: water and freezing damage, burglary lead top five small-business claims (December 9, 2025)](https://www.businesswire.com/news/home/20251209433403/en/Water-And-Freezing-Damage-Burglary-Lead-The-Hartfords-Top-Five-Small-Business-Claims)
68. [CBS New York: extreme heat causes outages, 8% voltage reduction in Brooklyn and Queens (June 2025)](https://www.cbsnews.com/amp/newyork/news/extreme-heat-causing-power-outages)
69. [CBS New York: 2025-2026 was NYC's coldest, snowiest winter in 11 years](https://www.cbsnews.com/newyork/news/2025-2026-nyc-winter-cold-snow)
70. [CBS New York: Garment District business owners irate over water shutdown plan](https://www.cbsnews.com/newyork/news/garment-district-water-shutdown/)
71. [CBS New York: winter weather to blame for many manhole fires](https://www.cbsnews.com/newyork/news/winter-weather-to-blame-for-many-manhole-fires)
72. [Daeryun Law: holiday pay in New York and when it becomes legally owed](https://www.daeryunlaw.com/us/insights/holiday-pay-new-york)
73. [daswetter.com: TheFork study on temperature and restaurant bookings](https://www.daswetter.com/nachrichten/aktuelles/studie-zeigt-wie-sich-kuhlere-temperaturen-auf-ausgeh-abende-auswirken.html)
74. [DNAinfo: illegal posters, Clinton Hill business fined almost $9,000](https://www.dnainfo.com/new-york/20120625/fort-greene/illegal-posters-could-pin-fine-on-hakeem-jeffries-campaign)
75. [DNAinfo: incessant filming hurts small businesses on Crosby Street, owners say](https://www.dnainfo.com/new-york/20151230/soho/incessant-filming-hurts-small-businesses-on-crosby-street-owners-say)
76. [FreightWaves: New York trucking group says Manhattan tolls burden industry (toll schedule)](https://www.freightwaves.com/news/new-york-trucking-group-says-manhattan-tolls-burden-industry)
77. [GlobeSt: hybrid habits hold firm as Friday office visits lag (Placer.ai, November 2025)](https://www.globest.com/amp/2025/11/24/hybrid-habits-hold-firm-as-friday-office-visits-lag/)
78. [Governor of New York: first anniversary of congestion pricing (January 5, 2026)](https://www.governor.ny.gov/news/less-traffic-better-transit-its-first-anniversary-governor-hochul-celebrates-transformational) — открыт
79. [Insurance Journal: Hartford 10-year analysis of small-business claims (December 10, 2025)](https://www.insurancejournal.com/news/national/2025/12/10/850545.htm) — открыт
80. [Kastle: Back to Work Barometer](https://www.kastle.com/safety-wellness/getting-america-back-to-work/)
81. [NerdWallet: water backup coverage (cost range)](https://www.nerdwallet.com/insurance/homeowners/learn/water-backup-coverage)
82. [Local Law 48 of 2025 (sidewalk shed permits and penalties)](https://www.nyc.gov/assets/buildings/local_laws/ll48of2025.pdf)
83. [NYC Buildings: Local Law 109 of 2022 service notice (rodent extermination before demolition)](https://www.nyc.gov/assets/buildings/pdf/ll109of22-sn.pdf)
84. [NYC: 2026 TCS New York City Marathon street closures](https://www.nyc.gov/assets/cecm/downloads/pdf/tcs-street-closures-marathon-2026.pdf)
85. [DCWP: business flyer, air conditioning law](https://www.nyc.gov/assets/dca/downloads/pdf/businesses/Business-Flyer-Air-Conditioning-Law.pdf)
86. [NYC DDC / Small Business Services FAQ for businesses near construction (2022)](https://www.nyc.gov/assets/ddc/downloads/projects/Outreach-Materials/2022_SBS_FAQs_English_r2.pdf)
87. [NYC DEP: commercial music noise violation, zero penalty for a cured first offense](https://www.nyc.gov/assets/dep/downloads/pdf/air/noise/commercial-music-noise-violation-zero-penalty.pdf)
88. [NYPD CompStat citywide report](https://www.nyc.gov/assets/nypd/downloads/pdf/crime_statistics/cs-en-us-city.pdf)
89. [Preliminary Mayor's Management Report 2026: Department of Environmental Protection (water main breaks)](https://www.nyc.gov/assets/operations/downloads/pdf/pmmr2026/dep.pdf)
90. [NYC DOT: a property owner's guide to address sidewalk defects](https://www.nyc.gov/html/dot/downloads/pdf/nyc-sidewalks-a-property-owners-guide-to-address-sidewalk-defects.pdf)
91. [NYC DOT: sidewalk repair and violations](https://www.nyc.gov/html/dot/html/infrastructure/sidewalkintro.shtml)
92. [NYC DOT: Streets for Recovery, the economic benefits of the Open Streets program (October 2022)](https://www.nyc.gov/html/dot/html/pr2022/outdoor-dining.shtml)
93. [NYC DOT: 2026 Open Streets season kicks off (May 21, 2026)](https://www.nyc.gov/html/dot/html/pr2026/nyc-dot-kicks-off-2026-open-streets-season.shtml)
94. [NYC Mayor's Office: study finds sidewalk sheds cost Manhattan businesses (August 2024)](https://www.nyc.gov/mayors-office/news/2024/08/mayor-adams-releases-new-study-finding-sidewalk-sheds-scaffolding-cost-manhattan-businesses)
95. [NYC Mayor's Office: Executive Order 11 to inventory and cut fines and fees on small businesses (January 14, 2026)](https://www.nyc.gov/mayors-office/news/2026/01/mayor-mamdani-signs-executive-order-to-inventory-and-cut-fines-a.html)
96. [NYC Mayor's Office: taking down sidewalk sheds, 7,427 permitted sheds (August 20, 2026)](https://www.nyc.gov/mayors-office/news/2026/08/mamdani-administration-taking-down-sidewalk-sheds-and-improving-)
97. [NYC Mayor's Office: Mayor Mamdani signs bill making year-round outdoor dining permanent (August 31, 2026)](https://www.nyc.gov/mayors-office/news/2026/08/mayor-mamdani-signs-bill-making-year-round-outdoor-dining-a-perm)
98. [NYC Mayor's Office: World Cup delivered $2 billion economic impact (September 2026)](https://www.nyc.gov/mayors-office/news/2026/09/mayor-mamdani-announces-world-cup-delivered--2-billion-economic-.html)
99. [NYC Mayor's Office: 1,200 sidewalk sheds taken down (October 19, 2026)](https://www.nyc.gov/mayors-office/news/2026/10/mamdani-administration-announces-1-200-sidewalk-sheds-taken-down)
100. [NYC Buildings: construction site signage requirements (temporary business sign on a shed)](https://www.nyc.gov/site/buildings/safety/construction-site-signage-requirements.page)
101. [NYC Citywide Event Coordination and Management: street activity permits (parades, fairs)](https://www.nyc.gov/site/cecm/permitting/permitting.page)
102. [DCWP: Shut the Front Door reminder, 2023 inspection counts](https://www.nyc.gov/site/dca/news/023-24/shut-front-door-city-reminds-local-businesses-keep-doors-windows-closed-when-running)
103. [NYC DEP Commissioner testimony on flooding and stormwater infrastructure (April 26, 2024)](https://www.nyc.gov/site/dep/news/042624/testimony-rohit-t-aggarwala-commissioner-new-york-city-department-environmental-protection)
104. [DSNY: Commercial Waste Zones rollout schedule](https://www.nyc.gov/site/dsny/businesses/cwz/rollout-schedule.page)
105. [DSNY: cleaning rules for businesses](https://www.nyc.gov/site/dsny/businesses/rules-reporting/cleaning-rules-businesses.page)
106. [DSNY: setout rules for businesses](https://www.nyc.gov/site/dsny/businesses/rules-reporting/setout-rules-businesses.page)
107. [DSNY: sidewalk and street rules for businesses](https://www.nyc.gov/site/dsny/businesses/rules-reporting/street-sidewalk-rules-businesses.page)
108. [DSNY: starting March 1, 2024 all businesses must put trash in lidded bins](https://www.nyc.gov/site/dsny/news/24-011/starting-friday-march-1-all-new-york-city-businesses-must-put-trash-lidded-bins-)
109. [DSNY: New York's Strongest delivered a cleaner city in 2025 (rat sighting counts)](https://www.nyc.gov/site/dsny/news/25-042/new-york-s-strongest-delivered-cleaner-more-sustainable-city-2025)
110. [DSNY: Snow and Ice Removal Laws](https://www.nyc.gov/site/dsny/what-we-do/snow-response/snow-laws.page)
111. [NYC Emergency Management: city responds to historic rainfall event (July 15, 2025)](https://www.nyc.gov/site/em/about/press-releases/20250715_pr_nycem-City-Responds-To-Hstoric-Rainfall-Event.page)
112. [NYC Emergency Management: wildfire smoke response concludes (July 19, 2026)](https://www.nyc.gov/site/em/about/press-releases/20260719_pr_NYCEM-Thanks-New-Yorkers-as-Wildfire-Smoke-Response-Concludes.page)
113. [Bing v 296 Third Ave. Group, L.P. (sidewalk liability under Administrative Code §7-210)](https://www.nycourts.gov/REPORTER/3dseries/2012/2012_02424.htm)
114. [Appellate Division decision on a fall through sidewalk cellar doors (2020)](https://www.nycourts.gov/reporter/3dseries/2020/2020_07275.htm)
115. [New York court decision upholding a §24-244(b) summons for music audible on the sidewalk (2010)](https://www.nycourts.gov/reporter/pdfs/2010/2010_30009.pdf)
116. [NYS Comptroller Report 20-2026: employment outcomes of Open Streets in New York City](https://www.osc.ny.gov/files/reports/pdf/report-20-2026.pdf)
117. [Placer.ai: August 2025 office index, an end-of-summer slump](https://www.placer.ai/anchor/articles/august-2025-placer-ai-office-index-an-end-of-summer-slump)
118. [Placer.ai: December 2025 office index, 'tis the season to WFH](https://www.placer.ai/anchor/articles/placer-ai-december-2025-office-index-tis-the-season-to-wfh)
119. [Placer.ai: PSL Day 2026 gives Starbucks its biggest Tuesday of the year](https://www.placer.ai/anchor/articles/psl-day-2026-gives-starbucks-its-biggest-tuesday-of-the-year)
120. [Placer.ai: 2026 office recovery trends across major US markets](https://www.placer.ai/anchor/reports/2026-office-recovery-trends-across-major-u-s-markets)
121. [Planalytics: how weather impacts your sales (coffee swing 5%, Northeast +10% in a cool spring)](https://www.planalytics.com/?p=5995)
122. [PYMNTS Intelligence: host cities score, local customers drive a strong small-business summer (September 2026)](https://www.pymnts.com/study_posts/host-cities-score-local-customers-drive-a-strong-smb-summer/)
123. [US Small Business Administration: Small Business Saturday, November 29, 2025](https://www.sba.gov/article/2025/11/25/sba-encourages-americans-shop-small-small-business-saturdayr-november-29th)
124. [NYC Public Schools: 2026-2027 school year calendar](https://www.schools.nyc.gov/calendar/2026-2027-school-year-calendar) — открыт
125. [Tageskarte: Lightspeed analysis of German restaurants in summer](https://www.tageskarte.io/gastronomie/detail/mehr-gaeste-weniger-umsatz-pro-bon-was-restaurants-im-sommer-beachten-sollten.html)
126. [Tea & Coffee Trade Journal: Square data on iced coffee in the May 2026 UK heatwave](https://www.teaandcoffee.net/blog/39416/as-temperatures-rise-more-uk-consumers-grab-iced-coffees/)
127. [The City: manhole explosion season, a century-old problem (February 2020)](https://www.thecity.nyc/2020/02/24/it-s-manhole-explosion-season-what-you-need-to-know-about-a-century-old-problem/)
128. [Vice: how one subway closure in Queens wrecked a community](https://www.vice.com/en/article/how-one-subway-closure-in-queens-wrecked-a-community)
129. [WAMC: Yemeni coffeehouses, community and Ramadan (March 17, 2026)](https://www.wamc.org/news/2026-03-17/yemeni-coffeehouses-community-ramadan)
130. [NWS New York: Central Park monthly almanacs, 1991-2020 normals (nycjan.pdf to nycdec.pdf)](https://www.weather.gov/media/okx/Climate/Almanacs/nyc/nycjan.pdf) — открыт
131. [NWS New York: Central Park 90-degree days by month and year](https://www.weather.gov/media/okx/Climate/CentralPark/90DegreeDays.pdf) — открыт
132. [NWS New York: Central Park daily maximum temperature normals 1991-2020](https://www.weather.gov/media/okx/Climate/CentralPark/DailyMaxTNormals.pdf)
133. [NWS New York: Central Park monthly and seasonal snowfall](https://www.weather.gov/media/okx/Climate/CentralPark/monthlyseasonalsnowfall.pdf) — открыт
134. [West Side Rag: UWS Shed Watch, average shed permit age from DOB data (April 2026)](https://www.westsiderag.com/2026/04/23/uws-shed-watch-a-new-monthly-column-from-west-side-rag)

## Приложение. Каталог событий по темам

Названия событий — строки для игрока, поэтому они на английском. Полные записи с текстом, сигналом, эффектами и расчётом — в `extra.eventCatalog`.

### Погода, напитки, места на улице — 10

| id | Название | Месяцы | Масштаб | Уровень | Основание |
|---|---|---|---|---|---|
| `iced_season_switch` | Iced season starts | 4, 5 | город | core | открыта статья прессы |
| `heat_wave_iced_rush` | Heat wave: everyone wants it iced | 6, 7, 8, 9 | город | core | пресса, не открывалась |
| `rainy_day_mix` | A soaking rainy day | весь год | город | core | пресса, не открывалась |
| `cool_spring_bonus` | A cold, late spring | 4, 5 | город | deep | пресса, не открывалась |
| `arctic_blast` | Arctic blast | 12, 1, 2 | город | core | расчёт |
| `early_dark` | The clocks go back | 11, 12 | страна | deep | выдержка официальной страницы |
| `high_wind_day` | Wind advisory | 10, 11, 12, 1, 2, 3, 4 | город | exotic | расчёт |
| `park_weather_weekend` | A perfect Saturday | 4, 5, 6, 9, 10 | квартал | deep | расчёт |
| `outdoor_season_opens` | Outdoor season | 4, 5, 6, 9, 10 | город | core | выдержка официальной страницы |
| `roadway_winter_rules_pending` | Keep the roadway cafe up this winter? | 11, 12, 1, 2, 3 | город | deep | выдержка официальной страницы |

### Зима у входа — 13

| id | Название | Месяцы | Масштаб | Уровень | Основание |
|---|---|---|---|---|---|
| `snowfall_clear_the_walk` | Snow: the clock starts | 12, 1, 2, 3 | точка | core | открыт первоисточник |
| `icy_sidewalk_refreeze` | Black ice at the door | 12, 1, 2, 3 | точка | core | расчёт |
| `sidewalk_fall_claim` | Letter from a lawyer: someone fell on your ice | 1, 2, 3, 4, 5, 6 | точка | core | открыта статья прессы |
| `wet_floor_inside` | Slush on the floor | 11, 12, 1, 2, 3, 4 | точка | core | расчёт |
| `blizzard_shutdown` | Blizzard warning: the city tells people to stay home | 12, 1, 2, 3 | город | core | пресса, не открывалась |
| `ice_melt_shortage` | Ice melt sold out | 1, 2 | страна | deep | пресса, не открывалась |
| `corner_lot_double_duty` | Corner shop: twice the snow | 12, 1, 2, 3 | точка | deep | открыт первоисточник |
| `no_delivery_in_the_storm` | The milk truck does not come | 12, 1, 2, 3 | город | deep | расчёт |
| `manhole_fire_outage` | Manhole fire: the block goes dark | 1, 2, 3 | квартал | deep | пресса, не открывалась |
| `frozen_pipe` | A pipe bursts overnight | 12, 1, 2 | точка | core | открыта статья прессы |
| `line_wont_stand_outside` | Nobody queues in the cold | 12, 1, 2 | точка | deep | расчёт |
| `door_draft_tables` | The tables by the door are empty | 12, 1, 2 | точка | deep | расчёт |
| `trash_piles_after_snow` | No pickup for a week | 1, 2, 3 | город | deep | пресса, не открывалась |

### Улица — 23

| id | Название | Месяцы | Масштаб | Уровень | Основание |
|---|---|---|---|---|---|
| `shed_goes_up` | A sidewalk shed goes up over your door | весь год | точка | core | выдержка официальной страницы |
| `shed_idle_months` | The shed is up and nobody is working | весь год | точка | deep | выдержка официальной страницы |
| `shed_comes_down` | The shed comes down | весь год | точка | deep | выдержка официальной страницы |
| `subway_weekend_shutdowns` | No trains at your station on weekends | весь год | квартал | core | пресса, не открывалась |
| `station_closed_for_months` | Your subway station closes for renovation | весь год | квартал | deep | пресса, не открывалась |
| `street_dig_long` | The street is dug up for a new water main | весь год | квартал | core | пресса, не открывалась |
| `planned_water_shutoff` | Water off on your block, weekdays 8 to 3 | весь год | квартал | deep | пресса, не открывалась |
| `water_main_break` | Water main breaks on your block | 12, 1, 2, 3 | квартал | deep | открыт первоисточник |
| `street_resurfacing` | Milling and paving | 4, 5, 6, 7, 8, 9, 10, 11 | квартал | exotic | расчёт |
| `street_fair_day` | Street fair on your avenue | 5, 6, 7, 8, 9, 10 | квартал | core | пресса, не открывалась |
| `film_shoot_on_block` | A film crew takes the block | весь год | квартал | deep | пресса, не открывалась |
| `open_streets_season` | Your street goes car-free on weekends | 4, 5, 6, 7, 8, 9, 10 | квартал | core | выдержка официальной страницы |
| `crz_foot_traffic` | Congestion Relief Zone: more people on foot | весь год | город | deep | открыт первоисточник |
| `crz_delivery_surcharge` | Suppliers add a congestion surcharge | весь год | город | deep | пресса, не открывалась |
| `bike_lane_replaces_parking` | A protected bike lane replaces the parking | 4, 5, 6, 7, 8, 9, 10 | квартал | exotic | выдержка официальной страницы |
| `coffee_cart_at_the_corner` | A coffee cart parks at your corner | весь год | точка | deep | открыт первоисточник |
| `open_hatch_delivery` | The cellar doors are open again | весь год | точка | deep | пресса, не открывалась |
| `sidewalk_violation_notice` | The city marks your sidewalk | 4, 5, 6, 7, 8, 9, 10 | точка | deep | открыт первоисточник |
| `noise_complaint_upstairs` | The neighbors upstairs call 311 | 5, 6, 7, 8, 9 | точка | deep | мой запрос к открытым данным |
| `break_in` | Break-in | весь год | точка | deep | пресса, не открывалась |
| `clogged_catch_basin` | A lake at your corner | 10, 11, 12, 3, 4 | точка | exotic | расчёт |
| `waste_zone_goes_live` | Your commercial waste zone goes live | весь год | город | deep | открыт первоисточник |
| `fines_review` | City Hall reviews small-business fines | 1, 7 | город | deep | выдержка официальной страницы |

### Городской календарь — 26

| id | Название | Месяцы | Масштаб | Уровень | Основание |
|---|---|---|---|---|---|
| `marathon_on_your_avenue` | Marathon Sunday on your avenue | 11 | квартал | core | пресса, не открывалась |
| `january_slump` | January | 1 | страна | core | пресса, не открывалась |
| `august_office_slump` | August: the offices empty out | 8 | город | core | пресса, не открывалась |
| `summer_weekend_exodus` | Summer weekends: the neighborhood leaves town | 7, 8 | город | core | пресса, не открывалась |
| `school_year_starts` | School is back | 9 | город | core | открыт первоисточник |
| `school_recess_week` | School recess week | 2, 4, 12 | город | deep | открыт первоисточник |
| `holiday_dead_week` | The week between Christmas and New Year's | 12 | город | core | пресса, не открывалась |
| `campus_summer` | The students go home | 6, 7, 8 | квартал | deep | пресса, не открывалась |
| `finals_weeks` | Finals | 5, 12 | квартал | exotic | расчёт |
| `tourist_high_season` | Tourist high season | 6, 7, 8, 11, 12 | город | deep | выдержка официальной страницы |
| `tourist_low_season` | January and February: no visitors | 1, 2 | город | deep | расчёт |
| `pumpkin_launch_day` | Pumpkin spice comes back | 8, 9 | страна | deep | пресса, не открывалась |
| `small_business_saturday` | Small Business Saturday | 11 | страна | exotic | пресса, не открывалась |
| `thanksgiving_parade_morning` | Thanksgiving parade at your corner | 11 | квартал | deep | расчёт |
| `pride_sunday` | Pride Sunday | 6 | квартал | deep | расчёт |
| `avenue_parade_day` | A parade closes your avenue | 3, 6, 9, 10 | квартал | deep | расчёт |
| `bike_tour_and_half_marathon` | Sunday race: streets closed until noon | 3, 5 | квартал | exotic | расчёт |
| `unga_week` | UN General Assembly week | 9 | город | deep | пресса, не открывалась |
| `new_years_eve_frozen_zone` | New Year's Eve: inside the frozen zone | 12 | квартал | exotic | выдержка официальной страницы |
| `world_cup_summer` | World Cup summer | 6, 7 | мир | deep | выдержка официальной страницы |
| `commuter_rail_strike` | Commuter rail strike | 5 | город | deep | пресса, не открывалась |
| `ramadan_nights` | Ramadan: the day goes quiet, the night comes alive | 2, 3 | квартал | deep | пресса, не открывалась |
| `high_holidays_and_passover` | The Jewish holidays | 4, 9, 10 | квартал | exotic | расчёт |
| `lunar_new_year` | Lunar New Year | 1, 2 | квартал | exotic | расчёт |
| `immigration_enforcement_chill` | People stay home | весь год | страна | deep | пресса, не открывалась |
| `holiday_market_nearby` | A holiday market opens across the square | 11, 12 | квартал | exotic | расчёт |

### Среда — 11

| id | Название | Месяцы | Масштаб | Уровень | Основание |
|---|---|---|---|---|---|
| `heat_wave_ac_failure` | The air conditioner dies on the hottest day | 6, 7, 8 | точка | deep | расчёт |
| `voltage_reduction` | Con Edison cuts voltage in your neighborhood | 6, 7, 8 | квартал | deep | пресса, не открывалась |
| `wildfire_smoke_day` | Smoke from Canada | 5, 6, 7, 8, 9 | страна | core | выдержка официальной страницы |
| `flash_flood_warning` | Flash flood warning | 6, 7, 8, 9, 10 | город | core | открыт первоисточник |
| `sewer_backup` | The floor drain runs backwards | 4, 5, 6, 7, 8, 9, 10 | точка | deep | открыт первоисточник |
| `tropical_storm_watch` | Tropical storm watch | 8, 9, 10 | город | deep | расчёт |
| `drought_warning` | Drought warning | 10, 11, 12 | город | exotic | пресса, не открывалась |
| `summer_rat_peak` | Rat season | 6, 7, 8, 9 | квартал | core | мой запрос к открытым данным |
| `demolition_next_door` | The building next door is coming down | весь год | точка | deep | выдержка официальной страницы |
| `mice_move_in` | Cold weather: the mice come inside | 10, 11, 12, 1 | точка | deep | мой запрос к открытым данным |
| `fruit_fly_summer` | Flies | 6, 7, 8, 9, 10, 11 | точка | deep | мой запрос к открытым данным |
