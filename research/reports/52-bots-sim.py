"""Bots for the Street War MVP (researcher 52, see 52-bots-spec.md).

Run:  python3 52-bots-sim.py            # full report, about 75 seconds (output: 52-bots-run.txt)
      python3 52-bots-sim.py --quick    # smaller samples, about 20 seconds

Engine = the shared-street market of researcher 24 (24-market-sim.py, branch
claude/exciting-mccarthy-r7904m): same demand logit, costs, suppliers, lease
auction, credit and tax. It is extended with every action of WINNER.md and the
MVP cards of report 25: loan, second shop, lease bids (rounds 1 and 7), poach vs
retention bonus, corner supply vs forward contract, price war vs loyalty card,
bankrupt buyout, price pact with escrow and betrayal. Every number is a game
design assumption, not a fact about real coffee shops.

Bots receive ONLY a View: the public state of the street plus their own private
state. They never touch the engine's player records. The fairness test re-runs
every bot decision on a view built from a copy of the match in which all hidden
rival fields (cash, debt, wage, stock, awareness, bids, contracts) are
randomised, and checks that the decision does not change. A deliberately leaky
view plus a bot that peeks at rival cash is the negative control: the test must
catch it.
"""
import copy
import math
import random
import statistics
import sys
import time
from collections import Counter, defaultdict

# ---------------- market constants: identical to 24-market-sim.py --------------
P_REF = 6.0
WAGE = 2000
CAP_STAFF = 1100
CAP_OWNER = 500
HIRE_COST, FIRE_COST = 400, 1000
MISC = 500
START_CASH = 12000
TRAFFIC_PER_SHOP, TRAFFIC_BASE = 2600, 2000
SEGMENTS = [dict(name="students", e=3.0, bq=0.10, br=0.35),
            dict(name="pros", e=1.3, bq=0.70, br=0.70)]
STUDENT_SHARE = (0.35, 0.75)
QUALITY = {"eco": -0.5, "std": 0.0, "prem": 1.0}
SPEED = {"eco": 1.1, "std": 1.0, "prem": 0.85}
RETAIN = 0.50
ADS_W, ADS_HALF = 0.30, 400
OUTSIDE = 1 / 3
SPILL = 0.5
SLOT_W = [1.00, 0.88, 0.88, 0.76, 0.76, 0.64, 0.55]
SLOT_RENT = [3600, 3000, 3000, 2400, 2400, 1900, 1400]
STOCK_MAIN, STOCK_PREM = 1.15, 0.22
SPOT_MARKUP = 1.4
SPOIL = 0.15
TAX = 0.20
RATE_LOW, RATE_HIGH = 0.015, 0.025
MOVE_COST = 2000
REPAY_ABOVE = 8000            # 24: spare cash above $8,000 repays debt automatically
ROUNDS = 12                   # 12 in a match, 6 in the demo blitz; every round threshold below is relative to it
LEASE_ROUNDS = (1, 7)         # set_rounds(): (1, R/2 + 1)
SECOND_ROUNDS = range(3, 10)  # set_rounds(): rounds 3 .. R - 3


def set_rounds(r):
    global ROUNDS, LEASE_ROUNDS, SECOND_ROUNDS
    ROUNDS, LEASE_ROUNDS, SECOND_ROUNDS = r, (1, r // 2 + 1), range(3, r - 2)

# ---------------- cards from WINNER.md and report 25, scaled to 24's economy -------
CARDS = ("loan", "second", "poach", "retain", "corner", "forward", "loyalty", "buyout")
ATTACKS = ("poach", "corner")             # 25, rule 3: no attacks in rounds 1-2
NO_ATTACK_ROUNDS = (1, 2)
MAX_HITS_PER_TARGET = 2                   # 25: at most 2 attacks on one target per round
SECOND_FITOUT, SECOND_W = 6000, 0.85
POACH_BONUS, POACH_EDGE = 800, 1.15       # 24: poach works if your wage >= 1.15x theirs
RETAIN_COST = 400                         # 25: retention bonus blocks a poach, attacker's bonus burns
CORNER_SHARE, CORNER_MARKUP, CORNER_SQUEEZE = 0.40, 1.10, 1.30   # 25: rest of the stock +30% for everyone
FORWARD_COST, FORWARD_ROUNDS = 200, 3
LOYALTY_COST, LOYALTY_ROUNDS, LOYALTY_KEEP = 1500, 3, 0.25
BUYOUT_MIN, BUYOUT_INHERIT = 3000, 0.5
PACT_ROUNDS, PACT_ESCROWS = 3, (0, 1000, 3000)
WAGE_LEVELS = (1.0, 1.15, 1.3)
OLD_AUCTION = False
DEFAULT_OFF = frozenset({"dump"})        # bots do not START price wars: in 24's economy it costs Boris ~6 p.p.


def unit_cost(tier, n_index):
    return {"eco": 0.4 + 0.6 * n_index, "std": 0.6 + 0.8 * n_index, "prem": 0.9 + 1.6 * n_index}[tier]


def capacity_of(staff, tier, new=0):
    return (CAP_OWNER + CAP_STAFF * (staff - 0.5 * new)) * SPEED[tier]


def staff_for(forecast, tier="std"):                    # 24
    return max(0, min(6, math.ceil((forecast / SPEED[tier] - CAP_OWNER) / CAP_STAFF)))


def order_for(me, forecast, warn, hedge, tier):         # 24, plus the hedge switch
    target = forecast * 1.05
    if hedge and "commodity +" in warn:
        target += forecast * 0.9
    if "commodity -" in warn:
        target = forecast * 0.7
    inv = me["inv"] if me["inv_tier"] == tier else me["inv"] * 0.5
    return max(0.0, target - inv)


def is_dumping(price, tier, n_index):
    """Selling at a loss or at the 27-validator floor ($3.00 = 0.5 x reference): a price war."""
    return price < max(unit_cost(tier, n_index) + 0.3, 0.6 * P_REF)


def ads_level(a):
    return "none" if a < 200 else "low" if a < 1000 else "high"


def credit_limit(last_rev):
    return 6000 + 0.8 * last_rev


def expected_street(n0):
    return (TRAFFIC_PER_SHOP * n0 + TRAFFIC_BASE) * 0.72


# ---------------- news scenarios: 24's generator, with the round range taken from ROUNDS ----
def make_scenario(rnd):
    R = ROUNDS
    n_index = [1.0 + rnd.gauss(0, 0.03) for _ in range(R + 1)]
    traffic = [1.0] * (R + 1)
    students_shift = [0.0] * (R + 1)
    warn = {}
    kind = rnd.choice(["calm", "spike", "spike", "crash"])
    r = rnd.randint(3, R - 3)
    if kind == "spike":
        for k, mult in enumerate([1.35, 1.35, 1.25, 1.12, 1.05]):
            if r + k <= R:
                n_index[r + k] *= mult
        warn[r - 1] = "commodity +35% next month"
    elif kind == "crash":
        for k in range(3):
            if r + k <= R:
                n_index[r + k] *= 0.8
        warn[r - 1] = "commodity -20% next month"
    demand_kind = rnd.choice(["none", "heatwave", "recession"])
    r2 = rnd.randint(2, R - 1)
    if demand_kind == "heatwave":
        traffic[r2] = 1.2
        warn[r2 - 1] = warn.get(r2 - 1, "") + " | traffic +20% next month"
    elif demand_kind == "recession":
        for k in range(r2, R + 1):
            traffic[k] = 0.9
            students_shift[k] = 0.10
    students = rnd.uniform(*STUDENT_SHARE)
    return dict(kind=kind, students=students, n=n_index, traffic=traffic, shift=students_shift, warn=warn)


# ---------------- the View: the only thing a bot ever receives --------------------
AW_EST = {"none": 0.6, "low": 0.8, "high": 0.92}     # awareness a viewer infers from the visible ad level
ADS_EST = {"none": 0.0, "low": 500.0, "high": 1500.0}


def occupied(m):
    taken = set()
    for q in m.players:
        if not q["out"]:
            taken.add(q["slot"])
            if q["second"] is not None:
                taken.add(q["second"])
    if m.buyout:
        taken.add(m.buyout["slot"])                    # reserved for this round's buyout auction
    return taken


def make_view(m, pid, offer=None):
    p, t = m.players[pid], m.t
    taken = occupied(m)
    world = dict(round=t, n0=m.n0, n_alive=sum(not q["out"] for q in m.players),
                 students=min(0.9, m.sc["students"] + m.sc["shift"][t]), n_now=m.sc["n"][t - 1],
                 traffic_now=m.sc["traffic"][t], traffic_prev=m.sc["traffic"][t - 1],
                 warn=m.sc["warn"].get(t, ""), slot_rent=tuple(SLOT_RENT[:m.n0 + 1]),
                 slot_w=tuple(SLOT_W[:m.n0 + 1]),
                 free_slots=tuple(s for s in range(m.n0 + 1) if s not in taken),
                 buyout=dict(m.buyout_public) if m.buyout else None,
                 supplier_left=dict(m.supplier_left),
                 attack_log=tuple(dict(e) for e in m.attack_log),
                 betrayals=tuple(m.betrayals))
    rivals = []
    for q in m.players:
        if q["id"] == pid:
            continue
        r = dict(id=q["id"], name=q["name"], bot=q["bot"], out=q["out"], price=q["price"], tier=q["tier"],
                 stars=round(q["rep"], 1), staff=q["staff"], ads_level=ads_level(q["ads"]), slot=q["slot"],
                 second=q["second"], rent=q["rent"], served_seen=q["served_seen"], badge=q["badge"],
                 broke_deals=q["marks"], loyalty=q["loyalty_left"] > 0)
        if m.leak:                                     # negative control only: a broken view builder
            r["cash"] = q["cash"]
        rivals.append(r)
    me = dict(id=pid, cash=p["cash"], debt=p["debt"], limit=credit_limit(p["last_rev"]), staff=p["staff"],
              wage=p["wage"], inv=p["inv"], inv_tier=p["inv_tier"], rep=p["rep"], aw=p["aw"], slot=p["slot"],
              second=p["second"], rent=p["rent"], rent2=p["rent2"], price=p["price"], tier=p["tier"],
              ads=p["ads"], last_d=p["last_d"], last_served=p["last_served"], last_rev=p["last_rev"],
              last_flow=p["last_flow"], badge=p["badge"], loyalty_left=p["loyalty_left"],
              fc_left=p["fc_left"], pact=dict(p["pact"]) if p["pact"] else None)
    return dict(world=world, me=me, rivals=tuple(rivals), offer=dict(offer) if offer else None)


def public_forecast(v, price, tier, ads, extra_w=0.0, extra_regulars=0.0):
    """Customers I should expect this month, computed only from my own screen.
    The same function feeds the human's price-slider forecast (report 34), so a bot
    that uses it knows exactly as much as a human who reads the forecast."""
    w, me = v["world"], v["me"]
    traffic = (TRAFFIC_PER_SHOP * w["n0"] + TRAFFIC_BASE) * w["traffic_now"]
    rivals = [r for r in v["rivals"] if not r["out"]]
    raised = me["price"] and price > 1.1 * me["price"] and not me["loyalty_left"]
    keep = RETAIN * me["rep"] / 4 * (0.5 if raised else 1) + (LOYALTY_KEEP if me["loyalty_left"] else 0)
    reg_me = keep * me["last_served"] + extra_regulars
    reg_rivals = sum(RETAIN * r["stars"] / 4 * (r["served_seen"] or 0) for r in rivals)
    floating = max(0.0, traffic - reg_me - reg_rivals)
    st = w["students"]
    sw = w["slot_w"]
    slot_me = sw[me["slot"]] + (SECOND_W * sw[me["second"]] if me["second"] is not None else 0) + extra_w
    demand = reg_me
    for seg in SEGMENTS:
        share = st if seg["name"] == "students" else 1 - st

        def util(p_, q_, rep_, a_):
            return (-seg["e"] * math.log(p_ / P_REF) + seg["bq"] * q_ + seg["br"] * (rep_ - 3)
                    + ADS_W * math.log(1 + a_ / ADS_HALF))
        mine = me["aw"] * slot_me * math.exp(util(price, QUALITY[tier], me["rep"], ads))
        other = 0.0
        for r in rivals:
            rw = sw[r["slot"]] + (SECOND_W * sw[r["second"]] if r["second"] is not None else 0)
            other += AW_EST[r["ads_level"]] * rw * math.exp(
                util(r["price"] or P_REF, QUALITY[r["tier"]], r["stars"], ADS_EST[r["ads_level"]]))
        demand += floating * share * mine / (OUTSIDE * w["n0"] + mine + other)
    return demand


# ---------------- bots: five characters x three levels -----------------------------
PERSONAS = {
    #        label                 quality  price x P_REF  cost pass-through  wage x market  round-1 lease bid
    "Dan":   dict(label="Discount Dan", tier="eco", anchor=0.90, pass_=0.5, wage=1.0, bid=("slot", 1)),
    "Paula": dict(label="Premium Paula", tier="prem", anchor=1.35, pass_=0.8, wage=1.15, bid=("slot", 1)),
    "Boris": dict(label="Blitz Boris", tier="std", anchor=0.92, pass_=0.6, wage=1.15, bid=("corner", 1.15)),
    "Fay":   dict(label="Dealer Fay", tier="std", anchor=1.05, pass_=0.7, wage=1.0, bid=("slot", 1)),
    "Ada":   dict(label="Analyst Ada", tier="auto", anchor=None, pass_=0.6, wage=None, bid=("value",)),
}
OFFER_STYLE = {"Dan": None, "Paula": "freeze", "Boris": None, "Fay": "always", "Ada": "peace"}
WAR_STYLE = {"Dan": "match", "Paula": "loyalty", "Boris": "strike", "Fay": "deal", "Ada": "wait"}
BUYOUT_FRAC = {"Dan": 0.5, "Paula": 0.55, "Boris": 0.8, "Fay": 0.5, "Ada": 0.6}
ADA_MULT = {"eco": 0.9, "std": 1.0, "prem": 1.4}


class Bot:
    bot = True

    def __init__(self, persona, level="normal", seed=0, off=None, fight=None, show=False):
        assert persona in PERSONAS and level in ("easy", "normal", "hard")
        self.persona, self.level = persona, level
        # fight = attacks, betrayal, revenge, price-war reactions. Off on easy, except the demo preset
        self.fight = (level != "easy") if fight is None else fight
        self.show = show                              # demo preset: Boris poaches even when he needs nobody
        self.off = DEFAULT_OFF if off is None else frozenset(off)   # actions switched off by the room rules
        self.P = PERSONAS[persona]
        self.key = persona if level == "normal" else f"{persona}/{level}" + ("+fight" if fight and level == "easy" else "")
        self.name = f"{self.P['label']} (bot)"
        self.rnd = random.Random(seed)              # seeded from the match seed: replays are exact
        self.grudge, self.revenge, self.blocked, self.threat = set(), {}, {}, {}
        self.seen_round, self.war_streak, self.poached_me, self.betrayed_at = 0, 0, False, -9
        self.locked_tier, self.locked_students = None, None
        self.served_hist = []
        self.retain_streak = (-9, 0)                           # (last round with a retention bonus, streak)
        self.dumped = {}                                       # prey -> round it was dumped on (once per prey)

    # ---------- what the bot remembers: only public events -------------------------
    def observe(self, v):
        w, me = v["world"], v["me"]
        t = w["round"]
        if t == self.seen_round:
            return
        self.seen_round = t
        for e in w["attack_log"]:
            if e["type"] == "poach":
                if e["by"] != me["id"]:
                    self.threat[e["by"]] = t - 1
                if e["by"] == me["id"] and e["result"] == "blocked":
                    self.blocked[e["target"]] = t - 1          # try someone else for 3 rounds
                if e["by"] == me["id"] and e["result"] == "refused":
                    self.blocked[e["target"]] = 99             # his wage is too high: never again
                if e["target"] == me["id"] and e["result"] == "success":
                    self.poached_me = True
        self.served_hist.append(me["last_served"])
        for traitor, victim in w["betrayals"]:
            if victim == me["id"]:
                self.grudge.add(traitor)
                if WAR_STYLE[self.persona] in ("strike", "deal") and self.fight:
                    self.revenge[traitor] = t
            if traitor == me["id"]:
                self.betrayed_at = t - 1

    # ---------- small helpers -------------------------------------------------------
    @staticmethod
    def alive(v):
        return [r for r in v["rivals"] if not r["out"]]

    @staticmethod
    def rival(v, rid):
        return next(r for r in v["rivals"] if r["id"] == rid)

    @staticmethod
    def headroom(v):
        return max(0.0, v["me"]["limit"] - v["me"]["debt"])

    def runway(self, v):
        burn = -v["me"]["last_flow"]
        return (v["me"]["cash"] + self.headroom(v)) / burn if burn > 0 else 99.0

    def forecast(self, v):
        me, w = v["me"], v["world"]
        if me["last_d"]:
            return me["last_d"] * w["traffic_now"] / max(0.5, w["traffic_prev"])
        return expected_street(w["n0"]) / w["n_alive"]

    def tier(self, v):
        if self.P["tier"] != "auto":
            return self.P["tier"]
        s = v["world"]["students"]
        if self.level == "easy":
            return "std"                                       # easy Ada does not read the street
        if self.level == "normal":
            return "eco" if s >= 0.6 else "prem" if s < 0.45 else "std"
        if self.locked_tier is None or abs(s - self.locked_students) >= 0.08:
            me, best = v["me"], None
            for tier in ("eco", "std", "prem"):
                wage = WAGE * (1.15 if tier == "prem" else 1.0)
                price = self.best_price(v, tier, self.anchor(v, tier), 500.0, wage)
                value = self.value(v, price, tier, 500.0, wage)
                if self.locked_tier and tier != self.locked_tier:
                    value -= 0.5 * me["inv"] * unit_cost(me["inv_tier"], v["world"]["n_now"]) + 300
                if best is None or value > best[0]:
                    best = (value, tier)
            self.locked_tier, self.locked_students = best[1], s
        return self.locked_tier

    def anchor(self, v, tier):
        t = v["world"]["round"]
        if self.persona == "Ada":
            mult = ADA_MULT[tier]
        elif self.persona == "Boris":
            early = ROUNDS // 3                           # 4 of 12, 2 of 6
            mult = 0.88 if t <= early else 0.95 if t == early + 1 else 1.0
        else:
            mult = self.P["anchor"]
        shift = unit_cost(tier, v["world"]["n_now"]) - unit_cost(tier, 1.0)
        return P_REF * mult + self.P["pass_"] * shift

    def ads(self, t):
        blitz = 600.0 if "blitz_ads" in self.off else (1500.0 if t <= ROUNDS // 4 else 600.0)
        return {"Dan": 300.0, "Paula": 500.0, "Fay": 500.0, "Ada": 500.0}.get(self.persona, blitz)

    def staff_mult(self, t):
        return {"Dan": 1.10, "Boris": 1.15 if t <= ROUNDS // 3 else 1.0}.get(self.persona, 1.0)

    def wage_mult(self, tier):
        if self.persona == "Ada":
            base = 1.15 if tier == "prem" else 1.0
        else:
            base = 1.0 if "wage" in self.off else self.P["wage"]
        if self.poached_me and self.level != "easy":
            base = max(base, 1.15)                    # 24: the permanent counter to poaching
        return base

    def value(self, v, price, tier, ads, wage):
        """This month's profit plus next month's margin from the regulars it creates (public forecast)."""
        cost = unit_cost(tier, v["world"]["n_now"])
        fair = P_REF * (1 + 0.3 * QUALITY[tier])
        d = public_forecast(v, price, tier, ads)
        st = staff_for(d, tier)
        served = min(d, capacity_of(st, tier))
        margin = served * (price - cost)
        return margin * (1 + RETAIN * v["me"]["rep"] / 4) - st * wage - 1500 * max(0.0, price / fair - 1.2)

    def best_price(self, v, tier, anchor, ads, wage):
        """Hard level: tune the character's own price by -8%..+8% on the public forecast."""
        grid = [anchor * (0.92 + 0.02 * k) for k in range(9)]
        return max(grid, key=lambda p: self.value(v, p, tier, ads, wage))

    def month_value(self, v, price, tier, ads, wage, extra_w=0.0, extra_reg=0.0):
        cost = unit_cost(tier, v["world"]["n_now"])
        d = public_forecast(v, price, tier, ads, extra_w, extra_reg)
        st = staff_for(d, tier)
        return min(d, capacity_of(st, tier)) * (price - cost) - st * wage

    def shop_gain(self, v, price, tier, ads, wage, slot, extra_reg=0.0):
        """Extra profit per month from one more storefront in `slot` (public forecast)."""
        w = v["world"]
        base = self.month_value(v, price, tier, ads, wage)
        more = self.month_value(v, price, tier, ads, wage, SECOND_W * w["slot_w"][slot], extra_reg)
        return more - base - w["slot_rent"][slot] - MISC

    def war_on_me(self, v, tier):
        """A rival sells below its visible cost, or undercuts me by 15%+ with equal or better quality."""
        me, w = v["me"], v["world"]
        mine = me["price"] or self.anchor(v, tier)
        hits = []
        for r in self.alive(v):
            if r["price"] is None:
                continue
            below_cost = is_dumping(r["price"], r["tier"], w["n_now"])
            undercut = QUALITY[r["tier"]] >= QUALITY[tier] and r["price"] <= 0.85 * mine
            if below_cost or undercut:
                hits.append(r)
        return min(hits, key=lambda r: r["price"]) if hits else None

    # ---------- diplomacy ----------------------------------------------------------
    def offer(self, v):
        self.observe(v)
        me, w = v["me"], v["world"]
        t = w["round"]
        style = OFFER_STYLE[self.persona]
        if me["pact"] or t >= ROUNDS or (self.level == "easy" and style != "always") or "pact" in self.off:
            return None
        tier = self.tier(v)
        anchor = self.anchor(v, tier)
        rivals = [r for r in self.alive(v) if r["id"] not in self.grudge and r["price"] is not None]
        if not rivals:
            return None
        war = self.war_on_me(v, tier)
        if style == "always" and t >= 2:
            clean = [r for r in rivals if r["broke_deals"] == 0] or rivals
            target = min(clean, key=lambda r: abs(r["price"] - anchor))
            return dict(to=target["id"], floor=round(0.98 * max(anchor, target["price"]), 1), escrow=1000)
        if style == "freeze":
            # Paula: losing customers to a cheaper shop of decent quality -> "hold your price where it is"
            losing = len(self.served_hist) >= 2 and self.served_hist[-1] < 0.95 * self.served_hist[-2]
            cheap = [r for r in rivals if r["tier"] != "eco" and r["broke_deals"] == 0
                     and r["price"] <= 0.8 * (me["price"] or anchor)]
            if losing and cheap:
                target = min(cheap, key=lambda r: r["price"])
                return dict(to=target["id"], floor=round(target["price"] + 0.2, 1), escrow=1000)
            return None
        if war is None or war["id"] in self.grudge:
            return None
        danger = self.runway(v) < 2 and self.persona not in ("Dan", "Boris")
        if style == "peace" or danger:
            avg = statistics.mean(r["price"] for r in rivals)
            return dict(to=war["id"], floor=round(0.95 * avg, 1), escrow=1000)
        return None

    def respond(self, v):
        self.observe(v)
        o, me, w = v["offer"], v["me"], v["world"]
        frm = self.rival(v, o["frm"])
        if self.persona in ("Dan", "Boris") or o["frm"] in self.grudge or "pact" in self.off:
            return False                                    # Dan and Boris never deal (pacts cost Boris ~5 p.p.)
        tier = self.tier(v)
        anchor = self.anchor(v, tier)
        if o["floor"] < unit_cost(tier, w["n_now"]) + 0.3 or o["escrow"] > 0.25 * max(0.0, me["cash"]):
            return False
        if self.persona == "Fay":
            return o["floor"] <= anchor * 1.10
        tolerance = 0 if self.persona == "Paula" else 1
        return frm["broke_deals"] <= tolerance and o["floor"] <= anchor * 1.05

    def should_betray(self, v, pact, cost):
        if not self.fight or "betray" in self.off:
            return False
        t = v["world"]["round"]
        partner = self.rival(v, pact["partner"])
        if partner["out"]:
            return False
        gain = 0.25 * (partner["served_seen"] or 0) * max(0.0, pact["floor"] - 0.3 - cost)
        esc = pact["escrow"]
        if self.persona == "Fay":
            return t >= ROUNDS - 1 or partner["badge"] == "Critical" or (t >= ROUNDS // 2 and gain > 1.5 * esc)
        if self.persona == "Ada":
            return t == ROUNDS and gain > esc
        return False

    # ---------- the move -------------------------------------------------------------
    def lease_bid(self, v):
        w, me = v["world"], v["me"]
        t = w["round"]
        rents = w["slot_rent"]
        if t not in LEASE_ROUNDS:
            return 0.0
        if self.level == "easy":
            default = rents[-2]                                # easy bots leave the good slots to humans
        elif self.P["bid"][0] == "slot":
            default = rents[min(self.P["bid"][1], len(rents) - 1)]
        elif self.P["bid"][0] == "corner" and "corner_bid" not in self.off:
            default = self.P["bid"][1] * rents[0]
        elif self.P["bid"][0] == "corner":
            default = rents[1]
        else:                                             # Ada: value-based
            default = 1.1 * rents[0] if self.level == "hard" else rents[1]
        if t == LEASE_ROUNDS[1]:
            if self.persona == "Boris" and self.fight and me["slot"] != 0 and "snipe" not in self.off:
                return 1.3 * rents[0]                         # lease snipe: take the corner from whoever has it
            return max(default, rents[me["slot"]])            # 24: renew at the landlord's terms
        return default

    def _cards(self, v, tier, price, ads, wage, war, need_staff=0):
        me, w = v["me"], v["world"]
        t, lvl, cash, who = w["round"], self.level, me["cash"], self.persona
        warn_up = "commodity +" in w["warn"]
        attack_ok = t not in NO_ATTACK_ROUNDS and self.fight
        poachers = [r for r in self.alive(v) if t - self.threat.get(r["id"], -9) <= 2]
        # guessing duel: guard only if I am the likeliest target of an active poacher (most staff)
        threat = False
        for pr in poachers:
            others = [r["staff"] for r in self.alive(v) if r["id"] != pr["id"]]
            if me["staff"] >= max(others, default=0):
                threat = True
        if lvl == "hard" and not threat:
            threat = bool(poachers) and me["staff"] >= 3

        def loyalty():
            return me["loyalty_left"] == 0 and cash >= LOYALTY_COST + 2000

        def forward():
            return lvl != "easy" and warn_up and me["fc_left"] == 0 and cash >= FORWARD_COST + 1000

        def retain():
            if t - self.retain_streak[0] == 1 and self.retain_streak[1] >= 2:
                return False                                   # never three retention bonuses in a row
            return (lvl != "easy" and threat and me["staff"] >= 2 and me["wage"] < 1.15 * WAGE - 1
                    and cash >= RETAIN_COST + 1000)

        def buyout():
            b = w["buyout"]
            if not b or me["second"] is not None:
                return None
            if lvl == "easy" and self.rnd.random() < 0.5:
                return None
            rest = ROUNDS - t + 1
            first = BUYOUT_INHERIT * (b["served_seen"] or 0) * max(0.0, price - unit_cost(tier, w["n_now"]))
            value = self.shop_gain(v, price, tier, ads, wage, b["slot"]) * rest + first
            bid = min(BUYOUT_FRAC[who] * SECOND_FITOUT, 0.8 * value)
            return ("buyout", round(bid)) if bid >= BUYOUT_MIN and cash >= bid + 2500 else None

        def second():
            if lvl == "easy" or t not in SECOND_ROUNDS or me["second"] is not None or not w["free_slots"]:
                return False
            if cash < SECOND_FITOUT + 3000 or self.runway(v) < 4:
                return False
            gain = self.shop_gain(v, price, tier, ads, wage, min(w["free_slots"]))
            return gain * (ROUNDS - t + 1) > 1.2 * SECOND_FITOUT

        def poach_target():
            # poach instead of hiring: only when I need one more person and pay enough to win him
            if not attack_ok or me["wage"] < 1.15 * WAGE - 1 or t > ROUNDS - max(1, ROUNDS // 4) \
                    or (need_staff <= me["staff"] and not self.show):
                return None
            cands = [r for r in self.alive(v) if r["staff"] >= 2 and t - self.blocked.get(r["id"], -9) > 3]
            return max(cands, key=lambda r: (r["staff"], r["stars"]))["id"] if cands else None

        def corner():
            if not attack_ok or cash < 6000:
                return False
            same = sum(1 for r in self.alive(v) if (r["tier"] == "prem") == (tier == "prem"))
            return same >= 1 and warn_up

        if who == "Boris" and t == 1 and lvl != "easy":
            yield ("loan", 6000.0)
        order = {
            "Dan":   ["war_loyalty", "retain", "buyout", "second"],
            "Paula": ["forward", "war_loyalty", "buyout", "second"],
            "Boris": ["corner", "war_poach", "poach", "buyout", "second"],
            "Fay":   ["retain", "forward", "war_loyalty", "after_betrayal", "buyout"],
            "Ada":   ["forward", "retain", "war_loyalty_big", "buyout", "second"],
        }[who]
        for item in order:
            if item == "war_loyalty" and war is not None and loyalty():
                yield ("loyalty",)
            if item == "war_loyalty_big" and war is not None and loyalty():
                attacker_cap = capacity_of(war["staff"], war["tier"])
                street = (TRAFFIC_PER_SHOP * w["n0"] + TRAFFIC_BASE) * w["traffic_now"]
                if attacker_cap >= 0.35 * street:                 # small attacker: wait, he burns cash
                    yield ("loyalty",)
            if item == "after_betrayal" and t - self.betrayed_at <= 1 and loyalty():
                yield ("loyalty",)
            if item == "retain" and retain():
                yield ("retain",)
            if item == "forward" and forward():
                yield ("forward",)
            if item == "corner" and corner():
                yield ("corner",)
            if item == "war_poach" and war is not None and attack_ok and war["staff"] >= 1 \
                    and t - self.blocked.get(war["id"], -9) > 3 and me["wage"] >= 1.15 * WAGE - 1 \
                    and need_staff > me["staff"]:
                yield ("poach", war["id"])
            if item == "poach":
                target = poach_target()
                if target is not None:
                    yield ("poach", target)
            if item == "buyout":
                bid = buyout()
                if bid:
                    yield bid
            if item == "second" and second():
                yield ("second",)
        if lvl == "easy" and war is None and me["last_d"] and me["last_served"] < 0.8 * me["last_d"] \
                and self.rnd.random() < 0.3 and loyalty():
            yield ("loyalty",)

    def pick_card(self, v, tier, price, ads, wage, war, need_staff=0):
        """First card in the character's priority list that the room rules allow."""
        for card in self._cards(v, tier, price, ads, wage, war, need_staff):
            if card[0] not in self.off:
                return card
        return None

    def decide(self, v):
        self.observe(v)
        me, w = v["me"], v["world"]
        t, lvl = w["round"], self.level
        tier = self.tier(v)
        cost = unit_cost(tier, w["n_now"])
        ads = self.ads(t) * (0.6 if lvl == "easy" else 1.0)
        wage = WAGE * self.wage_mult(tier)
        # 1. base price: the character's anchor; hard tunes it, easy blurs it
        price = self.anchor(v, tier)
        if lvl == "hard":
            price = self.best_price(v, tier, price, ads, wage)
        if lvl == "easy":
            price *= 1 + self.rnd.uniform(-0.12, 0.12)
        f = self.forecast(v)
        hedge = lvl != "easy"
        danger = self.runway(v) < (1.0 if lvl == "easy" else 2.0)
        war = self.war_on_me(v, tier) if self.fight else None
        # 2. revenge: undercut the traitor for one round (Boris, Fay)
        for traitor, seen in self.revenge.items():
            r = self.rival(v, traitor)
            if seen == t and not r["out"] and r["price"] and "revenge" not in self.off:
                price = max(cost + 0.15, min(price, r["price"] - 0.3))
        # 3. price war against me
        if war is not None and not danger and WAR_STYLE[self.persona] in ("match", "strike") and self.war_streak < 2 \
                and "war" not in self.off:
            price = max(cost + 0.15, min(price, war["price"] - 0.05))
            self.war_streak += 1
        elif war is None:
            self.war_streak = 0
        # 4. Boris sells at cost to finish a rival whose badge says Critical (dumping; off by default)
        if self.persona == "Boris" and self.fight and t not in NO_ATTACK_ROUNDS and not danger \
                and "dump" not in self.off and t <= ROUNDS - 2 and me["second"] is None \
                and me["cash"] >= BUYOUT_MIN + 6000:
            prey = [r for r in self.alive(v) if r["badge"] == "Critical" and r["price"] and r["id"] not in self.dumped]
            if prey:
                target = max(prey, key=lambda r: r["served_seen"] or 0)
                self.dumped[target["id"]] = t
                price = max(cost + 0.25, 0.5 * P_REF)
        # 5. staffing target: hard staffs for the demand at its chosen price, easy understaffs
        if lvl == "hard":
            f = 0.5 * f + 0.5 * public_forecast(v, price, tier, ads)
        staff_f = f * self.staff_mult(t) * (0.85 if lvl == "easy" else 1.0)
        if lvl != "easy" and "traffic +" in w["warn"]:
            staff_f *= 1.1                                    # heatwave next month: hire now, new staff work at 50%
        # 6. one card
        card = None if danger else self.pick_card(v, tier, price, ads, wage, war, staff_for(staff_f, tier))
        # 7. bankruptcy threat: survival mode overrides the levers above
        if danger:
            ads, hedge = 0.0, False
            staff_f *= 0.95
            price = max(price, cost * 1.6)
            head = self.headroom(v)
            card = ("loan", min(head, 6000.0)) if head >= 1000 else None
        # 8. pact last, so nothing above can break it by accident: hold the floor or betray on purpose
        if me["pact"]:
            if self.should_betray(v, me["pact"], cost):
                partner = self.rival(v, me["pact"]["partner"])
                price = max(cost + 0.2, min(me["pact"]["floor"], partner["price"] or me["pact"]["floor"]) - 0.3)
            else:
                price = max(price, me["pact"]["floor"])
        staff = staff_for(staff_f, tier)
        order = order_for(me, f, w["warn"], hedge, tier)
        if card and card[0] == "poach":
            staff = max(me["staff"], staff - 1)               # the poached worker replaces one hire
        if card and card[0] == "retain":
            streak = self.retain_streak[1] + 1 if t - self.retain_streak[0] == 1 else 1
            self.retain_streak = (t, streak)
        if card and card[0] == "corner":
            order = max(0.0, order - CORNER_SHARE * STOCK_MAIN * expected_street(w["n0"]))
        return dict(price=price, tier=tier, staff=staff, ads=ads, wage=wage, order=order,
                    bid=self.lease_bid(v), card=card)


class Caretaker:
    """Autopilot for a player who missed two deadlines (report 27): repeats the last move, no cards."""
    bot = True

    def __init__(self, seed=0):
        self.key, self.name = "Caretaker", "Caretaker (AFK bot)"

    def offer(self, v):
        return None

    def respond(self, v):
        return False

    def decide(self, v):
        me, w = v["me"], v["world"]
        f = me["last_d"] or expected_street(w["n0"]) / w["n_alive"]
        tier = me["tier"]
        price = max(me["price"] or P_REF, me["pact"]["floor"] if me["pact"] else 0)
        return dict(price=price, tier=tier, staff=staff_for(f, tier), ads=me["ads"], wage=me["wage"],
                    order=order_for(me, f, "", False, tier),
                    bid=w["slot_rent"][me["slot"]] if w["round"] in LEASE_ROUNDS else 0, card=None)


class Peeker(Bot):
    """Negative control for the fairness test: decides on rival cash, which a human never sees."""

    def decide(self, v):
        d = super().decide(v)
        cash = [r.get("cash") for r in v["rivals"] if not r["out"]]
        if cash and cash[0] is not None and max(cash) > 15000:
            d["price"] *= 0.95
        return d


# ---------------- human proxies (not bots): who the bots are tested against --------
class Proxy:
    bot = False

    def __init__(self, kind, seed=0):
        assert kind in ("Novice", "Rookie", "Balanced", "Adaptive")
        self.kind, self.key, self.name = kind, kind, "Human"
        self.rnd = random.Random(seed)
        self.base = self.rnd.uniform(0.9, 1.1)
        self.burned = set()

    def offer(self, v):
        return None

    def respond(self, v):
        o = v["offer"]
        frm = next(r for r in v["rivals"] if r["id"] == o["frm"])
        for traitor, victim in v["world"]["betrayals"]:
            if victim == v["me"]["id"]:
                self.burned.add(traitor)
        if o["frm"] in self.burned or frm["broke_deals"] >= (2 if self.kind == "Novice" else 1):
            return False                       # humans read the public "Broke a deal" mark
        if self.kind == "Novice":
            return self.rnd.random() < 0.5
        if self.kind == "Balanced":
            return o["floor"] <= P_REF
        if self.kind == "Adaptive":
            return o["floor"] <= P_REF * ADA_MULT[self._tier(v)]
        return False

    @staticmethod
    def _tier(v):
        s = v["world"]["students"]
        return "eco" if s >= 0.6 else "prem" if s < 0.45 else "std"

    def decide(self, v):
        me, w = v["me"], v["world"]
        t = w["round"]
        f = me["last_d"] or expected_street(w["n0"]) / w["n_alive"]
        lease = t in LEASE_ROUNDS
        renew = w["slot_rent"][me["slot"]] if t == LEASE_ROUNDS[1] else 0
        card = None
        if self.kind == "Novice":            # first match: keeps the UI defaults, nudges the price
            if self.rnd.random() < 0.3:
                self.base *= self.rnd.uniform(0.95, 1.05)
            tier, price, ads, wage = "std", P_REF * self.base, 300.0, WAGE
            ff = f * self.rnd.uniform(0.85, 1.15)
            staff, order = staff_for(ff, tier), order_for(me, ff, "", False, tier)
            bid = max(SLOT_RENT[2], renew) if lease else 0
        elif self.kind == "Rookie":          # 24's Rookie: random but plausible
            r = self.rnd
            tier = r.choice(["eco", "std", "std", "prem"])
            ff = f * r.uniform(0.8, 1.5)
            price, ads = P_REF * r.uniform(0.8, 1.35), r.choice([0, 300, 800, 1500, 2500])
            wage = WAGE * r.choice([1.0, 1.0, 1.15])
            staff, order = staff_for(ff, tier), order_for(me, ff, w["warn"], False, tier)
            bid = r.choice(SLOT_RENT[:4]) if lease else 0
            loan = r.choice([0, 0, 0, 5000, 10000]) if t <= 3 else 0
            card = ("loan", float(loan)) if loan else None
        elif self.kind == "Balanced":        # 24's Balanced
            tier, price, ads, wage = "std", P_REF, 500.0, WAGE
            staff, order = staff_for(f, tier), order_for(me, f, w["warn"], True, tier)
            bid = max(SLOT_RENT[1], renew) if lease else 0
        else:                                # 24's Adaptive: a skilled human
            tier = self._tier(v)
            shift = unit_cost(tier, w["n_now"]) - unit_cost(tier, 1.0)
            price, ads = P_REF * ADA_MULT[tier] + 0.6 * shift, 500.0
            wage = WAGE * (1.15 if tier == "prem" else 1.0)
            staff, order = staff_for(f, tier), order_for(me, f, w["warn"], True, tier)
            bid = max(SLOT_RENT[1], renew) if lease else 0
        if me["pact"]:
            price = max(price, me["pact"]["floor"])
        return dict(price=price, tier=tier, staff=staff, ads=ads, wage=wage, order=order, bid=bid, card=card)


# ---------------- engine -------------------------------------------------------------
HIDDEN_NUMERIC = ("cash", "debt", "inv", "aw", "carry", "bid", "last_d", "last_rev", "last_flow",
                  "inherited", "cogs", "fc_vol")


def new_player(i, name, bot):
    return dict(id=i, name=name, bot=bot, cash=float(START_CASH), debt=0.0, staff=1, new=0, wage=WAGE,
                rep=3.0, aw=0.5, inv=0.0, inv_tier="std", slot=0, rent=0.0, second=None, rent2=0.0,
                out=False, out_round=None, carry=0.0, price=None, tier="std", ads=0.0, bid=0.0,
                last_d=None, last_served=0.0, served_seen=None, prev_price=None, last_rev=0.0, last_flow=0.0,
                badge="Healthy", marks=0, loyalty_left=0, fc_left=0, fc_n=1.0, fc_vol=0.0, fc_tier=None,
                pact=None, inherited=0.0, cogs=0.0, net_hist=[])


class Match:
    def __init__(self, seats, seed, leak=False):
        self.rnd = random.Random(seed)
        self.sc = make_scenario(self.rnd)
        self.n0, self.t, self.leak, self.seats = len(seats), 0, leak, seats
        self.players = [new_player(i, s.name, s.bot) for i, s in enumerate(seats)]
        self.attack_log, self.betrayals = [], []
        self.supplier_left = {"main": 1.0, "prem": 1.0}
        self.buyout, self.buyout_public = None, None
        self.usage = [Counter() for _ in seats]
        self.events = []


def perturbed(m, pid, rnd):
    """Copy of the match where every field a human cannot see about rivals is random."""
    s = copy.copy(m)
    s.players = copy.deepcopy(m.players)
    for q in s.players:
        if q["id"] == pid:
            continue
        for k in HIDDEN_NUMERIC:
            q[k] = rnd.uniform(0, 30000) if k not in ("aw",) else rnd.uniform(0.3, 1.0)
        q["wage"] = WAGE * rnd.choice(WAGE_LEVELS)
        q["inv_tier"] = rnd.choice(list(QUALITY))
        q["fc_left"], q["new"] = rnd.randint(0, 3), rnd.randint(0, q["staff"])
        lo, hi = {"none": (0, 199), "low": (200, 999), "high": (1000, 3000)}[ads_level(q["ads"])]
        q["ads"] = rnd.uniform(lo, hi)
        if q["pact"] and q["pact"]["partner"] != pid:
            q["pact"] = None if rnd.random() < 0.5 else dict(q["pact"], floor=rnd.uniform(3, 9))
    return s


def ask(m, p, method, fairness, offer=None):
    seat = m.seats[p["id"]]
    view = make_view(m, p["id"], offer)
    if fairness is None or not seat.bot:
        return getattr(seat, method)(view)
    twin = copy.deepcopy(seat)
    shadow = make_view(perturbed(m, p["id"], fairness["rnd"]), p["id"], offer)
    a, b = getattr(seat, method)(view), getattr(twin, method)(shadow)
    fairness["checks"] += 1
    fairness["diffs"] += a != b
    return a


def validate(m, p, d):
    t = m.t
    out = dict(price=min(3 * P_REF, max(0.5 * P_REF, float(d.get("price") or P_REF))),
               tier=d.get("tier") if d.get("tier") in QUALITY else "std",
               staff=int(max(0, min(8, d.get("staff", p["staff"])))),
               ads=float(max(0.0, min(3000.0, d.get("ads", 0.0)))),
               wage=WAGE * min(WAGE_LEVELS, key=lambda x: abs(x - d.get("wage", WAGE) / WAGE)),
               order=float(max(0.0, min(3 * expected_street(m.n0), d.get("order", 0.0)))),
               bid=float(max(0.0, min(2 * SLOT_RENT[0], d.get("bid", 0.0)))) if t in LEASE_ROUNDS else 0.0,
               card=None)
    card = d.get("card")
    if card and card[0] in CARDS:
        kind = card[0]
        ok = not (kind in ATTACKS and t in NO_ATTACK_ROUNDS)
        if kind == "poach":
            tgt = card[1] if len(card) > 1 else None
            ok = ok and isinstance(tgt, int) and 0 <= tgt < m.n0 and tgt != p["id"] and not m.players[tgt]["out"]
        if kind == "second":
            ok = ok and t in SECOND_ROUNDS and p["second"] is None
        if kind == "buyout":
            ok = ok and m.buyout is not None and p["second"] is None and len(card) > 1 and card[1] >= BUYOUT_MIN
        if kind == "loan":
            ok = ok and len(card) > 1 and card[1] > 0
        if kind == "loyalty":
            ok = ok and p["loyalty_left"] == 0
        if kind == "forward":
            ok = ok and p["fc_left"] == 0
        if ok:
            out["card"] = tuple(card)
    return out


def auction(m, ev):
    """24's sealed first-price lease auction; second-shop slots are not re-auctioned."""
    alive = [p for p in m.players if not p["out"]]
    n_slots = m.n0 + 1
    floors = list(SLOT_RENT[:n_slots])
    seconds = {p["second"] for p in alive if p["second"] is not None}
    free = [s for s in range(n_slots) if s not in seconds]
    before = {p["id"]: p["slot"] for p in alive}
    ties = {p["id"]: m.rnd.random() for p in alive}

    def score(p):
        return p["bid"] * (1.10 if (m.t > 1 and p["bid"] >= floors[p["slot"]]) else 1.0)
    for p in sorted(alive, key=lambda q: (score(q), ties[q["id"]]), reverse=True):
        affordable = [s for s in free if p["bid"] >= floors[s]] or [free[-1]]
        if OLD_AUCTION:                               # 24's rule, kept only to measure its side effect
            slot = affordable[0]
        else:   # fix vs 24: among equally good slots keep your own, nobody pays $2,000 to move sideways
            slot = max(affordable, key=lambda s: (SLOT_W[s], s == p["slot"] and m.t > 1, -s))
        free.remove(slot)
        if m.t > 1 and slot != p["slot"]:
            p["cash"] -= MOVE_COST
            p["aw"] *= 0.6
        p["slot"] = slot
        p["rent"] = max(floors[slot], min(p["bid"], floors[slot] * 1.5)) if p["bid"] >= floors[slot] else floors[slot]
    if m.t > 1:
        for p in alive:
            for q in alive:
                if q is not p and p["slot"] == before[q["id"]] and q["slot"] != before[q["id"]]:
                    ev.append(dict(type="lease", by=p["id"], target=q["id"], result="took the slot"))
                    m.usage[p["id"]]["lease_takeover"] += 1


def play(seats, seed, verbose=False, fairness=None, leak=False):
    m = Match(seats, seed, leak)
    P = m.players
    for t in range(1, ROUNDS + 1):
        m.t = t
        alive = [p for p in P if not p["out"]]
        if len(alive) <= 1:
            break
        ev, betrayals = [], []
        # 1. diplomacy: one offer per player without a pact, answered at once
        offers = []
        for p in alive:
            if p["pact"] is None:
                o = ask(m, p, "offer", fairness)
                if o and isinstance(o.get("to"), int) and 0 <= o["to"] < m.n0 and o["to"] != p["id"] \
                        and not P[o["to"]]["out"] and o.get("escrow", 0) in PACT_ESCROWS \
                        and 0.5 * P_REF <= o.get("floor", 0) <= 3 * P_REF:
                    offers.append((p["id"], o))
        m.rnd.shuffle(offers)
        for pid, o in offers:
            a, b = P[pid], P[o["to"]]
            if a["pact"] or b["pact"] or a["cash"] < o["escrow"] or b["cash"] < o["escrow"]:
                continue
            m.usage[pid]["pact_offer"] += 1
            offer = dict(frm=pid, floor=o["floor"], rounds=PACT_ROUNDS, escrow=o["escrow"])
            if ask(m, b, "respond", fairness, offer):
                until = t + PACT_ROUNDS - 1
                a["pact"] = dict(partner=b["id"], floor=o["floor"], until=until, escrow=o["escrow"])
                b["pact"] = dict(partner=a["id"], floor=o["floor"], until=until, escrow=o["escrow"])
                a["cash"] -= o["escrow"]
                b["cash"] -= o["escrow"]
                m.usage[pid]["pact_made"] += 1
                m.usage[b["id"]]["pact_made"] += 1
                m.usage[b["id"]]["pact_accept"] += 1
        # 2. secret simultaneous moves
        dec = {p["id"]: validate(m, p, ask(m, p, "decide", fairness)) for p in alive}
        n_now = m.sc["n"][t]
        # 3. levers, loans, loyalty cards
        for p in alive:
            d = dec[p["id"]]
            p.update(price=d["price"], tier=d["tier"], ads=d["ads"], wage=d["wage"], bid=d["bid"])
            card = d["card"]
            if is_dumping(p["price"], p["tier"], n_now):
                m.usage[p["id"]]["price_war_round"] += 1
            if card:
                m.usage[p["id"]]["card_" + card[0]] += 1
            if card and card[0] == "loan":
                amount = min(card[1], max(0.0, credit_limit(p["last_rev"]) - p["debt"]))
                p["debt"] += amount
                p["cash"] += amount
            if card and card[0] == "loyalty":
                p["loyalty_left"] = LOYALTY_ROUNDS
                p["cash"] -= LOYALTY_COST
        # 4. buyout of last round's bankrupt, then second shops, then the lease auction
        if m.buyout:
            bids = [(dec[p["id"]]["card"][1], m.rnd.random(), p) for p in alive
                    if dec[p["id"]]["card"] and dec[p["id"]]["card"][0] == "buyout" and p["second"] is None]
            if bids:
                amount, _, w = max(bids, key=lambda x: (x[0], x[1]))
                w["cash"] -= amount
                w["second"], w["rent2"] = m.buyout["slot"], SLOT_RENT[m.buyout["slot"]]
                w["inherited"] = BUYOUT_INHERIT * m.buyout["served"]
                ev.append(dict(type="buyout", by=w["id"], target=m.buyout["from"], result=f"${amount:,.0f}"))
                m.usage[w["id"]]["buyout_won"] += 1
            m.buyout, m.buyout_public = None, None
        wants = [p for p in alive if dec[p["id"]]["card"] and dec[p["id"]]["card"][0] == "second"]
        m.rnd.shuffle(wants)
        for p in wants:
            free = [s for s in range(m.n0 + 1) if s not in occupied(m)]
            if free and p["second"] is None:
                p["second"], p["rent2"] = min(free), SLOT_RENT[min(free)]
                p["cash"] -= SECOND_FITOUT
                ev.append(dict(type="second", by=p["id"], target=None, result=f"slot {min(free)}"))
                m.usage[p["id"]]["second_opened"] += 1
        if t in LEASE_ROUNDS:
            for p in alive:
                if p["bid"] >= SLOT_RENT[0] * (1.25 if t > 1 else 1.0):
                    m.usage[p["id"]]["lease_bid_" + ("corner" if t == 1 else "snipe")] += 1
            auction(m, ev)
        # 5. labour: hiring, retention bonuses, poaching (revealed together)
        for p in alive:
            want = dec[p["id"]]["staff"]
            p["new"] = max(0, want - p["staff"])
            p["cash"] -= HIRE_COST * max(0, want - p["staff"]) + FIRE_COST * max(0, p["staff"] - want)
            p["staff"] = want
        retain = set()
        for p in alive:
            if dec[p["id"]]["card"] and dec[p["id"]]["card"][0] == "retain":
                retain.add(p["id"])
                p["cash"] -= RETAIN_COST
        hits = Counter()
        poachers = [p for p in alive if dec[p["id"]]["card"] and dec[p["id"]]["card"][0] == "poach"]
        m.rnd.shuffle(poachers)
        for p in poachers:
            tid = dec[p["id"]]["card"][1]
            tgt = P[tid]
            if tgt["staff"] == 0 or hits[tid] >= MAX_HITS_PER_TARGET:
                result = "no target"
            elif tid in retain:
                p["cash"] -= POACH_BONUS
                result = "blocked"
            elif p["wage"] >= POACH_EDGE * tgt["wage"] - 1e-6:
                tgt["staff"] -= 1
                tgt["new"] = min(tgt["new"], tgt["staff"])
                p["staff"] += 1
                p["cash"] -= POACH_BONUS
                result = "success"
            else:
                result = "refused"
            hits[tid] += 1
            ev.append(dict(type="poach", by=p["id"], target=tid, result=result))
            m.usage[p["id"]]["poach_" + result.replace(" ", "_")] += 1
        # 6. suppliers: forward contracts first, then corner supply, then pro-rata
        for p in alive:
            d = dec[p["id"]]
            if d["card"] and d["card"][0] == "forward":
                p.update(fc_left=FORWARD_ROUNDS, fc_n=n_now, fc_tier=p["tier"], fc_vol=d["order"])
                p["cash"] -= FORWARD_COST
        exp_street = expected_street(m.n0)
        left_share = {}
        for sup, tiers, share in (("main", ("eco", "std"), STOCK_MAIN), ("prem", ("prem",), STOCK_PREM)):
            stock = exp_street * share
            buyers = [p for p in alive if p["tier"] in tiers]
            fc = {p["id"]: min(dec[p["id"]]["order"], p["fc_vol"]) for p in buyers
                  if p["fc_left"] > 0 and p["fc_tier"] == p["tier"]}
            if sum(fc.values()) > stock:
                k = stock / sum(fc.values())
                fc = {i: x * k for i, x in fc.items()}
            left = stock - sum(fc.values())
            corner, squeeze = {}, 1.0
            for p in buyers:
                if dec[p["id"]]["card"] and dec[p["id"]]["card"][0] == "corner":
                    take = min(CORNER_SHARE * stock, left)
                    corner[p["id"]] = take
                    left -= take
                    squeeze = CORNER_SQUEEZE
                    ev.append(dict(type="corner", by=p["id"], target=None, result=f"{take:,.0f} units"))
            rest = {p["id"]: max(0.0, dec[p["id"]]["order"] - fc.get(p["id"], 0.0)) for p in buyers}
            need = sum(rest.values())
            fill = min(1.0, left / need) if need > 0 else 1.0
            for p in buyers:
                pid, tier = p["id"], p["tier"]
                c = unit_cost(tier, n_now)
                got = rest[pid] * fill
                cost = (fc.get(pid, 0.0) * unit_cost(tier, p["fc_n"]) + got * c * squeeze
                        + (rest[pid] - got) * c * SPOT_MARKUP * squeeze + corner.get(pid, 0.0) * c * CORNER_MARKUP)
                if p["inv_tier"] != tier:
                    p["inv"] *= 0.5
                p["inv"] += fc.get(pid, 0.0) + rest[pid] + corner.get(pid, 0.0)
                p["inv_tier"] = tier
                p["cash"] -= cost
                p["cogs"] = cost
            left_share[sup] = max(0.0, left - need * fill) / stock
        # 7. demand: 24's two-segment logit; second shops add a storefront, loyalty keeps regulars
        traffic = (TRAFFIC_PER_SHOP * m.n0 + TRAFFIC_BASE) * m.sc["traffic"][t]
        regulars = {}
        for p in alive:
            raised = p["prev_price"] and p["price"] > 1.1 * p["prev_price"] and p["loyalty_left"] == 0
            keep = RETAIN * p["rep"] / 4 * (0.5 if raised else 1) + (LOYALTY_KEEP if p["loyalty_left"] else 0)
            regulars[p["id"]] = keep * p["last_served"] + p["inherited"]
            p["inherited"] = 0.0
        floating = max(0.0, traffic - sum(regulars.values()))
        demand = dict(regulars)
        attract = {p["id"]: 0.0 for p in alive}
        st_share = min(0.9, m.sc["students"] + m.sc["shift"][t])
        for seg in SEGMENTS:
            share = st_share if seg["name"] == "students" else 1 - st_share
            weights = {}
            for p in alive:
                u = (-seg["e"] * math.log(p["price"] / P_REF) + seg["bq"] * QUALITY[p["tier"]]
                     + seg["br"] * (p["rep"] - 3) + ADS_W * math.log(1 + p["ads"] / ADS_HALF))
                sw = SLOT_W[p["slot"]] + (SECOND_W * SLOT_W[p["second"]] if p["second"] is not None else 0)
                weights[p["id"]] = p["aw"] * sw * math.exp(u)
                attract[p["id"]] += weights[p["id"]]
            denom = OUTSIDE * m.n0 + sum(weights.values())
            for pid, wgt in weights.items():
                demand[pid] += floating * share * wgt / denom
        served, lost = {}, {}
        for p in alive:
            cap = min(capacity_of(p["staff"], p["tier"], p["new"]), p["inv"])
            served[p["id"]] = min(demand[p["id"]], cap)
            lost[p["id"]] = demand[p["id"]] - served[p["id"]]
        spill = SPILL * sum(lost.values())
        spare = {p["id"]: min(capacity_of(p["staff"], p["tier"], p["new"]), p["inv"]) - served[p["id"]] for p in alive}
        w_spare = {pid: attract[pid] for pid in spare if spare[pid] > 1}
        for pid, wgt in w_spare.items():
            served[pid] += min(spare[pid], spill * wgt / sum(w_spare.values()))
        # 8. pacts are checked at the reveal: price below the floor = betrayal, escrow to the partner
        for p in alive:
            pact = p["pact"]
            if not pact or p["id"] > pact["partner"]:
                continue
            q = P[pact["partner"]]
            pb, qb, esc = p["price"] < pact["floor"] - 1e-9, q["price"] < pact["floor"] - 1e-9, pact["escrow"]
            end = pb or qb or t >= pact["until"]
            if pb and qb:
                p["cash"] += esc
                q["cash"] += esc
            elif pb or qb:
                traitor, victim = (p, q) if pb else (q, p)
                victim["cash"] += 2 * esc
                betrayals.append((traitor["id"], victim["id"]))
            elif end:
                p["cash"] += esc
                q["cash"] += esc
                m.usage[p["id"]]["pact_kept"] += 1
                m.usage[q["id"]]["pact_kept"] += 1
            for traitor in [x for x, b in ((p, pb), (q, qb)) if b]:
                traitor["marks"] += 1
                m.usage[traitor["id"]]["betrayal"] += 1
            if end:
                p["pact"] = q["pact"] = None
        # 9. money (24) + second-shop rent, bankruptcy
        bankrupts = []
        for p in alive:
            pid = p["id"]
            rev = served[pid] * p["price"]
            p["inv"] = (p["inv"] - served[pid]) * (1 - SPOIL)
            limit = credit_limit(rev)
            interest = p["debt"] * (RATE_LOW if p["debt"] <= 0.5 * limit else RATE_HIGH)
            costs = (p["staff"] * p["wage"] + p["rent"] + p["rent2"] + p["ads"]
                     + MISC * (2 if p["second"] is not None else 1) + interest)
            p["cash"] += rev - costs
            profit = rev - costs - p["cogs"]
            taxable = max(0.0, profit - p["carry"])
            p["carry"] = max(0.0, p["carry"] - profit) if profit > 0 else p["carry"] - profit
            tax = TAX * taxable
            p["cash"] -= tax
            p["last_flow"] = profit - tax
            if p["cash"] < 0:
                need = -p["cash"]
                if p["debt"] + need > limit:
                    p["out"], p["out_round"] = True, t
                    bankrupts.append(p)
                else:
                    p["debt"] += need
                    p["cash"] = 0.0
            elif p["debt"] > 0 and p["cash"] > REPAY_ABOVE:
                pay = min(p["debt"], p["cash"] - REPAY_ABOVE)
                p["debt"] -= pay
                p["cash"] -= pay
            p["last_rev"] = rev
        for p in bankrupts:
            ev.append(dict(type="bankrupt", by=p["id"], target=None, result=f"round {t}"))
            if p["pact"]:
                partner = P[p["pact"]["partner"]]
                partner["cash"] += 2 * p["pact"]["escrow"]
                partner["pact"] = p["pact"] = None
            p["second"] = None
        if bankrupts:
            b = min(bankrupts, key=lambda q: q["slot"])
            m.buyout = dict(slot=b["slot"], served=served[b["id"]], **{"from": b["id"]})
            m.buyout_public = dict(slot=b["slot"], served_seen=round(served[b["id"]], -1), **{"from": b["id"]})
        # 10. reputation, awareness, public signals (24 + health badge of report 34)
        for p in alive:
            pid = p["id"]
            q_ = QUALITY[p["tier"]]
            fair = P_REF * (1 + 0.3 * q_)
            target = (3.0 + 0.3 * q_ - 3.0 * (lost[pid] / demand[pid] if demand[pid] else 0)
                      - 1.2 * max(0.0, p["price"] / fair - 1.2) + (0.15 if p["wage"] >= 1.1 * WAGE else 0))
            p["rep"] = min(5.0, max(1.0, p["rep"] + 0.4 * (target - p["rep"])))
            p["aw"] += (1 - p["aw"]) * (0.12 + 0.6 * p["ads"] / (p["ads"] + 2500))
            p["last_d"], p["last_served"], p["prev_price"] = demand[pid], served[pid], p["price"]
            p["served_seen"] = round(served[pid] * (1 + m.rnd.uniform(-0.1, 0.1)), -1)
            burn = -p["last_flow"]
            months = (p["cash"] + max(0.0, credit_limit(p["last_rev"]) - p["debt"])) / burn if burn > 0 else 99
            p["badge"] = "Critical" if months < 1 else "Strained" if months < 3 else "Healthy"
            if p["loyalty_left"]:
                p["loyalty_left"] -= 1
            if p["fc_left"]:
                p["fc_left"] -= 1
            p["net_hist"].append(p["cash"] - p["debt"] + 0.5 * p["inv"] * unit_cost(p["inv_tier"], n_now)
                                 if not p["out"] else -1e9 + 1e6 * t)
        for b, v_ in betrayals:
            ev.append(dict(type="betray", by=b, target=v_, result="pact broken"))
        m.attack_log, m.betrayals, m.supplier_left = ev, betrayals, left_share
        m.events.append((t, ev))
        if verbose:
            print(f"  R{t:2d} " + " | ".join(
                f"{m.seats[p['id']].key[:9]:9s} ${p['price']:.2f} {p['tier']:4s} st{p['staff']} "
                f"sv{served[p['id']]:5.0f} cash{p['cash']:7.0f}{' OUT' if p['out'] else ''}" for p in alive))
            for e in ev:
                who = m.seats[e["by"]].key
                tgt = m.seats[e["target"]].key if e.get("target") is not None else ""
                print(f"       {e['type']:8s} {who} -> {tgt} {e['result']}")
    final = []
    for p in P:
        while len(p["net_hist"]) < ROUNDS:
            p["net_hist"].append(p["net_hist"][-1] if p["net_hist"] else -1e9)
        final.append(p["net_hist"][-1])
    top = max(final)
    winner = m.rnd.choice([i for i, x in enumerate(final) if x >= top - 1])
    return dict(final=final, winner=winner, out=[p["out"] for p in P], usage=m.usage,
                keys=[s.key for s in seats], students=m.sc["students"], news=m.sc["kind"],
                rank=[sorted(final, reverse=True).index(x) + 1 for x in final])


# ---------------- experiments ----------------------------------------------------------
NAMES = list(PERSONAS)


def seat(name, level, seed):
    return Bot(name, level, seed) if name in PERSONAS else Proxy(name, seed)


def random_fields(matches, level="normal", seed0=1):
    rnd = random.Random(seed0)
    st = {s: dict(games=0, wins=0.0, fair=0.0, out=0, worth=[]) for s in NAMES}
    by_ctx = defaultdict(lambda: defaultdict(lambda: [0.0, 0, 0.0]))
    usage = {s: Counter() for s in NAMES}
    for k in range(matches):
        n = rnd.choice([3, 4, 4, 5, 6])
        field = [rnd.choice(NAMES) for _ in range(n)]
        seed = 10_000 + k
        r = play([seat(f, level, seed * 10 + i) for i, f in enumerate(field)], seed)
        same = [i for i in range(n) if field[i] == field[r["winner"]]]
        ctx = ("student" if r["students"] >= 0.6 else "office" if r["students"] < 0.45 else "mixed") + " street"
        for i, f in enumerate(field):
            s = st[f]
            s["games"] += 1
            s["fair"] += 1 / n
            s["out"] += r["out"][i]
            if not r["out"][i]:
                s["worth"].append(r["final"][i])
            usage[f].update(r["usage"][i])
            for c in (ctx, "news: " + r["news"]):
                cell = by_ctx[c][f]
                cell[1] += 1
                cell[2] += 1 / n
        for i in same:
            st[field[i]]["wins"] += 1 / len(same)
            for c in (ctx, "news: " + r["news"]):
                by_ctx[c][field[i]][0] += 1 / len(same)
    return st, by_ctx, usage


def hero_vs(hero, foe, n=4, matches=300, hero_level="normal", foe_level="normal", seed0=50_000):
    wins = outs = 0
    for k in range(matches):
        seed = seed0 + k
        seats = [seat(hero, hero_level, seed * 10)] + [seat(foe, foe_level, seed * 10 + i) for i in range(1, n)]
        r = play(seats, seed)
        wins += r["winner"] == 0
        outs += r["out"][0]
    return wins / matches, outs / matches


def hero_vs_mixed(hero, level, matches=400, hero_level="normal", seed0=70_000):
    """One seat (a human proxy or a bot) against 3 different bot characters at `level`."""
    rnd = random.Random(seed0)
    wins = outs = 0
    ranks = []
    bot_out = 0
    bot_usage = Counter()
    for k in range(matches):
        seed = seed0 + k
        foes = rnd.sample(NAMES, 3)                    # a room never repeats a character
        seats = [seat(hero, hero_level, seed * 10)] + [Bot(f, level, seed * 10 + i + 1) for i, f in enumerate(foes)]
        r = play(seats, seed)
        wins += r["winner"] == 0
        outs += r["out"][0]
        bot_out += sum(r["out"][1:])
        ranks.append(r["rank"][0])
        for u in r["usage"][1:]:
            bot_usage.update(u)
    hero_vs_mixed.last_usage = bot_usage
    return wins / matches, outs / matches, statistics.mean(ranks), bot_out / (3 * matches)


def mirror(name, level="normal", n=4, matches=300):
    outs, worth = 0, []
    for k in range(matches):
        seed = 90_000 + k
        r = play([Bot(name, level, seed * 10 + i) for i in range(n)], seed)
        outs += sum(r["out"])
        worth += [w for w, o in zip(r["final"], r["out"]) if not o]
    return outs / (matches * n), (statistics.median(worth) if worth else float("nan"))


def fairness_test(matches=60, leak=False, peeker=False):
    rnd = random.Random(7)
    fair = dict(checks=0, diffs=0, rnd=random.Random(99))
    for k in range(matches):
        n = rnd.choice([3, 4, 5, 6])
        seed = 200_000 + k
        seats = [Bot(rnd.choice(NAMES), rnd.choice(["easy", "normal", "hard"]), seed * 10 + i) for i in range(n)]
        if peeker:
            seats[0] = Peeker("Ada", "normal", seed * 10)
        play(seats, seed, fairness=fair, leak=leak)
    return fair["checks"], fair["diffs"]


def timing(matches=40):
    rnd = random.Random(3)
    calls, spent = 0, 0.0
    for level in ("easy", "normal", "hard"):
        for k in range(matches):
            seed = 300_000 + k
            seats = [Bot(rnd.choice(NAMES), level, seed * 10 + i) for i in range(5)]
            m = Match(seats, seed)
            m.t = 1
            for p in m.players:
                v = make_view(m, p["id"])
                t0 = time.perf_counter()
                m.seats[p["id"]].decide(v)
                spent += time.perf_counter() - t0
                calls += 1
    return 1e6 * spent / calls


def pct(x):
    return f"{100 * x:5.1f}%"


if __name__ == "__main__":
    quick = "--quick" in sys.argv
    M = 800 if quick else 3000
    K = 80 if quick else 300
    L = 120 if quick else 400
    t_start = time.time()
    print("Example: demo room (seed 1), 3 first-time humans + Fay, Boris, Dan on the demo preset (easy + fight)")
    play([Proxy("Novice", 10 + i) for i in range(3)] + [Bot("Fay", "easy", 14, fight=True),
         Bot("Boris", "easy", 15, fight=True), Bot("Dan", "easy", 16, fight=True)], seed=1, verbose=True)

    st, by_ctx, usage = random_fields(M)
    print(f"\n1) Random fields of 3-6 normal bots, {M} matches, random street and news in each")
    print(f"   {'bot':6s} {'games':>6s} {'win':>7s} {'fair':>7s} {'bankrupt':>9s} {'median worth':>13s}")
    for s, x in st.items():
        print(f"   {s:6s} {x['games']:6d} {pct(x['wins'] / x['games'])} {pct(x['fair'] / x['games'])} "
              f"{pct(x['out'] / x['games']):>9s} {statistics.median(x['worth']) if x['worth'] else float('nan'):13,.0f}")
    print("\n   Win % / fair % by context")
    print(f"   {'context':16s} " + " ".join(f"{s:>13s}" for s in NAMES))
    for ctx in ("student street", "mixed street", "office street", "news: calm", "news: spike", "news: crash"):
        row = by_ctx[ctx]
        print(f"   {ctx:16s} " + " ".join(
            f"{100 * row[s][0] / row[s][1]:6.1f} /{100 * row[s][2] / row[s][1]:4.1f}%" if row[s][1] else f"{'':>13s}"
            for s in NAMES))
    print("\n   Actions per 100 bot-matches (all cards, pacts, attacks)")
    acts = ["card_loan", "card_second", "second_opened", "card_buyout", "buyout_won", "lease_bid_corner",
            "lease_bid_snipe", "lease_takeover",
            "card_poach", "poach_success", "poach_blocked", "poach_refused", "card_retain", "card_corner",
            "card_forward", "card_loyalty", "price_war_round", "pact_offer", "pact_made", "pact_kept", "betrayal"]
    print(f"   {'action':16s} " + " ".join(f"{s:>7s}" for s in NAMES))
    for a in acts:
        print(f"   {a:16s} " + " ".join(f"{100 * usage[s][a] / st[s]['games']:7.1f}" for s in NAMES))

    print(f"\n2) One hero against 3 copies of a foe (normal), {K} matches each: hero win % (hero bankrupt %)")
    print("   hero \\ foe " + " ".join(f"{f:>15s}" for f in NAMES))
    for h in NAMES:
        cells = []
        for f in NAMES:
            if h == f:
                cells.append(f"{'-':>15s}")
                continue
            w_, o_ = hero_vs(h, f, matches=K)
            cells.append(f"{100 * w_:6.0f}% ({100 * o_:3.0f}%)")
        print(f"   {h:10s} " + " ".join(cells))

    print(f"\n3) Mirror matches: 4 copies of one bot, {K} matches")
    for s in NAMES:
        o_, w_ = mirror(s, matches=K)
        print(f"   {s:6s} bankrupt {pct(o_)}   median worth of survivors ${w_:,.0f}")

    print(f"\n4) Difficulty: one human proxy against 3 different bot characters, {L} matches per cell")
    print("   win % / bankrupt % / mean place (1-4) / bots bankrupt %")
    print(f"   {'proxy':10s} " + " ".join(f"{lv:>30s}" for lv in ("easy", "normal", "hard")))
    for proxy in ("Novice", "Rookie", "Balanced", "Adaptive"):
        cells = []
        for lv in ("easy", "normal", "hard"):
            w_, o_, rk, bo = hero_vs_mixed(proxy, lv, matches=L)
            cells.append(f"{100 * w_:5.1f}% /{100 * o_:5.1f}% / {rk:.2f} /{100 * bo:5.1f}%")
        print(f"   {proxy:10s} " + " ".join(f"{c:>30s}" for c in cells))
    hero_vs_mixed("Rookie", "normal", matches=L)
    u = hero_vs_mixed.last_usage
    print(f"   Bot actions per 100 matches against a Rookie (normal bots): "
          + ", ".join(f"{a} {100 * u[a] / L:.0f}" for a in ("price_war_round", "card_buyout", "buyout_won",
                                                           "card_loyalty", "pact_offer", "betrayal")))
    print(f"\n   One bot at easy / normal / hard against 3 other normal characters, {L} matches")
    for s in NAMES:
        wn, on, rn, _ = hero_vs_mixed(s, "normal", matches=L, hero_level="normal")
        wh, oh, rh, _ = hero_vs_mixed(s, "normal", matches=L, hero_level="hard")
        we, oe, re_, _ = hero_vs_mixed(s, "normal", matches=L, hero_level="easy")
        print(f"   {s:6s} easy {pct(we)} (out {pct(oe)})   normal {pct(wn)} (out {pct(on)})   "
              f"hard {pct(wh)} (out {pct(oh)})")

    print(f"\n   Ablation: one tool changed for one bot, against 3 other normal characters, {L} matches")
    print("   (the same seeds in every line; 'default' = the bot as specified, dumping off)")
    for who, variants in (("Boris", [("default", DEFAULT_OFF), ("no poach", DEFAULT_OFF | {"poach"}),
                                     ("no corner supply", DEFAULT_OFF | {"corner"}),
                                     ("no lease snipe", DEFAULT_OFF | {"snipe"}),
                                     ("no corner-slot bid", DEFAULT_OFF | {"corner_bid"}),
                                     ("no ad blitz", DEFAULT_OFF | {"blitz_ads"}),
                                     ("market wage", DEFAULT_OFF | {"wage"}),
                                     ("dumping ON", frozenset())]),
                          ("Fay", [("default", DEFAULT_OFF), ("keeps every pact", DEFAULT_OFF | {"betray"}),
                                   ("no pacts at all", DEFAULT_OFF | {"pact"})])):
        for label, off in variants:
            rnd_a = random.Random(70_000)
            wins = 0
            for k in range(L):
                seed = 70_000 + k
                foes = rnd_a.sample([x for x in NAMES if x != who], 3)
                r = play([Bot(who, "normal", seed * 10, off=off)] +
                         [Bot(f, "normal", seed * 10 + i + 1) for i, f in enumerate(foes)], seed)
                wins += r["winner"] == 0
            print(f"   {who:5s} {label:18s} wins {pct(wins / L)}")

    print(f"\n   Demo room: 4 first-time humans (Novice) + Fay + Boris, {L} matches")
    for label, lv, fight in (("easy", "easy", False), ("demo = easy economy + fight", "easy", True),
                             ("normal", "normal", None)):
        bot_wins = pacts = betrayals = poach_ok = 0
        for k in range(L):
            seed = 500_000 + k
            seats = [Proxy("Novice", seed * 10 + i) for i in range(4)] + \
                    [Bot("Fay", lv, seed * 10 + 4, fight=fight), Bot("Boris", lv, seed * 10 + 5, fight=fight)]
            r = play(seats, seed)
            bot_wins += r["winner"] >= 4
            pacts += r["usage"][4]["pact_made"]
            betrayals += r["usage"][4]["betrayal"]
            poach_ok += r["usage"][5]["poach_success"]
        print(f"   {label:28s} a bot wins {pct(bot_wins / L)} of rooms (fair 33%); per match: "
              f"Fay pacts {pacts / L:.1f}, Fay betrayals {betrayals / L:.1f}, Boris poaches {poach_ok / L:.1f}")

    set_rounds(6)
    print(f"\n   Demo blitz (6 rounds, thresholds scaled): 4 Novices + Fay + Boris on the demo preset, {L} matches")
    for show in (False, True):
        bot_wins = betray_rooms = poach_rooms = all_three = 0
        for k in range(L):
            seed = 600_000 + k
            seats = [Proxy("Novice", seed * 10 + i) for i in range(4)] + \
                    [Bot("Fay", "easy", seed * 10 + 4, fight=True),
                     Bot("Boris", "easy", seed * 10 + 5, fight=True, show=show)]
            r = play(seats, seed)
            u_f, u_b = r["usage"][4], r["usage"][5]
            bot_wins += r["winner"] >= 4
            betray_rooms += u_f["betrayal"] > 0
            poach_rooms += u_b["poach_success"] > 0
            all_three += u_f["pact_made"] > 0 and u_f["betrayal"] > 0 and u_b["poach_success"] > 0
        print(f"   {'show=on ' if show else 'show=off'}: a bot wins {pct(bot_wins / L)} of rooms (fair 33%); "
              f"rooms with a betrayal {pct(betray_rooms / L)}, with a poach {pct(poach_rooms / L)}, "
              f"with pact + betrayal + poach {pct(all_three / L)}")
    set_rounds(12)

    print("\n5) Fairness: every bot decision recomputed on a view with all hidden rival fields randomised")
    c1, d1 = fairness_test(30 if quick else 60)
    print(f"   honest view builder: {c1} decisions checked, {d1} changed")
    c2, d2 = fairness_test(10 if quick else 20, leak=True, peeker=True)
    print(f"   negative control (view leaks rival cash, Peeker bot reads it): {c2} checked, {d2} changed")

    us = timing(10 if quick else 40)
    print(f"\n6) Speed: {us:,.0f} microseconds per bot decision in Python (mixed levels)")
    print(f"\nTotal run time {time.time() - t_start:,.0f} s")
