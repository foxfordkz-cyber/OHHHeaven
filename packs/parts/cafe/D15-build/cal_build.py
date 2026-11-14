from common import ALL

S_LL15 = ("https://www.nyc.gov/site/buildings/safety/sign-ll15of2026.page", "DOB, Accessory Sign Education & Outreach (Local Law 15 of 2026)", "estimate")
S_RED_TAPE = ("https://www.nyc.gov/mayors-office/news/2026/07/mayor-mamdani-announces--open-for-small-business---over-50-refor.html", "Mayor's Office, Open for Small Business reforms, July 2026", "estimate")
S_FITOUT = ("https://www.cushmanwakefield.com/en/united-states/insights/retail-fit-out-cost-guide", "Cushman & Wakefield, retail fit-out cost guide", "estimate")
S_PLUMBER = ("https://citylandnyc.org/unlicensed-plumber-fined", "CityLand, unlicensed plumber fined", "estimate")
S_LAB240 = ("https://www.nysenate.gov/legislation/laws/LAB/240", "NY Labor Law §240 (scaffold law)", "estimate")
S_CROSS = ("https://www.nyc.gov/site/dep/about/cross-connection-controls.page", "DEP, Cross Connection Controls", "estimate")
S_SBS_FORM = ("https://www.nyc.gov/site/sbs/businesses/food-establishment-form.page", "SBS, food establishment pre-operational pathway", "estimate")
S_ASBRULE = ("https://rules.cityofnewyork.us/wp-content/uploads/2025/04/Asbestos-Rules-2022-Final.pdf", "DEP, final rule amending the asbestos rules (15 RCNY Chapter 1)", "verified")
S_AHV = ("https://www.nyc.gov/site/buildings/industry/ahvs-renewal-guidelines-fees.page", "DOB, AHV renewal guidelines and fees", "estimate")
S_LNO = ("https://www.nyc.gov/site/buildings/property-or-business-owner/letter-of-no-objection-or-completion.page", "DOB, Letter of No Objection", "estimate")
EXTRA_SOURCES = {"LL15": S_LL15, "RED_TAPE": S_RED_TAPE, "FITOUT": S_FITOUT, "PLUMBER": S_PLUMBER, "LAB240": S_LAB240, "CROSS": S_CROSS, "SBS_FORM": S_SBS_FORM, "ASBRULE": S_ASBRULE, "AHV": S_AHV, "LNO": S_LNO}

FEE_NOTE = ("DOB fee for an alteration in a building under 7 floors (service notice, opened): $280 for the first $3,000 plus $10.30 per $1,000 above: "
            "light $70,000 -> $970; standard $180,000 -> $2,103; heavy $320,000 -> $3,545.")
WWP_NOTE = ("1 RCNY §102-04(b)(3) (opened): work without a permit in a building other than a one- or two-family home costs the greater of 21 x the permit fee "
            "(capped at $15,000) or $6,000; a light build-out (fee $970 x 21 = $20,372) hits the $15,000 cap. Legalizing before a violation is issued: $6,000. "
            "A repeat within a year doubles it. A business with fewer than 100 employees can get the penalty waived once ((d)(10)), but the permit is still required. "
            "Working against a stop work order: $6,000 the first time, $12,000 after (DOB SWO page, opened); DOB will not rescind the order until penalties are paid.")

CAL = {
"dob_permit_issued": dict(
    months=ALL, dur=1,
    trig="schedule: DOB NOW filing + 25 days",
    eff=[{"field": "permitWaitDays", "add": 25, "note": "average filing-to-approval, all DOB NOW applications, FY2026"},
         {"field": "setupCost", "add": 970, "byBuildoutClass": {"light": 970, "standard": 2103, "heavy": 3545}, "note": "DOB filing fee"}],
    moves=[{"kind": "shortcut", "id": "start_work_before_permit", "label": "Start before approval", "cost": {"riskFine": 15000}, "result": "opens 20 days sooner; if found: $6,000-$15,000 and a stop work order"},
           {"kind": "lever", "id": "permit_help", "optionId": "dob_walk_in", "label": "Free DOB/SBS review before filing", "cost": {"days": 5}, "result": "permit wait x 0.9 (design value)"}],
    src="MMR_DOB", sup=["DOBFEE26"], conf="verified",
    freq="Every build-out with a permit; DOB completed 156,389 first plan reviews in FY2026",
    note="Verified (MMR FY2026, opened): average days from filing to approval in DOB NOW rose from 20.3 (FY2025) to 25.4 (FY2026); first review of a minor renovation 4.4 days, of a major one (Alteration CO) 8.4 days. Correction to D14, which used 20 days. " + FEE_NOTE),

"plan_examiner_objections": dict(
    months=ALL, dur=1,
    trig="state: application has an objection (design professional's first submission incomplete)",
    eff=[{"field": "permitWaitDays", "add": 19, "note": "one correction cycle: about 14 days with the applicant + 5 days of re-review"}, {"field": "setupCost", "add": 1500, "note": "architect's correction time, estimate"}],
    moves=[{"kind": "lever", "id": "permit_help", "optionId": "dob_walk_in", "label": "Pre-filing review", "cost": {"days": 5}, "result": "fewer objections (design value)"},
           {"kind": "setup", "id": "architect_expediter", "label": "Experienced expediter", "cost": {"pctOfBuildout": 0.1}, "result": "already in the pack's 10%"}],
    src="MMR_DOB", sup=[], conf="estimate",
    freq="Typical, not rare: DOB NOW had 111,842 resubmission reviews against 156,389 first reviews in FY2026 (0.72 per job)",
    note="MMR FY2026 (opened): the time a filing sits with the applicant making corrections 'is typically three times as long as the time the filing is with the Department'. With 25.4 days in total, about 6 days at DOB and 19 with the applicant over 0.72 cycles: one full cycle is about 19 days. $1,500 is my estimate."),

"stop_work_order_served": dict(
    months=ALL, dur=1,
    trig="decision: shortcut start_work_before_permit or work beyond the approved plans, found by a complaint or a DOB sweep",
    eff=[{"field": "fine", "add": 15000, "note": "work without a permit on a full light build-out: 21 x $970 capped at $15,000; partial work not less than $6,000"},
         {"field": "openingDelayDays", "add": 32, "note": "work stops until the permit (25 days) and rescission after re-inspection (7 days, estimate)"}],
    moves=[{"kind": "choice", "id": "small_business_waiver", "label": "Ask for the one-time small business waiver", "cost": {"cash": 0}, "result": "fine waived once (fewer than 100 employees, space used only by the business); the delay stays"},
           {"kind": "choice", "id": "work_through_swo", "label": "Keep working anyway", "cost": {"fine": 6000}, "result": "second penalty $6,000; order not lifted until all paid"}],
    src="RCNY10204", sup=["DOB_SWO", "MMR_DOB"], conf="verified",
    freq="DOB issued 7,882 stop work orders in FY2026, 19% more than in FY2025, after creating a Strategic Enforcement Division focused on work without a permit",
    note=WWP_NOTE + " Correction to D14: the rule in force is 21 x the fee with a $6,000 floor and $15,000 cap, not 14 x with a $5,000 floor."),

"stop_work_order": dict(
    months=ALL, dur=1, mergedWith="stop_work_order_served",
    trig="as stop_work_order_served",
    eff=[{"field": "fine", "add": 15000}, {"field": "openingDelayDays", "add": 32}],
    moves=[{"kind": "choice", "id": "small_business_waiver", "label": "One-time small business waiver", "cost": {}, "result": "fine waived once"}],
    src="RCNY10204", sup=["DOB_SWO"], conf="verified", freq="See stop_work_order_served", note="D14 duplicate. " + WWP_NOTE),

"d00_premises_swo_partial": dict(
    months=ALL, dur=1,
    trig="state: one trade (gas, electric, plumbing) found without a permit",
    eff=[{"field": "openingDelayDays", "add": 14, "note": "only the cited work stops"}, {"field": "fine", "add": 6000, "note": "floor of the work-without-permit penalty for partial work"}],
    moves=[{"kind": "choice", "id": "file_trade_permit", "label": "File the missing trade permit", "cost": {"cash": 500}, "result": "rest of the job continues"}],
    src="MMR_DOB", sup=["RCNY10204", "DOB_SWO"], conf="verified",
    freq="DOB 'has prioritized reducing full stop work order issuance in favor of partial stop work orders' (MMR FY2026)",
    note="DOB SWO page (opened): a partial SWO prohibits certain work or work in a particular area. $6,000 floor from 1 RCNY §102-04(b)(3). 14 days is my estimate for a trade permit and re-inspection."),

"d00_premises_swo_rescission": dict(
    months=ALL, dur=1,
    trig="state: permit issued but SWO still open (penalty unpaid or no re-inspection requested)",
    eff=[{"field": "openingDelayDays", "add": 10}],
    moves=[{"kind": "choice", "id": "pay_and_request_reinspection", "label": "Pay penalties and request re-inspection", "cost": {"fine": 6000}, "result": "order rescinded"}],
    src="DOB_SWO", sup=["RCNY10204"], conf="verified",
    freq="DOB rescinded 8,069 orders in FY2026 against 7,882 issued",
    note="DOB (opened): to lift a SWO, correct the conditions, request a re-inspection, pay applicable penalties, contact the unit; 'the Department will not rescind a SWO until these civil penalties have been paid'. 10 days is my estimate."),

"asbestos_found": dict(
    months=ALL, dur=1,
    trig="attribute: building constructed before April 1, 1987 and the build-out disturbs existing materials",
    eff=[{"field": "setupCost", "add": 1000, "note": "asbestos investigation (ACP-5), estimate"},
         {"field": "buildoutCost", "add": 6900, "appliesIf": "material found above 10 sq ft / 25 linear ft", "note": "300 sq ft of tile and mastic at $15 + monitoring $2,000 + ACP-7 fee $400"},
         {"field": "openingDelayDays", "add": 14, "appliesIf": "material found"},
         {"field": "setupCost", "add": 3000, "appliesIf": "abatement work area includes plumbing work or wall removal: asbestos abatement permit with a work place safety plan by a registered design professional", "note": "estimate"},
         {"field": "openingDelayDays", "add": 14, "appliesIf": "abatement permit needed", "note": "estimate"}],
    moves=[{"kind": "lever", "id": "site_due_diligence", "optionId": "asbestos_survey_before_lease", "label": "Survey before signing", "cost": {"cash": 1000}, "result": "landlord abates as a condition of the lease, or you walk"},
           {"kind": "lever", "id": "lease_contingencies", "optionId": "landlord_delivers_acm_free", "label": "Landlord delivers the space free of asbestos", "cost": {"lawyerHours": 1}, "result": "$6,900 and 14 days move to the landlord"}],
    src="DOB_ASB", sup=["ASBRULE", "ACP7"], conf="estimate",
    freq="Any pre-1987 building: most NYC storefronts",
    note="DOB (opened): before a permit in buildings constructed before April 1, 1987, an asbestos assessment is required unless no existing materials are disturbed; below the asbestos-project threshold an ACP-5 is filed. 15 RCNY Chapter 1 (search excerpt): ACP-7 notification fee $200 / $400 / $800 / $1,200 by size band. Survey price $400-$1,500 (contractor page) -> $1,000. Abatement $10-$25 per sq ft of material (cost guides) -> $15. 14 days is my estimate: DEP's notice period was not found. DEP rules (opened, rules.cityofnewyork.us): minor project up to 25 linear ft or 10 sq ft; small project above that and under 260 linear ft / 160 sq ft; large project 260 linear ft or 160 sq ft and more, so 300 sq ft of floor tile is a large project; an asbestos abatement permit with a work place safety plan by a registered design professional is required when the work area includes plumbing work other than fixture replacement, removal of a non-rated wall over 45 sq ft, sprinkler or fire alarm parts or exit signs: typical of a cafe build-out."),

"d00_premises_asbestos_scope": dict(
    months=ALL, dur=1, mergedWith="asbestos_found",
    trig="decision: the scope grows to disturb more material than the ACP-5 covered",
    eff=[{"field": "buildoutCost", "add": 6900}, {"field": "openingDelayDays", "add": 14}],
    moves=[{"kind": "lever", "id": "site_due_diligence", "optionId": "asbestos_survey_before_lease", "label": "Survey the full scope", "cost": {"cash": 1000}, "result": "no surprise"}],
    src="DOB_ASB", sup=["ACP7"], conf="estimate", freq="As asbestos_found", note="Same numbers as asbestos_found."),

"hidden_conditions": dict(
    months=ALL, dur=1,
    trig="attribute: building age and former use; walls opened during build-out",
    eff=[{"field": "buildoutCost", "mult": 1.10}, {"field": "openingDelayDays", "add": 14}],
    moves=[{"kind": "lever", "id": "contingency_level", "optionId": "fifteen_percent", "label": "Hold a 15% reserve", "cost": {"cashHeld": 10500}, "result": "absorbed without new debt"},
           {"kind": "lever", "id": "site_due_diligence", "optionId": "contractor_walkthrough", "label": "Contractor opens test holes before the bid", "cost": {"cash": 1500}, "result": "multiplier 1.05 instead of 1.10"}],
    src="DODGE_CO", sup=["ASEE_CO", "ALPHA"], conf="estimate",
    freq="Typical: change orders average about 10% of contract value (Dodge, via secondary); 5-10% increases are 'expected on most projects' (ASEE)",
    note="1.10 on a light $70,000 job = $7,000. D01 had 1.12; I take the published average of 10%. 14 days is D01's estimate."),

"change_orders_pile_up": dict(
    months=ALL, dur=1,
    trig="decision: player changes finishes or layout after the contract is signed",
    eff=[{"field": "buildoutCost", "mult": 1.08}, {"field": "openingDelayDays", "add": 10}],
    moves=[{"kind": "lever", "id": "contractor_choice", "optionId": "fixed_price", "label": "Fixed-price contract with a frozen drawing set", "cost": {"buildoutCostMult": 1.03}, "result": "changes priced up front; no surprise"}],
    src="DODGE_CO", sup=["ASEE_CO"], conf="estimate", freq="Common", note="Owner-driven share of the ~10% average; estimate."),

"d00_premises_design_changes": dict(
    months=ALL, dur=1, mergedWith="change_orders_pile_up",
    trig="decision: design sessions add scope",
    eff=[{"field": "buildoutCost", "mult": 1.05}, {"field": "openingDelayDays", "add": 7}],
    moves=[{"kind": "lever", "id": "contractor_choice", "optionId": "fixed_price", "label": "Freeze the design before bids", "cost": {}, "result": "no added scope"}],
    src="DODGE_CO", sup=[], conf="estimate", freq="Common", note="Estimate."),

"d00_premises_bid_after_lease": dict(
    months=ALL, dur=0,
    trig="decision: lease signed before contractor bids",
    eff=[{"field": "buildoutCost", "mult": 1.2, "note": "first firm bids above the planning number"}],
    moves=[{"kind": "lever", "id": "site_due_diligence", "optionId": "bid_before_lease", "label": "Get two bids during the lease negotiation", "cost": {"cash": 3000, "searchDays": 21}, "result": "cost known before signing"},
           {"kind": "choice", "id": "rescope", "label": "Cut scope to the light class", "cost": {"quality": -0.02}, "result": "multiplier back to 1.0"}],
    src="TERRAPIN", sup=["ALPHA"], conf="estimate",
    freq="Not measured",
    note="Published 2026 ranges are wide: a contractor gives $200-$300 per sq ft for a counter-service cafe in a former food space; another $425-$700 for a Manhattan restaurant; the pack plans $87.50 for a light refresh. 1.2 is a cautious estimate of the gap between planning and first bids."),

"mechanics_lien_filed": dict(
    months=ALL, dur=2,
    trig="state: contractor did not pay a subcontractor; lien filed within 8 months of the last work",
    eff=[{"field": "cash", "add": -8000, "note": "paying the sub directly (worst case: twice for the same work)"}, {"field": "monthlyFees", "add": 0}],
    moves=[{"kind": "choice", "id": "bond_the_lien", "label": "Discharge it with a bond at 110%", "cost": {"cash": -264, "collateral": 8800}, "result": "lien off the building; fight later"},
           {"kind": "lever", "id": "contractor_choice", "optionId": "lien_waivers", "label": "Pay only against lien waivers", "cost": {"cash": 0}, "result": "event cannot happen"}],
    src="LIEN10", sup=["LIEN19"], conf="estimate",
    freq="Not measured",
    note="Lien Law §10 (opened): a lien may be filed during the work or within eight months after the last work or materials. §19(4) (opened): discharged by a bond of 110% of the lien. $8,000 is my estimate of one unpaid trade on a $70,000 job; bond premium 3% of $8,800 = $264 (estimate). Leases usually make the tenant discharge liens fast."),

"d00_premises_construction_lien": dict(
    months=ALL, dur=2, mergedWith="mechanics_lien_filed",
    trig="as mechanics_lien_filed",
    eff=[{"field": "cash", "add": -8000}],
    moves=[{"kind": "lever", "id": "contractor_choice", "optionId": "lien_waivers", "label": "Pay against lien waivers", "cost": {}, "result": "no lien"}],
    src="LIEN10", sup=["LIEN19"], conf="estimate", freq="Not measured", note="Same as mechanics_lien_filed."),

"landmark_review": dict(
    months=ALL, dur=1,
    trig="attribute: address in one of 159 historic districts or an individual landmark; exterior work or a DOB permit",
    eff=[{"field": "permitWaitDays", "add": 14, "note": "staff-level CNE or PMW: 90% within 10 business days"},
         {"field": "permitWaitDays", "add": 60, "appliesIf": "storefront change that needs a public hearing", "note": "estimate"}],
    moves=[{"kind": "choice", "id": "match_existing_storefront", "label": "Keep the existing storefront and sign size", "cost": {}, "result": "staff-level permit only"},
           {"kind": "lever", "id": "permit_help", "optionId": "lpc_preapplication", "label": "Pre-application meeting with LPC staff", "cost": {"days": 7}, "result": "complete application on first try"}],
    src="MMR_LPC", sup=[], conf="verified",
    freq="LPC protects 38,550 buildings and sites; 11,766 permit applications in FY2026",
    note="MMR FY2026 (opened): about 90% of Certificates of No Effect and 90% of Permits for Minor Work issued within 10 business days; 95% of expedited CNEs within two business days. 10 business days = 14 calendar days. 60 days for a hearing case is my estimate."),

"d00_premises_landmark_repaint": dict(
    months=ALL, dur=1,
    trig="decision: repaint or re-sign a landmark storefront without an LPC permit; complaint",
    eff=[{"field": "cash", "add": -2000, "note": "undo or redo to approved colors, estimate"}, {"field": "permitWaitDays", "add": 14}],
    moves=[{"kind": "choice", "id": "apply_pmw_first", "label": "Apply for a Permit for Minor Work first", "cost": {"days": 14}, "result": "no warning letter"}],
    src="MMR_LPC", sup=[], conf="estimate",
    freq="LPC received 774 complaints and took 566 enforcement actions (warning letters, summonses, stop work orders) in FY2026",
    note="PMW covers painting, window or door replacement (MMR, opened). Cost is my estimate."),

"d00_premises_landmark_terrace": dict(
    months=[3, 4, 5], dur=1,
    trig="decision: outdoor seating or awning in a historic district",
    eff=[{"field": "permitWaitDays", "add": 14}],
    moves=[{"kind": "choice", "id": "standard_furniture", "label": "Use the standard approved furniture", "cost": {}, "result": "staff-level review"}],
    src="MMR_LPC", sup=[], conf="estimate", freq="Seasonal applications before the outdoor season", note="Second approval path in addition to the outdoor dining license; 14 days from the LPC timeliness figure."),

"d00_premises_lpc_incomplete": dict(
    months=ALL, dur=1,
    trig="state: LPC application without usable drawings",
    eff=[{"field": "permitWaitDays", "add": 14}],
    moves=[{"kind": "setup", "id": "architect_expediter", "label": "Drawings by the architect", "cost": {}, "result": "complete application"}],
    src="MMR_LPC", sup=[], conf="estimate", freq="Common for first-time applicants", note="One more 10-business-day cycle."),

"certificate_of_occupancy_mismatch": dict(
    months=ALL, dur=2,
    trig="attribute: former use is retail or salon (CO does not list eating and drinking)",
    eff=[{"field": "buildoutCost", "add": 15000, "note": "architect, egress and fire-safety items of an Alteration-CO job, estimate"},
         {"field": "permitWaitDays", "add": 45, "note": "major renovation path and final sign-offs, estimate"}],
    moves=[{"kind": "lever", "id": "site_due_diligence", "optionId": "check_co_before_lease", "label": "Read the CO before signing", "cost": {"cash": 0}, "result": "choose a former cafe or food space"},
           {"kind": "choice", "id": "open_on_tco", "label": "Open on a Temporary CO", "cost": {"cash": 130}, "result": "valid 90 days; renew until the final CO"}],
    src="DOB_CO", sup=["DOB_TCO", "MMR_DOB"], conf="estimate",
    freq="Every change of use",
    note="DOB (opened): existing buildings need an amended CO when there is a change in use, egress or type of occupancy; a CO has no expiration. TCO (opened): typically expires 90 days after issuance, $130 fee, renewable; if the space is not occupied for more than 30 days a new TCO is needed. MMR FY2026: first review of an Alteration CO job 8.4 days against 4.4 for a minor job. $15,000 and 45 days are my estimates."),

"d00_premises_use_mismatch": dict(
    months=ALL, dur=2, mergedWith="certificate_of_occupancy_mismatch",
    trig="as certificate_of_occupancy_mismatch",
    eff=[{"field": "buildoutCost", "add": 15000}, {"field": "permitWaitDays", "add": 45}],
    moves=[{"kind": "lever", "id": "site_due_diligence", "optionId": "check_co_before_lease", "label": "Check the CO", "cost": {}, "result": "avoid"}],
    src="DOB_CO", sup=["DOB_TCO"], conf="estimate", freq="Every change of use", note="Same as certificate_of_occupancy_mismatch."),

"no_certificate_of_occupancy": dict(
    months=ALL, dur=1,
    trig="attribute: building older than CO requirements, no CO on file",
    eff=[{"field": "permitWaitDays", "add": 30, "note": "letter confirming the legal use, estimate"}, {"field": "setupCost", "add": 2000}],
    moves=[{"kind": "lever", "id": "site_due_diligence", "optionId": "check_co_before_lease", "label": "Ask the landlord for proof of legal use", "cost": {}, "result": "landlord's job before signing"}],
    src="DOB_CO", sup=["LNO"], conf="estimate", freq="Older buildings", note="Buildings put up before 1938 were generally not required to have a CO unless later work changed use, egress or occupancy; the Letter of No Objection confirms the legal use and should say eating and drinking establishment; about a month through an expediter (secondary, search). Fee not found; $2,000 for drawings and the expediter is my estimate."),

"d00_premises_old_legal_use": dict(
    months=ALL, dur=1, mergedWith="no_certificate_of_occupancy",
    trig="as no_certificate_of_occupancy",
    eff=[{"field": "permitWaitDays", "add": 30}, {"field": "setupCost", "add": 2000}],
    moves=[{"kind": "lever", "id": "site_due_diligence", "optionId": "check_co_before_lease", "label": "Proof of legal use first", "cost": {}, "result": "avoid"}],
    src="DOB_CO", sup=[], conf="estimate", freq="Older buildings", note="Same as no_certificate_of_occupancy."),

"d00_premises_temporary_occupancy": dict(
    months=ALL, dur=3,
    trig="state: open on a TCO; final sign-offs outstanding",
    eff=[{"field": "monthlyFees", "add": 43, "note": "$130 every 90 days"}],
    moves=[{"kind": "choice", "id": "finish_signoffs", "label": "Close out the job", "cost": {"cash": 1500}, "result": "final CO, no renewals"}],
    src="DOB_TCO", sup=[], conf="verified", freq="Common for alteration jobs",
    note="DOB TCO page (opened): typically expires 90 days after issuance; $130 fee; may be renewed; a space unoccupied more than 30 days needs a new TCO."),

"d00_premises_signoffs_missing": dict(
    months=ALL, dur=1,
    trig="state: construction finished but trade sign-offs not filed",
    eff=[{"field": "permitWaitDays", "add": 30}, {"field": "setupCost", "add": 1500}],
    moves=[{"kind": "setup", "id": "architect_expediter", "label": "Expediter closes the job", "cost": {}, "result": "sign-offs filed with the work"}],
    src="DOB_CO", sup=["MMR_DOB"], conf="estimate", freq="Common", note="Estimates."),

"building_arrears_block_permit": dict(
    months=ALL, dur=1,
    trig="attribute: unpaid work-without-permit penalty in this space from a previous tenant or the owner",
    eff=[{"field": "permitWaitDays", "add": 30}, {"field": "cash", "add": -6000, "appliesIf": "player pays the old penalty to unblock"}],
    moves=[{"kind": "lever", "id": "site_due_diligence", "optionId": "check_dob_violations", "label": "Search the building's open violations", "cost": {"cash": 0}, "result": "landlord clears it before signing"}],
    src="RCNY10204", sup=[], conf="verified",
    freq="Not measured",
    note="1 RCNY §102-04(a)(1) (opened): the civil penalty must be paid before a permit is issued for work in a space where work was done without a permit and the penalty is unpaid; (c) lets DOB permit work in an unrelated space. The $6,000 floor applies; 30 days is my estimate."),

"failed_trade_inspection": dict(
    months=ALL, dur=1,
    trig="decision: unlicensed plumber or electrician to save money",
    eff=[{"field": "openingDelayDays", "add": 14}, {"field": "buildoutCost", "add": 12000}, {"field": "cash", "add": -5000}],
    moves=[{"kind": "lever", "id": "contractor_choice", "optionId": "licensed_trades", "label": "Licensed plumber and electrician", "cost": {}, "result": "passes"}],
    src="PLUMBER", sup=[], conf="estimate", freq="Story in D01", note="D01 numbers kept (redo $12,000, penalty $5,000 of the reported case)."),

"city_cuts_red_tape": dict(
    months=[7], dur=12, scale="city",
    trig="announced: city reform package (July 2026)",
    eff=[{"field": "permitWaitDays", "mult": 0.9}, {"field": "fines", "mult": 0.83, "note": "three food-safety fines $600 -> $500"}],
    moves=[{"kind": "lever", "id": "permit_help", "optionId": "dob_walk_in", "label": "Use the free project manager", "cost": {"days": 5}, "result": "shorter wait"}],
    src="RED_TAPE", sup=[], conf="estimate", freq="One announcement",
    note="D01 numbers kept: 50+ reforms announced in July 2026; 0.9 is a design value."),

"buildings_walk_in_help": dict(
    months=ALL, dur=1,
    trig="decision: player takes the free pre-filing review",
    eff=[{"field": "permitWaitDays", "mult": 0.9}, {"field": "openingDelayDays", "add": 5}],
    moves=[{"kind": "lever", "id": "permit_help", "optionId": "dob_walk_in", "label": "Book the walk-in", "cost": {"days": 5}, "result": "fewer objections"}],
    src="RED_TAPE", sup=["MMR_DOB"], conf="estimate", freq="Always available",
    note="With 0.72 correction cycles per job of about 19 days (MMR), avoiding a third of them saves ~5 days net; the 0.9 multiplier is consistent with that."),

"structural_surprise": dict(
    months=ALL, dur=4,
    trig="attribute: old building; demolition exposes structure",
    eff=[{"field": "openingDelayDays", "add": 120}, {"field": "rent", "mult": 1.0, "note": "rent runs unless the lease abates it"}],
    moves=[{"kind": "lever", "id": "lease_negotiation", "optionId": "structural_carveout", "label": "Structure is the landlord's; rent abates during structural repair", "cost": {"lawyerHours": 1}, "result": "120 days without rent"}],
    src="SBS_LEASE", sup=[], conf="estimate", freq="Rare", note="D01 value kept (design value for 'months')."),

"worker_falls_on_site": dict(
    months=ALL, dur=1,
    trig="decision: uninsured contractor",
    eff=[{"field": "cash", "add": -25000}],
    moves=[{"kind": "lever", "id": "contractor_choice", "optionId": "insured_contractor", "label": "Contractor's insurance names you and the owner", "cost": {"buildoutCostMult": 1.05}, "result": "claim goes to the contractor's insurer"}],
    src="LAB240", sup=[], conf="estimate", freq="Rare for a small job",
    note="NY Labor Law §240 makes owners and contractors absolutely liable for elevation falls; the $25,000 deductible-and-legal value is D01's design value. 5% premium for an insured crew is my estimate."),

"fit_out_prices_rise": dict(
    months=[3], dur=12, scale="city",
    trig="announced: yearly cost guides",
    eff=[{"field": "buildoutCost", "mult": 1.05, "appliesTo": "contracts signed after the announcement"}],
    moves=[{"kind": "choice", "id": "sign_before", "label": "Sign the contract before the announcement", "cost": {}, "result": "old price"}],
    src="TT_COST", sup=["FITOUT"], conf="estimate", freq="Yearly",
    note="2026 bid-price escalation forecasts: 4.25% (Turner & Townsend), about 5% (JLL), via secondary. D01 used 7% from the C&W fit-out guide for plain retail; I take 5%."),

"contractor_adds_sales_tax": dict(
    months=ALL, dur=0,
    trig="decision: no Form ST-124 given within 90 days",
    eff=[{"field": "buildoutCost", "add": 3106, "note": "8.875% on the labor half of a $70,000 job"}],
    moves=[{"kind": "choice", "id": "give_st124", "label": "Give the contractor Form ST-124", "cost": {}, "result": "labor exempt as a capital improvement"}],
    src="ST124", sup=[], conf="estimate", freq="Every build-out",
    note="DTF (search excerpt): services that result in a capital improvement are exempt with Form ST-124 given within 90 days; the contractor pays tax on materials. Labor share 50% is my assumption."),

"pre_permit_inspection_blocked": dict(
    months=ALL, dur=0,
    trig="state: Health Department visit while construction is still on",
    eff=[{"field": "openingDelayDays", "add": 0, "note": "you may open 22 days after applying even without the pre-permit inspection"}],
    moves=[{"kind": "choice", "id": "apply_22_days_ahead", "label": "Apply 22 days before the planned opening", "cost": {}, "result": "no delay"}],
    src="FSE", sup=[], conf="verified", freq="Common",
    note="NYC Business (opened): 'you can open 22 days after you submit your application, even if you haven't had a pre-permit inspection'. The first graded inspection still comes, unannounced (D19)."),

"d00_premises_prepermit_fail": dict(
    months=ALL, dur=1,
    trig="state: pre-permit inspection lists corrections",
    eff=[{"field": "setupCost", "add": 1000, "note": "hand sink, thermometers, coving: estimate"}, {"field": "openingDelayDays", "add": 0, "appliesIf": "fixed before day 22"}],
    moves=[{"kind": "choice", "id": "fix_before_opening", "label": "Fix before day 22", "cost": {"cash": 1000}, "result": "no effect on opening"}],
    src="FSE", sup=[], conf="estimate", freq="Common", note="Estimate."),

"d00_premises_early_stock": dict(
    months=ALL, dur=0,
    trig="decision: food delivered before the pre-operational visit",
    eff=[{"field": "cash", "add": -500, "note": "spoiled or discarded stock, estimate"}],
    moves=[{"kind": "choice", "id": "deliver_after_visit", "label": "Schedule the first delivery after the visit", "cost": {}, "result": "no loss"}],
    src="SBS_FORM", sup=[], conf="estimate", freq="First-time owners", note="The pre-operational pathway requires no food storage on site (D00)."),

"d00_premises_exemption_scope": dict(
    months=ALL, dur=1,
    trig="decision: small storefront work treated as permit-exempt",
    eff=[{"field": "cash", "add": -2000, "note": "redo to code, estimate"}],
    moves=[{"kind": "setup", "id": "architect_expediter", "label": "Ask the architect", "cost": {}, "result": "scope checked"}],
    src="DOB_SIGN", sup=[], conf="estimate", freq="Common", note="Estimate."),

"d00_premises_sign_relief_scope": dict(
    months=ALL, dur=1,
    trig="decision: oversized or unsafe sign installed relying on the sign moratorium",
    eff=[{"field": "fine", "add": 0, "appliesIf": "accessory storefront sign up to 150 sq ft and 1,200 lb", "note": "no work-without-permit penalty under Local Law 15 of 2026"},
         {"field": "cash", "add": -1500, "appliesIf": "unsafe or larger sign", "note": "removal or a licensed sign hanger's permit, estimate"}],
    moves=[{"kind": "choice", "id": "small_wall_sign", "label": "Wall sign of 6 sq ft or less", "cost": {}, "result": "no permit needed"},
           {"kind": "choice", "id": "licensed_sign_hanger", "label": "Licensed sign hanger files the permit", "cost": {"cash": 1500}, "result": "legal sign of any size"}],
    src="DOB_SIGN", sup=["LL15"], conf="estimate", freq="Every new storefront",
    note="DOB signs page (opened): a wall sign of 6 sq ft or less needs no permit; up to 75 sq ft and 25 lb can be hung without a licensed sign hanger. Local Law 15 of 2026 (DOB page, search excerpt): no work-without-permit penalty for accessory storefront signs and past penalties since December 28, 2017 waived for signs up to 150 sq ft and 1,200 lb; it does not make an unsafe or noncompliant sign lawful."),

"d00_premises_hood_rearrange": dict(
    months=ALL, dur=1,
    trig="decision: move cooking equipment under the hood",
    eff=[{"field": "setupCost", "add": 1500, "note": "suppression re-design and test, estimate"}, {"field": "closureDays", "add": 1}],
    moves=[{"kind": "choice", "id": "no_cooking", "label": "Stay a no-cook cafe", "cost": {}, "result": "no hood, no event"}],
    src="FSE", sup=[], conf="estimate", freq="Only cafes with a hood", note="Estimate."),

"d00_premises_outside_scope": dict(
    months=ALL, dur=1,
    trig="state: plan review finds facade, sidewalk or building-system work",
    eff=[{"field": "buildoutCost", "add": 10000}, {"field": "permitWaitDays", "add": 30}],
    moves=[{"kind": "lever", "id": "lease_negotiation", "optionId": "landlord_base_building", "label": "Base-building work is the landlord's", "cost": {"lawyerHours": 1}, "result": "cost moves to the landlord"}],
    src="SBS_LEASE", sup=[], conf="estimate", freq="Older buildings", note="Estimates."),

"d00_premises_toilet_renovation": dict(
    months=ALL, dur=1, mergedWith="renovation_triggers_restroom_rules",
    trig="decision: renovation with a construction permit in a 20+ seat room exempt since 1977",
    eff=[{"field": "buildoutCost", "add": 12000}, {"field": "seats", "add": -3}],
    moves=[{"kind": "choice", "id": "stay_at_19_seats", "label": "Stay at 19 seats", "cost": {}, "result": "no toilet required"}],
    src="FSE", sup=[], conf="estimate", freq="See D02", note="D02 numbers (Health Code §81.22, read by D02)."),

"renovation_triggers_restroom_rules": dict(
    months=ALL, dur=1,
    trig="decision: renovation that needs a Buildings permit in a room of 20 or more seats",
    eff=[{"field": "buildoutCost", "add": 12000}, {"field": "seats", "add": -3}],
    moves=[{"kind": "choice", "id": "stay_at_19_seats", "label": "Plan 19 seats", "cost": {"seats": -1}, "result": "no customer toilet required"},
           {"kind": "setup", "id": "customer_restroom", "label": "Build the toilet", "cost": {"cash": 12000}, "result": "20+ seats allowed"}],
    src="FSE", sup=[], conf="estimate", freq="Former luncheonettes",
    note="D02 numbers kept: Health Code §81.22(b) seat threshold 20 (verified by D02); $12,000 and 60 sq ft (3 seats) from the pack."),

"seat_20_restroom_line": dict(
    months=ALL, dur=0,
    trig="decision: size set to 20 seats or more (indoor plus outdoor)",
    eff=[{"field": "setupCost", "add": 12000, "note": "customer_restroom"}, {"field": "seats", "add": -3}],
    moves=[{"kind": "choice", "id": "stay_at_19_seats", "label": "19 seats", "cost": {}, "result": "no toilet"}],
    src="FSE", sup=[], conf="estimate", freq="Every 20-seat plan",
    note="Health Code §81.22(b): customer toilet at a seating capacity of 20 or more, indoor and outdoor together (D02, page opened by D02; not reopened here)."),

"allowance_paid_after_the_work": dict(
    months=ALL, dur=2,
    trig="decision: lease with a tenant improvement allowance paid as reimbursement",
    eff=[{"field": "cashFloat", "add": -40000, "durationDays": 60, "note": "$50 per sq ft x 800 paid about 60 days after completion and lien waivers"},
         {"field": "monthlyFees", "add": 333, "durationMonths": 2, "note": "carrying cost at 10% a year"}],
    moves=[{"kind": "lever", "id": "lease_negotiation", "optionId": "allowance_as_rent_credit", "label": "Take it as free rent instead", "cost": {}, "result": "no cash gap; fewer dollars"}],
    src="JDS_FREE", sup=[], conf="estimate", freq="Strong tenants (D01)",
    note="Allowance $50-$150 per sq ft for strong tenants, paid as reimbursement after completion (law firm, secondary). 60 days and 10% are my estimates."),

"construction_noise_complaint": dict(
    months=ALL, dur=1,
    trig="decision: construction rush with night or weekend work; neighbor calls 311",
    eff=[{"field": "fine", "add": 6000, "appliesIf": "after-hours work without a variance"}, {"field": "fine", "add": 560, "appliesIf": "unreasonable construction noise"}, {"field": "openingDelayDays", "add": 7}],
    moves=[{"kind": "lever", "id": "construction_pace", "optionId": "rush_with_variance", "label": "Get an after-hours variance", "cost": {"cash": 1770, "unit": "per 14 days"}, "result": "legal night work"},
           {"kind": "lever", "id": "construction_pace", "optionId": "standard", "label": "Weekday hours only", "cost": {}, "result": "no complaint"}],
    src="RCNY10204", sup=["DEP_NOISE", "MMR_DOB", "AHV"], conf="verified",
    freq="DOB answered non-emergency complaints in 21.5 days on average in FY2026 (MMR)",
    note="1 RCNY §102-04(b)(4) (opened): work after hours without a variance permit $6,000 in a building other than a one- or two-family home. DEP schedule (opened): unreasonable construction noise §24-228, $560 first offense. DOB AHV page (search excerpt): filing fee $130 for 1-3 days up to $650 for 13-14 days, plus $80 for each day of after-hours work; 14 days = $650 + $1,120 = $1,770."),
}
