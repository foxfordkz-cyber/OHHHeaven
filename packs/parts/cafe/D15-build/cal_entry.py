from common import ALL

S_HC5 = ("https://www.nyc.gov/assets/doh/downloads/pdf/about/healthcode/health-code-article5.pdf", "NYC Health Code Article 5 (permits; change of ownership)", "estimate")
S_DOLTR = ("https://dol.ny.gov/transfers-business-and-your-contribution-rate", "NYS DOL, transfers of business and your contribution rate", "estimate")
S_SOP = ("https://www.whitefordlaw.com/news-events/client-alert-sba-issues-sop-50-10-8-key-changes-impacting-sba-7a-lending", "Whiteford, SBA SOP 50 10 8 key changes (equity injection)", "estimate")
S_WEBST = ("https://www.webstaurantstore.com/espresso-machine-2gr-appi/238APLCV2.html", "WebstaurantStore, two-group espresso machine price", "estimate")
S_GREG = ("https://dailycoffeenews.com/2026/02/18/backed-by-craveworthy-gregorys-coffee-launches-franchising", "Daily Coffee News, Gregorys Coffee launches franchising, February 2026", "estimate")
S_CITYREC = ("https://a856-cityrecord.nyc.gov/RequestDetail/20240628149", "City Record, Parks concession award for a park cafe (2024)", "estimate")
S_SMORG = ("https://www.6sqft.com/smorgasburg-returns-for-16th-year-this-april-with-new-vendors/", "6sqft, Smorgasburg season", "estimate")
S_SHARED = ("https://nyc-business.nyc.gov/nycbusiness/description/shared-kitchens/about", "NYC Business, shared kitchens", "estimate")
S_INCUB = ("https://thecounter.org/major-food-incubator-closes-suddenly-leaves-175-companies-kitchenless/", "The Counter, food incubator closes suddenly", "estimate")
S_GCM = ("https://www.amny.com/transit/mta-master-vendor-grand-central-madison-retail", "amNY, MTA retail at Grand Central Madison", "estimate")
S_QE = ("https://queenseagle.com/all/2025/4/18/roosevelt-ave-crackdown-pushes-street-vendors-toward-pricey-black-market-permits", "Queens Eagle, black-market vending permits (2025)", "estimate")
S_BIZBEN = ("https://blog.bizben.com/how-to-buy-a-coffee-shop-5-red-flags-you-must-avoid/", "BizBen, red flags when buying a coffee shop", "estimate")
S_PUBLIC = ("https://robinpzander.com/lessons-learned-building-and-selling-robins-cafe/", "Robin Zander, lessons from selling a cafe", "estimate")
EXTRA_SOURCES = {"HC5": S_HC5, "DOLTR": S_DOLTR, "SOP": S_SOP, "WEBST": S_WEBST, "GREG": S_GREG, "CITYREC": S_CITYREC, "SMORG": S_SMORG, "SHARED": S_SHARED, "INCUB": S_INCUB, "GCM": S_GCM, "QE": S_QE, "BIZBEN": S_BIZBEN, "PUBLIC": S_PUBLIC}

BULK = ("Tax Law §1141(c) (opened): the buyer must notify the Tax Department at least 10 days before taking possession or paying; within 90 days of the notice the "
        "Department names the seller's tax; until then the buyer must withhold that amount; a buyer who does not notify is personally liable for the seller's sales tax up to "
        "the price or fair market value of the assets. TB-ST-70 (search excerpt): the Department answers within five business days with a release (AU-197.1) or a notice of claim (AU-196.2).")
PRICE = ("BizBuySell coffee shops and cafes (search excerpt): median sale price $150,000 on median owner earnings of $78,780; average earnings multiple 2.20x and revenue multiple 0.46x; "
         "median sale price $176,500 in 2025. D14 uses 2.0 x earnings with an ask at price/0.9.")

CAL = {
"takeover_listing": dict(
    months=ALL, dur=1,
    trig="state: a place with forSale on the map (keen-cray) or a resident's shop offered for sale",
    eff=[{"field": "askingPrice", "formula": "2.2 x yearly owner earnings, floor 0.5 x replacement cost, cap 0.57 x yearly sales", "note": "reference shop: 2.2 x $116,654 = $256,600; ask $285,000"},
         {"field": "awareness", "set": 0.7, "appliesIf": "name kept"}, {"field": "openingDelayDays", "add": 30, "note": "closing on the later of the bulk-sale notice (10), own Health permit (22) and landlord consent (30)"}],
    moves=[{"kind": "lever", "id": "takeover_due_diligence", "optionId": "full_review", "label": "Financial and legal review", "cost": {"cash": 7500}, "result": "overstated sales, liens and tax claims found before closing"},
           {"kind": "lever", "id": "takeover_terms", "optionId": "seller_note", "label": "Seller finances up to half", "cost": {"monthly": 2362, "months": 60}, "result": "$116,500 at 8% over 60 months (D14)"},
           {"kind": "choice", "id": "build_instead", "label": "Lease an empty space and build", "cost": {"see": "free_rent_runs_out"}, "result": "cheaper, 50-200 days later"}],
    src="BIZBUY", sup=["TAX1141", "FSE", "STARTLAND"], conf="estimate",
    freq="BizBuySell lists cafes for sale in NYC every week",
    note=PRICE + " I take 2.2 (BizBuySell's average) for the asking side and keep D14's acceptance at 90% of ask: 0.9 x $285,000 = $256,500 = 2.2 x earnings. 7 in 10 regulars kept: SBDC adviser (secondary). " + BULK),

"sellers_tax_claim": dict(
    months=ALL, dur=3, appliesTo=["takeover"],
    trig="attribute: seller owes sales tax at the time of the bulk-sale notice",
    eff=[{"field": "escrowHeld", "add": 13578, "durationDays": 90, "note": "one quarter of the seller's sales tax: 3 x $4,526"}, {"field": "closingDelayDays", "add": 0, "note": "closing can proceed if the claimed amount stays in escrow"}],
    moves=[{"kind": "lever", "id": "takeover_due_diligence", "optionId": "full_review", "label": "Ask for the seller's filed returns", "cost": {"cash": 7500}, "result": "amount known; price adjusted"},
           {"kind": "shortcut", "id": "skip_bulk_sale_notice", "label": "Skip the notice", "cost": {"riskLiability": 13578}, "result": "see sellers_tax_debt_inherited"}],
    src="TAX1141", sup=["BULK_TB"], conf="verified", freq="Steady docket at the Division of Tax Appeals (D01)",
    note=BULK + " The seller's quarter of $13,578 = 3 months of the reference shop's collected sales tax ($4,526): my assumption of what an owner in trouble falls behind."),

"bulk_sale_claim": dict(
    months=ALL, dur=3, mergedWith="sellers_tax_claim", appliesTo=["takeover"],
    trig="as sellers_tax_claim", eff=[{"field": "escrowHeld", "add": 13578, "durationDays": 90}],
    moves=[{"kind": "lever", "id": "takeover_due_diligence", "optionId": "full_review", "label": "Review", "cost": {"cash": 7500}, "result": "priced in"}],
    src="TAX1141", sup=["BULK_TB"], conf="verified", freq="See sellers_tax_claim", note="D14 duplicate. " + BULK),

"d00_premises_seller_tax_claim": dict(
    months=ALL, dur=3, mergedWith="sellers_tax_claim", appliesTo=["takeover"],
    trig="as sellers_tax_claim", eff=[{"field": "escrowHeld", "add": 13578, "durationDays": 90}],
    moves=[{"kind": "lever", "id": "takeover_due_diligence", "optionId": "full_review", "label": "Review", "cost": {"cash": 7500}, "result": "priced in"}],
    src="TAX1141", sup=["BULK_TB"], conf="verified", freq="See sellers_tax_claim", note="D00 duplicate. " + BULK),

"sellers_tax_debt_inherited": dict(
    months=ALL, dur=1, appliesTo=["takeover"],
    trig="decision: shortcut skip_bulk_sale_notice; the seller owed sales tax",
    eff=[{"field": "liability", "add": 13578, "note": "seller's unpaid quarter"}, {"field": "liability", "mult": 1.145, "note": "plus interest at 14.5% a year or more for a year, plus penalties"}],
    moves=[{"kind": "choice", "id": "file_au196_10", "label": "File Form AU-196.10 ten days ahead", "cost": {"cash": 0, "days": 10}, "result": "no personal liability"}],
    src="TAX1141", sup=["TAX1145"], conf="verified", freq="See sellers_tax_claim",
    note=BULK + " Tax Law §1145 (opened): interest at 14.5% a year or the commissioner's rate, whichever is greater. Liability is capped at the price paid."),

"seller_tax_debt_surfaces": dict(
    months=ALL, dur=1, mergedWith="sellers_tax_debt_inherited", appliesTo=["takeover"],
    trig="as sellers_tax_debt_inherited", eff=[{"field": "liability", "add": 13578}],
    moves=[{"kind": "choice", "id": "file_au196_10", "label": "File the notice", "cost": {"days": 10}, "result": "no liability"}],
    src="TAX1141", sup=[], conf="verified", freq="See sellers_tax_claim", note="D14 duplicate."),

"overstated_cash_sales": dict(
    months=ALL, dur=12, appliesTo=["takeover"],
    trig="attribute: listing earnings above the seller's tax returns",
    eff=[{"field": "demand", "mult": 0.8, "note": "real sales vs the story"}, {"field": "overpaid", "add": 46600, "note": "20% of a $233,000 price set on overstated earnings"}],
    moves=[{"kind": "lever", "id": "takeover_due_diligence", "optionId": "full_review", "label": "Price on the tax returns, not the story", "cost": {"cash": 7500}, "result": "price 20% lower"}],
    src="BIZBEN", sup=["BIZBUY"], conf="estimate", freq="The most named red flag in cafe sales", note="D01 values kept."),

"d00_world_event_seller_addbacks_unverified": dict(
    months=ALL, dur=12, mergedWith="overstated_cash_sales", appliesTo=["takeover"],
    trig="attribute: seller's earnings add back costs the buyer will still pay",
    eff=[{"field": "ownerEarnings", "mult": 0.85, "note": "estimate"}],
    moves=[{"kind": "lever", "id": "takeover_due_diligence", "optionId": "full_review", "label": "Recast the add-backs", "cost": {"cash": 7500}, "result": "price on true earnings"}],
    src="BIZBUY", sup=["BIZBEN"], conf="estimate", freq="Common", note="Estimate: 15% of claimed earnings are add-backs that continue."),

"equipment_lien_surprise": dict(
    months=ALL, dur=1, appliesTo=["takeover"],
    trig="attribute: seller's machines financed or leased",
    eff=[{"field": "cash", "add": -6000}],
    moves=[{"kind": "lever", "id": "takeover_due_diligence", "optionId": "full_review", "label": "Lien search on the seller", "cost": {"cash": 7500}, "result": "payoff deducted from the price"}],
    src="BIZBEN", sup=[], conf="estimate", freq="Common in equipment-heavy sales", note="D01 value kept."),

"permit_gap_at_closing": dict(
    months=ALL, dur=1, appliesTo=["takeover"],
    trig="decision: buyer applies for the Health permit on closing day",
    eff=[{"field": "closureDays", "add": 22, "note": "22 x $1,200 contribution = $26,400 lost while rent runs"}],
    moves=[{"kind": "choice", "id": "apply_before_closing", "label": "Apply 22 days before closing", "cost": {"cash": 280}, "result": "open on the day you take over"}],
    src="FSE", sup=["HC5"], conf="verified", freq="Every takeover where the buyer waits",
    note="NYC Business (opened): you can open 22 days after you submit the application; fee $280. The permit does not pass to a buyer (Health Code Article 5, read by D01 in an extract)."),

"d00_premises_permit_transfer": dict(
    months=ALL, dur=1, mergedWith="permit_gap_at_closing", appliesTo=["takeover"],
    trig="as permit_gap_at_closing", eff=[{"field": "closureDays", "add": 22}],
    moves=[{"kind": "choice", "id": "apply_before_closing", "label": "Apply early", "cost": {"cash": 280}, "result": "no gap"}],
    src="FSE", sup=["HC5"], conf="verified", freq="Every takeover", note="Same as permit_gap_at_closing."),

"sellers_unpaid_health_fines": dict(
    months=ALL, dur=1, appliesTo=["takeover"],
    trig="attribute: seller has unpaid Health Department penalties",
    eff=[{"field": "permitWaitDays", "add": 14}],
    moves=[{"kind": "choice", "id": "prove_arms_length", "label": "Show the arm's-length purchase contract", "cost": {}, "result": "permit issued"}, {"kind": "choice", "id": "pay_from_price", "label": "Seller pays from the price", "cost": {}, "result": "no hold"}],
    src="HC5", sup=["FSE"], conf="estimate", freq="Not measured",
    note="NYC Business (opened): pay all outstanding Health Code fines before you apply for a permit. Health Code Article 5 (D01, extract): no new permit on a change of ownership with unpaid penalties unless the sale is at arm's length. 14 days is D01's estimate."),

"inherited_unemployment_rate": dict(
    months=[1], dur=12, appliesTo=["takeover"],
    trig="decision: buyer keeps substantially the same staff and the goodwill",
    eff=[{"field": "payrollTax", "add": 0.02, "base": "first $17,600 of each worker's wages", "note": "about $350 a worker a year"}],
    moves=[{"kind": "choice", "id": "new_staff", "label": "Hire new staff instead", "cost": {"hiringPerWorker": 1000}, "result": "new-employer rate; but the regulars lose familiar faces"}],
    src="LAB581", sup=["DOLTR"], conf="estimate", freq="Every acquisition of a going business",
    note="Labor Law §581(4) (opened): no transfer of experience only if the buyer took none of the obligations, none of the goodwill, did not continue the business and did not employ substantially the same workers. +2 points is D01's design value."),

"inherited_sick_leave_balances": dict(
    months=ALL, dur=12, appliesTo=["takeover"],
    trig="decision: buyer keeps the seller's workers",
    eff=[{"field": "liability", "add": 2720, "note": "4 baristas x 40 hours x $17"}],
    moves=[{"kind": "lever", "id": "takeover_terms", "optionId": "credit_for_accruals", "label": "Deduct accrued sick time from the price", "cost": {}, "result": "seller pays for it"}],
    src="ESSTA_SUCC", sup=[], conf="estimate", freq="Every takeover with kept staff",
    note="NYC final rule, October 2023 (law firm summary): balances are not affected by a sale; original and successor employers are jointly liable. 40 hours is the cap for employers with 99 or fewer workers (pack)."),

"regulars_test_new_owner": dict(
    months=ALL, dur=3, appliesTo=["takeover"],
    trig="decision: takeover closes",
    eff=[{"field": "awareness", "set": 0.7, "note": "keep the name; regrows on the pack's 75-day ramp"}],
    moves=[{"kind": "lever", "id": "takeover_transition", "optionId": "seller_stays_two_weeks", "label": "Seller works the bar for two weeks", "cost": {"cash": 2000}, "result": "awareness 0.8 instead of 0.7, estimate"},
           {"kind": "choice", "id": "keep_staff", "label": "Keep the baristas", "cost": {"see": "inherited_sick_leave_balances"}, "result": "familiar faces"}],
    src="STARTLAND", sup=["BIZBUY"], conf="estimate", freq="Every change of owner",
    note="SBDC adviser (Startland News 2024, secondary): about 30% of a small business's customers do not come back after a change of owner. Seller-stays option is my estimate."),

"rebrand_loses_regulars": dict(
    months=ALL, dur=3, appliesTo=["takeover"],
    trig="decision: takeover with a new name",
    eff=[{"field": "awareness", "set": 0.35}, {"field": "setupCost", "add": 5000, "note": "new sign, menus, cups"}],
    moves=[{"kind": "choice", "id": "keep_name", "label": "Keep the name for a year", "cost": {}, "result": "awareness 0.7"}],
    src="STARTLAND", sup=[], conf="estimate", freq="When buyers rebrand", note="D14 values kept."),

"d00_world_event_predecessor_brand_confusion": dict(
    months=ALL, dur=3, appliesTo=["takeover"],
    trig="decision: rebrand while old listings and signage remain",
    eff=[{"field": "reputation", "add": -0.02, "note": "reviews of the old shop land on you"}],
    moves=[{"kind": "choice", "id": "update_listings", "label": "Update map listings on day one", "cost": {"cash": 0}, "result": "no confusion"}],
    src="STARTLAND", sup=[], conf="estimate", freq="Rebrands", note="Estimate."),

"old_equipment_gives_out": dict(
    months=ALL, dur=1, appliesTo=["takeover"],
    trig="state: bought machine reaches its lifespan (84 months for the two-group machine)",
    eff=[{"field": "cash", "add": -7600}, {"field": "closureDays", "add": 2}],
    moves=[{"kind": "lever", "id": "takeover_due_diligence", "optionId": "full_review", "label": "Price the machine's age", "cost": {"cash": 7500}, "result": "price reduced by the remaining-life share"}],
    src="WEBST", sup=[], conf="estimate", freq="Common", note="D01 values (pack prices)."),

"equity_injection_gap": dict(
    months=ALL, dur=0, appliesTo=["takeover"],
    trig="decision: finance a purchase with an SBA 7(a) loan",
    eff=[{"field": "minOwnCashShare", "add": 0.1, "note": "$30,000 of own cash on a $300,000 project"}],
    moves=[{"kind": "lever", "id": "takeover_terms", "optionId": "seller_note_standby", "label": "Seller note on full standby", "cost": {}, "result": "covers at most half of the 10%"}],
    src="SOP", sup=[], conf="estimate", freq="Every SBA acquisition loan", note="D01 values; SOP 50 10 8 via law firm."),

"acquisition_tax_at_closing": dict(
    months=ALL, dur=0, appliesTo=["takeover"],
    trig="decision: takeover closes",
    eff=[{"field": "cash", "add": -3550, "note": "8.875% x $40,000 allocated to furniture, fixtures and equipment"}],
    moves=[{"kind": "lever", "id": "takeover_terms", "optionId": "price_allocation", "label": "Allocate the price with the accountant", "cost": {"cash": 500}, "result": "fair allocation; goodwill and the lease are not taxed"}],
    src="AU19610", sup=["BULK_TB"], conf="estimate", freq="Every asset purchase",
    note="Form AU-196.10 and TB-ST-70 (search excerpts): the buyer in a bulk sale pays sales tax on tangible personal property acquired (furniture, fixtures, supplies). Allocation of $40,000 is D01's assumption."),

"d00_premises_takeover_asset_list": dict(
    months=ALL, dur=1, appliesTo=["takeover"],
    trig="attribute: seller offers selected assets, not the whole working shop",
    eff=[{"field": "setupCost", "add": 8000, "note": "missing grinder, fridge and smallwares at pack prices, estimate"}, {"field": "openingDelayDays", "add": 7}],
    moves=[{"kind": "lever", "id": "takeover_due_diligence", "optionId": "full_review", "label": "Itemized asset list in the contract", "cost": {"cash": 7500}, "result": "price reduced by what is missing"}],
    src="PUBLIC", sup=["BIZBUY"], conf="estimate", freq="Common", note="Grinder $2,099 + refrigeration $2,628 + smallwares $2,000 + delivery = about $8,000 (pack)."),

"buyer_makes_an_offer": dict(
    months=ALL, dur=1,
    trig="state: six profitable months in a row",
    eff=[{"field": "salePrice", "formula": "2.2 x owner earnings of the last 12 months", "note": "sale at 90% of ask: 2.0 x"}],
    moves=[{"kind": "choice", "id": "accept", "label": "Sell", "cost": {"see": "landlord_blocks_the_sale"}, "result": "cash minus the lease consent costs"}, {"kind": "choice", "id": "decline", "label": "Keep running", "cost": {}, "result": "no change"}],
    src="BIZBUY", sup=[], conf="estimate", freq="Brokers call successful shops", note=PRICE),

"franchise_cooling_off": dict(
    months=ALL, dur=1,
    trig="decision: entry_mode = franchise",
    eff=[{"field": "leaseSigningDelayDays", "add": 14, "note": "federal 14 calendar days; New York: at the first personal meeting or 10 business days before signing, whichever is earlier"}],
    moves=[{"kind": "choice", "id": "read_fdd", "label": "Use the days to call existing franchisees", "cost": {}, "result": "fewer surprises (see young_franchise_system)"}],
    src="GBL683", sup=[], conf="verified", freq="Every franchise purchase",
    note="GBL §683(8) (opened): a franchise subject to registration may not be sold without the prospectus delivered at the earlier of the first personal meeting, ten business days before a binding agreement, or ten days before any payment. The federal rule's 14 days (D01) applies alongside."),

"franchise_royalty_bite": dict(
    months=ALL, dur=12,
    trig="decision: entry_mode = franchise",
    eff=[{"field": "revenueShare", "mult": 0.92, "note": "6% royalty + 2% marketing fund"}],
    moves=[{"kind": "choice", "id": "independent", "label": "Stay independent", "cost": {"awareness": "start at 0.35"}, "result": "keep all sales"}],
    src="FDD_SCOOT", sup=["FDD_DUNN"], conf="estimate", freq="Every franchise",
    note="2026 coffee franchise disclosures (aggregators): royalties 3-8% (Scooter's 6%, Biggby 6%, Dunn Brothers 5%), marketing funds 1-3% (Dunn Brothers 3% + 1%, PJ's 2%). 6% + 2% = 8% of sales = $4,080 a month on the reference shop."),

"franchise_buildout_not_yours": dict(
    months=ALL, dur=0,
    trig="decision: entry_mode = franchise",
    eff=[{"field": "setupCost", "mult": 2.05}],
    moves=[{"kind": "choice", "id": "independent", "label": "Stay independent", "cost": {}, "result": "lean kit allowed"}],
    src="GREG", sup=[], conf="estimate", freq="Every franchise", note="D01: lowest disclosed Gregorys investment $459,150 / the pack's $224,000 = 2.05."),

"young_franchise_system": dict(
    months=ALL, dur=12,
    trig="attribute: franchisor with no operating franchisees",
    eff=[{"field": "awareness", "mult": 0.9}],
    moves=[{"kind": "choice", "id": "established_brand", "label": "Choose an older system", "cost": {}, "result": "references to call"}],
    src="GREG", sup=[], conf="estimate", freq="New systems", note="D01 design value."),

"supervisory_licenses_released": dict(
    months=[7], dur=12, scale="city",
    trig="schedule: July 1 each year 2026-2030",
    eff=[{"field": "cartPermitWaitMonths", "add": -12}],
    moves=[{"kind": "choice", "id": "join_waiting_list", "label": "Get a vendor license and join the list", "cost": {"cash": 50}, "result": "place in line"},
           {"kind": "shortcut", "id": "rent_a_permit", "label": "Rent someone's permit", "cost": {"monthly": 1000}, "result": "illegal; see permit_holder_takes_back_permit"}],
    src="DOHMH_MFV", sup=[], conf="verified", freq="Yearly, July 1",
    note="DOHMH (opened): beginning July 1, 2026, 2,200 new supervisory licenses each year for 5 years (Local Laws 54 and 59 of 2026); applications go first to people on the waiting lists created in 2022. License fee $50 and permit rent are estimates."),

"commissary_has_no_room": dict(
    months=ALL, dur=1,
    trig="decision: entry_mode = cart",
    eff=[{"field": "permitWaitDays", "add": 30}, {"field": "monthlyFees", "add": 300}],
    moves=[{"kind": "choice", "id": "farther_commissary", "label": "Take a depot farther away", "cost": {"monthly": 300}, "result": "permit proceeds"}],
    src="DOHMH_MFV", sup=[], conf="estimate", freq="Common in busy districts",
    note="DOHMH (opened): a permitted cart or truck must be cleaned, serviced and stored at an approved commissary or depot and returned at least once a day. Fees are D01's design values."),

"commissary_rent_hike": dict(
    months=ALL, dur=12,
    trig="announced: depot raises fees",
    eff=[{"field": "monthlyFees", "mult": 1.33}],
    moves=[{"kind": "choice", "id": "switch_depot", "label": "Move to another depot", "cost": {"days": 7}, "result": "old fee"}],
    src="DOHMH_MFV", sup=[], conf="estimate", freq="Not measured", note="D13 value; requirement verified at DOHMH."),

"market_season_ends": dict(
    months=[11, 12, 1, 2, 3], dur=5,
    trig="calendar: outdoor market season ends in late fall",
    eff=[{"field": "demand", "mult": 0.0, "appliesTo": "market stall only"}],
    moves=[{"kind": "choice", "id": "holiday_market", "label": "Holiday market stall in Nov-Dec", "cost": {"monthly": 3000}, "result": "trades two more months, estimate"},
           {"kind": "choice", "id": "shop_in_shop", "label": "Winter corner in a host shop", "cost": {"see": "host_ends_the_arrangement"}, "result": "all year"}],
    src="SMORG", sup=[], conf="estimate", freq="Every year", note="D01: April opening reported; the closing month is my estimate."),

"host_ends_the_arrangement": dict(
    months=ALL, dur=1,
    trig="schedule: end of the shop-in-shop agreement",
    eff=[{"field": "closureDays", "add": 30}, {"field": "awareness", "mult": 0.7}],
    moves=[{"kind": "lever", "id": "lease_negotiation", "optionId": "renewal_right", "label": "Renewal right in the agreement", "cost": {}, "result": "stays"}],
    src="SHARED", sup=[], conf="estimate", freq="Common", note="D01 design values."),

"parks_kiosk_rfp": dict(
    months=[5, 6], dur=2,
    trig="announced: Parks request for proposals",
    eff=[{"field": "rent", "add": 3333, "note": "greater of $40,000 a year or 4% of gross (2024 award)"}],
    moves=[{"kind": "choice", "id": "bid", "label": "Bid", "cost": {"cash": 1500}, "result": "license if won"}],
    src="CITYREC", sup=[], conf="estimate", freq="Occasional", note="D01 numbers (City Record page opened by D01)."),

"shared_kitchen_lockout": dict(
    months=ALL, dur=1,
    trig="announced a month ahead: the shared kitchen's operator misses payments",
    eff=[{"field": "demand", "mult": 0.3}],
    moves=[{"kind": "choice", "id": "second_kitchen", "label": "Line up a backup kitchen", "cost": {"monthly": 200}, "result": "demand 0.9"}],
    src="INCUB", sup=[], conf="estimate", freq="Rare", note="D13 value."),

"transit_stall_rfp": dict(
    months=ALL, dur=1,
    trig="announced: MTA stall RFP",
    eff=[{"field": "rent", "formula": "15% of gross sales", "note": "2025 one-year Grand Central Madison license"}],
    moves=[{"kind": "choice", "id": "bid", "label": "Bid", "cost": {"cash": 1000}, "result": "license if won"}],
    src="GCM", sup=[], conf="estimate", freq="Occasional", note="D13 value."),

"permit_holder_takes_back_permit": dict(
    months=ALL, dur=1,
    trig="decision: shortcut rent_a_permit; the holder ends it",
    eff=[{"field": "demand", "mult": 0.0}],
    moves=[{"kind": "choice", "id": "own_license", "label": "Wait for your own supervisory license", "cost": {}, "result": "legal"}],
    src="QE", sup=["DOHMH_MFV"], conf="estimate", freq="Common in the black market", note="D13 value."),

"d00_world_event_planned_pop_up_end": dict(
    months=ALL, dur=1,
    trig="schedule: end of a fixed-term pop-up",
    eff=[{"field": "closureDays", "add": 30}],
    moves=[{"kind": "choice", "id": "extend_early", "label": "Negotiate the extension two months ahead", "cost": {"rentMult": 1.1}, "result": "stays open"}],
    src="SBS_LEASE", sup=[], conf="estimate", freq="Every pop-up", note="Estimate."),
}
