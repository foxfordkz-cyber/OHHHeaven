"""Researcher 53: demo-blitz calibration on top of report 24's market model.

This file = research/reports/24-market-sim.py (branch claude/exciting-mccarthy-r7904m), unchanged formulas,
with four switches added: ROUNDS, CREDIT_BASE/CREDIT_K (overdraft limit = CREDIT_BASE + CREDIT_K * revenue),
DEMO_SPIKE (fixed news schedule) and two demo bots (Rex = 'Reckless Rex', doomed by design; Kamikaze = loud discounter).
Rookie (report 24) = random plausible moves, used as a proxy for a first-time human (pessimistic: random ads/loans).

Run: python3 53-blitz-sim.py      (~40 s)
"""
"""Shared-street market model for researcher 24 (see 24-market-model.md).

Run: python3 24-market-sim.py            # full report, ~15 s
     python3 24-market-sim.py --quick    # fewer matches, ~3 s

3-6 coffee shops on one street fight for the same customers for 12 rounds
(round = one month). Every number below is a game-design assumption, not a
fact about real coffee shops. The script plays bot strategies against each
other on random streets (student/office mix) with random news scenarios and
prints win rates, bankruptcies, head-to-head results and two snowball checks.

Strategies: Discounter (eco beans, -10% price), Premium (premium beans, +35%,
well-paid staff), Blitz (loan, corner bid, cheap entry, ads, poaching),
Balanced (reference price), Undercutter (always 20 cents below the cheapest
rival), Adaptive (reads the street mix, passes cost shocks into price),
Rookie (random plausible moves; tested separately).
"""
import math
import random
import statistics
import sys

# ---------------- constants (MVP: all of these live in one config file) ----------
P_REF = 6.0            # reference ticket (drink + pastry), $
WAGE = 2000            # market wage per employee per month, $
CAP_STAFF = 1100       # items one employee serves per month
CAP_OWNER = 500        # items the owner serves per month
HIRE_COST, FIRE_COST = 400, 1000
MISC = 500             # utilities, card fees, per month
START_CASH = 12000     # after fit-out, same for everyone
TRAFFIC_PER_SHOP, TRAFFIC_BASE = 2600, 2000   # potential customers per month
SEGMENTS = [           # price sensitivity, quality weight, reputation weight
    dict(name="students", e=3.0, bq=0.10, br=0.35),   # share comes from the real street:
    dict(name="pros",     e=1.3, bq=0.70, br=0.70),   # schools/campuses vs offices nearby
]
STUDENT_SHARE = (0.35, 0.75)        # range of street mixes used in the tests
QUALITY = {"eco": -0.5, "std": 0.0, "prem": 1.0}
SPEED = {"eco": 1.1, "std": 1.0, "prem": 0.85}       # premium drinks take longer to make
RETAIN = 0.50                        # regulars: share of last month's customers who come back
ADS_W, ADS_HALF = 0.30, 400          # utility += ADS_W * ln(1 + ads / ADS_HALF)
OUTSIDE = 1 / 3                      # weight of "buy nothing / go elsewhere" per shop
SPILL = 0.5                          # share of turned-away customers who try another shop
SLOT_W = [1.00, 0.88, 0.88, 0.76, 0.76, 0.64, 0.55]       # traffic weight by slot
SLOT_RENT = [3600, 3000, 3000, 2400, 2400, 1900, 1400]    # base rent by slot, $/month
STOCK_MAIN, STOCK_PREM = 1.15, 0.22  # supplier stock as share of expected street sales
SPOT_MARKUP = 1.4                    # cash-and-carry price when supplier is sold out
SPOIL = 0.15                         # leftover stock lost per month
TAX_LOW, TAX_HIGH, TAX_STEP = 0.15, 0.25, 3000
RATE_LOW, RATE_HIGH = 0.015, 0.025   # monthly interest, high above half the limit
MOVE_COST, LEASE_ROUNDS = 2000, (1, 7)
ROUNDS = 12
CREDIT_BASE, CREDIT_K = 6000, 0.8
DEMO_SPIKE = None   # if set: (warn_round, multipliers) deterministic news schedule
ANTI_SNOWBALL = False                # extra rules: turnover rent floor, progressive tax, staff overhead.
                                     # OFF in the MVP: in 12 rounds they do not help (see the test)


def unit_cost(tier, n_index):
    """Raw material index (real news) -> supplier price per item; 57-64% of it is the commodity."""
    return {"eco": 0.4 + 0.6 * n_index, "std": 0.6 + 0.8 * n_index, "prem": 0.9 + 1.6 * n_index}[tier]


# ---------------- news scenarios: what the AI pipeline would emit ----------------
def make_scenario(rnd):
    if DEMO_SPIKE is not None:
        return demo_scenario(rnd)
    n_index = [1.0 + rnd.gauss(0, 0.03) for _ in range(13)]
    traffic = [1.0] * 13
    students_shift = [0.0] * 13
    warn = {}                                     # round -> text shown one round ahead
    kind = rnd.choice(["calm", "spike", "spike", "crash"])
    r = rnd.randint(3, 9)
    if kind == "spike":                           # e.g. frost in a growing region
        for k, m in enumerate([1.35, 1.35, 1.25, 1.12, 1.05]):
            if r + k <= 12:
                n_index[r + k] *= m
        warn[r - 1] = "commodity +35% next month"
    elif kind == "crash":                         # e.g. record harvest
        for k in range(3):
            if r + k <= 12:
                n_index[r + k] *= 0.8
        warn[r - 1] = "commodity -20% next month"
    demand_kind = rnd.choice(["none", "heatwave", "recession"])
    r2 = rnd.randint(2, 11)
    if demand_kind == "heatwave":
        traffic[r2] = 1.2
        warn[r2 - 1] = warn.get(r2 - 1, "") + " | traffic +20% next month"
    elif demand_kind == "recession":              # e.g. unemployment data jumps
        for k in range(r2, 13):
            traffic[k] = 0.9
            students_shift[k] = 0.10
    students = rnd.uniform(*STUDENT_SHARE)
    return dict(kind=kind, students=students, spike_round=r if kind == "spike" else None, n=n_index,
                traffic=traffic, shift=students_shift, warn=warn)


def demo_scenario(rnd):
    warn_round, mults = DEMO_SPIKE
    n_index = [1.0] * 13
    for k, m in enumerate(mults):
        r = warn_round + 1 + k
        if r <= 12:
            n_index[r] *= m
    warn = {warn_round: "commodity +35% next month"}
    students = rnd.uniform(*STUDENT_SHARE)
    return dict(kind="spike", students=students, spike_round=warn_round + 1, n=n_index,
                traffic=[1.0] * 13, shift=[0.0] * 13, warn=warn)


# ---------------- bot strategies -------------------------------------------------
class Bot:
    hedge = True

    def __init__(self, name):
        self.name = name

    def bid_for(self, view, default):
        floor = view.get("renewal")
        if floor and floor <= 1.35 * view["my_base_rent"]:
            return max(default, floor)               # accept the landlord's renewal terms
        return default

    def staff_for(self, forecast, tier="std"):
        return max(0, min(6, math.ceil((forecast / SPEED[tier] - CAP_OWNER) / CAP_STAFF)))

    def order_for(self, me, forecast, warn_next):
        target = forecast * 1.05
        if self.hedge and warn_next and "commodity +" in warn_next:
            target += forecast * 0.9              # stock up before the spike
        if warn_next and "commodity -" in warn_next:
            target = forecast * 0.7               # wait for cheaper stock
        return max(0, target - me["inv"])


class Discounter(Bot):            # low price, cheap beans, volume
    def decide(self, me, view):
        f = view["forecast"] * 1.05
        return dict(price=P_REF * 0.9, tier="eco", ads=300, wage=WAGE,
                    staff=self.staff_for(f, "eco"), order=self.order_for(me, f, view["warn"]),
                    bid=self.bid_for(view, SLOT_RENT[1]), loan=0, poach=None)


class Premium(Bot):               # high price, premium beans, loyal staff
    def decide(self, me, view):
        f = view["forecast"]
        return dict(price=P_REF * 1.35, tier="prem", ads=500, wage=WAGE * 1.15,
                    staff=self.staff_for(f, "prem"), order=self.order_for(me, f, view["warn"]),
                    bid=self.bid_for(view, SLOT_RENT[1]), loan=0, poach=None)


class Blitz(Bot):                 # debt-fuelled land grab: corner, cheap entry, ads, poaching
    def decide(self, me, view):
        t = view["round"]
        f = view["forecast"] * (1.15 if t <= 4 else 1.0)
        target = max(view["rivals"], key=lambda r: r["staff"], default=None)
        poach = target["id"] if (target and target["staff"] >= 2 and t <= 6) else None
        price = P_REF * (0.88 if t <= 4 else 0.95 if t == 5 else 1.0)   # raise slowly: keep regulars
        return dict(price=price, tier="std",
                    ads=1500 if t <= 3 else 600, wage=WAGE * 1.15,
                    staff=max(0, self.staff_for(f) - (1 if poach is not None else 0)), order=self.order_for(me, f, view["warn"]),
                    bid=self.bid_for(view, SLOT_RENT[0] * 1.15), loan=8000 if t == 1 else 0, poach=poach)


class Balanced(Bot):              # control: reference price, modest ads
    def decide(self, me, view):
        f = view["forecast"]
        return dict(price=P_REF, tier="std", ads=500, wage=WAGE,
                    staff=self.staff_for(f), order=self.order_for(me, f, view["warn"]),
                    bid=self.bid_for(view, SLOT_RENT[1]), loan=0, poach=None)


class Undercutter(Bot):           # always 20 cents below the cheapest visible rival
    hedge = False

    def decide(self, me, view):
        prices = [r["price"] for r in view["rivals"] if r["price"]]
        floor = unit_cost("std", view["n_now"]) + 0.6
        price = max(floor, (min(prices) - 0.2) if prices else P_REF * 0.9)
        f = view["forecast"] * 1.2
        return dict(price=price, tier="std", ads=300, wage=WAGE,
                    staff=self.staff_for(f), order=self.order_for(me, f, view["warn"]),
                    bid=self.bid_for(view, SLOT_RENT[1]), loan=0, poach=None)


class Adaptive(Bot):              # skilled player: reads the street mix, passes cost shocks into price
    def decide(self, me, view):
        s = view["students"]
        tier, mult = ("eco", 0.9) if s >= 0.6 else ("prem", 1.4) if s < 0.45 else ("std", 1.0)
        cost_shift = unit_cost(tier, view["n_now"]) - unit_cost(tier, 1.0)
        f = view["forecast"]
        return dict(price=P_REF * mult + 0.6 * cost_shift, tier=tier, ads=500,
                    wage=WAGE * (1.15 if tier == "prem" else 1.0), staff=self.staff_for(f, tier),
                    order=self.order_for(me, f, view["warn"]),
                    bid=self.bid_for(view, SLOT_RENT[1]), loan=0, poach=None)


class Rookie(Bot):                # random but plausible choices, no hedging: a first-time player
    hedge = False

    def __init__(self, name, seed=0):
        super().__init__(name)
        self.rnd = random.Random(seed)

    def decide(self, me, view):
        r = self.rnd
        tier = r.choice(["eco", "std", "std", "prem"])
        f = view["forecast"] * r.uniform(0.8, 1.5)
        return dict(price=P_REF * r.uniform(0.8, 1.35), tier=tier, ads=r.choice([0, 300, 800, 1500, 2500]),
                    wage=WAGE * r.choice([1.0, 1.0, 1.15]), staff=self.staff_for(f, tier),
                    order=self.order_for(me, f, view["warn"]), bid=r.choice(SLOT_RENT[:4]),
                    loan=r.choice([0, 0, 0, 5000, 10000]) if view["round"] <= 3 else 0, poach=None)


STRATS = {"Discounter": Discounter, "Premium": Premium, "Blitz": Blitz,
          "Balanced": Balanced, "Undercutter": Undercutter, "Adaptive": Adaptive}


# ---------------- one match ------------------------------------------------------
def capacity(p):
    return (CAP_OWNER + CAP_STAFF * (p["staff"] - 0.5 * p.get("new", 0))) * SPEED[p["tier"]]


def renewal_floor(p, history):
    """Landlord's renewal offer, announced a month ahead: max(base rent, 22% of recent turnover)."""
    avg_rev = statistics.mean(history[p["id"]][-3:]) if history[p["id"]] else 0
    return max(SLOT_RENT[p["slot"]], 0.22 * avg_rev if ANTI_SNOWBALL else 0)


def auction(players, rnd_no, history, rnd):
    """Sealed first-price bids. Highest bid picks the best free slot; rent = max(floor, bid)."""
    alive = [p for p in players if not p["out"]]
    n_slots = len(players) + 1
    floors = list(SLOT_RENT[:n_slots])
    if rnd_no > 1:
        for p in alive:
            floors[p["slot"]] = renewal_floor(p, history)

    def score(p):
        bonus = 1.10 if (rnd_no > 1 and p["bid"] >= floors[p["slot"]]) else 1.0   # incumbent
        return p["bid"] * bonus

    free = list(range(n_slots))
    ties = {p["id"]: rnd.random() for p in alive}                  # random tie-break
    for p in sorted(alive, key=lambda p: (score(p), ties[p["id"]]), reverse=True):
        slot = next(s for s in free if p["bid"] >= floors[s] or s == free[-1])
        free.remove(slot)
        if rnd_no > 1 and slot != p["slot"]:
            p["cash"] -= MOVE_COST
            p["aw"] *= 0.6
        p["slot"] = slot
        p["rent"] = max(floors[slot], min(p["bid"], floors[slot] * 1.5)) if p["bid"] >= floors[slot] else floors[slot]


def play(strategy_names, seed, verbose=False, head_start=None):
    rnd = random.Random(seed)
    sc = make_scenario(rnd)
    n = len(strategy_names)
    bots = [Rookie(s, seed * 7 + i) if s == "Rookie" else STRATS[s](s) for i, s in enumerate(strategy_names)]
    players = [dict(id=i, cash=START_CASH, debt=0.0, staff=1, wage=WAGE, rep=3.0, aw=0.5,
                    inv=0.0, inv_tier="std", slot=0, rent=0, out=False, carry=0.0, price=None,
                    tier="std", ads=0, bid=0, last_d=None, net_hist=[],
                    last_served=0.0, prev_price=None)
               for i in range(n)]
    if head_start:                               # snowball test: player 0 starts ahead
        players[0].update(head_start)
    rev_hist = {i: [] for i in range(n)}
    expected_street = (TRAFFIC_PER_SHOP * n + TRAFFIC_BASE) * 0.72
    for t in range(1, ROUNDS + 1):
        alive = [p for p in players if not p["out"]]
        if not alive:
            break
        # 1. secret simultaneous decisions
        dec = {}
        for p in alive:
            rivals = [dict(id=q["id"], price=q["price"], staff=q["staff"], rep=q["rep"])
                      for q in alive if q is not p]
            forecast = p["last_d"] if p["last_d"] else expected_street / len(alive)
            view = dict(round=t, forecast=forecast, warn=sc["warn"].get(t), rivals=rivals,
                        n_now=sc["n"][t - 1], my_base_rent=SLOT_RENT[p["slot"]], students=sc["students"],
                        renewal=renewal_floor(p, rev_hist) if t in LEASE_ROUNDS and t > 1 else None)
            dec[p["id"]] = bots[p["id"]].decide(p, view)
        for p in alive:
            d = dec[p["id"]]
            p.update(price=d["price"], tier=d["tier"], ads=d["ads"], wage=d["wage"], bid=d["bid"])
            if d["loan"]:
                p["debt"] += d["loan"]; p["cash"] += d["loan"]
        # 2. rent auction on lease rounds
        if t in LEASE_ROUNDS:
            auction(players, t, rev_hist, rnd)
        # 3. labour: hiring, firing, poaching (revealed together)
        for p in alive:
            want = dec[p["id"]]["staff"]
            p["new"] = max(0, want - p["staff"])         # new hires work at 50% in month one
            if want > p["staff"]:
                p["cash"] -= HIRE_COST * (want - p["staff"])
            elif want < p["staff"]:
                p["cash"] -= FIRE_COST * (p["staff"] - want)
            p["staff"] = want
        for p in alive:
            tid = dec[p["id"]]["poach"]
            if tid is None:
                continue
            tgt = players[tid]
            if not tgt["out"] and tgt["staff"] > 0 and p["wage"] >= 1.15 * tgt["wage"]:
                tgt["staff"] -= 1; p["staff"] += 1; p["cash"] -= 800
        # 4. shared suppliers with limited stock, pro-rata when oversold
        n_now = sc["n"][t]
        for tiers, share in ((("eco", "std"), STOCK_MAIN), (("prem",), STOCK_PREM)):
            buyers = [p for p in alive if p["tier"] in tiers]
            orders = {p["id"]: dec[p["id"]]["order"] for p in buyers}
            stock = expected_street * share
            fill = min(1.0, stock / sum(orders.values())) if sum(orders.values()) else 1.0
            for p in buyers:
                tier = p["tier"]
                got = orders[p["id"]] * fill
                short = orders[p["id"]] - got
                cost = got * unit_cost(tier, n_now) + short * unit_cost(tier, n_now) * SPOT_MARKUP
                if p["inv_tier"] != tier:
                    p["inv"] *= 0.5                      # switching beans: half the old stock is wasted
                p["inv"] += orders[p["id"]]; p["inv_tier"] = tier
                p["cash"] -= cost; p["cogs"] = cost
        # 5. demand: two-segment logit with an outside option
        traffic = (TRAFFIC_PER_SHOP * n + TRAFFIC_BASE) * sc["traffic"][t]
        regulars = {}
        for p in alive:
            keep = RETAIN * p["rep"] / 4 * (0.5 if p["prev_price"] and p["price"] > 1.1 * p["prev_price"] else 1)
            regulars[p["id"]] = keep * p["last_served"]
        floating = max(0.0, traffic - sum(regulars.values()))
        demand = dict(regulars)
        attract_total = {p["id"]: 0.0 for p in alive}
        for seg in SEGMENTS:
            st_share = min(0.9, sc["students"] + sc["shift"][t])
            share = st_share if seg["name"] == "students" else 1 - st_share
            weights = {}
            for p in alive:
                q = QUALITY[p["tier"]]
                u = (-seg["e"] * math.log(p["price"] / P_REF) + seg["bq"] * q
                     + seg["br"] * (p["rep"] - 3) + ADS_W * math.log(1 + p["ads"] / ADS_HALF))
                weights[p["id"]] = p["aw"] * SLOT_W[p["slot"]] * math.exp(u)
                attract_total[p["id"]] += weights[p["id"]]
            denom = OUTSIDE * n + sum(weights.values())
            for pid, w in weights.items():
                demand[pid] += floating * share * w / denom
        served, lost = {}, {}
        for p in alive:
            cap = min(capacity(p), p["inv"])
            served[p["id"]] = min(demand[p["id"]], cap)
            lost[p["id"]] = demand[p["id"]] - served[p["id"]]
        spill = SPILL * sum(lost.values())
        spare = {p["id"]: min(capacity(p), p["inv"]) - served[p["id"]] for p in alive}
        w_spare = {pid: attract_total[pid] for pid in spare if spare[pid] > 1}
        for pid, w in w_spare.items():
            extra = min(spare[pid], spill * w / sum(w_spare.values()))
            served[pid] += extra
        # 6. money: revenue, costs, interest, tax; reputation and awareness drift
        for p in alive:
            pid = p["id"]
            rev = served[pid] * p["price"]
            p["inv"] = (p["inv"] - served[pid]) * (1 - SPOIL)
            payroll = p["staff"] * p["wage"] + ANTI_SNOWBALL * max(0, p["staff"] - 3) * 0.15 * p["wage"]
            limit = CREDIT_BASE + CREDIT_K * rev
            rate = RATE_LOW if p["debt"] <= 0.5 * limit else RATE_HIGH
            interest = p["debt"] * rate
            costs = payroll + p["rent"] + p["ads"] + MISC + interest
            p["cash"] += rev - costs
            profit = rev - costs - p["cogs"]
            taxable = max(0.0, profit - p["carry"])
            p["carry"] = max(0.0, p["carry"] - profit) if profit > 0 else p["carry"] - profit
            tax = (TAX_LOW * min(taxable, TAX_STEP) + TAX_HIGH * max(0, taxable - TAX_STEP)
                   if ANTI_SNOWBALL else 0.20 * taxable)
            p["cash"] -= tax
            if p["cash"] < 0:                        # automatic overdraft up to the limit
                need = -p["cash"]
                if p["debt"] + need > limit:
                    p["out"] = True                  # bankrupt: slot freed, customers re-split by logit
                else:
                    p["debt"] += need; p["cash"] = 0
            elif p["debt"] > 0 and p["cash"] > 8000:  # bots repay spare cash
                pay = min(p["debt"], p["cash"] - 8000)
                p["debt"] -= pay; p["cash"] -= pay
            q = QUALITY[p["tier"]]
            fair = P_REF * (1 + 0.3 * q)
            target = (3.0 + 0.3 * q - 3.0 * (lost[pid] / demand[pid] if demand[pid] else 0)
                      - 1.2 * max(0.0, p["price"] / fair - 1.2) + (0.15 if p["wage"] >= 1.1 * WAGE else 0))
            p["rep"] = min(5.0, max(1.0, p["rep"] + 0.4 * (target - p["rep"])))
            p["aw"] += (1 - p["aw"]) * (0.12 + 0.6 * p["ads"] / (p["ads"] + 2500))
            p["last_d"] = demand[pid]
            p["last_served"] = served[pid]
            p["prev_price"] = p["price"]
            rev_hist[pid].append(rev)
            p["net_hist"].append(p["cash"] - p["debt"] + 0.5 * p["inv"] * unit_cost(p["inv_tier"], n_now)
                                 if not p["out"] else -1e9)
            if verbose:
                print(f"  R{t:2d} {strategy_names[pid]:11s} slot{p['slot']} price ${p['price']:.2f} "
                      f"rent ${p['rent']:5.0f} staff {p['staff']} served {served[pid]:5.0f} "
                      f"rev ${rev:6.0f} profit ${profit:6.0f} cash ${p['cash']:6.0f} debt ${p['debt']:6.0f} "
                      f"rep {p['rep']:.2f}{'  BANKRUPT' if p['out'] else ''}")
    final = [p["net_hist"][-1] if p["net_hist"] else -1e9 for p in players]
    for p in players:
        while len(p["net_hist"]) < ROUNDS:
            p["net_hist"].append(-1e9)
    def best(values):                            # ties (identical bots in identical slots) split at random
        top = max(values)
        return rnd.choice([i for i, v in enumerate(values) if v >= top - 1])
    winner = best(final)
    leader_r4 = best([p["net_hist"][min(3, ROUNDS-1)] for p in players])
    leader_r8 = best([p["net_hist"][min(7, ROUNDS-1)] for p in players])
    return dict(final=final, winner=winner, out=[p["out"] for p in players],
                hist=[p["net_hist"] for p in players],
                leader_r4=leader_r4, leader_r8=leader_r8, scenario=sc["kind"], students=sc["students"])


# ---------------- experiments ----------------------------------------------------
def random_fields(matches, seed0=1):
    names = list(STRATS)
    rnd = random.Random(seed0)
    stats = {s: dict(games=0, wins=0.0, out=0, worth=[], fair=0.0) for s in names}
    snow4 = snow8 = 0
    by = {}                                     # (context) -> strategy -> [wins, games, fair]
    for m in range(matches):
        n = rnd.choice([3, 4, 4, 5, 6])
        field = [rnd.choice(names) for _ in range(n)]
        r = play(field, seed=10_000 + m)
        for i, s in enumerate(field):
            st = stats[s]
            st["games"] += 1
            st["fair"] += 1 / n
            st["out"] += r["out"][i]
            if not r["out"][i]:
                st["worth"].append(r["final"][i])
        winners = [i for i in range(n) if field[i] == field[r["winner"]]]
        for i in winners:                       # split the win between identical bots
            stats[field[i]]["wins"] += 1 / len(winners)
        st_kind = ("student street" if r["students"] >= 0.6 else
                   "office street" if r["students"] < 0.45 else "mixed street")
        for ctx in (st_kind, "news: " + r["scenario"]):
            for i, s in enumerate(field):
                c = by.setdefault(ctx, {}).setdefault(s, [0.0, 0, 0.0])
                c[1] += 1
                c[2] += 1 / n
                if field[i] == field[r["winner"]]:
                    c[0] += 1 / len(winners)
        snow4 += r["leader_r4"] == r["winner"]
        sk = by.setdefault("snow", {}).setdefault(r["scenario"], [0, 0])
        sk[0] += r["leader_r4"] == r["winner"]; sk[1] += 1
        snow8 += r["leader_r8"] == r["winner"]
    return stats, snow4 / matches, snow8 / matches, by


def one_vs_field(hero, foe, n=4, matches=200):
    wins = outs = 0
    for m in range(matches):
        r = play([hero] + [foe] * (n - 1), seed=50_000 + m)
        wins += r["winner"] == 0
        outs += r["out"][0]
    return wins / matches, outs / matches


def head_start_test(matches=300):
    """Player 0 starts like someone who won the first two months: rep 3.6, awareness 0.9, +$3,000.
    Snowball = the gap to the others grows faster than the leader's own profit stream explains."""
    out = {}
    for flag in (True, False):
        globals()["ANTI_SNOWBALL"] = flag
        g4, g12, wins = [], [], 0
        for m in range(matches):
            base = play(["Balanced"] * 4, seed=120_000 + m)
            hs = play(["Balanced"] * 4, seed=120_000 + m,
                      head_start=dict(rep=3.6, aw=0.9, cash=START_CASH + 3000))
            g4.append(hs["hist"][0][3] - base["hist"][0][3])
            g12.append(hs["hist"][0][11] - base["hist"][0][11])
            wins += hs["winner"] == 0
        out[flag] = (statistics.mean(g4), statistics.mean(g12), wins / matches)
    globals()["ANTI_SNOWBALL"] = False
    return out


def mirror(strategy, n=4, matches=200):
    outs, worth = 0, []
    for m in range(matches):
        r = play([strategy] * n, seed=90_000 + m)
        outs += sum(r["out"])
        worth += [w for w, o in zip(r["final"], r["out"]) if not o]
    return outs / (matches * n), (statistics.median(worth) if worth else float("nan"))



class Rex(Bot):
    """'Reckless Rex' (BOT): price = unit cost + $2.50, 4 baristas, $1,500 ads -> burns cash, dies in R3-5 of the blitz."""
    hedge = False
    def decide(self, me, view):
        return dict(price=unit_cost('std', view["n_now"]) + 2.5, tier='std', ads=1500, wage=WAGE, staff=4,
                    order=self.order_for(me, view["forecast"] * 1.2, view["warn"]),
                    bid=self.bid_for(view, SLOT_RENT[0] * 1.2), loan=0, poach=None)


class Kamikaze(Bot):
    """Loud discounter: 50 cents under the cheapest rival, eco beans, 4 baristas, $2,500 ads."""
    hedge = False
    def decide(self, me, view):
        prices = [r["price"] for r in view["rivals"] if r["price"]]
        floor = unit_cost("eco", view["n_now"]) + 0.3
        price = max(floor, (min(prices) - 0.5) if prices else P_REF * 0.8)
        return dict(price=price, tier="eco", ads=2500, wage=WAGE, staff=4,
                    order=self.order_for(me, view["forecast"] * 1.5, view["warn"]),
                    bid=self.bid_for(view, SLOT_RENT[0] * 1.3), loan=0, poach=None)


STRATS["Rex"], STRATS["Kamikaze"] = Rex, Kamikaze
SPIKE = (2, [1.35, 1.35, 1.25, 1.12, 1.05])   # forecast in round 2, shock from round 3


def first_bk_round(r):
    rounds = [next(k + 1 for k, v in enumerate(h) if v <= -1e8) for h, o in zip(r["hist"], r["out"]) if o]
    return min(rounds) if rounds else None


def room(field, matches=2000, seed0=700_000):
    any_bk, first, per, wins, rex_r35 = 0, [], {}, {}, 0
    for m in range(matches):
        r = play(field, seed=seed0 + m)
        fb = first_bk_round(r)
        if fb:
            any_bk += 1; first.append(fb)
        for i, s in enumerate(field):
            a = per.setdefault(s, [0, 0]); a[0] += r["out"][i]; a[1] += 1
            if s == "Rex" and r["out"][i]:
                rr = next(k + 1 for k, v in enumerate(r["hist"][i]) if v <= -1e8)
                rex_r35 += 3 <= rr <= 5
        w = field[r["winner"]]; wins[w] = wins.get(w, 0) + 1
    return dict(any=100 * any_bk / matches, first=statistics.median(first) if first else None,
                bankrupt={s: round(100 * a / b) for s, (a, b) in per.items()},
                wins={s: round(100 * v / matches) for s, v in sorted(wins.items())},
                rex_r35=100 * rex_r35 / (matches * max(1, field.count("Rex"))))


def fields_balance(names, matches=3000, seed0=500_000, seed_rnd=11):
    rnd = random.Random(seed_rnd); st = {s: [0.0, 0, 0] for s in names}
    for m in range(matches):
        n = rnd.choice([3, 4, 4, 5, 6]); field = [rnd.choice(names) for _ in range(n)]
        r = play(field, seed=seed0 + m)
        winners = [i for i in range(n) if field[i] == field[r["winner"]]]
        for i, s in enumerate(field):
            st[s][1] += 1; st[s][2] += r["out"][i]
        for i in winners:
            st[field[i]][0] += 1 / len(winners)
    return {s: (round(100 * w / g, 1), round(100 * o / g, 1)) for s, (w, g, o) in st.items()}


if __name__ == "__main__":
    six = ["Discounter", "Premium", "Blitz", "Balanced", "Undercutter", "Adaptive"]
    print("A) Is a bankruptcy likely in the demo? Rookie = first-time human proxy. Fixed news: +35% from round 3.")
    print("   rounds start  credit-limit        | room                         | P(>=1 bankrupt) | median 1st | bankrupt % by type | wins %")
    DEMO_SPIKE = SPIKE
    for rounds, cash, cb, ck in ((6, 12000, 6000, 0.8), (6, 8000, 4000, 0.5), (6, 8000, 2000, 0.3), (12, 12000, 6000, 0.8)):
        ROUNDS, START_CASH, CREDIT_BASE, CREDIT_K = rounds, cash, cb, ck
        for name, f in (("4 jury", ["Rookie"] * 4),
                        ("2 jury + Discounter + Premium", ["Rookie", "Rookie", "Discounter", "Premium"]),
                        ("4 jury + Reckless Rex", ["Rookie"] * 4 + ["Rex"]),
                        ("3 jury + Reckless Rex", ["Rookie"] * 3 + ["Rex"])):
            r = room(f)
            extra = f" | Rex dies in R3-5: {r['rex_r35']:.1f}%" if "Rex" in f else ""
            print(f"   {rounds:2d}  ${cash:>6,}  {cb}+{ck}x revenue | {name:28s} | {r['any']:5.1f}% | {r['first']} | "
                  f"{r['bankrupt']} | {r['wins']}{extra}")
    print("\nB) Balance of report 24's six strategies + Kamikaze in random fields of 3-6 bots (win %, bankrupt %)")
    DEMO_SPIKE = None
    for rounds, cash, cb, ck in ((12, 12000, 6000, 0.8), (6, 8000, 4000, 0.5), (6, 8000, 2000, 0.3)):
        ROUNDS, START_CASH, CREDIT_BASE, CREDIT_K = rounds, cash, cb, ck
        print(f"   {rounds} rounds, start ${cash:,}, credit {cb}+{ck}x revenue:", fields_balance(six + ["Kamikaze"]))
