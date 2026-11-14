from common import ALL

S_KW = ("https://nectarclimate.com/rates/consolidated-edison-coned", "Nectar, Con Edison rate summary (demand charges)", "estimate")
S_ESP = ("https://www.1st-line.com/customer-education/commercial-espresso-machine-basic-requirements/", "1st-line, commercial espresso machine electrical requirements", "estimate")
EXTRA_SOURCES = {"KW": S_KW, "ESP": S_ESP}

GAS_NOTE = ("NYS Senate report (opened): 82.1% of surveyed restaurants had a gas delay, only 17% got service on time, the average wait was about 68 days, "
            "one respondent over a year; losses averaged $140,000 per business. Survey from 2017; no newer measurement found. An all-electric coffee bar skips the event.")

CAL = {
"gas_turn_on_wait": dict(
    months=ALL, dur=2,
    trig="decision: utility_concept = gas_equipment (gas water heater, oven or range) in a space without live gas service",
    eff=[{"field": "openingDelayDays", "add": 68}, {"field": "setupRentDays", "add": 68, "appliesIf": "free months already used", "note": "68 x $200 = $13,600 of rent with no sales"}],
    moves=[{"kind": "lever", "id": "utility_concept", "optionId": "all_electric", "label": "All-electric bar: electric water heater and oven", "cost": {"setupCost": 2000, "utilitiesMult": 1.05}, "result": "event cannot happen"},
           {"kind": "roadmap", "id": "check_gas_before_lease", "label": "Ask Con Edison about gas at the address before signing", "cost": {"cash": 0}, "result": "known before the lease"}],
    src="SENATE_GAS", sup=["NYCHA_GAS"], conf="verified",
    freq="82.1% of restaurants surveyed in 2017 were delayed",
    note=GAS_NOTE + " The 68-day delay is verified; the all-electric cost and the utilities multiplier are my estimates."),

"gas_connection_wait": dict(
    months=ALL, dur=2, mergedWith="gas_turn_on_wait",
    trig="as gas_turn_on_wait",
    eff=[{"field": "openingDelayDays", "add": 68}],
    moves=[{"kind": "lever", "id": "utility_concept", "optionId": "all_electric", "label": "All-electric", "cost": {"setupCost": 2000}, "result": "no wait"}],
    src="SENATE_GAS", sup=[], conf="verified", freq="See gas_turn_on_wait", note="D14 duplicate. " + GAS_NOTE),

"d00_premises_gas_sequence": dict(
    months=ALL, dur=2, mergedWith="gas_turn_on_wait",
    trig="state: gas piping done, waiting for DOB gas authorization and the utility",
    eff=[{"field": "openingDelayDays", "add": 68}],
    moves=[{"kind": "lever", "id": "utility_concept", "optionId": "all_electric", "label": "All-electric", "cost": {"setupCost": 2000}, "result": "no wait"}],
    src="SENATE_GAS", sup=[], conf="verified", freq="See gas_turn_on_wait", note="Same wait seen as a sequence of approvals. " + GAS_NOTE),

"gas_red_tag": dict(
    months=ALL, dur=2, scale="block",
    signal="Building's Local Law 152 gas piping inspection cycle: Cycle 2 due in 2026 for community districts 4, 6, 8, 9, 16; in 2027 for 11, 12, 14, 15, 17",
    trig="announced: building gas shut off after a failed leak test (inspection year of the building's community district)",
    eff=[{"field": "closureDays", "add": 3, "appliesIf": "cafe can switch to electric hot water"}, {"field": "closureDays", "add": 60, "appliesIf": "hot water or oven only on gas", "note": "estimate: News 12 reported Riverdale shops without gas for months"},
         {"field": "setupCost", "add": 1500, "appliesIf": "emergency electric water heater"}],
    moves=[{"kind": "lever", "id": "utility_concept", "optionId": "all_electric", "label": "All-electric from day one", "cost": {"setupCost": 2000}, "result": "unaffected"},
           {"kind": "choice", "id": "point_of_use_heater", "label": "Install an electric water heater the same week", "cost": {"cash": 1500}, "result": "3 days closed instead of 60"},
           {"kind": "lever", "id": "lease_negotiation", "optionId": "abatement_clause", "label": "Rent abates while building service is off", "cost": {"lawyerHours": 1}, "result": "no rent while closed"}],
    src="DOB_LL152", sup=["MMR_DOB", "RIVERDALE"], conf="estimate",
    freq="DOB issued about 40,000 more violations in FY2026 for missing gas piping inspection certificates (MMR); the penalty is the owner's: $5,000",
    note="DOB service notice (opened): failure to submit the gas piping inspection certification by the cycle deadline brings a $5,000 penalty for buildings other than 3-family homes; the cycle table by community district is in the notice. MMR FY2026 (opened): the jump in DOB violations is mostly LL152. Without hot water a food shop cannot operate (Health Code). Closure lengths are estimates."),

"gas_shut_off_in_building": dict(
    months=ALL, dur=2, mergedWith="gas_red_tag",
    trig="as gas_red_tag",
    eff=[{"field": "closureDays", "add": 3}, {"field": "setupCost", "add": 1500}],
    moves=[{"kind": "choice", "id": "point_of_use_heater", "label": "Electric water heater", "cost": {"cash": 1500}, "result": "3 days"}],
    src="DOB_LL152", sup=["RIVERDALE"], conf="estimate", freq="See gas_red_tag", note="D01 duplicate."),

"building_gas_shutoff": dict(
    months=ALL, dur=2, mergedWith="gas_red_tag",
    trig="as gas_red_tag",
    eff=[{"field": "closureDays", "add": 3}, {"field": "setupCost", "add": 1500}],
    moves=[{"kind": "choice", "id": "point_of_use_heater", "label": "Electric water heater", "cost": {"cash": 1500}, "result": "3 days"}],
    src="DOB_LL152", sup=["RIVERDALE"], conf="estimate", freq="See gas_red_tag", note="Same id in D02 and D13; one calibration."),

"electrical_service_too_small": dict(
    months=ALL, dur=3,
    trig="attribute: building service below the kit's load (espresso machine 30-40 A, dishwasher, ice machine) in a former retail or salon space",
    eff=[{"field": "setupCost", "add": 10000, "note": "panel and feeder upgrade inside the building, estimate"},
         {"field": "openingDelayDays", "add": 20, "note": "Con Edison load letter review"},
         {"field": "openingDelayDays", "add": 84, "appliesIf": "utility-side upgrade needed", "note": "12 weeks, contractor guides 4-24 weeks"}],
    moves=[{"kind": "lever", "id": "site_due_diligence", "optionId": "load_letter_before_lease", "label": "Electrician's load calculation before signing", "cost": {"cash": 750}, "result": "choose a space with enough power"},
           {"kind": "choice", "id": "lean_kit_power", "label": "Two-group machine, no dishwasher", "cost": {"quality": -0.02}, "result": "fits the existing service"}],
    src="HPD_LOAD", sup=["TRIUMPH", "ESP"], conf="estimate",
    freq="Common in spaces that never had food service",
    note="HPD guidance (opened): Con Edison needs about 20 days to evaluate and confirm available service capacity once the load letter is filed. Utility-side upgrade 4-12 or 12-24 weeks (contractor guides, D02); 84 days = 12 weeks. Panel cost and load calculation price are my estimates."),

"service_upgrade_wait": dict(
    months=ALL, dur=3, mergedWith="electrical_service_too_small",
    trig="decision: ordered an electrical service upgrade",
    eff=[{"field": "openingDelayDays", "add": 84}, {"field": "setupRentDays", "add": 84, "appliesIf": "before opening, free months used", "note": "$16,800"}],
    moves=[{"kind": "lever", "id": "site_due_diligence", "optionId": "load_letter_before_lease", "label": "Check the load first", "cost": {"cash": 750}, "result": "avoid"}],
    src="HPD_LOAD", sup=["TRIUMPH"], conf="estimate", freq="See electrical_service_too_small", note="D02 value of 12 weeks kept; HPD's 20-day load letter review is the first part of it."),

"breaker_trips_at_peak": dict(
    months=ALL, dur=1,
    trig="decision: a bigger machine, dishwasher or second fridge added without a new circuit",
    eff=[{"field": "staffAvailability", "mult": 0.95}],
    moves=[{"kind": "setup", "id": "dedicated_espresso_circuit", "label": "Dedicated 30-40 A circuit", "cost": {"cash": 1200}, "result": "event cannot happen"}],
    src="ESP", sup=[], conf="estimate", freq="Not found",
    note="Vendor: a two-group machine wants its own 30 A 208-240 V circuit, a three-group about 40 A (D02). Circuit price is my estimate; 0.95 is D02's game value."),

"utility_deposit_demand": dict(
    months=ALL, dur=12,
    trig="state: new nonresidential account without credit history",
    eff=[{"field": "cash", "add": -1800, "refundable": True, "note": "up to twice average monthly usage: 2 x $900 electricity"}],
    moves=[{"kind": "choice", "id": "pay_in_installments", "label": "Pay in three installments", "cost": {}, "result": "half now, the rest over two months (offered to existing customers)"}],
    src="PART13", sup=[], conf="estimate",
    freq="Common for new businesses",
    note="16 NYCRR §13.7 (regulation text via a mirror, search excerpt): a nonresidential deposit may not exceed twice the customer's average monthly usage. $900 of the pack's $1,100 utilities is electricity: my split. The pack already holds $1,500 in insurance_utility_deposits."),

"d00_premises_utility_deposit": dict(
    months=ALL, dur=12, mergedWith="utility_deposit_demand",
    trig="as utility_deposit_demand",
    eff=[{"field": "cash", "add": -1800, "refundable": True}],
    moves=[{"kind": "choice", "id": "pay_in_installments", "label": "Installments", "cost": {}, "result": "spread over 3 months"}],
    src="PART13", sup=[], conf="estimate", freq="Common", note="Same as utility_deposit_demand."),

"d00_premises_utility_extra": dict(
    months=ALL, dur=0,
    trig="decision: service design beyond the utility's standard (new entry, excess capacity)",
    eff=[{"field": "setupCost", "add": 5000, "note": "estimate"}],
    moves=[{"kind": "choice", "id": "standard_service", "label": "Stay within the existing service", "cost": {}, "result": "no charge"}],
    src="HPD_LOAD", sup=[], conf="estimate", freq="Not measured", note="Estimate; the utility's own charge was not found."),

"d00_premises_meter_not_live": dict(
    months=ALL, dur=1,
    trig="state: wiring complete, electrical sign-off and meter set pending",
    eff=[{"field": "openingDelayDays", "add": 14}],
    moves=[{"kind": "choice", "id": "file_signoff_early", "label": "Electrician files the sign-off the day work ends", "cost": {}, "result": "7 days instead of 14"}],
    src="HPD_LOAD", sup=[], conf="estimate", freq="Common", note="Estimate."),

"d00_premises_backflow_install": dict(
    months=ALL, dur=1,
    trig="state: DEP requires a backflow device for the premises (cross-connection hazard)",
    eff=[{"field": "setupCost", "add": 4000, "note": "engineer's plan, device and licensed plumber, estimate"}, {"field": "permitWaitDays", "add": 30, "note": "DEP plan approval, estimate"}, {"field": "monthlyFees", "add": 13, "note": "annual test about $150, estimate"}],
    moves=[{"kind": "lever", "id": "site_due_diligence", "optionId": "check_backflow", "label": "Ask if the building already has an approved device", "cost": {}, "result": "often already installed in former food spaces"}],
    src="CROSS", sup=[], conf="estimate",
    freq="Food establishments with hazards",
    note="DEP (search excerpt): a PE or RA prepares a backflow plan for DEP approval; initial test reports need the PE/RA stamp and a Licensed Master Plumber seal; an annual test report is due within 12 months; missing tests can bring fines or disconnection. Prices and the approval time were not found: estimates."),

"peak_kw_bill_jump": dict(
    months=ALL, dur=12,
    trig="decision: added load pushes peak demand above the utility's small-customer limit",
    eff=[{"field": "utilities", "mult": 1.1}],
    moves=[{"kind": "choice", "id": "stagger_equipment", "label": "Run the dishwasher outside the morning peak", "cost": {"capacity": 0}, "result": "multiplier 1.0"}],
    src="KW", sup=[], conf="estimate", freq="Not measured", note="D02 value kept: demand charges about $34-$44 per kW (third-party summary); threshold not confirmed."),
}
