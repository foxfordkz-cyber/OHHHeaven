import json, os
HERE = os.path.dirname(os.path.abspath(__file__))

SBS = "https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf"
MMR = "https://www.nyc.gov/assets/operations/downloads/pdf/mmr2026/dob.pdf"
RCNY = "https://www.nyc.gov/assets/buildings/rules/1_RCNY_102-04.pdf"

levers = [
 {"id": "lease_negotiation", "name": "Lease clauses you negotiate before signing",
  "note": "One-time choices made at signing (monthlyCost 0); each costs about an hour of the lease lawyer already in setup (lease_lawyer, $3,500). Several options can be chosen together: the engine should treat this lever as a set of flags, not one option.",
  "options": [
   {"id": "standard_form", "label": "Sign the landlord's form", "monthlyCost": 0, "effects": {}},
   {"id": "two_percent_steps", "label": "2% yearly steps instead of 3%", "monthlyCost": 282, "effects": {"rent": 1.047, "rentStepPct": 0.02}, "note": "landlord-neutral over 10 years: start 4.7% higher (SBS: steps typically 2-3%)"},
   {"id": "cap_escalation", "label": "Cap the tax pass-through at 5% a year", "monthlyCost": 0, "oneTimeCost": 500, "effects": {"taxEscalationCapPct": 0.05}},
   {"id": "true_good_guy", "label": "Good guy guaranty without repayment of concessions", "monthlyCost": 0, "oneTimeCost": 500, "effects": {"surrenderClawback": 0}, "note": "SBS guide: a guaranty that repays free rent, allowance or broker's commission is not a true good guy"},
   {"id": "consent_not_unreasonably_withheld", "label": "Landlord may not unreasonably refuse an assignment", "monthlyCost": 0, "oneTimeCost": 500, "effects": {"assignmentRentMult": 1.0}},
   {"id": "abatement_clause", "label": "Rent abates after 3 days without building services", "monthlyCost": 0, "oneTimeCost": 500, "effects": {"rentAbatesWhenBuildingFails": True}},
   {"id": "structural_carveout", "label": "Structure and base building are the landlord's", "monthlyCost": 0, "oneTimeCost": 500, "effects": {"structuralDelayRentFree": True}},
   {"id": "landlord_base_building", "label": "Facade, sidewalk and risers are the landlord's", "monthlyCost": 0, "oneTimeCost": 500, "effects": {"outsideScopeCostShare": 0}},
   {"id": "repair_deadline", "label": "Landlord repairs within 10 days of notice", "monthlyCost": 0, "oneTimeCost": 500, "effects": {}},
   {"id": "landlord_pest_clause", "label": "Landlord treats common areas and cellar", "monthlyCost": 0, "oneTimeCost": 500, "effects": {}},
   {"id": "no_operating_covenant", "label": "No minimum opening hours", "monthlyCost": 0, "oneTimeCost": 500, "effects": {}},
   {"id": "outdoor_rights", "label": "Outdoor area written into the lease", "monthlyCost": 0, "oneTimeCost": 500, "effects": {}},
   {"id": "allowance_as_rent_credit", "label": "Take the allowance as free rent", "monthlyCost": 0, "effects": {"tiAllowance": 0}},
   {"id": "renewal_right", "label": "Renewal right in a shop-in-shop or license agreement", "monthlyCost": 0, "oneTimeCost": 500, "effects": {}}],
  "source": SBS, "confidence": "estimate"},
 {"id": "permit_help", "name": "Free help before filing", "options": [
   {"id": "none", "label": "File on your own", "monthlyCost": 0, "effects": {}},
   {"id": "dob_walk_in", "label": "DOB walk-in / SBS project manager before filing", "monthlyCost": 0, "effects": {"permitWaitDays": 0.9, "openingDelayDays": 5}},
   {"id": "lpc_preapplication", "label": "LPC staff meeting before applying", "monthlyCost": 0, "effects": {"openingDelayDays": 7, "lpcCycles": 1}}],
  "source": MMR, "confidence": "estimate", "note": "MMR FY2026: 0.72 correction cycles per DOB NOW job, about 19 days each; 0.9 is a design value."},
 {"id": "takeover_terms", "name": "Terms of a business purchase", "options": [
   {"id": "cash", "label": "Pay in full at closing", "monthlyCost": 0, "effects": {}},
   {"id": "seller_note", "label": "Seller finances up to half over 60 months at 8%", "monthlyCost": 2362, "effects": {"sellerNoteShare": 0.5}},
   {"id": "seller_note_standby", "label": "Seller note on full standby (counts toward the SBA 10%)", "monthlyCost": 0, "effects": {"equityInjectionCovered": 0.5}},
   {"id": "price_allocation", "label": "Allocate the price: equipment, goodwill, lease", "monthlyCost": 0, "oneTimeCost": 500, "effects": {}},
   {"id": "credit_for_accruals", "label": "Deduct staff sick-time balances from the price", "monthlyCost": 0, "effects": {"inheritedSickLeave": 0}}],
  "source": "https://www.bizbuysell.com/learning-center/valuation-benchmarks/coffee-shops-cafes/", "confidence": "estimate"},
 {"id": "exit_terms", "name": "Terms when you sell or assign", "options": [
   {"id": "plain_assignment", "label": "Assign the lease as it is", "monthlyCost": 0, "effects": {"stillLiableAfterSale": True}},
   {"id": "release_at_assignment", "label": "Ask the landlord to release you", "monthlyCost": 0, "effects": {"salePrice": 0.95, "stillLiableAfterSale": False}}],
  "source": SBS, "confidence": "estimate", "note": "SBS guide: whether you assign or sublet, you still have obligations."},
 # options added to levers that exist in D01, D02 (same lever id; only the new options are listed)
 {"id": "free_rent_deal", "addsOptionsTo": "D01", "options": [
   {"id": "no_free_lower_rent", "label": "No free months, rent 2.5% lower", "monthlyCost": -150, "effects": {"freeRentMonths": 0, "rent": 0.975}, "note": "D14 formula market x 117/120"}]},
 {"id": "lease_contingencies", "addsOptionsTo": "D01", "options": [
   {"id": "landlord_cooperation_clause", "label": "Landlord signs filings within 10 days", "monthlyCost": 0, "oneTimeCost": 500, "effects": {}},
   {"id": "landlord_delivers_acm_free", "label": "Space delivered free of asbestos", "monthlyCost": 0, "oneTimeCost": 500, "effects": {"asbestosCostShare": 0}}]},
 {"id": "site_due_diligence", "addsOptionsTo": "D01", "options": [
   {"id": "bid_before_lease", "label": "Two contractor bids before signing", "monthlyCost": 0, "oneTimeCost": 3000, "effects": {"leaseSigningDelayDays": 21, "bidSurprise": 1.0}},
   {"id": "contractor_walkthrough", "label": "Contractor opens test holes", "monthlyCost": 0, "oneTimeCost": 1500, "effects": {"hiddenConditionsMult": 1.05}}]},
 {"id": "contractor_choice", "addsOptionsTo": "D01", "options": [
   {"id": "fixed_price", "label": "Fixed price on a frozen drawing set", "monthlyCost": 0, "effects": {"buildoutCost": 1.03, "changeOrderShare": 0.0}}]},
 {"id": "takeover_transition", "addsOptionsTo": "D01", "options": [
   {"id": "seller_stays_two_weeks", "label": "Seller works the bar for two weeks", "monthlyCost": 0, "oneTimeCost": 2000, "effects": {"awareness": 0.8}}]},
 {"id": "laptop_policy", "addsOptionsTo": "D02", "options": [
   {"id": "weekend_no_laptops", "label": "No laptops on weekends", "monthlyCost": 0, "effects": {"reputation": -0.01}},
   {"id": "minimum_spend", "label": "One order per 90 minutes", "monthlyCost": 0, "effects": {"seatTurns": 0.95}}]},
 {"id": "seating_layout", "addsOptionsTo": "D02", "options": [
   {"id": "more_twos", "label": "Two-tops instead of four-tops", "monthlyCost": 0, "oneTimeCost": 400, "effects": {"effectiveSeats": 1.15}},
   {"id": "bar_rail", "label": "Window bar rail for solo guests", "monthlyCost": 0, "oneTimeCost": 1200, "effects": {}},
   {"id": "accessible_route", "label": "Keep a 36-inch route to counter and toilet", "monthlyCost": 0, "effects": {"seats": -2, "accessExposure": 0}}]},
]

pack_events = [
 {"id": "annual_rent_step", "name": "Rent goes up 3%", "text": "Your lease anniversary: the rent steps up by the percentage written in the lease.", "effect": {"field": "rent", "mult": 1.03}, "months": 12, "source": SBS, "confidence": "verified", "note": "SBS guide: fixed increase typically 2-3% each year."},
 {"id": "asking_rents_climb", "name": "Store rents keep climbing", "text": "New leases on Manhattan corridors cost more each quarter.", "effect": {"field": "rent", "mult": 1.0125}, "months": 3, "source": "https://www.cbre.com/insights/figures/manhattan-retail-figures-q3-2026", "confidence": "estimate", "note": "CBRE Q3 2026: +5% a year; one quarter. Applies to leases signed while active."},
 {"id": "vacancy_leverage", "name": "Empty storefronts give tenants leverage", "text": "On a block with many empty stores, landlords cut rent for new tenants.", "effect": {"field": "rent", "mult": 0.9}, "months": 12, "source": "https://www.cushmanwakefield.com/en/united-states/insights/us-marketbeats/new-york-city-area-marketbeats/manhattan-retail", "confidence": "estimate", "note": "Cheap tier only; Manhattan availability at a record low 9.8% in Q3 2026."},
 {"id": "holdover_after_expiry", "name": "Staying past the end of the lease", "text": "The lease ran out during talks. Every month is billed at the holdover rate.", "effect": {"field": "rent", "mult": 1.5}, "months": 1, "source": "https://www.thehabitatgroup.com/articles/9654-require-tenants-to-pay-maximum-premium-rent-for-long-holdovers", "confidence": "estimate"},
 {"id": "lease_renewal_offer", "name": "The renewal letter", "text": "Six months before the lease ends the landlord names the new rent at today's market.", "effect": {"field": "rent", "mult": 1.2}, "months": 60, "source": SBS, "confidence": "estimate", "note": "Mid tier; prime 1.3, cheap 1.05 (eventCatalog)."},
 {"id": "d00_street_hidden_sign", "name": "A shed hides your sign", "text": "A sidewalk shed goes up and covers your sign.", "effect": {"field": "footTraffic", "mult": 0.9}, "months": 12, "source": "https://www.nyc.gov/site/buildings/safety/sidewalk-sheds.page", "confidence": "estimate"},
 {"id": "sign_complaint_wave", "name": "Someone reports every sign on the avenue", "text": "Dozens of sign complaints: Buildings inspectors walk the block.", "effect": {"field": "inspections", "mult": 1.5}, "months": 1, "source": "https://www.nyc.gov/site/buildings/safety/sign-ll15of2026.page", "confidence": "estimate", "note": "Accessory storefront signs up to 150 sq ft carry no penalty under Local Law 15 of 2026."},
 {"id": "dob_enforcement_sweep", "name": "Buildings sweep for unpermitted work", "text": "Inspectors check every build-out on the block without waiting for a complaint.", "effect": {"field": "inspections", "mult": 1.5}, "months": 1, "source": MMR, "confidence": "verified", "note": "MMR FY2026: stop work orders +19% from proactive enforcement."},
 {"id": "peak_kw_bill_jump", "name": "The electric bill jumps", "text": "New equipment pushed your peak load into demand charges.", "effect": {"field": "utilities", "mult": 1.1}, "months": 12, "source": "https://nectarclimate.com/rates/consolidated-edison-coned", "confidence": "estimate"},
]

effect_fields = {
 "note": "Fields used in effects of this fragment. 'engine' = already an EffectTarget in shared/src/types.ts (mult only, clamped 0.5-1.5); 'D01' = proposed by D01 (newEffectFields); 'D02'/'D14' = used by those fragments; 'D15' = new here. add = additive, mult = multiplier, set = assignment.",
 "engine": {"rent": "mult", "demand": "mult", "footTraffic": "mult", "utilities": "mult", "inspections": "mult", "staffAvailability": "mult"},
 "D01": {"openingDelayDays": "add days on the pre-opening track", "leaseSigningDelayDays": "add", "closingDelayDays": "add", "buildoutCost": "mult or add $", "setupCost": "mult or add $ before opening", "permitWaitDays": "mult or add", "freeRentMonths": "add", "depositMonths": "add", "cash": "add $ once", "closureDays": "add days without sales", "awareness": "mult or set", "monthlyFees": "add or mult $/month", "revenueShare": "mult on revenue kept", "fines": "mult", "payrollTax": "add rate", "minOwnCashShare": "add", "cartPermitWaitMonths": "add", "reputation": "add", "capacity": "mult on orders the shop can serve"},
 "D02": {"seats": "add or mult", "seatTurns": "mult", "quality": "add"},
 "D15": {"setupRentDays": "add: days of full base rent before the first sale (by build-out class)", "rentAdd": "add $/month of additional rent (tax pass-through)", "fine": "add $ when the violation is found", "liability": "add $ owed to the state or staff", "personalLiability": "add $ owed by the owner personally at closure (by guaranty type)", "escrowHeld": "add $ withheld from the price for durationDays", "takeoverPrice": "mult", "askingPrice": "formula", "salePrice": "mult or formula", "overpaid": "info: $ paid above fair value", "accessExposure": "add $ of an accessibility claim if one is filed", "depositRefund": "add $ (negative) at exit", "depositRefundDelayDays": "add", "evictionClockDays": "add", "renewalRentMult": "add to the renewal multiplier", "leaseEndsInMonths": "set", "capexValueLost": "mult share of an improvement lost", "buildoutValue": "mult", "cashFloat": "add $ temporarily out of cash for durationDays", "ownerEarnings": "mult on the seller's claimed earnings", "inspectionPoints": "add", "tax": "add or rate", "discoveredBy": "set: how a violation is found", "ownerFine": "info: landlord's fine", "triggers": "set: event id this one triggers", "obligation": "info", "cashTiming": "set", "roadwayMonthsActive": "set", "leaseAvailable": "set", "defaultNotice": "add", "inbox": "add"},
}

mechanics = [
 {"id": "d15_effect_field_registry", "title": "One vocabulary for event effects", "playerDecision": "none", "engineMath": "Read effects[].field against this registry; engine targets already exist; D01/D15 fields need code.", "fieldsNeeded": ["see extra.effectFields"], "numbers": [], "tier": "core"},
 {"id": "setup_rent_days", "title": "Rent paid before the first sale", "playerDecision": "Lease option (free months), build-out class of the space, rush or not",
  "engineMath": "openDay = buildoutDays(class) x (0.75 if rush) + dobApprovalDays (25) + fsePermitDays (22). paidSetupDays = max(0, openDay - freeRentDays). Rent line in setup = paidSetupDays x faceRent / 30. Today keen-cray omits the 25 DOB days.",
  "fieldsNeeded": ["extra.preOpening.dobPermitDays = 25 (D14 had 20)", "setup.fse_permit.waitDays = 22 (pack has 21)"],
  "numbers": [{"what": "DOB NOW filing to approval FY2026", "value": 25.4, "source": MMR, "confidence": "verified"}, {"what": "Health permit: open after", "value": 22, "source": "https://nyc-business.nyc.gov/nycbusiness/description/food-service-establishment-permit", "confidence": "verified"}, {"what": "paid days with 3 free months: light / standard / heavy", "value": [17, 47, 137], "source": MMR, "confidence": "estimate"}], "tier": "core"},
 {"id": "work_without_permit_penalty", "title": "The real price of starting before the permit", "playerDecision": "Shortcut start_work_before_permit",
  "engineMath": "fine = clamp(21 x permitFee, 6000, 15000) for the whole job; partial work: prorated but >= 6000; legalize before a violation: 6000; repeat within 12 months: x2; one waiver per small business (fewer than 100 employees) on request, fine 0 but the stop work order and the delay stay. Working against the SWO: +6000 (then 12000). Found by a neighbor's 311 complaint (DOB answers non-emergency complaints in 21.5 days on average) or by dob_enforcement_sweep.",
  "fieldsNeeded": ["violations.work_without_permit.fine: base 6000, max 15000, formula 21 x fee", "businessState.extra.law.smallBusinessWaiverUsed: boolean"],
  "numbers": [{"what": "multiplier of the permit fee", "value": 21, "source": RCNY, "confidence": "verified"}, {"what": "minimum", "value": 6000, "source": RCNY, "confidence": "verified"}, {"what": "maximum", "value": 15000, "source": RCNY, "confidence": "verified"}, {"what": "SWO violation, first", "value": 6000, "source": "https://www.nyc.gov/site/buildings/property-or-business-owner/stop-work-order.page", "confidence": "verified"}, {"what": "average days to respond to Priority B complaints", "value": 21.5, "source": MMR, "confidence": "verified"}], "tier": "core"},
 {"id": "guaranty_exposure_at_closure", "title": "What the owner still owes when the cafe closes", "playerDecision": "guaranty_type at signing; lease_negotiation.true_good_guy",
  "engineMath": "On bankruptcy or closure with lease time left: full guaranty -> remaining base rent x months left (no mitigation: New York commercial landlords have no duty to re-let); good guy -> rent until surrender + notice months (3-6); clawback clause -> + free rent given + broker commission (21% of one year's rent in the SBS example); no guaranty -> deposit forfeited. Shown in the final score as personal debt.",
  "fieldsNeeded": ["lease.guarantyType", "lease.noticeMonths", "lease.clawback"],
  "numbers": [{"what": "broker commission example: 5% year 1 + 4% years 2-5", "value": 0.21, "source": SBS, "confidence": "verified"}, {"what": "landlord duty to mitigate (dwellings only)", "value": 0, "source": "https://www.nysenate.gov/legislation/laws/RPP/227-E", "confidence": "verified"}], "tier": "core"},
 {"id": "bulk_sale_escrow", "title": "The state's claim in a business purchase", "playerDecision": "File AU-196.10 10 days before closing, or skip (shortcut skip_bulk_sale_notice)",
  "engineMath": "Filed: the state answers in 5 business days; if the seller owes, the buyer holds that amount from the price for up to 90 days and pays the state. Not filed: seller's unpaid sales tax becomes the buyer's personal liability, capped at the price, with interest at >= 14.5% a year.",
  "fieldsNeeded": ["takeover.noticeFiled", "liabilities[] copied from the seller"],
  "numbers": [{"what": "notice days before closing", "value": 10, "source": "https://www.nysenate.gov/legislation/laws/TAX/1141", "confidence": "verified"}, {"what": "days for the state to name the amount", "value": 90, "source": "https://www.nysenate.gov/legislation/laws/TAX/1141", "confidence": "verified"}, {"what": "interest rate floor on unpaid tax", "value": 0.145, "source": "https://www.nysenate.gov/legislation/laws/TAX/1145", "confidence": "verified"}], "tier": "core"},
 {"id": "building_cycles_as_signals", "title": "Dated building risks instead of random ones", "playerDecision": "survey_first before signing; all-electric concept",
  "engineMath": "Each place gets hidden attributes revealed by survey_first: builtBefore1987 (asbestos assessment), coUse (eating and drinking or not), gasLeak + LL152 cycle year (from the community district), openWwpPenalty (blocks permits), historicDistrict. Events fire from these attributes on known dates, never by chance.",
  "fieldsNeeded": ["Place.builtYear", "Place.communityDistrict", "Place.historicDistrict", "Place.coUse", "Place.hidden.gasLeak", "Place.hidden.openWwpPenalty"],
  "numbers": [{"what": "LPC protected buildings and sites", "value": 38550, "source": "https://www.nyc.gov/assets/operations/downloads/pdf/mmr2026/lpc.pdf", "confidence": "verified"}, {"what": "LL152 missed-filing penalty", "value": 5000, "source": "https://www.nyc.gov/assets/buildings/pdf/gas_piping-sn.pdf", "confidence": "verified"}], "tier": "deep"},
 {"id": "lease_clauses_as_flags", "title": "Lease clauses are one-time flags, not a monthly lever", "playerDecision": "lease_negotiation options at signing",
  "engineMath": "Store chosen clauses in BusinessState.lease.clauses[]; each event checks its clause (abatement_clause, structural_carveout, cap_escalation...) and switches its effect off or on. Cost: one-time lawyer time, already in lease_lawyer; some clauses raise face rent (two_percent_steps x1.047).",
  "fieldsNeeded": ["BusinessState.lease.clauses: string[]"], "numbers": [], "tier": "deep"},
 {"id": "crt_gate", "title": "Commercial Rent Tax only above $250,000", "playerDecision": "none for one cafe",
  "engineMath": "If place is in Manhattan south of 96th Street and rent x 12 >= 250,000: tax = 3.9% x rent, minus the small business credit (full credit when total income <= $5M and base rent < $500,000). A single cafe is always below; keep the filing cost only.",
  "fieldsNeeded": ["Place.manhattanBelow96th"], "numbers": [{"what": "effective rate", "value": 0.039, "source": "https://www.nyc.gov/site/finance/business/business-commercial-rent-tax-crt.page", "confidence": "verified"}], "tier": "exotic"},
]

corrections = [
 {"target": "D14 extra.preOpening / violations.work_without_permit", "was": "14 x permit fee or $5,000, whichever is greater", "now": "21 x permit fee capped at $15,000, floor $6,000; legalization before a violation $6,000; one small-business waiver", "source": RCNY, "why": "1 RCNY §102-04 in force (PDF opened)"},
 {"target": "D14 extra.preOpening.dobPermitDays", "was": 20, "now": 25, "source": MMR, "why": "FY2026 average filing-to-approval is 25.4 days (20.3 was FY2025)"},
 {"target": "packs/cafe.json setup.fse_permit.waitDays", "was": 21, "now": 22, "source": "https://nyc-business.nyc.gov/nycbusiness/description/food-service-establishment-permit", "why": "'you can open 22 days after you submit your application'"},
 {"target": "D02 event roll_down_gate_deadline", "was": "cash -$6,500 by July 1, 2026", "now": "cancelled: deadline repealed (Intro 910-A, Council 51-0, June 30, 2026)", "source": "https://ny1.com/nyc/all-boroughs/news/2026/07/02/city-council-votes-to-repeal-deadline-for-new-roll-down-security-gates", "why": "the law changed before the deadline"},
 {"target": "D08 event sign_complaint_wave", "was": "signs without permits get $6,000 fines", "now": "no work-without-permit penalty for accessory storefront signs up to 150 sq ft / 1,200 lb (Local Law 15 of 2026); $6,000 only for other signs", "source": "https://www.nyc.gov/site/buildings/safety/sign-ll15of2026.page", "why": "2026 sign moratorium"},
 {"target": "D02 event neighbor_noise_complaint", "was": "first violation $2,000 -> $0", "now": "§24-231(a): $3,200 first ($8,000 default), $6,400, $9,600; $0 for a first offense if compliance is certified within 30 days", "source": "https://www.nyc.gov/assets/dep/downloads/pdf/air/noise/noise-code-penalty-schedule.pdf", "why": "current DEP penalty schedule (PDF opened)"},
 {"target": "D01 event vacancy_leverage", "was": "all blocks", "now": "cheap tier only; prime and mid get asking_rents_climb instead", "source": "https://www.cushmanwakefield.com/en/united-states/insights/us-marketbeats/new-york-city-area-marketbeats/manhattan-retail", "why": "Manhattan retail availability at a record low 9.8% in Q3 2026"},
 {"target": "D01 event hidden_conditions", "was": "buildoutCost x1.12", "now": "x1.10", "source": "https://www.rhumbix.com/blog/how-much-are-change-orders-costing-your-construction-business", "why": "published average of change orders is about 10%"},
 {"target": "D01 event landlord_late_delivery", "was": "+60 days", "now": "+45 days, rent does not run until delivery", "source": SBS, "why": "SBS guide: 'weeks or months'; you start paying once the space is available"},
 {"target": "D01 event fit_out_prices_rise", "was": "x1.07 (retail fit-out guide)", "now": "x1.05", "source": "https://www.commercialsearch.com/news/will-construction-costs-go-up-in-2026/", "why": "2026 bid-price forecasts 4.25-5%"},
 {"target": "D14 extra.takeoverRules.earningsMultiple", "was": 2.0, "now": "2.2 for the ask, sale at 90% (= 2.0)", "source": "https://www.bizbuysell.com/learning-center/valuation-benchmarks/coffee-shops-cafes/", "why": "BizBuySell average earnings multiple 2.20; D14's acceptance rule already gives 2.0 on the sale"},
 {"target": "packs/cafe.json setup.sidewalk_cafe_license", "was": 2550, "now": "check: $1,050 license for the four-year term plus a yearly revocable consent fee by location and size", "source": "https://portal.311.nyc.gov/article/?kanumber=KA-03604", "why": "NYC311 outdoor dining page"},
 {"target": "D00 eventCatalog (premises_law shard and others)", "was": "effects [], months []", "now": "calibrated in this file under the same ids", "source": "", "why": "task D15"},
]

verified_facts = [
 ["Rent demand before a nonpayment case: at least 14 days' written notice", "https://www.nysenate.gov/legislation/laws/RPA/711"],
 ["Marshal's notice before eviction: at least 14 days", "https://www.nysenate.gov/legislation/laws/RPA/749"],
 ["Lease implies delivery of possession at the start of the term; if not, the tenant may rescind and recover what was paid", "https://www.nysenate.gov/legislation/laws/RPP/223-A"],
 ["Untenantable building without the tenant's fault: tenant may surrender and owes no further rent unless the lease says otherwise", "https://www.nysenate.gov/legislation/laws/RPP/227"],
 ["Landlord's duty to mitigate is written into law only for dwellings", "https://www.nysenate.gov/legislation/laws/RPP/227-E"],
 ["Right to sublet or assign by statute: residential tenants only", "https://www.nysenate.gov/legislation/laws/RPP/226-B"],
 ["Rent accepted after the term creates a month-to-month tenancy", "https://www.nysenate.gov/legislation/laws/RPP/232-C"],
 ["Mechanic's lien: filed during the work or within 8 months after the last work", "https://www.nysenate.gov/legislation/laws/LIE/10"],
 ["Lien discharged by a bond of 110% of the lien", "https://www.nysenate.gov/legislation/laws/LIE/19"],
 ["Bulk sale: notice 10 days ahead; 90 days for the state's claim; buyer personally liable if no notice, capped at the price", "https://www.nysenate.gov/legislation/laws/TAX/1141"],
 ["Sales tax return penalty never under $50 for a registered vendor; interest 14.5% a year or more", "https://www.nysenate.gov/legislation/laws/TAX/1145"],
 ["Franchise prospectus in New York: at the first personal meeting or 10 business days before signing", "https://www.nysenate.gov/legislation/laws/GBS/683"],
 ["UI experience transfers to a buyer who takes the business, goodwill and the same workers", "https://www.nysenate.gov/legislation/laws/LAB/581"],
 ["Customer with an eligible medical condition may use the staff toilet when 2+ employees are working", "https://www.nysenate.gov/legislation/laws/GBS/492"],
 ["Work without a permit: max(21 x fee, $6,000), cap $15,000; legalization $6,000; repeat x2; small business waiver once", "https://www.nyc.gov/assets/buildings/rules/1_RCNY_102-04.pdf"],
 ["Alteration fee below 7 floors: $280 for the first $3,000 + $10.30 per $1,000", "https://www.nyc.gov/assets/buildings/pdf/26fee_updates-sn.pdf"],
 ["DOB FY2026: filing to approval 25.4 days; first review minor 4.4, major 8.4 days; 111,842 resubmissions on 156,389 first reviews; 7,882 stop work orders; Priority B complaints answered in 21.5 days", "https://www.nyc.gov/assets/operations/downloads/pdf/mmr2026/dob.pdf"],
 ["LPC FY2026: 38,550 buildings, 159 districts; 90% of PMWs and CNEs in 10 business days; 566 enforcement actions", "https://www.nyc.gov/assets/operations/downloads/pdf/mmr2026/lpc.pdf"],
 ["SBS lease guide: deposit commonly 2 months, refunded 30-45 days after vacating; steps 2-3%; 10 years + 5-year option; good guy rules; broker 5% + 4%", "https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf"],
 ["Gas delays (2017): 82.1% delayed, 17% on time, about 68 days on average, $140,000 lost per business", "https://www.nysenate.gov/sites/default/files/press-release/attachment/cooking_without_gas.pdf"],
 ["Noise: circulation device >42 dB(A) $560/$1,120/$1,680; commercial music $3,200/$6,400/$9,600, first can be $0", "https://www.nyc.gov/assets/dep/downloads/pdf/air/noise/noise-code-penalty-schedule.pdf"],
 ["LL152 missed gas piping certification: $5,000 (other than 3-family); cycle years by community district", "https://www.nyc.gov/assets/buildings/pdf/gas_piping-sn.pdf"],
 ["Con Edison needs about 20 days to evaluate a load letter", "https://www.nyc.gov/assets/hpd/downloads/pdfs/services/hpd-pilot-coned-load-letter.pdf"],
 ["Stop work order: working against it $6,000 then $12,000; not rescinded until penalties are paid", "https://www.nyc.gov/site/buildings/property-or-business-owner/stop-work-order.page"],
 ["CO: change of use, egress or occupancy needs an amended CO; CO never expires", "https://www.nyc.gov/site/buildings/property-or-business-owner/certificate-of-occupancy.page"],
 ["TCO: typically expires after 90 days, $130, renewable; new TCO if unoccupied more than 30 days", "https://www.nyc.gov/site/buildings/property-or-business-owner/temporary-certificate-of-occupancy.page"],
 ["Asbestos assessment before a permit in buildings built before April 1, 1987 unless no materials are disturbed", "https://www.nyc.gov/site/buildings/dob/project-requirements-asbestos.page"],
 ["Signs: wall sign up to 6 sq ft needs no permit; up to 75 sq ft and 25 lb without a licensed sign hanger", "https://www.nyc.gov/site/buildings/property-or-business-owner/project-requirements-owner-signs.page"],
 ["Class 4 property tax rate 10.848% (tax year 2026); FY2027 tentative roll: Class 4 market value +4.3%, assessed +5.8%", "https://www.nyc.gov/site/finance/about/press/press-release-fy27-tentative-assessment-roll.page"],
 ["CRT: Manhattan below 96th St, rent >= $250,000, 3.9% effective; full small business credit at income <= $5M and rent < $500,000", "https://www.nyc.gov/site/finance/business/business-commercial-rent-tax-crt.page"],
 ["2,200 new supervisory vending licenses a year from July 1, 2026 for 5 years; carts must be stored at a commissary", "https://www.nyc.gov/site/doh/business/food-operators/mobile-and-temporary-food-vendors.page"],
 ["Health permit $280; open 22 days after applying; pay outstanding Health fines before applying", "https://nyc-business.nyc.gov/nycbusiness/description/food-service-establishment-permit"],
 ["Asbestos: minor project up to 25 linear ft / 10 sq ft; large from 260 linear ft / 160 sq ft; abatement permit with a work place safety plan when the work area includes plumbing work, wall removal over 45 sq ft, sprinkler, fire alarm or exit sign parts", "https://rules.cityofnewyork.us/wp-content/uploads/2025/04/Asbestos-Rules-2022-Final.pdf"],
 ["Outdoor dining: sidewalk year-round; $1,050 four-year license ($2,100 both); DOT hearing on every roadway application", "https://portal.311.nyc.gov/article/?kanumber=KA-03604"],
]

not_found = [
 "Number of free-rent months in 2025-2026 NYC restaurant leases from a market survey (only law-firm and broker statements: 3-6, up to 12).",
 "DEP's notice period before asbestos abatement and the abatement price per sq ft from a NYC source (title 15 rules PDF returned 404; amlegal blocked).",
 "Con Edison's own timeline for a small commercial electric service upgrade; the EV make-ready sheet that gives 6-24 months was unreachable.",
 "Fresh (after 2017) measurement of NYC gas turn-on delays.",
 "Typical private ADA Title III settlement for a small NYC restaurant with a step (only a $20,000 government penalty for Katz's Deli and court remarks).",
 "Property tax per sq ft attributable to a small storefront (used $20, an assumption).",
 "Official text of the after-hours variance fee ($130-$650 filing plus $80 a day was seen only in a search excerpt of the DOB page).",
 "Dining Out NYC revocable consent fee per sq ft for 2026 (diningoutnyc.info blocked in this session).",
 "Letter of No Objection fee and time for buildings without a CO.",
 "Typical consent fee a NYC landlord charges for a lease assignment.",
 "Fire Department penalty for storage in an exit path; DEP odor violation amount.",
 "Signature status of Intro 910-A (repeal of the roll-down gate law) and of Local Law 15 of 2026's effective date.",
]

comparisons = [
 {"what": "Free months for the build-out", "nyc": "3-6 months, up to 12 for a heavy build-out (law firms, brokers); in 2026 prime Manhattan gives less (record-low 9.8% availability)", "russia": "rent holidays usually no more than 1-2 months; the term is not in the law, only in the contract", "spain": "carencia agreed in exchange for the tenant's works; a forum case with 6 months; the months of carencia for works are treated as rent in kind for tax", "sources": ["https://sberbusiness.live/publications/arendnye-kanikuly", "https://www.consultant.ru/law/podborki/arendnye_kanikuly_jeto/", "https://www.enalquiler.com/comunidad-alquiler/todas/alquiler-comercial-local-vacio_91399.html", "https://www.bolsamania.com/declaracion-impuestos-renta/?p=13269"], "confidence": "estimate"},
 {"what": "Security deposit", "nyc": "commonly 2 months (SBS guide), 6-12 for startups and restaurants (brokers)", "russia": "usually 1-2 monthly payments (obespechitelny platyozh), returned at the end of the lease", "spain": "not checked", "sources": ["https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf", "https://sberbusiness.live/kursy/urok-5-3-kak-zaklyuchit-dogovor"], "confidence": "estimate"},
 {"what": "Does the operating license pass with the business", "nyc": "no: the Health permit is personal, the buyer applies again and waits 22 days", "russia": "not checked", "spain": "the activity license is tied to the premises, so a traspaso can pass it; some city halls let it lapse after 6 months closed (forum case)", "sources": ["https://nyc-business.nyc.gov/nycbusiness/description/food-service-establishment-permit", "https://derecholocal.es/?p=15180", "https://www.certicalia.com/preguntas/p/titularidad-de-la-licencia-de-actividad-de-un-restaurante"], "confidence": "estimate"},
 {"what": "Paying the previous tenant to take over the space", "nyc": "key money: quote-only, $150,000-$160,000 seen in listings (Commercial Observer, D14); the landlord's consent is still needed", "russia": "not checked", "spain": "traspaso: paid to the outgoing tenant, but the lease is signed with the owner; a forum case of a EUR 30,000 traspaso", "sources": ["https://commercialobserver.com/2013/08/weighing-in-on-key-money-deals/", "https://www.legalitas.com/actualidad/traspaso-cesion-local", "https://www.justanswer.es/legal-es/83ygo-alquile-una-cafeteria-al-propietario-pagando-al-anterior.html"], "confidence": "estimate"},
]
json.dump({"levers": levers, "events": pack_events, "extra": {"effectFields": effect_fields, "mechanics": mechanics, "corrections": corrections,
           "verifiedFacts": [{"fact": f, "source": u, "confidence": "verified"} for f, u in verified_facts], "notFound": not_found, "comparisonsAbroad": comparisons}},
          open(os.path.join(HERE, 'fragment_extra.json'), 'w'), ensure_ascii=False, indent=1)
print('levers', len(levers), 'events', len(pack_events), 'mechanics', len(mechanics), 'corrections', len(corrections), 'facts', len(verified_facts))
