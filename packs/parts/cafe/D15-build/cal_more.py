from common import ALL

S_311OUT = ("https://portal.311.nyc.gov/article/?kanumber=KA-03604", "NYC311, outdoor dining (Dining Out NYC) licenses and seasons", "verified")
S_DOFEES = ("https://www.diningoutnyc.info/apply/fees", "Dining Out NYC, fees", "estimate")
S_DOENF = ("https://www.diningoutnyc.info/enforcement", "Dining Out NYC, enforcement", "estimate")
S_DOHEAR = ("https://www.diningoutnyc.info/apply/publichearing", "Dining Out NYC, public hearing", "estimate")
S_GBL492 = ("https://www.nysenate.gov/legislation/laws/GBS/492", "NY General Business Law §492, access to restroom facilities", "verified")
S_GLASS = ("https://www.insightglass.com/how-much-do-storefront-windows-cost/", "Insight Glass, storefront window cost", "estimate")
S_CELLAR = ("https://portal.311.nyc.gov/article/?kanumber=KA-02292", "NYC311, open cellar doors", "estimate")
S_LPCSTORE = ("https://www.nyc.gov/site/lpc/applications/storefronts.page", "LPC, storefronts", "estimate")
S_ADASUIT = ("https://ny1.com/nyc/all-boroughs/news/2019/10/25/surge-in-lawsuits-by-small-group-of-with-disabilities-draws-scrutiny", "NY1, surge in ADA lawsuits by a small group of filers (2019)", "estimate")
S_FIRE = ("https://ny.eater.com/2019/3/7/18254534/fire-nolita-black-seed-bagels", "Eater NY, fire closes a Nolita bagel shop (2019)", "estimate")
S_PUDGE = ("https://tollbit.gothamist.com/2017/05/24/kushner_evict_pudge_knuckles.php", "Gothamist, building incident closes a cafe (2017)", "estimate")
S_CAR = ("https://www.kbtx.com/2023/07/09/college-station-coffee-cafe-closed-after-vehicle-hits-building/", "KBTX, cafe closed after a vehicle hits the building (2023)", "estimate")
S_PDX = ("https://www.kptv.com/2023/11/08/historic-diner-reopens-downtown-portland-months-after-kitchen-fire/", "KPTV, diner reopens months after a kitchen fire (2023)", "estimate")
S_ROAST = ("https://www.indailysa.com.au/citymag/food-drink/2024/05/21/bitter-brew-cbd-coffee-spot-to-close-doors", "InDaily, roaster odor dispute closes a cafe (Adelaide, 2024)", "estimate")
S_LGO = ("https://www.lgo.org.uk/decisions/environment-and-regulation/noise/22-016-501", "UK Local Government Ombudsman, extractor noise case", "estimate")
S_ACUST = ("https://www.europeanacustica.com/insonorizar-cafeteria/", "European Acustica, soundproofing a cafe (Spain)", "estimate")
S_OUTLAW = ("https://www.thecityreporter.nyc/2026/08/13/nyc-outdoor-dining-roadside-sheds-new-laws-restaraunts/", "The City Reporter, outdoor dining laws (August 2026)", "estimate")
EXTRA_SOURCES = {"311OUT": S_311OUT, "DOFEES": S_DOFEES, "DOENF": S_DOENF, "DOHEAR": S_DOHEAR, "GBL492": S_GBL492, "GLASS": S_GLASS, "CELLAR": S_CELLAR, "LPCSTORE": S_LPCSTORE, "ADASUIT": S_ADASUIT, "FIRE": S_FIRE, "PUDGE": S_PUDGE, "CAR": S_CAR, "PDX": S_PDX, "ROAST": S_ROAST, "LGO": S_LGO, "ACUST": S_ACUST, "OUTLAW": S_OUTLAW}

CAL = {
# ---- existing events not in the first selection ----
"storefront_glass_broken": dict(
    months=ALL, dur=1, scale="block",
    trig="announced: a run of break-ins on the strip; shops without a gate or film",
    eff=[{"field": "cash", "add": -1150, "note": "one glass panel"}, {"field": "closureDays", "add": 1}],
    moves=[{"kind": "setup", "id": "security_film", "label": "Security film on the glass", "cost": {"cash": 800}, "result": "glass holds; closure 0, estimate"},
           {"kind": "lever", "id": "insurance_package", "optionId": "full_cover", "label": "Glass and crime cover", "cost": {"monthly": 40}, "result": "loss above the deductible paid"}],
    src="GLASS", sup=[], conf="estimate", freq="Waves reported by precincts", note="D02 values; film price is my estimate. Note: the 2009 law requiring see-through gates was repealed in 2026 (roll_down_gate_deadline), so solid gates stay legal."),

"sign_complaint_wave": dict(
    months=ALL, dur=1, scale="block",
    trig="announced: dozens of 311 sign complaints on the block",
    eff=[{"field": "inspections", "mult": 1.5}, {"field": "fine", "add": 0, "appliesIf": "accessory storefront sign up to 150 sq ft and 1,200 lb", "note": "Local Law 15 of 2026: no work-without-permit penalty"},
         {"field": "fine", "add": 6000, "appliesIf": "larger or unsafe sign"}],
    moves=[{"kind": "choice", "id": "small_wall_sign", "label": "Wall sign of 6 sq ft or less", "cost": {}, "result": "no permit, no exposure"},
           {"kind": "choice", "id": "licensed_sign_hanger", "label": "Permit through a licensed sign hanger", "cost": {"cash": 1500}, "result": "legal"}],
    src="LL15", sup=["DOB_SIGN", "RCNY10204"], conf="estimate", freq="Waves on commercial strips (D02, D08)",
    note="Correction to D08 ('signs without permits get $6,000 fines'): Local Law 15 of 2026 (DOB page, search excerpt) extends the protections for business storefront accessory signs: no work-without-permit penalty, and past penalties since December 28, 2017 waived for signs up to 150 sq ft and 1,200 lb, unless the sign is an imminent threat. DOB still inspects and can order an unsafe sign removed. $6,000 = the 1 RCNY §102-04 floor for other signs."),

"landmark_notice": dict(
    months=ALL, dur=1,
    trig="decision: sign or awning changed on a landmark block without an LPC permit",
    eff=[{"field": "cash", "add": -2600, "note": "remake the awning to the approved design"}, {"field": "permitWaitDays", "add": 14}],
    moves=[{"kind": "choice", "id": "apply_pmw_first", "label": "Permit for Minor Work first", "cost": {"days": 14}, "result": "no notice"}],
    src="LPCSTORE", sup=["MMR_LPC"], conf="estimate", freq="LPC took 566 enforcement actions in FY2026 (MMR)", note="D02 value; 14 days from the LPC timeliness figure (90% within 10 business days)."),

"accessibility_suit_wave": dict(
    months=ALL, dur=1, scale="block", mergedWith="d00_premises_entrance_step",
    trig="announced a month ahead: suits against every shop with a step on the strip",
    eff=[{"field": "accessExposure", "add": 15000, "appliesIf": "step and no alternative"}],
    moves=[{"kind": "setup", "id": "portable_ramp", "label": "Ramp and bell this month", "cost": {"cash": 600}, "result": "exposure x 0.3"}],
    src="ADASUIT", sup=["SEYFARTH"], conf="estimate", freq="New York: 1,471 federal ADA Title III suits in 2025", note="Same numbers as d00_premises_entrance_step."),

"sidewalk_cafe_season": dict(
    months=[4, 5, 6, 7, 8, 9, 10], dur=7,
    trig="calendar: outdoor months for a shop with an outdoor dining license",
    eff=[{"field": "seats", "add": 10}, {"field": "demand", "mult": 1.03}],
    moves=[{"kind": "setup", "id": "sidewalk_cafe_license", "label": "Dining Out NYC license", "cost": {"cash": 1050, "note": "four-year license, plus a yearly revocable consent fee by location and size"}, "result": "10 outdoor seats"},
           {"kind": "choice", "id": "stay_under_20", "label": "Count outdoor seats toward 20", "cost": {}, "result": "10 inside + 10 outside = 20: customer toilet required"}],
    src="311OUT", sup=["DOFEES"], conf="estimate", freq="Yearly",
    note="NYC311 (fetched): sidewalk setups are allowed year-round; a $1,050 license covers the four-year term for roadway or sidewalk dining ($2,100 for both); plus an annual revocable consent fee by location and size. The pack's sidewalk_cafe_license is $2,550: check against these. Seats and demand are D02's game values; outdoor seats count toward the 20-seat toilet line (Health Code §81.22)."),

"community_board_review": dict(
    months=ALL, dur=2,
    trig="decision: outdoor dining application that draws objections (all roadway applications get a hearing)",
    eff=[{"field": "permitWaitDays", "add": 60, "appliesIf": "hearing"}, {"field": "cash", "add": -900, "appliesIf": "hearing notice costs"}],
    moves=[{"kind": "choice", "id": "trim_plan", "label": "Fewer tables, earlier closing", "cost": {"seats": -4}, "result": "no hearing for a sidewalk setup"}],
    src="311OUT", sup=["DOHEAR"], conf="estimate", freq="All roadway applications; some sidewalk ones",
    note="NYC311 (fetched): DOT must hold a public hearing on all roadway cafe applications and, in some cases, on sidewalk cafe applications. $900 and 60 days are D02's values."),

"roadway_cafes_go_year_round": dict(
    months=[9], dur=12, scale="city",
    trig="announced: year-round roadway dining law; applications open early September 2026",
    eff=[{"field": "roadwayMonthsActive", "set": 12}, {"field": "monthlyFees", "mult": 1.2, "appliesTo": "year-round roadway license", "note": "higher fees, amount not found"}],
    moves=[{"kind": "choice", "id": "year_round_roadway", "label": "Choose the year-round license", "cost": {"monthlyFeesMult": 1.2}, "result": "winter outdoor seats"}],
    src="311OUT", sup=["OUTLAW"], conf="verified", freq="One change",
    note="NYC311 (fetched): the Council passed year-round roadway dining; applications open in early September 2026; new applicants can choose a year-round license with higher fees. 1.2 is my placeholder for 'higher'."),

"outdoor_setup_out_of_bounds": dict(
    months=[4, 5, 6, 7, 8, 9, 10], dur=1,
    trig="decision: tables placed in the pedestrian clear path",
    eff=[{"field": "fine", "add": 200, "unit": "after a 30-day corrective action request; $500 for later offenses"}, {"field": "seats", "add": -4}],
    moves=[{"kind": "choice", "id": "mark_the_line", "label": "Paint the clear-path line", "cost": {"cash": 50}, "result": "no violation"}],
    src="DOENF", sup=[], conf="estimate", freq="Summer inspections", note="D02 (program enforcement page opened by D02): corrective action with 30 days, then $200 first and $500 later offenses; not reopened here (host blocked)."),

"cafe_fees_by_quarter": dict(
    months=[5], dur=12, scale="city",
    trig="announced: quarterly installments for outdoor dining fees",
    eff=[{"field": "cashTiming", "set": "quarterly"}],
    moves=[{"kind": "choice", "id": "pay_quarterly", "label": "Pay by the quarter", "cost": {}, "result": "less cash up front"}],
    src="OUTLAW", sup=[], conf="estimate", freq="One change", note="D02 values."),

"cellar_hatch_left_open": dict(
    months=ALL, dur=1,
    trig="decision: delivery through the sidewalk hatch with nobody guarding it",
    eff=[{"field": "inspections", "mult": 1.1}, {"field": "accessExposure", "add": 0, "note": "a fall would be a liability claim (see slip_claim_letter)"}],
    moves=[{"kind": "choice", "id": "guard_the_hatch", "label": "One person stands at the hatch", "cost": {"staffMinutes": 15}, "result": "no complaint"}],
    src="CELLAR", sup=[], conf="estimate", freq="Daily deliveries", note="NYC311 (D02): cellar doors may be open during a delivery if a person guards them."),

"d00_closures_nyc_event_sprinkler_stock": dict(
    months=ALL, dur=1,
    trig="state: building sprinkler or pipe failure above the shop",
    eff=[{"field": "cash", "add": -4000, "note": "stock and finishes, estimate"}, {"field": "closureDays", "add": 5}],
    moves=[{"kind": "lever", "id": "insurance_package", "optionId": "full_cover", "label": "Property and interruption cover", "cost": {"monthly": 40}, "result": "loss paid above the deductible"}],
    src="PUDGE", sup=["RPL227"], conf="estimate", freq="Closure stories", note="Estimates."),

"d00_closures_nyc_event_repair_reopening_notice": dict(
    months=ALL, dur=2,
    trig="state: after a small fire, FDNY and DOB sign-offs pending",
    eff=[{"field": "closureDays", "add": 30}],
    moves=[{"kind": "setup", "id": "architect_expediter", "label": "Expediter books the inspections", "cost": {"cash": 2000}, "result": "closure 21 days, estimate"}],
    src="FIRE", sup=["DOB_SWO"], conf="estimate", freq="Closure stories", note="Estimates."),

"d00_closures_nyc_event_reopen_after_peak": dict(
    months=[9, 10, 11, 12], dur=3,
    trig="state: repair finish date moves past the fall-winter peak",
    eff=[{"field": "demand", "mult": 0.7, "appliesTo": "months reopened after the peak"}],
    moves=[{"kind": "choice", "id": "temporary_cart", "label": "Sell from a cart at the door", "cost": {"monthly": 1500}, "result": "part of the regulars kept"}],
    src="PUDGE", sup=[], conf="estimate", freq="Closure stories", note="Estimate."),

"d00_world_event_storefront_collision": dict(
    months=ALL, dur=1,
    trig="state: vehicle strikes the closed storefront (announced incident)",
    eff=[{"field": "closureDays", "add": 7}, {"field": "cash", "add": -2500, "note": "deductible, estimate"}],
    moves=[{"kind": "lever", "id": "insurance_package", "optionId": "full_cover", "label": "Property cover", "cost": {"monthly": 40}, "result": "repair paid"}],
    src="CAR", sup=["RPL227"], conf="estimate", freq="Rare", note="Estimates."),

"d00_world_event_fan_setting_recheck": dict(
    months=[6, 7, 8, 9], dur=2, mergedWith="d00_premises_ac_neighbor",
    trig="state: second complaint after the first fix",
    eff=[{"field": "fine", "add": 1120, "note": "second offense within two years"}],
    moves=[{"kind": "setup", "id": "condenser_enclosure", "label": "Proper enclosure", "cost": {"cash": 4000}, "result": "below 42 dB(A)"}],
    src="DEP_NOISE", sup=[], conf="verified", freq="Follows a weak first fix", note="DEP schedule (opened): circulation device, second offense $1,120."),

"d00_world_event_furniture_impact_noise": dict(
    months=ALL, dur=1,
    trig="state: hard floor, metal chairs, apartment above",
    eff=[{"field": "reputation", "add": -0.01}],
    moves=[{"kind": "setup", "id": "chair_glides", "label": "Felt glides on chairs", "cost": {"cash": 100}, "result": "complaint ends"}],
    src="ACUST", sup=[], conf="estimate", freq="Mixed-use buildings", note="Not a DEP-measured source in NYC; neighbor relations only. Estimate."),

"d00_world_event_roast_odor_complaint": dict(
    months=ALL, dur=2, mergedWith="d00_premises_odor_home",
    trig="decision: roaster installed in the cafe without an afterburner",
    eff=[{"field": "setupCost", "add": 5000}, {"field": "fine", "add": 560}],
    moves=[{"kind": "choice", "id": "no_roasting", "label": "Buy roasted beans", "cost": {"cogsMult": 1.02}, "result": "no odor"}],
    src="ROAST", sup=["ODOR"], conf="estimate", freq="Rare", note="Estimates; same numbers as d00_premises_odor_home."),

"d00_premises_medical_restroom": dict(
    months=ALL, dur=0,
    trig="state: a guest with an eligible medical condition asks to use the staff toilet while 2+ employees are on shift",
    eff=[{"field": "obligation", "add": 1, "note": "must allow access; no extra cost"}],
    moves=[{"kind": "choice", "id": "allow_access", "label": "Let the guest use it", "cost": {}, "result": "complies"}],
    src="GBL492", sup=[], conf="verified", freq="Occasional",
    note="GBL §492 (opened): a place of business open to the public with an employee toilet must let a customer with an eligible medical condition or ostomy device use it if two or more employees are working, it is not a safety or security risk and no public restroom is immediately accessible. No penalty amount is stated in the section."),

"d00_world_event_insurance_claim_dependencies": dict(
    months=ALL, dur=2,
    trig="state: repair waits for the insurer's adjuster",
    eff=[{"field": "closureDays", "add": 21}],
    moves=[{"kind": "choice", "id": "start_repairs_documented", "label": "Photograph and start the repair", "cost": {"cash": 3000}, "result": "closure 7 days, estimate"}],
    src="PDX", sup=[], conf="estimate", freq="After casualty", note="Estimates."),

# ---- new events found in this session ----
"dob_enforcement_sweep": dict(
    new=True, name="Buildings inspectors sweep the avenue for unpermitted work", tier="core", scale="block",
    text="The Buildings Department's enforcement unit walks the block without waiting for complaints. Any build-out without a permit gets a stop work order today.",
    signal="DOB Strategic Enforcement Division (Local Law 74 of 2024) proactive inspections; stop work orders +19% in FY2026",
    months=ALL, dur=1,
    trig="announced a month ahead for one block: proactive DOB sweep",
    eff=[{"field": "discoveredBy", "set": "inspection", "appliesTo": "shortcut start_work_before_permit", "note": "found without a complaint"},
         {"field": "fine", "add": 15000, "appliesIf": "work without a permit found"}, {"field": "openingDelayDays", "add": 32, "appliesIf": "work without a permit found"}],
    moves=[{"kind": "shortcut", "id": "start_work_before_permit", "label": "Stop the unpermitted work before the sweep", "cost": {"days": 20}, "result": "nothing found; the 20 days are lost"},
           {"kind": "choice", "id": "legalize_now", "label": "File to legalize before a violation", "cost": {"fine": 6000}, "result": "$6,000 instead of $15,000"}],
    src="MMR_DOB", sup=["RCNY10204"], conf="verified", freq="DOB issued 7,882 stop work orders in FY2026; the increase reflects proactive inspections focused on work without a permit",
    note="MMR FY2026 (opened): stop work orders up 19% to 7,882, reflecting the Strategic Enforcement Division created by Local Law 74 of 2024, which conducts proactive inspections focused on work without a permit and unlicensed activity. The shortcut start_work_before_permit (D14) is otherwise found only by a neighbor's complaint: this event is the city's own way to find it. Penalties from 1 RCNY §102-04 (opened): legalization before a violation $6,000."),

"asking_rents_climb": dict(
    new=True, name="Store rents keep climbing", tier="deep", scale="city",
    text="Brokers' quarterly reports are out: asking rents on Manhattan's shopping corridors are up again and empty stores are at a record low.",
    signal="CBRE average asking rent across Manhattan corridors ($707 per sq ft in Q3 2026, +5% a year); Cushman & Wakefield availability 9.8%",
    months=[1, 4, 7, 10], dur=3,
    trig="announced: quarterly broker reports",
    tiers=["prime", "mid"],
    eff=[{"field": "rent", "mult": 1.0125, "appliesTo": "leases signed while active (one quarter of +5% a year)"}, {"field": "freeRentMonths", "add": -1, "appliesTo": "prime tier leases signed while active"}],
    moves=[{"kind": "choice", "id": "sign_now", "label": "Sign before the next report", "cost": {}, "result": "today's rent"},
           {"kind": "choice", "id": "cheaper_block", "label": "Look at a cheap-tier block", "cost": {"footTrafficMult": 0.8}, "result": "free months still offered"}],
    src="CBRE_Q3", sup=["CW_Q3"], conf="estimate", freq="Quarterly in 2025-2026",
    note="Search excerpts: CBRE Q3 2026 average asking rent $707 per sq ft, +4% on the quarter and +5% on the year; Cushman & Wakefield Q3 2026 availability 9.8%, a record low. Corridor rents are far above the pack's $90 per sq ft side-street storefronts; only the growth rate is used."),

"sign_moratorium_ll15": dict(
    new=True, name="The city forgives storefront sign penalties", tier="deep", scale="city",
    text="A new city law extends protection for small business signs: no penalty for an accessory storefront sign put up without a permit, and old sign penalties waived.",
    signal="Local Law 15 of 2026, DOB accessory sign outreach page",
    months=ALL, dur=12,
    trig="announced: Local Law 15 of 2026 in force",
    eff=[{"field": "fine", "mult": 0.0, "appliesTo": "work-without-permit penalties for accessory storefront signs up to 150 sq ft and 1,200 lb"}],
    moves=[{"kind": "choice", "id": "file_waiver", "label": "File the L2 waiver request for an old penalty", "cost": {"cash": 0}, "result": "penalty waived"}],
    src="LL15", sup=["DOB_SIGN"], conf="estimate", freq="One change",
    note="DOB page (search excerpt): outstanding penalties imposed on or after December 28, 2017 waived for business storefront signs up to 150 sq ft and 1,200 lb unless an imminent threat; no WWP penalty for an accessory sign; DOB still answers 311 complaints and an unsafe sign must come down."),

"building_gas_inspection_due": dict(
    new=True, name="The building's gas pipes are due for inspection", tier="deep", scale="point",
    text="The landlord's plumber must inspect the building's gas piping this year. If the test finds a leak, the utility locks the gas until it is fixed.",
    signal="Local Law 152 cycle by community district: Cycle 2 due January 1 - December 31, 2026 for CDs 4, 6, 8, 9, 16; 2027 for CDs 11, 12, 14, 15, 17",
    months=[10, 11, 12], dur=1,
    trig="schedule: the building's LL152 deadline year; if the hidden attribute 'gasLeak' is true the inspection triggers gas_red_tag",
    eff=[{"field": "triggers", "set": "gas_red_tag", "appliesIf": "hidden attribute gasLeak revealed by the inspection"}, {"field": "ownerFine", "add": 5000, "appliesIf": "owner skips the inspection", "note": "the landlord's fine, not the tenant's"}],
    moves=[{"kind": "lever", "id": "utility_concept", "optionId": "all_electric", "label": "All-electric cafe", "cost": {"setupCost": 2000}, "result": "a gas lockout does not close you"},
           {"kind": "lever", "id": "site_due_diligence", "optionId": "survey_first", "label": "Ask for the building's last gas inspection", "cost": {"cash": 2500}, "result": "gasLeak known before signing"}],
    src="DOB_LL152", sup=["MMR_DOB"], conf="verified", freq="Every four years per building",
    note="DOB service notice (opened): owners of buildings other than R-3 must submit a Gas Piping System Periodic Inspection Certification by the cycle deadline; failure brings a $5,000 penalty ($1,500 for 3-family); the notice lists the cycle years by community district. Turns the random 'gas shut off' into a dated, deterministic risk."),

"dob_subsequent_filing_fee": dict(
    new=True, name="Plan amendments now cost by the dollar", tier="exotic", scale="city",
    text="From February 2, 2026 a subsequent filing on an Alteration-CO job is priced on its construction cost, not a flat $130.",
    signal="DOB service notice of January 8, 2026",
    months=[2], dur=12,
    trig="announced: fee change from February 2, 2026",
    eff=[{"field": "setupCost", "add": 325, "appliesTo": "each subsequent filing on an Alteration-CO job of $20,000 in a building under 7 floors", "note": "$455.10 instead of $130"}],
    moves=[{"kind": "choice", "id": "file_complete_scope", "label": "File the whole scope at once", "cost": {}, "result": "no subsequent filing"}],
    src="DOBFEE26", sup=[], conf="verified", freq="One change",
    note="DOB service notice (opened): subsequent filings on an Alt-CO with existing elements to remain are charged on reported cost: below 7 floors $280 for the first $3,000 plus $10.30 per $1,000; example $20,000 -> $455.10; before, a flat $130."),

"restroom_out_of_order": dict(
    months=ALL, dur=1,
    trig="decision: restroom upkeep skipped; 20+ seats",
    eff=[{"field": "reputation", "add": -0.02}, {"field": "fine", "add": 300, "appliesIf": "inspection while the only toilet is out of order", "note": "by analogy with code 5E"}, {"field": "cash", "add": -250, "note": "plumber's call, estimate"}],
    moves=[{"kind": "lever", "id": "restroom_access", "optionId": "customers_only", "label": "Customers only, checked hourly", "cost": {"monthly": 150}, "result": "clogs rare"}],
    src="HC81", sup=[], conf="estimate", freq="Small single-toilet shops", note="D02 values plus a $250 plumber call (estimate)."),

"restroom_line_of_passers_by": dict(
    months=ALL, dur=12,
    trig="announced: the chain down the block makes its toilet purchase-only",
    eff=[{"field": "cash", "add": -150, "unit": "$/month", "appliesIf": "restroom open to all"}],
    moves=[{"kind": "lever", "id": "restroom_access", "optionId": "customers_only", "label": "Code on the receipt", "cost": {"reputation": -0.01}, "result": "upkeep back to normal"}],
    src="HC81", sup=[], conf="estimate", freq="Busy corridors", note="D02 values; GBL §492 still requires access for eligible medical conditions (d00_premises_medical_restroom)."),

"restroom_occupied_for_an_hour": dict(
    months=ALL, dur=1,
    trig="decision: restroom open to all, no time check",
    eff=[{"field": "staffAvailability", "mult": 0.98}, {"field": "quality", "add": -0.01}],
    moves=[{"kind": "lever", "id": "restroom_access", "optionId": "customers_only", "label": "Key at the counter", "cost": {"staffMinutesPerDay": 10}, "result": "no long stays"}],
    src="HC81", sup=[], conf="estimate", freq="Some corridors", note="D02 values."),

"order_ahead_flood": dict(
    months=ALL, dur=1,
    trig="decision: order-ahead open without throttling at the morning peak",
    eff=[{"field": "staffAvailability", "mult": 0.95}, {"field": "quality", "add": -0.02}],
    moves=[{"kind": "lever", "id": "order_ahead", "optionId": "throttled", "label": "Cap app orders per 15 minutes", "cost": {"monthly": 140}, "result": "bar keeps up"}],
    src="DELI", sup=[], conf="estimate", freq="Shops with order-ahead", note="D02 values; D06 lever order_ahead (throttled $140 a month)."),

"line_on_the_neighbors_stoop": dict(
    months=[4, 5, 6, 9, 10, 11, 12], dur=1,
    trig="state: weekend line longer than the frontage",
    eff=[{"field": "inspections", "mult": 1.2}],
    moves=[{"kind": "choice", "id": "line_inside", "label": "Rope the line along the wall inside", "cost": {"seats": -2}, "result": "no complaints"}],
    src="DELI", sup=[], conf="estimate", freq="Successful shops", note="D02 value."),
}
