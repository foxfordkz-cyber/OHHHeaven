# Исследователь 50 — Питч и демо по секундам

## Вердикт в трёх строках

1. **Главный вывод.** Демо и есть питч. Из трёх минут две жюри само играет блиц на своих телефонах: 6 раундов по 20 секунд на настоящей улице, где стоит площадка. Спикер в это время комментирует. Реальное событие матча — аукцион Global Dairy Trade 3 ноября 2026 года: сухое цельное молоко +5,9%. Деньги на слайде — «платит хозяин комнаты + вечера War Night для компаний» = $102,5k в год.
2. **Главный риск.** Живой мультиплеер на сцене и 15 секунд на решение для людей, которые видят игру впервые. Без двух прогонов с секундомером и трёх резервов (свои телефоны, локальный сервер, запись матча) демо умрёт.
3. **Первое действие на ближайший час.**
   - Спикер за 20 минут узнаёт у организаторов пять фактов: длина слота; отдельно ли идёт демо; сколько судей; есть ли проектор и HDMI; можно ли заранее положить карточки с QR на стол жюри. Готово, когда ответы записаны в `HANDOFF.md`.
   - Оператор за 30 минут кладёт в `world-demo.json` карточку GDT и проверяет её ссылки. Готово, когда все три ссылки открываются с телефона.

**Отчёта 35 нет.** Я проверил все 14 веток репозитория: файла `research/reports/35-*` нет ни в одной, есть только задание `research/prompts/35-pitch-v2.md`. Работаю без него.

**Что прочитано.**
- Обязательные файлы: `research/STRICT.md`, `research/CONTEXT.md`, `research/WINNER.md`, `research/reports/15-synthesis.md`, отчёты 14, 26, 29.
- Смежные отчёты, потому что питч опирается на их решения: 22 (ветка `claude/blissful-einstein-hwpcd7`), 23, 24 (`claude/exciting-mccarthy-r7904m`), 25 (`claude/lucid-noether-awpljq`), 27, 30, 31 (`claude/charming-rubin-m3mwpe`), 32, 33 (`claude/awesome-allen-qy6jrv`), 34, а также `HANDOFF.md`.

**Как проверялись факты.** Веб-поиск работает, но прямое открытие страниц из этой среды закрыто: зеркало Reddit и dairynews.today не открываются. Всё, что дано со ссылкой, проверено по выдаче поиска. Где подтвердить не удалось, это сказано прямо.

**Роли.**
- **Спикер** — пользователь, говорит со сцены.
- **Оператор** — второй человек команды: ноутбук, проектор, резервы. Со сцены оператор молчит.

Все тексты для сцены — на английском.

---

## 1. Один пользователь, одна боль

**Решение.** Пользователь — хозяин игрового вечера из отчёта 29, а не мечтатель о кофейне из отчёта 14.

**Одна фраза для слайда и для вопроса «кто ваш пользователь»:**

> **Daniel, 24, hosts Friday game night for four friends. His tycoon wins are solo — no one fights back — and getting his friends into a real money war takes installs and an hour of rules.**

**Боль от первого лица:**

> "I win tycoon games alone and nobody cares — and getting my friends into a real money war takes installs and an hour of rules."

**Ответ на вопрос трека «What makes downtime feel wasted?»:**

> **Winning against no one.** A bot that never fought back, a victory nobody saw. Street War turns ten minutes into a story your friends retell: "I stole Sam's corner and he went bankrupt."

**На чём держится:**
- Жалобы игроков «проиграть нельзя», «ИИ тупой или жульничает», «хочу соревноваться с друзьями» собраны в отчёте 29 из Steam, r/tycoon и сводок отзывов.
- Цитату r/tycoon «You can't lose at most tycoon games now» я перепроверить не смог: поиск её не нашёл, а зеркало Reddit из среды не открывается. **Решение:** цитата на слайд не идёт, пока спикер не откроет ссылку из отчёта 29 и не увидит текст своими глазами.
- Формат «друзья + браузер» массовый. Colonist.io, браузерная игра в духе «Катана», в среднем держал **501 тыс. активных игроков в месяц в 2025 году** ([итоги Colonist.io за 2025](https://blog.colonist.io/colonist-io-2025-summary)).
- Распространение встроено в продукт: каждый матч — это 3–5 приглашений. Это оценка из отчётов 29 и 31.

**Спор с отчётом 14.** Отчёт 14 выбрал «Someday»: Мария, 28 лет, одиночная игра о кофейне мечты. Пользователь одиночную игру отверг (`HANDOFF.md`, обновление 09:00 UTC). По сводке 15, боль игроков в тайкуны подтверждена сильнее, чем боль мечтателей. Прав отчёт 29: хозяин вечера сам приводит соперников, а для мультиплеера это главное.

**Проверка на хакатоне.**

| Кто | Что | Сколько | Готово, когда |
|---|---|---|---|
| Спикер | Спросить 5 человек, которые собирают друзей на игровые вечера: «Would you send this link to your group tonight?» | 20 мин, до T−6 ч | Ответы записаны. Если «да» сказали меньше 3 из 5, в Q&A первой подаётся строка про War Night для компаний, а B2C идёт второй |

**Где я могу ошибаться.** Самое сильное возражение: у компаний друзей уже есть Jackbox, Among Us и Catan, и денежная война им не нужна. Прямых доказательств, что хозяин вечера ищет именно экономическую войну, у нас нет. У Offworld в среднем 18–23 игрока онлайн (отчёт 29), так что жёсткая экономическая PvP-игра на ПК — ниша. Питч ставит на то, что браузер, вход по ссылке и 10 минут превращают нишу в формат вечера. Это гипотеза, и проверяет её только опрос из пяти человек выше. Фраза «an hour of rules» — субъективная речь персонажа, а не измерение; как факт со сцены её не подаём.

---

## 2. Питч на 3 минуты

**Решение по формату.** Демо идёт внутри питча: с 0:28 до 2:28 жюри играет блиц, спикер комментирует. Только так блиц 6 × 20 секунд, то есть ровно 2:00, помещается в три минуты.

Отчёт 26 оценивал блиц примерно в 2,5 минуты. Я укладываю его в 2:00, потому что вскрытие входит в 20 секунд раунда: 15 секунд на решение и 5 на вскрытие.

Если организаторы дают на демо отдельное время, блиц без изменений переезжает туда. В слот питча тогда идёт версия на 1:00 из раздела 4.

### Слайды

| № | Когда | Что на экране |
|---|---|---|
| S1 | 0:00–0:09 | `STREET WAR` · «Read the news first. Bankrupt your friends.» · «Judges: scan the card in front of you» · короткий адрес комнаты на случай, если QR не читается |
| S2 | 0:09–0:28 | Живое лобби на проекторе: реальное название улицы площадки, 6 витрин, отметки «Judge A joined» |
| S3 | 0:28–2:28 | Живая арена. Сверху номер раунда и таймер, ниже улица с ценами и потоком покупателей, лента ударов. В R2 — чип прогноза, в R3 — карточка события на 5 секунд |
| S4 | 2:28–2:35 | Живые итоги: места, кто кого разорил, «nemesis», кнопка Revenge |
| S5 | 2:35–2:51 | Слайд про $100k (раздел 6) |
| S6 | 2:51–3:00 | Логотип, слоган, «Built by 2 people + AI agents in 24 hours», QR «Play now», подвал «Map data © OpenStreetMap contributors» |

**Техника показа.** S1, S5 и S6 — это три картинки во вкладках того же браузера, где открыта арена. Порядок вкладок: S1, арена, S5, S6. Оператор переключает их сочетаниями Ctrl+1 … Ctrl+4. Отдельное приложение для слайдов не нужно, переключения между окнами на глазах у жюри не будет.

### Полный текст с таймингом

| Время | Экран | Спикер говорит | Слов |
|---|---|---|---|
| 0:00–0:09 | S1 | Judges, scan the card in front of you. In two minutes, someone on this street goes bankrupt. | 17 |
| 0:09–0:28 | S2 | Meet Daniel, twenty-four. He hosts Friday game night for four friends. His tycoon games are solo: no one fights back. Downtime feels wasted when you win against no one. So: a money war in ten minutes. | 36 |
| 0:28–0:43 | S3 · R1, решение | Round one. One month. One decision: your latte price. Lock it in. | 12 |
| 0:43–0:48 | R1, вскрытие | Price too high? Customers walk next door. | 7 |
| 0:48–1:03 | R2, решение + прогноз | Now you get cards. And a real-world warning: milk powder just hit its highest price since twenty twenty-two. Lock your milk price, or gamble. | 24 |
| 1:03–1:08 | R2, вскрытие | Judge B locked milk. Smart, or expensive? | 7 |
| 1:08–1:23 | R3, карточка события + решение | This is real: on November third, whole milk powder jumped five point nine percent at the Global Dairy Trade auction. Your dairy costs just went up. | 26 |
| 1:23–1:28 | R3, вскрытие | Judge B hedged, and just pulled ahead. | 7 |
| 1:28–1:43 | R4, решение + предложение пакта | Judges A and B: you've been offered a price pact. Hold prices together and you both get rich. Or betray. Nobody sees it until the reveal. | 26 |
| 1:43–1:48 | R4, вскрытие | Pact signed. Trust is cheap. | 5 |
| 1:48–2:03 | R5, решение | While you decide: every morning our AI turns the day's market data and news into events. Code does the money math, and every card links its source. | 27 |
| 2:03–2:08 | R5, вскрытие | Dan the bot just went bankrupt. | 6 |
| 2:08–2:23 | R6, решение + торги | Last month. Bid for Dan's corner. Offworld proved an economic war is fun, on Mars, on a desktop. We put it on any real street, on your phone. | 28 |
| 2:23–2:28 | R6, вскрытие | And the street goes to… | 5 |
| 2:28–2:35 | S4 | Judge A takes the street. One tap on Revenge, and you're back. | 12 |
| 2:35–2:51 | S5 | Nobody can buy a win. Hosts pay five ninety-nine a month; friends play free. Eight hundred hosts, plus forty-five company War Nights at a thousand dollars: one hundred two thousand a year. | 32 |
| 2:51–3:00 | S6 | Two of us built this in twenty-four hours. Street War. Read the news first. Bankrupt your friends. | 17 |
| **Итого** | | | **294** |

**Правила исполнения.**
- **Старт матча — по слову-сигналу.** Последнее слово блока 0:09–0:28 — «minutes». На нём оператор жмёт `S`. Дальше матч ведёт таймер сервера: спикер подстраивается под экран, а не экран под спикера.
- **Реплики вскрытий — шаблоны.** Буквы мест и исход спикер берёт с проектора. Варианты на разные исходы — в разделе 3.
- **Темп.** 294 слова — это 2:16 речи при 130 словах в минуту и 2:39 при 111 словах в минуту. 111 — медиана реальных выступлений у VirtualSpeech, 130 — частый ориентир ([VirtualSpeech](https://virtualspeech.com/?p=644), [Omni](https://www.omnicalculator.com/everyday-life/words-per-minute)). Остаток трёх минут — паузы на решения и вскрытия.
- **Что резать, если спикер отстаёт:**
  - «Two of us built this in twenty-four hours.» — минус 8 слов;
  - «and every card links its source» — минус 6;
  - «Smart, or expensive?» — минус 3.

**Репетиция.** Спикер, 30 минут: три прогона с секундомером, один из них с живой игрой. Готово, когда два прогона подряд заканчиваются между 2:50 и 3:00.

**Где я могу ошибаться.** Пока судьи смотрят в телефоны, они не слушают. Реплики про ИИ в R5 и про Offworld в R6 могут пройти мимо них.
- **Проверка на T−3 ч.** После прогона спросить тестеров: «Where do the events come from?» Если двое из трёх не отвечают, реплика R5 переезжает в 2:28–2:35 вместо реплики про Revenge.
- **Деньгам на сцене достаётся 16 секунд**, хотя по оценке отчёта 14 бизнес-модель весит около 15% баллов. Поэтому слайд S5 остаётся на экране всё время вопросов, и основную нагрузку несут ответы из раздела 7.

---

## 3. Демо-блиц: 6 раундов по 20 секунд

### Настройка комнаты

| Параметр | Значение | Почему |
|---|---|---|
| Места | 4 места для жюри (A–D), DAN (BOT) и PAULA (BOT) | Судьи играют друг против друга. Дан гарантирует банкротство на сцене, Паула — партнёр по пакту, если живых судей меньше двух |
| Пустое место | Автопилот с меткой BOT | Никого не ждём: пропущенный ход играет автопилот (отчёт 27). Боты никогда не выдают себя за людей (отчёт 26) |
| Улица | Реальная улица площадки: название из OSM и статичный снимок карты | Даёт зацепке слова «this street». Ввод адреса судьи на сцене (отчёт 14) отнимает 10–15 секунд и дёргает запрос к OSM, который может упасть |
| Категория | Только кофейни (отчёт 34) | Цены сравнимы без объяснений |
| Раунд | 15 с на решение + 5 с на вскрытие, 6 раундов. Кто не походил, играет прошлым ходом без карт (отчёт 34). Если все нажали LOCK IN, вскрытие начинается сразу | Ровно 2:00 |
| Вход | QR на карточке ведёт прямо на место с готовым именем «Judge A», вводить ничего не нужно | Экономит 10–15 секунд на вводе имени |
| Проектор | `/room/DEMO/screen`: улица, отметки «locked», вскрытия. Тайные ходы до вскрытия не показываются | Судьи видят проектор. Если показать ходы заранее, они подсмотрят решения соперников |

### Боты

- **DAN (BOT) · Undercutter.** Каждый раунд ставит цену ниже себестоимости, стартовая касса у него меньше, чем у остальных. Ёмкость точки ограничена, поэтому его убыток почти не зависит от ходов жюри, и банкротится он на вскрытии R5. Подпись стратегии висит на витрине. Так банкротство выглядит следствием демпинга, а не постановкой.
- **PAULA (BOT) · Premium.** Держит высокую цену, принимает любой пакт и соблюдает его.
- **Проверка.** Оператор с агентом за 45 минут прогоняет блиц 20 раз со случайными ходами жюри. Готово, когда лог прогонов лежит в репозитории и в нём выполнены оба условия:
  - Дан банкротится на R5 в 20 прогонах из 20;
  - в ленте R3–R5 разница «закрепил цену молока / не закрепил» не меньше $300.

### Событие из реальных данных

**Факт.** Аукцион Global Dairy Trade 3 ноября 2026 года:
- индекс +3%;
- сухое цельное молоко (WMP) +5,9%, до $3 971 за тонну;
- сухое обезжиренное молоко (SMP) +3,1%, до $4 109 за тонну, максимум на GDT с июня 2022 года.

Источники: [Ukragroconsult: индекс](https://ukragroconsult.com/en/news/global-dairy-prices-rise-3-at-gdt-auction/), [Ukragroconsult: SMP](https://ukragroconsult.com/en/news/global-skimmed-milk-powder-prices-hit-highest-level-since-2022/), [то же по-русски](https://ukragroconsult.com/ru/news/mirovye-czeny-na-molochnuyu-produkcziyu-vyrosli-na-3-na-torgah-gdt/). [Dairy News](https://dairynews.today/news/gdt_index_rises_3_as_milk_powders_gain_and_dairy_fats_fall_3057869.html) называет рост WMP самым сильным за один аукцион в этом году.

Официальную страницу GDT я не открыл: доступ из среды закрыт. На T−60 мин оператор открывает её с телефона. Если цифры там другие, карточка идёт по официальной странице.

**Почему молоко, а не кофе, цветы или газ:**
- Арабика 6 ноября стоила около $2,80 за фунт — почти минимум с 24 сентября (отчёт 22, [Trading Economics](https://tradingeconomics.com/commodity/coffee/news/599144)). История «рекордный кофе» из отчёта 31 устарела: рекорды были в 2025 году.
- По цветам свежих открытых данных нет (отчёт 22).
- Скачок цен на газ в ЕС отчёт 22 связывает со сбоями судоходства в Ормузском проливе. Это геополитика, жёлтая зона по правилу отчёта 33 «Price, not pain»: причину не называем, и в демо такое событие не берём.

**Карточка прогноза в R2:**

```
FORECAST · Dairy costs rising — skim milk powder at its highest since June 2022
Global Dairy Trade auction, 3 Nov 2026 · Source ↗
```

**Карточка удара в R3.** 5 секунд крупно на проекторе, потом сворачивается в чип:

```
REAL WORLD · Global Dairy Trade auction · 3 Nov 2026 · Source ↗
Whole milk powder +5.9% — its biggest jump this year
ON [VENUE STREET] · rounds 3–5
Dairy cost +9%   (real +5.9% × 1.5, cap ±40%)
Locked your milk price? You're covered.
Summary by AI — may contain errors · In-game effect is simplified
```

**Спор об усилении: отчёт 23 против отчёта 34.**
- Отчёт 34 требует переноса 1:1: кривой коэффициент выглядит как выдумка.
- Отчёт 23 разрешает множитель k ≤ 1,5 и показывает на карточке оба числа.
- Я на стороне 23. Реальные месячные движения малы, −6…+6% (отчёт 22). Когда на карточке видны оба числа, скрытого коэффициента нет, и опасение отчёта 34 снимается.

### Шаг за шагом

| Время | Проектор | Телефоны жюри | Спикер | Оператор | Если… |
|---|---|---|---|---|---|
| T−2 мин | S1 | — | — | Раскладывает карточки A–D на столе жюри, если организатор разрешил | Не разрешил — раздаёт их сам в 0:00, молча |
| 0:00–0:09 | S1 | Сканируют QR, на экране «Judge A · Ready» | Зацепка | — | Судья не сканирует — не ждём |
| 0:09–0:28 | S2, лобби | Видят свою витрину на улице | Пользователь и боль | Следит за счётчиком «joined N/4», на слове «minutes» жмёт `S` | Вошли меньше двух — план 1, уровень 2 |
| R1 0:28–0:48 | Улица, таймер | Только ползунок цены и LOCK IN | Строки R1 | — | Дан демпингует, в ленте «−38 → DAN (BOT)». Реплика остаётся той же |
| R2 0:48–1:08 | Чип прогноза | Ползунок и 3 карты: Hire, Lock milk price, Undercut | Строки R2 | — | Никто не взял Lock: «Nobody locked milk. Brave.» |
| R3 1:08–1:28 | Карточка события 5 с, потом чип | Ползунок и карты | Строки R3 | — | Никто не закрепил цену: «Nobody hedged. Everyone pays.» |
| R4 1:28–1:48 | Улица | A и B получают окно: «Price pact with Judge B: both stay at or above $[median R3] for 2 rounds. Escrow $1,000. Accept / Decline» | Строки R4 | — | Живой судья один — пакт предлагает PAULA (BOT). Отказ: «Pact refused. War it is.» |
| R5 1:48–2:08 | Улица | Ползунок и карты | Строка про ИИ | — | Предательство: красная линия между витринами и реплика «Judge A broke the pact! And Dan the bot just went bankrupt.» |
| R6 2:08–2:28 | Торги за угол Дана | Кнопки «Bid $3k / $6k / Skip» и ползунок цены | Строки R6 | — | Торги не собраны — R6 становится последним ходом по цене, клиенты Дана по модели рынка делятся между выжившими |
| 2:28–2:35 | S4, итоги | Итоги и кнопка Revenge | Строка итогов | В 2:35 жмёт Ctrl+3 (S5) | — |
| 2:35–3:00 | S5 → S6 | — | Деньги и финал | В 2:51 жмёт Ctrl+4 (S6) | — |

### Что нужно в MVP ради этого демо

| Что | Есть в плане MVP? | Сверх плана, ч |
|---|---|---|
| Комната по ссылке или QR, одновременные ходы, вскрытие | да (WINNER, 27) | 0 |
| Экран для проектора `/screen` | да (34) | 0 |
| Места с готовым именем по QR | нет | 0,5 |
| Пресеты `blitz6` и `blitz3`, старт по горячей клавише | нет | 0,5 |
| Боты DAN и PAULA с подписью стратегии | да, боты — задача 52 | 0 |
| `world-demo.json`: прогноз и удар GDT | да (23) | 0,5 |
| Пакт с залогом и предательство | да (25, 32) | 0 |
| Торги за точку банкрота | частично: Bankrupt Buyout в отчёте 25 | 1, по желанию |
| Итоги и Revenge | да (31) | 0 |
| `replay.html`: проигрывание записанного матча без сети | нет | 1 |

Сверх существующего плана нужно 2,5 часа обязательной работы и 1 час на торги, если останется время. Рейтинг Elo, лига городов и живой новостной конвейер для демо не нужны.

### Подготовка

| Когда | Кто | Что | Сколько | Готово, когда |
|---|---|---|---|---|
| T−6 ч | Спикер | Тест понятности из отчёта 34 на 5 людях: раунды R1–R2 блица, потом три вопроса | 20 мин | Не меньше 4 из 5 успели нажать LOCK IN за 15 секунд и ответили, кто забрал их покупателей. Иначе — пресет 4 × 30 с (те же 2:00), реплики R2 и R3, R4 и R5 сливаются попарно |
| T−3 ч | Оба | 2 полных прогона питча с живой игрой: один на Wi-Fi площадки, один на своём хотспоте | 40 мин | Оба прогона не длиннее 3:00. Видео лучшего прогона и лог матча сохранены |
| T−60 мин | Оператор | Открыть с телефона 3 ссылки карточки GDT; вписать улицу площадки; распечатать 6 карточек с QR (A–F); зарядить 4 телефона, на каждом закладки «cloud» и «LAN» для своего места | 30 мин | На карточке реальная улица, все ссылки открываются, телефоны заряжены на 100% |
| T−15 мин | Оператор | Ноутбук на своём хотспоте, не на Wi-Fi площадки. Сервер прогрет, комната DEMO создана, вкладки S1 / арена / S5 / S6 открыты | 10 мин | На проекторе S1, лобби пустое |

**Где я могу ошибаться.**
- **15 секунд на решение может не хватить.** Отчёт 34 считал, что на цену и одну карту нужно 40 секунд, и предлагал 3 раунда по 40. Я держусь задания (6 × 20) и страхуюсь: в R1 только цена, карты нажимаются в одно касание, без хода повторяется прошлый. Решение принимается правилом из теста на T−6 ч.
- **Банкротство Дана может выглядеть постановкой.** Бот подписан, стратегия видна на витрине. Если судья спросит, ответ готов: «Dan is a reckless undercutter — that's what a price war does».
- **Шесть витрин на экране телефона — тесно.** Отчёт 34 закладывал от 3 до 6 витрин. Если на тесте T−6 ч люди путают витрины, остаётся 5 мест: судьи A–C, Дан и Паула.

---

## 4. Три запасных плана

### План 1. Упала сеть

| Уровень | Признак | Оператор | Спикер говорит | Время |
|---|---|---|---|---|
| 1. Профилактика, всегда | — | Игровой сервер в облаке, ноутбук на своём хотспоте. Судьи заходят через мобильный интернет своих телефонов, Wi-Fi площадки не участвует | — | 0 с |
| 2. Телефоны судей не заходят | В 0:28 вошли меньше двух судей, или QR не открывается | Раздаёт наши 4 телефона: на них уже открыто своё место. Матч стартует сразу, до этого места играет автопилот | "Your network is busy — take ours. Same game." | 10 с |
| 3. Облако недоступно | Арена на проекторе замерла больше чем на 5 секунд или показывает ошибку | Переключает на локальный сервер на ноутбуке: тот же артефакт, `npm run lan`, по отчёту 27. Наши 4 телефона в сети хотспота оператора, у них закладки «LAN» | "Switching to our local server. Five seconds." | до 20 с |
| 4. Не работает ничего | Переключение длится дольше 20 секунд или сбой случился после R3 | Открывает `replay.html` (записан на T−3 ч, работает без сети) или видео | "The network gave up, so here's the match we played this morning: same street, same milk shock." Дальше те же реплики в прошедшем времени | 5 с |

**Решение.** Каждый уровень один раз проигрывается на T−3 ч: выключить Wi-Fi, остановить облачный сервер. Кто: оператор, 15 минут. Готово, когда каждое переключение занимает не больше 20 секунд.

Хотспот телефона иногда не пускает устройства друг к другу. Тогда точку доступа поднимает ноутбук. Это тоже проверяется на T−3 ч.

### План 2. Жюри не хочет играть

**Признак:** до 0:28 никто не сканирует карточку, или судья говорит «just show us».

**Что происходит:**
- Спикер: "No problem — you'll be the market. Watch me fight two bots, and you vote on my moves."
- Оператор переключает проектор в режим зрителя (`?view=spectator`): после того как все нажали LOCK IN, ходы видны всем, как карты в покерной трансляции (отчёт 31).
- Спикер играет место A с телефона на сцене, только ползунком цены. Оператор играет место B. Дан и Паула — боты.
- В R4 спикер: "Judges — should I sign the pact? Thumbs up or down."
- В R5 спикер: "Should I betray? Hands up for yes." Спикер делает то, что решило большинство.

Остальной сценарий, включая реплику о GDT в R3, не меняется. Готово, когда план один раз отрепетирован на T−3 ч.

### План 3. Времени дали меньше

**Слот 2:00 — пресет `blitz3`.** Три раунда по 20 секунд; событие GDT бьёт сразу в R1, без прогноза; касса Дана заранее ниже, чтобы он банкротился на вскрытии R2.

| Время | Спикер говорит | Слов |
|---|---|---|
| 0:00–0:08 | Judges, scan your card. In ninety seconds, someone on this street goes bankrupt. | 13 |
| 0:08–0:20 | Daniel hosts Friday game night. His tycoon games are solo: no one fights back. Downtime feels wasted when you win against no one. | 23 |
| 0:20–0:40 | Round one: set your latte price. This is real: on November third, whole milk powder jumped five point nine percent. Your dairy costs just went up. | 26 |
| 0:40–1:00 | Judges A and B: price pact offered. Hold together, or betray. Nobody sees it until the reveal. Dan the bot is bankrupt. | 22 |
| 1:00–1:20 | Last month. Our AI turns each day's market data into events; code does the money math. | 16 |
| 1:20–1:30 | Judge A takes the street. Revenge is one tap. | 9 |
| 1:30–1:50 | Nobody can buy a win. Hosts pay five ninety-nine a month; friends play free. Eight hundred hosts plus forty-five company War Nights: one hundred two thousand a year. | 28 |
| 1:50–2:00 | Street War. Read the news first. Bankrupt your friends. | 9 |

Итого 146 слов: 67 секунд речи при 130 словах в минуту.

**Слот 1:00 — без живой игры, с видео на 25 секунд.**

| Время | Спикер говорит | Слов |
|---|---|---|
| 0:00–0:10 | Daniel hosts Friday game night. His tycoon games are solo, and downtime feels wasted when you win against no one. | 20 |
| 0:10–0:35 | (видео матча без звука) Street War is a ten-minute money war on a real street. Real market data hits everyone: here, the November third dairy auction. Then pacts, betrayal, bankruptcy. | 26 |
| 0:35–0:52 | Hosts pay five ninety-nine a month, friends play free, and companies book War Nights. Eight hundred hosts and forty-five nights make one hundred thousand a year. | 26 |
| 0:52–1:00 | Scan to play us after. Street War. | 7 |

**Если остановили на середине** (организатор показывает «30 seconds»): спикер говорит "Let me jump to the money", а оператор жмёт Ctrl+3. Дальше звучат строки блоков 2:35 и 2:51, около 25 секунд.

Пресет оператор выбирает по ответу организаторов на первое действие из вердикта.

**Где я могу ошибаться.**
- **Четырёх запасных телефонов у команды из двух человек может не быть.** Решение: оператор до T−3 ч занимает у знакомых участников 2 телефона или планшета. Если не вышло, демо идёт с двумя судьями и двумя ботами — это всё ещё «жюри против жюри».
- **Запись матча слабее живой игры.** Жюри может решить, что игра не работает. Поэтому после выступления оператор подходит к столу жюри с открытой живой комнатой.

---

## 5. Отличие от Offworld Trading Company и Landlord GO

**Offworld Trading Company:**

> **"Offworld is a real-time desktop strategy set on Mars; Street War is a ten-minute match you join from a link on your phone, on a real street, where the market shocks come from this week's real data."**

Факты:
- PC Gamer назвал её «a cutthroat RTS with no combat», действие на Марсе ([PC Gamer](https://www.pcgamer.com/offworld-trading-company-preview-a-cutthroat-rts-with-no-combat)).
- С февраля 2019 года мультиплеер бесплатный ([Destructoid](https://destructoid.com/offworld-trading-company-gets-free-to-play-multiplayer-mode)).
- В мультиплеере до 8 игроков.
- Длительность матча (20–30 минут в разных источниках) я сегодня подтвердить не смог, поэтому минут про Offworld со сцены не называем.
- Онлайн Offworld (отчёты 26 и 29) со сцены тоже не называем: топить конкурента цифрами, которые меняются, — плохой тон.

**Landlord GO:**

> **"Landlord GO is about collecting virtual copies of real buildings and their rent; in Street War you run one shop, and live rivals take your customers every round until someone goes bankrupt."**

Факты:
- Игра 2020 года от Reality Games. В ней покупают, продают, обменивают виртуальные копии реальных зданий и собирают с них ренту ([PR Newswire](https://prnewswire.com/news-releases/new-augmented-reality-game-lets-players-buy-and-sell-real-world-properties-301097529.html)).
- Стоимость зданий считается по реальным данным ([Pocket Gamer](https://www.pocketgamer.com/landlord-go/how-landlord-go-uses-real-world-data-to-deliver-the-most-authentic-property-simu)).

**Спор с WINNER и отчётами 26, 32, 33.** Там написано «Landlord GO — реальная карта без войны». Это неточно: в пресс-релизе 2020 года прямо названы «furious bidding wars with other players». Говорить «у Landlord GO нет соревнования» нельзя. Правильное отличие — «коллекция зданий против ежемесячной войны за одних и тех же покупателей».

**Запасные фразы для вопросов:**
- **Monopoly GO** — "Monopoly GO runs on dice rolls; here every outcome comes from your decisions and your rivals'." В App Store сама игра описывает атаки и налёты как взаимодействие со случайным исходом ([App Store](https://apps.apple.com/gb/app/monopoly-go/id1621328561)).
- **Jackbox** — "Jackbox proved rooms-by-code; we put an economy inside the room." Факт: в Jackbox игрой владеет только хост ([Jackbox](https://jackboxgames.com/how-to-play)).

**Где я могу ошибаться.** Судья, который знает Offworld, скажет: «там тоже есть враждебные выкупы, вы копируете жанр». Это правда: жанр мы берём. Отличие не в «войне», а в месте (реальная улица), платформе (браузер и ссылка), длине сессии (10 минут) и реальных данных. Есть и второй риск: отчёта GPT о конкурентах (21) в репозитории нет, так что браузерные экономические PvP-игры, которые я не нашёл, могут существовать. **Решение:** спикер нигде не говорит «first» и «no competitors».

---

## 6. Слайд про $100 000

**Содержание слайда S5:**

```
$100k a year. Nobody can buy a win.

HOSTS PAY, FRIENDS PLAY FREE
Host Pass $5.99/mo — private rooms & leagues, post-match review, season looks
800 hosts × $5.99 × 12 = $57,504

COMPANIES BOOK WAR NIGHTS
A hosted game night for 10–60 people — $1,000
45 nights × $1,000 = $45,000

TOTAL  $102,504 / year

Today at [hackathon]: __ players · __ Revenge taps · __ "Get Host Pass" clicks

800 hosts ≈ 2.5% of ~32k monthly players (freemium median 2.1–2.2%, RevenueCat) ·
45 nights = 12 companies × ~4 a year · cost ≈ $0.04 per player per month (est.)
```

**Откуда числа:**
- **800 хостов** — оценка. 8 000 активных хостов × 4 игрока (хост и 3 друга, оценка отчёта 31) = 32 000 игроков в месяц. Если платит 10% хостов, это 800 человек, или 2,5% игроков.
- **Ориентир конверсии.** Медиана freemium-приложений по скачиваниям — 2,1–2,2% ([RevenueCat 2025](https://www.revenuecat.com/state-of-subscription-apps-2025), [RevenueCat 2026](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026)).
- **Модель «платит один».** Так устроен Jackbox: игрой владеет только хост ([Jackbox](https://jackboxgames.com/how-to-play)). Платный разбор партии есть у Chess.com: безлимитный Game Review входит только в Platinum и Diamond ([Chess.com](https://support.chess.com/article/442-what-is-the-difference-between-gold-vs-platinum-vs-diamond-memberships)). Это не pay-to-win: разбор не даёт силы внутри матча.
- **45 вечеров** — оценка: 12 компаний × ~4 вечера в год. Воронка по оценке отчёта 30: 400 писем → 40 демо → 12 клиентов.
- **Цена $1 000.** По обзорам, тимбилдинг-игры Confetti стоят примерно $15–60 с человека ([Dupple](https://dupple.com/reviews/confetti), [Listicler](https://listicler.com/blog/confetti-pricing-breakdown-smb-virtual-team-building)). Это не официальный прайс. 40 человек × $25 = $1 000.
- **Расходы ≈ $0,04 на игрока в месяц** — оценка отчёта 30. Новостной конвейер стоит около $10 в месяц на всю игру (оценка отчёта 23).

**Цифры наготове для вопросов:**
- **После комиссий.** Paddle берёт 5% + $0,50 за платёж ([Paddle](https://www.paddle.com/alternatives/stripe-vs-paypal)). Тогда с хоста за месяц остаётся $5,19, с вечера — $949,50. Итого $49 824 + $42 728 = **$92,6k на руки**. Чтобы получить $100k после комиссий, нужно около 920 хостов.
- **Окупаемость затрат.** $0,04 / $5,99 ≈ 0,7%: затраты покрываются уже при доле платящих меньше 1%.

**Строка «Today at…» заполняется только реальными числами.** Спикер считает на T−6 ч и T−3 ч: сколько человек сыграли, сколько раз нажали Revenge, сколько кликнули «Get Host Pass». Это кнопка-заглушка из отчёта 34, переименованная из Season Pass. Если чисел нет, строка удаляется.

**Спор с другими отчётами:**
- Отчёт 14: $4,99 × 1 700 платящих мечтателей.
- Отчёт 26: сезонный пропуск $4,99 × 13 сезонов × 1 550 покупателей.
- Отчёты 29, 32, 33: $4,99 × 1 700 платящих. Это около 57 тыс. игроков в месяц по отчётам 29 и 33 и 40–85 тыс. по отчёту 32.
- Отчёт 30 (мой же): гибрид с курсами и спонсорскими турнирами.

Я беру две строки по трём причинам:
1. «Платит хозяин комнаты» совпадает с устройством PvP-комнат.
2. Нужно 32 тыс. игроков, а не 57 тыс.
3. Курсы для вузов убраны со сцены: по сводке 15 и отчёту 14 они уводят в трек SKILLS. Курсы, спонсорские турниры и приватные лиги для клубов остаются запасом для ответов на вопросы.

**Где я могу ошибаться.**
- **800 платящих хостов в первый год без бюджета — самое шаткое число.** Медиана RevenueCat посчитана по подпискам в мобильных приложениях, а не по браузерным играм.
- **45 вечеров в год — почти вечер в неделю.** Для двух человек это сервисная работа, которая конкурирует с разработкой. Если жюри на это надавит, ответ один: после первых 10 вечеров переходим на самообслуживание за $20 с человека (отчёт 30).
- **Цены Confetti взяты из обзоров**, официального прайса я не видел.

---

## 7. Пятнадцать вопросов жюри

Ответ на каждый вопрос — две фразы на английском. Ответ 14 спикер перед выходом на сцену сверяет с тем, что реально собрано.

1. **"How is this different from Offworld Trading Company?"**
   Offworld is a real-time desktop strategy set on Mars. Street War is a ten-minute match you join from a link on your phone, on a real street, and the market shocks come from this week's real data.
   *Основание: раздел 5.*

2. **"Isn't this just Landlord GO or Monopoly GO?"**
   Landlord GO is about collecting virtual copies of real buildings and their rent, and Monopoly GO runs on dice rolls. In Street War you run one shop, and your friends take your customers every round with prices, pacts and betrayal.
   *Основание: раздел 5.*

3. **"Is the news really real? What if the AI makes something up?"**
   The AI only picks an event template; the numbers come from published data, and code computes the effect and attaches the source link from our database. Every card shows the real-world number next to the in-game number, so anyone can check it.
   *Основание: конвейер из отчёта 23.*

4. **"Isn't it tasteless to turn real-world events into game profit?"**
   Our rule is "price, not pain": only market data like commodities, weather and interest rates becomes an event. Wars, disasters and casualties are filtered out by code before the AI ever sees them.
   *Основание: отчёт 33.*

5. **"Who pays, and why would they?"**
   The host pays $5.99 a month for private rooms, leagues and post-match reviews, while friends play free — the same logic as Jackbox, where only one person needs to own the game. Companies pay $1,000 for a hosted War Night; reviewers put team-building games at roughly $15 to $60 per person, so a 40-person night fits that budget.
   *Основание: раздел 6.*

6. **"Is 800 paying hosts realistic?"**
   It's about 2.5% of roughly 32,000 monthly players, close to the 2.1–2.2% median for freemium apps in RevenueCat's data. A player costs us about four cents a month to serve, so we break even below 1% paying.
   *Основание: раздел 6; данные RevenueCat.*

7. **"How big is the market?"**
   Browser games with friends already hold big audiences: Colonist.io, a browser Catan-style game, averaged 501,000 monthly players in 2025. Fantasy Premier League shows real-world data can power a game for over 11.5 million people in a season.
   *Основание: [Colonist.io](https://blog.colonist.io/colonist-io-2025-summary), [Premier League](https://www.premierleague.com/en/news/4320685/fpl-records-and-amazing-stats-from-202425).*

8. **"Where do your first 1,000 players come from with zero budget?"**
   Every match needs three to five rivals, so each host brings their own friends — that's how room-link games like Gartic Phone and Jackbox spread. We start with game-night Discord servers and strategy communities, and we track one number: how many invited players become hosts.
   *Основание: отчёт 31.*

9. **"What happens when nobody is online?"**
   The main way in is a private room you share with friends, and empty seats are filled by bots that are always labelled BOT. Public matchmaking comes later, when there are enough players to fill it.
   *Основание: отчёты 26, 31, 32.*

10. **"Why would anyone come back tomorrow?"**
    Every day brings a new market deck built from that day's data, and the Revenge button puts you back on the street with the friend who bankrupted you. Fantasy sports already prove that real-world events bring people back every week.
    *Основание: отчёты 26 и 31; FPL.*

11. **"Doesn't undercutting always win?"**
    No: customers choose by price, quality, location and reputation, and every shop has limited capacity. In 3,000 simulated bot matches, a pure price war won about 3% of games and went bankrupt a quarter of the time.
    *Основание: симулятор отчёта 24 — это наш расчёт, не внешний факт.*

12. **"Why is this Entertainment and not the Money track?"**
    It's a ten-minute game night with friends: people play it to win and to retell the story, not to manage their own money. Real data is there to make the fight feel real.

13. **"Can you legally use real streets, business names and headlines?"**
    Streets come from OpenStreetMap with attribution, real businesses appear only as map labels, and players fight with fictional shops. We never copy headlines or articles: each card states the fact in our own words with the source, date and link.
    *Основание: отчёт 33; [OSM copyright](https://www.openstreetmap.org/copyright).*

14. **"What's built and what's mocked?"** *(Перед сценой сверить с реальностью.)*
    Built: rooms by link, simultaneous secret moves, the shared market, bots, the real-data event card and the results screen. Mocked: payments — the Host Pass button only counts clicks — and today's event deck was checked by hand instead of by the daily pipeline.

15. **"Why you, and what happens next week?"**
    Two of us built a working multiplayer game in 24 hours with AI agents, and that speed is our edge. Next week we run three paid War Night pilots and open a $19 Founders Pass.
    *Основание: отчёт 30, раздел «первая неделя».*

**Где я могу ошибаться.**
- **Ответ 11 опирается на наш собственный симулятор.** Живые игроки найдут эксплойт, который ботам в голову не пришёл; на это указывает и сам отчёт 24. Если судья спросит про тесты на людях, честный ответ — число плейтестов на хакатоне.
- **Ответ 14 станет ложью**, если сборка пойдёт иначе, чем запланировано. Поэтому он помечен для сверки.
- **В ответе 7 пользователи Colonist.io и FPL** — это не наши пользователи, а доказательство формата. Если судья скажет «это не ваш рынок», он прав. Ответ: «that's why we test hosts this week».

---

## 8. Что нельзя говорить со сцены

| Нельзя | Почему | Вместо этого |
|---|---|---|
| learn, educational, financial literacy; teach, lesson, course | Уводит в трек SKILLS (сводка 15, отчёт 14); запрещено в `STRICT.md` | "game night", "fight", "street" |
| "No competitors", "the first ever" | Offworld и Landlord GO существуют; отчёта о конкурентах (21) нет | Назвать конкурентов самим (R6 и раздел 5) |
| "Realistic simulation", "accurate forecast", "predicts the market" | Ответственность за обещание точности (отчёт 14) и неправда | "Real data, simplified effects" |
| "Live news from Reuters / AP" | Лицензии: бесплатные ключи новостных API некоммерческие (отчёт 33). В демо — проверенная вручную колода | "Real market data, checked sources" |
| "The AI runs the economy", "AI decides who wins" | Неправда и пугает. ИИ выбирает шаблон, деньги считает код (отчёт 23) | "AI picks the event; code does the money math" |
| Любые войны, катастрофы, жертвы, эпидемии, выборы, политики; газовый скачок из отчёта 22 (сбои в Ормузском проливе) | Запрет `STRICT.md`, правило «Price, not pain» (отчёт 33), п. 1.1.7 правил App Store | Сырьё, погода без жертв, ставки, курсы |
| "Profit from crises", "make money on disasters" | Этика (отчёт 33) | "Read the market first" |
| "Bet", "gamble", "cash prizes", "win real money" | Законы об азартных играх: Skillz закрывает денежные игры в 12 штатах США ([terms.law](https://terms.law/Terms-Scanner/app/gaming/skills-based-platforms/skillz/), отчёт 30) | "Nobody can buy a win" |
| Плохое о реальном бизнесе на улице: «эта Starbucks закроется» | Диффамация (отчёт 33). Реальные заведения у нас только подписи на карте | Говорить только о наших вымышленных витринах |
| TAM вида «1% рынка игр на $200 млрд» | Раздражает жюри (отчёт 14) | Формула снизу вверх со слайда S5 |
| "Record coffee prices" | Устарело: арабика около $2,80 за фунт 6 ноября 2026 (отчёт 22). Здесь отчёт 31 неправ | Молоко: GDT, 3 ноября |
| "Everything is live and automatic", если колода проверена вручную | Нечестно, ловится одним вопросом | Ответ 14 из раздела 7 |
| "Metaverse", "NFT", "crypto", "Web3" | Ассоциация с Upland и словесный салат (отчёт 14) | — |
| "Addictive" | Регуляторный и этический подтекст | "People come back for revenge" |
| "Sorry, it's buggy", извинения, «напарник сомневался» | Съедает время и доверие | Реплика из плана 1 и переход на следующий уровень |
| Непроверенные цифры: онлайн Offworld, «игроки Big Ambitions умоляли о мультиплеере», цитата r/tycoon без открытой ссылки | Устаревают или не подтверждены. Цитата r/tycoon сегодня не нашлась поиском | Только цифры из источников этого отчёта |
| "Bots are real players" или молчание, когда спросили | Обман (отчёт 26) | "Bots are always labelled BOT" |

**Где я могу ошибаться.** Длинный список запретов делает речь стерильной, и спикер может замяться на живом вопросе. **Решение:** спикер запоминает не список, а три правила — «никаких обещаний точности», «никакой беды в событиях», «никаких слов про обучение». Остальное ловит прогон на T−3 ч: оператор отмечает каждое запретное слово.

---

## Чек-лист сдачи

- [x] **Текст укладывается в 3 минуты при чтении вслух.**
  - 294 слова — 2:16 речи при 130 словах в минуту и 2:39 при 111 (медиана VirtualSpeech).
  - Посекундная таблица кончается ровно на 3:00, все 17 блоков помещаются в свои окна при 125 словах в минуту.
  - Строки для сокращения отмечены.
  - Версии на 2:00 (146 слов) и 1:00 (79 слов) — в разделе 4.
  - Слова считал скриптом.
- [x] **В питче нет слов learn, educational, financial literacy.**
  - Проверено регулярным выражением `learn|educat|financial literacy|teach|lesson|course|class` по всем текстам для сцены: питч, версии на 2:00 и 1:00, реплики резервов, слайды, 15 ответов. Совпадений ноль.
  - Слова встречаются только в русских пояснениях и в этой строке как запрет.
- [x] Вердикт в трёх строках — в начале.
- [x] Все 8 обязательных разделов есть.
- [x] В каждом разделе есть абзац «Где я могу ошибаться».
- [x] Споры с отчётами 14, 22, 23, 26, 29, 30, 31, 32, 33, 34 и с WINNER названы, объяснено, кто прав.
- [x] Событие демо — из рыночных данных без трагедий. Газовый скачок из отчёта 22 (сбои в Ормузском проливе) исключён.
- [x] MVP не расширен: сверх плана 2,5 часа обязательных работ и 1 час по желанию.
- [x] Отсутствие отчёта 35 отмечено в начале.

---

## Источники

**Событие демо:**
- [Ukragroconsult: GDT +3%, WMP +5,9%](https://ukragroconsult.com/en/news/global-dairy-prices-rise-3-at-gdt-auction/)
- [Ukragroconsult: SMP — максимум с 2022 года](https://ukragroconsult.com/en/news/global-skimmed-milk-powder-prices-hit-highest-level-since-2022/)
- [Ukragroconsult, на русском](https://ukragroconsult.com/ru/news/mirovye-czeny-na-molochnuyu-produkcziyu-vyrosli-na-3-na-torgah-gdt/)
- [Dairy News: самый сильный рост WMP за год](https://dairynews.today/news/gdt_index_rises_3_as_milk_powders_gain_and_dairy_fats_fall_3057869.html)
- [Trading Economics: арабика, 6 ноября](https://tradingeconomics.com/commodity/coffee/news/599144)

**Конкуренты:**
- [PC Gamer: Offworld](https://www.pcgamer.com/offworld-trading-company-preview-a-cutthroat-rts-with-no-combat)
- [Destructoid: бесплатный мультиплеер Offworld](https://destructoid.com/offworld-trading-company-gets-free-to-play-multiplayer-mode)
- [PR Newswire: Landlord GO](https://prnewswire.com/news-releases/new-augmented-reality-game-lets-players-buy-and-sell-real-world-properties-301097529.html)
- [Pocket Gamer: Landlord GO](https://www.pocketgamer.com/landlord-go/how-landlord-go-uses-real-world-data-to-deliver-the-most-authentic-property-simu)
- [App Store: Monopoly GO](https://apps.apple.com/gb/app/monopoly-go/id1621328561)
- [Jackbox: How to play](https://jackboxgames.com/how-to-play)

**Рынок и деньги:**
- [Colonist.io: итоги 2025](https://blog.colonist.io/colonist-io-2025-summary)
- [Premier League: рекорды FPL 2024/25](https://www.premierleague.com/en/news/4320685/fpl-records-and-amazing-stats-from-202425)
- [RevenueCat 2025](https://www.revenuecat.com/state-of-subscription-apps-2025)
- [RevenueCat 2026](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026)
- [Paddle: комиссии](https://www.paddle.com/alternatives/stripe-vs-paypal)
- [Chess.com: планы](https://support.chess.com/article/442-what-is-the-difference-between-gold-vs-platinum-vs-diamond-memberships)
- [Dupple: обзор Confetti](https://dupple.com/reviews/confetti)
- [Listicler: цены Confetti](https://listicler.com/blog/confetti-pricing-breakdown-smb-virtual-team-building)

**Право:**
- [terms.law: условия Skillz](https://terms.law/Terms-Scanner/app/gaming/skills-based-platforms/skillz/)
- [OpenStreetMap: copyright](https://www.openstreetmap.org/copyright)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)

**Темп речи:**
- [VirtualSpeech](https://virtualspeech.com/?p=644)
- [Omni Calculator](https://www.omnicalculator.com/everyday-life/words-per-minute)

**Внутренние отчёты:** 14, 15, 22, 23, 24, 25, 26, 27, 29, 30, 31, 32, 33, 34. Ветки указаны в начале.

---

```text
=== ИТОГ ===
Исследователь: 50 — Питч и демо по секундам
Три главных вывода:
1. Демо и есть питч: 0:28–2:28 жюри само играет блиц 6×20 с (15 с решение + 5 с вскрытие) на своих телефонах на реальной улице площадки, спикер комментирует по сигналам экрана; всего 294 слова (2:16 при 130 сл/мин, 2:39 при 111). Отдельный слот демо — тот же блиц, в слот питча идёт версия на 1:00.
2. Реальное событие демо — аукцион Global Dairy Trade 3.11.2026 (WMP +5,9%, SMP — максимум с июня 2022): прогноз в R2, удар в R3 (+9% к молоку, оба числа на карточке), выигрывает тот, кто закрепил цену. «Рекордный кофе» устарел (арабика ~$2,80/фунт), газ ЕС исключён (сбои в Ормузском проливе — геополитика).
3. Слайд денег — две строки: 800 хостов × $5.99 × 12 = $57,5k + 45 War Night × $1 000 = $45k → $102,5k (после комиссий Paddle ~$92,6k). Резервы на сцене обязательны: свои телефоны, локальный сервер, replay без сети; «жюри не играет» → голосование руками; меньше времени → пресет blitz3 или видео.

ИДЕЯ: Street War — Read the news first. Bankrupt your friends.
Пользователь: Даниэль, 24 года, собирает четырёх друзей на игровой вечер по пятницам в Discord; играет в тайкуны и стратегии.
Боль: «I win tycoon games alone and nobody cares — and getting my friends into a real money war takes installs and an hour of rules.»
Продукт: браузерный матч на 10 минут: 3–6 друзей открывают кофейни на одной настоящей улице и тайно, одновременно воюют за тех же покупателей — цена, карты атак, пакт и предательство; рынок двигают реальные данные дня со ссылкой на источник, деньги считает код, пустые места занимают боты с меткой BOT.
Первая минута: хост кидает ссылку → друзья входят без регистрации → улица со своими витринами → раунд 1: только цена → вскрытие: покупатели уходят к демпингующему боту → раунд 2: прогноз «dairy costs rising — GDT, 3 Nov» и карта Lock milk price.
Не копипаст: Offworld Trading Company — экономическая RTS в реальном времени на Марсе для ПК; Landlord GO — коллекция виртуальных копий реальных зданий и рента (с торгами между игроками); Monopoly GO — кубики; Jackbox — комнаты по коду без экономики. У нас 10-минутная война за покупателей на реальной улице с телефона, рынок двигают реальные данные.
$100k/год: Host Pass $5.99/мес × 800 хостов × 12 = $57 504 + War Night для компаний $1 000 × 45 = $45 000 → $102 504 (800 хостов ≈ 2,5% от ~32 тыс. игроков в месяц, оценка).
Демо через 24 часа: жюри сканирует карточки A–D, играет блиц 6×20 с против друг друга и двух ботов на улице площадки; R2–R3 — прогноз и удар GDT со ссылкой; R4 — пакт двух судей; R5 — банкротство бота Дана; R6 — торги за его угол; итоги «кто кого разорил» и Revenge; слайд $102,5k.
Главный риск: живой мультиплеер на сцене и 15 секунд на решение для новичков — без двух прогонов и резервов (свои телефоны, LAN, replay) демо падает.
Оценки 1–10: боль 6 / оригинальность 7 / деньги 6 / реализуемость за 24ч 6 / глобальность 8

Чего избегать: слов learn, educational, financial literacy и «точного прогноза» со сцены; событий о войнах, катастрофах и «рекордном кофе» в демо; демо, зависящего от Wi-Fi площадки и живого новостного конвейера без проверенной вручную колоды.
```
