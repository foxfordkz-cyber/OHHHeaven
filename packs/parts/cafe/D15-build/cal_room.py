from common import ALL

S_DELI = ("https://business.columbia.edu/sites/default/files-efs/pubfiles/4642/deli_paper%200523_2011-%20post.pdf", "Lu, Musalem, Olivares, Schilkrut: measuring the effect of queues on customer purchases (deli counter)", "estimate")
S_NPR = ("https://www.npr.org/blogs/alltechconsidered/2014/04/10/300518819/no-laptops-no-wi-fi-how-one-cafe-fired-up-sales", "NPR 2014, cafe without laptops", "estimate")
S_BLOOM = ("https://bloomintelligence.com/coffee-shop-marketing/", "Bloom Intelligence, Wi-Fi dwell times at US coffee shops 2026", "estimate")
S_ADA = ("https://www.ada.gov/law-and-regs/design-standards/2010-stds/", "2010 ADA Standards for Accessible Design", "estimate")
S_KATZ = ("https://www.audacy.com/1010wins/news/local/katzs-deli-settles-americans-with-disabilities-act-lawsuit", "1010 WINS, Katz's Deli ADA settlement with a $20,000 penalty", "estimate")
S_HC81 = ("https://www.nyc.gov/assets/doh/downloads/pdf/about/healthcode/health-code-article81.pdf", "NYC Health Code Article 81 (food preparation and food establishments)", "estimate")
S_TPA = ("https://nyc-business.nyc.gov/nycbusiness/description/temporary-place-of-assembly-certificate-of-operation", "NYC Business, temporary Place of Assembly certificate", "estimate")
S_VEST = ("https://portal.311.nyc.gov/article/?kanumber=KA-02227", "NYC311, sidewalk storm enclosures", "estimate")
S_AIRCUR = ("https://achrnews.com/articles/159663-michigan-eatery-eliminates-cold-complaints-with-air-curtains", "ACHR News, air curtains end cold-draft complaints", "estimate")
S_DEPHOSP = ("https://www.nyc.gov/assets/dep/downloads/pdf/air/hospitality-industry-guide-environmental-compliance.pdf", "DEP, hospitality industry guide to environmental compliance", "estimate")
S_ODOR = ("https://portal.311.nyc.gov/article/?kanumber=KA-02313", "NYC311, odor complaints", "estimate")
S_FDNY_EXIT = ("https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-144597", "NYC Fire Code, means of egress maintenance", "estimate")
S_YAFFA = ("https://www.dnainfo.com/new-york/20141006/east-village/city-waited-3-decades-rule-yaffa-cafes-back-patio-illegal-manager-says", "DNAinfo, East Village cafe back patio ruled illegal", "estimate")
S_SHED = ("https://www.nyc.gov/site/buildings/safety/sidewalk-sheds.page", "DOB, sidewalk sheds", "estimate")
S_NYCHA = ("https://www.nyc.gov/site/nycha/business/store-leasing.page", "NYCHA store leasing", "estimate")
S_HOSPNET = ("https://www.hospitalitynet.org/news/4039649.html", "Hospitality Net, table spacing and diner satisfaction", "estimate")
S_WATER = ("https://www.lehighvalleypublicmedia.org/news/parkland-east-penn/a-bit-overwhelming-nowhere-coffee-co-temporarily-closed-in-emmaus-following-heavy-losses-from-water-damage/", "Lehigh Valley Public Media, cafe closed by water damage", "estimate")
EXTRA_SOURCES = {"DELI": S_DELI, "NPR": S_NPR, "BLOOM": S_BLOOM, "ADA": S_ADA, "KATZ": S_KATZ, "HC81": S_HC81, "TPA": S_TPA, "VEST": S_VEST, "AIRCUR": S_AIRCUR, "DEPHOSP": S_DEPHOSP, "ODOR": S_ODOR, "FDNY_EXIT": S_FDNY_EXIT, "YAFFA": S_YAFFA, "SHED": S_SHED, "NYCHA": S_NYCHA, "HOSPNET": S_HOSPNET, "WATER": S_WATER}

QUEUE = ("Queue response (D06 from Lu et al., paper opened by D06): up to 5 people in line nobody leaves; 6-10 people cost like a 3.2% price rise, 10-15 like 8.3% more; "
         "D06 turns it into 10% of arrivals walking away at 6-10 people ahead and 30% at 11-15. One barista pours about 25 orders an hour at the bar.")

CAL = {
"saturday_room_full": dict(
    months=ALL, dur=1,
    trig="state: seated orders above 85% of seat capacity in the month (weekend mornings first)",
    eff=[{"field": "demand", "mult": 0.95, "note": "people who would have taken it to go leave at the sight of a full room"}, {"field": "quality", "add": -0.03}],
    moves=[{"kind": "lever", "id": "seating_layout", "optionId": "more_twos", "label": "Swap four-tops for two-tops", "cost": {"cash": 400}, "result": "effective seats x 1.15 (D02)"},
           {"kind": "lever", "id": "laptop_policy", "optionId": "weekend_no_laptops", "label": "No laptops on weekends", "cost": {"reputation": -0.01}, "result": "turns x 1.2 at peak"}],
    src="NPR", sup=["DELI"], conf="estimate", freq="Every busy shop on weekends",
    note="D02 game values kept; the owner quote (NPR) is qualitative. 85% utilization is D02's trigger."),

"laptop_camp": dict(
    months=[1, 2, 3, 10, 11, 12], dur=1,
    trig="state: laptop policy 'open' and seat utilization above 70%",
    eff=[{"field": "seatTurns", "mult": 0.85}],
    moves=[{"kind": "lever", "id": "laptop_policy", "optionId": "peak_limits", "label": "No laptops 8-11 am and 12-2 pm", "cost": {"reputation": -0.01}, "result": "turns back to 1.0 at peak"},
           {"kind": "lever", "id": "laptop_policy", "optionId": "minimum_spend", "label": "One order per 90 minutes", "cost": {}, "result": "turns x 0.95 and ticket +$1"}],
    src="BLOOM", sup=["NPR"], conf="estimate",
    freq="Cold months; Wi-Fi data 2026: one-time visitors stay 32 minutes, the most frequent nearly two hours",
    note="D02 values kept."),

"solo_guests_hold_big_tables": dict(
    months=ALL, dur=1,
    trig="state: table mix mostly four-tops and solo guests above half",
    eff=[{"field": "seats", "mult": 0.75}],
    moves=[{"kind": "lever", "id": "seating_layout", "optionId": "bar_rail", "label": "Window bar rail for solo guests", "cost": {"cash": 1200}, "result": "seats x 1.0"}],
    src="BLOOM", sup=[], conf="estimate", freq="Daily in many shops", note="D02 value; rail cost is my estimate."),

"tight_tables_reviews": dict(
    months=ALL, dur=3,
    trig="decision: size set above the room's comfortable count (sq ft per seat below 15)",
    eff=[{"field": "reputation", "add": -0.03}],
    moves=[{"kind": "choice", "id": "fewer_seats", "label": "Take out two tables", "cost": {"seats": -4}, "result": "no effect"}],
    src="HOSPNET", sup=[], conf="estimate", freq="Packed rooms", note="D02 game value."),

"quiet_room_afternoons": dict(
    months=ALL, dur=1,
    trig="state: afternoon utilization under 15%",
    eff=[{"field": "demand", "mult": 0.98}],
    moves=[{"kind": "lever", "id": "laptop_policy", "optionId": "open", "label": "Invite remote workers in the afternoon", "cost": {}, "result": "room looks alive"}],
    src="HOSPNET", sup=[], conf="estimate", freq="Oversized rooms", note="D02 value."),

"morning_line_out_the_door": dict(
    months=ALL, dur=1,
    trig="state: morning peak demand above bar capacity (25 orders an hour per bar barista) so the line passes 6 people",
    eff=[{"field": "demand", "mult": 0.95, "note": "share of the morning peak lost"}],
    moves=[{"kind": "staff", "id": "barista", "label": "Add a second barista 7-10 am", "cost": {"monthly": 1530, "note": "3 h x 30 days x $17"}, "result": "bar capacity doubles at peak"},
           {"kind": "lever", "id": "order_ahead", "optionId": "on", "label": "Order-ahead app", "cost": {"pctRevenue": 0.03}, "result": "part of the line leaves the room"}],
    src="DELI", sup=[], conf="estimate", freq="Every busy morning", note=QUEUE + " D02's 0.95 is consistent with the 6-10 band."),

"line_out_the_door": dict(
    months=ALL, dur=1, mergedWith="morning_line_out_the_door",
    trig="state: line longer than 10 people",
    eff=[{"field": "demand", "mult": 0.9, "note": "30% of arrivals at the peak walk away; peak is about a third of the day"}],
    moves=[{"kind": "staff", "id": "barista", "label": "Second barista at peak", "cost": {"monthly": 1530}, "result": "line under 6"}],
    src="DELI", sup=[], conf="estimate", freq="Busy blocks", note=QUEUE + " 30% x one third of daily orders = 10%."),

"no_seat_left": dict(
    months=ALL, dur=1, mergedWith="saturday_room_full",
    trig="state: seats full and laptop share above half",
    eff=[{"field": "demand", "mult": 0.95}],
    moves=[{"kind": "lever", "id": "laptop_policy", "optionId": "peak_limits", "label": "Peak-hour laptop limit", "cost": {"reputation": -0.01}, "result": "seats free up"}],
    src="BLOOM", sup=[], conf="estimate", freq="See saturday_room_full", note="D14 duplicate."),

"seat_count_at_inspection": dict(
    months=ALL, dur=1,
    trig="state: seats indoor + outdoor >= 20 and no customer toilet",
    eff=[{"field": "fine", "add": 300, "unit": "each inspection"}, {"field": "inspectionPoints", "add": 10}],
    moves=[{"kind": "choice", "id": "stay_at_19_seats", "label": "Remove seats to 19", "cost": {"seats": -1}, "result": "no violation"},
           {"kind": "setup", "id": "customer_restroom", "label": "Build the toilet", "cost": {"cash": 12000}, "result": "seats allowed"}],
    src="HC81", sup=[], conf="estimate", freq="At every inspection while it lasts",
    note="D02 (page opened by D02): Health Code §81.22(b), customer toilet at 20 or more seats; code 5E, $300 and 10 points. Not reopened here."),

"permit_ready_after_buildout": dict(
    months=ALL, dur=1,
    trig="schedule: Health permit application date + 22 days (application filed when the build-out is finished)",
    eff=[{"field": "openingDelayDays", "add": 22}, {"field": "setupCost", "add": 280}],
    moves=[{"kind": "choice", "id": "apply_at_substantial_completion", "label": "Apply when the room is substantially done", "cost": {}, "result": "permit wait overlaps the last week of work"}],
    src="FSE", sup=[], conf="verified", freq="Every opening",
    note="NYC Business (opened): fee $280 ($25 more for frozen desserts); open 22 days after you apply even without a pre-permit inspection. Correction to the pack: waitDays 21 -> 22."),

"d00_premises_access_route": dict(
    months=ALL, dur=1,
    trig="decision: extra tables narrow the route to the counter or toilet below 36 inches",
    eff=[{"field": "accessExposure", "add": 15000, "note": "demand letter and settlement, estimate"}],
    moves=[{"kind": "lever", "id": "seating_layout", "optionId": "accessible_route", "label": "Keep a 36-inch route", "cost": {"seats": -2}, "result": "no exposure"}],
    src="ADA", sup=["SEYFARTH", "KATZ"], conf="estimate",
    freq="New York had 1,471 federal ADA Title III suits in 2025, third in the country (Seyfarth)",
    note="2010 ADA Standards (D02, page opened by D02): 36-inch clear walking surfaces (32 inches for at most 24 inches of length); 5% of dining spaces accessible. $15,000 is my estimate of a private settlement plus own lawyer; a 2013 federal settlement with Katz's Deli carried a $20,000 civil penalty."),

"aisle_too_narrow": dict(
    months=ALL, dur=1, mergedWith="d00_premises_access_route",
    trig="as d00_premises_access_route",
    eff=[{"field": "accessExposure", "add": 15000}],
    moves=[{"kind": "lever", "id": "seating_layout", "optionId": "accessible_route", "label": "36-inch route", "cost": {"seats": -2}, "result": "no exposure"}],
    src="ADA", sup=["SEYFARTH"], conf="estimate", freq="See d00_premises_access_route", note="D02 duplicate."),

"d00_premises_entrance_step": dict(
    months=ALL, dur=12, scale="block",
    trig="announced: a serial filer works the avenue; every shop with a step and no ramp or bell gets a letter",
    eff=[{"field": "accessExposure", "add": 15000, "appliesIf": "step and no alternative"}, {"field": "demand", "mult": 0.99, "note": "guests with strollers and wheelchairs go elsewhere"}],
    moves=[{"kind": "setup", "id": "portable_ramp", "label": "Portable ramp and a call bell", "cost": {"cash": 600}, "result": "readily achievable alternative; exposure x 0.3 (estimate)"},
           {"kind": "setup", "id": "permanent_ramp", "label": "Re-pitch the entrance", "cost": {"cash": 12000}, "result": "exposure 0"}],
    src="SEYFARTH", sup=["ADA", "KATZ"], conf="estimate",
    freq="New York: 1,471 federal ADA Title III suits in 2025; filings are shifting to state court",
    note="Federal count verified only through a law-firm summary (search). Ramp prices are my estimates; a ramp on the sidewalk needs city approval."),

"d00_premises_toilet_route": dict(
    months=ALL, dur=1,
    trig="decision: layout sends customers to the toilet through the food preparation area",
    eff=[{"field": "inspectionPoints", "add": 5}, {"field": "fine", "add": 300}],
    moves=[{"kind": "choice", "id": "move_door", "label": "Reroute the toilet door", "cost": {"cash": 3000}, "result": "no violation"}],
    src="HC81", sup=[], conf="estimate", freq="Small long rooms", note="Points and fine by analogy with code 5E; estimates."),

"d00_premises_exit_storage": dict(
    months=ALL, dur=1,
    trig="decision: bulk delivery stored in the exit passage",
    eff=[{"field": "fine", "add": 1000, "note": "Fire Department summons, estimate"}],
    moves=[{"kind": "choice", "id": "smaller_orders", "label": "Order weekly, not monthly", "cost": {"cogsMult": 1.01}, "result": "passage clear"}],
    src="FDNY_EXIT", sup=[], conf="estimate", freq="Small rooms", note="Estimate; the fine schedule was not opened."),

"d00_premises_event_capacity": dict(
    months=ALL, dur=1,
    trig="decision: event with more than 74 people in a room without a Place of Assembly certificate",
    eff=[{"field": "fine", "add": 2500}, {"field": "setupCost", "add": 250, "appliesIf": "temporary certificate bought"}],
    moves=[{"kind": "setup", "id": "temporary_pa_certificate", "label": "Temporary Place of Assembly certificate", "cost": {"cash": 250}, "result": "legal event"},
           {"kind": "choice", "id": "cap_guests", "label": "Cap at 74 people", "cost": {}, "result": "no permit"}],
    src="TPA", sup=[], conf="estimate", freq="Events", note="D02 numbers: penalty $2,500 ($12,500 on default), temporary certificate $250; standing people count at 5 sq ft each."),

"open_mic_over_capacity": dict(
    months=ALL, dur=1, mergedWith="d00_premises_event_capacity",
    trig="as d00_premises_event_capacity",
    eff=[{"field": "fine", "add": 2500}],
    moves=[{"kind": "setup", "id": "temporary_pa_certificate", "label": "Temporary certificate", "cost": {"cash": 250}, "result": "legal"}],
    src="TPA", sup=[], conf="estimate", freq="Events", note="D02 duplicate."),

"d00_premises_odor_home": dict(
    months=ALL, dur=2,
    trig="decision: exhaust or roaster discharge near a window of a home; neighbor complaint",
    eff=[{"field": "fine", "add": 560, "note": "first DEP air violation, estimate by analogy"}, {"field": "setupCost", "add": 5000, "appliesIf": "fix: carbon filter or duct extension, estimate"}],
    moves=[{"kind": "setup", "id": "exhaust_filter", "label": "Carbon filter on the exhaust", "cost": {"cash": 5000}, "result": "complaint closed"}, {"kind": "choice", "id": "no_roasting", "label": "Buy roasted beans", "cost": {"cogsMult": 1.02}, "result": "no odor"}],
    src="ODOR", sup=["DEPHOSP"], conf="estimate", freq="Mixed-use buildings", note="Estimates; DEP's odor penalty was not opened."),

"d00_premises_ac_neighbor": dict(
    months=[6, 7, 8, 9], dur=2,
    trig="decision: condenser on the roof or in the yard under an apartment window",
    eff=[{"field": "fine", "add": 560, "unit": "first offense; $1,120 second, $1,680 third"}, {"field": "setupCost", "add": 4000, "appliesIf": "relocate or enclose the unit, estimate"}],
    moves=[{"kind": "setup", "id": "condenser_enclosure", "label": "Acoustic enclosure", "cost": {"cash": 4000}, "result": "below 42 dB(A)"}],
    src="DEP_NOISE", sup=["DEPHOSP"], conf="verified", freq="Summer complaints",
    note="DEP penalty schedule (opened): circulation device noise above 42 dB(A), §24-227(a): $560 first offense ($875 on default), $1,120 second, $1,680 third; repeats counted within two years at the same premises. Enclosure price is my estimate."),

"neighbor_noise_complaint": dict(
    months=ALL, dur=1,
    trig="decision: music volume above the residential limit; upstairs neighbor calls 311",
    eff=[{"field": "fine", "add": 3200, "unit": "first offense; $6,400 second, $9,600 third", "note": "$0 for a first offense if compliance is certified within 30 days"}],
    moves=[{"kind": "choice", "id": "certify_fix", "label": "Fix and certify within 30 days", "cost": {"cash": 500}, "result": "first penalty $0"},
           {"kind": "lever", "id": "music_level", "optionId": "low", "label": "Keep music low", "cost": {}, "result": "no violation"}],
    src="DEP_NOISE", sup=[], conf="verified", freq="Mixed-use buildings",
    note="DEP penalty schedule (opened): §24-231(a) music from a commercial establishment above permitted levels, $3,200 first offense ($8,000 default), $6,400, $9,600; a zero penalty may be imposed for a first offense on certification of compliance within 30 days. Correction to D02, which had $2,000."),

"winter_draft_at_the_door": dict(
    months=[12, 1, 2], dur=3, scale="city",
    trig="calendar: cold months for shops with no air curtain or vestibule",
    eff=[{"field": "seats", "mult": 0.9}, {"field": "quality", "add": -0.02}],
    moves=[{"kind": "setup", "id": "air_curtain", "label": "Air curtain over the door", "cost": {"cash": 1500}, "result": "no effect"},
           {"kind": "setup", "id": "winter_vestibule", "label": "Storm vestibule Nov 15 - Apr 15", "cost": {"cash": 3000}, "result": "no effect; must come down by April 15"}],
    src="AIRCUR", sup=["VEST"], conf="estimate", freq="Every winter", note="D02 values; equipment prices are my estimates."),

"vestibule_must_come_down": dict(
    months=[4], dur=1,
    trig="calendar: April 15 for shops with a storm enclosure",
    eff=[{"field": "inspections", "mult": 1.1, "appliesIf": "left up"}],
    moves=[{"kind": "choice", "id": "remove_by_april_15", "label": "Take it down on time", "cost": {"cash": 300}, "result": "no complaint"}],
    src="VEST", sup=[], conf="estimate", freq="Yearly", note="D02: NYC311 lets the public report enclosures left up after April 15; fine not found."),

"roll_down_gate_deadline": dict(
    months=[7], dur=0,
    trig="cancelled: the July 1, 2026 deadline was repealed by the Council on June 30, 2026",
    eff=[{"field": "cash", "add": 0, "note": "nothing to pay; event kept only as a 'read the Council calendar' card"}],
    moves=[{"kind": "choice", "id": "wait_and_watch", "label": "Do not replace the gate yet", "cost": {}, "result": "saves $6,500"}],
    src="LL75_REPEAL", sup=[], conf="estimate", freq="Once",
    note="NY1 and the DOB newsletter (search excerpts): the Council voted 51-0 on June 30, 2026 for Intro 910-A, which repeals Local Law 75 of 2009; DOB had paused enforcement. Signature status not confirmed. Correction to D02's -$6,500."),

"cellar_stairs_tax": dict(
    months=ALL, dur=12,
    trig="decision: stock stored in the cellar",
    eff=[{"field": "staffAvailability", "mult": 0.97}, {"field": "seats", "add": 3}],
    moves=[{"kind": "choice", "id": "daily_restock_list", "label": "One restock run before opening", "cost": {}, "result": "staff 0.99"}],
    src="SBS_LEASE", sup=[], conf="estimate", freq="Most old storefronts", note="D02 values."),

"garden_complaint": dict(
    months=[5, 6, 7, 8, 9], dur=6,
    trig="decision: back-yard seating not allowed by the Certificate of Occupancy; neighbor calls 311",
    eff=[{"field": "seats", "mult": 0.7}],
    moves=[{"kind": "lever", "id": "site_due_diligence", "optionId": "check_co_before_lease", "label": "Check the CO for the yard", "cost": {}, "result": "price the yard at zero"}],
    src="YAFFA", sup=["DOB_CO"], conf="estimate", freq="Old rear yards", note="D10 value."),

"d00_world_event_snowmelt_counter_damage": dict(
    months=[1, 2, 3], dur=1,
    trig="state: known roof leak not fixed by the landlord; thaw after snow",
    eff=[{"field": "closureDays", "add": 2}, {"field": "cash", "add": -3000, "note": "grinder and stock, estimate"}],
    moves=[{"kind": "lever", "id": "lease_negotiation", "optionId": "repair_deadline", "label": "Landlord repairs within 10 days of notice", "cost": {"lawyerHours": 1}, "result": "leak fixed before the thaw"}],
    src="WATER", sup=["RPL227"], conf="estimate", freq="Old roofs", note="Estimates."),

"d00_street_hidden_sign": dict(
    months=ALL, dur=12,
    trig="announced: the building puts up a sidewalk shed",
    eff=[{"field": "footTraffic", "mult": 0.9}],
    moves=[{"kind": "setup", "id": "shed_banner", "label": "Banner on the shed", "cost": {"cash": 500}, "result": "footTraffic 0.95, estimate"}],
    src="SHED", sup=[], conf="estimate", freq="Common; D18 owns sheds", note="The pack's sidewalk_shed value (0.9) reused; D18 calibrates the shed itself."),

"d00_premises_public_landlord_use": dict(
    months=ALL, dur=0,
    trig="attribute: NYCHA or other public-landlord storefront with use restrictions",
    eff=[{"field": "leaseAvailable", "set": False, "appliesIf": "wet use not allowed"}],
    moves=[{"kind": "choice", "id": "dry_concept", "label": "Packaged coffee and pastries only", "cost": {"demandMult": 0.8}, "result": "lease possible"}],
    src="NYCHA", sup=[], conf="estimate", freq="Rare", note="Qualitative."),
}
