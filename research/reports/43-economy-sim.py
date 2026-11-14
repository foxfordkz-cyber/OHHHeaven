#!/usr/bin/env python3
"""Street War: shared-street market model and balance tests (researcher 43).

One command (from the repository root):
    python3 research/reports/43-economy-sim.py

Options:
    --config v1      first-guess constants ("before" in the report)
    --matches N      matches per tournament (default 2000)
    --quick          400 matches per tournament
    --example        print one match round by round
    --extra          only the event-cap and Corner Supply checks (section 6 of the report)

Python 3.8+, standard library only. Every number below is a game-design
constant; the report (43-economy-sim.md) says which ones are anchored to
outside data and where that data comes from.

Model in one paragraph: 4 coffee shops share one real street for 12 rounds
(round = one month). Buyers come from two segments (price-sensitive and
quality-seeking) whose mix is read from the real street. Each shop's pull is
a logit of price, quality tier, reputation, advertising, awareness and spot
on the street; an outside option lets buyers leave the street. Capacity is
limited by staff, turned-away buyers partly spill to neighbours, last month's
buyers partly come back as regulars. Costs: rent from a round-0 draft, wages,
stock from shared suppliers with limited volume, ads, fixed costs, overdraft
interest and a flat profit tax. A shop whose overdraft exceeds the limit is
bankrupt and leaves the match. From round 3 each shop may play one card:
Poach, Smear or Corner Supply (attacks) or Retention Bonus, PR Response or
Forward Contract (defences). Events from real data move the constants.
"""
import argparse
import math
import random
import statistics
from collections import defaultdict

# --------------------------------------------------------------------- constants
# V1 = first-guess constants ("before"). Later versions change only the keys listed,
# so the tuning log in the report can be re-run: --config v1 / v2 / ... / final.
V1 = dict(
    rounds=12, players=4,
    p_ref=6.0,                                    # reference ticket, $
    traffic_per_seat=2600,                        # potential buyers per round per seat
    budget_share=(0.35, 0.75),                    # price-sensitive share, read from the street
    seg_budget=dict(e=3.0, bq=0.10, br=0.35),     # price sensitivity, quality weight, reputation weight
    seg_quality=dict(e=1.3, bq=0.70, br=0.70),
    quality={"eco": -0.5, "std": 0.0, "prem": 1.0},
    speed={"eco": 1.1, "std": 1.0, "prem": 0.85},  # premium drinks take longer
    unit_cost={"eco": (0.45, 0.85), "std": (0.60, 1.20), "prem": (0.90, 1.80)},  # a + b * N
    outside=4 / 3,                                # weight of "buy nothing / leave the street"
    ads_w=0.30, ads_half=400,                     # utility += ads_w * ln(1 + ads / ads_half)
    aw_start=0.5, aw_base=0.12, aw_ads=0.6, aw_half=2500,
    retain=0.5,                                   # regulars = retain * rep/4 * last buyers
    price_jump=1.10,                              # raising price more than 10% halves regulars
    spill=0.5,                                    # turned-away buyers who try a neighbour
    spot_w=[1.00, 0.90, 0.85, 0.75, 0.60],        # corner, middle, middle, end, alley
    spot_rent=[2200, 1900, 1800, 1500, 1100],     # base rent per round, $
    rent_cap=1.5,                                 # a winning bid pays at most 1.5x base
    owner_cap=500, staff_cap=1300, wage=2600, hire=400, fire=1000,
    opex=900, tax=0.20,
    start_cash=12000, overdraft=8000, rate=0.02,  # rate per round on overdraft debt
    stock_main=1.15, stock_prem=0.30, spot_markup=1.4,   # supplier stock as share of expected sales
    rep_inertia=0.4, rep_q=0.3, rep_lost=3.0, rep_over=1.2, rep_wage=0.15,
    noise=0.0,                                    # sigma of a lognormal shock to each shop's pull per round
    overhead=0.0, overhead_from=3,                # extra wage share per employee above 3 (managing a bigger team)
    # cards (report 25): one per round from round 3, at most 2 attacks on one target per round
    attacks_from=3, max_hits=2, repeat_markup=1.5, rally=0.2,
    poach_cost=1500, poach_wage=1.15, retain_cost=600,
    smear_cost=2000, smear_hit=0.30, smear_backfire=0.20, smear_aw=0.10, pr_cost=700, pr_block=2 / 3,
    corner_markup=1.10, corner_share=0.40, corner_spoil=0.20, forward_cost=300, forward_rounds=3,
)

V2 = dict(V1, poach_cost=600, retain_cost=250, smear_cost=900, pr_cost=300)   # attacks cheaper
# FINAL = V2 + labour/rent realism + 8% demand noise (report 05) + staff overhead (report 24)
# + the result of a random search (180 candidates) and a hill-climb (85 steps) over 15 constants.
# V3 = the balanced but too harsh street: average net margin -6%..+1% (report, section 5).
V3 = dict(
    V2,
    staff_cap=1400, rent_cap=1.25, noise=0.08, overhead=0.15,
    seg_budget=dict(e=3.95, bq=0.10, br=0.35),
    seg_quality=dict(e=1.42, bq=0.60, br=0.70),
    speed={"eco": 1.1, "std": 1.0, "prem": 0.76},
    ads_w=0.24, ads_half=600, aw_ads=0.45, aw_half=3500, aw_base=0.075, aw_start=0.40,
    spot_w=[1.00, 0.76, 0.71, 0.61, 0.46],
    smear_hit=0.42, poach_cost=600, smear_cost=700, rep_q=0.13, stock_prem=0.27, retain=0.46,
)
# FINAL = V3 calibrated to coffee-shop benchmarks (rent ~15% of revenue, net margin of viable shops 3-9%)
# and to report 25's rule "a counter costs 2-3x less than the attack".
FINAL = dict(
    V3,
    spot_rent=[1650, 1425, 1350, 1125, 825], opex=700,
    poach_cost=900, retain_cost=350, smear_cost=1000, pr_cost=400,
    start_cash=9000, overdraft=6000,
    ads_w=0.22, aw_ads=0.40,
)
CONFIGS = {"v1": V1, "v2": V2, "v3": V3, "final": FINAL}

# --------------------------------------------------------------------- events
# kind -> which constant moves; size by strength S/M/L; duration in rounds; warning a round ahead.
# L sizes are the balance caps found in the report: commodity <= +25%, festival <= +20%, wages <= +5%.
EVENT_TYPES = {
    "commodity_up":   dict(kind="N",       size={"S": 0.08, "M": 0.15, "L": 0.25}, dur=3, warn=True),
    "commodity_down": dict(kind="N",       size={"S": -0.08, "M": -0.15, "L": -0.25}, dur=3, warn=True),
    "shortage":       dict(kind="stock",   size={"S": 0.20, "M": 0.35, "L": 0.50}, dur=2, warn=True),
    "rain":           dict(kind="traffic", size={"S": -0.05, "M": -0.08, "L": -0.11}, dur=1, warn=True),
    "festival":       dict(kind="traffic", size={"S": 0.10, "M": 0.15, "L": 0.20}, dur=1, warn=True),
    "mood_down":      dict(kind="mood",    size={"S": -0.04, "M": -0.06, "L": -0.10}, dur=3, warn=False),
    "rate_hike":      dict(kind="rate",    size={"S": 0.0025, "M": 0.005, "L": 0.01}, dur=99, warn=True),
    "wage_rule":      dict(kind="wage",    size={"S": 0.02, "M": 0.03, "L": 0.05}, dur=99, warn=True),
    "energy":         dict(kind="opex",    size={"S": 0.10, "M": 0.20, "L": 0.30}, dur=3, warn=True),
}
DECK_WEIGHTS = {"commodity_up": 3, "commodity_down": 1, "shortage": 2, "rain": 1, "festival": 1,
                "mood_down": 1, "rate_hike": 1, "wage_rule": 1, "energy": 1}


def envelope(k, dur):
    """Full strength for the first ceil(dur/2) rounds, then a linear fade (report 23)."""
    full = math.ceil(dur / 2)
    if k < full:
        return 1.0
    return max(0.0, (dur - k) / (dur - full + 1))


def make_deck(rnd, mode):
    """mode: 'none', 'standard' (3 events, S/M, rarely L) or 'heavy' (4 events, all L)."""
    if mode == "none":
        return []
    if isinstance(mode, tuple):                   # ('force', type, size): one event at round 5
        return [(mode[1], mode[2], 5)]
    slots = [(2, 3), (5, 6), (8, 9, 10)] if mode == "standard" else [(2, 3), (5, 6), (7, 8), (9, 10)]
    names, weights = zip(*DECK_WEIGHTS.items())
    deck = []
    for slot in slots:
        etype = rnd.choices(names, weights)[0]
        size = "L" if mode == "heavy" else ("L" if rnd.random() < 0.2 else rnd.choice("SM"))
        deck.append((etype, size, rnd.choice(slot)))
    return deck


def environment(deck, t):
    """Constants of round t after all active events, plus warnings for round t+1."""
    env = dict(N=1.0, stock=1.0, traffic=1.0, budget_shift=0.0, e_mult=1.0,
               rate_add=0.0, wage=1.0, opex=1.0)
    warn_next = set()
    for etype, size, start in deck:
        spec = EVENT_TYPES[etype]
        m = spec["size"][size]
        if spec["warn"] and start == t + 1:
            warn_next.add(etype)
        k = t - start
        if k < 0 or k >= spec["dur"]:
            continue
        f = envelope(k, spec["dur"]) if spec["kind"] in ("N", "stock", "opex", "mood") else 1.0
        if spec["kind"] == "N":
            env["N"] *= 1 + m * f
        elif spec["kind"] == "stock":
            env["stock"] *= 1 - m * f
        elif spec["kind"] == "traffic":
            env["traffic"] *= 1 + m
        elif spec["kind"] == "mood":
            env["traffic"] *= 1 + m * f
            env["budget_shift"] += 0.10 * f
            env["e_mult"] *= 1 + 0.5 * abs(m) * f
        elif spec["kind"] == "rate":
            env["rate_add"] += m
        elif spec["kind"] == "wage":
            env["wage"] *= 1 + m
        elif spec["kind"] == "opex":
            env["opex"] *= 1 + m * f
    return env, warn_next


# --------------------------------------------------------------------- bots
def staff_for(c, forecast, tier, factor):
    need = forecast * factor / c["speed"][tier] - c["owner_cap"]
    return max(0, min(6, math.ceil(need / c["staff_cap"])))


def bot_dump(me, view, c):
    """Price war: 5% under the cheapest rival, never below $4.50; cheap beans; no cards."""
    rivals = [r["price"] for r in view["rivals"] if r["price"]]
    price = max(4.5, 0.95 * min(rivals)) if rivals else 0.85 * c["p_ref"]
    return dict(price=price, tier="eco", wage=1.0, ads=200,
                staff=staff_for(c, view["forecast"], "eco", 1.1), bid=c["spot_rent"][3], card=None)


def bot_premium(me, view, c):
    """Premium beans, +35% price, well-paid staff (cannot be poached at 1.15x)."""
    card = ("pr", None) if view["smeared_last"] else None
    return dict(price=1.35 * c["p_ref"], tier="prem", wage=1.15, ads=500,
                staff=staff_for(c, view["forecast"], "prem", 1.0), bid=c["spot_rent"][1] * 1.05, card=card)


def bot_ads(me, view, c):
    """Heavy advertising and the best spot; reference price."""
    ads = 2000 if view["round"] <= 4 else 1000
    return dict(price=c["p_ref"], tier="std", wage=1.0, ads=ads,
                staff=staff_for(c, view["forecast"], "std", 1.1), bid=c["spot_rent"][0] * 1.25, card=None)


def bot_cautious(me, view, c):
    """Slightly above reference price, never overstaffs, buys defences when threatened."""
    card = None
    if view["poached_recent"]:
        card = ("retain", None)
    elif view["smeared_last"]:
        card = ("pr", None)
    elif (view["warn_next"] & {"commodity_up", "shortage"} or view["aggressor_seen"]) and not view["forward_active"]:
        card = ("forward", None)
    ads = 300 if me["cash"] > 4000 else 0
    return dict(price=1.05 * c["p_ref"], tier="std", wage=1.0, ads=ads,
                staff=staff_for(c, view["forecast"], "std", 0.95), bid=c["spot_rent"][2], card=card)


def bot_aggressor(me, view, c):
    """Attacks every round from round 3: Corner Supply before shortages, else Poach, else Smear."""
    card = None
    if view["round"] >= c["attacks_from"]:
        alive = [r for r in view["rivals"] if r["alive"]]
        if view["warn_next"] & {"commodity_up", "shortage"} or view["shortage_now"]:
            card = ("corner", None)
        else:
            prey = [r for r in alive if r["staff"] >= 2 and r["id"] not in me["failed_poach"]]
            if prey:
                card = ("poach", max(prey, key=lambda r: r["sales"])["id"])
            else:
                soft = [r for r in alive if c["quality"][r["tier"]] <= c["quality"]["std"]]
                if soft:
                    card = ("smear", max(soft, key=lambda r: r["sales"])["id"])
    poaching = card is not None and card[0] == "poach"
    staff = max(0, staff_for(c, view["forecast"], "std", 1.05) - (1 if poaching else 0))
    return dict(price=0.95 * c["p_ref"], tier="std", wage=1.15, ads=800,
                staff=staff, bid=c["spot_rent"][0] * 1.3, card=card)


def bot_rookie(me, view, c):
    """Random but plausible moves: a first-time player (tested separately)."""
    r = me["rnd"]
    tier = r.choice(["eco", "std", "std", "prem"])
    card = r.choice([None, None, ("pr", None), ("forward", None)])
    return dict(price=c["p_ref"] * r.uniform(0.75, 1.4), tier=tier, wage=r.choice([1.0, 1.0, 1.15]),
                ads=r.choice([0, 300, 800, 1500, 2500]),
                staff=staff_for(c, view["forecast"], tier, r.uniform(0.8, 1.5)),
                bid=r.choice(c["spot_rent"][:4]), card=card)


BOTS = {"Dumping": bot_dump, "Premium": bot_premium, "Advertiser": bot_ads,
        "Cautious": bot_cautious, "Aggressor": bot_aggressor, "Rookie": bot_rookie}
FIVE = ["Dumping", "Premium", "Advertiser", "Cautious", "Aggressor"]


# --------------------------------------------------------------------- one match
def play(c, lineup, seed, deck_mode="standard", verbose=False, head_start=None):
    rnd = random.Random(seed)
    n = len(lineup)
    budget = rnd.uniform(*c["budget_share"])
    deck = make_deck(rnd, deck_mode)
    expected_sales = c["traffic_per_seat"] * c["players"] * 0.75
    P = [dict(id=i, strat=s, cash=float(c["start_cash"]), debt=0.0, staff=1, new=0, wage=1.0,
              rep=3.0, aw=c["aw_start"], spot=None, rent=0.0, alive=True, life=c["rounds"],
              price=None, prev_price=None, tier="std", ads=0.0, last_d=None, last_served=0.0,
              inv=0.0, carry=0.0, forward=0, forward_n=1.0, failed_poach=set(),
              hits_log=[], smeared_last=False, net=[], rnd=random.Random(seed * 31 + i), acc=defaultdict(float))
         for i, s in enumerate(lineup)]
    if head_start:
        P[0].update(head_start)
    aggressor_seen = False
    shortage_now = False
    attack_log = []                                   # (round, attacker, card, target)
    last_target = {}

    # round 0: draft of spots (sealed bids, best bid picks first, pays its bid up to 1.5x base)
    bids = {p["id"]: BOTS[p["strat"]](p, dict(round=0, forecast=expected_sales / n, rivals=[],
                                                  warn_next=set(), smeared_last=False, poached_recent=False,
                                                  aggressor_seen=False, forward_active=False,
                                                  shortage_now=False), c)["bid"] for p in P}
    ties = {p["id"]: rnd.random() for p in P}
    free = list(range(len(c["spot_w"])))
    for p in sorted(P, key=lambda p: (bids[p["id"]], ties[p["id"]]), reverse=True):
        b = bids[p["id"]]
        spot = next((s for s in free if b >= c["spot_rent"][s]), free[-1])
        free.remove(spot)
        p["spot"] = spot
        base = c["spot_rent"][spot]
        p["rent"] = min(max(base, b), base * c["rent_cap"])

    for t in range(1, c["rounds"] + 1):
        alive = [p for p in P if p["alive"]]
        if len(alive) <= 1:
            break
        env, warn_next = environment(deck, t)
        W = c["wage"] * env["wage"]
        shortage_now = env["stock"] < 0.999
        # 1. secret simultaneous decisions on last round's public information
        dec = {}
        for p in alive:
            rivals = [dict(id=q["id"], alive=q["alive"], price=q["price"], tier=q["tier"], staff=q["staff"],
                           sales=q["last_served"]) for q in P if q is not p and q["alive"]]
            view = dict(round=t, rivals=rivals, warn_next=warn_next, shortage_now=shortage_now,
                        forecast=p["last_d"] if p["last_d"] else expected_sales / n,
                        smeared_last=p["smeared_last"],
                        poached_recent=any(a[3] == p["id"] and a[2] == "poach" and a[0] >= t - 2 for a in attack_log),
                        aggressor_seen=aggressor_seen, forward_active=p["forward"] > 0)
            dec[p["id"]] = BOTS[p["strat"]](p, view, c)
        for p in alive:
            d = dec[p["id"]]
            p["prev_price"], p["price"] = p["price"], d["price"]
            p["tier"], p["wage"], p["ads"] = d["tier"], d["wage"], d["ads"]
            p["round_cost"] = 0.0
            p["cogs"] = 0.0
            want = d["staff"]
            p["new"] = max(0, want - p["staff"])
            p["round_cost"] += c["hire"] * max(0, want - p["staff"]) + c["fire"] * max(0, p["staff"] - want)
            p["staff"] = want
            p["smeared_last"] = False
        # 2. cards: defences first, then attacks (report 25 limits)
        defence = defaultdict(set)
        hits = defaultdict(int)
        corner_by = []
        for p in alive:
            card = dec[p["id"]]["card"] if t >= c["attacks_from"] else None
            if not card:
                continue
            kind, target = card
            if kind == "retain":
                defence[p["id"]].add("retain"); p["round_cost"] += c["retain_cost"]
            elif kind == "pr":
                defence[p["id"]].add("pr"); p["round_cost"] += c["pr_cost"]
            elif kind == "forward":
                p["forward"], p["forward_n"] = c["forward_rounds"], env["N"]
                p["round_cost"] += c["forward_cost"]
        for p in alive:
            card = dec[p["id"]]["card"] if t >= c["attacks_from"] else None
            if not card or card[0] not in ("poach", "smear", "corner"):
                continue
            kind, target = card
            aggressor_seen = True
            if kind == "corner":
                corner_by.append(p)
                attack_log.append((t, p["id"], "corner", None))
                continue
            tgt = P[target]
            if not tgt["alive"] or hits[target] >= c["max_hits"]:
                continue
            mult = c["repeat_markup"] if last_target.get(p["id"]) == (t - 1, target) else 1.0
            last_target[p["id"]] = (t, target)
            hits[target] += 1
            attack_log.append((t, p["id"], kind, target))
            if kind == "poach":
                p["round_cost"] += c["poach_cost"] * mult
                ok = (p["wage"] >= c["poach_wage"] * tgt["wage"] and tgt["staff"] > 0
                      and "retain" not in defence[target])
                if ok:
                    tgt["staff"] -= 1; p["staff"] += 1
                else:
                    p["failed_poach"].add(target)
            elif kind == "smear":
                p["round_cost"] += c["smear_cost"] * mult
                hit = c["smear_hit"]
                if c["quality"][tgt["tier"]] >= c["quality"][p["tier"]]:
                    hit *= 0.5
                    p["rep"] = max(1.0, p["rep"] - c["smear_backfire"])
                if "pr" in defence[target]:
                    hit *= 1 - c["pr_block"]
                tgt["rep"] = max(1.0, tgt["rep"] - hit)
                tgt["smeared_last"] = True
                p["aw"] = min(1.0, p["aw"] + c["smear_aw"])
        for tid, k in hits.items():
            if k >= 2:
                P[tid]["rally"] = c["rally"]          # locals rally behind a shop hit twice
        # 3. demand: regulars + two-segment logit with an outside option
        traffic = c["traffic_per_seat"] * c["players"] * env["traffic"]
        regulars = {}
        for p in alive:
            jump = p["prev_price"] and p["price"] > c["price_jump"] * p["prev_price"]
            regulars[p["id"]] = c["retain"] * p["rep"] / 4 * (0.5 if jump else 1.0) * p["last_served"]
        free_buyers = max(0.0, traffic - sum(regulars.values()))
        demand = dict(regulars)
        pull = defaultdict(float)
        b_share = min(0.9, max(0.1, budget + env["budget_shift"]))
        shock = {p["id"]: math.exp(rnd.gauss(0, c["noise"])) if c["noise"] else 1.0 for p in alive}
        for seg, share in ((c["seg_budget"], b_share), (c["seg_quality"], 1 - b_share)):
            e = seg["e"] * (env["e_mult"] if seg is c["seg_budget"] else 1.0)
            w = {}
            for p in alive:
                u = (-e * math.log(p["price"] / c["p_ref"]) + seg["bq"] * c["quality"][p["tier"]]
                     + seg["br"] * (p["rep"] - 3) + c["ads_w"] * math.log(1 + p["ads"] / c["ads_half"]))
                w[p["id"]] = p["aw"] * c["spot_w"][p["spot"]] * math.exp(u) * shock[p["id"]]
                pull[p["id"]] += w[p["id"]]
            denom = c["outside"] + sum(w.values())
            for pid, wi in w.items():
                demand[pid] += free_buyers * share * wi / denom
        cap = {p["id"]: (c["owner_cap"] + c["staff_cap"] * max(0.0, p["staff"] - 0.5 * min(p["new"], p["staff"])))
               * c["speed"][p["tier"]] for p in alive}
        served = {pid: min(demand[pid], cap[pid]) for pid in demand}
        lost = {pid: demand[pid] - served[pid] for pid in demand}
        spill = c["spill"] * sum(lost.values())
        spare = {pid: cap[pid] - served[pid] for pid in served if cap[pid] - served[pid] > 1}
        if spare:
            tot = sum(pull[pid] for pid in spare)
            for pid in spare:
                served[pid] += min(spare[pid], spill * pull[pid] / tot)
        # 4. shared suppliers: forward contracts first, corner next, the rest pro rata, shortfall at spot price
        N = env["N"]
        for supplier, tiers, share in (("main", ("eco", "std"), c["stock_main"]), ("prem", ("prem",), c["stock_prem"])):
            left = expected_sales * share * env["stock"]
            buyers = [p for p in alive if p["tier"] in tiers]
            if supplier == "main":
                for p in corner_by:
                    if p["tier"] not in tiers:
                        continue
                    take = min(left, c["corner_share"] * expected_sales * share * env["stock"])
                    a, b = c["unit_cost"][p["tier"]]
                    p["cogs"] += take * (a + b * N) * c["corner_markup"]
                    p["inv"] += take
                    left -= take
            need = {}
            for p in buyers:
                use = min(p["inv"], served[p["id"]])
                p["inv"] -= use
                need[p["id"]] = served[p["id"]] - use
            for p in buyers:
                if p["forward"] > 0 and need[p["id"]] > 0:
                    got = min(need[p["id"]], left)
                    a, b = c["unit_cost"][p["tier"]]
                    p["cogs"] += got * (a + b * p["forward_n"])
                    p["cogs"] += (need[p["id"]] - got) * (a + b * N) * c["spot_markup"]
                    left -= got
                    need[p["id"]] = 0.0
            total = sum(need.values())
            fill = min(1.0, left / total) if total > 0 else 1.0
            for p in buyers:
                a, b = c["unit_cost"][p["tier"]]
                got = need[p["id"]] * fill
                p["cogs"] += got * (a + b * N) + (need[p["id"]] - got) * (a + b * N) * c["spot_markup"]
        # 5. money, tax, overdraft, bankruptcy; reputation and awareness drift
        for p in alive:
            pid = p["id"]
            revenue = served[pid] * p["price"]
            payroll = W * p["wage"] * (p["staff"] + c["overhead"] * max(0, p["staff"] - c["overhead_from"]))
            interest = p["debt"] * (c["rate"] + env["rate_add"])
            acc = p["acc"]
            for key, val in (("revenue", revenue), ("cogs", p["cogs"]), ("labour", payroll), ("rent", p["rent"]),
                             ("ads", p["ads"]), ("fixed", c["opex"] * env["opex"]), ("interest", interest),
                             ("cards_hiring", p["round_cost"])):
                acc[key] += val
            profit = (revenue - p["cogs"] - p["round_cost"] - payroll - p["rent"] - p["ads"]
                      - c["opex"] * env["opex"] - interest)
            taxable = max(0.0, profit - p["carry"])
            p["carry"] = max(0.0, p["carry"] - profit) if profit > 0 else p["carry"] - profit
            cash = p["cash"] - p["debt"] + profit - c["tax"] * taxable
            p["cash"], p["debt"] = (cash, 0.0) if cash >= 0 else (0.0, -cash)
            if p["debt"] > c["overdraft"]:
                p["alive"], p["life"] = False, t
            q = c["quality"][p["tier"]]
            fair = c["p_ref"] * (1 + 0.3 * q)
            target = (3.0 + c["rep_q"] * q - c["rep_lost"] * (lost[pid] / demand[pid] if demand[pid] else 0.0)
                      - c["rep_over"] * max(0.0, p["price"] / fair - 1.2)
                      + (c["rep_wage"] if p["wage"] >= 1.1 else 0.0) + p.pop("rally", 0.0))
            p["rep"] = min(5.0, max(1.0, p["rep"] + c["rep_inertia"] * (target - p["rep"])))
            p["aw"] += (1 - p["aw"]) * (c["aw_base"] + c["aw_ads"] * p["ads"] / (p["ads"] + c["aw_half"]))
            p["inv"] *= 1 - c["corner_spoil"]
            p["forward"] = max(0, p["forward"] - 1)
            p["last_d"], p["last_served"] = demand[pid], served[pid]
            if verbose:
                card = dec[pid]["card"] if t >= c["attacks_from"] else None
                print(f"  R{t:2d} {p['strat']:10s} spot{p['spot']} ${p['price']:.2f} {p['tier']:4s} staff {p['staff']} "
                      f"ads ${p['ads']:4.0f} sold {served[pid]:5.0f} rev ${revenue:6.0f} profit ${profit:6.0f} "
                      f"cash ${p['cash']:6.0f} debt ${p['debt']:5.0f} rep {p['rep']:.2f}"
                      f"{'  card ' + card[0] if card else ''}{'  BANKRUPT' if not p['alive'] else ''}")
        for p in P:
            p["net"].append(p["cash"] - p["debt"] if p["alive"] else -1e9 + p["life"])
        if verbose and (warn_next or env["N"] != 1.0 or env["stock"] != 1.0):
            print(f"       events: N={env['N']:.2f} stock={env['stock']:.2f} traffic={env['traffic']:.2f} "
                  f"next: {sorted(warn_next)}")
    survivors = [p for p in P if p["alive"]]
    if survivors:
        top = max(p["cash"] - p["debt"] for p in survivors)
        winner = rnd.choice([p["id"] for p in survivors if p["cash"] - p["debt"] >= top - 1])
    else:
        last = max(p["life"] for p in P)
        winner = rnd.choice([p["id"] for p in P if p["life"] == last])
    for p in P:
        while len(p["net"]) < c["rounds"]:
            p["net"].append(p["net"][-1] if p["net"] else 0.0)
    leader4 = max(range(n), key=lambda i: (P[i]["net"][3], rnd.random()))
    return dict(winner=winner, alive=[p["alive"] for p in P], life=[p["life"] for p in P],
                worth=[p["cash"] - p["debt"] if p["alive"] else None for p in P],
                budget=budget, leader4=leader4, deck=deck, acc=[p["acc"] for p in P])


# --------------------------------------------------------------------- tournaments
def tournament(c, matches, deck_mode="standard", lineups=None, seed0=0):
    """Default: every match has 4 different strategies out of 5 (5 line-ups in turn), fair share 25%."""
    if lineups is None:
        lineups = [[s for s in FIVE if s != out] for out in FIVE]
    st = {s: dict(games=0, wins=0.0, bankrupt=0, life=0, bk_round=0, worth=[], acc=defaultdict(float)) for s in FIVE}
    street = defaultdict(lambda: defaultdict(lambda: [0.0, 0]))
    by_lineup = defaultdict(lambda: defaultdict(float))
    snow = 0
    for m in range(matches):
        rnd = random.Random(seed0 + m)
        lineup = list(lineups[m % len(lineups)]) if lineups != "random" else [rnd.choice(FIVE) for _ in range(4)]
        rnd.shuffle(lineup)
        r = play(c, lineup, seed=seed0 + 7919 * m + 1, deck_mode=deck_mode)
        same = [i for i in range(4) if lineup[i] == lineup[r["winner"]]]
        kind = "budget" if r["budget"] >= 0.6 else "quality" if r["budget"] < 0.45 else "mixed"
        missing = tuple(s for s in FIVE if s not in lineup)
        by_lineup[missing]["_n"] += 1
        by_lineup[missing][lineup[r["winner"]]] += 1
        for i, s in enumerate(lineup):
            x = st[s]
            x["games"] += 1
            for key, val in r["acc"][i].items():
                x["acc"][key] += val
            if not r["alive"][i]:
                x["bankrupt"] += 1
                x["bk_round"] += r["life"][i]
            x["life"] += r["life"][i]
            if r["alive"][i]:
                x["worth"].append(r["worth"][i])
            won = (1 / len(same)) if i in same else 0.0
            x["wins"] += won
            street[kind][s][0] += won
            street[kind][s][1] += 1
        snow += r["leader4"] == r["winner"]
    st["_lineups"] = by_lineup
    return st, street, snow / matches


def table(st):
    rows = []
    for s in FIVE:
        x = st[s]
        if not x["games"]:
            continue
        rows.append((s, x["games"], 100 * x["wins"] / x["games"], 100 * x["bankrupt"] / x["games"],
                     x["life"] / x["games"], (x["bk_round"] / x["bankrupt"]) if x["bankrupt"] else float("nan"),
                     statistics.median(x["worth"]) if x["worth"] else float("nan")))
    return rows


def print_table(title, st):
    print(title)
    print(f"   {'strategy':11s} {'games':>6s} {'win %':>6s} {'bankrupt %':>10s} {'avg life':>9s} "
          f"{'bankrupt in':>12s} {'median worth $':>15s}")
    for s, g, w, b, life, bk, worth in table(st):
        bk_txt = f"round {bk:4.1f}" if bk == bk else "-"
        print(f"   {s:11s} {g:6d} {w:6.1f} {b:10.1f} {life:9.2f} {bk_txt:>12s} {worth:15,.0f}")
    worst = max(table(st), key=lambda r: r[2])
    print(f"   max win share: {worst[0]} {worst[2]:.1f}%  ->  {'PASS' if worst[2] <= 35 else 'FAIL'} (limit 35%)")


def perturb(c, key, f):
    """Copy of config c with one constant (or a group) multiplied by f."""
    c = dict(c)
    if key == "e_budget":
        c["seg_budget"] = dict(c["seg_budget"], e=c["seg_budget"]["e"] * f)
    elif key == "e_quality":
        c["seg_quality"] = dict(c["seg_quality"], e=c["seg_quality"]["e"] * f)
    elif key == "bq_quality":
        c["seg_quality"] = dict(c["seg_quality"], bq=c["seg_quality"]["bq"] * f)
    elif key == "spot_rent":
        c["spot_rent"] = [x * f for x in c["spot_rent"]]
    elif key == "attack_costs":
        c["poach_cost"], c["smear_cost"] = c["poach_cost"] * f, c["smear_cost"] * f
    elif key == "commodity_share":
        c["unit_cost"] = {k: (a, b * f) for k, (a, b) in c["unit_cost"].items()}
    else:
        c[key] = c[key] * f
    return c


def extra_checks(c):
    """Event-size caps and the Corner Supply A/B test (report, section 6)."""
    base, _, _ = tournament(c, 500, deck_mode="none", seed0=2_000_000)
    print("A) Event caps: one event of the given size at round 5, 500 matches each: max win % (strategy)")
    for etype, val in (("commodity_up", 0.30), ("commodity_up", 0.25), ("festival", 0.25), ("festival", 0.20),
                       ("wage_rule", 0.12), ("wage_rule", 0.08), ("wage_rule", 0.05)):
        old = EVENT_TYPES[etype]["size"]["L"]
        EVENT_TYPES[etype]["size"]["L"] = val
        st, _, _ = tournament(c, 500, deck_mode=("force", etype, "L"), seed0=2_000_000)
        EVENT_TYPES[etype]["size"]["L"] = old
        top = max(table(st), key=lambda r: r[2])
        print(f"   {etype:13s} {val:+.2f}: {top[2]:5.1f}% {top[0]}")
    print("B) Corner Supply A/B: the Aggressor with and without the card, 1000 matches each")
    original = BOTS["Aggressor"]

    def no_corner(me, view, cfg):
        v = dict(view, warn_next=set(), shortage_now=False)
        return original(me, v, cfg)

    for label, bot in (("with corner", original), ("without corner", no_corner)):
        BOTS["Aggressor"] = bot
        for mode in ("standard", ("force", "shortage", "L"), ("force", "commodity_up", "L")):
            st, _, _ = tournament(c, 1000, deck_mode=mode, seed0=7_000_000)
            r = {x[0]: x for x in table(st)}["Aggressor"]
            name = mode if isinstance(mode, str) else f"{mode[1]} L"
            print(f"   {label:15s} {name:15s} win {r[2]:5.1f}%  bankrupt {r[3]:4.1f}%  median worth ${r[6]:,.0f}")
    BOTS["Aggressor"] = original


SENSITIVE = ["e_budget", "e_quality", "bq_quality", "ads_w", "aw_ads", "wage", "staff_cap",
             "spot_rent", "attack_costs", "commodity_share"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="final", choices=sorted(CONFIGS))
    ap.add_argument("--matches", type=int, default=2000)
    ap.add_argument("--quick", action="store_true")
    ap.add_argument("--example", action="store_true")
    ap.add_argument("--extra", action="store_true", help="only the event-cap and Corner Supply checks")
    a = ap.parse_args()
    c = CONFIGS[a.config]
    if a.extra:
        print(f"config: {a.config}\n")
        extra_checks(c)
        return
    M = 400 if a.quick else a.matches
    k = max(100, M // 4)
    print(f"config: {a.config}; {M} matches per tournament; 4 players; {c['rounds']} rounds\n")
    if a.example:
        print("Example match (seed 11): Dumping, Premium, Advertiser, Aggressor")
        play(c, ["Dumping", "Premium", "Advertiser", "Aggressor"], seed=11, verbose=True)
        print()

    st, street, snow = tournament(c, M)
    print_table(f"1) Main tournament: 4 different strategies per match, standard event deck, {M} matches "
                f"(fair share 25%)", st)
    print(f"   leader after round 4 wins {100 * snow:.0f}% of matches")
    print("   win % by street (price-sensitive share >=60% / 45-60% / <45%):")
    for kind in ("budget", "mixed", "quality"):
        row = street[kind]
        print(f"   {kind:8s} " + "  ".join(f"{s} {100 * row[s][0] / row[s][1]:4.1f}" for s in FIVE if row[s][1]))
    print("   cost structure, % of revenue (all rounds played; cards_hiring = attack/defence cards, hiring, firing):")
    keys = ["cogs", "labour", "rent", "ads", "fixed", "interest", "cards_hiring"]
    print(f"   {'strategy':11s} " + " ".join(f"{k:>12s}" for k in keys) + f" {'net margin':>11s}")
    for s in FIVE:
        a = st[s]["acc"]
        rev = a["revenue"]
        tax_free = rev - sum(a[k] for k in keys)
        print(f"   {s:11s} " + " ".join(f"{100 * a[k] / rev:12.1f}" for k in keys) + f" {100 * tax_free / rev:10.1f}%")
    print("   win % by line-up (each line-up = the four strategies other than the one named):")
    for missing, row in sorted(st["_lineups"].items()):
        print(f"   without {missing[0]:10s} " + "  ".join(
            f"{s} {100 * row[s] / row['_n']:3.0f}" for s in FIVE if s not in missing))

    st_r, _, _ = tournament(c, M, lineups="random", seed0=500_000)
    print()
    print_table(f"2) Random line-ups (repeats allowed), {M} matches", st_r)

    cell = max(50, M // 10)
    print(f"\n3) One strategy against three copies of another, {cell} matches per cell: win % (bankrupt %)")
    print("   hero \\ 3x foe " + " ".join(f"{f:>11s}" for f in FIVE))
    for h in FIVE:
        cells = []
        for f in FIVE:
            if h == f:
                cells.append(f"{'-':>11s}")
                continue
            w = o = 0
            for m in range(cell):
                lineup = [h, f, f, f]
                random.Random(m).shuffle(lineup)
                r = play(c, lineup, seed=4_000_000 + m)
                hi = lineup.index(h)
                w += r["winner"] == hi
                o += not r["alive"][hi]
            cells.append(f"{100 * w / cell:5.0f}% ({100 * o / cell:2.0f})")
        print(f"   {h:13s}" + " ".join(cells))

    print(f"\n4) Event decks, {M} matches each: win % per strategy")
    print(f"   {'deck':10s} " + " ".join(f"{s:>11s}" for s in FIVE) + "   max   bankrupt %")
    for mode in ("none", "standard", "heavy"):
        st_d, _, _ = tournament(c, M, deck_mode=mode, seed0=1_000_000)
        rows = {r[0]: r for r in table(st_d)}
        bank = 100 * sum(st_d[s]["bankrupt"] for s in FIVE) / sum(st_d[s]["games"] for s in FIVE)
        print(f"   {mode:10s} " + " ".join(f"{rows[s][2]:11.1f}" for s in FIVE)
              + f"   {max(r[2] for r in rows.values()):4.1f}   {bank:5.1f}")

    print(f"\n5) One event forced at round 5 (size L, warned at round 4 where applicable), {k} matches each:"
          f" change in win % vs no events")
    base, _, _ = tournament(c, k, deck_mode="none", seed0=2_000_000)
    b = {r[0]: r[2] for r in table(base)}
    print(f"   {'event':15s} " + " ".join(f"{s:>11s}" for s in FIVE) + "   max win %")
    for etype in EVENT_TYPES:
        st_e, _, _ = tournament(c, k, deck_mode=("force", etype, "L"), seed0=2_000_000)
        e = {r[0]: r[2] for r in table(st_e)}
        print(f"   {etype:15s} " + " ".join(f"{e[s] - b[s]:+11.1f}" for s in FIVE) + f"   {max(e.values()):6.1f}")

    print(f"\n6) Sensitivity: one constant x0.85 / x1.15, {k} matches each: max win % (strategy)")
    for key in SENSITIVE:
        out = []
        for f in (0.85, 1.15):
            st_s, _, _ = tournament(perturb(c, key, f), k, seed0=3_000_000)
            top = max(table(st_s), key=lambda r: r[2])
            out.append(f"x{f:.2f}: {top[2]:4.1f}% {top[0]:10s}")
        print(f"   {key:16s} " + "   ".join(out))

    outs = wins = 0
    for m in range(k):
        r = play(c, ["Rookie", "Cautious", "Premium", "Dumping"], seed=5_000_000 + m)
        outs += not r["alive"][0]
        wins += r["winner"] == 0
    print(f"\n7) Rookie (random plausible moves) vs Cautious, Premium, Dumping, {k} matches: "
          f"bankrupt {100 * outs / k:.0f}%, wins {100 * wins / k:.0f}%")


if __name__ == "__main__":
    main()
