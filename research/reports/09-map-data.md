# Агент 09 — карта, данные мест, экран города: отчёт

Дата: 14 ноября 2026.

## Итог в трёх строках

1. **Район — East Village.** Это 1 776 витрин в одном только районе обследования 2021 года, полное покрытие городскими наборами данных и цены объявлений по коридорам улиц. Сетка улиц ровная, а между станциями метро и Alphabet City без метро виден настоящий перепад потока людей.
2. **Данные собраны вручную, но конвейер готов.** Сеть до data.cityofnewyork.us и data.ny.gov из моей среды закрыта. Поэтому `data/places.json` — 128 мест на настоящих улицах с `note: "unverified"`. Скрипт `data/fetch-places.mjs` без зависимостей пересобирает оба файла из NYC Open Data и MTA; он проверен на образце ответов API.
3. **Карта работает и без интернета.** MapLibre рисует тёмный стиль на векторных плитках OpenFreeMap (без ключа). Если плитки не загрузились, карта сама переходит на сохранённый снимок района с 3D-кварталами.

## 1. Почему East Village

Задание просило критерий «много малого бизнеса и есть открытые данные».

| Критерий | East Village | Astoria | Williamsburg |
|---|---|---|---|
| Малый бизнес | 1 776 витрин в районе обследования Cooper Square Committee, Village Preservation и EVCC; вакантны 331, то есть 19% на октябрь 2021 ([отчёт](https://evccnyc.org/wp-content/uploads/2023/05/Crisis-and-Adaptation-East-Village-Storefront-Survey.pdf), [Cooper Square](https://coopersquare.org/news-and-events/crisis-and-adaption-storefront-trends-east-village-2019-2021)). Манхэттенский CD3 (LES и East Village) — 15,33% вакантных витрин в Q1 2026 ([Manhattan Community Corp](https://www.manhattancc.org/storefront-tracker/)) | сопоставимых чисел не нашёл | сопоставимых чисел не нашёл |
| Открытые данные | Наборы витрин (LL157), DOHMH, DCWP, PLUTO и MTA — общегородские, покрывают все три района одинаково. Для CB3 есть и своя карта пустых витрин 2025 года ([nyc.gov](https://www.nyc.gov/assets/manhattancb3/downloads/resources/CB3_Evaluation_Mapping_Vacant_Storefronts_2025.06.26.pdf)) | общегородские наборы | общегородские наборы |
| Аренда | Нашлись объявления с ценой по 1st Ave, Ave A, St Marks Pl, E 7th St, Ave C (раздел 4) | не искал | не искал |
| Геометрия | Ровная сетка Манхэттена: квартал «улица между авеню» естественно ложится в `block` фонда квартала | сетка | сетка с перекосом у моста |
| Поток людей | Станции L, 6 и F на западе, ни одной станции в Alphabet City — честный перепад от 0,3 до 1,0 | — | — |

Решение принято по первым двум строкам и по узнаваемости района для жюри. По Astoria и Williamsburg я не нашёл сопоставимых данных о плотности витрин, поэтому сравнение по ним не количественное.

## 2. Источники и точные запросы

Все наборы открываются без ключа: Socrata отвечает и без app token, только с более жёстким ограничением частоты запросов. Скрипт ключ не передаёт.

| Набор | ID | Запрос из скрипта |
|---|---|---|
| Storefronts Reported Vacant or Not (LL157, DOF) | `92iy-9c3n` | `https://data.cityofnewyork.us/resource/92iy-9c3n.json?$where=borough = 'MANHATTAN' AND zip_code in ('10003','10009')&$limit=50000`; запасной — `$q=10009` |
| PLUTO (DCP): площадь, класс здания, площадь торговли | `64uk-42ks` | `…/64uk-42ks.json?$select=bbl, address, bldgclass, bldgarea, retailarea, numfloors, latitude, longitude, zipcode&$where=borough = 'MN' AND zipcode in (10003, 10009)` |
| DOHMH Restaurant Inspection Results | `43nn-pn8j` | `…/43nn-pn8j.json?$select=camis, dba, building, street, zipcode, cuisine_description, grade, grade_date, latitude, longitude&$where=boro = 'Manhattan' AND zipcode in ('10003','10009') AND grade IS NOT NULL&$order=grade_date DESC` |
| Legally Operating Businesses (DCWP) | `w7w3-xahh` | `…/w7w3-xahh.json?$where=address_zip in ('10003','10009')` |
| MTA Subway Hourly Ridership 2020–2024 | `wujg-7c2s` (data.ny.gov) | `https://data.ny.gov/resource/wujg-7c2s.json?$select=station_complex_id, station_complex, sum(ridership) as rides, avg(latitude) as lat, avg(longitude) as lng&$where=borough = 'Manhattan' AND transit_timestamp >= '2024-01-01T00:00:00' AND transit_timestamp < '2025-01-01T00:00:00'&$group=station_complex_id, station_complex` |

ID наборов подтверждены через каталог data.gov и сторонние каталоги ([витрины](https://catalog.data.gov/dataset/storefronts-reported-vacant-or-not-filing-year-2020-2021), [DOHMH](https://catalog.data.gov/dataset/dohmh-new-york-city-restaurant-inspection-results), [PLUTO](https://catalog.data.gov/dataset/primary-land-use-tax-lot-output-pluto), [MTA](https://catalog.data.gov/dataset/mta-subway-hourly-ridership-2020-2024)).

Названия колонок набора витрин — моё допущение: страницу набора из среды открыть не удалось. Поэтому скрипт ищет поля адреса, координат, вакантности и BBL по шаблонам имён и печатает число строк каждого набора.

**Лицензии:**
- NYC Open Data и data.ny.gov — открытые данные города и штата, использование свободное.
- Карта — данные © OpenStreetMap contributors (ODbL, нужна атрибуция) через OpenMapTiles и OpenFreeMap.
- Атрибуция OpenFreeMap обязательна; MapLibre добавляет её сам, текст: «OpenFreeMap © OpenMapTiles Data from OpenStreetMap» ([условия](https://openfreemap.org/tos/)). В условиях нет явных лимитов запросов. Сервис бесплатный и «как есть», условия могут меняться ([openfreemap.org](https://openfreemap.org)).
- Платных сервисов и ключей API нет.

## 3. `data/places.json`

- **Ручной набор (сейчас):** 128 мест в 28 кварталах, по 4–6 мест в квартале.
  - Кафе подходит 116 мест, барбершопу — 110, магазину у дома — 74, мини-отелю и сдаче квартир — по 12 (целые дома без лифта).
  - Координаты считает модель сетки Манхэттена (`data/lib/grid.mjs`). Она откалибрована по точкам станций MTA GTFS (1 Av L, 3 Av L, 2 Av F) и центру Tompkins Square Park; ошибка около 20–40 м.
  - Адреса — без номеров домов («1st Ave between E 7th St & St Marks Pl, west side, near St Marks Pl»): номер без данных был бы выдумкой.
  - Площадь задаётся детерминированно по типу места: угол на авеню 1 100–2 400 кв. футов, авеню 650–1 600, боковые улицы 380–1 200, дом целиком 3 200–8 800. Это оценка.
- **Сетевой режим:**
  1. Витрины из набора LL157 внутри района, сначала вакантные.
  2. Площадь торговли из PLUTO по BBL.
  3. Дома без лифта класса C площадью 3 000–9 000 кв. футов из PLUTO — для мини-отеля и квартир.
  4. Квартал: точка в пределах 25 м от оси авеню — авеню; иначе — улица между авеню.
  5. Остаются кварталы, где не меньше 4 мест, и не больше 10 мест с квартала. Сначала 16 домов, затем витрины, до потолка в 140 мест.
- **Подходит ли место нише:** кафе — от 400 кв. футов; барбершоп — от 300 до 1 600; магазин у дома — от 650 и на авеню или на углу; мини-отель и квартиры — только целый дом.

## 4. Аренда и уровень места

Ставка — запрашиваемая аренда за квадратный фут в год для места около 1 000 кв. футов. Для другого размера она умножается на `(1000 / sqft)^0.15` в пределах 0,8–1,3: в маленьких помещениях фут дороже. Для угла — ещё ×1,08.

| Коридор | $/кв. фут/год | Опора |
|---|---|---|
| 1st Ave | 125 | 199 1st Ave: $12 500 в месяц за 1 000 кв. футов ≈ $150 ([LoopNet, 2025](https://www.loopnet.ca/Listing/199-1st-Ave-New-York-NY/35275905)) |
| 2nd Ave | 120 | оценка: уровень 1st Ave, объявлений с ценой не нашёл |
| St Marks Pl | 115 | 4 St Marks Pl: $21 500 в месяц за этаж 2 500 кв. футов ≈ $103 ([Meridian](https://www.meridiancapital.com/retail-leasings/4-st-marks-place/)) |
| Ave A | 115 | 199 Ave A просил $260 (2024, малое помещение, выброс) ([CommercialSearch](https://commercialsearch.com/commercial-property/us/ny/new-york/199-avenue-a)) |
| Ave A у Tompkins Sq | 125 | оценка: надбавка за фасад на парк |
| Боковые улицы к западу от 1st Ave | 100 | 111 E 7th St: от $120 ([PropertyShark](https://www.propertyshark.com/cre/commercial-property/us/ny/new-york/111-e-7th-st/)); 201 E 10th St: $7 500 в месяц за 400 кв. футов ≈ $225 ([LoopNet](https://www.loopnet.ca/Listing/201-E-10th-St-New-York-NY/37883627)) |
| Боковые улицы к востоку от 1st Ave | 90 | оценка: ступенью ниже авеню |
| E 4th St (театры) | 85 | оценка |
| Ave B | 80 | оценка: между A и C, цены «по запросу» ([Alphabet City](https://www.cityfeet.com/cont/alphabet-city-new-york-ny/retail-space-for-lease)) |
| Ave C | 60 | 40 Ave C: $11 000 в месяц за 2 400 кв. футов ≈ $55 ([EV Grieve, авг. 2026](https://evgrieve.com/search/label/for%20rent)); 644 E 14th St: $51–75 ([Showcase](https://www.showcase.com/644-e-14th-st-new-york-ny-10009/39885803/)) |
| Дом целиком | 55 | оценка для аренды всего дома под мини-отель или квартиры |

**Уровень места:** prime — от $110, mid — $75–110, cheap — меньше $75. В ручном наборе 76 мест prime, 36 mid, 16 cheap.

**Где я могу ошибаться.** Это запрашиваемые ставки из объявлений, а не сделки. Средних по району я не нашёл, нужен брокерский отчёт.

## 5. Поток людей `footTraffic`

```
S(place) = Σ_i sqrt(rides_i / rides_max) × exp(−d_i / 400 м)
footTraffic = 0.1 + 0.9 × S / max(S)          // по всем местам района
```

**Станции:** 14 St–Union Sq, 3 Av (L), 1 Av (L), Astor Pl (6), 8 St–NYU, Bleecker St / Broadway–Lafayette, 2 Av (F), Delancey St–Essex St. Координаты — из MTA GTFS.

**Годовой поток:** сетевой запуск берёт его из `wujg-7c2s` за 2024 год. Запасные числа в `data/lib/config.mjs` — порядок величины до пандемии, помечены `estimate`. Посчитанных MTA цифр по этим станциям я не нашёл; по всей системе в 2024 году было 1 194 866 357 поездок ([MTA](https://www.mta.info/agency/new-york-city-transit/ridership/2025)).

**Итог в ручном наборе:** от 0,29 (Ave C) до 1,0 (3rd Ave у 14th St), медиана 0,68.

## 6. `data/real-businesses.json` — подписи на карте

- **Сейчас:** 66 известных заведений и ориентиров района (Veselka, B&H Dairy, McSorley's, Tompkins Square Bagels, Ninth Street Espresso, Nuyorican Poets Cafe и другие) с `note: "unverified"`, без буквенных оценок. Часть могла закрыться.
- **Сетевой режим:**
  - DOHMH: последняя оценка по каждому `camis`, показываются только A, B и C;
  - DCWP: только активные лицензии;
  - дубли убираются, в итоге 150–300 записей.
- На образце скрипт собирает 230 подписей.
- **На карте:** серые точки с приближения 14,5, имена с 16,2 и только на онлайн-плитках (нужны шрифты). Это только подписи: ни атак, ни игровых цифр.

## 7. Карта и офлайн

- **Стиль.** Собственный тёмный стиль на источнике `https://tiles.openfreemap.org/planet`:
  - объёмные здания по `render_height`;
  - свет и «небо» MapLibre;
  - наклон 55°, поворот 29°, чтобы авеню шли вертикально;
  - облёт района за 4,2 с при открытии (выключается при `prefers-reduced-motion`).
- **Офлайн:** `data/offline-map.png` (2400×2194, схема по модели сетки с подписями улиц), `data/offline-map.json` (углы привязки) и `data/offline-buildings.json` (1 635 футпринтов с высотами, парки, вода).
  - Карта переходит на офлайн при ошибке источника плиток, если плитки не загрузились за 8 с или если `navigator.onLine === false`.
  - Пересобрать снимок: `node data/build-offline-map.mjs` (нужен Playwright).
- **Проверка в Chromium (SwiftShader).** 1280×800 и 1920×1080 рисуются; на 390×844 карточка места открывается по тапу; 60 кадров в секунду в покое.
  - Плитки OpenFreeMap из моей среды закрыты, поэтому онлайн-стиль не проверен глазами — только тестом формы стиля.

## Что нужно от ведущего

1. В среде с сетью выполнить `node data/fetch-places.mjs`, затем `node data/fetch-places.mjs --check` и закоммитить оба файла.
2. Добавить в `client/package.json` зависимости `maplibre-gl` (^6.18.0) и `qrcode-generator` (^2.0.4).
3. Открыть `/dev/map/` с интернетом и проверить онлайн-стиль глазами: плитки OpenFreeMap — единственное, что я не видел.

## Источники

- [EVCC: Crisis and Adaptation, East Village Storefront Survey](https://evccnyc.org/wp-content/uploads/2023/05/Crisis-and-Adaptation-East-Village-Storefront-Survey.pdf)
- [Cooper Square Committee](https://coopersquare.org/news-and-events/crisis-and-adaption-storefront-trends-east-village-2019-2021)
- [Manhattan Community Corp, storefront tracker](https://www.manhattancc.org/storefront-tracker/)
- [CB3: Mapping Vacant Storefronts 2025](https://www.nyc.gov/assets/manhattancb3/downloads/resources/CB3_Evaluation_Mapping_Vacant_Storefronts_2025.06.26.pdf)
- [data.gov: Storefronts Reported Vacant or Not](https://catalog.data.gov/dataset/storefronts-reported-vacant-or-not-filing-year-2020-2021)
- [data.gov: DOHMH Restaurant Inspection Results](https://catalog.data.gov/dataset/dohmh-new-york-city-restaurant-inspection-results)
- [data.gov: PLUTO](https://catalog.data.gov/dataset/primary-land-use-tax-lot-output-pluto)
- [Legally Operating Businesses](https://developers.qodex.ai/city-of-new-york/legally-operating-businesses)
- [data.gov: MTA Subway Hourly Ridership 2020–2024](https://catalog.data.gov/dataset/mta-subway-hourly-ridership-2020-2024)
- [MTA ridership 2025](https://www.mta.info/agency/new-york-city-transit/ridership/2025)
- [OpenFreeMap](https://openfreemap.org)
- [OpenFreeMap Terms of Service](https://openfreemap.org/tos/)
- Объявления об аренде: [LoopNet 199 1st Ave](https://www.loopnet.ca/Listing/199-1st-Ave-New-York-NY/35275905), [Meridian 4 St Marks Pl](https://www.meridiancapital.com/retail-leasings/4-st-marks-place/), [CommercialSearch 199 Ave A](https://commercialsearch.com/commercial-property/us/ny/new-york/199-avenue-a), [PropertyShark 111 E 7th St](https://www.propertyshark.com/cre/commercial-property/us/ny/new-york/111-e-7th-st/), [LoopNet 201 E 10th St](https://www.loopnet.ca/Listing/201-E-10th-St-New-York-NY/37883627), [EV Grieve](https://evgrieve.com/search/label/for%20rent), [Showcase 644 E 14th St](https://www.showcase.com/644-e-14th-st-new-york-ny-10009/39885803/), [Cityfeet Alphabet City](https://www.cityfeet.com/cont/alphabet-city-new-york-ny/retail-space-for-lease)
