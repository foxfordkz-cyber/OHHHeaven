# D17 calibration: shared constants, sources and helpers.
# Reference month = packs/cafe.json extra.referenceMonth (standard kit, 18 seats, 4 baristas at $21 x 160 h,
# $51,000 sales, 6,000 orders at $8.50, profit before owner taxes $9,719).

ALL = list(range(1, 13))

REF = {
    "sales": 51000, "orders": 6000, "ticket": 8.5, "cardShare": 0.9,
    "wage": 21.0, "minWage": 17.0, "tippedCash": 11.35, "tipCredit": 5.65,
    "hoursPerBarista": 160, "baristas": 4, "payroll": 13440, "weeklyPayroll": 3104,
    "loadedHour": 23.6,          # $21 x (1 + 7.65% FICA + 2.53% UI + 2% WC + 0.04% DB)
    "daySales": 1700,            # 51,000 / 30
    "dayCardGross": 1666,        # 1,700 x 90% on cards x 1.089 with sales tax
    "contribution": 0.68,        # profit lost per $1 of lost sales when wages are already paid
    "profit": 9719, "ownerTaxMonthly": 3026, "cardTips": 2000,
    "salesTaxQuarter": 13579,    # 3 x 51,000 x 8.875%
}

S = {
    # wages and hours
    "dol_tipped": "https://dol.ny.gov/minimum-wage-tipped-workers",
    "ls400": "https://forms.labor.ny.gov/WP/LS400.pdf",
    "callin": "https://www.law.cornell.edu/regulations/new-york/12-NYCRR-146-1.5",
    "spread": "https://www.law.cornell.edu/regulations/new-york/12-NYCRR-146-1.6",
    "hosp_faq": "https://dol.ny.gov/system/files/documents/2021/03/hospitality-wage-order-frequently-asked-questions.pdf",
    "tips_faq": "https://dol.ny.gov/system/files/documents/2025/01/tips-and-gratuities-frequently-asked-questions.pdf",
    "ll198": "https://law.justia.com/codes/new-york/lab/article-6/198/",
    "payfreq2025": "https://www.mayerbrown.com/en/insights/publications/2025/07/new-york-amends-labor-law-to-limit-damages-for-late-payments-to-manual-workers",
    "ll218": "https://newyork.public.law/laws/n.y._labor_law_section_218",
    "ll161": "https://dol.ny.gov/one-day-rest-seven-section-161-new-york-state-labor-law-ls611",
    "ll215": "https://law.justia.com/codes/new-york/lab/article-7/215/",
    "meal": "https://dol.ny.gov/day-rest-and-meal-periods",
    "minors": "https://dol.ny.gov/hours-work-minors",
    "child_pen": "https://dol.ny.gov/laws-governing-employment-minors-p882",
    "lactation": "https://dol.ny.gov/expressing-breast-milk-workplace",
    "prenatal": "https://www.ny.gov/new-york-state-paid-prenatal-leave/information-employers",
    "pto_faq": "https://www.nyc.gov/site/dca/about/paid-sick-leave-FAQs.page",
    "pto_mayor": "https://www.nyc.gov/mayors-office/news/2026/02/mayor-mamdani-announces-major-expansion-of-protected-time-off-fo",
    "salary_ad": "https://www.nyc.gov/assets/cchr/downloads/pdf/publications/Salary-Transparency-Factsheet.pdf",
    "salary_history": "https://www.nyc.gov/site/cchr/law/salary-history-law.page",
    "harass": "https://www.ny.gov/combating-sexual-harassment-workplace/sexual-harassment-prevention-model-policy-and-training",
    "mw30": "https://www.fisherphillips.com/en/insights/insights/7-things-you-need-to-know-as-nyc-council-introduces-sweeping-minimum-wage-proposal",
    "mw_index": "https://www.governor.ny.gov/news/money-your-pockets-governor-hochul-reminds-new-yorkers-minimum-wage-increase-january-1",
    "flsa_mgr": "https://www.dol.gov/agencies/whd/fact-sheets/15b-managers-supervisors-tips-flsa",
    "hours_worked": "https://www.dol.gov/agencies/whd/fact-sheets/22-flsa-hours-worked",
    "fww": "https://www.nyc.gov/assets/dca/downloads/pdf/workers/FAQs-FairWorkweek-FastFood.pdf",
    # people
    "jolts_annual": "https://www.bls.gov/news.release/jolts.t22.htm",
    "blackbox": "https://blackboxintelligence.com/blog/state-of-the-restaurant-workforce-employee-turnover/",
    "instawork": "https://www.instawork.com/temp-work-rate/barista-rate-in-new-york-ny",
    "theft_secondary": "https://www.restroworks.com/blog/restaurant-employee-theft-statistics/",
    "i9": "https://www.morganlewis.com/pubs/2026/04/ice-rewrites-the-rules-on-form-i-9-violations",
    # insurance and benefits
    "wcb_pen": "https://www.wcb.ny.gov/icpencalc/pencalchelp.jsp",
    "wcb_viol": "https://www.wcb.ny.gov/content/main/Employers/violations-wclaw.jsp",
    "dbpfl_pen": "https://www.wcb.ny.gov/content/main/DisabilityBenefits/penalties-no-coverage.jsp",
    "pfl2026": "https://paidfamilyleave.ny.gov/2026",
    "pfl2027": "https://www.dfs.ny.gov/apps-and-licensing/health-insurers/pfl-rate-decision-2027-page",
    "wc_cut": "https://www.dfs.ny.gov/reports_and_publications/press_releases/pr20260715",
    "insureon": "https://www.insureon.com/food-business-insurance/coffee-shops-cafes/cost",
    "ui_rate": "https://dol.ny.gov/unemployment-insurance-rate-information",
    "nys50": "https://www.tax.ny.gov/forms/publications/wt/nys50.htm",
    "ui_guide": "https://dol.ny.gov/system/files/documents/2025/10/ia318.2.pdf",
    "ui_mbr": "https://dol.ny.gov/mbr",
    # taxes
    "st_pen": "https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/sales_and_use_tax_penalties.htm",
    "st100i": "https://www.tax.ny.gov/forms/current-forms/st/st100i.htm",
    "ny_int": "https://www.tax.ny.gov/pay/interest/2026/p4.htm",
    "vcc": "https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/vendor_collection_credit.htm",
    "st_final": "https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/filing_a_final_sales_tax_return.htm",
    "st_rest": "https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/sales_by_restaurants.htm",
    "st_bulk": "https://www.tax.ny.gov/bus/doingbus/buy.htm",
    "ftd": "https://www.irs.gov/payments/failure-to-deposit-penalty",
    "p15": "https://www.irs.gov/publications/p15",
    "irs_int": "https://www.irs.gov/newsroom/interest-rates-remain-the-same-for-the-fourth-quarter-of-2026",
    "p505": "https://www.irs.gov/publications/p505",
    "f8846": "https://www.irs.gov/businesses/small-businesses-self-employed/fica-tip-credit-for-employers",
    "w2_2026": "https://www.irs.gov/instructions/iw2w3",
    "k1099": "https://www.irs.gov/businesses/understanding-your-form-1099-k",
    "ubt": "https://www.nyc.gov/site/finance/business/business-unincorporated-business-tax-ubt.page",
    "crt": "https://www.nyc.gov/site/finance/business/business-commercial-rent-tax-crt.page",
    "wotc": "https://www.everycrsreport.com/files/2026-05-13_R43729_ab1bd03cea785873d6fc358b07e7fde0d2d5254c.html",
    "giftcard": "https://dos.ny.gov/news/consumer-alert-nys-division-consumer-protection-alerts-consumers-new-laws-related-gift-cards",
    # payments and money
    "sq_fees": "https://squareup.com/help/us/en/article/5068-what-are-square-s-fees",
    "sq_offline": "https://squareup.com/help/us/en/article/7777-process-card-payments-with-offline-mode",
    "sq_instant": "https://squareup.com/help/us/en/article/3807",
    "sq_dispute": "https://chargebacks911.com/chargeback-types/square-disputes/square-dispute-costs/",
    "stripe_dispute": "https://www.chargebackgurus.com/blog/stripe-dispute-fees",
    "sq_reserve": "https://squareup.com/help/us/en/article/6832-reserves-faq",
    "sba7a": "https://www.sba.gov/loans/7a-loans/",
    "prime": "https://www.bankrate.com/rates/interest-rates/wall-street-prime-rate/",
    "sbcs": "https://www.fedsmallbusiness.org/reports/survey/2026/2026-report-on-employer-firms",
    "mca": "https://www.merchantmaverick.com/merchant-cash-advances-aprs/",
    "ftc_mca": "https://www.ftc.gov/news-events/news/press-releases/2021/04/cash-advance-firm-pay-98m-settle-ftc-complaint-it-overcharged-small-businesses",
    "guarantee": "https://www.law.cornell.edu/cfr/text/13/120.160",
    "future_fund": "https://nyc-business.nyc.gov/nycbusiness/business-services/financial-assistance/nyc-future-fund",
    "bizbuysell": "https://www.bizbuysell.com/learning-center/valuation-benchmarks/coffee-shops-cafes/",
}

# Verification channel for this fragment. Direct page fetch was blocked by the session network policy
# (dol.ny.gov, irs.gov, tax.ny.gov, nysenate.gov, forms.labor.ny.gov refused by the proxy), so every
# "verified" number below was read in a web-search extract of the named primary page.
VIA = "search extract of the primary page (direct fetch blocked in this session)"


def ef(field, mult=None, add=None, note=None, **kw):
    d = {"field": field}
    if mult is not None:
        d["mult"] = mult
    if add is not None:
        d["add"] = add
    d.update(kw)
    if note:
        d["note"] = note
    return d


def mv(kind, id, opt=None, label=None, cost=None, result=None, violation=None, note=None):
    d = {"kind": kind, "id": id}
    if opt:
        d["optionId"] = opt
    if label:
        d["label"] = label
    d["cost"] = cost or []
    d["result"] = result or []
    if violation:
        d["violation"] = violation
    if note:
        d["note"] = note
    return d


def E(id, frag, tier, trigger, months, dur, effects, moves, source, confidence, note,
      realFrequency=None, duplicateOf=None, fixes=None, extraSources=None, scale=None):
    d = {"id": id, "sourceFragment": frag, "tier": tier, "trigger": trigger,
         "months": months, "durationMonths": dur, "effects": effects, "playerMoves": moves,
         "source": source, "confidence": confidence, "note": note}
    if scale:
        d["scale"] = scale
    if confidence == "verified":
        d["checkedVia"] = VIA
    if realFrequency:
        d["realFrequency"] = realFrequency
    if duplicateOf:
        d["duplicateOf"] = duplicateOf
    if fixes:
        d["fixesFragmentValue"] = fixes
    if extraSources:
        d["supportingSources"] = extraSources
    return d
