
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
