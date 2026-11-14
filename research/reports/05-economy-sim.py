"""Coffee-shop economy model for researcher 05 (see 05-economy.md).

Run: python3 05-economy-sim.py
Prints the outcome of several opening strategies over the first 90 in-game days
and checks over 200 random seeds that decisions, not luck, decide the outcome.
"""
import math
import random
import statistics

UNIT_COST = {"cheap": 1.40, "standard": 1.80, "premium": 2.30}   # $ per order
QUALITY_BONUS = {"cheap": -0.4, "standard": 0.0, "premium": 0.4}  # rating target shift
LOCATIONS = {  # passers-by per day, rent per month, Mon..Sun traffic multipliers
    "main":   dict(F=6000, rent=5000, dow=[1, 1, 1, 1, 1, 0.9, 0.7]),
    "side":   dict(F=3500, rent=2200, dow=[1, 1, 1, 1, 1, 1.0, 0.8]),
    "office": dict(F=8000, rent=6000, dow=[1, 1, 1, 1, 1, 0.25, 0.15]),
}
BASE_CONV = 0.03      # share of passers-by who buy at $6, rating 4.0, full awareness
REF_PRICE = 6.0
ELASTICITY = 1.5
CAP_PER_PERSON = 70   # orders per day one person can serve (owner works the bar too)
WAGE_DAY = 130        # $ per hired barista per day, paid weekly
MISC_DAY = 40         # utilities, card fees, consumables
OWN_CASH, LOAN, TAKEOVER = 10_000, 30_000, 25_000
LOAN_PAYMENT = LOAN * (0.10 / 12) / (1 - (1 + 0.10 / 12) ** -36)  # ~= $968/month
TAX_RATE = 0.20


def run(loc="main", price=6.0, hires=1, tier="standard", ads=0, days=90, seed=1,
        maintenance=True, competitor_day=40, adapt=None, verbose=False):
    L = LOCATIONS[loc]
    rnd = random.Random(seed)
    cash = OWN_CASH + LOAN - TAKEOVER - L["rent"]  # rent deposit paid at signing
    awareness, rating, loan = 0.25, 4.0, LOAN
    month_profit = month_revenue = 0.0
    low, months, history = (float("inf"), 0), [], []
    for d in range(1, days + 1):
        if adapt:
            price, hires, tier, ads = adapt(d, price, hires, tier, ads, history)
        dom = (d - 1) % 30 + 1
        if dom == 1:                                    # rent, paid in advance
            cash -= L["rent"]; month_profit -= L["rent"]
        noise = math.exp(rnd.gauss(0, 0.08))           # small, shared by everyone in a seed
        attr = awareness * (rating / 4) ** 2 * (REF_PRICE / price) ** ELASTICITY
        demand = L["F"] * L["dow"][(d - 1) % 7] * BASE_CONV * attr * noise
        if d >= competitor_day:                         # announced on day 26
            comp_price = 4.5 if d < competitor_day + 14 else 6.0
            comp_attr = min(1.0, 0.4 + 0.03 * (d - competitor_day)) * (REF_PRICE / comp_price) ** ELASTICITY
            demand *= 1 - 0.4 * comp_attr / (attr + comp_attr)
        closed = (not maintenance) and d == 18          # machine breaks if warning ignored
        if closed:
            demand = 0
        served = min(demand, (hires + 1) * CAP_PER_PERSON)
        lost = demand - served
        op = served * (price - UNIT_COST[tier]) - ads - MISC_DAY
        if d % 7 == 0:
            op -= hires * WAGE_DAY * 7                  # weekly payroll
        cash += op; month_profit += op; month_revenue += served * price
        if closed:
            cash -= 1200; month_profit -= 1200
        if maintenance and d == 14:
            cash -= 150; month_profit -= 150
        if dom == 15:
            interest = loan * 0.10 / 12
            loan -= LOAN_PAYMENT - interest
            cash -= LOAN_PAYMENT; month_profit -= interest
        if dom == 30:
            tax = TAX_RATE * max(0.0, month_profit)
            cash -= tax
            months.append(dict(day=d, profit=round(month_profit), tax=round(tax),
                               cash=round(cash), revenue=round(month_revenue)))
            month_profit = month_revenue = 0.0
        awareness += (1 - awareness) * (0.015 + 0.0002 * ads)
        target = 4.0 + QUALITY_BONUS[tier] - 2.0 * (lost / demand if demand else 0) - (0.3 if price > 7.5 else 0)
        rating += 0.1 * (target - rating)
        history.append(dict(day=d, demand=demand, served=served, lost=lost, cash=cash))
        if cash < low[0]:
            low = (cash, d)
        if verbose and d in (1, 7, 14, 15, 30, 31, 40, 61, 90):
            print(f"  day {d:2d}: demand {demand:4.0f}  served {served:4.0f}  cash ${cash:7.0f}")
    return dict(min_cash=round(low[0]), min_day=low[1], months=months, rating=round(rating, 2))


def premium_after_warning(d, price, hires, tier, ads, history):
    return price, hires, ("premium" if d >= 26 else tier), ads


STRATEGIES = {
    "main street, default (1 barista, $6, standard)": {},
    "main street, react to competitor warning": dict(adapt=premium_after_warning),
    "main street, overspend (2 baristas, premium, $60/day ads)": dict(hires=2, tier="premium", ads=60),
    "main street, skip $150 maintenance": dict(maintenance=False),
    "main street, $4.50 + cheap beans": dict(price=4.5, tier="cheap"),
    "main street, $7.50": dict(price=7.5),
    "side street, default": dict(loc="side"),
    "office district, default": dict(loc="office"),
}

if __name__ == "__main__":
    for name, kw in STRATEGIES.items():
        r = run(**kw)
        m = " | ".join(f"M{i+1} rev ${x['revenue']:,} P&L ${x['profit']:,}" for i, x in enumerate(r["months"]))
        lows = [run(seed=s, **kw)["min_cash"] for s in range(1, 201)]
        print(f"{name}\n  {m}\n  lowest cash ${r['min_cash']:,} on day {r['min_day']}; "
              f"200 seeds: median low ${statistics.median(lows):,.0f}, "
              f"cash crunch in {sum(x < 0 for x in lows) / 2:.0f}% of seeds")
