# D10 — причины смерти, неочевидное, год глазами владельца (кафе)

Исследователь D10, 14 ноября 2026. Фрагмент пакета: `packs/parts/cafe/D10-deaths-nonobvious-year.json`.

## 1. Вердикт

1. Кафе в Нью-Йорке чаще убивает не пустой зал, а договор аренды: 21 из 64 собранных историй — рост аренды при продлении, отказ продлить, продажа здания, долг по аренде или спор с арендодателем. В пакете аренда — одно число без срока и условий.
2. Вторая группа причин — закрытие не по вине владельца при идущей аренде: газ отключён на месяцы (5 историй), леса и стройка, перекрытая улица, нарушения на здании. В пакете заведение закрывает только инспектор.
3. Третья — деньги и люди: долги и быстрые займы, слишком ранняя вторая точка, уход всей команды, кража, выгорание и болезнь владельца. В пакете работники — это число, а владелец ничего не стоит и не устаёт.
4. Прохождение игры показало главный перекос: открыться без разрешения выгодно. За 30 дней незаконной работы кафе выручило $55 378, штраф составил $1 400 и 5 дней закрытия.
5. Сдано: историй закрытия — 64, неочевидных пунктов — 115, событий с ходом игрока — 38, механик — 10; календарь первого года по месяцам; 7 исправлений пакета. Все числа помечены `estimate`: открыть страницы источников в этой сессии было нельзя (раздел 6).

## 2. Что добавлено

| Раздел | Записей | Что внутри |
|---|---|---|
| `extra.failureStories` | 64 | Истории закрытия: что случилось, причина, урок, ссылка, метки причин. Нью-Йорк — 44, остальные США — 12, другие страны — 8 (Россия, Германия, Южная Корея, Новая Зеландия) |
| `extra.nonObvious` | 115 | Неочевидные вещи: текст для игрока, почему это неочевидно, ссылка, уровень |
| `extra.eventCatalog` | 38 | События с `realSignal`, условием запуска (`trigger`) и ходом игрока. Уровни: core — 16, deep — 17, exotic — 5 |
| `extra.mechanics` | 10 | Механики, которых нет в формате (раздел 5) |
| `extra.ownerYear` | 3 этапа до открытия + 12 месяцев | Что обязательно происходит, что и когда нужно оплатить или сдать, что идёт не так |
| `extra.gameWalkthrough` | 12 наблюдений | Первый месяц за кафе: что показала игра и чего из жизни в ней нет |
| `extra.topGaps` | 10 | Главные пробелы пакета по важности |
| `extra.corrections` | 7 | Исправления существующих записей (раздел 4) |
| `levers` | 15 | Условия аренды, газ или электричество, резерв, второй ключевой сотрудник, часы владельца, контроль кассы, Wi-Fi, страховые дополнения, музыка, вывеска на тротуаре, кейтеринг, подарочные карты, возвраты, остатки выпечки |
| `shortcuts` | 6 | Зарплата раз в две недели, личный плейлист, скрытая наценка за карту, столики во дворе, работа без воды, порог без пандуса |
| `violations` | 7 | По одному на каждый срезанный угол и на вывеску-штендер |
| `officials` | 3 | Санитарный агент (DSNY), инспектор зданий (DOB), частный истец |
| `reports` | 3 | Жалобы: незаконная посадка, загороженный тротуар, скрытая наценка за карту |
| `ruleCards` | 21 | Карточки правил к новым нарушениям и к главным находкам |
| `events` | 7 | Семь событий в обычном формате пакета, одно из них — исправленное `sidewalk_shed` |
| `setup`, `monthlyCosts` | 3 и 3 | Переносной пандус, консультативная инспекция, бесплатная проверка договора аренды; музыка, замена ушедших работников, списание выпечки |
| `sources` | 159 | Ссылки с 101 сайтов |

Фрагмент, наложенный на `packs/cafe.json`, проходит `node build/validate-pack.mjs` без ошибок и предупреждений.

### Истории закрытия

| № | Заведение | Где | Год | Причина | Ссылка |
|---|---|---|---|---|---|
| 1 | Sippy Cafe | Нью-Йорк: 200 Franklin St, Greenpoint, Brooklyn | 2025 | аренда при продлении | [источник](https://greenpointers.com/2025/08/21/greenpoint-coffee-shop-sippy-cafe-will-close-this-october/) |
| 2 | Connecticut Muffin | Нью-Йорк: Clinton Hill, Brooklyn | 2025 | аренда при продлении | [источник](https://multisite.nycnewsnetwork.com/clintonhill/?p=1349) |
| 3 | Edgar's Cafe | Нью-Йорк: Upper West Side, Manhattan | 2026 | аренда при продлении | [источник](https://www.westsiderag.com/2026/04/02/upper-west-side-cafe-set-to-close-after-38-years-it-breaks-our-hearts) |
| 4 | Cup & Saucer | Нью-Йорк: 89 Canal St, Lower East Side, Manhattan | 2017 | аренда при продлении; налог на недвижимость сверх аренды | [источник](https://www.thelodownny.com/?p=111961) |
| 5 | The Coffee Shop | Нью-Йорк: Union Square West, Manhattan | 2018 | доля аренды в выручке; рост минимальной зарплаты | [источник](https://evgrieve.com/2018/10/the-coffee-shop-closed-on-union-square.html) |
| 6 | Vanka Cafe | Нью-Йорк: Nostrand Ave, Sheepshead Bay, Brooklyn | 2019 | отключение газа; проблема у соседа | [источник](https://www.brooklynpaper.com/two-sheepshead-bay-businesses-closed-for-months-after-nearby-gas-leak) |
| 7 | National Restaurant & Coffee Shop | Нью-Йорк: Norwood, the Bronx | 2023 | отключение газа; ожидание инспекции | [источник](https://www.norwoodnews.org/national-restaurant-coffee-shop-closes-after-43-years/) |
| 8 | Caffe Corretto | Нью-Йорк: East Village, Manhattan | 2024 | состояние здания | [источник](https://evgrieve.com/2024/01/ongoing-building-issues-force-caffe.html) |
| 9 | Four restaurants in one Amsterdam Avenue building | Нью-Йорк: Upper West Side, Manhattan | 2017 | отключение газа; состояние здания | [источник](https://www.westsiderag.com/2017/02/03/four-restaurants-close-because-of-gas-problem-in-amsterdam-avenue-building) |
| 10 | Life Cafe | Нью-Йорк: East 10th St and Avenue B, East Village, Manhattan | 2011 | строительные леса; спор с арендодателем | [источник](https://therealdeal.com/new-york/2011/09/19/famed-ev-eatery-closes-doors-over-landlord-construction-dispute-between-bob-perl-and-abraham-noy/) |
| 11 | The City Bakery | Нью-Йорк: West 18th St, near Union Square, Manhattan | 2019 | долговая спираль; слишком быстрый рост | [источник](https://kottke.org/19/10/what-killed-city-bakery) |
| 12 | Gorilla Coffee | Нью-Йорк: Fifth Ave, Park Slope, Brooklyn | 2010 | уход всей команды; управление | [источник](https://www.brooklynpaper.com/gorilla-warfare-as-entire-staff-quits-fifth-ave-coffee-bar) |
| 13 | Vox Pop | Нью-Йорк: Cortelyou Rd, Ditmas Park, Brooklyn | 2010 | арест за налоги; неоплаченные штрафы; слишком быстрый рост | [источник](https://www.brooklynpaper.com/vox-popped-outlaw-coffeeshop-closed-down-by-taxman-again) |
| 14 | FIKA | Нью-Йорк: Manhattan (chain of espresso bars) | 2018 | слишком быстрый рост; долг по аренде | [источник](https://dailycoffeenews.com/2019/01/23/the-rise-decline-and-section-363-sale-of-the-new-york-coffee-chain-fika) |
| 15 | Cafe Lalo | Нью-Йорк: 201 West 83rd St, Upper West Side, Manhattan | 2020 | спор с арендодателем; протечка | [источник](https://www.westsiderag.com/2024/10/31/cafe-lalo-will-not-reopen-in-its-longtime-uws-home-building-owner) |
| 16 | OCF Coffee House | США: Philadelphia | 2024 | профсоюз | [источник](https://dailycoffeenews.com/2024/06/11/philadelphias-ocf-coffee-closing-all-shops-after-union-push) |
| 17 | The Daily Bird | США: Milwaukee | 2026 | выгорание владельца | [источник](https://urbanmilwaukee.com/?p=1084521) |
| 18 | Kindness + Mischief | США: Highland Park, Los Angeles | 2025 | выгорание владельца | [источник](https://www.baristamagazine.com/los-angeles-kindness-mischief-has-closed-its-doors-but-something-new-is-on-the-horizon/) |
| 19 | Cafe Maggie | США: Tucson | 2024 | медленные убытки; поломка оборудования | [источник](https://tucson.com/life-entertainment/local/food-drink/article_21b69e75-5d55-49b2-9846-c39246a599d7.html) |
| 20 | Buddies Coffee | Нью-Йорк: 150 Grand St, Williamsburg, Brooklyn | 2025 | аренда при продлении; конкурент рядом | [источник](https://secretnyc.co/buddies-coffee-closing-williamsburg/) |
| 21 | Bushwick Public House | Нью-Йорк: Myrtle Ave, Bushwick, Brooklyn | 2025 | аренда при продлении | [источник](https://brooklyn.news12.com/bushwick-public-house-venue-closes-after-landlord-tripled-rent) |
| 22 | Little Skips | Нью-Йорк: Bushwick, Brooklyn | 2020 | аренда при продлении | [источник](https://bushwickdaily.com/news/6197-bushwick-mainstay-and-community-hub-little-skips-is-closing-its-doors-due-to-rent-increase) |
| 23 | Franklin Corner Cafe | Нью-Йорк: 210 Franklin St, Greenpoint, Brooklyn | 2025 | аренду не продлили | [источник](https://greenpointers.com/2025/08/02/franklin-corner-cafe-is-closing-after-17-years) |
| 24 | Stuart Cinema & Cafe and more than 20 neighbors | Нью-Йорк: Greenpoint Ave and West St, Greenpoint, Brooklyn | 2025 | расторжение аренды; здание продано | [источник](https://greenpointers.com/2025/10/24/multiple-greenpoint-businesses-face-closure-threat-after-notorious-landlord-sends-last-minute-lease-terminations) |
| 25 | Jenny on the Greens | Нью-Йорк: Crown Heights, Brooklyn | 2025 | здание продано; аренду не продлили | [источник](https://brooklyn.news12.com/2025/12/10/popular-juice-shop-in-crown-heights-closes-its-doors/1nmkac7r25b71vtq38DmnB) |
| 26 | Cafe Tucum | Нью-Йорк: 210 Patchen Ave, Bed-Stuy, Brooklyn | 2022 | выселение; долг по аренде; невыплаченная зарплата | [источник](https://www.brownstoner.com/brooklyn-life/cafe-tucum-evicted-210-patchen-bed-stuy) |
| 27 | Reconnect Cafe | Нью-Йорк: Bed-Stuy, Brooklyn | 2018 | спор с арендодателем; состояние здания | [источник](https://patch.com/new-york/bed-stuy/priests-cafe-closes-when-nycs-worst-landlords-refuses-repairs) |
| 28 | Dandy Espresso | Нью-Йорк: 1375 Madison Ave at East 96th St, Manhattan | 2014 | не хватило капитала; медленный разгон | [источник](https://www.dnainfo.com/new-york/20140701/upper-east-side/coffee-shop-on-madison-ave-shutters-after-just-5-months) |
| 29 | Park Cafe | Нью-Йорк: 153 Manhattan Ave, Manhattan | 2025 | долг по аренде; аренду не продлили; здоровье владельца | [источник](https://columbianewsservice.com/2025/12/10/the-cafe-must-go-on-the-cingir-brothers-fight-to-save-park-cafe/) |
| 30 | Champion Coffee | Нью-Йорк: Manhattan Ave, Greenpoint, Brooklyn | 2021 | силы владельца; накопленные убытки | [источник](https://greenpointers.com/2021/12/08/champion-coffee-closes-in-greenpoint) |
| 31 | Alpha Donuts | Нью-Йорк: Queens Blvd, Sunnyside, Queens | 2023 | отложенный ремонт; рост цен | [источник](https://queenspost.com/sunnyside-staple-alpha-donuts-abruptly-closes-after-nearly-50-years) |
| 32 | Brooklyn Roasting Company (cafes) | Нью-Йорк: Dumbo and Flatiron | 2020 | долговая спираль; слишком быстрый рост | [источник](https://dailycoffeenews.com/2020/10/23/brooklyn-roasting-company-files-for-chapter-11-bankruptcy) |
| 33 | Second Avenue merchants during subway construction | Нью-Йорк: Second Ave, 63rd-96th St, Manhattan | 2010 | стройка на улице | [источник](https://therealdeal.com/2010/08/24/second-avenue-merchants-subway-construction-cutting-business-by-up-to-40/) |
| 34 | Poco | Нью-Йорк: Avenue B and East 3rd St, East Village, Manhattan | 2025 | решение владельца | [источник](https://evgrieve.com/search/label/closings%202025) |
| 35 | Boris & Horton | Нью-Йорк: Avenue A, East Village, and Williamsburg | 2024 | дорогой формат; медленные убытки; сбор денег | [источник](https://www.westsidespirit.com/home/boris-horton-dog-cafe-in-east-village-goes-belly-up-are-talks-afoot-with-new-owner-HA3983108) |
| 36 | Walter's Coffee | Нью-Йорк: 65 Irving Ave, Bushwick, Brooklyn | 2018 | спор партнёров; учёт | [источник](https://bushwickdaily.com/?p=17425) |
| 37 | The Coffee Shop | Нью-Йорк: 203 Wilson Ave, Bushwick, Brooklyn | 2015 | скандал; соцсети | [источник](https://www.dnainfo.com/new-york/20150107/bushwick/coffee-shop-where-owner-called-jews-greedy-closes) |
| 38 | Upperz Cafe and Bar | Нью-Йорк: 319 East 14th St, East Village, Manhattan | 2025 | не хватило капитала; дорогой формат | [источник](https://www.yahoo.com/news/york-city-cafe-bar-closes-191257939.html) |
| 39 | Pakistan Tea House | Нью-Йорк: Tribeca, Manhattan | 2015 | отключение газа; нарушения на здании | [источник](https://tribecacitizen.com/?p=109936) |
| 40 | A Brooklyn restaurant that could not get gas | Нью-Йорк: Brooklyn | 2019 | отказ в подключении газа; месяцы аренды до открытия | [источник](https://bklyner.com/no-new-gas-national-grid-holds-brooklyn-restaurants-hostage) |
| 41 | Hurley's Steakhouse & Pub | Нью-Йорк: Manhattan | 2019 | merchant cash advance; долговая спираль | [источник](https://www.nycourts.gov/reporter/pdfs/2020/2020_30413.pdf) |
| 42 | Good Karma Cafe | США: Philadelphia | 2023 | кража сотрудником; профсоюз | [источник](https://billypenn.com/2023/01/11/good-karma-cafe-closes-wash-west-theft-embezzlement/) |
| 43 | A cafe in Alexandra | мир: Central Otago, New Zealand | 2020 | кража сотрудником; купленный бизнес | [источник](https://www.odt.co.nz/regions/central-otago/theft-lockdown-lead-cafe-owners-close-business) |
| 44 | Swim Cafe | США: 1357 W. Chicago Ave, Chicago | 2014 | здоровье владельца | [источник](https://www.dnainfo.com/chicago/20140103/west-town/swim-cafe-closes-as-owner-battles-cancer-looks-for-someone-take-over) |
| 45 | A Little Moore Cafe | США: Leucadia, California | 2014 | спор партнёров | [источник](https://thecoastnews.com/a-little-moore-friction-between-owners-closes-leucadia-cafe/) |
| 46 | Milk Street Cafe | Нью-Йорк: 40 Wall St, Manhattan | 2011 | перекрытие улицы; городское событие | [источник](https://www.dnainfo.com/new-york/20111213/downtown/milk-street-cafe-closing-thursday-after-struggle-with-nypd-barricades) |
| 47 | A cafe that could not open | Нью-Йорк: 75 Second Ave, East Village, Manhattan | 2022 | задержка разрешений; исторический район; месяцы аренды до открытия | [источник](https://evgrieve.com/2022/04/owner-citys-bureaucratic-red-tape.html) |
| 48 | Yaffa Cafe | Нью-Йорк: St. Marks Place, East Village, Manhattan | 2014 | жалоба соседа; незаконное помещение; закрытие санинспекцией | [источник](https://www.dnainfo.com/new-york/20141006/east-village/city-waited-3-decades-rule-yaffa-cafes-back-patio-illegal-manager-says) |
| 49 | Little Lions | Нью-Йорк: SoHo, Manhattan | 2018 | закрытие санинспекцией; дорогой формат | [источник](https://manhattan.institute/article/the-citys-war-on-small-business-slams-cat-cafes) |
| 50 | The Mermaid Inn | Нью-Йорк: 570 Amsterdam Ave, Upper West Side, Manhattan | 2022 | строительные леса | [источник](https://www.westsiderag.com/2022/09/27/the-mermaid-inn-closing-current-spot-but-plans-to-reopen-in-neighborhood) |
| 51 | Ocean Grill | Нью-Йорк: 384 Columbus Ave, Upper West Side, Manhattan | 2015 | строительные леса; спор с арендодателем | [источник](https://www.dnainfo.com/new-york/20151221/upper-west-side/ocean-grill-suing-landlord-for-63m-claiming-construction-led-closure) |
| 52 | The Wydown | США: Washington, DC | 2024 | профсоюз; решение владельца | [источник](https://washingtonian.com/2024/05/15/the-wydown-abruptly-shuts-down-dc-coffee-shops-amid-unionization-fight/) |
| 53 | Outset Coffee | США: San Francisco | 2026 | долг по аренде; выселение; слишком быстрый рост | [источник](https://dailycoffeenews.com/2026/10/30/popular-san-francisco-coffee-company-closes-both-cafes-after-landlord-disputes/) |
| 54 | A coffee shop with a small bookshop | мир: Russia | 2021 | формат не тот; не хватило капитала; кредит | [источник](https://t-j.ru/kofe-i-knigi/) |
| 55 | 93 Degrees coffee corner | мир: Krasnaya Presnya, Moscow | 2019 | неудачное место; проблема у соседа; раздутые расходы | [источник](https://t-j.ru/93gradusa/) |
| 56 | A coffee corner planned on a neighbor's traffic | мир: Russia | 2022 | ошибка в прогнозе спроса | [источник](https://t-j.ru/list/biz-fails-2022/) |
| 57 | Schlosscafe Schillingsfuerst | мир: Franconia, Germany | 2024 | нехватка персонала | [источник](https://www.infranken.de/lk/ansbach/gastronomie/schillingsfuerst-schlosscafe-muss-nach-fast-29-jahren-schliessen-trotz-zahlreicher-kunden-art-5837450) |
| 58 | Niu Asian Cafe | мир: Nuremberg, Germany | 2025 | аренда при продлении; нехватка персонала | [источник](https://www.infranken.de/lk/nuernberg/gastronomie/nuernberger-cafe-geschlossen-niu-asian-cafe-schliessung-andrang-schlange-art-6324224,PRINT) |
| 59 | NY Bagel Cafe & Deli franchisees | США: Pennsylvania, Virginia, Maryland (franchisor based in New York) | 2020 | франшиза; ошибка в прогнозе спроса; кредит | [источник](https://www.marylandattorneygeneral.gov/Securities%20Actions/2020/SMSFranchise_summary_cd_final_100520.pdf) |
| 60 | A Tim Hortons franchisee | США: Rochester, New York | 2017 | франшиза; спор с франчайзером | [источник](https://law.com/thelegalintelligencer/2017/10/26/no-more-mr-nice-guy-when-it-comes-to-franchisee-says-the-court) |
| 61 | A Roasting Plant franchisee | США: Ann Arbor, Michigan (franchisor based in New York City) | 2016 | франшиза; спор с франчайзером | [источник](https://annarborobserver.com/roasting-plant-closes/) |
| 62 | Singer Hanhae's cafe | мир: Seoul, South Korea | 2026 | доля аренды в выручке; не хватило капитала | [источник](https://www.koreatimes.co.kr/entertainment/20261006/celebrities-who-tried-opening-cafes-in-korea-say-think-twice) |
| 63 | A celebrity couple's cafe on Jeju | мир: Jeju, South Korea | 2024 | решение владельца; медленные убытки | [источник](https://www.koreatimes.co.kr/entertainment/20261006/celebrities-who-tried-opening-cafes-in-korea-say-think-twice) |
| 64 | Hekate Cafe & Elixir Lounge | Нью-Йорк: East Village, Manhattan | 2026 | конкурент рядом; формат скопировали | [источник](https://evgrieve.com/search/label/closings%202026) |

Причины по числу историй: аренда при продлении — 8, слишком быстрый рост — 5, отключение газа — 4, спор с арендодателем — 4, долг по аренде — 4, не хватило капитала — 4, состояние здания — 3, строительные леса — 3, долговая спираль — 3, профсоюз — 3, медленные убытки — 3, аренду не продлили — 3, решение владельца — 3, дорогой формат — 3.

### Год владельца по месяцам

Полная версия — в `extra.ownerYear`: для каждого месяца списки «происходит всегда», «срок оплаты или сдачи», «что идёт не так» и события. Коротко:

- **Январь.** Самый слабый месяц года. 1 января растёт минимальная зарплата и обновляется запас неоплачиваемых часов отпуска по болезни. Снег: тротуар нужно расчистить за 4 часа после окончания снегопада днём. 31 января — квартальные отчёты по зарплате и формы W-2. Грипп, гости с ноутбуками, звонки с предложением быстрых денег.
- **Февраль.** Первый полный месяц зарплат показывает настоящую долю труда. В любой день может прийти санитарная инспекция; до первой оценочной проверки можно заказать консультативную за $100. Интерес к открытию спадает. 28 февраля кончается квартал налога с продаж.
- **Март.** 15 марта — сбор штата с LLC. 20 марта — первая декларация по налогу с продаж; кто потратил собранный налог в феврале, платит из своих. Первый вызов мастера по оборудованию.
- **Апрель.** Начало сезона уличной посадки для тех, у кого есть лицензия. Кондиционер нужно обслужить до жары. 15 апреля — личная налоговая декларация владельца, 30 апреля — отчёты по зарплате за квартал. Увольняется первый нанятый в январе.
- **Май.** Холодные напитки переходят за половину заказов: нужно больше льда и пластиковых стаканов, бар работает медленнее. Выходит итоговая оценка недвижимости — видно, какой будет доплата за налог на здание.
- **Июнь.** 20 июня — налог с продаж и годовая декларация Commercial Rent Tax (Манхэттен ниже 96-й улицы, аренда от $250 000 в год). В конце месяца кончается учебный год. Чемпионат мира (11 июня — 19 июля 2026): эффект только рядом с фан-зонами.
- **Июль.** Самый жаркий месяц и самая дорогая электроэнергия. Арендодатель выставляет счёт за рост налога на недвижимость. Отключения электричества в жару: молоко и выпечка выше 41°F дольше четырёх часов списываются. 31 июля — отчёты по зарплате.
- **Август.** Самый тихий летний месяц. К этому времени стартовые деньги кончаются, а безубыточности ещё нет: на 5–6-й месяц закрылись Dandy Espresso и Upperz. Первая оценочная инспекция обычно уже прошла. Ливни затапливают подвалы.
- **Сентябрь.** Возвращаются школы и офисы — лучшие утра с открытия. 20 сентября — налог с продаж. Бариста, нанятый к открытию, дорабатывает до среднего срока (8–14 месяцев) и уходит. Конкурент, который строился летом, открывается.
- **Октябрь.** До 1 октября штат объявляет минимальную зарплату на следующий год. Начало отопительного сезона. 31 октября — отчёты по зарплате. Девять месяцев без выходных: владелец выгорает. С холодом в помещение идут мыши.
- **Ноябрь.** Марафон 1 ноября 2026: кварталы на трассе закрыты для машин. Неделя Дня благодарения пустая в офисных районах. Начало продажи подарочных карт. Перед зимой здания ставят леса. Первый снег.
- **Декабрь.** Лучший месяц по выручке, но последние десять дней в офисных районах мёртвые. 20 декабря — налог с продаж. Подарочные карты, проданные сейчас, — это напитки, которые придётся отдать в январе. Годовщина страховок и разрешений; впереди аудит страховки работников.

До открытия (три этапа в `extra.ownerYear.preOpening`): идея и деньги; договор аренды; ремонт без выручки. Главные ловушки: бюджет занижен примерно на две трети, исторический район добавляет ещё одно ведомство, оборудование куплено до утверждения плана, из всех расходов до открытия в первый год списывается только $5 000.

### Игра: первый месяц за кафе

Как проверял: сервер запущен из исходников, создан отдельный демо-город, один владелец открыл кафе по рекомендованному набору Standard на первом свободном адресе (1st Ave & E 1st St, 2 280 кв. футов) и сразу нажал «открыться»; город шёл 41 игровой день.

Что показала игра за первый месяц: спрос 10 221 заказ, обслужено 6 515 (остальные потеряны из-за нехватки рук: я запустил кафе с тремя бариста вместо рекомендованных четырёх), выручка $55 378, аренда $22 610, убыток $3 827. На 31-й день по жалобе пришла проверка: штраф $1 400 и 5 дней закрытия за работу без разрешения и без сертификата.

| № | Чего нет в игре | Что видно в игре | Как в жизни |
|---|---|---|---|
| 1 | Разгона после открытия | Полный спрос с первого дня: 341 заказ в день у кафе, о котором никто не знает | Новое кафе набирает гостей месяцами; закрытия на 5–6-й месяц |
| 2 | Времени на ремонт | Ремонт на $70 000, оборудование и наём готовы мгновенно | От двух до шести месяцев аренды без выручки; известен случай в одиннадцать месяцев |
| 3 | Наказания, соразмерного выгоде | 30 дней без разрешения дали $55 378 выручки при штрафе $1 400 | Заведение без разрешения закрывают при первом визите |
| 4 | Жизни работников | Наём мгновенный, никто не увольняется и не опаздывает | Средний срок работы бариста 8–14 месяцев; уход всей команды; болезнь единственного держателя сертификата |
| 5 | Владельца | Нет ни зарплаты владельца, ни его часов, ни усталости | Средний доход владельца выжившей кофейни $48 234 в год; выгорание закрывает прибыльные кафе |
| 6 | Договора аренды | Аренда — месячная цена; игра дала снять 2 280 кв. футов под 18 мест | Продление в 2–3 раза дороже, продажа здания, доплата за налог, расторжение за месяц |
| 7 | Поломок и порчи | Обслуживание — ровные $290 в месяц | Первый крупный ремонт убивает кафе без резерва; отключение электричества в жару |
| 8 | Января | Прогноз «солнечно, 43°F», поток ×1,0 каждый день | Худший месяц года: снег, грипп, рост зарплаты, сроки налогов |
| 9 | Разницы между выручкой и деньгами | Собранный налог с продаж лежит в общей кассе как свои деньги | Владельцы тратят налог в плохой месяц; платёжный сервис задерживает выплаты |
| 10 | Исков и соседей | Нападает только другой игрок жалобой в 311 | Иски о доступности, письма о лицензии на музыку, жалоба соседа на двор |
| 11 | — (интерфейс) | 16 одинаковых предложений совместной закупки от трёх ИИ-кафе за 30 дней | Уведомление о нарушении теряется среди них |
| 12 | — (текст совета) | «Поднимите цену: потеряете 0% заказов» | Верно, только пока кафе упирается в мощность; новичок прочтёт как «цена не важна» |

Проверял основную ветку до слияния `claude/keen-cray-yytcbp`. Та ветка уже закрывает первые два пункта (разгон с 35% и дни ремонта); остальное остаётся.

### Десять главных пробелов пакета

| № | Пробел | Почему важен | Чем закрывается во фрагменте |
|---|---|---|---|
| 1 | Аренда без срока, условий и арендодателя | 21 из 64 историй. В пакете одно число — месячная аренда | `lease_terms`, механика `lease_clock`, события `lease_renewal_offer`, `building_sold`, `tax_escalation_bill` |
| 2 | Месяцы до первой продажи и медленный разгон после | Кафе умирают на 5–8-й месяц, когда кончаются стартовые деньги, или не открываются вовсе | ветка keen-cray; механика `closed_but_paying` |
| 3 | Закрытия не от инспектора | Газ (до 8 месяцев), вода, уход команды, арест за налоги — аренда при этом идёт | `gas_red_tag`, `water_off`, `staff_walkout`, `sales_tax_warrant`, рычаг `kitchen_energy` |
| 4 | Работники как число | Нет текучки, ключевого сотрудника, владельца | `key_barista_leaves`, `cross_training`, `staff_replacement`, механика `owner_hours` |
| 5 | Нет резерва и разовых счетов | Все расходы в пакете — ровные месячные строки; убивает разовый счёт | механика `reserve_fund`, рычаги `cash_reserve`, `insurance_endorsements` |
| 6 | Долги и быстрые деньги | City Bakery, Brooklyn Roasting, FIKA, Vox Pop умерли от долгов при полных залах | механика `financing`, событие `cash_advance_offer` |
| 7 | Улица за дверью | Одно событие (леса на 3 месяца). Средний возраст лесов — 557 дней | исправленный `sidewalk_shed`, `street_dig`, `barricades`, `chain_opens_next_door`, `coffee_carts_2027` |
| 8 | Календарь | Нет января, сроков на экране, ежегодного роста зарплаты | `extra.ownerYear`, механика `compliance_calendar`, `january_trough`, `wage_step_january` |
| 9 | Иски частных лиц | Доступность, музыка, частота выплаты зарплаты — это не проверки | механика `private_claims`, `access_claim`, `music_letter`, `pay_frequency_claim` |
| 10 | Как выглядит смерть | Банкрот видит «касса ниже нуля» | механика `autopsy` и истории с метками причин |

## 3. Пятнадцать самых неочевидных находок

1. **У арендатора нет права на продление и нет потолка новой ставки.** В 2025 году бруклинским кафе предлагали аренду в два-три раза выше прежней; кафе с 17, 22 и 38 годами работы закрылись на продлении. ([источник](https://greenpointers.com/2025/08/21/greenpoint-coffee-shop-sippy-cafe-will-close-this-october/))
2. **Газ возвращают месяцами.** После отключения газа в здании нужны лицензированный сантехник, разрешение Департамента зданий, испытание давлением и инспекция. Кафе в Бруклине простояло больше восьми месяцев из-за ремонта трубы на $3 000 — и утечка была у соседа. ([источник](https://www.brooklynpaper.com/two-sheepshead-bay-businesses-closed-for-months-after-nearby-gas-leak))
3. **Опасен не первый год.** Исследование 81 000 независимых ресторанов: в первый год закрываются 17%, а не 90%. За три года — 59% (Огайо). Кафе умирают, когда кончились стартовые деньги, а аренда ещё идёт. ([источник](https://news.osu.edu/restaurant-failure-rate-much-lower-than-commonly-assumed-study-finds/))
4. **Работникам физического труда в Нью-Йорке платят раз в неделю.** Выплата раз в две недели — настройка зарплатных сервисов по умолчанию — нарушение. После поправки 2025 года первый раз грозит только процентами, повторный — удвоением задержанной суммы. ([источник](https://www.mayerbrown.com/en/insights/publications/2025/07/new-york-amends-labor-law-to-limit-damages-for-late-payments-to-manual-workers))
5. **За неуплаченный налог с продаж штат не судится, а меняет замки.** Кафе Vox Pop опечатывали дважды из-за $66 000; имущество продали с аукциона. Долг переходит к новому владельцу бизнеса. ([источник](https://www.brooklynpaper.com/vox-popped-outlaw-coffeeshop-closed-down-by-taxman-again))
6. **Покупатель готового кафе может унаследовать налоговый долг продавца.** Защита — форма AU-196.10 не позже чем за 10 дней до оплаты или вступления во владение. ([источник](https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/bulk_sales.htm))
7. **Merchant cash advance возвращают из выручки, а не из прибыли.** В судебном деле — 35% карточной выручки ресторана каждый будний день, пока не набралось $145 000. ([источник](https://www.nycourts.gov/reporter/pdfs/2020/2020_30413.pdf))
8. **Леса стоят в среднем полтора года.** В мае 2025 года в городе было 8 559 навесов со средним возрастом 509 дней, в марте 2026-го — 557 дней. Ставит их здание, скидки по аренде договор не даёт. ([источник](https://www.westsiderag.com/2026/04/23/uws-shed-watch-a-new-monthly-column-from-west-side-rag))
9. **Обычная страховка не покрывает отключение электричества за пределами помещения.** Потерянная выручка и испорченное молоко оплачиваются только с дополнением utility services и покрытием порчи, обычно в пределах $2 500–25 000. ([источник](https://roughnotes.com/utility-services-coverage-often-overlooked-endorsement/))
10. **Расходы до открытия не списываются в первый год.** Сразу — $5 000 (а при расходах выше $55 000 — ничего), остальное равными частями за 180 месяцев. Аренда за месяцы ремонта сюда входит. ([источник](https://www.everycrsreport.com/files/2025-04-16_IF12970_089de047373b3b37f31f7c8b286333da57803926.html))
11. **Личный Spotify в зале — нарушение авторских прав.** Нужны лицензии ASCAP, BMI, SESAC и GMR или деловой музыкальный сервис. Предел компенсации за умышленное нарушение — $150 000 за произведение. ([источник](https://fordhamiplj.org/2018/11/21/royalties-unpaid-small-businesses-unknowingly-break-the-law/))
12. **Одна ступенька у входа — готовый федеральный иск.** Нью-Йорк — центр серийных исков о доступности; одна фирма подала около 600. Кофейни названы среди частых целей. ([источник](https://www.mondaq.com/unitedstates/discrimination-disability-sexual-harassment/1763220/ada-lawsuits-against-coffee-shops-and-breweries-on-the-rise-how-small-businesses-can-avoid-costly-accessibility-claims-about-architectural-barriers-and-websites))
13. **Сбор денег и вирусное видео покупают недели, а не аренду.** Boris & Horton собрало $250 000 в феврале 2024-го и осталось без денег к концу года; видео Buddies Coffee набрало 7 миллионов просмотров, кафе закрылось через три месяца. ([источник](https://secretnyc.co/buddies-coffee-closing-williamsburg/))
14. **С 2027 года минимальная зарплата растёт каждый январь по инфляции, а город выдаёт тысячи новых лицензий уличным торговцам.** Индекс — трёхлетнее среднее CPI-W по Северо-Востоку, объявление до 1 октября. В 2027 году — 10 700 новых лицензий на торговлю и по 2 200 лицензий на тележки с едой ежегодно до 2031-го. ([источник](https://www.ny.gov/programs/minimum-wage))
15. **Штрафы санитарной инспекции можно обнулить, а первую проверку — отрепетировать.** Меньше 14 баллов на повторной проверке — штрафы той проверки снимаются. Консультативная инспекция до первой оценочной стоит $100, без оценки и без штрафов. ([источник](https://www.nyc.gov/assets/oath/downloads/pdf/Small-Business-DOHMH.pdf))

## 4. Исправления существующего пакета

| Запись | Было | Стало | Почему |
|---|---|---|---|
| `events.sidewalk_shed` | длительность 3 месяца | 12 месяцев (предел сезона) | Исправляю, потому что средний возраст навеса в городе — 509 дней в мае 2025-го и 557 дней в марте 2026-го. Три месяца учат неверному. ([источник](https://www.westsiderag.com/2026/04/23/uws-shed-watch-a-new-monthly-column-from-west-side-rag)) |
| `setup.sidewalk_cafe_license` | цена $2 550, уличная посадка на проезжей части сезонная | проверить: по результатам поиска лицензия стоит $1 050 на четыре года (тротуар или проезжая часть), $2 100 за оба; закон о круглогодичной посадке подписан в сентябре 2026-го | Не исправляю значение, а передаю D12: открыть сайт Dining Out NYC я не мог. В пакете сумма может включать депозит и сбор за согласование. ([источник](https://www.aiany.org/news/mamdani-enacts-year-round-outdoor-dining-program/)) |
| `events.flu_season` | у события нет хода игрока | добавлено событие `flu_takes_the_only_supervisor` и рычаг `cross_training` | Исправляю, потому что событие без выбора — это кубик: теперь кафе с единственным держателем сертификата закрывается на 5 дней, а второй сертификат от этого защищает. ([источник](https://www.nyc.gov/site/doh/business/health-academy/food-protection-online-free.page)) |
| `monthlyCosts.sick_leave_cover` | учитывает 40 оплачиваемых часов | сумма та же; в примечание добавить 32 неоплачиваемых часа и 20 часов оплачиваемого дородового отпуска | Исправляю, потому что с 22 февраля 2026 года правила изменились для всех работодателей города. Денег это не стоит, но снимает 1,9% рабочего времени. ([источник](https://www.mayerbrown.com/en/insights/publications/2026/07/new-york-city-adopts-amended-sick-and-safe-leave-rules)) |
| `_common`: источник о минимальной зарплате | «$17.00, без изменений на 2027 год» | с 1 января 2027 года ставка индексируется; добавлена карточка `wage_index_2027` | Исправляю, потому что закон штата вводит ежегодную индексацию с 2027 года. Саму ставку на 2027 год найти не удалось. ([источник](https://www.ny.gov/programs/minimum-wage)) |
| `events.coffee_price_spike` | только рост на 20% | добавлено зеркальное событие `coffee_price_slide` | Исправляю, потому что арабика упала с примерно $4,23 за фунт (ноябрь 2025-го) до примерно $2,80 (ноябрь 2026-го): игровой 2026 год правдивее начинать со снижения. ([источник](https://tradingeconomics.com/commodity/coffee/news/599144)) |
| `violations.no_fse_permit` | штраф $1 000, закрытие на 5 дней, находят по жалобе или плановой проверке раз в полгода | штраф тот же; закрытие — до готовности разрешения; первая проверка — в первые 30 дней после открытия | Исправляю, потому что в игре работать без разрешения выгодно ($55 378 выручки против $1 400 штрафа). Размер штрафа не трогаю — меняется правило движка, это просьба к ведущему. ([источник](https://nyc-business.nyc.gov/nycbusiness/description/food-service-establishment-permit)) |

Записью с тем же `id` во фрагменте заменено только `events.sidewalk_shed`. Остальные исправления описаны в `extra.corrections`, чтобы сборщик не затёр проверенные числа пакета моими оценками.

## 5. Просьбы к ведущему — новые механики

По важности. Полное описание каждой — в `extra.mechanics`: решение игрока, расчёт движка, нужные поля, числа с источниками.

| № | Механика | Уровень | Суть |
|---|---|---|---|
| 1 | `closed_but_paying` — Закрыто, а аренда идёт | core | Закрывать бизнес может не только проверка, но и событие или собственное решение игрока: газ, вода, уход команды, арест за налоги. Нужно поле закрытия у события и причина закрытия у бизнеса. |
| 2 | `lease_clock` — У аренды есть дата окончания | core | Срок, опция продления, индексация, гарантия. За полгода до конца приходит письмо с новой ставкой. В сезоне из 12 месяцев работает для тех, кто взял «хвост» чужого договора, и печатается в личном плане. |
| 3 | `reserve_fund` — Резерв и разовые счета | core | Событию нужен эффект в долларах, а не только множитель: ремонт, аудит, доплата за налог, мировое соглашение. Счёт сначала гасится из резерва. |
| 4 | `owner_hours` — Владелец тоже работник | core | Смены владельца экономят зарплату и копят усталость; через девять месяцев без выходных — событие выгорания. В аналитике — прибыль после честной зарплаты владельцу. |
| 5 | `private_claims` — Частные иски | core | Третий канал рядом с проверками и аудитом: доступность, музыка, частота выплат. Срок обнаружения фиксированный, случая нет. Госслужащие-игроки этим не занимаются. |
| 6 | `financing` — Быстрые деньги | core | Аванс под долю ежедневной карточной выручки. Удержание идёт строкой долга и не ставится на паузу. |
| 7 | `autopsy` — Вскрытие | core | При банкротстве и в конце сезона движок называет две главные причины в долларах и показывает настоящую историю с той же меткой причины. |
| 8 | `compliance_calendar` — Календарь сроков | core | На экране «Сегодня» — три ближайших срока с суммами. Данные — в `extra.ownerYear`. За своевременную декларацию по налогу с продаж — зачёт 5%, до $200 за квартал. |
| 9 | `cash_timing` — Выручка — не деньги | deep | Подарочные карты, счета за кейтеринг, задержка выплат платёжным сервисом после резкого роста продаж. |
| 10 | `rescue_campaign` — Сбор денег | exotic | Один раз на бизнес. Даёт деньги и очередь на месяц; аренду и долги не меняет; при закрытии в течение полугода бьёт по счёту надёжности. |

Что ещё не выражает формат:

- **Эффекты событий.** В каталоге используются поля вне списка `EffectTarget`: `closureDays`, `closureMonths`, `oneOffCost`, `oneOffCostPctPayroll`, `seatTurnover`, `seats`, `quality`, `reputation`, `holdbackPctCardSales`, `payoutDelayPct`, `cashShiftPctDecemberRevenue`, `cashLossPctRevenue`, `oneOffIncomeMonthsOfRevenue`. Каждое описано в примечании к событию.
- **Условие запуска.** У каждого события есть поле `trigger`: `calendar` (дата), `announced` (объявляет ведущий, действует на всех в зоне) или `decision` (следует из решения игрока через N месяцев). Вероятностей нет.
- **Рычаги.** У вариантов появились необязательные поля `exposesTo` (к какому событию вариант делает уязвимым), `setupCost`, `phase: "setup"` (выбирается один раз при открытии) и отрицательный `monthlyCost` (экономия или доход).
- **Ходы игрока.** В `playerMoves` кроме `lever` и `shortcut` встречаются `mechanic`, `deal`, `setup`, `spend`.
- **Частный истец** записан в `officials` с ролью `inspector` только ради прохождения проверки ссылок. Играть за него нельзя; нужен отдельный канал (механика `private_claims`).
- **Место.** Нужны признаки адреса: ступенька у входа, исторический район, газ в здании, срок до конца действующей аренды.
- **Мелочи интерфейса из прохождения:** ограничить предложения сделок от ИИ одним на соседа в месяц; переписать совет о цене; показывать на главном экране деньги за вычетом собранного налога с продаж.

## 6. Не найдено и ограничения

**Главное ограничение.** Сетевая политика этой сессии запрещает любые исходящие соединения: страницы не открывались ни через WebFetch, ни через curl (прокси отвечал 403). Работал только веб-поиск. Поэтому каждое число здесь увидено в сводке результатов поиска по указанной странице, а не на самой странице, и у всех чисел стоит `estimate` — даже там, где источник первичный (nyc.gov, tax.ny.gov, dol.ny.gov, судебные акты). Это честнее, чем ставить `verified`. Для D12: записи, где в примечании написано «NOT found», — заглушки.

Чтобы числа можно было перепроверить, в настройках окружения нужно разрешить доступ в сеть (или хотя бы хосты nyc.gov, tax.ny.gov, dol.ny.gov, diningoutnyc.info, codelibrary.amlegal.com).

- Минимальная зарплата Нью-Йорка на 2027 год (штат должен был объявить до 1 октября 2026-го).
- Действующий штраф за использование помещения вопреки Certificate of Occupancy (§28-118.3.2): нашлась только старая таблица. В пакете стоит заглушка $1 250.
- Сумма штрафа и баллы за работу без горячей и холодной воды в приложении 23-C. В пакете стоит заглушка $400.
- Действующий штраф Департамента санитарии за штендер на тротуаре: только цифры 2015 года ($100–300).
- Измеренный помесячный индекс продаж независимых кофеен (данные Square или Toast): есть только данные по Starbucks и отраслевые комментарии.
- Измеренная кривая роста продаж нового кафе за первый год.
- Время пребывания и оборот мест у гостей с ноутбуками.
- Надёжные суммы мировых соглашений по искам о физической доступности к нью-йоркским заведениям.
- Формула депозита Con Edison для нового коммерческого счёта.
- Прожиточный бюджет семьи в Манхэттене по калькулятору MIT (нужен для механики «домохозяйство владельца»).
- Полный срок коммерческого выселения за неуплату в месяцах.
- Цена страховых дополнений (utility interruption, spoilage) для маленького кафе.
- Нью-йоркское кафе, которое закрылось насовсем после закрытия санинспекцией, со словами владельца (находились только случаи повторного открытия).
- Закрытие нью-йоркского кафе из-за иска о зарплате и из-за серии краж со взломом (нашлись только случаи вне Нью-Йорка).
- Актуальна ли цена лицензии Dining Out NYC в пакете ($2 550) после закона о круглогодичной посадке.

Что не сделано из задания: игра пройдена через HTTP-интерфейс сервера, а не через экран клиента (сборка клиента не запускалась). Все цифры прохождения — из ответов сервера.

## 7. Источники

Всего 159 ссылок; полный список с указанием, для каких записей использована каждая, — в поле `sources` фрагмента. Все увидены 14 ноября 2026 года в результатах веб-поиска. Ниже — по сайтам.

- **nyc.gov** (12): [1](https://www.nyc.gov/assets/oath/downloads/pdf/Small-Business-DOHMH.pdf), [2](https://www.nyc.gov/assets/doh/downloads/pdf/permit/consultative-inspections.pdf), [3](https://www.nyc.gov/site/dsny/businesses/setup-operations/setout.page), [4](https://www.nyc.gov/site/dsny/businesses/rules-reporting/cleaning-rules-businesses.page), [5](https://www.nyc.gov/site/dsny/what-we-do/snow-response/snow-laws.page), [6](https://www.nyc.gov/site/buildings/safety/sign.page), [7](https://www.nyc.gov/site/dsny/businesses/materials-handling/utensils-condiments-napkins.page), [8](https://www.nyc.gov/assets/fdny/downloads/pdf/business/cof-g82-noe-study-materials.pdf), [9](https://www.nyc.gov/site/doh/business/health-academy/food-protection-online-free.page), [10](https://www.nyc.gov/assets/doh/downloads/pdf/environmental/fse-application-packet.pdf), [11](https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf), [12](https://www.nyc.gov/assets/doh/downloads/pdf/about/healthcode/health-code-chapter23.pdf)
- **dnainfo.com** (6): [1](https://www.dnainfo.com/new-york/20140701/upper-east-side/coffee-shop-on-madison-ave-shutters-after-just-5-months), [2](https://www.dnainfo.com/new-york/20150107/bushwick/coffee-shop-where-owner-called-jews-greedy-closes), [3](https://www.dnainfo.com/chicago/20140103/west-town/swim-cafe-closes-as-owner-battles-cancer-looks-for-someone-take-over), [4](https://www.dnainfo.com/new-york/20111213/downtown/milk-street-cafe-closing-thursday-after-struggle-with-nypd-barricades), [5](https://www.dnainfo.com/new-york/20141006/east-village/city-waited-3-decades-rule-yaffa-cafes-back-patio-illegal-manager-says), [6](https://www.dnainfo.com/new-york/20151221/upper-west-side/ocean-grill-suing-landlord-for-63m-claiming-construction-led-closure)
- **evgrieve.com** (6): [1](https://evgrieve.com/2018/10/the-coffee-shop-closed-on-union-square.html), [2](https://evgrieve.com/2024/01/ongoing-building-issues-force-caffe.html), [3](https://evgrieve.com/2025/07/buddies-coffee-forced-out-of.html), [4](https://evgrieve.com/search/label/closings%202025), [5](https://evgrieve.com/2022/04/owner-citys-bureaucratic-red-tape.html), [6](https://evgrieve.com/search/label/closings%202026)
- **brooklynpaper.com** (5): [1](https://www.brooklynpaper.com/two-sheepshead-bay-businesses-closed-for-months-after-nearby-gas-leak), [2](https://www.brooklynpaper.com/gorilla-warfare-as-entire-staff-quits-fifth-ave-coffee-bar), [3](https://www.brooklynpaper.com/vox-popped-outlaw-coffeeshop-closed-down-by-taxman-again), [4](https://www.brooklynpaper.com/brooklyn-roasting-company-files-bankruptcy-plans-to-close-two-remaining-cafe-locations), [5](https://www.brooklynpaper.com/boris-horton-dog-cafe-williamsburg-closure)
- **westsiderag.com** (5): [1](https://www.westsiderag.com/2026/04/02/upper-west-side-cafe-set-to-close-after-38-years-it-breaks-our-hearts), [2](https://www.westsiderag.com/2017/02/03/four-restaurants-close-because-of-gas-problem-in-amsterdam-avenue-building), [3](https://www.westsiderag.com/2024/10/31/cafe-lalo-will-not-reopen-in-its-longtime-uws-home-building-owner), [4](https://www.westsiderag.com/2022/09/27/the-mermaid-inn-closing-current-spot-but-plans-to-reopen-in-neighborhood), [5](https://www.westsiderag.com/2026/04/23/uws-shed-watch-a-new-monthly-column-from-west-side-rag)
- **brooklyn.news12.com** (4): [1](https://brooklyn.news12.com/bushwick-public-house-venue-closes-after-landlord-tripled-rent), [2](https://brooklyn.news12.com/2025/10/29/over-20-greenpoint-businesses-given-last-minute-lease-termination/6RVH66SjcKhEkTZIzqTXr5), [3](https://brooklyn.news12.com/2025/12/10/popular-juice-shop-in-crown-heights-closes-its-doors/1nmkac7r25b71vtq38DmnB), [4](https://brooklyn.news12.com/prospect-lefferts-gardens-restaurant-unable-to-open-due-to-national-grid-standoff-40948244)
- **dailycoffeenews.com** (4): [1](https://dailycoffeenews.com/2019/01/23/the-rise-decline-and-section-363-sale-of-the-new-york-coffee-chain-fika), [2](https://dailycoffeenews.com/2024/06/11/philadelphias-ocf-coffee-closing-all-shops-after-union-push), [3](https://dailycoffeenews.com/2020/10/23/brooklyn-roasting-company-files-for-chapter-11-bankruptcy), [4](https://dailycoffeenews.com/2026/10/30/popular-san-francisco-coffee-company-closes-both-cafes-after-landlord-disputes/)
- **greenpointers.com** (4): [1](https://greenpointers.com/2025/08/21/greenpoint-coffee-shop-sippy-cafe-will-close-this-october/), [2](https://greenpointers.com/2025/08/02/franklin-corner-cafe-is-closing-after-17-years), [3](https://greenpointers.com/2025/10/24/multiple-greenpoint-businesses-face-closure-threat-after-notorious-landlord-sends-last-minute-lease-terminations), [4](https://greenpointers.com/2021/12/08/champion-coffee-closes-in-greenpoint)
- **tax.ny.gov** (4): [1](https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/bulk_sales.htm), [2](https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/sales_by_restaurants.htm), [3](https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/vendor_collection_credit.htm), [4](https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/filing_requirements_for_sales_and_use_tax_returns.htm)
- **governor.ny.gov** (3): [1](https://www.governor.ny.gov/news/governor-hochul-signs-package-legislation-protect-credit-and-gift-card-holders), [2](https://www.governor.ny.gov/news/governor-hochul-highlights-statewide-fifa-world-cup-impacts), [3](https://www.governor.ny.gov/news/less-traffic-better-transit-its-first-anniversary-governor-hochul-celebrates-transformational)
- **t-j.ru** (3): [1](https://t-j.ru/kofe-i-knigi/), [2](https://t-j.ru/93gradusa/), [3](https://t-j.ru/list/biz-fails-2022/)
- **bedfordandbowery.com** (2): [1](https://bedfordandbowery.com/2017/07/les-stalwart-cup-saucer-to-shutter-after-75-years/), [2](https://bedfordandbowery.com/2014/10/heres-why-yaffa-cafe-had-to-close-and-one-last-look-inside/)
- **brownstoner.com** (2): [1](https://www.brownstoner.com/brooklyn-life/closing-bell-looking-back-at-vox-pop), [2](https://www.brownstoner.com/brooklyn-life/cafe-tucum-evicted-210-patchen-bed-stuy)
- **bushwickdaily.com** (2): [1](https://bushwickdaily.com/news/6197-bushwick-mainstay-and-community-hub-little-skips-is-closing-its-doors-due-to-rent-increase), [2](https://bushwickdaily.com/?p=17425)
- **columbianewsservice.com** (2): [1](https://columbianewsservice.com/2025/12/10/the-cafe-must-go-on-the-cingir-brothers-fight-to-save-park-cafe/), [2](https://columbianewsservice.com/2022/02/03/hurricane-ida-floods-left-brooklyn-residents-with-few-options-to-cover-rebuilding/)
- **dol.ny.gov** (2): [1](https://dol.ny.gov/minimum-wage-0), [2](https://dol.ny.gov/annual-calendar)
- **dripos.com** (2): [1](https://www.dripos.com/counter-talk/what-coffee-shop-owners-wish-they-knew-before-opening), [2](https://www.dripos.com/counter-talk/how-to-keep-your-best-baristas----and-actually-reduce-turnover)
- **en.wikipedia.org** (2): [1](https://en.wikipedia.org/wiki/The_City_Bakery), [2](https://en.wikipedia.org/wiki/Manhattan_blackout_of_July_2019)
- **infranken.de** (2): [1](https://www.infranken.de/lk/ansbach/gastronomie/schillingsfuerst-schlosscafe-muss-nach-fast-29-jahren-schliessen-trotz-zahlreicher-kunden-art-5837450), [2](https://www.infranken.de/lk/nuernberg/gastronomie/nuernberger-cafe-geschlossen-niu-asian-cafe-schliessung-andrang-schlange-art-6324224,PRINT)
- **mayerbrown.com** (2): [1](https://www.mayerbrown.com/en/insights/publications/2025/07/new-york-amends-labor-law-to-limit-damages-for-late-payments-to-manual-workers), [2](https://www.mayerbrown.com/en/insights/publications/2026/07/new-york-city-adopts-amended-sick-and-safe-leave-rules)
- **themidtowngazette.com** (2): [1](https://themidtowngazette.com/?p=10092), [2](https://themidtowngazette.com/2022/10/amid-remote-work-trend-coffee-shops-struggle-to-lure-customers-back)
- **therealdeal.com** (2): [1](https://therealdeal.com/new-york/2011/09/19/famed-ev-eatery-closes-doors-over-landlord-construction-dispute-between-bob-perl-and-abraham-noy/), [2](https://therealdeal.com/2010/08/24/second-avenue-merchants-subway-construction-cutting-business-by-up-to-40/)
- **toogoodtogo.com** (2): [1](https://www.toogoodtogo.com/en-us/blog/what-too-good-to-go-partners-recover), [2](https://www.toogoodtogo.com/en-us/b2b/what-cafes-do-with-surplus-food)
- **tribecacitizen.com** (2): [1](https://tribecacitizen.com/2019/09/25/the-swedish-coffee-spot-fika-has-closed/), [2](https://tribecacitizen.com/?p=109936)
- **abc7ny.com** (1): [1](https://abc7ny.com/post/starbucks-close-dozens-nyc-coffee-shop-locations-amid-restructure/17918006/)
- **aiany.org** (1): [1](https://www.aiany.org/news/mamdani-enacts-year-round-outdoor-dining-program/)
- **annarborobserver.com** (1): [1](https://annarborobserver.com/roasting-plant-closes/)
- **axios.com** (1): [1](https://www.axios.com/2025/05/09/coffee-shops-no-wifi-laptops-remote-work)
- **barclaydamon.com** (1): [1](https://www.barclaydamon.com/alerts/accessibility-lawsuits-several-tester-plaintiffsalfred-trippett-patrick-austin-kai-hunte-and-jeffery-williamstargeting-businesses-in-recent-flurry-of-lawsuits)
- **baristamagazine.com** (1): [1](https://www.baristamagazine.com/los-angeles-kindness-mischief-has-closed-its-doors-but-something-new-is-on-the-horizon/)
- **billypenn.com** (1): [1](https://billypenn.com/2023/01/11/good-karma-cafe-closes-wash-west-theft-embezzlement/)
- **bklyner.com** (1): [1](https://bklyner.com/no-new-gas-national-grid-holds-brooklyn-restaurants-hostage)
- **cbsnews.com** (1): [1](https://www.cbsnews.com/newyork/news/milk-street-cafe-closes-after-losing-business-during-occupy-wall-street-protests/)
- **citylandnyc.org** (1): [1](https://www.citylandnyc.org/dependent-on-immigrant-workforce-city-hospitality-industry-concerned-about-ice-raids/)
- **commercialobserver.com** (1): [1](https://commercialobserver.com/2025/03/ny-city-council-approves-reforms-sidewalk-shed-laws/)
- **community.squareup.com** (1): [1](https://community.squareup.com/t5/Food-and-Beverage/4-Learnings-from-a-new-coffee-shop-owner/m-p/761899)
- **coned.com** (1): [1](https://www.coned.com/en/accounts-billing/your-bill/how-to-read-your-bill/understanding-your-bill-faq)
- **consumerist.com** (1): [1](https://consumerist.com/2010/04/28/coffee-shop-reopens-after-entire-staff-quit-but-business-is-tepid/)
- **council.nyc.gov** (1): [1](https://council.nyc.gov/press/2025/05/01/2859/)
- **craneagency.com** (1): [1](https://www.craneagency.com/why-workers-compensation-premiums-increase-at-audit/)
- **crowell.com** (1): [1](https://www.crowell.com/en/insights/client-alerts/effective-date-of-the-new-york-city-pay-transparency-law-extended-to-november-1-2022)
- **dailyjournal.com** (1): [1](https://www.dailyjournal.com/articles/384254-starbucks-must-pay-50-million-to-driver-burned-by-spilled-drink-jury-rules)
- **dol.gov** (1): [1](https://www.dol.gov/newsroom/releases/whd/whd20221004-0)
- **everycrsreport.com** (1): [1](https://www.everycrsreport.com/files/2025-04-16_IF12970_089de047373b3b37f31f7c8b286333da57803926.html)
- **finance.yahoo.com** (1): [1](https://finance.yahoo.com/news/starbucks-cold-business-made-up-75-of-us-beverage-sales--bring-on-the-ice-nuggets-201812097.html)
- **findtherun.com** (1): [1](https://www.findtherun.com/race/130698/2026-tcs-new-york-city-marathon)
- **fordhamiplj.org** (1): [1](https://fordhamiplj.org/2018/11/21/royalties-unpaid-small-businesses-unknowingly-break-the-law/)
- **fox10phoenix.com** (1): [1](https://www.fox10phoenix.com/news/list-jobs-eligible-no-tax-tips-deduction)
- **freshcup.com** (1): [1](https://freshcup.com/survey-results-the-2023-coffee-business-owner-salary-report/)
- **fundingcircle.com** (1): [1](https://www.fundingcircle.com/us/resources/?p=8657)
- **gothamgazette.com** (1): [1](https://www.gothamgazette.com/government/5585-throughout-2nd-avenue-subway-build-local-businesses-see-fewer-customers-no-aid-mta)
- **hbs.edu** (1): [1](https://www.hbs.edu/faculty/Pages/item.aspx?num=41233)
- **home4.nyc.gov** (1): [1](https://home4.nyc.gov/assets/doh/downloads/pdf/rii/inspection-cycle-overview.pdf)
- **ilovetheupperwestside.com** (1): [1](https://www.ilovetheupperwestside.com/youve-got-a-lawsuit-cafe-lalo-faces-eviction/)
- **immresearch.org** (1): [1](https://immresearch.org/reports/street-vendor-victory-reshaping-the-way-nyc-authorizes-vending/)
- **kastle.com** (1): [1](https://www.kastle.com/safety-wellness/getting-america-back-to-work/)
- **koreatimes.co.kr** (1): [1](https://www.koreatimes.co.kr/entertainment/20261006/celebrities-who-tried-opening-cafes-in-korea-say-think-twice)
- **kottke.org** (1): [1](https://kottke.org/19/10/what-killed-city-bakery)
- **law.com** (1): [1](https://law.com/thelegalintelligencer/2017/10/26/no-more-mr-nice-guy-when-it-comes-to-franchisee-says-the-court)
- **law.justia.com** (1): [1](https://law.justia.com/codes/new-york/2017/pbh/article-19/1901/)
- **law360.com** (1): [1](https://law360.com/articles/582027)
- **londoncoffeefestival.com** (1): [1](https://www.londoncoffeefestival.com/journal-1/how-to-open-a-coffee-shop)
- **manhattan.institute** (1): [1](https://manhattan.institute/article/the-citys-war-on-small-business-slams-cat-cafes)
- **marylandattorneygeneral.gov** (1): [1](https://www.marylandattorneygeneral.gov/Securities%20Actions/2020/SMSFranchise_summary_cd_final_100520.pdf)
- **meridiancapital.com** (1): [1](https://meridiancapital.com/beijing-based-luckin-coffee-eyes-starbucks-shuttered-nyc-stores-as-even-more-could-be-closing-sources/)
- **metro.us** (1): [1](https://www.metro.us/news/local-news/new-york/union-square-coffee-shop-last-day)
- **mondaq.com** (1): [1](https://www.mondaq.com/unitedstates/discrimination-disability-sexual-harassment/1763220/ada-lawsuits-against-coffee-shops-and-breweries-on-the-rise-how-small-businesses-can-avoid-costly-accessibility-claims-about-architectural-barriers-and-websites)
- **multisite.nycnewsnetwork.com** (1): [1](https://multisite.nycnewsnetwork.com/clintonhill/?p=1349)
- **nationalcoffee.blog** (1): [1](https://nationalcoffee.blog/2017/06/21/what-i-wish-i-knew-advice-from-coffee-shop-owners/)
- **nerdwallet.com** (1): [1](https://www.nerdwallet.com/business/software/learn/square-concern)
- **news.osu.edu** (1): [1](https://news.osu.edu/restaurant-failure-rate-much-lower-than-commonly-assumed-study-finds/)
- **newyork.news12.com** (1): [1](https://newyork.news12.com/greenpoint-coffee-shop-sippy-caf-closing-after-rent-nearly-triples)
- **nfib.com** (1): [1](https://www.nfib.com/news/news/understanding-new-york-state-credit-card-surcharge-guidelines/)
- **norwoodnews.org** (1): [1](https://www.norwoodnews.org/national-restaurant-coffee-shop-closes-after-43-years/)
- **ny.gov** (1): [1](https://www.ny.gov/programs/minimum-wage)
- **nyc-business.nyc.gov** (1): [1](https://nyc-business.nyc.gov/nycbusiness/description/food-service-establishment-permit)
- **nycadmincode.readthedocs.io** (1): [1](https://nycadmincode.readthedocs.io/t28/c01/art118/)
- **nycourts.gov** (1): [1](https://www.nycourts.gov/reporter/pdfs/2020/2020_30413.pdf)
- **nyctourism.com** (1): [1](https://www.nyctourism.com/restaurant-week/)
- **odt.co.nz** (1): [1](https://www.odt.co.nz/regions/central-otago/theft-lockdown-lead-cafe-owners-close-business)
- **patch.com** (1): [1](https://patch.com/new-york/bed-stuy/priests-cafe-closes-when-nycs-worst-landlords-refuses-repairs)
- **queenspost.com** (1): [1](https://queenspost.com/sunnyside-staple-alpha-donuts-abruptly-closes-after-nearly-50-years)
- **regs.health.ny.gov** (1): [1](https://regs.health.ny.gov/node/48391)
- **restaurantonline.co.uk** (1): [1](https://www.restaurantonline.co.uk/Article/2026/06/11/not-joe-friday-saturday-is-the-biggest-day-for-coffee-consumption-data-reveals/)
- **roughnotes.com** (1): [1](https://roughnotes.com/utility-services-coverage-often-overlooked-endorsement/)
- **rts.com** (1): [1](https://www.rts.com/blog/rollout-schedule-dsny-cwz/)
- **sage.com** (1): [1](https://www.sage.com/en-us/blog/small-business-survival-skills-one-st-petersburg-cafe-became-community-haven-local-residents/)
- **secondmeasure.com** (1): [1](https://secondmeasure.com/datapoints/does-pumpkin-spice-drive-starbucks-sales/)
- **secretnyc.co** (1): [1](https://secretnyc.co/buddies-coffee-closing-williamsburg/)
- **sostav.ru** (1): [1](https://www.sostav.ru/blogs/290957/89813)
- **thecity.nyc** (1): [1](https://www.thecity.nyc/2022/09/21/merchant-cash-advance-new-york-threats-courts/)
- **thecoastnews.com** (1): [1](https://thecoastnews.com/a-little-moore-friction-between-owners-closes-leucadia-cafe/)
- **thelodownny.com** (1): [1](https://www.thelodownny.com/?p=111961)
- **tradingeconomics.com** (1): [1](https://tradingeconomics.com/commodity/coffee/news/599144)
- **tucson.com** (1): [1](https://tucson.com/life-entertainment/local/food-drink/article_21b69e75-5d55-49b2-9846-c39246a599d7.html)
- **unhappyfranchisee.com** (1): [1](https://unhappyfranchisee.com/?p=5124)
- **urbanmilwaukee.com** (1): [1](https://urbanmilwaukee.com/?p=1084521)
- **venable.com** (1): [1](https://www.venable.com/insights/publications/2026/04/deadlines-for-the-new-york-state-secure-choice)
- **washingtonian.com** (1): [1](https://washingtonian.com/2024/05/15/the-wydown-abruptly-shuts-down-dc-coffee-shops-amid-unionization-fight/)
- **westsidespirit.com** (1): [1](https://www.westsidespirit.com/home/boris-horton-dog-cafe-in-east-village-goes-belly-up-are-talks-afoot-with-new-owner-HA3983108)
- **yahoo.com** (1): [1](https://www.yahoo.com/news/york-city-cafe-bar-closes-191257939.html)
