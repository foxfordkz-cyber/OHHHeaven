# Исследователь 47 — Проверка всех фактов (строгий режим)

## Вердикт в трёх строках

1. **Главный вывод.** Из 52 утверждений с числами подтверждены 30, неверны 12, проверить не удалось 10. Отчёт 30 точнее всех: 9 из 11 подтверждены, ошибок нет. У Gemini подтверждены 4 из 13 и 6 неверны, а все 3 проверенные цитаты Gemini с Reddit не нашлись. Главный довод «экономических PvP-игр на ПК почти нет, а одиночные бизнес-симуляторы продаются миллионами» подтвердился.
2. **Главный риск.** На слайд попадает цифра Gemini ($42,1 млн у Supermarket Simulator, рынок $1,91 млрд, цитата с Reddit) или онлайн из отчёта 29 (webDiplomacy, Prosperous Universe). Член жюри гуглит её за 30 секунд — и под сомнением весь питч.
3. **Первое действие на ближайший час.** Пользователь за 15 минут заменяет на слайдах все цифры на 10 фактов из раздела 5 и вычёркивает всё из раздела 6. Готово, когда у каждой цифры на каждом слайде стоит ссылка из этого отчёта.

## Что прочитано и как проверялось

- **Прочитаны:** `STRICT.md`, `CONTEXT.md`, `WINNER.md`, `HANDOFF.md`, `reports/15-synthesis.md`, `02-pain-evidence.md` (Claude), `02-pain-evidence-gemini.md`, `29-user-pain-v2.md`, `30-money-v2.md`.
- **Отчёта 21 (GPT, конкуренты версии 2) нет ни в одной из 14 веток репозитория.** Я проверил все ветки `claude/*`: есть только задание `prompts/21-pvp-competitors.md`. Работаю без него.
- **Как проверял.** Сетевая политика окружения закрывает прямое открытие страниц: steamcharts.com и vercel.com не резолвятся. Поэтому первоисточники я читал через веб-поиск с фильтром по домену самого источника: поиск возвращает текст страницы этого домена. Reddit и Business Insider закрыты даже для поиска, поэтому Reddit-цитаты проверены только по зеркалам Reddit.
- **Статусы:**
  - **Подтверждено** — число найдено в тексте страницы самого источника или в официальном документе.
  - **Неверно** — первоисточник даёт другое значение, ссылка ведёт не туда или формулировка искажает смысл.
  - **Не удалось проверить** — первоисточник недоступен, числа на нём нет или оно есть только на зеркале.
  - Пометка «устарело» значит, что число было верным на дату отчёта, а сейчас другое.

## 1. Выписка утверждений и 2. Проверка по первоисточникам

| № | Отчёт | Утверждение в отчёте | Статус | Правильное значение и комментарий | Первоисточник |
|---|---|---|---|---|---|
| 1 | 29 | Offworld Trading Company: в среднем 18–23 игрока онлайн (апр.–июн. 2026, Steambase) | Подтверждено | Steambase: июнь 2026 — 18, весна — 22–24. SteamCharts: среднее за 30 дней ≈24, месяцы 2026 года — 19–27. Пик за всё время 2 698 (май 2018). App ID 271240 | [Steambase](https://steambase.io/games/offworld-trading-company/steam-charts), [SteamCharts](https://steamcharts.com/app/271240) |
| 2 | 30, WINNER | Offworld: матч 20–30 минут (в WINNER — «долгие матчи (проверить)») | Подтверждено | Steam: «Skirmish Length: 20–30 minutes», PC Gamer: «a 20–30 minute sprint». Кампания — 3–4 часа на персонажа | [Steam](https://store.steampowered.com/app/1037200/Offworld_Trading_Company__Full_Game_Upgrade/), [PC Gamer](https://www.pcgamer.com/offworld-trading-company-review/) |
| 3 | 02 | Big Ambitions: 163 тыс. копий за первые 20 дней (GameDiscoverCo) | Подтверждено | ~163 тыс. за ~20 дней на 28.03.2023, по данным бэкенда Steam | [GameDiscoverCo](https://newsletter.gamediscover.co/p/deep-dive-how-big-ambitions-hit-it) |
| 4 | 02 | Big Ambitions: 600 тыс.+ копий по словам разработчика | Не удалось проверить | Пост Jonas Hovgaard от 4.12.2025 («sold more than 600,000 copies») нашёлся только на зеркале новостей Steam. Саму страницу Steam поиск не вернул | [зеркало eprison.de](https://www.eprison.de/spiele/big-ambitions/steam-news/1818118366173165/7322/110999.html) |
| 5 | Gemini | Big Ambitions: 919,1 тыс. копий и $16,8 млн (Gamalytic) | Подтверждено (это оценка) | Сейчас 912,7 тыс. (диапазон 612 тыс.–1,2 млн) и $16,7 млн ($11,2–22,2 млн). Это модельная оценка Gamalytic, а не данные издателя | [Gamalytic](https://gamalytic.com/game/1331550) |
| 6 | 02 | Big Ambitions: около 92% положительных из 12,7 тыс. отзывов | Подтверждено с поправкой | 91% из 6 315 англоязычных отзывов; 92% из 14 552 во всех языках (снимки разных дат) | [Steam](https://store.steampowered.com/app/1331550/Big_Ambitions/) |
| 7 | 02, Gemini | Big Ambitions стоит $22,99 (Gemini: $19,99–25,99) | Не удалось проверить | Цены в тексте страницы Steam в выдаче нет | [Steam](https://store.steampowered.com/app/1331550/Big_Ambitions/) |
| 8 | 02 | Supermarket Simulator: 2,6 млн копий и ~$27 млн (GameDiscoverCo) | Подтверждено, устарело | Это снимок середины 2024 года. В более поздней статье GameDiscoverCo — около 3,5 млн копий в Steam с февраля 2024; точную статью поиск не назвал | [GameDiscoverCo](https://newsletter.gamediscover.co/p/tcg-card-shop-simulator-the-second) |
| 9 | Gemini | Supermarket Simulator: 3,8 млн копий и $42,1 млн (Gamalytic /game/2670630) | Не удалось проверить | Страницу /game/2670630 поиск не находит. В таблицах «похожие игры» на других страницах Gamalytic у неё ~3,6 млн и ~$39,4 млн | [Gamalytic, таблица похожих игр](https://gamalytic.com/game/3293260) |
| 10 | Gemini | Captain of Industry: 704,2 тыс. и $16,2 млн, ссылка gamalytic.com/game/1331550 | Неверно | Ссылка ведёт на Big Ambitions. Страница игры — /game/1594320: 662,6 тыс. (433–892 тыс.), $15,3 млн | [Gamalytic](https://gamalytic.com/game/1594320) |
| 11 | Gemini | Mad Games Tycoon 2: 326,5 тыс. и $5,8 млн, ссылка /game/1331550 | Неверно | Ссылка неверна, правильная — /game/1342330: 324 тыс., $5,7 млн | [Gamalytic](https://gamalytic.com/game/1342330) |
| 12 | Gemini | Startup Company: 490,4 тыс. и $3,5 млн, ссылка /game/1331550 | Неверно | Ссылка неверна, правильная — /game/606800: 491,8 тыс., $3,5 млн | [Gamalytic](https://gamalytic.com/game/606800) |
| 13 | Gemini | Car Dealer Simulator: 536,3 тыс. и $8,4 млн (/game/4860970) | Не удалось проверить | Страницы с таким ID поиск не находит | — |
| 14 | 02 | Медианная игра со словом «Simulator» в Steam: ≈$70 тыс. и 5–7 тыс. копий | Подтверждено | GameDiscoverCo, игры за год до июля 2024 | [Game World Observer](https://gameworldobserver.com/2024/07/02/simulator-games-trend-drug-dealer-simulator-2-100k-copies) |
| 15 | Gemini | Симуляторы — 9,76% выручки Steam (~$1,06 млрд из $10,9 млрд) | Неверно (формулировка) | 9,76% — доля за всю историю Steam среди игр с выручкой больше $1 млн (GameDiscoverCo). Сумм $1,06 млрд и $10,9 млрд в источнике нет | [GameDiscoverCo](https://newsletter.gamediscover.co/p/which-genres-have-ruled-steam-a-new) |
| 16 | 02 | Топовые idle-игры в США: на пике $100–313 тыс. в неделю на приложение (Sensor Tower) | Подтверждено | iOS, США, Q1 2025: пиковые недели $104–311 тыс. (у Gold and Goblins — $311 тыс.) | [Sensor Tower](https://sensortower.com/blog/2025-q1-ios-top-5-idler%20games-revenue-us-602ae7fb241bc16eb874f8e1) |
| 17 | 29 | Prosperous Universe: пик за всё время 57 (Raijin) | Неверно | SteamCharts: 170 (апрель 2022); у Steambase — 62 (без 2022 года) | [SteamCharts](https://steamcharts.com/app/1761220) |
| 18 | 29 | Mall Rivals: пик 478, сейчас около 59 (SteamCharts) | Не удалось проверить | Страницы игры на SteamCharts в выдаче нет. Steambase на 07.04.2026: пик 414 (29.03.2026), онлайн 64 | [Steambase](https://steambase.io/games/mall-rivals/steam-charts) |
| 19 | 29 | Store Wars: пик 88 (SteamCharts) | Неверно | У Store Wars: Prologue пик 106 (декабрь 2024), среднее за 30 дней ≈18 | [SteamCharts](https://steamcharts.com/app/3308210) |
| 20 | 29 | webDiplomacy: 254 тыс. зарегистрированных и ~33,9 тыс. в активных партиях | Неверно | Счётчик на главной: 332–434 тыс. зарегистрированных и 5,6–8,1 тыс. играющих (снимки разных дат) | [webDiplomacy](https://webdiplomacy.net/) |
| 21 | 29 | Board Game Arena: 10 млн аккаунтов (2024) | Подтверждено | Счётчик на главной — около 10,9 млн игроков; есть новость о 9 млн | [BGA](https://en.boardgamearena.com/) |
| 22 | 29 | Премиум BGA стоит $36 в год | Неверно (устарело) | С 1 июля 2025 — 42 €/$ в год или 5 €/$ в месяц | [форум BGA](https://forum.boardgamearena.com/viewtopic.php?t=43040&start=60) |
| 23 | 29 | Фэнтези-спорт: 57 млн игроков в США и Канаде (FSGA, 2025) | Не удалось проверить | У FSGA этого числа нет. Сама FSGA пишет о 85 млн игроков в фэнтези-спорт в США и Канаде. Исследование 2026 года: 31% взрослых США (~82,8 млн) играли в фэнтези-спорт или ставили на спорт | [FSGA](https://members.thefsga.org/news/Details/new-fsga-research-details-growing-role-of-ai-prediction-markets-in-fantasy-sports-and-sports-betting-341850) |
| 24 | 29 | Prediction markets: объём за 2025 год — более $44 млрд | Подтверждено с уточнением | $44 млрд+ — это только Kalshi и Polymarket вместе. Весь сектор по другим оценкам — $50 млрд+ | [The Block](https://www.theblock.co/post/383733/prediction-markets-kalshi-polymarket-duopoly-2025) |
| 25 | Gemini | Рынок Business Simulation Games: $1,91 млрд, рост до $2,96 млрд к 2032 (Dataintelo) | Неверно | $1,91 млрд у Dataintelo — это life simulation (2025). Business simulation: $2,5 млрд (2023) → $5,8 млрд (2032); в другом отчёте того же издателя — $2,25 млрд (2025) | [Dataintelo](https://dataintelo.com/report/business-simulation-games-market) |
| 26 | 02 | Онлайн-симуляторы в 2025: ~$10,3 млрд, CAGR ~19% (TBRC) | Подтверждено с уточнением | $10,34 млрд (2025) и $12,3 млрд (2026). 18,9% — рост за один год; CAGR на 2026–2030 — 16,7% | [TBRC](https://www.thebusinessresearchcompany.com/report/online-simulation-games-global-market-report) |
| 27 | Gemini | Онлайн-симуляторы в 2026: $10,53–12,30 млрд, CAGR 13,1–18,9% | Подтверждено | Mordor: $10,53 млрд (2026) → $19,47 млрд (2031), CAGR 13,09%; TBRC — см. строку 26 | [Mordor Intelligence](https://www.mordorintelligence.com/industry-reports/global-online-simulation-games-market) |
| 28 | 02 | «Gaming simulation» в 2025: ~$12,0 млрд, CAGR ~6,9% (MRFR) | Неверно | По указанной ссылке MRFR даёт $35,51 млрд (2025) и CAGR 6,87% | [MRFR](https://www.marketresearchfuture.com/reports/online-simulation-games-market-22276) |
| 29 | 02 | Pew 2026: 53% взрослых США и 70% в возрасте 18–29 считают, что слишком много сидят в смартфоне | Подтверждено | Опрос 26.05–01.06.2026, 9 750 человек | [Pew](https://www.pewresearch.org/short-reads/2026/09/01/about-half-of-americans-say-they-spend-too-much-time-on-their-smartphone/) |
| 30 | 02 | Pew: 45% пытались сократить время, «лишь 25% из них считают, что преуспели» | Подтверждено с поправкой | 25% ответили «очень или крайне успешно», ещё 52% — «отчасти успешно» | [Pew](https://www.pewresearch.org/short-reads/2026/09/01/about-half-of-americans-say-they-spend-too-much-time-on-their-smartphone/) |
| 31 | 02 | Pew: 62% людей младше 30 говорят, что телефон портит им сон | Подтверждено | | [Pew, график](https://www.pewresearch.org/chart/a-majority-of-adults-under-30-say-their-smartphone-use-takes-a-toll-on-their-sleep/) |
| 32 | 02 | Harris Poll и Haidt: 47% Gen Z хотели бы, чтобы TikTok не изобрели, 50% — X | Подтверждено | Опрос 1 006 человек 18–27 лет | [The Harris Poll](https://theharrispoll.com/articles/gen-z-social-media-smart-phones/) |
| 33 | 02 | NBER: пользователи заплатили бы $28, чтобы TikTok отключили у всех | Неверно | $24 за 4 недели отключения TikTok у всех в кампусе, за Instagram — $6. С учётом тех, кто не пользуется, — $43 | [Brookings](https://www.brookings.edu/articles/product-market-traps-in-social-media-evidence-and-policy-implications/), [NBER w31771](https://www.nber.org/papers/w31771) |
| 34 | 02 | NBER: у 60% активных пользователей TikTok и 46% Instagram отрицательная полезность | Не удалось проверить | В тексте Brookings и NBER, которые вернул поиск, этих процентов нет | [NBER w31771](https://www.nber.org/papers/w31771) |
| 35 | 02 | Duolingo, Q3 2026: 13,1 млн платных подписчиков и 64,9 млн DAU | Подтверждено | Письмо акционерам от 03.11.2026 и форма 10-Q | [Duolingo IR](https://investors.duolingo.com/static-files/e1ee336e-b024-486f-875c-afd722653067), [SEC 10-Q](https://www.sec.gov/Archives/edgar/data/0001562088/000162828026069692/duol-20260930.htm) |
| 36 | 02 | GEM 2024/25: 49% не открыли бы бизнес из страха провала (44% в 2019); 47% среди видящих возможности; 43 из 51 экономики | Подтверждено | Источник — команда GEM в университете Глазго. На сайте GEM формулировка базы для 49% может отличаться | [Univ. of Glasgow](https://www.gla.ac.uk/schools/business/news/newsarchive/2025/headline_1148629_en.html) |
| 37 | 02 | The Diary Of A CEO: 21,3 млн подписчиков на YouTube (1.11.2026), самый подписываемый подкаст | Подтверждено, устарело | Сейчас 21,9 млн и второе место: Figuring Out with Raj Shamani — 22,1 млн | [Podnews](https://podnews.net/press-release/doac-youtube-number-one), [Podnews](https://podnews.net/press-release/raj-shamani-youtube-22) |
| 38 | Gemini | Хэштег #entrepreneur в TikTok — 22+ млрд просмотров (Globes) | Подтверждено, устарело | Снимок из статьи примерно 2022 года | [Globes](https://en.globes.co.il/en/article-tiktok-targets-israels-tech-sector-1001417100) |
| 39 | Gemini | #sidehustle — 11,4 млрд просмотров; 34% Gen Z берут финансовые идеи из TikTok (Business Insider, 2022) | Не удалось проверить | Business Insider закрыт для поиска | — |
| 40 | Gemini | EduBirdie 2026: у 61% Gen Z уведомления об экранном времени вызывают стресс и вину | Подтверждено | Маркетинговый опрос 2 000 человек, методика не раскрыта | [EduBirdie](https://edubirdie.com/blog/how-gen-zers-spend-their-free-time) |
| 41 | Gemini | EduBirdie: 60% считают осознанное использование времени статусным символом | Неверно (трактовка) | «Явный статусный символ» — 23%; ещё 37% это «отчасти впечатляет» | [EduBirdie](https://edubirdie.com/blog/how-gen-zers-spend-their-free-time) |
| 42 | 02 | Torn: $5 за 31 день статуса донатора | Подтверждено | Плюс 60 очков; подписка — $4,85 в месяц | [Torn Wiki](https://wiki.torn.com/wiki/Donator_Pack) |
| 43 | 30 | Jackbox: пакет покупает только хост, остальные заходят по коду; цена $24,99–29,99 | Подтверждено | «Only one person in your group needs to own a Jackbox product»; базовый пакет — $24,99 | [Jackbox](https://www.jackboxgames.com/how-to-play), [Jackbox](https://www.jackboxgames.com/games/packs/the-jackbox-party-pack-1) |
| 44 | 30 | Skillz закрывает денежные игры в 12 штатах (AZ, AR, CT, DE, IN, LA, ME, MT, SC, SD, TN, VT) | Не удалось проверить | Эти 12 штатов перечисляет только сторонний разбор (апрель 2026). Другой обзор ссылается на гайд Skillz от 23.06.2026, где штатов пять (AR, CT, DE, LA, SD). Официальной страницы Skillz в выдаче нет | [terms.law](https://terms.law/Terms-Scanner/app/gaming/skills-based-platforms/skillz/) |
| 45 | 30 | Chess.com: безлимитный разбор партий (Game Review) — только в Platinum и Diamond | Подтверждено | В Gold — один полный разбор в день | [Chess.com Support](https://support.chess.com/en/articles/8562418-what-does-each-level-of-premium-membership-get-me) |
| 46 | 30 | Chess.com: Gold $29, Platinum $49, Diamond $99 в год | Не удалось проверить | Официальной страницы цен в выдаче нет; на форуме — Platinum $79,99 и Diamond $119,99. Цены отчёта 30 устарели | [Chess.com Support](https://support.chess.com/en/articles/8562418-what-does-each-level-of-premium-membership-get-me) |
| 47 | 30 | Paddle: 5% + $0,50 за транзакцию | Подтверждено | | [Paddle](https://www.paddle.com/pricing) |
| 48 | 30 | RevenueCat: медианная конверсия freemium — 2,1–2,2% | Подтверждено | 2,18% в отчёте за 2025 год, 2,1% — за 2026 | [RevenueCat](https://www.revenuecat.com/state-of-subscription-apps-2025) |
| 49 | 30 | Durable Objects: 1 млн запросов в месяц, дальше $0,15 за млн; 20 WebSocket-сообщений = 1 запрос; $12,50 за 1 млн GB-s | Подтверждено | Ещё 400 тыс. GB-s включено. Минимальный платёж Workers Paid — $5 в месяц, в отчёте 30 его нет | [Cloudflare Docs](https://developers.cloudflare.com/durable-objects/platform/pricing/) |
| 50 | 30, 13 | Claude Haiku 5.5 — $0,10 / $0,50, Sonnet 5.5 — $2 / $10 за 1 млн токенов | Подтверждено | Цена Haiku действует для промптов до 100 тыс. токенов, дальше $0,50 / $2,50. Opus 5.5 — $4 / $20, поэтому расчёт отчёта 13 «≈$0,014 за вызов» верен: 1 500 × $4/1M + 400 × $20/1M | официальная документация Anthropic (навык claude-api), таблица моделей от 03.11.2026 |
| 51 | 30 | GDELT разрешает коммерческое использование со ссылкой на проект | Подтверждено | «unlimited and unrestricted use for any academic, commercial, or governmental use», ссылка на GDELT обязательна | [GDELT](https://www.gdeltproject.org/about.html) |
| 52 | 30 | NewsAPI: бесплатный план только для разработки, Business — около $449 в месяц | Подтверждено | Business — $449 в месяц, 250 тыс. запросов | [NewsAPI](https://newsapi.org/pricing) |

**Итог по отчётам:**

| Отчёт | Проверено | Подтверждено | Неверно | Не удалось проверить |
|---|---|---|---|---|
| 02 (Claude) | 19 | 14 | 2 | 3 |
| 02 (Gemini) | 13 | 4 | 6 | 3 |
| 29 | 9 | 3 | 4 | 2 |
| 30 (и общие с 13 и WINNER) | 11 | 9 | 0 | 2 |
| **Всего** | **52** | **30** | **12** | **10** |

**Решение.** Цифры отчёта 30 идут в модель денег без изменений, кроме цен Chess.com и списка штатов Skillz. Цифры Gemini не используем нигде, кроме строк 5, 27, 38 и 40, и только со ссылкой из этой таблицы. Делает пользователь, 10 минут. Готово, когда в слайдах и в `WINNER.md` не осталось ни одного числа без ссылки.

**Где я могу ошибаться.** Статус «подтверждено» опирается на текст страницы, который вернул поиск, а не на страницу, загруженную мной: поисковик мог взять число из соседнего блока. Именно так, похоже, ошибся Gemini с таблицами Gamalytic. Онлайн в Steam и оценки Gamalytic меняются каждый день, так что расхождение на 1–5% с отчётами — не ошибка. Строки со статусом «не удалось проверить» могут оказаться верными: Reddit, Business Insider и страницы цен Steam мне просто недоступны.

## 3. Отдельные проверки

### 3.1. Онлайн Offworld Trading Company

- **SteamCharts (app 271240):** среднее за 30 дней ≈24, пик за 30 дней — 53. Помесячно в 2026 году — от 19,3 (август) до 27,2 (сентябрь). Пик за всё время — 2 698 (5 мая 2018, SteamDB).
- **Steambase:** июнь 2026 — 18, весенние месяцы — 22–24, пик последних лет — 90 (28.12.2024).
- **Вывод.** Отчёт 29 прав: 18–23, а точнее 18–27 игроков онлайн. Это только Steam, другие магазины я не проверял.
- **Матч в Offworld** длится 20–30 минут (страница Steam, PC Gamer), а не «долгий» — так сказано в WINNER. Он в 2–3 раза длиннее нашего 10-минутного.
- **В Offworld есть прямые атаки:** динамит, ЭМИ, подкуп рабочих, чтобы те устроили забастовку ([превью PC Gamer](https://www.pcgamer.com/offworld-trading-company-preview-a-cutthroat-rts-with-no-combat/)). Значит, «атаки» нас не отличают. Отличают реальная улица, реальные данные, браузер и 10 минут.

### 3.2. Продажи Big Ambitions и Supermarket Simulator

| Игра | Источник | Значение | Тип цифры |
|---|---|---|---|
| Big Ambitions | GameDiscoverCo, 28.03.2023 | ~163 тыс. копий за ~20 дней | оценка по бэкенду Steam |
| Big Ambitions | разработчик, 4.12.2025 (только зеркало) | более 600 тыс. копий | заявление студии |
| Big Ambitions | Gamalytic, ноябрь 2026 | 912,7 тыс. копий (612 тыс.–1,2 млн), $16,7 млн | модельная оценка |
| Big Ambitions | SteamSpy | 0,5–1 млн владельцев | диапазон |
| Supermarket Simulator | GameDiscoverCo, середина 2024 | 2,6 млн копий, $27 млн (февр.–дек. 2024) | оценка |
| Supermarket Simulator | GameDiscoverCo, позже | около 3,5 млн копий в Steam с февраля 2024 | оценка |
| Supermarket Simulator | SteamSpy | 2–5 млн владельцев | диапазон |
| Supermarket Simulator | Gamalytic (таблица на чужой странице) | ~3,6 млн, ~$39,4 млн | модельная оценка |

**Решение для слайда:** «Supermarket Simulator — ~3.5M copies on Steam (GameDiscoverCo est.)» и «Big Ambitions — ~0.9M copies (Gamalytic est.), 91% positive reviews». Цифры Gemini «3,8 млн / $42,1 млн» не используем: их источник не находится.

### 3.3. Ссылки Gemini на Gamalytic

- В таблице Gemini 6 игр, и 4 из них ведут на одну страницу `gamalytic.com/game/1331550` — это Big Ambitions.
  - Для Big Ambitions ссылка верная.
  - Для Captain of Industry, Mad Games Tycoon 2 и Startup Company ссылки неверные. Правильные: `/game/1594320`, `/game/1342330`, `/game/606800`.
- Ещё две ссылки (Supermarket Simulator `/game/2670630` и Car Dealer Simulator `/game/4860970`) поиск не открывает.
- Числа Gemini отличаются от нынешних оценок Gamalytic на 0,3–6%. Скорее всего, Gemini переписал их из таблицы «похожие игры» на странице Big Ambitions и подставил её адрес.
- Отчёт 15 написал: «четыре разные игры ссылаются на одну страницу Gamalytic». Это подтвердилось точно.

### 3.4. Размер рынка бизнес-симуляторов

| Сегмент | Издатель | Значение |
|---|---|---|
| Business simulation games | Dataintelo | $2,5 млрд (2023) → $5,8 млрд (2032); в другом отчёте — $2,25 млрд (2025) |
| Life simulation games | Dataintelo | $1,91 млрд (2025) — именно это число Gemini выдал за бизнес-симуляторы |
| Online simulation games | TBRC | $10,34 млрд (2025), $12,3 млрд (2026) |
| Online simulation games | Mordor Intelligence | $10,53 млрд (2026) → $19,47 млрд (2031) |
| Online simulation games | MRFR | $35,51 млрд (2025) |

**Решение.** Слайда «размер рынка» не делаем: оценки одного и того же сегмента расходятся в 3,5 раза (с $10 млрд до $35 млрд). Если жюри спросит, отвечаем: «Analyst estimates for online simulation games range from ~$10B to ~$35B depending on definition; our plan is built bottom-up: rooms × paying hosts × price». Это строка для подготовки к вопросам жюри (агент 50), 2 минуты.

**Где я могу ошибаться.** Gamalytic мог переименовать или объединить страницы, и тогда ссылки Gemini когда-то были рабочими. Это ничего не меняет: сейчас по ним открывается другая игра. Онлайн Offworld — только Steam. Если игра живёт ещё и в Epic или GOG, реальный онлайн выше, но не на порядок: пик за всё время в Steam — 2 698.

## 4. Проверка цитат

| № | Отчёт | Цитата | Пост существует? | Те ли слова? | Ссылка |
|---|---|---|---|---|---|
| Ц1 | 02, 29 | «I want a loss scenario. A way to lose. You can't lose at most tycoon games now. There's no real challenge, and very little actual management in most of them.» | Да: r/tycoon, тред разработчика Galacticare, 04.01.2024 | Фразы найдены, но только на зеркале Reddit; reddit.com мне закрыт | [зеркало](https://reddit.birdcat.cafe/r/tycoon/comments/18yfowu/best_improvements_to_tycoon_games_and_what_do_you) |
| Ц2 | 02, 29 | «When you get to a certain point, you just don't know where or on what to spend money on and it becomes boring really fast.» (Steam, Big Ambitions) | Конкретная тема не нашлась | Дословно не найдено. Тот же смысл есть в темах «I am rich but bored!» и «After opening ~10 business, nothing else matters» | [Steam](https://steamcommunity.com/app/1331550/discussions/0/3790381090379740461), [Steam](https://steamcommunity.com/app/1331550/discussions/0/6620895347248456074/) |
| Ц3 | 02, 29 | «Most business tycoon games have the same problem: too much money after some time…» | Да | Да | [Automation forum](https://discourse.automationgame.com/t/common-problem-of-nearly-all-business-tycoon-games/2919) |
| Ц4 | 02 | «Then a few days later the emptiness of it and existence in general hits me and I stop.» | Да: r/incremental_games, «Dealing with the emptiness», 19.09.2022 | Тред и тема совпадают, фраза «existence in general» не подтверждена | [зеркало](https://axebps-redlib.hf.space/r/incremental_games/comments/ximzwd/dealing_with_the_emptiness) |
| Ц5 | 02 | «a vague sense of having both accomplished something, but also, somehow, less than nothing.» (AV Club) | Да | Близко, но не дословно: на сайте «translating time into a vague sense of accomplishment but also, somehow, less than nothing» | [AV Club](https://www.avclub.com/confessions-of-an-idle-gamer-1832949532) |
| Ц6 | Gemini | «The guilt after scrolling was destroying me more than the scrolling itself.» (r/nosurf) | Не найдено: точная фраза не встречается ни на одной странице в выдаче | Не подтверждено | reddit.com/r/nosurf/comments/1r9rbne — закрыт |
| Ц7 | Gemini | «Do you know any decent tycoon/management games for android/iOS? They should be reasonably complex and realistic…» (r/tycoon) | Не найдено | Не подтверждено | reddit.com/r/tycoon/comments/g7udsd — закрыт |
| Ц8 | Gemini | «You're getting your dopamine from watching braggarts… getting high on copium.» (r/Entrepreneur) | Не найдено | Не подтверждено | reddit.com/r/Entrepreneur/comments/1okdwo5 — закрыт |
| Ц9 | Gemini | «…pay 7.99 a week to "disable ads" or you have to watch 5 ads to continue playing.» (App Store, Airline Tycoon) | Да: отзыв июня 2025; в описании приложения подписка $7,99 в неделю | Смысл совпадает, дословность в выдаче не видна | [App Store](https://apps.apple.com/gb/app/airline-tycoon-the-game/id6476063692) |
| Ц10 | 29 | «This AI cheats. Even with no competitors.» (Transport Fever 2) | Да | Да | [Steam](https://steamcommunity.com/app/1066780/discussions/0/6192985336590620311/) |
| Ц11 | 29 | «cheating AI to compensate bad programming» (Railway Empire) | Да | Да, пункт 1 в списке претензий | [Steam](https://steamcommunity.com/app/503940/discussions/0/1693785669863014881/) |
| Ц12 | 29 | «I still find every match exhilarating.» (GameSpot, Offworld) | Да, обзор с оценкой 9/10 | Да | [GameSpot](https://www.gamespot.com/reviews/offworld-trading-company-review/1900-6416420/) |
| Ц13 | 29 | «you're competing in every part of the game», «full of moves and counter-moves» (Food Chain Magnate) | Да: r/boardgames, Game of the Week, декабрь 2017 | Да, но только на зеркале Reddit | [зеркало](https://lr.in.psf.lt/r/boardgames/comments/7hx39g/game_of_the_week_food_chain_magnate/dqutelo/?context=3) |

**Итог по 13 цитатам:**
- слова совпадают на первоисточнике — 4 (Ц3, Ц10, Ц11, Ц12);
- совпадают только на зеркале Reddit — 2 (Ц1, Ц13);
- пост есть, но слова не подтверждены или отличаются — 3 (Ц4, Ц5, Ц9);
- не найдено — 4 (Ц2, Ц6, Ц7, Ц8).

Все 3 проверенные цитаты Gemini с Reddit не нашлись.

**Решение.**
- **На слайд идут Ц10, Ц12 и Ц3.**
- **Ц1, самую сильную цитату про боль**, пользователь за 2 минуты открывает с телефона на reddit.com. Если пост на месте и слова те же, ставим её на слайд. Если нет — заменяем на Ц10.
- **Ц6, Ц7 и Ц8 не используем совсем.**

**Где я могу ошибаться.** «Не найдено» не значит «выдумано». ID постов у Gemini (1r9rbne, 1okdwo5) похожи на настоящие ID Reddit за 2025–2026 годы, а Reddit закрыт и для меня, и для поисковика. Посты могут существовать. Но на слайд мы ставим только то, что открывается по ссылке, а эти три цитаты сейчас не открывает никто из нас.

## 5. Десять фактов, которые можно ставить на слайд

Формулировки на английском — готовый текст для слайда. Делает пользователь вместе с агентом 50 (питч), 15 минут. Готово, когда каждая строка стоит на слайде с подписью источника мелким шрифтом.

| № | Текст для слайда | Источник | Зачем на слайде |
|---|---|---|---|
| 1 | «70% of US adults under 30 say they spend too much time on their phone.» | [Pew Research Center, 2026](https://www.pewresearch.org/short-reads/2026/09/01/about-half-of-americans-say-they-spend-too-much-time-on-their-smartphone/) | ответ на вопрос трека «What makes downtime feel wasted?» |
| 2 | «Tycoon players are tired of fake rivals: "This AI cheats. Even with no competitors."» | [Steam, Transport Fever 2](https://steamcommunity.com/app/1066780/discussions/0/6192985336590620311/) | боль: соперник-ИИ не настоящий |
| 3 | «"Most business tycoon games have the same problem: too much money after some time."» | [Automation forum](https://discourse.automationgame.com/t/common-problem-of-nearly-all-business-tycoon-games/2919) | боль: деньги теряют смысл |
| 4 | «Business sims sell: Supermarket Simulator ~3.5M copies on Steam (GameDiscoverCo est.); Big Ambitions ~0.9M (Gamalytic est.), 91% positive.» | [GameDiscoverCo](https://newsletter.gamediscover.co/p/tcg-card-shop-simulator-the-second), [Gamalytic](https://gamalytic.com/game/1331550), [Steam](https://store.steampowered.com/app/1331550/Big_Ambitions/) | спрос на «настоящую» экономику есть |
| 5 | «The closest multiplayer money war, Offworld Trading Company, has ~20–27 players online on Steam in 2026; a match takes 20–30 min.» | [SteamCharts](https://steamcharts.com/app/271240), [Steam](https://store.steampowered.com/app/1037200/Offworld_Trading_Company__Full_Game_Upgrade/) | ниша PvP-экономики пуста; мы — 10 минут в браузере |
| 6 | «"I still find every match exhilarating." — GameSpot, Offworld Trading Company (9/10)» | [GameSpot](https://www.gamespot.com/reviews/offworld-trading-company-review/1900-6416420/) | сам формат «экономическая дуэль» нравится |
| 7 | «Friends already play together in the browser: Board Game Arena counts ~10.9M registered players.» | [Board Game Arena](https://en.boardgamearena.com/) | канал «браузер + друзья» |
| 8 | «One host pays, everyone plays: with Jackbox "only one person in your group needs to own" the game; others join from a browser.» | [Jackbox](https://www.jackboxgames.com/how-to-play) | прецедент модели «платит хозяин комнаты» |
| 9 | «People act on real news to win: Kalshi + Polymarket traded $44B+ in 2025.» | [The Block](https://www.theblock.co/post/383733/prediction-markets-kalshi-polymarket-duopoly-2025) | реальные новости как оружие |
| 10 | «Median freemium app converts 2.18% of users to paid (RevenueCat 2025) — our plan assumes ~2%.» | [RevenueCat](https://www.revenuecat.com/state-of-subscription-apps-2025) | честная конверсия в модели денег |

Для ответов на вопросы жюри, не для слайдов:
- GDELT разрешает коммерческое использование со ссылкой на проект ([GDELT](https://www.gdeltproject.org/about.html)).
- Комиссия Paddle — 5% + $0,50 ([Paddle](https://www.paddle.com/pricing)).
- Durable Objects стоят $0,15 за 1 млн запросов при минимальном платеже $5 в месяц ([Cloudflare](https://developers.cloudflare.com/durable-objects/platform/pricing/)).

**Где я могу ошибаться.** Факт 4 не доказывает спрос именно на PvP: одиночные симуляторы покупают одиночки. Вместе с фактом 5 он означает «экономика продаётся, PvP-экономика на ПК — нет», и это неудобная правда для нашей идеи. Факт 7 — зарегистрированные аккаунты, а не одновременный онлайн. Факт 9 — объём денег на рынках предсказаний, а не доказательство того, что игрокам нужны новости в игре: прямых запросов на новости в игре отчёт 29 не нашёл.

## 6. Что нельзя использовать и чем заменить

| Утверждение | Откуда | Почему нельзя | Замена |
|---|---|---|---|
| «Supermarket Simulator собрал $42,1 млн, 3,8 млн копий» | Gemini | страница-источник не находится | «~3.5M copies on Steam (GameDiscoverCo est.)» |
| Captain of Industry, Mad Games Tycoon 2, Startup Company со ссылкой на Gamalytic | Gemini | ссылки ведут на страницу Big Ambitions | правильные ссылки из строк 10–12 таблицы или не упоминать |
| «Business Simulation Games — $1,91 млрд → $2,96 млрд к 2032» | Gemini | это life simulation, а не бизнес-симуляторы | слайд о размере рынка не делаем (раздел 3.4) |
| «Gaming simulation — $12,0 млрд (MRFR)» | 02 | по ссылке $35,51 млрд | не использовать |
| «Симуляторы — 9,76% выручки Steam, $1,06 млрд из $10,9 млрд» | Gemini | долларовых сумм в источнике нет, а 9,76% — доля за всю историю Steam | «Simulators: 9.76% of lifetime Steam revenue among $1M+ games (GameDiscoverCo)» или не использовать |
| «webDiplomacy: ~33,9 тыс. в активных партиях» | 29 | на счётчике сайта 5,6–8,1 тыс. играющих | «webDiplomacy: 330k+ registered, ~6–8k playing» |
| «Prosperous Universe — пик 57», «Store Wars — пик 88» | 29 | на SteamCharts 170 и 106 | 170 и 106 (Store Wars: Prologue) |
| «Mall Rivals — пик 478» | 29 | не находится | «peak 414 (Steambase, March 2026)» |
| «57 млн игроков в фэнтези-спорт (FSGA)» | 29 | у FSGA такого числа нет | «31% of US adults (~83M) played fantasy sports or bet on sports in the past 12 months (FSGA / Angus Reid, 2026)» |
| «BGA Premium — $36 в год» | 29 | цена с июля 2025 — $42 | «$42/yr» |
| «Skillz закрыт в 12 штатах» | 30 | источники противоречат (12 или 5 штатов) | «Cash skill tournaments are restricted in several US states; the list changes» — решение отчёта 30 (без платных турниров) остаётся |
| «Chess.com: Gold $29, Platinum $49, Diamond $99» | 30 | цены устарели | «Chess.com sells unlimited Game Review only in its top tiers» |
| «NBER: $28, чтобы TikTok отключили у всех» | 02 | в источнике $24 | «$24 for 4 weeks» или не использовать |
| «NBER: 60% пользователей TikTok — отрицательная полезность» | 02 | процентов в источнике не нашлось | «47% of Gen Z wish TikTok had never been invented (Harris Poll)» |
| «Лишь 25% преуспели в сокращении экранного времени» | 02 | 25% — это «очень успешно», а ещё 52% — «отчасти» | «Only 1 in 4 who tried say they cut back very successfully» |
| «60% Gen Z считают осознанное время статусным символом» | Gemini | «явный статусный символ» — 23% | не использовать |
| «DOAC — самый подписываемый подкаст на YouTube» | 02 | первое место уже занято | «21.9M YouTube subscribers (Podnews)» или не использовать |
| «#entrepreneur — 22 млрд просмотров», «#sidehustle — 11,4 млрд» | Gemini | снимок 2022 года; Business Insider не открывается | не использовать |
| Цитаты Ц6, Ц7, Ц8 с Reddit | Gemini | посты не находятся | Ц10, Ц12, Ц3 |
| «Big Ambitions — 600 тыс.+ копий» | 02 | есть только на зеркале новостей Steam | «~0.9M copies (Gamalytic est.)» до проверки поста на Steam |
| «Offworld — долгие матчи» | WINNER | матч длится 20–30 минут | «20–30 min matches, PC only, Mars» |

**Решение.** Пользователь удаляет эти утверждения из `WINNER.md` и слайдов, 10 минут. Готово, когда поиск по `WINNER.md` и тексту слайдов не находит «$42», «1,91», «33,9», «57 млн», «$36», «$28» и «долгими матчами».

**Где я могу ошибаться.** Я могу быть строже, чем нужно. Список Skillz из 12 штатов, возможно, верен для части их игр, а цитаты Gemini могут существовать. Но за ошибку на слайде мы платим доверием жюри, а за лишнюю осторожность — ничем: каждой вычеркнутой цифре есть подтверждённая замена.

## 7. Спор с отчётами

1. **WINNER.md:** «Эта боль подтверждена цитатами в обоих отчётах 02». Отчасти неверно.
   - В отчёте 02 Claude главные цитаты нашлись: Ц1 — на зеркале, Ц3 — дословно, Ц4 и Ц5 — по смыслу.
   - В отчёте Gemini не нашлась ни одна из трёх проверенных цитат с Reddit.
   - **Кто прав:** формулировку нужно сузить до «подтверждена цитатами из отчётов 02 (Claude) и 29».
2. **Gemini, блок ИТОГ:** «Supermarket Simulator собрал $42,1 млн, Big Ambitions — $16,8 млн». Для Big Ambitions это верно как оценка Gamalytic. Для Supermarket Simulator источник не находится. **Прав GameDiscoverCo:** ~3,5 млн копий.
3. **Gemini:** «Ниша именно Business Simulation Games оценивается в $1,91 млрд». Неверно: это life simulation. **Прав сам Dataintelo:** $2,25–2,5 млрд.
4. **Отчёт 29:** «webDiplomacy — 254 тыс. зарегистрированных и около 33,9 тыс. человек в активных партиях» и вывод «Многолюдно там, где есть друзья + браузер + предательство».
   - Цифра неверна: 5,6–8,1 тыс. играющих.
   - Вывод держится на BGA (10,9 млн аккаунтов), но доказательство слабее, чем написано.
   - **Кто прав:** направление вывода отчёта 29 верно, цифра — нет.
5. **Отчёт 29:** «Prosperous Universe — пик за всё время 57». На SteamCharts — 170. Вывод «ниша крошечная» не меняется.
6. **HANDOFF.md:** «Факты из отчётов не проверены: цифры Gemini и цифры отчёта 29 про Offworld». Цифра 29 про Offworld подтвердилась (18–27 онлайн). Не подтвердились цифры 29 по другим играм и цифры Gemini.
7. **Отчёт 15:** «Часть ссылок сомнительна: четыре разные игры ссылаются на одну страницу Gamalytic». **Отчёт 15 прав полностью.**
8. **Отчёт 30:** «Skillz закрывает денежные игры в 12 штатах». Не проверяется, источники расходятся. Решение «без турниров со взносом» верно и без этого числа.
9. **Отчёт 02 (Claude):** «$28» и «лишь 25% преуспели». Ошибки неопасные: тема — соцсети, а не наша игра. Исправлено в разделе 6.

**Где я могу ошибаться.** Я сужаю доказательную базу боли до отчётов 02 (Claude) и 29. Если Reddit-цитаты Gemini найдутся, база снова станет шире. Но даже тогда эти цитаты про скроллинг и вину, а не про экономическую войну с друзьями. Для нашей идеи они второстепенны.

## 8. ИТОГ

```text
=== ИТОГ ===
Исследователь: 47 — Проверка всех фактов
Три главных вывода:
1. Из 52 утверждений с числами подтверждены 30, неверны 12, проверить не удалось 10. Самый точный — отчёт 30 (9 из 11, ошибок нет), самый слабый — Gemini (4 из 13; 3 ссылки Gamalytic ведут на страницу Big Ambitions; «$1,91 млрд» — это life simulation, а не бизнес-симуляторы). В отчёте 29 неверны 4 из 9 цифр: Prosperous Universe, Store Wars, webDiplomacy, цена BGA.
2. Главный довод подтвердился: ближайший PvP-аналог Offworld держит 18–27 игроков онлайн в Steam в 2026 году (пик 2 698 в 2018), матч длится 20–30 минут. Одиночные бизнес-симуляторы продаются миллионами: Supermarket Simulator ~3,5 млн копий, Big Ambitions ~0,9 млн (оценка Gamalytic). Экономика продаётся, PvP-экономика на ПК — нет; ставка только на формат «браузер + друзья».
3. Из 13 цитат дословно на первоисточнике подтверждены 4 (две на Steam, GameSpot, форум Automation), ещё 2 — только на зеркале Reddit. Все 3 проверенные цитаты Gemini с Reddit не найдены. На слайды идут только 10 фактов из раздела 5.

ИДЕЯ: Street War — Read the news first. Bankrupt your friends.
Пользователь: Даниэль, 24 года, младший аналитик; по пятницам собирает 3–5 друзей в Discord и выбирает, во что играть.
Боль: «In tycoons I beat dumb AI alone; with my friends there's no money war we can finish in one evening.»
Продукт: браузерный матч на 3–6 друзей за 10 минут на одной реальной улице: тайные одновременные ходы, демпинг, торги за аренду, сговор и предательство; события из открытых данных со ссылкой на источник.
Первая минута: хост кидает ссылку в Discord → друзья заходят без регистрации → улица и событие с источником → 30 секунд на тайный ход → вскрытие: кто-то уже в минусе.
Не копипаст: Offworld Trading Company — ПК, Марс, матч 20–30 минут, 18–27 игроков онлайн в Steam; Jackbox — комнаты в браузере без экономики; Big Ambitions — одиночная игра. У нас реальная улица, реальные данные, браузер и 10 минут.
$100k/год: хост платит Pro $5,99 в месяц; после Paddle (5% + $0,50) остаётся ≈$5,19 → $8 300 / $5,19 ≈ 1 600 платящих хостов; при медианной конверсии freemium 2,18% (RevenueCat 2025) это ≈73 тыс. активных в месяц (оценка). Без B2B-канала из отчёта 30 цель за год не достигается.
Демо через 24 часа: комната по QR, 4 члена жюри и 2 бота, 6 раундов по 20 секунд, одно событие из реальных данных со ссылкой на источник, банкротство соперника на экране.
Главный риск: недоказанный спрос на PvP-экономику — у ближайшего аналога Offworld 18–27 игроков онлайн в Steam.
Оценки 1–10: боль 6 / оригинальность 7 / деньги 4 / реализуемость за 24ч 6 / глобальность 8

Чего избегать: 1) цифр Gemini без первоисточника ($42,1 млн, $1,91 млрд, цитаты с Reddit); 2) слайда о размере рынка — оценки одного сегмента расходятся от $10 до $35 млрд; 3) цифр онлайна из отчёта 29, кроме Offworld.
```

## Чек-лист сдачи

- [x] **В таблице не меньше 30 строк со статусом и ссылкой.** 52 строки; у 49 есть ссылка. У строк 13 и 39 ссылки нет, потому что источник не открывается; у строки 50 источник — официальная документация Anthropic без URL.
- [x] **Ни одного статуса «подтверждено» без открытого первоисточника.** «Подтверждено» стоит только там, где число найдено в тексте страницы самого источника (через поиск с фильтром по его домену) или в официальном документе. Всё, что найдено только на зеркалах (Big Ambitions 600 тыс.+, цитаты Ц1 и Ц13), помечено «не удалось проверить» или «только на зеркале».
- [x] **Отдельно проверены:** онлайн Offworld (3.1), продажи Big Ambitions и Supermarket Simulator (3.2), ссылки Gemini на Gamalytic (3.3), размер рынка бизнес-симуляторов (3.4).
- [x] **Проверены 13 цитат** (нужно 10) — раздел 4.
- [x] **10 фактов для слайда с источниками** — раздел 5.
- [x] **Список запрещённых утверждений с заменами** — раздел 6.
- [x] **Вердикт в начале, «Где я могу ошибаться» в каждом разделе, спор с отчётами** — раздел 7.
- [x] **Слова learn, educational и financial literacy в текстах для жюри не используются.**
- [x] **Отчёт 21:** его нет ни в одной ветке, это указано в начале.
