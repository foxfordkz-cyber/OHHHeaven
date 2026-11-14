from common import ALL

# Lease, landlord, rent, exit from the lease.
CAL = {
"free_rent_runs_out": dict(
    months=ALL, dur=2, durNote="from the end of the free months to opening day: 0.6, 1.6 or 4.6 months by build-out class",
    trig="schedule: free-rent end day < opening day (lease signed + build-out days + 25 days DOB approval + 22 days Health permit)",
    eff=[{"field": "setupRentDays", "add": 17, "unit": "days of full base rent before the first sale, light build-out", "byBuildoutClass": {"light": 17, "standard": 47, "heavy": 137}},
         {"field": "rent", "mult": 1.0, "note": "full base rent from the first day after the free months; additional rent (taxes, water) was never free"}],
    moves=[{"kind": "lever", "id": "free_rent_deal", "optionId": "long_free", "label": "Ask for 6 free months", "cost": {"faceRentMult": 1.026}, "result": "17/47/137 paid days become 0/0/47; the landlord recovers it through a 2.6% higher face rent for 114 months"},
           {"kind": "lever", "id": "free_rent_deal", "optionId": "no_free", "label": "Take a 2.5% lower rent and no free months", "cost": {"faceRentMult": 0.975}, "result": "all 107/137/227 days before opening are paid: $20,865 / $26,715 / $44,265 at $5,850"},
           {"kind": "lever", "id": "lease_contingencies", "optionId": "rent_from_permits", "label": "Rent starts at DOB approval + 90 days, not at signing", "cost": {"cash": 0, "faceRentMult": 1.01}, "result": "a permit delay no longer eats free months; estimate: the landlord prices the risk at about 1% of face rent"},
           {"kind": "lever", "id": "construction_pace", "optionId": "rush", "label": "Night and weekend shifts", "cost": {"buildoutCostMult": 1.25, "afterHoursVariance": True}, "result": "build-out days x 0.75: light 60 -> 45 days, saves 15 days = $3,000 of rent for +$17,500 of work"}],
    src="SBS_LEASE", sup=["JDS_FREE", "MMR_DOB", "FSE"], conf="estimate",
    freq="Every new lease of an empty store: the SBS lease guide calls rent abatement for alterations common; law firms give 3-6 months, up to 12 for a heavy build-out",
    note="Opening day in the engine's terms: build-out days (60/90/180, keen-cray) + 25 days of DOB approval (MMR FY2026: 25.4 days from filing to approval in DOB NOW, not modelled yet) + 22 days of the Health permit wait (NYC Business: open 22 days after applying) = 107/137/227 days. Three free months = 90 days. Paid days 17/47/137 x $200 a day = $3,400 / $9,400 / $27,400 of rent with no sales. Face-rent formula from D14: market x (120-3)/(120-free)."),

"free_rent_ends": dict(
    months=ALL, dur=0, mergedWith="free_rent_runs_out",
    trig="schedule: 7 days before freeUntilDay, any status",
    eff=[{"field": "inbox", "add": 1, "note": "warning only; the money is in free_rent_runs_out"}],
    moves=[{"kind": "lever", "id": "construction_pace", "optionId": "rush", "label": "Speed up the last weeks", "cost": {"buildoutCostMult": 1.25}, "result": "see free_rent_runs_out"}],
    src="SBS_LEASE", sup=["JDS_FREE"], conf="estimate", freq="Once per lease with free months",
    note="Notice event: same numbers as free_rent_runs_out. Kept so the player sees the date a week ahead (D14 spec)."),

"d00_premises_lease_rent_start": dict(
    months=ALL, dur=2, durNote="as free_rent_runs_out: 0.6, 1.6 or 4.6 months by build-out class", mergedWith="free_rent_runs_out",
    trig="schedule: rent commencement date passes while status = setup",
    eff=[{"field": "setupRentDays", "add": 17, "byBuildoutClass": {"light": 17, "standard": 47, "heavy": 137}}],
    moves=[{"kind": "lever", "id": "lease_contingencies", "optionId": "rent_from_permits", "label": "Tie rent start to permits", "cost": {"faceRentMult": 1.01}, "result": "rent starts 90 days after DOB approval"}],
    src="SBS_LEASE", sup=["JDS_FREE"], conf="estimate", freq="Same as free_rent_runs_out",
    note="Same event seen from D00; calibrated with the free_rent_runs_out numbers so the assembler can merge them."),

"landlord_late_delivery": dict(
    months=ALL, dur=2,
    trig="attribute: space still occupied on signing day (holdover tenant) or landlord work unfinished",
    eff=[{"field": "openingDelayDays", "add": 45},
         {"field": "rent", "mult": 0.0, "note": "no base rent until the space is delivered (SBS guide: you start paying once the space is available)"},
         {"field": "setupCost", "add": 375, "note": "insurance and utilities already started: 1.5 months x $250"}],
    moves=[{"kind": "lever", "id": "lease_contingencies", "optionId": "outside_delivery_date", "label": "Outside delivery date: cancel and get money back", "cost": {"cash": 0}, "result": "if the space is not delivered by the date, cancel and recover the deposit (RPL §223-a gives this by default unless the lease says otherwise)"},
           {"kind": "lever", "id": "site_due_diligence", "optionId": "walk_through", "label": "Sign only a vacant, broom-clean space", "cost": {"cash": 0, "searchDays": 14}, "result": "no delay; two more weeks of looking"}],
    src="SBS_LEASE", sup=["RPL223A"], conf="estimate",
    freq="The SBS guide warns that removing a holdover tenant 'may be weeks or months'; D01 cites a five-month delay held reasonable by a court",
    note="45 days is my midpoint between 'weeks' and 'months'; D01 had 60. The delay costs time and frozen cash (deposit $18,000 already paid), not rent. RPL §223-a (opened): unless the lease says otherwise, the landlord must deliver possession at the start of the term; if not, the tenant may rescind and recover what was paid."),

"first_timer_turned_away": dict(
    months=ALL, dur=0, scale="block",
    trig="attribute: prime tier address + player has no operating history + guaranty_type != full",
    eff=[{"field": "depositMonths", "add": 3, "note": "3 -> 6 months: $18,000 more cash frozen at $6,000 rent; on a prime block at $12,000 rent, $36,000"}],
    moves=[{"kind": "lever", "id": "guaranty_type", "optionId": "full", "label": "Sign a full personal guaranty", "cost": {"personalExposure": "all rent to the end of the term"}, "result": "deposit back to 3 months"},
           {"kind": "lever", "id": "guaranty_type", "optionId": "good_guy", "label": "Good guy guaranty", "cost": {"depositMonthsAdd": 1}, "result": "deposit 4 months, exposure limited to rent until surrender"},
           {"kind": "choice", "id": "entry_mode", "optionId": "takeover", "label": "Buy a shop with an assignable lease", "cost": {"see": "takeover_listing"}, "result": "track record of the seller's lease"}],
    src="SBS_LEASE", sup=["METRO_DEP", "CW_Q3"], conf="estimate",
    freq="SBS guide: deposit 'commonly two' months, larger for a business with little financial history; brokers quote 6-12 months for startups and restaurants. In Q3 2026 Manhattan retail availability fell to a record 9.8% (Cushman & Wakefield), so prime landlords can choose",
    note="The pack's deposit is already 3 months. +3 months is the low end of the broker range for startups. Applies only to prime tier; mid and cheap blocks keep 3."),

"letter_of_credit_wait": dict(
    months=ALL, dur=1,
    trig="decision: guaranty_type = no_guaranty_big_deposit (deposit as letter of credit)",
    eff=[{"field": "leaseSigningDelayDays", "add": 18}, {"field": "monthlyFees", "add": 23, "note": "1.5% a year on $18,000"}],
    moves=[{"kind": "lever", "id": "guaranty_type", "optionId": "good_guy", "label": "Cash deposit plus good guy guaranty", "cost": {"cash": 0}, "result": "no bank wait, no fee"}],
    src="SBS_LEASE", sup=["METRO_DEP"], conf="estimate",
    freq="SBS guide: the landlord may require a letter of credit; the bank charges a fee and may require collateral",
    note="D01 numbers kept: 14-21 days to issue, fee 0.75-2% a year (secondary). The cash behind the letter stays frozen at the bank."),

"vacancy_leverage": dict(
    months=ALL, dur=12, scale="block",
    trig="announced: block storefront vacancy above 15% (cheap tier blocks only)",
    tiers=["cheap"],
    eff=[{"field": "freeRentMonths", "add": 2, "appliesTo": "leases signed while active"}, {"field": "rent", "mult": 0.9, "appliesTo": "leases signed while active"}],
    moves=[{"kind": "lever", "id": "free_rent_deal", "optionId": "long_free", "label": "Ask for more free months", "cost": {"faceRentMult": 1.0}, "result": "on an empty block the landlord gives months without raising face rent"}],
    src="CW_Q3", sup=["CBRE_Q3", "JDS_FREE"], conf="estimate",
    freq="Not in 2026 Manhattan corridors: availability at a record low 9.8% (Q3 2026) and asking rents +5% a year (CBRE). Still seen on weak outer-borough blocks",
    note="Vendor estimate: effective rents land 10-25% below asking after concessions; I take the low end (0.9) and +2 free months for cheap-tier blocks only. Prime and mid blocks get no leverage in 2026: the event is off there. Correction to D01, which applied it everywhere."),

"tax_escalation_bill": dict(
    months=[7], dur=12,
    trig="schedule: tax year starts July 1; first bill in the second lease year (base year = first year)",
    eff=[{"field": "rentAdd", "add": 52, "unit": "$/month, new lease, second year", "note": "3.9% x $20/sq ft x 800 sq ft / 12"},
         {"field": "rentAdd", "add": 281, "unit": "$/month, assigned lease with a base year 5 years old", "appliesTo": "takeover"}],
    moves=[{"kind": "lever", "id": "lease_negotiation", "optionId": "cap_escalation", "label": "Cap the tax pass-through at 5% a year", "cost": {"lawyerHours": 1}, "result": "rentAdd capped; estimate: landlords accept caps for small tenants rarely"},
           {"kind": "lever", "id": "takeover_due_diligence", "optionId": "full_review", "label": "Read the base year before buying", "cost": {"cash": 7500}, "result": "the $281 a month is priced into the offer"}],
    src="DOF_FY27", sup=["DOF_RATES", "SBS_LEASE"], conf="estimate",
    freq="Yearly in most store leases (SBS guide lists 'a share of the increase in real estate taxes' as additional rent)",
    note="DOF (opened): Class 4 assessed value +5.8% on the FY2027 tentative roll; the Class 4 rate was 10.848% in tax year 2026 and the Council's provisional FY2027 rate is 10.658% (search excerpt) -> taxes about +3.9%. Tax share of $20 a sq ft for an $90/sq ft storefront is my assumption. New lease: first escalation only in month 13, so inside a 12-month season it hits only a bought lease. Takeover: (1.039^5 - 1) = 21% x $20 x 800 / 12 = $281 a month. Same id appears in D01, D08 and D10; one calibration for all three."),

"annual_rent_step": dict(
    months=ALL, dur=12,
    trig="schedule: each lease anniversary (month 13 of a new lease; any month for an assigned lease)",
    eff=[{"field": "rent", "mult": 1.03, "note": "compounding: $6,000 -> $6,180"}],
    moves=[{"kind": "lever", "id": "lease_negotiation", "optionId": "two_percent_steps", "label": "2% steps instead of 3%", "cost": {"faceRentMult": 1.047}, "result": "start at $6,282 instead of $6,000; the landlord collects the same over 10 years"}],
    src="SBS_LEASE", sup=[], conf="verified",
    freq="SBS guide (opened): a fixed increase 'typically 2-3% each year'",
    note="Verified: 2-3% a year (SBS). 1.03 is the top of the range used by brokers for NYC retail. Landlord-neutral 2% schedule: sum of 1.03^k for k=0..9 = 11.464, of 1.02^k = 10.950, ratio 1.047. Same as D08 rent_step_anniversary."),

"rent_step_anniversary": dict(
    months=ALL, dur=12, mergedWith="annual_rent_step",
    trig="schedule: lease anniversary",
    eff=[{"field": "rent", "mult": 1.03}],
    moves=[{"kind": "lever", "id": "lease_negotiation", "optionId": "two_percent_steps", "label": "2% steps", "cost": {"faceRentMult": 1.047}, "result": "see annual_rent_step"}],
    src="SBS_LEASE", sup=[], conf="verified", freq="Yearly", note="Duplicate of annual_rent_step (D08)."),

"lease_renewal_offer": dict(
    months=ALL, dur=60,
    trig="schedule: 6 months before the lease ends (an assigned lease with little time left, or a long game)",
    eff=[{"field": "rent", "mult": 1.2, "byTier": {"prime": 1.3, "mid": 1.2, "cheap": 1.05}, "note": "new rent = today's market rent; relative to the last stepped rent"}],
    moves=[{"kind": "choice", "id": "renew_at_market", "label": "Renew at the landlord's price", "cost": {"rentMult": 1.2}, "result": "keep the build-out and the regulars"},
           {"kind": "choice", "id": "relocate", "label": "Move", "cost": {"buildout": "new light/standard/heavy build-out", "awareness": 0.5}, "result": "rent at market elsewhere; the build-out stays with the landlord"},
           {"kind": "lever", "id": "lease_negotiation", "optionId": "renewal_option_cap", "label": "At signing: 5-year renewal option at 95% of market", "cost": {"faceRentMult": 1.0, "lawyerHours": 2}, "result": "renewal mult x 0.95 and the right to stay"}],
    src="SBS_LEASE", sup=["CW_Q3", "CBRE_Q3"], conf="estimate",
    freq="Every lease end. No law caps commercial renewal rent in NYC (D08). Cushman & Wakefield: five-year asking-rent growth to Q3 2026 of 47.1% in SoHo, 35.1% on Third Avenue, 25.6% on the Upper West Side",
    note="Lease of 10 years with 3% steps: last rent = 1.03^9 = 1.305 x start. Market after 10 years at 4.7% a year (UWS pace) = 1.583 -> ratio 1.21; at 6.2% (Third Ave) 1.36 -> 1.3 cap; cheap blocks with flat rents 1.05. SBS guide (opened): the most common term is 10 years with an option to renew for 5; options can cap the new rent at 90-95% of market."),

"lease_renewal_reset": dict(
    months=ALL, dur=60, mergedWith="lease_renewal_offer",
    trig="schedule: lease end without a renewal option",
    eff=[{"field": "rent", "mult": 1.2, "byTier": {"prime": 1.3, "mid": 1.2, "cheap": 1.05}}, {"field": "buildoutValue", "mult": 0.0, "note": "improvements stay with the landlord if you leave"}],
    moves=[{"kind": "choice", "id": "renew_at_market", "label": "Pay the new rent", "cost": {"rentMult": 1.2}, "result": "stay"}, {"kind": "choice", "id": "relocate", "label": "Leave", "cost": {"buildout": "new"}, "result": "start over"}],
    src="SBS_LEASE", sup=["CW_Q3"], conf="estimate", freq="Every lease end", note="Same numbers as lease_renewal_offer."),

"rent_default_notice": dict(
    months=ALL, dur=1,
    trig="state: rent unpaid 5 days after the due date",
    eff=[{"field": "cash", "add": -300, "note": "late charge 5% of rent: common clause, estimate"},
         {"field": "cash", "add": -2500, "note": "landlord's legal fees billed as additional rent if it goes to court, estimate"},
         {"field": "evictionClockDays", "add": 14, "note": "written 14-day demand, then a court case, then a 14-day marshal notice"}],
    moves=[{"kind": "choice", "id": "pay_within_14_days", "label": "Pay all arrears within 14 days", "cost": {"cash": 6300}, "result": "case never filed"},
           {"kind": "choice", "id": "payment_plan", "label": "Ask for a payment plan", "cost": {"cash": 0}, "result": "landlord's choice; no right to one"},
           {"kind": "choice", "id": "surrender_good_guy", "label": "Give notice and hand back the keys", "cost": {"rentMonths": 3}, "result": "good guy guarantor free after surrender"}],
    src="RPAPL711", sup=["RPAPL749", "SBS_LEASE"], conf="verified",
    freq="Steady stream in Civil Court's commercial part; D08 lists recent closings over rent",
    note="Verified: RPAPL §711(2) requires a written demand with at least 14 days' notice; §749 requires the marshal to give at least 14 days' notice before eviction (both opened). Late charge and legal fees are estimates from typical lease clauses."),

"landlord_pressure": dict(
    months=ALL, dur=3,
    trig="state: the tenant pays below-market rent with more than 3 years left (building sold or redevelopment)",
    eff=[{"field": "demand", "mult": 0.9, "note": "blocked hallway and deliveries"}, {"field": "closureDays", "add": 2}],
    moves=[{"kind": "choice", "id": "harassment_claim", "label": "Sue under the commercial tenant harassment law", "cost": {"cash": -7500}, "result": "civil penalty on the landlord $10,000-$50,000; injunction"},
           {"kind": "choice", "id": "buyout", "label": "Negotiate a buyout to leave", "cost": {"cash": 0}, "result": "cash in exchange for surrender; estimate 6-12 months of rent"}],
    src="LL185", sup=["SBS_LEASE"], conf="estimate",
    freq="Rare; the harassment law exists because it happens",
    note="Local Law 185 of 2019 raised the civil penalty under Admin. Code §22-903(a) to $10,000-$50,000 (intro.nyc, search excerpt). Demand and closure values are game estimates."),

"holdover_after_expiry": dict(
    months=ALL, dur=1,
    trig="state: lease expired, no renewal signed, tenant still in",
    eff=[{"field": "rent", "mult": 1.5, "note": "holdover rate; often 2.0 after the first 30 days; engine clamps at 1.5"}],
    moves=[{"kind": "choice", "id": "sign_renewal", "label": "Sign the renewal", "cost": {"rentMult": 1.2}, "result": "back to the renewal rent"},
           {"kind": "choice", "id": "vacate", "label": "Move out", "cost": {"see": "d00_closures_nyc_event_bare_handover"}, "result": "holdover ends"}],
    src="HOLDOVER", sup=["RPL232C"], conf="estimate",
    freq="When renewal talks drag on",
    note="Courts enforce holdover rent of 150% or 200% (law firm, D08). RPL §232-c (opened): if the landlord accepts rent after the term, the tenancy becomes month to month."),

"assignment_consent_price": dict(
    months=ALL, dur=1, appliesTo=["takeover"],
    trig="decision: buy a shop whose lease needs the landlord's consent to assign",
    eff=[{"field": "closingDelayDays", "add": 30}, {"field": "cash", "add": -2500, "note": "landlord's legal and processing fee, estimate"}, {"field": "rent", "mult": 1.1, "note": "landlord resets part of the way to market as the price of consent, estimate"}],
    moves=[{"kind": "lever", "id": "takeover_due_diligence", "optionId": "full_review", "label": "Read the assignment clause before the offer", "cost": {"cash": 7500}, "result": "price the 10% rise into the offer"},
           {"kind": "choice", "id": "walk_away", "label": "Walk away", "cost": {"cash": -2500}, "result": "no deal"}],
    src="RPL226B", sup=["SBS_LEASE", "COMM_OBS_KEY"], conf="estimate",
    freq="Every assignment; SBS guide: most landlords permit an assignment only with their consent",
    note="RPL §226-b (opened) gives a right to sublet or assign only for residential tenants; a store tenant has whatever the lease says. Commercial Observer: on consent the landlord may raise the rent, the deposit or ask for a new guaranty. 30 days from D14; +10% and $2,500 are my estimates."),

"landlord_blocks_the_sale": dict(
    months=ALL, dur=2,
    trig="decision: player sells; lease needs consent",
    eff=[{"field": "salePrice", "mult": 0.9, "note": "buyer discounts for the higher rent"}, {"field": "closingDelayDays", "add": 30}],
    moves=[{"kind": "lever", "id": "lease_negotiation", "optionId": "consent_not_unreasonably_withheld", "label": "At signing: consent not unreasonably withheld", "cost": {"lawyerHours": 1}, "result": "landlord can only refuse with a reason"},
           {"kind": "choice", "id": "sell_assets_only", "label": "Sell the equipment, not the business", "cost": {"salePriceMult": 0.3}, "result": "liquidation value"}],
    src="RPL226B", sup=["SBS_LEASE", "BIZBUY"], conf="estimate",
    freq="Every sale that needs the lease (D09)",
    note="Mirror of assignment_consent_price for the seller. 0.9 = the 10% rent rise the buyer must absorb, capitalised roughly; estimate."),

"short_lease_left": dict(
    months=ALL, dur=0, appliesTo=["takeover"],
    trig="attribute: listing with 3 years or less left on the lease and no renewal option",
    eff=[{"field": "takeoverPrice", "mult": 0.85, "note": "fair price discount for renewal risk, estimate"}, {"field": "renewalRentMult", "add": 0.2, "note": "at month 37: lease_renewal_offer"}],
    moves=[{"kind": "lever", "id": "takeover_due_diligence", "optionId": "full_review", "label": "Ask the landlord for a new 10-year lease as a condition of closing", "cost": {"cash": 7500, "rentMult": 1.1}, "result": "renewal risk gone at a higher rent"}],
    src="SBS_LEASE", sup=["BIZBUY"], conf="estimate",
    freq="Common in listings (D01)",
    note="Beyond a 12-month season the renewal hits after the game ends; the event matters for the price. 15% is my estimate of what a careful buyer knocks off."),

"still_on_the_lease_after_sale": dict(
    months=ALL, dur=3,
    trig="state: player sold the shop, lease assigned without a release, buyer stops paying",
    eff=[{"field": "cash", "add": -18000, "note": "three months of the buyer's unpaid rent claimed from the seller"}, {"field": "cash", "add": -3000, "note": "own lawyer, estimate"}],
    moves=[{"kind": "lever", "id": "exit_terms", "optionId": "release_at_assignment", "label": "Ask for a release when assigning", "cost": {"salePriceMult": 0.95}, "result": "no claim"},
           {"kind": "lever", "id": "guaranty_type", "optionId": "good_guy", "label": "Have signed a good guy guaranty", "cost": {}, "result": "personal exposure ends at surrender"}],
    src="SBS_LEASE", sup=[], conf="estimate",
    freq="D09 story; SBS guide: whether you assign or sublet, you still have obligations",
    note="SBS guide (opened): 'Whether you assign the lease or sublet the space, you still have obligations'. Three months at $6,000 is my estimate of a default before the landlord re-lets; New York commercial landlords have no duty to mitigate (Holy Properties v. Kenneth Cole, 1995; RPL §227-e imposes the duty only for dwellings), so it can be more."),

"deposit_kept_by_landlord": dict(
    months=ALL, dur=2,
    trig="state: player leaves the space",
    eff=[{"field": "depositRefundDelayDays", "add": 45}, {"field": "depositRefund", "add": -6000, "note": "restoration and repairs deducted, estimate"}],
    moves=[{"kind": "choice", "id": "restore_before_leaving", "label": "Restore the space yourself", "cost": {"cash": -4000}, "result": "deposit back in full"}],
    src="SBS_LEASE", sup=[], conf="estimate",
    freq="Common at exit (D09)",
    note="SBS guide (opened): the landlord 'will usually refund the security deposit 30 to 45 days after you vacate'. $6,000 deduction and $4,000 own restoration are estimates."),

"building_sold": dict(
    months=ALL, dur=12, scale="point",
    trig="announced: the building changes hands",
    eff=[{"field": "renewalRentMult", "add": 0.1, "note": "new owners reprice at renewal, estimate"}],
    moves=[{"kind": "lever", "id": "lease_negotiation", "optionId": "renewal_option_cap", "label": "Renewal option already in the lease", "cost": {}, "result": "binds the new owner"}],
    src="SBS_LEASE", sup=[], conf="estimate",
    freq="Story in D10; no rate",
    note="The lease binds the buyer of the building; nothing changes until renewal. Small effect on purpose."),

"d00_premises_guaranty_scope": dict(
    months=ALL, dur=0,
    trig="state: business closes or defaults with time left on the lease",
    eff=[{"field": "personalLiability", "add": 36000, "unit": "good guy: 6 months of notice and rent to surrender", "byGuaranty": {"good_guy": 36000, "full": 432000, "none": 0}}],
    moves=[{"kind": "lever", "id": "guaranty_type", "optionId": "good_guy", "label": "Good guy guaranty", "cost": {"depositMonthsAdd": 1}, "result": "exposure $18,000-$36,000"},
           {"kind": "lever", "id": "guaranty_type", "optionId": "full", "label": "Full guaranty", "cost": {}, "result": "exposure to the end of the term"},
           {"kind": "lever", "id": "guaranty_type", "optionId": "none_big_deposit", "label": "No guaranty, 6-month deposit", "cost": {"depositMonthsAdd": 3}, "result": "exposure = the deposit"}],
    src="SBS_LEASE", sup=["METRO_DEP"], conf="estimate",
    freq="Every owner who closes early",
    note="SBS guide (opened): a full guaranty covers all the tenant's obligations; under a good guy guaranty the guarantor is not responsible for rent after the tenant vacates. Full exposure: 72 months left x $6,000 = $432,000 (no duty to mitigate for commercial landlords in NY: Holy Properties v. Kenneth Cole, 1995, search excerpt; RPL §227-e, opened, covers only dwellings). Good guy notice 3-6 months (secondary, D01)."),

"d00_premises_surrender_clawback": dict(
    months=ALL, dur=0,
    trig="state: early surrender under a 'good guy' clause that repays concessions",
    eff=[{"field": "cash", "add": -33120, "note": "3 free months $18,000 + broker commission $15,120"}],
    moves=[{"kind": "lever", "id": "lease_negotiation", "optionId": "true_good_guy", "label": "Strike the repayment clause", "cost": {"lawyerHours": 1}, "result": "surrender costs only rent to the surrender date"}],
    src="SBS_LEASE", sup=[], conf="verified",
    freq="SBS guide names it as a trap to avoid",
    note="SBS guide (opened): a lease is not a true good guy guaranty if it makes you repay the improvement allowance, free rent or the broker's commission. Broker commission from the guide's own example: 5% of the first year's base rent and 4% for years two to five = 21% x $72,000 = $15,120. Free rent 3 x $6,000."),

"d00_premises_landlord_access": dict(
    months=ALL, dur=1,
    trig="state: lease dispute open",
    eff=[{"field": "closureDays", "add": 2, "note": "lost contribution about $1,200 a day"}],
    moves=[{"kind": "choice", "id": "court_order", "label": "Ask the court for an order to restore access", "cost": {"cash": -3000}, "result": "access back in days"}],
    src="SBS_LEASE", sup=["LL185"], conf="estimate",
    freq="Rare; part of the harassment pattern the 2019 law targets",
    note="Lockout of a paying tenant can be commercial tenant harassment (Admin. Code §22-902, D08). Values are estimates."),

"d00_premises_landlord_permit": dict(
    months=ALL, dur=1,
    trig="state: build-out filing needs the owner's authorization and the landlord delays it",
    eff=[{"field": "openingDelayDays", "add": 30}],
    moves=[{"kind": "lever", "id": "lease_contingencies", "optionId": "landlord_cooperation", "label": "Lease clause: landlord signs filings within 10 days", "cost": {"lawyerHours": 1}, "result": "delay 0"}],
    src="SBS_LEASE", sup=["MMR_DOB"], conf="estimate",
    freq="Not measured",
    note="SBS guide: certain agencies may not permit alterations to start until the space complies; require the landlord to deliver compliance. DOB filings are made for the owner. 30 days is my estimate (one month of chasing)."),

"d00_premises_lease_court": dict(
    months=ALL, dur=3,
    trig="state: lease dispute not settled after 30 days",
    eff=[{"field": "cash", "add": -7500, "note": "retainer, estimate"}],
    moves=[{"kind": "choice", "id": "free_lease_help", "label": "City's free commercial lease help", "cost": {"cash": 0}, "result": "advice and a letter, not a court case"},
           {"kind": "choice", "id": "settle", "label": "Settle", "cost": {"rentMonths": 1}, "result": "dispute ends"}],
    src="SBS_LEASE", sup=[], conf="estimate", freq="Not measured",
    note="SBS runs free commercial lease assistance for small businesses (mentioned across SBS materials; page not opened this session). Court costs are estimates."),

"d00_premises_lease_hours": dict(
    months=ALL, dur=1,
    trig="decision: shorten hours below the lease's operating covenant",
    eff=[{"field": "defaultNotice", "add": 1}],
    moves=[{"kind": "lever", "id": "lease_negotiation", "optionId": "no_operating_covenant", "label": "No hours clause at signing", "cost": {"lawyerHours": 1}, "result": "free to cut hours"}],
    src="SBS_LEASE", sup=[], conf="estimate", freq="Mall and building-lobby leases mostly", note="Qualitative: a covenant to operate turns a cost cut into a lease default."),

"d00_premises_short_tenure_capex": dict(
    months=ALL, dur=0,
    trig="decision: spend on the room with fewer than 3 years of lease left",
    eff=[{"field": "capexValueLost", "mult": 0.6, "note": "share of a 10-year improvement written off if the lease ends in 4 years"}],
    moves=[{"kind": "choice", "id": "extend_first", "label": "Extend the lease before spending", "cost": {"rentMult": 1.1}, "result": "keeps the value"}],
    src="SBS_LEASE", sup=[], conf="estimate", freq="Not measured", note="1 - 4/10 = 0.6 for a 120-month improvement with 48 months left."),

"d00_premises_landlord_utility_exit": dict(
    months=ALL, dur=3,
    trig="state: third building failure (gas, water, power) in 12 months",
    eff=[{"field": "closureDays", "add": 3, "unit": "per failure"}],
    moves=[{"kind": "lever", "id": "lease_negotiation", "optionId": "abatement_clause", "label": "Rent abatement after 3 days without service", "cost": {"lawyerHours": 1}, "result": "rent stops while the building is broken"},
           {"kind": "choice", "id": "relocate", "label": "Leave at renewal", "cost": {"buildout": "new"}, "result": "end of dependency"}],
    src="RPL227", sup=["SBS_LEASE"], conf="estimate", freq="Older buildings",
    note="RPL §227 (opened) lets a tenant quit only when the building becomes untenantable; partial failures need a lease clause."),

"d00_closures_nyc_event_repair_dispute_surrender": dict(
    months=ALL, dur=2,
    trig="state: landlord repair dispute open for 3 months",
    eff=[{"field": "closureDays", "add": 5}, {"field": "cash", "add": -3000}],
    moves=[{"kind": "choice", "id": "negotiated_surrender", "label": "Negotiated surrender", "cost": {"rentMonths": 1}, "result": "exit without guaranty claim"}],
    src="SBS_LEASE", sup=["RPL227"], conf="estimate", freq="Closure stories in D00", note="Estimates."),

"d00_closures_nyc_event_renewal_fight": dict(
    months=ALL, dur=6,
    trig="schedule: lease end, landlord refuses to renew",
    eff=[{"field": "leaseEndsInMonths", "add": 6}],
    moves=[{"kind": "choice", "id": "relocate", "label": "Find a new space now", "cost": {"buildout": "new"}, "result": "continuity"}, {"kind": "choice", "id": "close", "label": "Close at lease end", "cost": {}, "result": "exit"}],
    src="SBS_LEASE", sup=[], conf="verified", freq="No right to renew without an option clause",
    note="SBS guide (opened): no guarantee that the landlord will renew without an option."),

"d00_closures_nyc_event_pass_through_jump": dict(
    months=[7], dur=12,
    trig="schedule: renewal resets the tax base year",
    eff=[{"field": "rentAdd", "add": 281}],
    moves=[{"kind": "lever", "id": "lease_negotiation", "optionId": "cap_escalation", "label": "Keep the old base year", "cost": {"lawyerHours": 1}, "result": "rentAdd 0"}],
    src="DOF_FY27", sup=["SBS_LEASE"], conf="estimate", freq="At renewal", note="Same arithmetic as tax_escalation_bill for a 5-year-old base year."),

"d00_closures_nyc_event_owner_landlord_exit": dict(
    months=ALL, dur=6,
    trig="announced: the landlord wants the space for own use at lease end",
    eff=[{"field": "leaseEndsInMonths", "add": 6}],
    moves=[{"kind": "choice", "id": "relocate", "label": "Relocate", "cost": {"buildout": "new"}, "result": "continuity"}],
    src="SBS_LEASE", sup=[], conf="estimate", freq="Stories in D00", note="Qualitative."),

"d00_closures_nyc_event_relocation_repeats": dict(
    months=ALL, dur=0,
    trig="decision: relocate",
    eff=[{"field": "setupCost", "add": 70000, "note": "a new light build-out"}, {"field": "awareness", "mult": 0.5}],
    moves=[{"kind": "choice", "id": "longer_lease", "label": "Sign 10 years with a renewal option", "cost": {}, "result": "avoids the next move"}],
    src="SBS_LEASE", sup=["ALPHA"], conf="estimate", freq="Stories in D00", note="Build-out from the pack's light class; awareness halves as regulars must find the new address (estimate)."),

"d00_closures_nyc_event_bare_handover": dict(
    months=ALL, dur=0,
    trig="state: lease ends; lease requires removal of the tenant's work",
    eff=[{"field": "cash", "add": -6000, "note": "removal and patching, estimate"}],
    moves=[{"kind": "choice", "id": "sell_furnishings", "label": "Sell fixtures to the next tenant", "cost": {}, "result": "+$2,000 and no removal, estimate"}],
    src="SBS_LEASE", sup=[], conf="estimate", freq="Common clause", note="Estimates."),

"d00_closures_nyc_event_espresso_exclusivity": dict(
    months=ALL, dur=0,
    trig="attribute: another tenant of the building holds an exclusive on coffee",
    eff=[{"field": "demand", "mult": 0.7, "note": "drip only, no espresso drinks; effectively a different shop"}],
    moves=[{"kind": "setup", "id": "lease_lawyer", "label": "Lawyer reads the building's exclusives", "cost": {"cash": 3500}, "result": "found before signing"}],
    src="SBS_LEASE", sup=[], conf="estimate", freq="Mixed-use buildings with a coffee tenant", note="0.7 is the engine's lower bound for a cafe without espresso; estimate."),

"d00_closures_nyc_event_shared_basement": dict(
    months=ALL, dur=3,
    trig="state: landlord's basement has pests; cafe stores stock there",
    eff=[{"field": "inspections", "mult": 1.2}, {"field": "monthlyFees", "add": 175, "note": "own pest contract"}],
    moves=[{"kind": "lever", "id": "pest_control", "optionId": "monthly", "label": "Own pest contract", "cost": {"monthly": 175}, "result": "documented treatment"},
           {"kind": "lever", "id": "lease_negotiation", "optionId": "landlord_pest_clause", "label": "Landlord treats common areas", "cost": {"lawyerHours": 1}, "result": "basement treated"}],
    src="SBS_LEASE", sup=[], conf="estimate", freq="Old buildings", note="$175 is the pack's pest_control lever."),

"d00_closures_nyc_event_building_repair_limbo": dict(
    months=ALL, dur=2,
    trig="state: fire, flood or structural damage in the building, landlord repairs",
    eff=[{"field": "closureDays", "add": 45}, {"field": "rent", "mult": 0.0, "note": "only if the lease abates rent or the tenant surrenders under RPL §227"}],
    moves=[{"kind": "lever", "id": "insurance", "optionId": "business_interruption", "label": "Business interruption cover", "cost": {"monthly": 40}, "result": "lost profit paid after a waiting period, estimate"},
           {"kind": "choice", "id": "surrender_227", "label": "Surrender the untenantable space", "cost": {}, "result": "no further rent (RPL §227)"}],
    src="RPL227", sup=["SBS_LEASE"], conf="estimate", freq="Closure stories in D00",
    note="RPL §227 (opened): if the building is destroyed or made untenantable without the tenant's fault and the lease says nothing else, the tenant may surrender and owes no further rent. 45 days and $40/month are estimates."),

"d00_world_event_split_premises_dependency": dict(
    months=ALL, dur=3, trig="state: production space leased separately and that lease ends",
    eff=[{"field": "capacity", "mult": 0.8}], moves=[{"kind": "choice", "id": "single_lease", "label": "Keep production under one lease", "cost": {}, "result": "no split risk"}],
    src="SBS_LEASE", sup=[], conf="estimate", freq="Rare", note="Estimate."),

"d00_world_event_landlord_authority_unclear": dict(
    months=ALL, dur=1, trig="state: lease talks with a person who is not the owner of record",
    eff=[{"field": "leaseSigningDelayDays", "add": 21}],
    moves=[{"kind": "setup", "id": "lease_lawyer", "label": "Check the deed", "cost": {"cash": 0}, "result": "owner of record known on day 1"}],
    src="SBS_LEASE", sup=[], conf="estimate", freq="Rare", note="Estimate."),

"d00_world_event_outside_seating_withdrawn": dict(
    months=[4, 5, 6, 7, 8, 9, 10], dur=6, trig="state: outdoor seats depend on the landlord's consent and it is withdrawn",
    eff=[{"field": "seats", "add": -8}], moves=[{"kind": "lever", "id": "lease_negotiation", "optionId": "outdoor_rights", "label": "Write the outdoor area into the lease", "cost": {"lawyerHours": 1}, "result": "seats kept"}],
    src="SBS_LEASE", sup=[], conf="estimate", freq="Rare", note="8 seats is a typical sidewalk setup; estimate."),

"d00_labor_finance_crt_review": dict(
    months=ALL, dur=0,
    trig="state: annual rent crosses $250,000 in Manhattan south of 96th Street",
    eff=[{"field": "tax", "add": 0, "note": "reference shop ($72,000 a year) owes nothing"}, {"field": "tax", "mult": 0.039, "base": "rent", "appliesIf": "rent >= $250,000/yr and (income > $5M or rent >= $500,000)"}],
    moves=[{"kind": "setup", "id": "accountant", "label": "Accountant checks eligibility and files", "cost": {"cash": 300}, "result": "credit claimed"}],
    src="DOF_CRT", sup=[], conf="verified",
    freq="Only very large Manhattan rents",
    note="DOF (opened): tenants in Manhattan south of 96th Street with annual rent of at least $250,000; rate 6% of base rent with a 35% base reduction = 3.9%; a small business credit fully exempts total income of $5,000,000 or less with base rent under $500,000. A single cafe is always exempt in practice; $300 for the return is my estimate."),

"d00_labor_finance_zero_sales_return": dict(
    months=[3, 6, 9, 12], dur=0,
    trig="schedule: quarterly sales tax return due while status = setup",
    eff=[{"field": "fine", "add": 50, "appliesIf": "return not filed", "note": "minimum penalty even with no sales"}],
    moves=[{"kind": "setup", "id": "accountant", "label": "File a zero return", "cost": {"cash": 0}, "result": "no penalty"}],
    src="TAX1145", sup=[], conf="verified",
    freq="Every quarter of a registered vendor",
    note="Tax Law §1145 (opened): for a registered vendor the penalty for failure to file a return is never less than $50; interest 14.5% a year or the commissioner's rate if tax is owed. Return due dates: quarterly (months are the quarter ends; the return is due on the 20th of the next month)."),
}
