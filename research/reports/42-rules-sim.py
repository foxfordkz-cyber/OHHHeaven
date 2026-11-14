"""Street War MVP rules engine and balance check (researcher 42).

Run:  python3 42-rules-sim.py            # example match + balance tables (~2.5 min)
      python3 42-rules-sim.py --example  # only the 6-round example match from 42-game-rules.md
      python3 42-rules-sim.py --quick    # fewer matches

Implements the rules in 42-game-rules.md exactly: 4 shops on one street,
three levers (price, tier, staff), one attack card (Poach: only a shop that was
full last round can lose a barista; the target has already paid that barista's
wage this round), one price pact with a $500 deposit, event cards, overdraft
and bankruptcy. Every number is a game-design assumption, not a fact about real
coffee shops. Only the standard library. Output of a full run is saved in
42-rules-sim-output.txt.
"""
import math
import random
import sys
from decimal import Decimal, ROUND_HALF_UP
from fractions import Fraction

# ------------------------------- constants -----------------------------------
TRAFFIC = 12000                 # potential customers per month on the street
ELSEWHERE = 2.0                 # appeal of "buy elsewhere / skip", per segment
PRICES = [x / 2 for x in range(6, 19)]          # $3.00 .. $9.00, step $0.50
TIERS = {   # unit cost, staff wage, appeal for Bargain, appeal for Quality
    "eco":  dict(cost=1.00, wage=2000, qb=1.0, qq=0.6),
    "std":  dict(cost=1.50, wage=2000, qb=1.0, qq=1.0),
    "prem": dict(cost=2.50, wage=2400, qb=1.0, qq=1.8),
}
SPOTS = [  # name, location weight, rent per month
    ("Corner", 1.2, 3800),
    ("Middle A", 1.0, 2400),
    ("Middle B", 1.0, 2400),
    ("Far end", 0.8, 1900),
]
OWNER_CAP, STAFF_CAP = 500, 1000
MAX_STAFF, MAX_STAFF_CHANGE = 6, 2
HIRE_FEE = FIRE_FEE = 500
MISC = 500
START_CASH, START_STAFF = 8000, 1
POACH_FEE, POACH_FROM_ROUND = 1500, 2
POACH_PREPAID = True           # True: the target has already paid this month's wage of the poached barista
POACH_RULE = "overworked"      # "overworked": only a shop that was full last round can lose staff; "premium": Premium is immune
PACT_ESCROW, PACT_ROUNDS = 500, 3
OVERDRAFT_LIMIT, OVERDRAFT_RATE = 5000, 0.10
SPILL = 0.5


def _q(x, places):  # round half up (paper rule); exact for Fractions and ints
    if isinstance(x, Fraction):
        d = Decimal(x.numerator) / Decimal(x.denominator)
    else:
        d = Decimal(repr(x))
    return float(d.quantize(Decimal(places), rounding=ROUND_HALF_UP))


def r3(x):          # appeal values: 3 decimals
    return _q(x, "0.001")


def r2(x):          # unit costs: cents
    return _q(x, "0.01")


def r0(x):          # money: whole dollars
    return int(_q(x, "1"))


def mult_bargain(p):        # (6/p)^3, rounded to 3 decimals: the paper table
    return r3((Fraction(6) / Fraction(str(p))) ** 3)


def mult_quality(p):        # 6/p, rounded to 3 decimals
    return r3(Fraction(6) / Fraction(str(p)))


# ------------------------------- one match ------------------------------------
class Match:
    def __init__(self, names, spots, bargain_share=0.5, events=None, rounds=6, log=False):
        self.n_rounds = rounds
        self.bshare = bargain_share
        self.events = events or []      # dicts: kind, m, start, length, title
        self.log = log
        self.players = []
        for i, name in enumerate(names):
            s = spots[i]
            self.players.append(dict(id=i, name=name, spot=s, weight=SPOTS[s][1], rent=SPOTS[s][2],
                                     cash=START_CASH, staff=START_STAFF, price=6.0, tier="std",
                                     out=False, out_round=None, served_total=0, broke_deal=False, was_full=False,
                                     last_demand=None, hist=[]))
        self.pacts = []                 # dict(a, b, floor, start, end, status)
        self.round = 0
        self.records = []

    # ---- world state for the round
    def world(self, t):
        cost_mult = {k: 1.0 for k in TIERS}
        traffic, bshare, wage_add = TRAFFIC, self.bshare, 0
        active = []
        for e in self.events:
            if e["start"] <= t < e["start"] + e["length"]:
                active.append(e)
                if e["kind"] == "cost":
                    for k in e.get("tiers", list(TIERS)):
                        cost_mult[k] *= 1 + e["m"]
                elif e["kind"] == "traffic":
                    traffic = r0(Fraction(traffic) * (1 + Fraction(str(e["m"]))))
                elif e["kind"] == "squeeze":
                    bshare = min(0.8, max(0.2, round(bshare + e["m"], 4)))     # share stays within 20-80%
                elif e["kind"] == "wage":
                    wage_add += e["m"]
        unit = {k: r2(Fraction(str(TIERS[k]["cost"])) * Fraction(str(round(cost_mult[k], 6)))) for k in TIERS}
        wage = {k: TIERS[k]["wage"] + wage_add for k in TIERS}
        return dict(unit=unit, wage=wage, traffic=traffic, bshare=bshare, active=active)

    def forecast(self, t):
        return [e for e in self.events if e["start"] == t + 1]

    def alive(self):
        return [p for p in self.players if not p["out"]]

    def view(self, p):
        """What a player legally sees when deciding round t (public info + own state)."""
        rivals = [dict(id=q["id"], name=q["name"], price=q["price"], tier=q["tier"], staff=q["staff"],
                       served=q["hist"][-1]["served"] if q["hist"] else None, badge=self.badge(q),
                       was_full=q["was_full"])
                  for q in self.alive() if q is not p]
        last_poach = self.records[-1]["poach"] if self.records else []
        return dict(round=self.round + 1, me=p, rivals=rivals, forecast=self.forecast(self.round + 1),
                    last_poach=last_poach,
                    world=self.world(self.round + 1), pacts=[x for x in self.pacts if x["status"] == "active"
                                                              and p["id"] in (x["a"], x["b"])])

    def badge(self, p):
        if p["out"]:
            return "Bankrupt"
        fixed = p["staff"] * TIERS[p["tier"]]["wage"] + p["rent"] + MISC
        if p["cash"] < 0:
            return "Critical"
        if p["cash"] < fixed:
            return "Strained"
        return "Healthy"

    # ---- play one round with locked decisions {id: dict(price, tier, staff, poach, pact_offer, pact_accept)}
    def play_round(self, dec):
        self.round += 1
        t = self.round
        w = self.world(t)
        alive = self.alive()
        rec = dict(round=t, world=w, rows={}, poach=[], pact_events=[], spill=0, lost=0, bankrupt=[])
        # 0. decisions become public; validate
        for p in alive:
            d = dec[p["id"]]
            assert d["price"] in PRICES and d["tier"] in TIERS
            assert 0 <= d["staff"] <= MAX_STAFF and abs(d["staff"] - p["staff"]) <= MAX_STAFF_CHANGE
            row = dict(start_cash=p["cash"], price=d["price"], tier=d["tier"], staff_before=p["staff"],
                       hire=max(0, d["staff"] - p["staff"]), fire=max(0, p["staff"] - d["staff"]),
                       poach_fee=0, escrow=0, interest=0)
            p["price"], p["tier"], p["staff"] = d["price"], d["tier"], d["staff"]
            row["staff_paid"] = d["staff"]          # wages are paid on this count (before poaching)
            rec["rows"][p["id"]] = row
        # 1. interest on overdraft carried in from last round
        for p in alive:
            if p["cash"] < 0:
                rec["rows"][p["id"]]["interest"] = r0(Fraction(-p["cash"]) * Fraction(str(OVERDRAFT_RATE)))
        # 2. poach: fee always paid; one success per target max; fails on Premium
        attempts = [(p, dec[p["id"]].get("poach")) for p in alive if dec[p["id"]].get("poach") is not None]
        targets = {}
        for p, tid in attempts:
            assert t >= POACH_FROM_ROUND and tid != p["id"]
            targets.setdefault(tid, []).append(p)
        before = {p["id"]: p["staff"] for p in alive}      # every condition uses staff before any poach
        successes = []
        for tid, attackers in targets.items():
            tgt = self.players[tid]
            for a in attackers:
                rec["rows"][a["id"]]["poach_fee"] = POACH_FEE
                if tgt["out"]:
                    why = "target closed"
                elif len(attackers) > 1:
                    why = "two poachers, both fail"
                elif POACH_RULE == "premium" and tgt["tier"] == "prem":
                    why = "Premium staff are loyal"
                elif POACH_RULE == "overworked" and not tgt["was_full"]:
                    why = "target was not full last round: staff are happy"
                elif before[tid] < 1:
                    why = "no staff to poach"
                elif before[a["id"]] >= MAX_STAFF:
                    why = "attacker is full"
                else:
                    why = None
                    successes.append((a, tgt))
                rec["poach"].append(dict(by=a["name"], target=tgt["name"], ok=why is None, why=why or "success"))
        for a, tgt in successes:                             # then all successes apply at once
            tgt["staff"] -= 1
            a["staff"] += 1
        # 3. pacts: breaches checked against this round's prices
        for x in self.pacts:
            if x["status"] != "active" or not (x["start"] <= t <= x["end"]):
                continue
            a, b = self.players[x["a"]], self.players[x["b"]]
            if a["out"] or b["out"]:
                x["status"] = "ended"
                for q in (a, b):
                    if not q["out"]:
                        rec["rows"][q["id"]]["escrow"] += PACT_ESCROW       # refund
                rec["pact_events"].append(f"pact {a['name']}-{b['name']} ended: partner closed, escrow refunded")
                continue
            ba, bb = a["price"] < x["floor"], b["price"] < x["floor"]
            if ba and bb:
                x["status"] = "broken by both"
                a["broke_deal"] = b["broke_deal"] = True
                rec["pact_events"].append(f"pact {a['name']}-{b['name']} broken by both: escrows burned")
            elif ba or bb:
                traitor, victim = (a, b) if ba else (b, a)
                x["status"] = f"broken by {traitor['name']}"
                traitor["broke_deal"] = True
                rec["rows"][victim["id"]]["escrow"] += 2 * PACT_ESCROW      # own refund + traitor's escrow
                rec["pact_events"].append(f"{traitor['name']} broke the pact: {victim['name']} receives "
                                          f"${2 * PACT_ESCROW:,} (own ${PACT_ESCROW:,} back + ${PACT_ESCROW:,})")
            elif t == x["end"]:
                x["status"] = "kept"
                rec["rows"][a["id"]]["escrow"] += PACT_ESCROW
                rec["rows"][b["id"]]["escrow"] += PACT_ESCROW
                rec["pact_events"].append(f"pact {a['name']}-{b['name']} kept: escrows refunded")
        # new pacts agreed this round start next round; escrow paid now
        for p in alive:
            off = dec[p["id"]].get("pact_offer")
            if not off:
                continue
            q = self.players[off["to"]]
            busy = any(x["status"] == "active" and (x["end"] >= t + 1) and
                       ({p["id"], q["id"]} & {x["a"], x["b"]}) for x in self.pacts)
            if dec[q["id"]].get("pact_accept") == p["id"] and not busy and not q["out"] and t < self.n_rounds:
                end = min(self.n_rounds, t + PACT_ROUNDS)
                self.pacts.append(dict(a=p["id"], b=q["id"], floor=off["floor"], start=t + 1, end=end,
                                       status="active"))
                rec["rows"][p["id"]]["escrow"] -= PACT_ESCROW
                rec["rows"][q["id"]]["escrow"] -= PACT_ESCROW
                rec["pact_events"].append(f"pact {p['name']}-{q['name']}: price >= ${off['floor']:.2f} "
                                          f"in rounds {t + 1}-{end}, escrow ${PACT_ESCROW:,} each")
        # 4. demand: two segments, share = appeal / (sum of appeals + Elsewhere)
        seg_total = {"bargain": r0(Fraction(w["traffic"]) * Fraction(str(w["bshare"])))}
        seg_total["quality"] = w["traffic"] - seg_total["bargain"]
        appeal = {}
        for p in alive:
            tb = TIERS[p["tier"]]
            ab = r3(Fraction(str(p["weight"])) * Fraction(str(mult_bargain(p["price"]))) * Fraction(str(tb["qb"])))
            aq = r3(Fraction(str(p["weight"])) * Fraction(str(mult_quality(p["price"]))) * Fraction(str(tb["qq"])))
            appeal[p["id"]] = (ab, aq)
        sum_b = r3(sum(Fraction(str(a[0])) for a in appeal.values()))
        sum_q = r3(sum(Fraction(str(a[1])) for a in appeal.values()))
        rec["sum_b"], rec["sum_q"], rec["seg_total"] = sum_b, sum_q, seg_total
        demand, cap, served = {}, {}, {}
        for p in alive:
            ab, aq = appeal[p["id"]]
            db = math.floor(seg_total["bargain"] * Fraction(str(ab)) / (Fraction(str(sum_b)) + Fraction(str(ELSEWHERE))))
            dq = math.floor(seg_total["quality"] * Fraction(str(aq)) / (Fraction(str(sum_q)) + Fraction(str(ELSEWHERE))))
            demand[p["id"]] = (db, dq)
            cap[p["id"]] = OWNER_CAP + STAFF_CAP * p["staff"]
            served[p["id"]] = min(db + dq, cap[p["id"]])
        excess = sum(demand[i][0] + demand[i][1] - served[i] for i in served)
        pool = math.floor(SPILL * excess)
        spare_ids = [p["id"] for p in alive if cap[p["id"]] - served[p["id"]] > 0]
        got_spill = {i: 0 for i in served}
        if pool and spare_ids:
            tot = Fraction(0)
            for i in spare_ids:
                tot += Fraction(str(appeal[i][0])) + Fraction(str(appeal[i][1]))
            for i in spare_ids:
                share = math.floor(pool * (Fraction(str(appeal[i][0])) + Fraction(str(appeal[i][1]))) / tot)
                got_spill[i] = min(share, cap[i] - served[i])
        rec["spill"], rec["excess"] = pool, excess
        rec["lost"] = excess - sum(got_spill.values())
        # 5. money
        for p in alive:
            i = p["id"]
            row = rec["rows"][i]
            sv = served[i] + got_spill[i]
            unit = w["unit"][p["tier"]]
            row.update(appeal_b=appeal[i][0], appeal_q=appeal[i][1], demand_b=demand[i][0], demand_q=demand[i][1],
                       capacity=cap[i], staff=p["staff"], served_own=served[i], spill_in=got_spill[i], served=sv,
                       revenue=r0(sv * Fraction(str(p["price"]))), unit=unit,
                       ingredients=r0(sv * Fraction(str(unit))),
                       wages=(row["staff_paid"] if POACH_PREPAID else p["staff"]) * w["wage"][p["tier"]],
                       rent=p["rent"], misc=MISC,
                       fees=row["hire"] * HIRE_FEE + row["fire"] * FIRE_FEE)
            row["profit"] = (row["revenue"] - row["ingredients"] - row["wages"] - row["rent"] - row["misc"]
                             - row["fees"] - row["poach_fee"] - row["interest"])
            p["cash"] = row["start_cash"] + row["profit"] + row["escrow"]
            row["end_cash"] = p["cash"]
            p["served_total"] += sv
            p["was_full"] = sv >= cap[i]
            p["last_demand"] = demand[i][0] + demand[i][1]
            p["hist"].append(dict(served=sv, cash=p["cash"]))
        # 6. bankruptcy
        for p in alive:
            if p["cash"] < -OVERDRAFT_LIMIT:
                p["out"], p["out_round"] = True, t
                rec["bankrupt"].append(p["name"])
        for p in alive:
            rec["rows"][p["id"]]["badge"] = self.badge(p)
        self.records.append(rec)
        return rec

    def standings(self):
        surv = sorted([p for p in self.players if not p["out"]], key=lambda p: (-p["cash"], -p["served_total"]))
        dead = sorted([p for p in self.players if p["out"]], key=lambda p: -p["out_round"])
        return surv + dead

    def over(self):
        return self.round >= self.n_rounds or len(self.alive()) <= 1


# ------------------------------- bots ----------------------------------------
def staff_for(expected, cur, margin=4.5, wage=2000):
    """Staff count with the best expected profit this round (what a sensible player does)."""
    best, best_k = None, cur
    for k in range(max(0, cur - MAX_STAFF_CHANGE), min(MAX_STAFF, cur + MAX_STAFF_CHANGE) + 1):
        served = min(expected, OWNER_CAP + STAFF_CAP * k)
        fee = (k - cur) * HIRE_FEE if k > cur else (cur - k) * FIRE_FEE
        value = served * margin - k * wage - fee
        if best is None or value > best + 1e-9:
            best, best_k = value, k
    return best_k


def poach_targets(v):
    """Rivals a poach can succeed against, judged from public information only."""
    if POACH_RULE == "premium":
        return [r for r in v["rivals"] if r["tier"] != "prem" and r["staff"] >= 1]
    return [r for r in v["rivals"] if r["was_full"] and r["staff"] >= 1]


def snap(price):
    price = min(9.0, max(3.0, price))
    return math.floor(price * 2 + 0.5) / 2


def first_estimate(p):
    return 2000 * p["weight"]


class Bot:
    tier = "std"
    base_price = 6.0
    poacher = False

    def __init__(self, rnd):
        self.rnd = rnd

    def price(self, v):
        w = v["world"]
        shift = w["unit"][self.tier] - TIERS[self.tier]["cost"]       # pass cost shocks into price
        return snap(self.base_price + shift)

    slack_left = 0

    def decide(self, v):
        p = v["me"]
        exp = p["last_demand"] if p["last_demand"] is not None else first_estimate(p)
        price = self.price(v)
        w = v["world"]
        margin = price - w["unit"][self.tier]
        if any(x["ok"] and x["target"] == p["name"] for x in v["last_poach"]):
            self.slack_left = 2                     # was poached: keep spare capacity for two rounds
        staff = staff_for(exp, p["staff"], margin, w["wage"][self.tier])
        if self.slack_left > 0:
            self.slack_left -= 1
            if OWNER_CAP + STAFF_CAP * staff <= exp and staff < min(MAX_STAFF, p["staff"] + MAX_STAFF_CHANGE):
                staff += 1
        d = dict(price=price, tier=self.tier, staff=staff, poach=None)
        if self.poacher and v["round"] >= POACH_FROM_ROUND:
            # public info: a rival whose customers last round reached its capacity had a queue
            cands = poach_targets(v)
            if cands and d["staff"] >= 1:
                d["poach"] = self.rnd.choice(cands)["id"]
                d["staff"] = max(p["staff"] - MAX_STAFF_CHANGE, d["staff"] - 1)   # the poached barista replaces a hire
        return d


class Balanced(Bot):
    pass


class Discounter(Bot):
    tier, base_price = "eco", 5.0


class Premium(Bot):
    tier, base_price = "prem", 7.5


class Dumper(Bot):                       # always $0.50 under the cheapest rival, eco beans
    tier = "eco"

    def price(self, v):
        prices = [r["price"] for r in v["rivals"]]
        return snap(min(prices) - 0.5) if prices else 5.0


class DeepDumper(Bot):                   # price war at $4.00 from round 1
    tier, base_price = "eco", 4.0


class Poacher(Bot):
    poacher = True


class Adaptive(Bot):                     # reads the street: crowded niche -> other niche; poaches volume shops
    poacher = True

    def decide(self, v):
        tiers = [r["tier"] for r in v["rivals"]]
        if tiers.count("eco") >= 2:
            self.tier, self.base_price = "prem", 7.5
        elif tiers.count("prem") >= 2:
            self.tier, self.base_price = "eco", 5.0
        else:
            self.tier, self.base_price = "std", 6.0
        self.poacher = False
        d = super().decide(v)
        cands = poach_targets(v)
        if cands and v["round"] >= POACH_FROM_ROUND and d["staff"] >= 1:
            d["poach"] = self.rnd.choice(cands)["id"]
            d["staff"] = max(v["me"]["staff"] - MAX_STAFF_CHANGE, d["staff"] - 1)
        return d


class Cartel(Balanced):                  # agrees a price floor with one partner and keeps it
    floor = 6.5
    partner = None
    traitor = False

    def decide(self, v):
        d = super().decide(v)
        me, t, last = v["me"], v["round"], self.n_rounds
        covering = [x for x in v["pacts"] if x["start"] <= t <= x["end"]]
        if covering:
            d["price"] = max(d["price"], covering[0]["floor"])
            if self.traitor and t == last:                          # betray in the final round:
                d["price"] = snap(covering[0]["floor"] - 1.0)      # $1 under the floor, staff for +40%
                d["staff"] = staff_for((me["last_demand"] or 2000) * 1.4, me["staff"],
                                       d["price"] - v["world"]["unit"][self.tier], v["world"]["wage"][self.tier])
        future = [x for x in v["pacts"] if x["end"] >= t + 1]
        if self.partner is not None and not future and t < last:
            if me["id"] < self.partner:
                d["pact_offer"] = dict(to=self.partner, floor=self.floor)
            else:
                d["pact_accept"] = self.partner
        return d


class Traitor(Cartel):
    traitor = True


class Rookie(Bot):                       # a first-time player: random but plausible moves, no planning
    def decide(self, v):
        r, p = self.rnd, v["me"]
        tier = r.choice(["eco", "std", "std", "prem"])
        price = r.choice(PRICES[2:11])                  # $4.00 .. $8.00
        staff = max(0, min(MAX_STAFF, p["staff"] + r.choice([-1, 0, 0, 1, 2])))
        poach = None
        if v["round"] >= POACH_FROM_ROUND and v["rivals"] and r.random() < 0.25:
            poach = r.choice(v["rivals"])["id"]
        return dict(price=price, tier=tier, staff=staff, poach=poach)


STRATS = dict(Balanced=Balanced, Discounter=Discounter, Premium=Premium, Dumper=Dumper,
              DeepDumper=DeepDumper, Poacher=Poacher, Adaptive=Adaptive, Rookie=Rookie,
              Cartel=Cartel, Traitor=Traitor)
SANE = ["Balanced", "Discounter", "Premium", "Poacher", "Adaptive"]
ALL7 = ["Balanced", "Discounter", "Premium", "Dumper", "DeepDumper", "Poacher", "Adaptive"]


def random_events(rnd, rounds):
    """Two (6 rounds) or three (8 rounds) event cards at rounds 3, 5, 7, two rounds each."""
    kinds = [("cost", 0.25), ("cost", 0.40), ("cost", -0.20), ("traffic", 0.15), ("traffic", -0.15),
             ("squeeze", 0.10), ("wage", 200), ("costprem", 0.30)]
    out = []
    for start in range(3, rounds + 1, 2):
        k, m = rnd.choice(kinds)
        e = dict(kind="cost" if k == "costprem" else k, m=m, start=start, length=2, title=k)
        if k == "costprem":
            e["tiers"] = ["prem"]
        out.append(e)
    return out


def play(field, seed, rounds=8):
    rnd = random.Random(seed)
    spots = list(range(4))
    rnd.shuffle(spots)
    m = Match(field, spots, bargain_share=rnd.uniform(0.35, 0.65), events=random_events(rnd, rounds),
              rounds=rounds)
    bots = [STRATS[s](rnd) for s in field]
    pact_ids = [i for i, b in enumerate(bots) if isinstance(b, Cartel)]
    for b in bots:
        b.n_rounds = rounds
    if len(pact_ids) == 2:
        bots[pact_ids[0]].partner, bots[pact_ids[1]].partner = pact_ids[1], pact_ids[0]
    while not m.over():
        dec = {}
        for p in m.alive():
            dec[p["id"]] = bots[p["id"]].decide(m.view(p))
        m.play_round(dec)
    st = m.standings()
    top = [p for p in st if not p["out"] and p["cash"] == st[0]["cash"] and p["served_total"] == st[0]["served_total"]]
    return m, (rnd.choice(top)["id"] if len(top) > 1 else st[0]["id"])


def tournament(matches, rounds=8, seed0=1, names=None):
    names = names or ALL7
    rnd = random.Random(seed0)
    stats = {s: dict(games=0, wins=0.0, out=0, cash=[]) for s in names}
    snow = 0
    for k in range(matches):
        field = [rnd.choice(names) for _ in range(4)]
        m, win = play(field, 1000 + k, rounds)
        lead3 = max(range(4), key=lambda i: (m.players[i]["hist"][2]["cash"] if len(m.players[i]["hist"]) > 2
                                             else -10 ** 9, -i))
        snow += field[lead3] == field[win]
        winners = [i for i in range(4) if field[i] == field[win]]
        for i, s in enumerate(field):
            stats[s]["games"] += 1
            stats[s]["out"] += m.players[i]["out"]
            if not m.players[i]["out"]:
                stats[s]["cash"].append(m.players[i]["cash"])
        for i in winners:
            stats[field[i]]["wins"] += 1 / len(winners)
    stats["_snow"] = snow / matches
    return stats


def one_vs_three(hero, foe, matches, rounds=8):
    wins = outs = 0
    for k in range(matches):
        m, win = play([hero, foe, foe, foe], 50000 + k, rounds)
        wins += win == 0
        outs += m.players[0]["out"]
    return wins / matches, outs / matches


def mirror(strategy, matches, rounds=8):
    outs, cash = 0, []
    for k in range(matches):
        m, _ = play([strategy] * 4, 90000 + k, rounds)
        outs += sum(p["out"] for p in m.players)
        cash += [p["cash"] for p in m.players if not p["out"]]
    cash.sort()
    return outs / (4 * matches), (cash[len(cash) // 2] if cash else float("nan"))


# ------------------------------- the example ----------------------------------
EXAMPLE_EVENTS = [
    dict(kind="cost", m=0.25, start=3, length=2, title="Coffee bean cost +25% (illustrative)"),
    dict(kind="traffic", m=0.15, start=5, length=2, title="Heatwave: street traffic +15% (illustrative)"),
]
# Ana: Premium. Max: price war. Lena: middle price, proposes a pact. Dan: far end, poaches.
EXAMPLE_NAMES = ["Ana", "Max", "Lena", "Dan"]
EXAMPLE_SPOTS = [1, 0, 2, 3]       # Ana Middle A, Max Corner, Lena Middle B, Dan Far end
A, M, L, D = 0, 1, 2, 3
EXAMPLE_MOVES = {
    1: {A: dict(price=7.5, tier="prem", staff=2), M: dict(price=5.0, tier="eco", staff=3),
        L: dict(price=6.0, tier="std", staff=2), D: dict(price=6.0, tier="std", staff=1)},
    2: {A: dict(price=7.5, tier="prem", staff=2), M: dict(price=4.0, tier="eco", staff=3),
        L: dict(price=6.0, tier="std", staff=2, pact_offer=dict(to=D, floor=6.0)),
        D: dict(price=6.0, tier="std", staff=1, pact_accept=L)},
    3: {A: dict(price=8.0, tier="prem", staff=2), M: dict(price=4.0, tier="eco", staff=4, poach=A),
        L: dict(price=6.5, tier="std", staff=2), D: dict(price=6.5, tier="std", staff=1, poach=M)},
    4: {A: dict(price=8.0, tier="prem", staff=2), M: dict(price=3.5, tier="eco", staff=5),
        L: dict(price=6.5, tier="std", staff=1, poach=M), D: dict(price=6.5, tier="std", staff=1)},
    5: {A: dict(price=8.0, tier="prem", staff=2), M: dict(price=3.0, tier="eco", staff=6),
        L: dict(price=5.5, tier="std", staff=2), D: dict(price=6.5, tier="std", staff=1)},
    6: {A: dict(price=8.0, tier="prem", staff=3), L: dict(price=6.0, tier="std", staff=3),
        D: dict(price=6.5, tier="std", staff=2)},
}


def run_example(moves=None, verbose=True):
    moves = moves or EXAMPLE_MOVES
    m = Match(EXAMPLE_NAMES, EXAMPLE_SPOTS, bargain_share=0.5, events=EXAMPLE_EVENTS, rounds=6)
    for t in range(1, 7):
        if m.over():
            break
        dec = {}
        for p in m.alive():
            d = dict(moves[t][p["id"]])
            d.setdefault("poach", None)
            dec[p["id"]] = d
        rec = m.play_round(dec)
        if verbose:
            print_round(m, rec)
    if verbose:
        print("\nFinal standings:")
        for k, p in enumerate(m.standings(), 1):
            print(f"  {k}. {p['name']:5s} cash ${p['cash']:,}  served {p['served_total']:,}"
                  f"{'  BANKRUPT in round ' + str(p['out_round']) if p['out'] else ''}")
    return m


def print_round(m, rec):
    w = rec["world"]
    print(f"\n=== Round {rec['round']} === traffic {w['traffic']:,} (bargain {rec['seg_total']['bargain']:,} / "
          f"quality {rec['seg_total']['quality']:,}), unit cost eco ${w['unit']['eco']:.2f} std ${w['unit']['std']:.2f} "
          f"prem ${w['unit']['prem']:.2f}; sums of appeal B {rec['sum_b']} Q {rec['sum_q']}")
    for e in m.forecast(rec["round"]):
        print(f"  FORECAST for next round: {e['title']}")
    for x in rec["poach"]:
        print(f"  POACH {x['by']} -> {x['target']}: {x['why']}")
    for s in rec["pact_events"]:
        print(f"  PACT {s}")
    print(f"  excess demand {rec['excess']}, spill pool {rec['spill']}, lost {rec['lost']}")
    cols = ("name price tier staff aB aQ dB dQ cap own spill served revenue ingr wages rent misc fees poach int "
            "escrow profit cash badge").split()
    print("  " + " ".join(f"{c:>7s}" for c in cols))
    for p in m.players:
        if p["id"] not in rec["rows"]:
            continue
        r = rec["rows"][p["id"]]
        vals = [p["name"], f"{r['price']:.2f}", r["tier"], r["staff"], r["appeal_b"], r["appeal_q"], r["demand_b"],
                r["demand_q"], r["capacity"], r["served_own"], r["spill_in"], r["served"], r["revenue"],
                r["ingredients"], r["wages"], r["rent"], r["misc"], r["fees"], r["poach_fee"], r["interest"],
                r["escrow"], r["profit"], r["end_cash"], r["badge"]]
        print("  " + " ".join(f"{str(v):>7s}" for v in vals))
    if rec["bankrupt"]:
        print("  BANKRUPT: " + ", ".join(rec["bankrupt"]))


def check_example(m):
    """Every money row must add up; customers must be conserved."""
    for rec in m.records:
        tot = rec["seg_total"]["bargain"] + rec["seg_total"]["quality"]
        assert tot == rec["world"]["traffic"]
        for r in rec["rows"].values():
            assert r["profit"] == (r["revenue"] - r["ingredients"] - r["wages"] - r["rent"] - r["misc"]
                                   - r["fees"] - r["poach_fee"] - r["interest"])
            assert r["end_cash"] == r["start_cash"] + r["profit"] + r["escrow"]
            assert r["served"] == r["served_own"] + r["spill_in"] <= r["capacity"]
        served = sum(r["served_own"] + r["spill_in"] for r in rec["rows"].values())
        demand = sum(r["demand_b"] + r["demand_q"] for r in rec["rows"].values())
        assert served + rec["lost"] == demand, (served, rec["lost"], demand)
    return True


def print_pool(title, st):
    print(title)
    print(f"  {'strategy':11s} {'games':>6s} {'win %':>6s} {'bankrupt %':>10s} {'median cash':>12s}")
    for name, v in st.items():
        if name.startswith("_"):
            continue
        c = sorted(v["cash"])
        print(f"  {name:11s} {v['games']:6d} {100 * v['wins'] / v['games']:6.1f} {100 * v['out'] / v['games']:10.1f} "
              f"{(c[len(c) // 2] if c else float('nan')):12,.0f}")
    print(f"  leader after round 3 is the winning strategy in {100 * st['_snow']:.0f}% of matches")


if __name__ == "__main__":
    quick = "--quick" in sys.argv
    print("EXAMPLE MATCH (6 rounds, 4 players)")
    ex = run_example()
    print("example arithmetic check:", check_example(ex))
    if "--example" in sys.argv:
        sys.exit()
    N = 800 if quick else 4000
    K = 100 if quick else 400
    for rounds in (8, 6):
        print_pool(f"\nA. SANE POOL {SANE}, {N} random 4-bot matches, {rounds} rounds (fair = 25%)",
                   tournament(N, rounds, names=SANE))
    print_pool(f"\nB. FULL POOL with price-war bots {ALL7}, {N} matches, 8 rounds",
               tournament(N, 8, names=ALL7))
    print(f"\nC. ONE HERO vs THREE COPIES, {K} matches, 8 rounds: hero win % (hero bankrupt %); fair = 25%")
    print("  hero \\ foe   " + " ".join(f"{f:>12s}" for f in ALL7))
    for h in ALL7:
        cells = []
        for f in ALL7:
            if h == f:
                cells.append(f"{'-':>12s}")
                continue
            wv, o = one_vs_three(h, f, K)
            cells.append(f"{100 * wv:5.0f}% ({100 * o:3.0f}%)")
        print(f"  {h:11s} " + " ".join(cells))
    print(f"\nD. MIRROR: 4 copies, {K} matches, 8 rounds")
    for name in ALL7:
        o, c = mirror(name, K)
        print(f"  {name:11s} bankrupt {100 * o:5.1f}%  median cash of survivors ${c:,.0f}")
    print(f"\nE. VALUE OF THE POACH CARD: same std/$6 player with and without Poach vs 3 copies of a foe, {K} matches")
    for foe in ("Dumper", "DeepDumper", "Discounter", "Premium", "Balanced"):
        w1, _ = one_vs_three("Poacher", foe, K)
        w0, _ = one_vs_three("Balanced", foe, K)
        print(f"  vs 3 {foe:10s}: with Poach {100 * w1:4.0f}%   without {100 * w0:4.0f}%")
    print(f"\nG. PRICE PACT (floor $6.50, deposit ${PACT_ESCROW}), {K} matches each, 8 rounds: win % per seat (fair = 25%)")
    for field in (["Balanced", "Balanced", "Discounter", "Discounter"], ["Cartel", "Cartel", "Discounter", "Discounter"],
                  ["Cartel", "Traitor", "Discounter", "Discounter"], ["Balanced", "Balanced", "Balanced", "Balanced"],
                  ["Cartel", "Cartel", "Balanced", "Balanced"], ["Cartel", "Traitor", "Balanced", "Balanced"]):
        wins_by = {}
        for k in range(K):
            m, win = play(field, 170000 + k, 8)
            for i, name in enumerate(field):
                wins_by.setdefault(name, [0, 0])
                wins_by[name][1] += 1
                wins_by[name][0] += win == i
        print("  " + " + ".join(field) + ": " + ", ".join(
            f"{n} {100 * a / b:.0f}%" for n, (a, b) in wins_by.items()))
    S = 300 if quick else 1500
    for label, fixed in (("sane random fields", None), ("4x Balanced, no attackers", ["Balanced"] * 4)):
        cash = {i: [] for i in range(4)}
        wins_spot = {i: 0 for i in range(4)}
        rnd = random.Random(5)
        for k in range(S):
            field = fixed or [rnd.choice(SANE) for _ in range(4)]
            m, win = play(field, 7000 + k, 8)
            for pl in m.players:
                cash[pl["spot"]].append(pl["cash"])
            wins_spot[m.players[win]["spot"]] += 1
        print(f"\nH. SPOTS, {label}, {S} matches, 8 rounds: mean cash (win %)  " + ", ".join(
            f"{SPOTS[i][0]} ${sum(c) / len(c):,.0f} ({100 * wins_spot[i] / S:.0f}%)" for i, c in cash.items()))
    outs = wins = 0
    for k in range(2 * K):
        m, win = play(["Rookie", "Balanced", "Discounter", "Premium"], 150000 + k, 8)
        outs += m.players[0]["out"]
        wins += win == 0
    print(f"\nF. ROOKIE (random plausible moves) vs Balanced, Discounter, Premium, {2 * K} matches, 8 rounds: "
          f"bankrupt {100 * outs / (2 * K):.0f}%, wins {100 * wins / (2 * K):.0f}%")
