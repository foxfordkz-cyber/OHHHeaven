"""D12 patches: every entry keeps the id of the record it corrects.
'set' holds the new field values; 'why' is the line for the report (Russian)."""

W = 'https://www.webstaurantstore.com'
OEWS = 'https://dol.ny.gov/statistics-oewswagezip'

CAFE_PATCHES = [
    # ---------- setup ----------
    {'section': 'setup', 'id': 'grinder', 'why': 'E65S за $2 099 снята с производства и нет в наличии: купить её в 2026 году нельзя; ставлю её преемника по той же странице',
     'set': {'name': 'Espresso grinder (Mahlkonig E65W)', 'cost': 3099, 'confidence': 'verified',
             'note': 'Mahlkonig E65W Grind-by-Sync: $3,099.00 at Visions Espresso (sale price; list $3,199), seen November 14, 2026. The E65S at $2,099 that the first pass used is marked discontinued (2025 update) and out of stock, so a new shop cannot buy it. Lifespan is my estimate.'}},
    {'section': 'setup', 'id': 'decaf_grinder', 'why': 'та же причина: E65S больше не продаётся',
     'set': {'name': 'Second grinder for decaf (Mahlkonig E65W)', 'cost': 3099, 'confidence': 'verified',
             'note': 'A second Mahlkonig E65W at $3,099.00 seen at Visions Espresso on November 14, 2026 (the E65S at $2,099 is discontinued and out of stock). A cheaper used or entry-level grinder is the usual way to save here; no listing was checked for it.'}},
    {'section': 'setup', 'id': 'sinks', 'why': 'раковина на три отделения стоит $649, а не $850; раковина для рук и мойка для швабр найдены у того же продавца',
     'set': {'cost': 1519, 'source': f'{W}/regency-60-16-gauge-stainless-steel-three-compartment-commercial-sink-without-drainboards-17-x-17-x-12-bowls/600S31717X.html',
             'note': 'Seen at WebstaurantStore on November 14, 2026: Regency 60-inch three-compartment sink $649.00; Regency wall-mount hand sink with gooseneck faucet $82.99-$89.99; Regency floor mop sink $234.49-$349.99 (I take $279.99). Faucets, pre-rinse and fittings stay the research notes\' $500 allowance, not seen: $649 + $90 + $280 + $500 = $1,519. Plumbing labor is in the build-out. The Health Code requires a hand-washing sink near every place food is prepared and in each restroom.'}},
    {'section': 'setup', 'id': 'fse_permit', 'why': 'на странице NYC Business открыть можно на 22-й день, а не на 21-й; плюс $25 за замороженные десерты',
     'set': {'waitDays': 22,
             'note': 'NYC Business, seen November 14, 2026: the permit fee for most food service establishments is $280.00 a year, plus $25.00 if you make frozen desserts (soft serve, gelato); you can open 22 days after you submit the application even if no pre-permit inspection has taken place, or call 212-676-1600 for a pre-operating inspection to open sooner. The application asks for proof of workers\' compensation and disability insurance, a Food Protection Certificate or course registration, and the sales tax Certificate of Authority. The clock starts when the build-out is finished: the Health Department checks the finished room. The permit does not pass to a buyer of an operating business: the new owner applies again.'}},
    {'section': 'setup', 'id': 'batch_brewer', 'why': 'цену Bunn CWTF15-APS $980 удалось увидеть самому (раньше страница KaTom не открывалась)',
     'set': {'source': f'{W}/search/bunn-cwtf15-aps.html',
             'note': 'Bunn CWTF15-APS automatic brewer (item 234230010006): $980.00 at WebstaurantStore, seen November 14, 2026, matching the research notes\' KaTom price. Plus the notes\' $800 allowance for a bulk grinder and airpots (not seen). Drip coffee is the fastest thing on the menu at the morning peak.'}},
    {'section': 'roadmap', 'id': 'get_fse_permit', 'why': 'тот же срок 22 дня, что и в setup[fse_permit]',
     'set': {'waitDays': 22}},
    # ---------- staff ----------
    {'section': 'staff', 'id': 'barista', 'why': 'по данным NY DOL (OEWS, пересчёт на I квартал 2026) медиана работников стойки в Нью-Йорке — $17.57 в час, средняя — $18.90, и это вместе с чаевыми; $21 без чаевых выше рынка',
     'set': {'hourlyWage': 18, 'cashWage': 18, 'source': OEWS,
             'note': 'NY Department of Labor OEWS file (wages updated to the first quarter of 2026), New York City region, SOC 35-3023 Fast Food and Counter Workers, the occupation that holds baristas: median $36,545.83 a year ($17.57 an hour at 2,080 hours), mean $39,310.12 ($18.90), entry $35,510.25 ($17.07). OEWS wages include tips. A shop that pays the full $17.00 minimum with no tip credit and lets baristas keep their tips pays $17-$19; $18 is my middle. The research notes planned $21, which is above the market median even before tips. The tipped rate of $11.35 + $5.65 credit is legal only with written notice and tips that cover the gap (12 NYCRR 146-1.3).'}},
    {'section': 'staff', 'id': 'shift_lead', 'why': '$24 совпадает с медианой NY DOL для бригадиров общепита в Нью-Йорке ($24.07): оценка подтверждена',
     'set': {'source': OEWS, 'confidence': 'verified',
             'note': 'NY Department of Labor OEWS file (wages updated to the first quarter of 2026), New York City region, SOC 35-1012 First-Line Supervisors of Food Preparation and Serving Workers: median $50,060.70 a year ($24.07 an hour), mean $54,158.95 ($26.04). $24 is the median rounded. A shift lead with a Food Protection Certificate covers the rule that a certified supervisor is on site every open hour.'}},
    # ---------- monthlyCosts ----------
    {'section': 'monthlyCosts', 'id': 'sick_leave_cover', 'why': 'пересчёт от новой ставки бариста $18',
     'set': {'amount': 60,
             'note': 'Up to 40 paid hours a year per worker for employers with 5-99 workers (DCWP): 40 h x $18 / 12 = $60 a month per worker when it is all used. Since February 22, 2026 every employer also owes 32 more hours of unpaid leave a year, available at once (law-firm alerts on the ESSTA amendments; the DCWP page could not be opened from this session), and 20 hours of paid prenatal leave a year under New York State law.'}},
    # ---------- violations ----------
    {'section': 'violations', 'id': 'unlicensed_sidewalk_cafe', 'why': 'статьи закона были «по памяти»; на странице Dining Out NYC они названы: 19-160.1, 19-160.4, 19-160.5(c), 19-160.6 и 34 RCNY 5-10, 5-11',
     'set': {'law': 'NYC Administrative Code §§19-160.1, 19-160.4, 19-160.5(c), 19-160.6; 34 RCNY §§5-10, 5-11 (Dining Out NYC)',
             'note': 'Dining Out NYC enforcement page, seen November 14, 2026: unlicensed setups get a penalty with no warning, $500 for the first offense and $1,000 for the second and later ones, and the Transportation Department may order the setup removed. Licensed cafes that break the design or operation rules first get a corrective action request with 30 days to fix it, then $200 and $500. Since 2026 roadway dining may run all year; seasonal roadway cafes run April 1 to November 29. The game charges $500 per citation.'}},
    {'section': 'violations', 'id': 'spoiled_food', 'why': 'в таблице штрафов холодная еда выше 41°F стоит $250–$600, а не $250–$500 (строки 02G по уровням I–V)',
     'set': {'note': 'Penalty schedule (24 RCNY Chapter 23, Appendix 23-C; rule text of 2021 on rules.cityofnewyork.us and the NYC Business restaurant page agree): "Cold TCS food not held at 41°F or below" (02G) $250, $300, $350, $400 or $600 by condition level I-V; "Food not protected from adulteration or contamination" (04H) the same $250-$600. Both are public health hazards that must be corrected immediately; 7 to 10 points, 28 at the worst level. Game formula: $300 in the first month, up to $600.'}},
    {'section': 'violations', 'id': 'no_food_protection_cert', 'why': 'три разных числа в трёх документах; оставляю $400 действующей сводной таблицы и записываю расхождение',
     'set': {'note': 'Penalty schedule (24 RCNY Chapter 23, Appendix 23-C, code 04A): "Food Protection Certificate not held by supervisor or manager of food operations" $400, a critical violation worth 10 points; a certificate that exists but cannot be shown costs $200 ($400 on default, code 18-11). Three sources disagree: the 2021 rule text on rules.cityofnewyork.us prints $600 for 04A, the NYC Business restaurant page (seen November 14, 2026) says $500-$1,000 and that the fine doubles after the second violation, and the consolidated schedule the first pass opened says $400. I keep $400 until the current consolidated Appendix 23-C is reread.'}},
    # ---------- events ----------
    {'section': 'events', 'id': 'coffee_price_spike', 'why': 'добавлен настоящий сигнал: биржевая цена арабики (IMF через FRED) прыгала на 15–17% за месяц в 2025–2026 годах',
     'set': {'note': 'Seen at FRED on November 14, 2026. Retail ground coffee (BLS APU0000717311, US city average): $9.457 per lb in June 2026, $9.249 in October 2026, a peak of $9.723 in April 2026. Green arabica (IMF PCOFFOTMUSDM, "Other Mild Arabica", cents per lb): 307.8 in June 2026, 359.2 in July 2026 (+16.7% in one month), 330.1 in September 2026; 276.8 in October 2024 and 409.5 in February 2025 (+48% in four months). Real signal for the event: the monthly arabica price up 15% or more. A 20% rise in the roaster\'s bean price x beans about 25% of cost of goods = +5% on cost of goods; both shares are my estimates.'}},
    {'section': 'events', 'id': 'milk_price_up', 'why': 'числа FRED перепроверены; добавлен пик и ряд',
     'set': {'note': 'Seen at FRED on November 14, 2026 (BLS APU0000709112, whole milk, US city average): $3.997 per gallon in November 2025, $4.317 in June 2026 (+8% in seven months), $4.101 in October 2026. The 10% rise and the dairy share of cost of goods (about 30%) are my estimates: 10% x 30% = +3%.'}},
    # ---------- extra ----------
    {'section': 'extra', 'id': 'tipCredit', 'why': 'у записи не было пометки confidence; ставки проверены на 2026 и 2027 год',
     'set': {'confidence': 'verified', 'source': 'https://dol.ny.gov/minimum-wage-tipped-workers',
             'note': 'NY DOL, seen November 14, 2026: New York City food service workers $17.00 = cash wage of at least $11.35 + tip credit of no more than $5.65, the same from January 1, 2027 (the minimum wage does not rise on January 1, 2027 because an off-ramp condition was met). No tip credit on days when a tipped worker spends more than two hours or 20% of the shift on non-tipped work.'}},
]

COMMON_PATCHES = [
    {'section': 'violations', 'id': 'no_i9', 'why': 'штраф за бумажное нарушение I-9 с 3 июля 2025 года — $288–$2 861 за форму (28 CFR 85.5), а не «около $290–$2 900 по памяти»',
     'set': {'fine': {'base': 1152, 'perMonth': 0, 'pctOfSaved': 0, 'max': 11444}, 'confidence': 'verified',
             'source': 'https://www.ecfr.gov/current/title-28/chapter-I/part-85/section-85.5',
             'note': '28 CFR §85.5, table 1, seen on eCFR November 14, 2026: an I-9 paperwork violation (8 U.S.C. 1324a(e)(5)) costs $288 to $2,861 per form for penalties assessed after July 3, 2025 (90 FR 29447). Knowingly employing a worker without authorization is $716 to $5,724 per worker on a first order. Every employer must complete Form I-9 for every person hired and keep it three years after hire or one year after employment ends, whichever is later. Game formula: four forms at the low end ($1,152), capped at four forms at the high end ($11,444).'}},
    {'section': 'violations', 'id': 'returns_not_filed', 'why': 'минимальный штраф $525 увиден на irs.gov для деклараций со сроком после 31.12.2025',
     'set': {'note': 'IRS failure-to-file page, seen November 14, 2026: 5% of the unpaid tax for each month or part of a month late, up to 25%; for a return more than 60 days late the minimum is $525 (returns due after December 31, 2025) or 100% of the tax, whichever is less. New York adds 10% of the sales tax due for the first month and 1% for each month after, up to 30%, minimum $50 (Tax Law §1145(a)(1)(i), seen). Game formula is my estimate for a shop that collects about $4,500 of sales tax a month: the $525 minimum plus $450 for every month without returns.'}},
    {'section': 'violations', 'id': 'no_wc_insurance', 'why': 'добавлено уголовное наказание для работодателя до пяти работников: misdemeanor и штраф $1 000–$5 000; и потолок «вдвое против стоимости страховки»',
     'set': {'note': 'Workers\' Compensation Board, seen November 14, 2026: up to $2,000 for each 10-day period without coverage (up to $6,000 a month), or no more than two times the cost of compensation for the payroll of that period; by the time the first penalty notice arrives it may exceed $12,000. On top: the unpaid premium (1.0 x saved). Failing to cover five or fewer employees within 12 months is a misdemeanor with a $1,000-$5,000 fine; more than five is a class E felony with $5,000-$50,000. A stop-work order under §141-a halts all business until coverage is in place. The 3 closure days are my estimate of how fast a policy can be bought.'}},
    {'section': 'taxes', 'id': 'disability_pfl', 'why': 'ставки NYSIF и PFL 2026 года открыты напрямую; найден минимальный годовой взнос NYSIF $60',
     'set': {'source': 'https://ww3.nysif.com/-/media/Files/DISABILITY_BENEFITS/PDF/UDB-SOC_2026.pdf',
             'note': 'NYSIF disability benefits standard rates effective January 1, 2026 (seen): statutory premium $0.10 per $100 of payroll capped at $340 a week = $17.68 per person a year, minimum annual premium $60 (so a shop with three or fewer workers pays $60); the employer may withhold up to 0.5% of wages, at most $0.60 a week, from each worker. $17.68 / $40,320 = 0.04% of a full-time wage. Paid Family Leave is paid by the worker through payroll deduction: 0.432% of wages, at most $411.91 in 2026 (seen at paidfamilyleave.ny.gov).'}},
    {'section': 'extra.statutory', 'id': None, 'why': 'запись без source и confidence; все ставки 2026 года перепроверены, минимальная зарплата 2027 года подтверждена (off-ramp)',
     'set': {'source': 'https://dol.ny.gov/minimum-wage-0', 'confidence': 'verified',
             'note': 'Seen November 14, 2026: Social Security 6.2% on wages up to $184,500 and Medicare 1.45% (IRS Publication 15, 2026); FUTA 6.0% on $7,000 less up to 5.4% credit (IRS Topic 759); NY UI new employer rate 4.1% and wage base $17,600 for 2026 (NY DOL); NYC minimum wage $17.00 in 2026 and still $17.00 on January 1, 2027 because one of the law\'s off-ramp conditions was met; tipped food service cash wage $11.35 + $5.65 credit for 2026 and 2027 (NY DOL); MCTMT threshold $312,500 a quarter (Form MTA-305 instructions); LLC $200 and Certificate of Publication $50 (NYS DOS); single-member LLC fee $25 (NYS Tax). CRT and UBT values were not reopened: nyc.gov refuses automated requests from this session.'}},
]

NEW_SOURCES = [
    {'url': OEWS, 'title': 'NY DOL: Occupational Employment and Wage Statistics data file, wages updated to Q1 2026 (oewsdata.csv)'},
    {'url': 'https://dol.ny.gov/minimum-wage-0', 'title': 'NY DOL: minimum wage as of 01/01/2027 and the off-ramp'},
    {'url': 'https://www.ecfr.gov/current/title-28/chapter-I/part-85/section-85.5', 'title': '28 CFR 85.5: DOJ civil monetary penalties, adjusted July 3, 2025'},
    {'url': 'https://rules.cityofnewyork.us/wp-content/uploads/2021/09/Full-Text-Chapter-23-NOA_Penalty-Schedule_9-2-21-1.pdf', 'title': 'DOHMH: Chapter 23 penalty schedule, adopted rule text (effective October 4, 2021)'},
    {'url': 'https://rules.cityofnewyork.us/wp-content/uploads/2025/10/Ch.-23-NOA_FSE-Inspections_10-16-25.pdf', 'title': 'DOHMH: Chapter 23 amendment, effective November 15, 2025'},
    {'url': 'https://fred.stlouisfed.org/series/PCOFFOTMUSDM', 'title': 'FRED: IMF Global price of Coffee, Other Mild Arabica, monthly'},
    {'url': 'https://www.tax.ny.gov/pdf/publications/sales/pub718.pdf', 'title': 'NYS Tax Publication 718: sales and use tax rates by jurisdiction, effective March 1, 2025'},
    {'url': 'https://paidfamilyleave.ny.gov/2026', 'title': 'NY Paid Family Leave: 2026 contribution 0.432%, cap $411.91'},
    {'url': 'https://ww3.nysif.com/-/media/Files/DISABILITY_BENEFITS/PDF/UDB-SOC_2026.pdf', 'title': 'NYSIF: disability benefits rates effective January 1, 2026'},
    {'url': f'{W}/search/bunn-cwtf15-aps.html', 'title': 'WebstaurantStore: Bunn CWTF15-APS brewer'},
    {'url': f'{W}/search/regency-hand-sink.html', 'title': 'WebstaurantStore: Regency hand sinks'},
    {'url': f'{W}/search/regency-mop-sink.html', 'title': 'WebstaurantStore: Regency mop sinks'},
]

# Numbers re-opened and found exactly as the pack states (no change). Filled in as checks are done.
CHECKED_ONLY = []
