# Shared constants and sources for the D15 calibration builder.
ALL = list(range(1, 13))

# Reference shop of packs/cafe.json (extra.referenceMonth, keen-cray buildout classes)
REF = {
    "sqft": 800, "rentMonth": 6000, "rentDay": 200, "salesMonth": 51000, "salesDay": 1700,
    "contributionDay": 1200,  # sales minus ingredients (26%) and card fees (2.7%): 1700 x 0.71
    "profitMonth": 9719, "depositMonths": 3, "utilitiesMonth": 1100,
    "buildout": {"light": {"perSqft": 87.5, "cost": 70000, "days": 60},
                 "standard": {"perSqft": 225, "cost": 180000, "days": 90},
                 "heavy": {"perSqft": 400, "cost": 320000, "days": 180}},
}

S = {
 # opened in this session (page or PDF read directly or by the fetch tool) -> verified
 "SBS_LEASE": ("https://www.nyc.gov/assets/sbs/downloads/pdf/about/reports/commercial-lease-guide-accessible.pdf", "NYC SBS, Comprehensive Guide to Commercial Leasing in New York City", "verified"),
 "RPAPL711": ("https://www.nysenate.gov/legislation/laws/RPA/711", "NY RPAPL §711, grounds for summary proceedings (14-day rent demand)", "verified"),
 "RPAPL749": ("https://www.nysenate.gov/legislation/laws/RPA/749", "NY RPAPL §749, warrant and 14-day marshal notice", "verified"),
 "RPL223A": ("https://www.nysenate.gov/legislation/laws/RPP/223-A", "NY RPL §223-a, remedies when possession is not delivered", "verified"),
 "RPL226B": ("https://www.nysenate.gov/legislation/laws/RPP/226-B", "NY RPL §226-b, right to sublease or assign (residential only)", "verified"),
 "RPL227": ("https://www.nysenate.gov/legislation/laws/RPP/227", "NY RPL §227, when tenant may surrender premises", "verified"),
 "RPL232C": ("https://www.nysenate.gov/legislation/laws/RPP/232-C", "NY RPL §232-c, holding over after a term longer than one month", "verified"),
 "LIEN10": ("https://www.nysenate.gov/legislation/laws/LIE/10", "NY Lien Law §10, filing of notice of lien", "verified"),
 "LIEN19": ("https://www.nysenate.gov/legislation/laws/LIE/19", "NY Lien Law §19, discharge of lien by bond", "verified"),
 "TAX1141": ("https://www.nysenate.gov/legislation/laws/TAX/1141", "NY Tax Law §1141(c), bulk sale notice", "verified"),
 "TAX1145": ("https://www.nysenate.gov/legislation/laws/TAX/1145", "NY Tax Law §1145, penalties and interest", "verified"),
 "GBL683": ("https://www.nysenate.gov/legislation/laws/GBS/683", "NY General Business Law §683, franchise registration and disclosure", "verified"),
 "LAB581": ("https://www.nysenate.gov/legislation/laws/LAB/581", "NY Labor Law §581, transfer of unemployment experience", "verified"),
 "RCNY10204": ("https://www.nyc.gov/assets/buildings/rules/1_RCNY_102-04.pdf", "1 RCNY §102-04, civil penalties for work without a permit and stop work orders", "verified"),
 "DOBFEE26": ("https://www.nyc.gov/assets/buildings/pdf/26fee_updates-sn.pdf", "DOB service notice, fee updates in DOB NOW: Build, January 8, 2026", "verified"),
 "MMR_DOB": ("https://www.nyc.gov/assets/operations/downloads/pdf/mmr2026/dob.pdf", "Mayor's Management Report FY2026, Department of Buildings", "verified"),
 "MMR_LPC": ("https://www.nyc.gov/assets/operations/downloads/pdf/mmr2026/lpc.pdf", "Mayor's Management Report FY2026, Landmarks Preservation Commission", "verified"),
 "DOB_SWO": ("https://www.nyc.gov/site/buildings/property-or-business-owner/stop-work-order.page", "DOB, Stop Work Orders", "verified"),
 "DOB_CO": ("https://www.nyc.gov/site/buildings/property-or-business-owner/certificate-of-occupancy.page", "DOB, Certificate of Occupancy", "verified"),
 "DOB_TCO": ("https://www.nyc.gov/site/buildings/property-or-business-owner/temporary-certificate-of-occupancy.page", "DOB, Temporary Certificate of Occupancy", "verified"),
 "DOB_ASB": ("https://www.nyc.gov/site/buildings/dob/project-requirements-asbestos.page", "DOB, Project Requirements: Asbestos", "verified"),
 "DOB_SIGN": ("https://www.nyc.gov/site/buildings/property-or-business-owner/project-requirements-owner-signs.page", "DOB, Project Requirements: Signs", "verified"),
 "DOB_LL152": ("https://www.nyc.gov/assets/buildings/pdf/gas_piping-sn.pdf", "DOB service notice, gas piping periodic inspection (Local Law 152), September 26, 2025", "verified"),
 "DEP_NOISE": ("https://www.nyc.gov/assets/dep/downloads/pdf/air/noise/noise-code-penalty-schedule.pdf", "DEP, Noise Code Penalty Schedule (15 RCNY §31-115)", "verified"),
 "HPD_LOAD": ("https://www.nyc.gov/assets/hpd/downloads/pdfs/services/hpd-pilot-coned-load-letter.pdf", "HPD, The Con Edison load letter", "verified"),
 "SENATE_GAS": ("https://www.nysenate.gov/sites/default/files/press-release/attachment/cooking_without_gas.pdf", "NYS Senate, Cooking Without Gas (2017)", "verified"),
 "DOF_RATES": ("https://www.nyc.gov/site/finance/property/property-tax-rates.page", "NYC DOF, property tax rates", "verified"),
 "DOF_FY27": ("https://www.nyc.gov/site/finance/about/press/press-release-fy27-tentative-assessment-roll.page", "NYC DOF, FY2027 tentative assessment roll, January 15, 2026", "verified"),
 "DOF_CRT": ("https://www.nyc.gov/site/finance/business/business-commercial-rent-tax-crt.page", "NYC DOF, Commercial Rent Tax", "verified"),
 "DOHMH_MFV": ("https://www.nyc.gov/site/doh/business/food-operators/mobile-and-temporary-food-vendors.page", "DOHMH, Mobile food vendors", "verified"),
 "FSE": ("https://nyc-business.nyc.gov/nycbusiness/description/food-service-establishment-permit", "NYC Business, Food Service Establishment Permit", "verified"),
 # read in search excerpts or secondary sources -> estimate
 "CW_Q3": ("https://www.cushmanwakefield.com/en/united-states/insights/us-marketbeats/new-york-city-area-marketbeats/manhattan-retail", "Cushman & Wakefield, Manhattan Retail MarketBeat Q3 2026", "estimate"),
 "CBRE_Q3": ("https://www.cbre.com/insights/figures/manhattan-retail-figures-q3-2026", "CBRE, Manhattan Retail Figures Q3 2026", "estimate"),
 "JDS_FREE": ("https://www.jdsupra.com/legalnews/build-out-provisions-in-nyc-restaurant-1727571/", "DHC Legal via JD Supra, build-out provisions in NYC restaurant leases", "estimate"),
 "METRO_DEP": ("https://www.metro-manhattan.com/security-deposit/", "Metro Manhattan Office Space, security deposits", "estimate"),
 "HOLDOVER": ("https://www.thehabitatgroup.com/articles/9654-require-tenants-to-pay-maximum-premium-rent-for-long-holdovers", "Habitat, holdover rent premiums enforced by NY courts", "estimate"),
 "LL185": ("https://intro.nyc/local-laws/2019-185", "Local Law 185 of 2019, commercial tenant harassment penalties", "estimate"),
 "BIZBUY": ("https://www.bizbuysell.com/learning-center/valuation-benchmarks/coffee-shops-cafes/", "BizBuySell, coffee shop and cafe valuation benchmarks", "estimate"),
 "DODGE_CO": ("https://www.rhumbix.com/blog/how-much-are-change-orders-costing-your-construction-business", "Rhumbix citing Dodge Data & Analytics on change orders", "estimate"),
 "ASEE_CO": ("https://peer.asee.org/change-orders-impact-on-project-cost", "ASEE paper, change orders impact on project cost", "estimate"),
 "TERRAPIN": ("https://terrapincg.com/news/average-cost-to-build-high-end-restaurant", "Terrapin Construction Group, restaurant construction cost 2026", "estimate"),
 "ALPHA": ("https://www.alphacontractorsny.com/guides/commercial-build-out-cost-nyc", "Alpha Contractors NY, commercial build-out cost NYC 2026", "estimate"),
 "ACP7": ("https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-23455", "15 RCNY Chapter 1 (asbestos), ACP-7 fee tiers", "estimate"),
 "PART13": ("https://d1tvxue8o4w0fl.cloudfront.net/regulation/new-york-codes-rules-and-regulations/title-16-department-of-public-service/chapter-i-rules-of-procedure/subchapter-b-procedures-and-requirements-concerning-consumer-protections/part-13-rules-governing-the-provision-of-service-by-gas-electric-and-steam-corporations-to-nonresidential-customers/section-137-security-deposits", "16 NYCRR §13.7, security deposits of nonresidential utility customers", "estimate"),
 "TRIUMPH": ("https://triumphelectricinc.com/con-edison-service-upgrade-guide-powering-your-nyc-property-in-2026/", "Triumph Electric, Con Edison service upgrade guide 2026", "estimate"),
 "ST124": ("https://tax.ny.gov/pubs_and_bulls/tg_bulletins/st/capital_improvements.htm", "NYS DTF, Tax Bulletin Capital Improvements (TB-ST-104)", "estimate"),
 "BULK_TB": ("https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/bulk_sales.htm", "NYS DTF, Tax Bulletin Bulk Sales (TB-ST-70)", "estimate"),
 "AU19610": ("https://tax.ny.gov/pdf/current_forms/st/au196_10.pdf", "NYS DTF, Form AU-196.10 instructions", "estimate"),
 "ESSTA_SUCC": ("https://www.lawandtheworkplace.com/2023/10/new-york-city-adopts-final-rule-amending-the-earned-safe-and-sick-time-act/", "Proskauer, NYC final rule amending ESSTA (successor employers), 2023", "estimate"),
 "FDD_SCOOT": ("https://www.franchisechatter.com/2026/09/26/scooters-coffee-franchise-review-2026-costs-fees-news-average-revenues-and-or-profits/", "Franchise Chatter, Scooter's Coffee 2026 FDD fees", "estimate"),
 "FDD_DUNN": ("https://franchiseoverview.com/company/dunn-brothers-coffee", "Franchise Overview, Dunn Brothers Coffee fees", "estimate"),
 "SEYFARTH": ("https://www.jdsupra.com/legalnews/ada-title-iii-federal-lawsuit-filings-2632226/", "Seyfarth Shaw, ADA Title III federal filings 2025", "estimate"),
 "LL75_REPEAL": ("https://ny1.com/nyc/all-boroughs/news/2026/07/02/city-council-votes-to-repeal-deadline-for-new-roll-down-security-gates", "NY1, Council repeals roll-down gate deadline, July 2, 2026", "estimate"),
 "STARTLAND": ("https://www.startlandnews.com/2024/03/kc-small-biz-new-owners", "Startland News 2024, SBDC adviser on customers lost after a change of owner", "estimate"),
 "COMM_OBS_KEY": ("https://commercialobserver.com/2013/08/weighing-in-on-key-money-deals/", "Commercial Observer, key money deals", "estimate"),
 "NYCHA_GAS": ("https://thenycalliance.org/news-item/Con-Edison-Gas-Service", "NYC Hospitality Alliance, Con Edison gas service check before a lease", "estimate"),
 "RIVERDALE": ("https://brooklyn.news12.com/riverdale-businesses-struggle-without-gas-for-months", "News 12, Riverdale businesses without gas for months (December 2024)", "estimate"),
 "TT_COST": ("https://www.commercialsearch.com/news/will-construction-costs-go-up-in-2026/", "CommercialSearch on 2026 construction cost outlook (Turner & Townsend 4.25%, JLL)", "estimate"),
 "SBA_SOP": ("https://www.sba.gov/document/sop-50-10-lender-development-company-loan-programs", "SBA SOP 50 10 8, equity injection for business acquisitions", "estimate"),
}

def src(key):
    return S[key][0]
