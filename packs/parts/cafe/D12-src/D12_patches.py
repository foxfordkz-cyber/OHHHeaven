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
             'note': 'Seen November 14, 2026: Social Security 6.2% on wages up to $184,500 and Medicare 1.45% (IRS Publication 15, 2026); FUTA 6.0% on $7,000 less up to 5.4% credit (IRS Topic 759); NY UI new employer rate 4.1% and wage base $17,600 for 2026 (NY DOL); NYC minimum wage $17.00 in 2026 and still $17.00 on January 1, 2027 because one of the law\'s off-ramp conditions was met (the Governor proposes $17.60 from March 1, 2027 if the Legislature agrees: governor.ny.gov, seen); tipped food service cash wage $11.35 + $5.65 credit for 2026 and 2027 (NY DOL); MCTMT threshold $312,500 a quarter (Form MTA-305 instructions); LLC $200 and Certificate of Publication $50 (NYS DOS); single-member LLC fee $25 (NYS Tax). CRT and UBT values were not reopened: nyc.gov refuses automated requests from this session.'}},
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

# ---------------- second batch ----------------
RULES21 = 'https://rules.cityofnewyork.us/wp-content/uploads/2021/09/Full-Text-Chapter-23-NOA_Penalty-Schedule_9-2-21-1.pdf'
CAFE_PATCHES += [
    {'section': 'violations', 'id': 'pest_activity', 'why': 'штраф за отсутствие на месте договора с дезинсектором (код 28-06) — $200, при неявке $400, а не $100; формула пересчитана',
     'set': {'fine': {'base': 350, 'perMonth': 50, 'pctOfSaved': 0, 'max': 550},
             'note': 'Penalty schedule (24 RCNY Chapter 23, Appendix 23-C; adopted rule text on rules.cityofnewyork.us): rats, mice or live roaches (04K, 04L, 04M) $200, $200, $250, $300 or $350 by condition level I-V; the contract with a pest management professional and the service records not kept on the premises (28-06) $200, or $400 on default. Skipping pest control means both: $200-$350 + $200 = $400-$550. Game formula: $400 in the first month, up to $550. Scoring: 5 to 8 points, 28 at the worst level, which alone means a C. The NYC Business restaurant page (seen November 14, 2026) states $500-$1,000 for evidence of pests and that the fine doubles after the second violation: it disagrees with the schedule, and the schedule is the legal text. The Health Code requires a contract with a state-licensed exterminator (§81.23(b)). The 2 closure days are my estimate for an infestation that cannot be fixed during the inspection.'}},
    {'section': 'extra.takeover', 'id': None, 'why': 'по BizBuySell медианный проданный бизнес кофейни стоит 0.41 годовой выручки (2.2 годовой прибыли владельца), а в пакете 0.2: покупка готового бизнеса была вдвое дешевле жизни',
     'set': {'multipleOfAnnualSales': 0.4, 'max': 300000, 'source': 'https://www.bizbuysell.com/learning-center/valuation-benchmarks/coffee-shops-cafes/', 'confidence': 'estimate',
             'note': 'BizBuySell coffee shop and cafe valuation benchmarks (seen through search on November 14, 2026; the page itself is outside this session\'s network): median sale price $150,000, median asking price $175,000, median revenue $375,000, median owner earnings $78,780; sold businesses traded at a median 0.41 times revenue and an average 2.2 times earnings. Restaurants in the Northeast traded at the lowest cash-flow multiple in the country in Q2 2026, 2.05 (BizBuySell Insight Report). NYC listings seen in search: a Manhattan coffee shop asking $645,000 on $135,000 of cash flow, an East Village one at $150,000, a Staten Island cafe asset sale at $100,000. The game asks 40% of a year of sales the address supports, between $80,000 and $300,000. The buyer still signs a lease (new deposit), applies for a new Health Department permit (it does not transfer), restocks and hires. awareness 0.9 and refreshDays stay estimates waiting for evidence (research/prompts/80-codex-real-factors.md, part A).'}},
    {'section': 'unit', 'id': None, 'why': 'проверено: публичной статистики среднего чека кофейни Нью-Йорка нет; оставлено как оценка, добавлены опоры',
     'set': {'note': 'Planning assumption from research notes (economics.md, 2026 planning model): an average ticket of $8.50 before sales tax (a drink, sometimes with a pastry). Menu anchors seen by the note\'s author in 2026: latte $4.25-$6.99, croissant $4.00-$5.49. Ingredients, food and spoilage are 26% of sales = $2.21 per order; cups, lids and napkins (another 2%) are a separate monthly cost line, so the full cost of goods is 28%. No public statistic of the average NYC cafe ticket exists (searched November 14, 2026). Input prices behind the cost line were checked: retail ground coffee $9.25 per lb and whole milk $4.10 per gallon in October 2026 (BLS via FRED), a 12 oz hot cup 4.6 cents (WebstaurantStore, $45.99 per 1,000).'}},
]

def _lever_note(lever_id, option_id, note, source, conf='estimate'):
    return {'lever': lever_id, 'option': option_id, 'note': note, 'source': source, 'confidence': conf}

LEVER_NOTES = [
    _lever_note('cleaning', 'standard', 'My estimate: staff clean during paid shifts; $130 is chemicals, paper and one monthly deep clean. No NYC tariff exists.', 'https://www.airtasker.com/us/costs/commercial-cleaning/commercial-cleaner-cost/'),
    _lever_note('cleaning', 'deep', 'My estimate: a crew a few nights a week on top of staff cleaning, $400 more than standard. Seen through search: vendor prices for small NYC commercial spaces start at $150-$500 a month for an office up to 1,000 sq ft, and restaurant cleaning runs $50-$150 an hour for a professional crew; nightly restaurant service would cost more than this option. Not a quote.', 'https://www.airtasker.com/us/costs/commercial-cleaning/commercial-cleaner-cost/'),
    _lever_note('cleaning', 'minimal', 'My estimate: $30 of supplies. Leads to dirty_surfaces: $200-$300 and 5-8 points per citation (Appendix 23-C, code 06D).', RULES21),
    _lever_note('sourcing', 'specialty', 'My arithmetic: about 108 kg (238 lb) of beans a month for 6,000 orders at 18 g, times about $3 more per lb for a specialty roaster = $714, rounded to $750 with local dairy. The $3 premium is my estimate; retail ground coffee averaged $9.25 per lb in October 2026 (BLS via FRED).', 'https://fred.stlouisfed.org/series/APU0000717311'),
    _lever_note('hours', 'long', 'My arithmetic with the D12 barista wage: three more open hours a day x 30 days = 90 paid hours x $18 x 1.116 employer taxes = $1,808, plus about $200 of power and supplies = about $2,000 (the first pass had $2,300 at $21). The +8% demand is a game estimate.', 'https://dol.ny.gov/statistics-oewswagezip'),
    _lever_note('pest_control', 'monthly', 'Seen through search (vendor pages, not quotes): monthly contracts for small NYC restaurants run about $150-$300. $175 sits in that band. The Health Code requires a contract with a state-licensed exterminator and its records on site (§81.23(b)).', 'https://broadwaypest.pages.dev/faq/'),
    _lever_note('pest_control', 'none', 'Leads to pest_activity: $200-$350 for the evidence plus $200 for no contract on site (Appendix 23-C, codes 04K-04M and 28-06).', RULES21, 'verified'),
    _lever_note('staff_pay', 'above', 'My arithmetic: $2 x 160 h x 4 baristas = $1,280 x 1.116 employer taxes = $1,428, rounded to $1,430. The quality and capacity effects are game estimates.', 'https://dol.ny.gov/statistics-oewswagezip'),
]

SHORTCUT_NOTES = {
    'skip_food_protection_cert': ('My estimate: certifying and paying a lead on every shift costs about $120 a month more (the exam is $24 a person; a lead earns about $6 an hour more than a barista: NY DOL OEWS Q1 2026, NYC supervisors median $24.07 vs counter workers $17.57). The fine is $400 and 10 points (Appendix 23-C, 04A).', 'https://dol.ny.gov/statistics-oewswagezip'),
    'keep_old_food': ('My estimate: about 1% of sales is food thrown out at the end of the day. The fine for cold food above 41°F or food not protected is $250-$600 (Appendix 23-C, 02G and 04H).', RULES21),
    'home_baked_pastries': ('My estimate: pastry is about 6% of sales and home baking halves its cost = about 3% of sales. Home-cooked food is "food from an unapproved source": $400-$600 (Appendix 23-C, 03A).', RULES21),
    'keep_tips': ('My estimate: about $150 a month per barista out of tips. Labor Law §196-d forbids any part of the gratuities to the employer; §198(1-a) adds 100% liquidated damages (texts seen at nysenate.gov).', 'https://www.nysenate.gov/legislation/laws/LAB/196-D'),
    'unpaid_trial_shifts': ('My arithmetic: about 5 unpaid hours per worker a month x $17.00 NYC minimum = $85 (NY DOL, minimum unchanged on January 1, 2027).', 'https://dol.ny.gov/minimum-wage-0'),
    'no_spread_of_hours': ('My arithmetic: about 8 days a month with a workday spread over 10 hours x one extra hour at $17.00 = $136 per worker (12 NYCRR §146-1.6; the minimum seen at NY DOL).', 'https://dol.ny.gov/minimum-wage-0'),
    'sidewalk_tables': ('My estimate: a few tables outside add about 2% of sales. Unlicensed outdoor dining is fined $500, then $1,000, with no warning (Dining Out NYC enforcement page, seen).', 'https://www.diningoutnyc.info/enforcement'),
    'skip_grease_trap_cleaning': ('My estimate: about one pump-out a quarter at $200-$330 (vendor and consumer cost guides seen through search; a Manhattan average of $329-$473 per service) = about $75 a month. Fine $100-$1,500 (NYC Business restaurant page, DEP).', 'https://nyc-business.nyc.gov/nycbusiness/resources-by-industry/restaurant'),
}

COMMON_SHORTCUT_NOTES = {
    'cash_wages': ('My arithmetic from rates seen: employer FICA 7.65% (IRS Pub. 15, 2026) + NY UI 1.79% effective (4.1% on the first $17,600, NY DOL) + FUTA 0.10% effective (IRS Topic 759) + workers\' comp 2% planning rate + disability 0.04% (NYSIF 2026) = 11.58% of payroll.', 'https://www.irs.gov/publications/p15'),
    'contractor_1099': ('My arithmetic: the same employer taxes without the workers\' comp planning rate, 7.65% + 1.79% + 0.10% + 0.04% = 9.58%, rounded to 10%.', 'https://www.irs.gov/publications/p15'),
    'underreport_sales': ('My arithmetic: a tenth of sales off the books keeps 10% x 8.875% = 0.89% of sales in sales tax (NYC rate, Pub. 718) plus income and self-employment tax on the profit of those sales, 10% x 72% gross margin x 31.1% = 2.24%: about 3.1% of sales.', 'https://www.tax.ny.gov/pdf/publications/sales/pub718.pdf'),
    'keep_sales_tax': ('Game cap, see extra.shortcutNotes: 4.5% of sales, about half of the 8.875% a cafe collects (Pub. 718) and all of the 4.5% a barbershop collects. Late remittance: 10% for the first month and 1% a month after, up to 30% (Tax Law §1145, seen).', 'https://www.nysenate.gov/legislation/laws/TAX/1145'),
    'no_workers_comp': ('The game\'s planning premium of 2% of payroll (taxes.workers_comp). Insureon reports coffee shops pay about $88 a month on average across the US (seen); a New York quote depends on class code and payroll.', 'https://www.insureon.com/food-business-insurance/coffee-shops-cafes/cost'),
    'skip_overtime_pay': ('My arithmetic: if 8% of paid hours are over 40 a week, skipping the half-time premium saves 8% x 0.5 = 4% of payroll.', 'https://www.nysenate.gov/legislation/laws/LAB/198'),
    'off_the_clock': ('My arithmetic: 15 minutes before and 20 minutes after an 8-hour shift = 35 / 480 = 7.3% of hours, rounded to 8%.', 'https://www.nysenate.gov/legislation/laws/LAB/198'),
    'personal_on_business': ('My arithmetic: about $1,450 a month of personal spending booked as expenses x the game\'s 31.1% profit tax (17% income + 14.13% self-employment) = $450.', 'https://www.irs.gov/payments/accuracy-related-penalty'),
    'skip_i9': ('My estimate: about half an hour of the owner\'s time per hire at $30 an hour = $15. The fine is $288-$2,861 per form (28 CFR 85.5, seen).', 'https://www.ecfr.gov/current/title-28/chapter-I/part-85/section-85.5'),
    'skip_tax_filings': ('Equals the cafe pack\'s bookkeeping line ($400 a month, research notes estimate). The IRS minimum failure-to-file penalty is $525 for returns due after 2025 (seen).', 'https://www.irs.gov/payments/failure-to-file-penalty'),
    'no_paid_sick_leave': ('My arithmetic: 40 paid hours a year x $21 / 12 = $70 per worker a month (cafe pack after D12: 40 x $18 / 12 = $60). DCWP penalty: three times the unpaid wages or $250, plus $500 per denial (first pass; nyc.gov not reachable from this session).', 'https://www.nyc.gov/site/dca/about/paid-sick-leave-FAQs.page'),
    'card_only': ('My estimate: about $150 a month of counting, bank runs and change orders. Refusing cash costs $750, $1,350, then $1,500 per violation (NYC Business restaurant page, 6 RCNY §6-72, seen).', 'https://nyc-business.nyc.gov/nycbusiness/resources-by-industry/restaurant'),
}

CHECKED_ONLY += [
    {'where': 'setup[espresso_machine].cost', 'value': 7600, 'source': f'{W}/espresso-machine-2gr-appi/238APLCV2.html', 'seen': 'Nuova Simonelli Appia Life Compact Two Group Volumetric 110V $7,600.00'},
    {'where': 'setup[premium_espresso_machine].cost', 'value': 4100, 'source': f'{W}/search/nuova-simonelli-appia-life-3-group.html', 'seen': 'Appia Life Three Group Volumetric 220V $11,700.00; 11,700 - 7,600 = 4,100'},
    {'where': 'setup[premium_grinder].cost', 'value': 3899, 'source': 'https://visionsespresso.com/coffee-grinders/brands/mahlkonig/', 'seen': 'Mahlkonig EK43 $3,899.00 (sale; list $3,999)'},
    {'where': 'setup[pastry_case].cost', 'value': 1149, 'source': 'https://www.webstaurantstore.com/13469/refrigerated-bakery-cases-and-dry-bakery-display-cases.html', 'seen': 'Avantco BCS-48-HC 48-inch refrigerated countertop bakery case $1,149.00'},
    {'where': 'setup[refrigeration].cost (part)', 'value': 1199, 'source': f'{W}/avantco-a-19r-hc-29-solid-door-reach-in-refrigerator/178A19RHC.html', 'seen': 'Avantco A-19R-HC $1,199.00; the Atosa part ($1,429) is still unseen'},
    {'where': 'setup[dishwasher].cost', 'value': 4449, 'source': 'https://catalog.webstaurantstore.com/noble-warewashing-ht-uc24-select-high-temperature-undercounter-dishwasher-with-booster-heater-208-240v-1-phase/495HTUC24.html', 'seen': 'Noble Warewashing HT-UC24 $4,449.00'},
    {'where': 'setup[table_share].cost', 'value': 35, 'source': f'{W}/lancaster-table-seating-24-x-24-reversible-walnut-oak-laminated-standard-height-table-top-and-base-kit-with-17-base/349C24SW17RS.html', 'seen': 'Lancaster 24 x 24 table kit $69.99; / 2 seats = $35'},
    {'where': 'setup[chair].cost', 'value': 49, 'source': 'https://www.webstaurantstore.com/42529/restaurant-chairs.html?vendor=Lancaster-Table-Seating', 'seen': 'Lancaster chairs $37.99 (ladder back, vinyl seat) to $84.99; metal cafe chairs from $49.99'},
    {'where': 'setup[llc_and_publication].cost', 'value': 1675, 'source': 'https://www.llcpublishers.com/pricing', 'seen': 'DOS $200 Articles + $50 Certificate of Publication; LLC Publishers Kings $1,475, New York $1,795, Bronx $1,745, Queens $1,195, Richmond $1,295, Albany $395'},
    {'where': 'setup[food_protection_cert].cost', 'value': 24, 'source': 'https://nyc-business.nyc.gov/nycbusiness/description/food-protection-certificate', 'seen': 'free online course + $24 exam; classroom $114; replacement $16; never expires'},
    {'where': 'setup[sidewalk_cafe_license].cost', 'value': 2550, 'source': 'https://www.diningoutnyc.info/apply/fees', 'seen': 'license $1,050 per 4 years + refundable deposit $1,500 (sidewalk), $2,500 (roadway); consent $6/$10/$18/$31 per sq ft by sector'},
    {'where': 'taxes[sales_tax].rate', 'value': 0.08875, 'source': 'https://www.tax.ny.gov/pdf/publications/sales/pub718.pdf', 'seen': 'New York City 8 7/8, reporting code 8081, effective March 1, 2025'},
    {'where': '_common taxes[employer_fica].rate', 'value': 0.0765, 'source': 'https://www.irs.gov/publications/p15', 'seen': '6.2% + 1.45%, wage base $184,500 (2026)'},
    {'where': '_common taxes[ny_unemployment] inputs', 'value': '4.1%, $17,600', 'source': 'https://dol.ny.gov/bizserve/ui/prg/rate', 'seen': '2026 new employer rate 4.1% (range 1.7%-9.5%); wage base 2026 $17,600 (wbarchive)'},
    {'where': '_common taxes[futa] inputs', 'value': '6.0% - 5.4% on $7,000', 'source': 'https://www.irs.gov/taxtopics/tc759', 'seen': 'FUTA 6.0% on first $7,000, credit up to 5.4%'},
    {'where': '_common taxes[mctmt] threshold', 'value': 312500, 'source': 'https://www.tax.ny.gov/forms/current-forms/mta/mta305i.htm', 'seen': 'not subject if quarterly MCTD payroll is not greater than $312,500; lowest rate 0.055%'},
    {'where': '_common taxes[nys_llc_filing_fee].rate', 'value': 25, 'source': 'https://www.tax.ny.gov/pit/efile/annual_filing_fee.htm', 'seen': 'disregarded-entity LLC with NY income: $25'},
    {'where': '_common violations[sales_tax_fraud] / [sales_tax_not_remitted]', 'value': '2x tax; 10% + 1%/month to 30%, min $50; records $1,000 then $5,000 a quarter', 'source': 'https://www.nysenate.gov/legislation/laws/TAX/1145', 'seen': 'Tax Law §1145(a)(1)(i), (a)(2), (i)'},
    {'where': '_common violations[no_wc_insurance].fine.perMonth', 'value': 6000, 'source': 'https://www.wcb.ny.gov/content/main/Employers/violations-wclaw.jsp', 'seen': 'up to $2,000 for every 10-day period without coverage'},
    {'where': '_common violations[unpaid_overtime], [below_minimum_wage]; cafe [tip_theft], [unpaid_training_time], [spread_of_hours_unpaid] pctOfSaved', 'value': 2, 'source': 'https://www.nysenate.gov/legislation/laws/LAB/198', 'seen': 'Labor Law §198(1-a): wages + liquidated damages up to 100% (up to 300% for willful §194 violations); six-year reach'},
    {'where': '_common violations[bribery].fine.base', 'value': 5000, 'source': 'https://www.nysenate.gov/legislation/laws/PEN/80.00', 'seen': 'Penal Law §80.00: felony fine up to $5,000 or double the gain; §200.00 bribery 3rd degree is a class D felony'},
    {'where': '_common violations[refusing_cash].fine', 'value': '750 / 1,500', 'source': 'https://nyc-business.nyc.gov/nycbusiness/resources-by-industry/restaurant', 'seen': '$750 first, $1,350 second, $1,500 third and each after (6 RCNY §6-72); stores may refuse bills above $20'},
    {'where': 'violations[grease_interceptor_neglect].fine', 'value': '100-1,500', 'source': 'https://nyc-business.nyc.gov/nycbusiness/resources-by-industry/restaurant', 'seen': 'Failure to install or maintain a grease interceptor: $100 - $1,500 (DEP, Use of the Public Sewers §19)'},
    {'where': 'violations[no_fse_permit].fine', 'value': '1,000 / 2,000', 'source': RULES21, 'seen': '18-01 NYCHC 81.05(a) no current valid permit $1,000, default $2,000'},
    {'where': 'violations[dirty_surfaces].fine', 'value': '200-300', 'source': RULES21, 'seen': '06D NYCHC 81.27(b) $200, $200, $250, $300 by condition level'},
    {'where': 'violations[unapproved_food_source].fine', 'value': '400-600', 'source': RULES21, 'seen': '03A NYCHC 81.04 food from unapproved or unknown source, or home cooked $400, $600'},
    {'where': 'monthlyCosts[card_fees], [card_fixed_fee] inputs', 'value': '2.5% + 15¢ (Plus)', 'source': 'https://squareup.com/help/us/en/article/5068-what-are-square-s-fees', 'seen': 'Free 2.6% + 15¢, Plus 2.5% + 15¢, Premium 2.4% + 15¢ for tap, dip or swipe'},
    {'where': 'monthlyCosts[insurance] anchor', 'value': 126, 'source': 'https://www.insureon.com/food-business-insurance/coffee-shops-cafes/cost', 'seen': 'BOP $126 a month, general liability $82, workers\' comp $88 (US averages of Insureon customers)'},
    {'where': 'benchmarks netMarginPct and prime cost; rentPct anchor', 'value': '0.04; 65%; 6.0%', 'source': 'https://restaurant.org/research-and-media/research/restaurant-economic-insights/analysis-commentary/restaurant-occupancy-costs-were-more-than-5-of-sales-in-2024/', 'seen': 'NRA: limited-service median pre-tax income 4.0%, prime cost 65%; occupancy 6.0% of sales for urban limited-service (2024 data)'},
    {'where': 'events[coffee_price_spike], [milk_price_up] series values', 'value': '$9.457 → $9.249; $4.317 → $4.101', 'source': 'https://fred.stlouisfed.org/series/APU0000717311', 'seen': 'FRED csv, June and October 2026'},
    {'where': 'extra.tipCredit; _common extra.statutory.nycMinimumWage2027', 'value': '17 / 11.35 / 5.65', 'source': 'https://dol.ny.gov/minimum-wage-0', 'seen': 'Minimum wage as of 01/01/2027 NYC $17.00; tipped food service $11.35 cash + $5.65 credit'},
    {'where': '_common taxes[disability_pfl] inputs', 'value': '$17.68; 0.432%, $411.91', 'source': 'https://paidfamilyleave.ny.gov/2026', 'seen': 'NYSIF statutory $17.68 per person a year; PFL 2026 0.432% capped at $411.91'},
]

# ---------------- third batch ----------------
CAFE_PATCHES += [
    {'section': 'events', 'id': 'sidewalk_shed', 'why': 'городское исследование 2024 года (Mastercard): у ресторанов и баров за строительными лесами число транзакций в неделю падало на 3.5–9.7% в первые шесть месяцев; с 2026 года разрешение на леса — 90 дней, после 180 дней штрафы владельцу здания',
     'set': {'effect': {'field': 'footTraffic', 'mult': 0.93}, 'months': 6, 'source': 'https://www.nyc.gov/mayors-office/news/2024/08/mayor-adams-releases-new-study-finding-sidewalk-sheds-scaffolding-cost-manhattan-businesses',
             'note': 'Seen through search on November 14, 2026 (nyc.gov refuses this session): the City\'s 2024 study with Mastercard found that dining and drinking places with a sidewalk shed in front saw weekly transactions fall 3.5% to 9.7% in the six months after the shed went up, and card spending at businesses in buildings with sheds fell $3,900-$9,500 a month. I take the middle, -7%, for six months. Owners quoted in the press report 20-30% drops; those are anecdotes. Since Local Laws 48 and 51 of 2025 (in force January 2026) shed permits last 90 days, each renewal costs $130, and after 180 days the building owner pays graduated monthly penalties (up to $6,000 a month): sheds came down faster in 2026. The average shed stood 482 days in August 2023 (Citizens Union report).'}},
    {'section': 'events', 'id': 'restaurant_week', 'why': 'даты и цены Restaurant Week зимой 2027 года увидены на сайте NYC Tourism; эффект для кофейни остаётся оценкой',
     'set': {'note': 'NYC Tourism, seen November 14, 2026: Restaurant Week Winter 2027 runs January 19 to February 11 with prix-fixe menus at $30, $45 and $60; Saturdays are excluded and restaurants may join for one to four weeks. A coffee shop does not sell prix-fixe meals: the 5% lift is my estimate for more people out on the streets of a dining block. No measurement exists.'}},
    {'section': 'setup', 'id': 'sidewalk_cafe_license', 'why': 'добавлены цифры Comptroller: из ~5 000 заявок одобрено 28.6%, в 2026 году — 1 из 388; срок 240 дней — обещание DOT, реальность хуже',
     'set': {'note': 'Dining Out NYC fees, seen November 14, 2026: $1,050 license for a four-year term + $1,500 refundable security deposit for a sidewalk cafe ($2,500 for a roadway cafe, plus a $500-$900 public hearing fee) = $2,550; on top comes a yearly revocable consent fee of $6, $10, $18 or $31 per sq ft by sector (a 120 sq ft sidewalk cafe pays $720-$3,720 a year). The 240-day wait is the Transportation Department\'s own eight-month timeline; the Comptroller found on October 27, 2026 that more than half of approved restaurants waited over 19 months, only 28.6% of nearly 5,000 applications from 2024 to mid-June 2026 were approved, and 1 of 388 filed in 2026. Never part of a starter kit.'}},
]
COMMON_PATCHES += [
    {'section': 'taxes', 'id': 'futa', 'why': 'финальный список штатов со сниженным кредитом FUTA на 2026 год (US DOL, 12.11.2026): только Калифорния и Виргинские острова; для Нью-Йорка 0.6% подтверждено и на 2026 год',
     'set': {'note': 'Seen at IRS Topic 759: 6.0% on the first $7,000 paid to each employee, less a credit of up to 5.4% for state unemployment tax = 0.6%, at most $42 per worker a year. Game rate is the effective share: $42 / $40,320 = 0.10% of payroll (with the D12 barista wage of $18: $42 / $34,560 = 0.12%). US DOL final 2026 credit reductions (updated November 12, 2026, seen): only California (1.5%) and the Virgin Islands; New York is not on the list, so 0.6% holds for 2026.'}},
    {'section': 'taxes', 'id': 'workers_comp', 'why': 'ставки для кода ресторанов Нью-Йорка не найдено; найдено снижение базовых loss costs на 21.9% с 1 октября 2026 года',
     'set': {'note': 'Seen at the Workers\' Compensation Board: coverage is mandatory for most employers of one or more employees, and deducting its cost from wages is a misdemeanor. The premium is quoted per $100 of payroll by job class and claims history, so there is no single rate: you need a quote. Game planning rate, my estimate: 2% of payroll. Anchors: Insureon reports coffee shops pay $88 a month ($1,059 a year) on average across the US (seen); New York\'s overall loss cost level fell 21.9% from October 1, 2026 (NYCIRB filing approved by DFS, seen through search). New York uses its own class codes (restaurants 9071-9074 per brokers); the restaurant loss cost per $100 was not found.'}},
    {'section': 'taxes', 'id': 'ny_unemployment', 'why': 'ставка и база 2026 года открыты напрямую; ставка не меняется, потому что общий файл служит всем нишам, но при ставке бариста $18 настоящая доля — 2.09%',
     'set': {
             'note': 'Seen at NY DOL: new employer rate 4.1% for 2026 (range 1.7%-9.5%) and a 2026 wage base of $17,600, so at most $721.60 per worker a year. The engine multiplies one rate by the whole payroll, so the game rate is the effective share for a full-time worker: $721.60 / $40,320 ($21 x 160 h x 12) = 1.79%; at the D12 cafe barista wage of $18 ($34,560 a year) it is 2.09%. The shared file serves every niche, so the rate is left at 1.79%; a per-worker cap in the engine would remove the guess. For a $17 x 140 h worker ($28,560 a year) the true share is 2.53%. Filed quarterly on Form NYS-45.'}},
]

# ---------------- review of every estimate ----------------
# status: corrected (value changed), verified (now confirmed by an opened source), kept (inputs checked, the number is a
# planning choice or arithmetic and stays an estimate), not_found (no primary source found; what was searched is listed)
REVIEW = [
    # cafe core
    ('cafe', 'startCapital', 224000, 'kept', 'Совпадает с итогом extra.openingBudget «almostReady». Внешние опоры (через поиск, вторичные): калькуляторы дают для Нью-Йорка $150–561 тыс., для Манхэттена «обычно больше $250 тыс.» за 800–1 200 кв. футов. Первоисточника нет.'),
    ('cafe', 'unit.refPrice / cogsPerUnit', '8.5 / 2.21', 'kept', 'Публичной статистики среднего чека нет (искал). Входные цены проверены: кофе $9.25/фунт, молоко $4.10/галлон (FRED, октябрь 2026), стакан 4.6¢.'),
    ('cafe', 'market.unitsPerSlotMonth / priceElasticity / weights', '6000 / -1.3', 'not_found', 'Игровые значения. Эластичность спроса на кофе в кофейне в первоисточниках не найдена; это часть задания 80 (codex), часть A.'),
    ('cafe', 'capacity.unitsPerStaffMonth', 1700, 'not_found', 'Измерений «заказов на бариста в час» в первоисточниках нет; 10.6 заказа на оплаченный час — расчёт заметок.'),
    ('cafe', 'sizing (18 sq ft на место, 170 заказов на место, 60% навынос)', '18 / 170 / 0.6', 'not_found', 'Норма плотности зала — в таблице occupant load Строительного кодекса NYC (по памяти около 15 net sq ft на человека за столами; не открыто, amlegal отвечает 403). Правило «20 мест — гостевой туалет» подтверждено через поиск (Health Code и 10 NYCRR 14-1.142, 311): не действует для помещений, где разрешённое заведение общепита работало до 5 декабря 1977 года; места на общей площадке нескольких заведений суммируются.'),
    # setup
    ('cafe', 'setup[security_deposit]', 18000, 'kept', 'Справочник аренды SBS (nyc.gov) недоступен; три месяца — решение заметок, путеводитель говорит «обычно два».'),
    ('cafe', 'setup[buildout] + extra.buildout.classes', '87.5 / 225 / 400 за кв. фут', 'kept', 'Опора через поиск: медиана открытия во «втором поколении» помещения ~$73 за кв. фут против ~$193 в новом (национальный опрос, вторичный); сайт подрядчика alphacontractorsny вне сети сессии. Сроки 60/90/180 дней — оценка.'),
    ('cafe', 'setup[architect_expediter]', 7000, 'kept', '10% от ремонта — правило заметок, тарифа нет.'),
    ('cafe', 'setup[lease_lawyer]', 3500, 'kept', 'Проверено: SBS даёт бесплатную помощь по договору аренды (NYC Business, открыто). Гонорар $3 500 — оценка заметок.'),
    ('cafe', 'setup[grinder] / [decaf_grinder]', '2099 → 3099', 'corrected', 'E65S снята с производства, нет в наличии; E65W $3 099 (Visions Espresso, открыто).'),
    ('cafe', 'setup[water_filtration]', 500, 'not_found', 'Seattle Coffee Gear вне сети сессии; цены картриджа $192.94 и головы $41.94 не перепроверены.'),
    ('cafe', 'setup[refrigeration]', 2628, 'kept', 'Avantco A-19R-HC $1 199 подтверждён; Atosa MGF8401GR $1 429 не найден на WebstaurantStore (поиск дал только запчасти).'),
    ('cafe', 'setup[sinks]', '1720 → 1519', 'corrected', 'Раковина на три отделения $649, для рук $82.99–89.99, мойка для швабр $234–350 (WebstaurantStore, открыто).'),
    ('cafe', 'setup[prep_table_shelving]', 600, 'not_found', 'Нет списка размеров; оценка заметок.'),
    ('cafe', 'setup[pos]', 1299, 'kept', 'squareup.com отвечает 429; через поиск Square Register $799–899 (NerdWallet и др., вторичные).'),
    ('cafe', 'setup[smallwares]', 2000, 'not_found', 'Корзина без списка; оценка заметок.'),
    ('cafe', 'setup[safety_kit]', 800, 'kept', 'Подтверждено правило: маска для взрослого, детская маска, две пары перчаток (NYC Business, открыто). Сумма — оценка.'),
    ('cafe', 'setup[equipment_delivery_tax]', 3500, 'kept', 'Ставка 8.875% подтверждена (Pub 718); $25 000 оборудования и доставка — расчёт заметок.'),
    ('cafe', 'setup[opening_inventory]', 3000, 'kept', 'Стаканы $45.99 за 1 000 подтверждены; остальное — корзина заметок.'),
    ('cafe', 'setup[hiring_training]', 4000, 'kept', 'При ставке $18: 190 ч × $18 = $3 420 + объявления; $4 000 оставлено.'),
    ('cafe', 'setup[insurance_utility_deposits]', 1500, 'kept', 'Insureon $126 BOP подтверждён; депозиты Con Edison не открывались.'),
    ('cafe', 'setup[batch_brewer]', 1780, 'kept', 'Bunn CWTF15-APS $980 подтверждён (WebstaurantStore); $800 на гриндер и термосы — оценка.'),
    ('cafe', 'setup[ice_machine]', 3500, 'not_found', 'oswaltsupply вне сети; на WebstaurantStore Manitowoc UYF0140A не найден.'),
    ('cafe', 'setup[decor_lighting]', 2000, 'not_found', 'Оценка заметок.'),
    ('cafe', 'setup[signage]', 1500, 'kept', 'Подтверждено правило DOB: вывеска, прикрученная к зданию или с подсветкой, требует одобрения DOB (NYC Business, открыто). Цена — оценка.'),
    ('cafe', 'setup[customer_restroom]', 12000, 'not_found', 'Цены переделки туалета под ADA в первоисточниках нет.'),
    # monthly
    ('cafe', 'monthlyCosts[rent]', 6000, 'kept', '$90 за кв. фут на боковой улице Бруклина — оценка; страница REBNY рендерится скриптом, цифры коридоров не получены. Через поиск: C&W Q2 2026 Flatiron $306, SoHo $393; Q3 2026 средняя по Манхэттену $730 (первый этаж).'),
    ('cafe', 'monthlyCosts[utilities]', 1100, 'kept', 'NYSERDA отвечает 403. FRED (BLS): электричество для жителей NYC 25–29¢/кВт·ч в 2024 году — выше 23.1¢ штата для бизнеса, поэтому электричество может быть на ~15–20% дороже заметок.'),
    ('cafe', 'monthlyCosts[insurance]', 250, 'kept', 'Insureon: BOP $126, общая ответственность $82 (открыто). $250 — резерв NYC.'),
    ('cafe', 'monthlyCosts[supplies]', 0.17, 'kept', 'Стакан 4.6¢ подтверждён; 2% от продаж — модель заметок.'),
    ('cafe', 'monthlyCosts[card_fees] / [card_fixed_fee]', '0.0255 / 0.135', 'kept', 'Ставки Square подтверждены (2.5% + 15¢ на Plus); доля карт 90% и чаевые $2 000 — допущения.'),
    ('cafe', 'monthlyCosts[tips_payroll_tax]', 0.003, 'kept', 'Правило IRS о чаевых как зарплате — Pub 15 (открыта); сумма чаевых — допущение.'),
    ('cafe', 'monthlyCosts[sick_leave_cover]', '70 → 60', 'corrected', 'Пересчёт от ставки $18.'),
    ('cafe', 'monthlyCosts[maintenance]', 300, 'not_found', 'Полоса $200–500 из заметок.'),
    ('cafe', 'monthlyCosts[waste]', 250, 'not_found', 'Предельные цены перевозчиков по зонам (CWZ) есть только в калькуляторе DSNY на nyc.gov — недоступен.'),
    ('cafe', 'monthlyCosts[internet]', 100, 'not_found', 'verizon.com вне сети.'),
    ('cafe', 'monthlyCosts[pos_software]', 49, 'kept', 'Square Plus $49 в месяц за точку — через поиск (несколько источников); squareup.com 429.'),
    ('cafe', 'monthlyCosts[accounting]', 400, 'not_found', 'Публичного прайса бухгалтера в NYC нет.'),
    ('cafe', 'monthlyCosts[payroll_service]', 85, 'kept', 'Gusto Simple $49 + $6 за человека с 1 марта 2026 (через поиск; gusto.com 403).'),
    ('cafe', 'monthlyCosts[marketing]', 300, 'not_found', 'Бюджет-выбор заметок.'),
    ('cafe', 'monthlyCosts[permit_renewals]', 50, 'kept', 'FSE $280 в год и LLC $25 в год подтверждены.'),
    # staff
    ('cafe', 'staff[barista].hourlyWage', '21 → 18', 'corrected', 'NY DOL OEWS Q1 2026, NYC, 35-3023: медиана $17.57, средняя $18.90 с чаевыми.'),
    ('cafe', 'staff[shift_lead].hourlyWage', 24, 'verified', 'NY DOL OEWS Q1 2026, NYC, 35-1012: медиана $24.07.'),
    ('cafe', 'manager.monthlySalary', 4800, 'kept', '$30 × 160 ч. Опоры NY DOL: бригадир — средняя $26.04/ч, управляющий заведением (11-9051) — медиана $44.94/ч. $30 — между ними.'),
    # events
    ('cafe', 'events[coffee_price_spike]', 1.05, 'kept', 'Ряды FRED подтверждены; добавлен сигнал — арабика IMF +16.7% за месяц (июнь→июль 2026).'),
    ('cafe', 'events[milk_price_up]', 1.03, 'kept', 'Ряды FRED подтверждены.'),
    ('cafe', 'events[restaurant_week]', 1.05, 'kept', 'Даты 19.01–11.02.2027 и цены $30/45/60 подтверждены; эффект для кофейни не измерен.'),
    ('cafe', 'events[sidewalk_shed]', '0.9 × 3 мес → 0.93 × 6 мес', 'corrected', 'Исследование города и Mastercard 2024: −3.5…−9.7% транзакций у ресторанов за шесть месяцев.'),
    ('cafe', 'events[summer_power_peak]', 1.08, 'not_found', 'NYSERDA 403; цифры 22.3¢ и 24.2¢ остаются из заметок.'),
    ('cafe', 'events[flu_season]', 0.92, 'not_found', 'Доли невыходов работников общепита в сезон гриппа в первоисточниках не нашёл.'),
    ('cafe', 'benchmarks', '0.28 / 0.35 / 0.10 / 0.04', 'kept', 'NRA открыт: прибыль до налогов 4.0%, prime cost 65%, аренда 6.0% (город, limited service). 0.28 и 0.10 — модель заметок.'),
    ('cafe', 'extra.rentByTier', '326 / 90 / 45', 'kept', 'Q3 2026 C&W ($326 Flatiron, $409 SoHo) не открыт — сервер C&W вне сети; через поиск Q2 2026: $306 и $393 — порядок совпадает.'),
    ('cafe', 'extra.referenceMonth', 'wages 13 440', 'kept', 'Нужно пересчитать после смены ставки бариста: 4 × 160 × $18 = $11 520 (−$1 920 в месяц), налоги работодателя −$222. Это делает ведущий (движок).'),
    ('cafe', 'extra.footfall (captureRate и др.)', '0.088 …', 'not_found', 'Задание 80 (codex), часть A; в D12 не повторял.'),
    ('cafe', 'extra.takeover.multipleOfAnnualSales', '0.2 → 0.4', 'corrected', 'BizBuySell (через поиск): медиана проданной кофейни 0.41 выручки, 2.2 прибыли владельца.'),
    ('cafe', 'levers (5) и shortcuts (8) кафе', '—', 'kept', 'У каждого числа теперь source, confidence и расчёт в note; hours.long пересчитан $2 300 → $2 000.'),
    # common
    ('_common', 'taxes[ny_unemployment]', 0.0179, 'kept', '4.1% и $17 600 подтверждены; эффективная доля зависит от зарплаты (2.09% при $18).'),
    ('_common', 'taxes[futa]', 0.001, 'verified', 'Подтверждено и на 2026 год: Нью-Йорка нет в списке сниженного кредита.'),
    ('_common', 'taxes[workers_comp]', 0.02, 'not_found', 'Ставка для ресторанного кода NY не найдена; общий уровень −21.9% с 1.10.2026.'),
    ('_common', 'taxes[disability_pfl]', 0.0004, 'kept', 'NYSIF $17.68 и минимум $60 в год; PFL 0.432%/$411.91 — подтверждены.'),
    ('_common', 'taxes[self_employment_tax]', 0.1413, 'kept', '15.3% × 92.35% — арифметика формы SE.'),
    ('_common', 'taxes[income_tax]', 0.17, 'kept', 'Сводная ставка-оценка; не налоговая консультация.'),
    ('_common', 'taxes[nyc_ubt]', 0, 'kept', 'nyc.gov недоступен; порог $3 400 остаётся с первого прохода.'),
    ('_common', 'violations[off_books_payroll] / [misclassification]', '2.0 / 1.5 × saved', 'kept', 'Формулы-оценки; WCB Fair Play: до $2 500 за неверно оформленного работника (это для строительства, к кафе не применимо).'),
    ('_common', 'violations[no_i9]', '1160 → 1152; 11600 → 11444', 'corrected', '28 CFR 85.5 (eCFR, открыто).'),
    ('_common', 'violations[returns_not_filed]', '525 + 450/мес', 'kept', '$525 подтверждён на irs.gov; формула — оценка.'),
    ('_common', 'shortcuts (12)', '—', 'kept', 'У каждого числа теперь source, confidence и расчёт в note.'),
    ('_common', 'extra.employerCostExample', '—', 'kept', 'Арифметика от проверенных ставок.'),
]

# ---------------- new records found while checking ----------------
EXTRA_EVENTS = [
    {'id': 'min_wage_march_2027_proposal', 'name': 'Minimum wage may rise to $17.60 on March 1, 2027',
     'text': 'The minimum wage stays $17.00 on January 1, 2027, but the Governor proposes $17.60 in New York City from March 1 if the Legislature agrees. Every hourly worker would cost 3.5% more.',
     'scale': 'country', 'months': [3], 'realSignal': 'State budget passes the off-ramp change; NY DOL publishes the March 1, 2027 rate',
     'effects': [{'field': 'minimumWage', 'value': 17.60}], 'durationMonths': 12,
     'playerMoves': [{'kind': 'lever', 'id': 'staff_pay'}, {'kind': 'lever', 'id': 'hours'}, {'kind': 'shortcut', 'id': 'off_the_clock'}],
     'realFrequency': 'Increases every January 2024-2026; none on January 1, 2027 because an off-ramp was met', 'tier': 'core',
     'source': 'https://www.governor.ny.gov/new-york-state-minimum-wage-2027', 'confidence': 'verified',
     'note': 'Seen November 14, 2026: proposal, not law. Announce it as possible in January; apply only if the real budget passes.'},
    {'id': 'sidewalk_shed_rules_2026', 'name': 'Shed rules tighten: 90-day permits',
     'text': 'Since January 2026 a sidewalk shed permit lasts 90 days and owners pay monthly penalties after 180 days. A shed over your door now comes down sooner.',
     'scale': 'city', 'months': [1], 'realSignal': 'Local Laws 48 and 51 of 2025 in force January 2026; DOB penalties after 180 days (August 2026)',
     'effects': [{'field': 'sidewalk_shed.months', 'value': 6}], 'durationMonths': 12,
     'playerMoves': [{'kind': 'report', 'id': 'report_shed_to_dob'}],
     'realFrequency': 'one rule change', 'tier': 'deep',
     'source': 'https://www.nyc.gov/mayors-office/news/2026/08/mamdani-administration-taking-down-sidewalk-sheds-and-improving-', 'confidence': 'estimate',
     'note': 'Seen through search (nyc.gov refuses this session). A report to 311 about an expired shed is the player\'s move; the report id is a proposal for the lead.'},
    {'id': 'workers_comp_loss_cost_cut_2026', 'name': 'Workers\' comp costs fall about a fifth',
     'text': 'New York cut workers\' compensation loss costs 21.9% from October 1, 2026. Policies renewing after that date get cheaper.',
     'scale': 'country', 'months': [10], 'realSignal': 'NYCIRB loss cost filing approved by DFS, effective October 1, 2026',
     'effects': [{'field': 'tax.workers_comp.rate', 'mult': 0.8}], 'durationMonths': 12,
     'playerMoves': [{'kind': 'shortcut', 'id': 'no_workers_comp'}],
     'realFrequency': 'yearly filing; direction varies', 'tier': 'deep',
     'source': 'https://www.insurancejournal.com/news/east/2026/07/17/877978.htm', 'confidence': 'estimate',
     'note': 'Seen through search. The overall level, not the restaurant class; insurers apply their own multipliers. Makes skipping coverage even less worth it.'},
]
EXTRA_MECHANICS = [
    {'id': 'per_worker_payroll_caps', 'title': 'Payroll taxes with per-worker caps',
     'playerDecision': 'How many people to hire and at what wage (more part-timers cost more unemployment tax per dollar of wages)',
     'engineMath': 'NY UI = 4.1% of each worker\'s first $17,600 a year; FUTA = 0.6% of the first $7,000; disability = $17.68 per worker a year with a $60 minimum per employer. Accrue per worker from the start of the calendar year instead of one flat rate on payroll.',
     'fieldsNeeded': ['taxes[].wageBase', 'taxes[].perWorkerAnnual', 'taxes[].minAnnualPerEmployer'],
     'numbers': [{'what': 'NY UI new employer rate 2026', 'value': 0.041, 'source': 'https://dol.ny.gov/bizserve/ui/prg/rate', 'confidence': 'verified'},
                 {'what': 'NY UI wage base 2026', 'value': 17600, 'source': 'https://dol.ny.gov/bizserve/ui/prg/rate/wbarchive', 'confidence': 'verified'},
                 {'what': 'NYSIF disability minimum annual premium', 'value': 60, 'source': 'https://ww3.nysif.com/-/media/Files/DISABILITY_BENEFITS/PDF/UDB-SOC_2026.pdf', 'confidence': 'verified'}],
     'tier': 'deep'},
    {'id': 'taxable_share_by_item', 'title': 'Not every cafe sale is taxable',
     'playerDecision': 'What to sell to go: whole pastries and bags of beans in grocery form are exempt; hot drinks, anything heated, sandwiches and anything eaten in the shop are taxed',
     'engineMath': 'taxableShare = 1 - share of sales that are unheated, to go and in grocery form. For a coffee shop about 0.95-1.0; keep 1.0 until menu data exists.',
     'fieldsNeeded': ['extra.taxableShare per menu category'],
     'numbers': [{'what': 'NYC sales tax rate', 'value': 0.08875, 'source': 'https://www.tax.ny.gov/pdf/publications/sales/pub718.pdf', 'confidence': 'verified'}],
     'tier': 'exotic'},
    {'id': 'llc_publication_county', 'title': 'Where the LLC publishes its notice',
     'playerDecision': 'The LLC publishes in the county of the office named in its articles. A Brooklyn package is $1,475; Manhattan $1,795; Albany $395.',
     'engineMath': 'setup[llc_and_publication].cost = $200 + package price of the chosen county. Only a real office address in that county is lawful; the game should not offer a fake address.',
     'fieldsNeeded': ['extra.llcPublicationByCounty'],
     'numbers': [{'what': 'Kings County package', 'value': 1475, 'source': 'https://www.llcpublishers.com/pricing', 'confidence': 'verified'},
                 {'what': 'Albany County package', 'value': 395, 'source': 'https://www.llcpublishers.com/pricing', 'confidence': 'verified'}],
     'tier': 'exotic'},
]

# the consolidated Chapter 23 PDF on nyc.gov refuses this session; these two were read in the adopted rule text
for _p in CAFE_PATCHES:
    if _p.get('id') in ('pest_activity', 'spoiled_food'):
        _p['set']['source'] = RULES21

DCWP26 = 'https://rules.cityofnewyork.us/wp-content/uploads/2026/06/DCWP-NOA-Rules-Relating-to-Earned-Safe-and-Sick-Time-Act.pdf'
COMMON_PATCHES += [
    {'section': 'violations', 'id': 'sick_leave_denied', 'why': 'правила DCWP, вступившие 23.07.2026: при «политике или практике» не давать больничные каждый работник получает $500 за каждый календарный год (Admin Code §20-924(d)(v)); статьи закона теперь увидены',
     'set': {'law': 'NYC Administrative Code §§20-912, 20-913, 20-924 (Earned Safe and Sick Time Act); 6 RCNY Chapter 7 (protected time off rules, effective July 23, 2026)',
             'source': DCWP26,
             'note': 'DCWP notice of adoption, rules effective July 23, 2026 (seen on rules.cityofnewyork.us): "protected time off" replaces "safe/sick time"; since the 2025 amendment employers also give 32 hours of unpaid protected time off on the first day of work and on the first day of each calendar year; where an employer has an official or unofficial policy or practice of not providing protected time off, each employee is entitled to $500 per calendar year the policy remains in effect (§20-924(d)(v)), on top of the hours owed and other relief. First pass (DCWP FAQ, nyc.gov, not reopened): three times the wages that should have been paid or $250, whichever is greater, per instance, and $500 for each unlawful denial. Game formula: $500 + 3 x what was kept; with more than one worker the real per-employee $500 is higher: needs fine.perStaff.'}},
]
for _p in CAFE_PATCHES:
    if _p.get('id') == 'sick_leave_cover':
        _p['set']['note'] = _p['set']['note'].replace('(law-firm alerts on the ESSTA amendments; the DCWP page could not be opened from this session)', '(DCWP adopted rules effective July 23, 2026, seen on rules.cityofnewyork.us)')
NEW_SOURCES.append({'url': DCWP26, 'title': 'DCWP: notice of adoption, protected time off rules, effective July 23, 2026'})
