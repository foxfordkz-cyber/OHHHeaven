# D12 — проверка чисел пакета кафе по первоисточникам

Исследователь D12, ниша `cafe`, 14 ноября 2026. База: `packs/cafe.json` версии 2 (ветка `claude/keen-cray-yytcbp`, со спросом по прохожим, ремонтом по площади и покупкой готовой кофейни) и `packs/_common.json` из основной ветки.

Сдано: `D12-number-check.json` (записи кафе), `D12-number-check.common.json` (записи общего пакета), этот отчёт, `D12-linkcheck.tsv` (проверка всех ссылок), `D12-src/` (сборка фрагмента, таблиц и этого отчёта: `python3 packs/parts/cafe/D12-src/D12-build.py`), `D12-JOURNAL.md`. Фрагмент, влитый в пакет v2 и в `_common`, проходит `node build/validate-pack.mjs`: кафе — 0 ошибок и 0 предупреждений, общий — 0 ошибок, 1 старое предупреждение (bribery).

## 1. Вердикт

1. Главное в пакете верно: минимальная зарплата NYC $17.00 и tip credit $11.35 + $5.65 (и на 2027 год: роста 1 января не будет, сработал off-ramp), налог с продаж 8.875%, FSE $280, FPC $24, Dining Out $1,050 + $1,500, санитарные штрафы, штрафы штата за налоги и зарплату.
2. Неверно или устарело 12 записей с числами: кофемолка E65S снята с производства ($2,099 → $3,099), бариста $21 выше рынка (медиана NYC $17.57 с чаевыми → $18), штраф 28-06 $100 → $200, I-9 $290–2,900 → $288–2,861, срок FSE 21 → 22 дня, раковины $1,720 → $1,519, готовая кофейня 0.2 → 0.4 годовой выручки, строительные леса −10% на 3 месяца → −7% на 6 месяцев, больничные $70 → $60, длинные часы $2,300 → $2,000.
3. Из 68 оценок разобраны все: 7 исправлены, 2 стали `verified`, у 41 проверены входные числа (сама цифра — решение или арифметика, остаётся `estimate` с уточнённым расчётом), 18 без первоисточника — в разделе «Не найдено».
4. Заново открыты 39 чисел, уже помеченных `verified`: 32 совпали (раздел 4б), 7 исправлены — две кофемолки сняты с продажи, срок FSE 22 дня, штраф 28-06 $200, потолок 02G $600, статьи закона об уличных столиках, три разных штрафа по 04A. У всех 8 вариантов рычагов и 20 срезанных углов (8 кафе + 12 общих) теперь есть `source`, `confidence` и расчёт.
5. Ссылки: из 96 в пакетах открываются и ведут на заявленное 58; 19 отвечают 403 на автоматический запрос (весь nyc.gov — защита Akamai, ещё NYSERDA, USCIS, amlegal, Gusto, KaTom), 18 вне сети сессии, 1 — 429 (Square). Числа с nyc.gov сверены через поиск и зеркала (rules.cityofnewyork.us, nyc-business.nyc.gov), но заново не открыты — это главный остаток работы.

## 2. Что добавлено, по разделам

| Раздел | Кафе | Общий | Что |
|---|---|---|---|
| `setup` | 6 | — | кофемолка и вторая кофемолка, раковины, FSE (22 дня, +$25 за мороженое), Bunn увиден, Dining Out (статистика Comptroller) |
| `roadmap` | 1 | — | срок FSE 22 дня |
| `staff` | 2 | — | бариста $18 по NY DOL; бригадир $24 подтверждён (`verified`) |
| `monthlyCosts` | 1 | — | больничные $60 и новые 32 часа неоплачиваемого отпуска с 22.02.2026 |
| `violations` | 4 | 4 | дезинсекция (28-06 $200), FPC (три разных числа), испорченная еда ($600 потолок), уличные столики (статьи закона); I-9, неподача деклараций, нет workers' comp (уголовная часть), больничные ($500 на работника в год по правилам DCWP 2026) |
| `taxes` | — | 4 | FUTA 2026 подтверждён, workers' comp (−21.9% с 1.10.2026), UI (доля при $18), DBL/PFL (минимум $60) |
| `events` | 4 | — | строительные леса (исследование 2024), Restaurant Week 2027, кофе (сигнал — арабика IMF), молоко |
| `levers` | 5 рычагов, 8 вариантов | — | у каждого числа источник и расчёт; `hours.long` $2,000 |
| `shortcuts` | 8 | 12 | у каждого числа источник и расчёт |
| `unit`, `extra.tipCredit`, `extra.takeover`, `extra.statutory` | 3 | 1 | уточнённые расчёты и пометки |
| `extra.eventCatalog` | 3 | — | предложение $17.60 с 1 марта 2027, новые правила лесов, снижение стоимости workers' comp |
| `extra.mechanics` | 3 | — | налоги с потолком на работника, облагаемая доля продаж, округ публикации LLC |
| `extra.d12CheckedUnchanged` | 32 | — | перепроверенные числа: где, значение, ссылка, что увидено |
| `sources` | 13 | — | новые первоисточники |

## 3. Пятнадцать самых неочевидных находок

1. **Зарплата 1 января 2027 года не вырастет.** NY DOL: сработал один из «off-ramps» закона 2023 года, NYC остаётся $17.00. Губернатор предлагает $17.60 с 1 марта 2027, если согласится законодательное собрание — это событие, объявляемое заранее (`extra.eventCatalog.min_wage_march_2027_proposal`).
2. **Tip credit сгорает за день, если бариста больше двух часов (или 20% смены) делал работу без чаевых** — мыл посуду, принимал товар. Для кофейни, где все делают всё, tip credit почти недоступен. Это объясняет, почему пакет не берёт его.
3. **Официальная статистика зарплат включает чаевые.** Медиана работников стойки NYC — $17.57 в час, средняя — $18.90 (NY DOL OEWS на I квартал 2026). Значит, $21 «плюс чаевые» — это выше рынка, и модель первого прохода переплачивала ~$1,900 в месяц.
4. **Три документа города дают три разных штрафа за отсутствие сертифицированного менеджера:** $400 (сводная таблица Appendix 23-C), $600 (текст правила 2021 года), $500–1,000 «и вдвое после второго» (страница NYC Business). То же с вредителями: $200–350 против $500–1,000. Юридически действует таблица.
5. **Нет договора с дезинсектором на месте — отдельный штраф $200 (при неявке на слушание $400),** сверх штрафа за самих грызунов. В пакете было $100.
6. **Кофемолка, которую пакет считает стандартом, снята с производства в 2025 году.** Цены «как в жизни» стареют: в 2026 году реальная замена стоит на 48% дороже.
7. **Строительные леса у входа — не −10%, а −3.5…−9.7% транзакций у ресторанов в первые 6 месяцев** (исследование города с Mastercard, 2024). С января 2026 разрешение на леса живёт 90 дней, после 180 дней владелец здания платит до $6,000 в месяц — леса стали короче.
8. **Готовая кофейня в жизни стоит вдвое дороже, чем в игре:** медиана проданной кофейни — 0.41 годовой выручки и 2.2 годовой прибыли владельца (BizBuySell). Северо-восток при этом самый дешёвый регион: рестораны идут по 2.05 прибыли.
9. **Уличные столики: из ~5 000 заявок с 2024 года одобрено 28.6%, из 388 заявок 2026 года — одна** (Comptroller, 27.10.2026). Обещанные 8 месяцев — фикция; срезанный угол «поставить столики без лицензии» в жизни соблазнителен именно поэтому. Зато с 2026 года уличная посадка на проезжей части разрешена круглый год.
10. **Без workers' comp при пяти и меньше работниках — не только $2,000 за каждые 10 дней, но и misdemeanor со штрафом $1,000–5,000**; к первому письму WCB сумма обычно уже больше $12,000.
11. **Минимальный взнос за страхование нетрудоспособности — $60 в год на работодателя**, при $17.68 на человека. У кофейни с тремя работниками фактическая ставка выше расчётной в 1.1 раза.
12. **Стоимость workers' comp в штате упала на 21.9% с 1 октября 2026** (решение DFS по заявке NYCIRB). Срезать этот угол стало ещё менее выгодно.
13. **Не всё в кофейне облагается налогом:** булочки целиком и зерно в пачке «с собой» в виде, как в магазине, не облагаются; кофе с собой, всё подогретое, сэндвичи и всё съеденное в зале — облагается (бюллетень TB-ST-806, пример с бейгл-шопом).
14. **Публикация LLC стоит $1,475 в Бруклине и $395 в Олбани** — зависит от округа офиса, указанного в учредительных документах. Законно только с настоящим адресом офиса в этом округе.
15. **«Нет больничных» как правило заведения стоит $500 на каждого работника за каждый год**, сверх оплаты пропущенных часов (правила DCWP о protected time off, в силе с 23.07.2026). И ещё с 2026 года каждому работнику положено 32 часа неоплачиваемого отпуска с первого дня работы и с каждого 1 января. (Попутно: магазин обязан брать наличные, но может не брать купюры больше $20 — 6 RCNY §6-72.)

## 4. Исправления существующего пакета

Ниже — таблица «было → стало → источник» для всех исправленных записей (собрана `D12-build.py` из `D12_patches.py`; поле `note` в таблицу не выводится, полный текст — во фрагменте). Исправление сделано тем же `id`.


| Запись | Было | Стало | Пометка | Источник | Почему |
|---|---|---|---|---|---|
| cafe: `setup[grinder]` | name="Espresso grinder"; cost=2099; confidence="verified" | name="Espresso grinder (Mahlkonig E65W)"; cost=3099; confidence="verified" | verified | https://visionsespresso.com/coffee-grinders/brands/mahlkonig/ | E65S за $2 099 снята с производства и нет в наличии: купить её в 2026 году нельзя; ставлю её преемника по той же странице |
| cafe: `setup[decaf_grinder]` | name="Second grinder for decaf"; cost=2099; confidence="verified" | name="Second grinder for decaf (Mahlkonig E65W)"; cost=3099; confidence="verified" | verified | https://visionsespresso.com/coffee-grinders/brands/mahlkonig/ | та же причина: E65S больше не продаётся |
| cafe: `setup[sinks]` | cost=1720; source="https://www.webstaurantstore.com/regency-60-16-gauge-stainless-steel-three-compartment-commercial-sink-without-drainboards-17-x-17-x-12-bowls/600S31717X.html" | cost=1519; source="https://www.webstaurantstore.com/regency-60-16-gauge-stainless-steel-three-compartment-commercial-sink-without-drainboards-17-x-17-x-12-bowls/600S31717X.html" | estimate | https://www.webstaurantstore.com/regency-60-16-gauge-stainless-steel-three-compartment-commercial-sink-without-drainboards-17-x-17-x-12-bowls/600S31717X.html | раковина на три отделения стоит $649, а не $850; раковина для рук и мойка для швабр найдены у того же продавца |
| cafe: `setup[fse_permit]` | waitDays=21 | waitDays=22 | verified | https://nyc-business.nyc.gov/nycbusiness/description/food-service-establishment-permit | на странице NYC Business открыть можно на 22-й день, а не на 21-й; плюс $25 за замороженные десерты |
| cafe: `setup[batch_brewer]` | source="https://www.katom.com/021-230010006.html" | source="https://www.webstaurantstore.com/search/bunn-cwtf15-aps.html" | estimate | https://www.webstaurantstore.com/search/bunn-cwtf15-aps.html | цену Bunn CWTF15-APS $980 удалось увидеть самому (раньше страница KaTom не открывалась) |
| cafe: `roadmap[get_fse_permit]` | waitDays=21 | waitDays=22 |  |  | тот же срок 22 дня, что и в setup[fse_permit] |
| cafe: `staff[barista]` | hourlyWage=21; cashWage=21; source="https://dol.ny.gov/minimum-wage-0" | hourlyWage=18; cashWage=18; source="https://dol.ny.gov/statistics-oewswagezip" | estimate | https://dol.ny.gov/statistics-oewswagezip | по данным NY DOL (OEWS, пересчёт на I квартал 2026) медиана работников стойки в Нью-Йорке — $17.57 в час, средняя — $18.90, и это вместе с чаевыми; $21 без чаевых выше рынка |
| cafe: `staff[shift_lead]` | source="https://dol.ny.gov/minimum-wage-0"; confidence="estimate" | source="https://dol.ny.gov/statistics-oewswagezip"; confidence="verified" | verified | https://dol.ny.gov/statistics-oewswagezip | $24 совпадает с медианой NY DOL для бригадиров общепита в Нью-Йорке ($24.07): оценка подтверждена |
| cafe: `monthlyCosts[sick_leave_cover]` | amount=70 | amount=60 | estimate | https://www.nyc.gov/site/dca/about/paid-sick-leave-FAQs.page | пересчёт от новой ставки бариста $18 |
| cafe: `violations[unlicensed_sidewalk_cafe]` | law="NYC Administrative Code §19-160 and following (Dining Out NYC, Local Law 121 of 2023)" | law="NYC Administrative Code §§19-160.1, 19-160.4, 19-160.5(c), 19-160.6; 34 RCNY §§5-10, 5-11 (Dining Out NYC)" | verified | https://www.diningoutnyc.info/enforcement | статьи закона были «по памяти»; на странице Dining Out NYC они названы: 19-160.1, 19-160.4, 19-160.5(c), 19-160.6 и 34 RCNY 5-10, 5-11 |
| cafe: `violations[spoiled_food]` | source="https://www.nyc.gov/assets/doh/downloads/pdf/about/healthcode/health-code-chapter23.pdf" | source="https://rules.cityofnewyork.us/wp-content/uploads/2021/09/Full-Text-Chapter-23-NOA_Penalty-Schedule_9-2-21-1.pdf" | verified | https://rules.cityofnewyork.us/wp-content/uploads/2021/09/Full-Text-Chapter-23-NOA_Penalty-Schedule_9-2-21-1.pdf | в таблице штрафов холодная еда выше 41°F стоит $250–$600, а не $250–$500 (строки 02G по уровням I–V) |
| cafe: `violations[no_food_protection_cert]` |  |  | verified | https://www.nyc.gov/assets/doh/downloads/pdf/about/healthcode/health-code-chapter23.pdf | три разных числа в трёх документах; оставляю $400 действующей сводной таблицы и записываю расхождение |
| cafe: `events[coffee_price_spike]` |  |  | estimate | https://fred.stlouisfed.org/series/APU0000717311 | добавлен настоящий сигнал: биржевая цена арабики (IMF через FRED) прыгала на 15–17% за месяц в 2025–2026 годах |
| cafe: `events[milk_price_up]` |  |  | estimate | https://fred.stlouisfed.org/series/APU0000709112 | числа FRED перепроверены; добавлен пик и ряд |
| cafe: `extra[tipCredit]` | confidence=null; source="https://dol.ny.gov/minimum-wage-tipped-workers" | confidence="verified"; source="https://dol.ny.gov/minimum-wage-tipped-workers" | verified | https://dol.ny.gov/minimum-wage-tipped-workers | у записи не было пометки confidence; ставки проверены на 2026 и 2027 год |
| cafe: `violations[pest_activity]` | fine={"base": 300, "perMonth": 50, "pctOfSaved": 0, "max": 450}; source="https://www.nyc.gov/assets/doh/downloads/pdf/about/healthcode/health-code-chapter23.pdf" | fine={"base": 350, "perMonth": 50, "pctOfSaved": 0, "max": 550}; source="https://rules.cityofnewyork.us/wp-content/uploads/2021/09/Full-Text-Chapter-23-NOA_Penalty-Schedule_9-2-21-1.pdf" | verified | https://rules.cityofnewyork.us/wp-content/uploads/2021/09/Full-Text-Chapter-23-NOA_Penalty-Schedule_9-2-21-1.pdf | штраф за отсутствие на месте договора с дезинсектором (код 28-06) — $200, при неявке $400, а не $100; формула пересчитана |
| cafe: `extra.takeover` | multipleOfAnnualSales=0.2; max=200000; source=null; confidence="estimate" | multipleOfAnnualSales=0.4; max=300000; source="https://www.bizbuysell.com/learning-center/valuation-benchmarks/coffee-shops-cafes/"; confidence="estimate" | estimate | https://www.bizbuysell.com/learning-center/valuation-benchmarks/coffee-shops-cafes/ | по BizBuySell медианный проданный бизнес кофейни стоит 0.41 годовой выручки (2.2 годовой прибыли владельца), а в пакете 0.2: покупка готового бизнеса была вдвое дешевле жизни |
| cafe: `unit` |  |  | estimate | https://order.online/en-US/store/ten-thousand-coffee-24834959 | проверено: публичной статистики среднего чека кофейни Нью-Йорка нет; оставлено как оценка, добавлены опоры |
| cafe: `events[sidewalk_shed]` | effect={"field": "footTraffic", "mult": 0.9}; months=3; source="https://www.nyc.gov/site/buildings/safety/sidewalk-sheds.page" | effect={"field": "footTraffic", "mult": 0.93}; months=6; source="https://www.nyc.gov/mayors-office/news/2024/08/mayor-adams-releases-new-study-finding-sidewalk-sheds-scaffolding-cost-manhattan-businesses" | estimate | https://www.nyc.gov/mayors-office/news/2024/08/mayor-adams-releases-new-study-finding-sidewalk-sheds-scaffolding-cost-manhattan-businesses | городское исследование 2024 года (Mastercard): у ресторанов и баров за строительными лесами число транзакций в неделю падало на 3.5–9.7% в первые шесть месяцев; с 2026 года разрешение на леса — 90 дней, после 180 дней штрафы владельцу здания |
| cafe: `events[restaurant_week]` |  |  | estimate | https://www.nyctourism.com/restaurant-week/ | даты и цены Restaurant Week зимой 2027 года увидены на сайте NYC Tourism; эффект для кофейни остаётся оценкой |
| cafe: `setup[sidewalk_cafe_license]` |  |  | verified | https://www.diningoutnyc.info/apply/fees | добавлены цифры Comptroller: из ~5 000 заявок одобрено 28.6%, в 2026 году — 1 из 388; срок 240 дней — обещание DOT, реальность хуже |
| cafe: `levers[hours].options[long]` | monthlyCost=2300 | monthlyCost=2000 | estimate | https://dol.ny.gov/statistics-oewswagezip | пересчёт от ставки $18 вместо $21 |
| _common: `violations[no_i9]` | fine={"base": 1160, "perMonth": 0, "pctOfSaved": 0, "max": 11600}; confidence="estimate"; source="https://www.uscis.gov/i-9-central/legal-requirements-and-enforcement/penalties" | fine={"base": 1152, "perMonth": 0, "pctOfSaved": 0, "max": 11444}; confidence="verified"; source="https://www.ecfr.gov/current/title-28/chapter-I/part-85/section-85.5" | verified | https://www.ecfr.gov/current/title-28/chapter-I/part-85/section-85.5 | штраф за бумажное нарушение I-9 с 3 июля 2025 года — $288–$2 861 за форму (28 CFR 85.5), а не «около $290–$2 900 по памяти» |
| _common: `violations[returns_not_filed]` |  |  | estimate | https://www.irs.gov/payments/failure-to-file-penalty | минимальный штраф $525 увиден на irs.gov для деклараций со сроком после 31.12.2025 |
| _common: `violations[no_wc_insurance]` |  |  | verified | https://www.wcb.ny.gov/content/main/Employers/violations-wclaw.jsp | добавлено уголовное наказание для работодателя до пяти работников: misdemeanor и штраф $1 000–$5 000; и потолок «вдвое против стоимости страховки» |
| _common: `taxes[disability_pfl]` | source="https://www.wcb.ny.gov/content/main/DisabilityBenefits/employer-disability-benefits.jsp" | source="https://ww3.nysif.com/-/media/Files/DISABILITY_BENEFITS/PDF/UDB-SOC_2026.pdf" | estimate | https://ww3.nysif.com/-/media/Files/DISABILITY_BENEFITS/PDF/UDB-SOC_2026.pdf | ставки NYSIF и PFL 2026 года открыты напрямую; найден минимальный годовой взнос NYSIF $60 |
| _common: `extra.statutory` | source=null; confidence=null | source="https://dol.ny.gov/minimum-wage-0"; confidence="verified" | verified | https://dol.ny.gov/minimum-wage-0 | запись без source и confidence; все ставки 2026 года перепроверены, минимальная зарплата 2027 года подтверждена (off-ramp) |
| _common: `taxes[futa]` |  |  | estimate | https://www.irs.gov/taxtopics/tc759 | финальный список штатов со сниженным кредитом FUTA на 2026 год (US DOL, 12.11.2026): только Калифорния и Виргинские острова; для Нью-Йорка 0.6% подтверждено и на 2026 год |
| _common: `taxes[workers_comp]` |  |  | estimate | https://www.wcb.ny.gov/content/main/Employers/workers-compensation-insurance.jsp | ставки для кода ресторанов Нью-Йорка не найдено; найдено снижение базовых loss costs на 21.9% с 1 октября 2026 года |
| _common: `taxes[ny_unemployment]` |  |  | estimate | https://dol.ny.gov/bizserve/ui/prg/rate | ставка и база 2026 года открыты напрямую; ставка не меняется, потому что общий файл служит всем нишам, но при ставке бариста $18 настоящая доля — 2.09% |
| _common: `violations[sick_leave_denied]` | law="NYC Administrative Code §20-913, §20-924 (Earned Safe and Sick Time Act)"; source="https://www.nyc.gov/site/dca/about/paid-sick-leave-FAQs.page" | law="NYC Administrative Code §§20-912, 20-913, 20-924 (Earned Safe and Sick Time Act); 6 RCNY Chapter 7 (protected time off rules, effective July 23, 2026)"; source="https://rules.cityofnewyork.us/wp-content/uploads/2026/06/DCWP-NOA-Rules-Relating-to-Earned-Safe-and-Sick-Time-Act.pdf" | verified | https://rules.cityofnewyork.us/wp-content/uploads/2026/06/DCWP-NOA-Rules-Relating-to-Earned-Safe-and-Sick-Time-Act.pdf | правила DCWP, вступившие 23.07.2026: при «политике или практике» не давать больничные каждый работник получает $500 за каждый календарный год (Admin Code §20-924(d)(v)); статьи закона теперь увидены |


### Последствия исправлений, которые считает ведущий

- `extra.referenceMonth` нужно пересчитать движком: при ставке бариста $18 зарплата 4 × 160 × $18 = $11,520 вместо $13,440 (−$1,920 в месяц), налоги работодателя ≈ −$222. Прибыль эталонного месяца вырастет примерно на $2,100.
- `extra.simplifiedScheme.employerPayrollRateTotal` в `_common` не менялся: ставка UI 1.79% оставлена, потому что общий файл служит всем нишам (при $18 настоящая доля 2.09%). Правильнее — потолок на работника (механика `per_worker_payroll_caps`).
- `setup[grinder]` дороже на $1,000: набор `lean` и `standard` дорожают на эту сумму; `startCapital` $224,000 по-прежнему больше любого набора (проверено валидатором).
- `extra.takeover` с множителем 0.4 делает покупку готовой кофейни примерно вдвое дороже — ближе к жизни.

## 4а. Разбор всех оценок

`kept` — входные числа проверены, сама цифра — решение заметок или арифметика, остаётся `estimate`; `not_found` — первоисточника нет, что искал — в тексте; `corrected` — значение исправлено; `verified` — подтверждено открытым первоисточником.


| Пакет | Число | Значение | Итог | Что найдено |
|---|---|---|---|---|
| cafe | `startCapital` | 224000 | kept | Совпадает с итогом extra.openingBudget «almostReady». Внешние опоры (через поиск, вторичные): калькуляторы дают для Нью-Йорка $150–561 тыс., для Манхэттена «обычно больше $250 тыс.» за 800–1 200 кв. футов. Первоисточника нет. |
| cafe | `unit.refPrice / cogsPerUnit` | 8.5 / 2.21 | kept | Публичной статистики среднего чека нет (искал). Входные цены проверены: кофе $9.25/фунт, молоко $4.10/галлон (FRED, октябрь 2026), стакан 4.6¢. |
| cafe | `market.unitsPerSlotMonth / priceElasticity / weights` | 6000 / -1.3 | not_found | Игровые значения. Эластичность спроса на кофе в кофейне в первоисточниках не найдена; это часть задания 80 (codex), часть A. |
| cafe | `capacity.unitsPerStaffMonth` | 1700 | not_found | Измерений «заказов на бариста в час» в первоисточниках нет; 10.6 заказа на оплаченный час — расчёт заметок. |
| cafe | `sizing (18 sq ft на место, 170 заказов на место, 60% навынос)` | 18 / 170 / 0.6 | not_found | Норма площади на место для общепита в NYC — в Строительном кодексе (occupant load 15 net sq ft на место за столами), но nyc.gov недоступен; правило «20 мест — гостевой туалет» осталось с первого прохода. |
| cafe | `setup[security_deposit]` | 18000 | kept | Справочник аренды SBS (nyc.gov) недоступен; три месяца — решение заметок, путеводитель говорит «обычно два». |
| cafe | `setup[buildout] + extra.buildout.classes` | 87.5 / 225 / 400 за кв. фут | kept | Опора через поиск: медиана открытия во «втором поколении» помещения ~$73 за кв. фут против ~$193 в новом (национальный опрос, вторичный); сайт подрядчика alphacontractorsny вне сети сессии. Сроки 60/90/180 дней — оценка. |
| cafe | `setup[architect_expediter]` | 7000 | kept | 10% от ремонта — правило заметок, тарифа нет. |
| cafe | `setup[lease_lawyer]` | 3500 | kept | Проверено: SBS даёт бесплатную помощь по договору аренды (NYC Business, открыто). Гонорар $3 500 — оценка заметок. |
| cafe | `setup[grinder] / [decaf_grinder]` | 2099 → 3099 | corrected | E65S снята с производства, нет в наличии; E65W $3 099 (Visions Espresso, открыто). |
| cafe | `setup[water_filtration]` | 500 | not_found | Seattle Coffee Gear вне сети сессии; цены картриджа $192.94 и головы $41.94 не перепроверены. |
| cafe | `setup[refrigeration]` | 2628 | kept | Avantco A-19R-HC $1 199 подтверждён; Atosa MGF8401GR $1 429 не найден на WebstaurantStore (поиск дал только запчасти). |
| cafe | `setup[sinks]` | 1720 → 1519 | corrected | Раковина на три отделения $649, для рук $82.99–89.99, мойка для швабр $234–350 (WebstaurantStore, открыто). |
| cafe | `setup[prep_table_shelving]` | 600 | not_found | Нет списка размеров; оценка заметок. |
| cafe | `setup[pos]` | 1299 | kept | squareup.com отвечает 429; через поиск Square Register $799–899 (NerdWallet и др., вторичные). |
| cafe | `setup[smallwares]` | 2000 | not_found | Корзина без списка; оценка заметок. |
| cafe | `setup[safety_kit]` | 800 | kept | Подтверждено правило: маска для взрослого, детская маска, две пары перчаток (NYC Business, открыто). Сумма — оценка. |
| cafe | `setup[equipment_delivery_tax]` | 3500 | kept | Ставка 8.875% подтверждена (Pub 718); $25 000 оборудования и доставка — расчёт заметок. |
| cafe | `setup[opening_inventory]` | 3000 | kept | Стаканы $45.99 за 1 000 подтверждены; остальное — корзина заметок. |
| cafe | `setup[hiring_training]` | 4000 | kept | При ставке $18: 190 ч × $18 = $3 420 + объявления; $4 000 оставлено. |
| cafe | `setup[insurance_utility_deposits]` | 1500 | kept | Insureon $126 BOP подтверждён; депозиты Con Edison не открывались. |
| cafe | `setup[batch_brewer]` | 1780 | kept | Bunn CWTF15-APS $980 подтверждён (WebstaurantStore); $800 на гриндер и термосы — оценка. |
| cafe | `setup[ice_machine]` | 3500 | not_found | oswaltsupply вне сети; на WebstaurantStore Manitowoc UYF0140A не найден. |
| cafe | `setup[decor_lighting]` | 2000 | not_found | Оценка заметок. |
| cafe | `setup[signage]` | 1500 | kept | Подтверждено правило DOB: вывеска, прикрученная к зданию или с подсветкой, требует одобрения DOB (NYC Business, открыто). Цена — оценка. |
| cafe | `setup[customer_restroom]` | 12000 | not_found | Цены переделки туалета под ADA в первоисточниках нет. |
| cafe | `monthlyCosts[rent]` | 6000 | kept | $90 за кв. фут на боковой улице Бруклина — оценка; страница REBNY рендерится скриптом, цифры коридоров не получены. Через поиск: C&W Q2 2026 Flatiron $306, SoHo $393; Q3 2026 средняя по Манхэттену $730 (первый этаж). |
| cafe | `monthlyCosts[utilities]` | 1100 | kept | NYSERDA отвечает 403. FRED (BLS): электричество для жителей NYC 25–29¢/кВт·ч в 2024 году — выше 23.1¢ штата для бизнеса, поэтому электричество может быть на ~15–20% дороже заметок. |
| cafe | `monthlyCosts[insurance]` | 250 | kept | Insureon: BOP $126, общая ответственность $82 (открыто). $250 — резерв NYC. |
| cafe | `monthlyCosts[supplies]` | 0.17 | kept | Стакан 4.6¢ подтверждён; 2% от продаж — модель заметок. |
| cafe | `monthlyCosts[card_fees] / [card_fixed_fee]` | 0.0255 / 0.135 | kept | Ставки Square подтверждены (2.5% + 15¢ на Plus); доля карт 90% и чаевые $2 000 — допущения. |
| cafe | `monthlyCosts[tips_payroll_tax]` | 0.003 | kept | Правило IRS о чаевых как зарплате — Pub 15 (открыта); сумма чаевых — допущение. |
| cafe | `monthlyCosts[sick_leave_cover]` | 70 → 60 | corrected | Пересчёт от ставки $18. |
| cafe | `monthlyCosts[maintenance]` | 300 | not_found | Полоса $200–500 из заметок. |
| cafe | `monthlyCosts[waste]` | 250 | not_found | Предельные цены перевозчиков по зонам (CWZ) есть только в калькуляторе DSNY на nyc.gov — недоступен. |
| cafe | `monthlyCosts[internet]` | 100 | not_found | verizon.com вне сети. |
| cafe | `monthlyCosts[pos_software]` | 49 | kept | Square Plus $49 в месяц за точку — через поиск (несколько источников); squareup.com 429. |
| cafe | `monthlyCosts[accounting]` | 400 | not_found | Публичного прайса бухгалтера в NYC нет. |
| cafe | `monthlyCosts[payroll_service]` | 85 | kept | Gusto Simple $49 + $6 за человека с 1 марта 2026 (через поиск; gusto.com 403). |
| cafe | `monthlyCosts[marketing]` | 300 | not_found | Бюджет-выбор заметок. |
| cafe | `monthlyCosts[permit_renewals]` | 50 | kept | FSE $280 в год и LLC $25 в год подтверждены. |
| cafe | `staff[barista].hourlyWage` | 21 → 18 | corrected | NY DOL OEWS Q1 2026, NYC, 35-3023: медиана $17.57, средняя $18.90 с чаевыми. |
| cafe | `staff[shift_lead].hourlyWage` | 24 | verified | NY DOL OEWS Q1 2026, NYC, 35-1012: медиана $24.07. |
| cafe | `manager.monthlySalary` | 4800 | kept | $30 × 160 ч. Опоры NY DOL: бригадир — средняя $26.04/ч, управляющий заведением (11-9051) — медиана $44.94/ч. $30 — между ними. |
| cafe | `events[coffee_price_spike]` | 1.05 | kept | Ряды FRED подтверждены; добавлен сигнал — арабика IMF +16.7% за месяц (июнь→июль 2026). |
| cafe | `events[milk_price_up]` | 1.03 | kept | Ряды FRED подтверждены. |
| cafe | `events[restaurant_week]` | 1.05 | kept | Даты 19.01–11.02.2027 и цены $30/45/60 подтверждены; эффект для кофейни не измерен. |
| cafe | `events[sidewalk_shed]` | 0.9 × 3 мес → 0.93 × 6 мес | corrected | Исследование города и Mastercard 2024: −3.5…−9.7% транзакций у ресторанов за шесть месяцев. |
| cafe | `events[summer_power_peak]` | 1.08 | not_found | NYSERDA 403; цифры 22.3¢ и 24.2¢ остаются из заметок. |
| cafe | `events[flu_season]` | 0.92 | not_found | Доли невыходов работников общепита в сезон гриппа в первоисточниках не нашёл. |
| cafe | `benchmarks` | 0.28 / 0.35 / 0.10 / 0.04 | kept | NRA открыт: прибыль до налогов 4.0%, prime cost 65%, аренда 6.0% (город, limited service). 0.28 и 0.10 — модель заметок. |
| cafe | `extra.rentByTier` | 326 / 90 / 45 | kept | Q3 2026 C&W ($326 Flatiron, $409 SoHo) не открыт — сервер C&W вне сети; через поиск Q2 2026: $306 и $393 — порядок совпадает. |
| cafe | `extra.referenceMonth` | wages 13 440 | kept | Нужно пересчитать после смены ставки бариста: 4 × 160 × $18 = $11 520 (−$1 920 в месяц), налоги работодателя −$222. Это делает ведущий (движок). |
| cafe | `extra.footfall (captureRate и др.)` | 0.088 … | not_found | Задание 80 (codex), часть A; в D12 не повторял. |
| cafe | `extra.takeover.multipleOfAnnualSales` | 0.2 → 0.4 | corrected | BizBuySell (через поиск): медиана проданной кофейни 0.41 выручки, 2.2 прибыли владельца. |
| cafe | `levers (5) и shortcuts (8) кафе` | — | kept | У каждого числа теперь source, confidence и расчёт в note; hours.long пересчитан $2 300 → $2 000. |
| _common | `taxes[ny_unemployment]` | 0.0179 | kept | 4.1% и $17 600 подтверждены; эффективная доля зависит от зарплаты (2.09% при $18). |
| _common | `taxes[futa]` | 0.001 | verified | Подтверждено и на 2026 год: Нью-Йорка нет в списке сниженного кредита. |
| _common | `taxes[workers_comp]` | 0.02 | not_found | Ставка для ресторанного кода NY не найдена; общий уровень −21.9% с 1.10.2026. |
| _common | `taxes[disability_pfl]` | 0.0004 | kept | NYSIF $17.68 и минимум $60 в год; PFL 0.432%/$411.91 — подтверждены. |
| _common | `taxes[self_employment_tax]` | 0.1413 | kept | 15.3% × 92.35% — арифметика формы SE. |
| _common | `taxes[income_tax]` | 0.17 | kept | Сводная ставка-оценка; не налоговая консультация. |
| _common | `taxes[nyc_ubt]` | 0 | kept | nyc.gov недоступен; порог $3 400 остаётся с первого прохода. |
| _common | `violations[off_books_payroll] / [misclassification]` | 2.0 / 1.5 × saved | kept | Формулы-оценки; WCB Fair Play: до $2 500 за неверно оформленного работника (это для строительства, к кафе не применимо). |
| _common | `violations[no_i9]` | 1160 → 1152; 11600 → 11444 | corrected | 28 CFR 85.5 (eCFR, открыто). |
| _common | `violations[returns_not_filed]` | 525 + 450/мес | kept | $525 подтверждён на irs.gov; формула — оценка. |
| _common | `shortcuts (12)` | — | kept | У каждого числа теперь source, confidence и расчёт в note. |
| _common | `extra.employerCostExample` | — | kept | Арифметика от проверенных ставок. |


## 4б. Перепроверенные числа с пометкой verified (32)

| Где | Значение | Что увидено | Ссылка |
|---|---|---|---|
| `setup[espresso_machine].cost` | 7600 | Nuova Simonelli Appia Life Compact Two Group Volumetric 110V $7,600.00 | https://www.webstaurantstore.com/espresso-machine-2gr-appi/238APLCV2.html |
| `setup[premium_espresso_machine].cost` | 4100 | Appia Life Three Group Volumetric 220V $11,700.00; 11,700 - 7,600 = 4,100 | https://www.webstaurantstore.com/search/nuova-simonelli-appia-life-3-group.html |
| `setup[premium_grinder].cost` | 3899 | Mahlkonig EK43 $3,899.00 (sale; list $3,999) | https://visionsespresso.com/coffee-grinders/brands/mahlkonig/ |
| `setup[pastry_case].cost` | 1149 | Avantco BCS-48-HC 48-inch refrigerated countertop bakery case $1,149.00 | https://www.webstaurantstore.com/13469/refrigerated-bakery-cases-and-dry-bakery-display-cases.html |
| `setup[refrigeration].cost (part)` | 1199 | Avantco A-19R-HC $1,199.00; the Atosa part ($1,429) is still unseen | https://www.webstaurantstore.com/avantco-a-19r-hc-29-solid-door-reach-in-refrigerator/178A19RHC.html |
| `setup[dishwasher].cost` | 4449 | Noble Warewashing HT-UC24 $4,449.00 | https://catalog.webstaurantstore.com/noble-warewashing-ht-uc24-select-high-temperature-undercounter-dishwasher-with-booster-heater-208-240v-1-phase/495HTUC24.html |
| `setup[table_share].cost` | 35 | Lancaster 24 x 24 table kit $69.99; / 2 seats = $35 | https://www.webstaurantstore.com/lancaster-table-seating-24-x-24-reversible-walnut-oak-laminated-standard-height-table-top-and-base-kit-with-17-base/349C24SW17RS.html |
| `setup[chair].cost` | 49 | Lancaster chairs $37.99 (ladder back, vinyl seat) to $84.99; metal cafe chairs from $49.99 | https://www.webstaurantstore.com/42529/restaurant-chairs.html?vendor=Lancaster-Table-Seating |
| `setup[llc_and_publication].cost` | 1675 | DOS $200 Articles + $50 Certificate of Publication; LLC Publishers Kings $1,475, New York $1,795, Bronx $1,745, Queens $1,195, Richmond $1,295, Albany $395 | https://www.llcpublishers.com/pricing |
| `setup[food_protection_cert].cost` | 24 | free online course + $24 exam; classroom $114; replacement $16; never expires | https://nyc-business.nyc.gov/nycbusiness/description/food-protection-certificate |
| `setup[sidewalk_cafe_license].cost` | 2550 | license $1,050 per 4 years + refundable deposit $1,500 (sidewalk), $2,500 (roadway); consent $6/$10/$18/$31 per sq ft by sector | https://www.diningoutnyc.info/apply/fees |
| `taxes[sales_tax].rate` | 0.08875 | New York City 8 7/8, reporting code 8081, effective March 1, 2025 | https://www.tax.ny.gov/pdf/publications/sales/pub718.pdf |
| `_common taxes[employer_fica].rate` | 0.0765 | 6.2% + 1.45%, wage base $184,500 (2026) | https://www.irs.gov/publications/p15 |
| `_common taxes[ny_unemployment] inputs` | 4.1%, $17,600 | 2026 new employer rate 4.1% (range 1.7%-9.5%); wage base 2026 $17,600 (wbarchive) | https://dol.ny.gov/bizserve/ui/prg/rate |
| `_common taxes[futa] inputs` | 6.0% - 5.4% on $7,000 | FUTA 6.0% on first $7,000, credit up to 5.4% | https://www.irs.gov/taxtopics/tc759 |
| `_common taxes[mctmt] threshold` | 312500 | not subject if quarterly MCTD payroll is not greater than $312,500; lowest rate 0.055% | https://www.tax.ny.gov/forms/current-forms/mta/mta305i.htm |
| `_common taxes[nys_llc_filing_fee].rate` | 25 | disregarded-entity LLC with NY income: $25 | https://www.tax.ny.gov/pit/efile/annual_filing_fee.htm |
| `_common violations[sales_tax_fraud] / [sales_tax_not_remitted]` | 2x tax; 10% + 1%/month to 30%, min $50; records $1,000 then $5,000 a quarter | Tax Law §1145(a)(1)(i), (a)(2), (i) | https://www.nysenate.gov/legislation/laws/TAX/1145 |
| `_common violations[no_wc_insurance].fine.perMonth` | 6000 | up to $2,000 for every 10-day period without coverage | https://www.wcb.ny.gov/content/main/Employers/violations-wclaw.jsp |
| `_common violations[unpaid_overtime], [below_minimum_wage]; cafe [tip_theft], [unpaid_training_time], [spread_of_hours_unpaid] pctOfSaved` | 2 | Labor Law §198(1-a): wages + liquidated damages up to 100% (up to 300% for willful §194 violations); six-year reach | https://www.nysenate.gov/legislation/laws/LAB/198 |
| `_common violations[bribery].fine.base` | 5000 | Penal Law §80.00: felony fine up to $5,000 or double the gain; §200.00 bribery 3rd degree is a class D felony | https://www.nysenate.gov/legislation/laws/PEN/80.00 |
| `_common violations[refusing_cash].fine` | 750 / 1,500 | $750 first, $1,350 second, $1,500 third and each after (6 RCNY §6-72); stores may refuse bills above $20 | https://nyc-business.nyc.gov/nycbusiness/resources-by-industry/restaurant |
| `violations[grease_interceptor_neglect].fine` | 100-1,500 | Failure to install or maintain a grease interceptor: $100 - $1,500 (DEP, Use of the Public Sewers §19) | https://nyc-business.nyc.gov/nycbusiness/resources-by-industry/restaurant |
| `violations[no_fse_permit].fine` | 1,000 / 2,000 | 18-01 NYCHC 81.05(a) no current valid permit $1,000, default $2,000 | https://rules.cityofnewyork.us/wp-content/uploads/2021/09/Full-Text-Chapter-23-NOA_Penalty-Schedule_9-2-21-1.pdf |
| `violations[dirty_surfaces].fine` | 200-300 | 06D NYCHC 81.27(b) $200, $200, $250, $300 by condition level | https://rules.cityofnewyork.us/wp-content/uploads/2021/09/Full-Text-Chapter-23-NOA_Penalty-Schedule_9-2-21-1.pdf |
| `violations[unapproved_food_source].fine` | 400-600 | 03A NYCHC 81.04 food from unapproved or unknown source, or home cooked $400, $600 | https://rules.cityofnewyork.us/wp-content/uploads/2021/09/Full-Text-Chapter-23-NOA_Penalty-Schedule_9-2-21-1.pdf |
| `monthlyCosts[card_fees], [card_fixed_fee] inputs` | 2.5% + 15¢ (Plus) | Free 2.6% + 15¢, Plus 2.5% + 15¢, Premium 2.4% + 15¢ for tap, dip or swipe | https://squareup.com/help/us/en/article/5068-what-are-square-s-fees |
| `monthlyCosts[insurance] anchor` | 126 | BOP $126 a month, general liability $82, workers' comp $88 (US averages of Insureon customers) | https://www.insureon.com/food-business-insurance/coffee-shops-cafes/cost |
| `benchmarks netMarginPct and prime cost; rentPct anchor` | 0.04; 65%; 6.0% | NRA: limited-service median pre-tax income 4.0%, prime cost 65%; occupancy 6.0% of sales for urban limited-service (2024 data) | https://restaurant.org/research-and-media/research/restaurant-economic-insights/analysis-commentary/restaurant-occupancy-costs-were-more-than-5-of-sales-in-2024/ |
| `events[coffee_price_spike], [milk_price_up] series values` | $9.457 → $9.249; $4.317 → $4.101 | FRED csv, June and October 2026 | https://fred.stlouisfed.org/series/APU0000717311 |
| `extra.tipCredit; _common extra.statutory.nycMinimumWage2027` | 17 / 11.35 / 5.65 | Minimum wage as of 01/01/2027 NYC $17.00; tipped food service $11.35 cash + $5.65 credit | https://dol.ny.gov/minimum-wage-0 |
| `_common taxes[disability_pfl] inputs` | $17.68; 0.432%, $411.91 | NYSIF statutory $17.68 per person a year; PFL 2026 0.432% capped at $411.91 | https://paidfamilyleave.ny.gov/2026 |


## 4в. Ссылки из `sources` и полей `source`

Всего 96 адресов (`D12-linkcheck.tsv`): 200 — 58, 403 — 19, вне сети сессии — 18, 429 — 1. Все 58 открывшихся страниц сверены по заголовку с описанием в `sources`: каждая ведёт на заявленное. Страница REBNY открывается, но цифры в ней рисует скрипт. Не открылись:

- 000 — https://advancedexterminating.com/blog/nyc-commercial-pest-control-cost/ — хост вне сети сессии
- 403 — https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-27198 — отказ сайта автоматическому запросу
- 000 — https://content.cushmanwakefield.com/api/public/content/0c916c5affba4d6c93bb0f4bef086d16?v=15b6419f — хост вне сети сессии
- 000 — https://docs.paidfamilyleave.ny.gov/content/main/PressRe/paid-family-leave-2026.jsp — хост вне сети сессии
- 000 — https://forms.labor.ny.gov/WP/CR146.pdf — хост вне сети сессии
- 403 — https://gusto.com/product/pricing — отказ сайта автоматическому запросу
- 000 — https://order.online/en-US/store/ten-thousand-coffee-24834959 — хост вне сети сессии
- 000 — https://oswaltsupply.com/uyf0140a-ice-maker-137-lb — хост вне сети сессии
- 000 — https://portal.311.nyc.gov/article/?kanumber=KA-01878 — хост вне сети сессии
- 000 — https://portal.311.nyc.gov/article/?kanumber=KA-02023 — хост вне сети сессии
- 429 — https://squareup.com/us/en/pricing — лимит запросов
- 000 — https://uscode.house.gov/us/usc/t26/s7201/ — хост вне сети сессии
- 000 — https://www.alphacontractorsny.com/guides/commercial-build-out-cost-nyc — хост вне сети сессии
- 000 — https://www.atlanticse.com/collections/atosa-undercounter-refrigeration/products/atosa-mgf8401gr — хост вне сети сессии
- 000 — https://www.baldorfood.com/ — хост вне сети сессии
- 000 — https://www.cityfeet.com/cont/jackson-heights-queens-ny/retail-space-for-lease — хост вне сети сессии
- 403 — https://www.katom.com/021-230010006.html — отказ сайта автоматическому запросу
- 000 — https://www.nerdwallet.com/business/software/learn/quickbooks-live-bookkeeping — хост вне сети сессии
- 403 — https://www.nyc.gov/assets/doh/downloads/pdf/about/healthcode/health-code-chapter23.pdf — отказ сайта автоматическому запросу
- 403 — https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf — отказ сайта автоматическому запросу
- 403 — https://www.nyc.gov/site/buildings/property-or-business-owner/project-requirements-owner-signs.page — отказ сайта автоматическому запросу
- 403 — https://www.nyc.gov/site/buildings/safety/sidewalk-sheds.page — отказ сайта автоматическому запросу
- 403 — https://www.nyc.gov/site/dca/about/paid-sick-leave-FAQs.page — отказ сайта автоматическому запросу
- 403 — https://www.nyc.gov/site/dca/workers/workersrights/fastfood-retail-workers.page — отказ сайта автоматическому запросу
- 403 — https://www.nyc.gov/site/doh/business/food-operators/letter-grading-for-restaurants.page — отказ сайта автоматическому запросу
- 403 — https://www.nyc.gov/site/doh/business/food-operators/operating-a-restaurant.page — отказ сайта автоматическому запросу
- 403 — https://www.nyc.gov/site/doh/business/health-academy/food-protection-online-free.page — отказ сайта автоматическому запросу
- 403 — https://www.nyc.gov/site/dsny/businesses/commercial-waste-zones.page — отказ сайта автоматическому запросу
- 403 — https://www.nyc.gov/site/finance/business/business-commercial-rent-tax-crt.page — отказ сайта автоматическому запросу
- 403 — https://www.nyc.gov/site/finance/business/business-nys-sales-tax.page — отказ сайта автоматическому запросу
- 403 — https://www.nyc.gov/site/finance/business/business-unincorporated-business-tax-ubt.page — отказ сайта автоматическому запросу
- 403 — https://www.nyserda.ny.gov/Energy-Prices/Electricity/Monthly-Avg-Electricity-Commercial — отказ сайта автоматическому запросу
- 000 — https://www.partnerscoffee.com/pages/wholesale — хост вне сети сессии
- 000 — https://www.restaurantdepot.com/ — хост вне сети сессии
- 000 — https://www.seattlecoffeegear.com/collections/everpure — хост вне сети сессии
- 403 — https://www.uscis.gov/i-9 — отказ сайта автоматическому запросу
- 403 — https://www.uscis.gov/i-9-central/legal-requirements-and-enforcement/penalties — отказ сайта автоматическому запросу
- 000 — https://www.verizon.com/business/products/internet/ — хост вне сети сессии


## 5. Просьбы к ведущему

1. **Потолки налогов на работника** (`extra.mechanics.per_worker_payroll_caps`, `deep`). Сейчас UI, FUTA и DBL — одна ставка на весь фонд оплаты, и её приходится подгонять под одну зарплату ($21 → 1.79%, $18 → 2.09%). Нужно поле `wageBase` у налога и учёт с начала года по каждому работнику; тогда январь дороже декабря, как в жизни.
2. **Зарплата как поле события** (`min_wage_march_2027_proposal`, `core`). В формате `events.effect.field` нет минимальной зарплаты. Нужно поле `minimumWage` и правило: все ставки ниже нового минимума поднимаются в день события.
3. **Облагаемая доля по категориям меню** (`taxable_share_by_item`, `exotic`). Пока `taxableShare = 1` — на 0–5% выше жизни. Можно оставить, если меню не детализируется.
4. **Пересчитать `extra.referenceMonth`** движком после ставки $18 и проверить, не стала ли игра снова слишком мягкой (прибыль эталонного месяца +$2,100). Если стала, рычаг — цена и спрос, а не завышенная зарплата.
5. **Дать сети сессии исследователей nyc.gov** или зеркало: 19 ссылок пакета отвечают 403 на автоматический запрос, и числа DOHMH, DCWP, DOF, DOB, DSNY нельзя открыть заново. Временный путь — rules.cityofnewyork.us (тексты правил, открывается) и nyc-business.nyc.gov (открывается).
6. **Жалоба 311 на просроченные леса** (`report_shed_to_dob`) — новый `reports` для события `sidewalk_shed_rules_2026`; id предложен, записи нет.
7. **Штраф на каждого работника** (`fine.perStaff`). Правило DCWP 2026 года: при политике «не давать больничные» каждому работнику положено $500 за каждый год; общий `sick_leave_denied` сейчас даёт $500 на всё заведение.
8. **Штраф по уровню нарушения.** В Appendix 23-C у одного кода пять сумм по уровням I–V; формула `base + perMonth × месяцев` выражает их грубо. Поле `fine.byCondition: [200, 200, 250, 300, 350]` и выбор уровня по запущенности дадут точное число.

## 6. Не найдено

- **Средний чек кофейни NYC, конверсия прохожих, эластичность по цене, пропускная способность бариста, оборот места** — публичных измерений нет (искал «average ticket coffee shop NYC», «orders per labor hour barista», «price elasticity coffee shop»); это часть A задания 80 (codex).
- **Ставка workers' comp для ресторанного класса NY** (9071–9074) — бюллетени NYCIRB вне сети, в поиске только общий уровень −21.9%.
- **Цены перевозчиков мусора по зонам CWZ** — только калькулятор DSNY на nyc.gov.
- **NYSERDA, средняя цена электричества для бизнеса 2026** — 403; заметки (22.3¢ январь, 24.2¢ июль, 23.1¢ август) не перепроверены. Опора FRED: электричество для жителей NYC 25–29¢ в 2024 году (ряд закончился в декабре 2024).
- **Аренда по коридорам: REBNY 2025 и Cushman & Wakefield Q3 2026** — страница REBNY без чисел, сервер C&W вне сети. Через поиск подтверждён только порядок: C&W Q2 2026 Flatiron $306, SoHo $393; Q3 средняя по Манхэттену $730.
- **Депозит по аренде** (справочник SBS на nyc.gov) — 403.
- **DOB о вывесках и лесах, DOF о CRT и UBT, DOHMH о туалете при 20 местах** — nyc.gov 403; числа оставлены с первого прохода, через поиск расхождений не нашёл (CRT: $250,000 и кредит до $500,000 аренды и $5 млн дохода подтверждены вторичными источниками).
- **Цены, которые первая попытка брала из заметок:** Atosa MGF8401GR $1,429, картридж Everpure $192.94, Manitowoc UYF0140A $3,479, Square Register $899 (через поиск $799–899) — страницы вне сети или 429.
- **Доля невыходов работников общепита в сезон гриппа** — не найдена.
- **Эффект Restaurant Week для кофейни** — измерений нет.
- **Число и средний возраст строительных лесов в 2026 году** — набор DOB есть на карте nyc.gov, API каталога отвечает слишком долго; последний найденный срез — 482 дня (август 2023).

## 7. Источники

Открыты в этой сессии (14 ноября 2026), число увидено:

- NY DOL, минимальная зарплата на 01.01.2027 — https://dol.ny.gov/minimum-wage-0
- NY DOL, работники с чаевыми — https://dol.ny.gov/minimum-wage-tipped-workers
- Губернатор NY, минимальная зарплата 2027 и предложение на 1 марта — https://www.governor.ny.gov/new-york-state-minimum-wage-2027
- NY DOL, ставки UI 2026 — https://dol.ny.gov/bizserve/ui/prg/rate ; база UI — https://dol.ny.gov/bizserve/ui/prg/rate/wbarchive
- NY DOL, OEWS, зарплаты по регионам на I квартал 2026 (zip, oewsdata.csv) — https://dol.ny.gov/statistics-oewswagezip
- NYC Business: FSE — https://nyc-business.nyc.gov/nycbusiness/description/food-service-establishment-permit ; FPC — https://nyc-business.nyc.gov/nycbusiness/description/food-protection-certificate ; ресторанам (штрафы, наличные, вывески, маски) — https://nyc-business.nyc.gov/nycbusiness/resources-by-industry/restaurant
- Dining Out NYC: сборы — https://www.diningoutnyc.info/apply/fees ; штрафы — https://www.diningoutnyc.info/enforcement
- NYC Comptroller, 27.10.2026, сроки уличной посадки — https://comptroller.nyc.gov/newsroom/comptroller-investigation-finds-more-than-half-of-restaurants-in-outdoor-dining-program-waited-over-19-months-for-permits-delays-deprive-businesses-of-much-needed-revenue/
- DOHMH, Chapter 23, таблица штрафов (текст правила 2021) — https://rules.cityofnewyork.us/wp-content/uploads/2021/09/Full-Text-Chapter-23-NOA_Penalty-Schedule_9-2-21-1.pdf ; поправка 2025 — https://rules.cityofnewyork.us/wp-content/uploads/2025/10/Ch.-23-NOA_FSE-Inspections_10-16-25.pdf
- NYS Tax: Pub 718 — https://www.tax.ny.gov/pdf/publications/sales/pub718.pdf ; TB-ST-806 — https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/sales_by_restaurants.htm ; сбор LLC — https://www.tax.ny.gov/pit/efile/annual_filing_fee.htm ; MTA-305 — https://www.tax.ny.gov/forms/current-forms/mta/mta305i.htm
- Законы NY: Tax Law §1145 — https://www.nysenate.gov/legislation/laws/TAX/1145 ; Labor Law §196-d — https://www.nysenate.gov/legislation/laws/LAB/196-D ; §198 — https://www.nysenate.gov/legislation/laws/LAB/198 ; Penal Law §200.00 — https://www.nysenate.gov/legislation/laws/PEN/200.00 ; §80.00 — https://www.nysenate.gov/legislation/laws/PEN/80.00
- WCB, нарушения закона о workers' comp — https://www.wcb.ny.gov/content/main/Employers/violations-wclaw.jsp
- NYSIF, ставки DBL 2026 — https://ww3.nysif.com/-/media/Files/DISABILITY_BENEFITS/PDF/UDB-SOC_2026.pdf ; PFL 2026 — https://paidfamilyleave.ny.gov/2026
- NYS DOS, LLC — https://dos.ny.gov/node/35506 ; LLC Publishers, цены по округам — https://www.llcpublishers.com/pricing
- IRS: Pub 15 (2026) — https://www.irs.gov/publications/p15 ; Topic 759 — https://www.irs.gov/taxtopics/tc759 ; неподача деклараций — https://www.irs.gov/payments/failure-to-file-penalty
- DCWP, правила о protected time off (с 23.07.2026) — https://rules.cityofnewyork.us/wp-content/uploads/2026/06/DCWP-NOA-Rules-Relating-to-Earned-Safe-and-Sick-Time-Act.pdf
- US DOL, итоговые снижения кредита FUTA 2026 — https://oui.doleta.gov/unemploy/futa_credit.asp (файл final_credit_states_2026.xlsx)
- eCFR, 28 CFR 85.5 (штрафы I-9 с 3.07.2025) — https://www.ecfr.gov/current/title-28/chapter-I/part-85/section-85.5
- FRED: кофе — https://fred.stlouisfed.org/series/APU0000717311 ; молоко — https://fred.stlouisfed.org/series/APU0000709112 ; арабика IMF — https://fred.stlouisfed.org/series/PCOFFOTMUSDM ; электричество NYC (BLS) — https://fred.stlouisfed.org/series/APUS12A72610
- NYC Open Data, пешеходные подсчёты DOT — https://data.cityofnewyork.us/d/cqsj-cfgu
- NYC Tourism, Restaurant Week зима 2027 — https://www.nyctourism.com/restaurant-week/
- NRA: показатели 2024 — https://restaurant.org/research-and-media/media/press-releases/new-resource-from-national-restaurant-association-provides-insights-into-operational-realities ; аренда в доле продаж — https://restaurant.org/research-and-media/research/restaurant-economic-insights/analysis-commentary/restaurant-occupancy-costs-were-more-than-5-of-sales-in-2024/
- Insureon, страховки кофеен — https://www.insureon.com/food-business-insurance/coffee-shops-cafes/cost
- Square, комиссии — https://squareup.com/help/us/en/article/5068-what-are-square-s-fees
- Visions Espresso, Mahlkönig — https://visionsespresso.com/coffee-grinders/brands/mahlkonig/
- WebstaurantStore: кофемашины, холодильник, витрина, посудомойка, стаканы, столы, стулья, раковины, Bunn (ссылки — в `extra.d12CheckedUnchanged` и `sources` фрагмента)

Только через поиск (страница вне сети сессии или отвечает 403; пометка `estimate`):

- Исследование города и Mastercard о строительных лесах, 2024 — https://www.nyc.gov/mayors-office/news/2024/08/mayor-adams-releases-new-study-finding-sidewalk-sheds-scaffolding-cost-manhattan-businesses
- Правила лесов 2026 (Local Laws 48 и 51 of 2025) — https://www.nyc.gov/mayors-office/news/2026/08/mamdani-administration-taking-down-sidewalk-sheds-and-improving- ; https://www.nyc.gov/assets/buildings/local_laws/ll48of2025.pdf
- BizBuySell, кофейни — https://www.bizbuysell.com/learning-center/valuation-benchmarks/coffee-shops-cafes/ ; Insight Report — https://www.bizbuysell.com/insight-report/
- NYCIRB −21.9% с 1.10.2026 — https://www.insurancejournal.com/news/east/2026/07/17/877978.htm
- Gusto, цены 2026 — https://tech.co/hr-software/gusto-payroll-pricing
- Square, цена Plus и Register — https://www.nerdwallet.com/article/small-business/square-fees
- Cushman & Wakefield, Manhattan retail — https://www.cushmanwakefield.com/en/united-states/insights/us-marketbeats/new-york-city-area-marketbeats/manhattan-retail
- NYC Commercial Rent Tax, инструкции 2025–26 — https://www.nyc.gov/assets/finance/downloads/pdf/commercial_rent/cr-a-instructions-2025-26.pdf
- Стоимость дезинсекции, уборки и откачки жироуловителя (страницы подрядчиков, не цены) — https://broadwaypest.pages.dev/faq/ ; https://www.airtasker.com/us/costs/commercial-cleaning/commercial-cleaner-cost/ ; https://www.homeyou.com/il/grease-trap-manhattan-costs

