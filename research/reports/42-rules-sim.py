"""Street War MVP rules - reference implementation (researcher 42, see 42-game-rules.md).

Run (Python 3.9+, no dependencies):
    python3 42-rules-sim.py example      # the 6-round, 4-player example from the report, round by round
    python3 42-rules-sim.py check        # recomputes the example independently from the rule tables
    python3 42-rules-sim.py tournament   # bot strategies on random streets: is any strategy dominant?

resolve_round() is the spec for the TypeScript engine: pure and deterministic (no randomness inside).
Every number below is a game-design assumption, not a fact about real coffee shops.
"""
import math
import random
import statistics
import sys
from decimal import Decimal, ROUND_HALF_UP

# ======================= config: one file in the real build =======================
PRICES = [2.0 + 0.5 * k for k in range(17)]                 # $2.00 .. $10.00, step $0.50
ELASTICITY = {"student": 3.2, "mixed": 3.0, "office": 2.8}  # street profile -> price sensitivity e
QUALITY = {"eco": 0.70, "std": 1.00, "prem": 1.90}          # quality factor in appeal
WAGE = {"eco": 1800, "std": 2000, "prem": 2400}             # per barista per round
TIER_RANK = {"eco": 0, "std": 1, "prem": 2}
COST = {"eco": (0.45, 0.60), "std": (0.60, 0.80), "prem": (0.90, 1.60)}   # unit cost = a + b * N
OUTSIDE = {3: 1.00, 4: 1.33, 5: 1.67, 6: 2.00}              # "buy nothing on this street" weight
SPOTS = {   # (name, traffic weight, rent per round); players pick a spot in the lobby
    3: [("Corner", 1.00, 3700), ("Middle", 0.88, 3000), ("Edge", 0.76, 1500)],
    4: [("Corner", 1.00, 3700), ("Middle", 0.88, 3000), ("Middle", 0.88, 3000), ("Edge", 0.76, 1500)],
    5: [("Corner", 1.00, 3700), ("Middle", 0.88, 3000), ("Middle", 0.88, 3000), ("Edge", 0.76, 1500),
        ("Edge", 0.76, 1500)],
    6: [("Corner", 1.00, 3700), ("Corner", 1.00, 3700), ("Middle", 0.88, 3000), ("Middle", 0.88, 3000),
        ("Edge", 0.76, 1500), ("Edge", 0.76, 1500)],
}
CFG = dict(
    market_per_shop=2600, market_base=2000,   # M = 2600 * n + 2000 potential customers per round
    owner_cap=500, barista_cap=1100, max_staff=6,
    hire=400, fire=1000, tier_switch=500, misc=500,
    retain=0.40, spill=0.5,
    overdraft_limit=-6000, overdraft_rate=0.03,
    poach_fee=1500, first_attack_round=3,
    pact_rounds=3, pact_penalty=1000,
    start_cash=12000, start_staff=1, start_tier="std", start_price=6.00,
)


def money(x):
    """Dollars, rounded half up."""
    return int(Decimal(repr(x)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def r2(x):
    return float(Decimal(repr(x)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def r3(x):
    return float(Decimal(repr(x)).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP))


def price_factor(profile, p):
    return r2((6.0 / p) ** ELASTICITY[profile])


def unit_cost(tier, n_index):
    a, b = COST[tier]
    return r2(a + b * n_index)


def capacity(staff):
    return CFG["owner_cap"] + CFG["barista_cap"] * staff


# ======================= match state =======================
def new_match(names, profile="mixed", spots=None, events=None):
    """spots: index into SPOTS[n] for each player (lobby choice). events: {round: {"N": x} or {"traffic": y}}."""
    n = len(names)
    spots = spots or list(range(n))
    players = []
    for i, nm in enumerate(names):
        sname, w, rent = SPOTS[n][spots[i]]
        players.append(dict(id=i, name=nm, spot=sname, w=w, rent=rent, cash=CFG["start_cash"],
                            staff=CFG["start_staff"], tier=CFG["start_tier"], price=CFG["start_price"],
                            served_prev=0, a_prev=None, out=False, out_round=None, marks=0))
    return dict(n=n, profile=profile, players=players, round=0,
                m0=CFG["market_per_shop"] * n + CFG["market_base"], outside=OUTSIDE[n],
                events=events or {}, pacts=[], log=[])


def resolve_round(st, moves, pact_offers=()):
    """One round. moves: {player_id: {"price", "tier", "staff", "poach": target_id|None}}.
    pact_offers: [(from_id, to_id, floor_price, accepted_bool)] made during this round's OPEN phase."""
    st["round"] += 1
    t = st["round"]
    ev = st["events"].get(t, {})
    n_index, traffic = ev.get("N", 1.00), ev.get("traffic", 1.00)          # step 1: event
    alive = [p for p in st["players"] if not p["out"]]
    rec = dict(round=t, N=n_index, traffic=traffic, rows={}, notes=[])
    cost = {p["id"]: dict(hire=0, fire=0, switch=0, poach=0, pact=0) for p in alive}

    # step 2: lock moves; a missing move repeats last round's levers with no card
    for p in alive:
        mv = moves.get(p["id"], {})
        price, tier = mv.get("price", p["price"]), mv.get("tier", p["tier"])
        target = mv.get("staff", p["staff"])
        assert price in PRICES and tier in QUALITY and 0 <= target <= CFG["max_staff"]
        if tier != p["tier"] and t > 1:
            cost[p["id"]]["switch"] = CFG["tier_switch"]
        p["price"], p["tier"] = price, tier
        p["_target"] = target
        p["_poach"] = mv.get("poach") if t >= CFG["first_attack_round"] else None

    # step 3: price pacts - a price below the floor in a pact round is a breach
    for pact in st["pacts"]:
        if pact["status"] != "active" or not (pact["start"] <= t <= pact["end"]):
            continue
        a, b = st["players"][pact["a"]], st["players"][pact["b"]]
        if a["out"] or b["out"]:
            pact["status"] = "ended"
            continue
        breakers = [x for x in (a, b) if x["price"] < pact["floor"]]
        for x in breakers:
            other = b if x is a else a
            cost[x["id"]]["pact"] += CFG["pact_penalty"]
            cost[other["id"]]["pact"] -= CFG["pact_penalty"]
            x["marks"] += 1
            rec["notes"].append(f"{x['name']} broke the price pact with {other['name']} (floor ${pact['floor']:.2f}): "
                                f"pays ${CFG['pact_penalty']:,} to {other['name']}")
        if breakers:
            pact["status"] = "broken"
        elif t == pact["end"]:
            pact["status"] = "kept"

    # step 4: hiring and firing
    for p in alive:
        diff = p["_target"] - p["staff"]
        if diff > 0:
            cost[p["id"]]["hire"] = CFG["hire"] * diff
        elif diff < 0:
            cost[p["id"]]["fire"] = CFG["fire"] * -diff
        p["staff"] = p["_target"]

    # step 5: Poach cards
    by_target = {}
    for p in alive:
        if p["_poach"] is not None:
            by_target.setdefault(p["_poach"], []).append(p)
    for tid, attackers in by_target.items():
        tgt = st["players"][tid]
        if len(attackers) > 1:
            rec["notes"].append(f"{' and '.join(a['name'] for a in attackers)} all targeted {tgt['name']}: "
                                f"void, fees refunded")
            continue
        a = attackers[0]
        if tgt["out"] or tgt is a or tgt["staff"] < 1 or a["staff"] >= CFG["max_staff"]:
            rec["notes"].append(f"{a['name']} -> {tgt['name']}: void (no barista to take / staff cap), fee refunded")
            continue
        cost[a["id"]]["poach"] = CFG["poach_fee"]
        if TIER_RANK[a["tier"]] >= TIER_RANK[tgt["tier"]]:
            tgt["staff"] -= 1
            a["staff"] += 1
            rec["notes"].append(f"{a['name']} poached a barista from {tgt['name']} (fee ${CFG['poach_fee']:,})")
        else:
            rec["notes"].append(f"{a['name']} tried to poach from {tgt['name']}: FAILED "
                                f"({tgt['name']} pays better), fee lost")

    # steps 6-10: capacity, appeal, regulars, demand split, queues and spill-over
    for p in alive:
        p["_cap"] = capacity(p["staff"])
        p["_pf"] = price_factor(st["profile"], p["price"])
        p["_A"] = r3(p["w"] * p["_pf"] * QUALITY[p["tier"]])
        p["_keep"] = 1.0 if p["a_prev"] is None else r2(min(1.0, p["_A"] / p["a_prev"]))
        p["_reg"] = math.floor(CFG["retain"] * p["served_prev"] * p["_keep"] + 1e-9)
    m_t = math.floor(st["m0"] * traffic + 1e-9)
    reg_sum = sum(p["_reg"] for p in alive)
    free = max(0, m_t - reg_sum)
    sum_a = r3(sum(p["_A"] for p in alive))
    denom = r3(st["outside"] + sum_a)
    for p in alive:
        p["_new"] = math.floor(free * p["_A"] / denom + 1e-9)
        p["_dem"] = p["_reg"] + p["_new"]
        p["_served"] = min(p["_dem"], p["_cap"])
        p["_lost"] = p["_dem"] - p["_served"]
        p["_extra"] = 0
    lost_sum = sum(p["_lost"] for p in alive)
    spill = math.floor(CFG["spill"] * lost_sum + 1e-9)
    elig = [p for p in alive if p["_cap"] > p["_served"]]
    w_el = r3(sum(p["_A"] for p in elig))
    for p in elig:
        p["_extra"] = min(p["_cap"] - p["_served"], math.floor(spill * p["_A"] / w_el + 1e-9))
        p["_served"] += p["_extra"]
    rec.update(m_t=m_t, reg_sum=reg_sum, free=free, sum_a=sum_a, denom=denom,
               lost_sum=lost_sum, spill=spill, w_el=w_el)

    # step 11: money
    for p in alive:
        c = cost[p["id"]]
        uc = unit_cost(p["tier"], n_index)
        rev = money(p["_served"] * p["price"])
        cogs = money(p["_served"] * uc)
        wages = p["staff"] * WAGE[p["tier"]]
        interest = money(CFG["overdraft_rate"] * -p["cash"]) if p["cash"] < 0 else 0
        start = p["cash"]
        p["cash"] = (start + rev - cogs - wages - p["rent"] - CFG["misc"] - interest
                     - c["hire"] - c["fire"] - c["switch"] - c["poach"] - c["pact"])
        rec["rows"][p["id"]] = dict(name=p["name"], spot=p["spot"], price=p["price"], tier=p["tier"],
                                    target=p["_target"], staff=p["staff"], cap=p["_cap"], pf=p["_pf"],
                                    A=p["_A"], keep=p["_keep"], reg=p["_reg"], new=p["_new"], dem=p["_dem"],
                                    lost=p["_lost"], extra=p["_extra"], served=p["_served"], uc=uc, rev=rev,
                                    cogs=cogs, wages=wages, rent=p["rent"], misc=CFG["misc"],
                                    interest=interest, start=start, cash=p["cash"], **c)

    # step 12: bankruptcy
    for p in alive:
        if p["cash"] < CFG["overdraft_limit"]:
            p["out"], p["out_round"] = True, t
            rec["notes"].append(f"{p['name']} is BANKRUPT (cash ${p['cash']:,} < ${CFG['overdraft_limit']:,})")

    # step 13: pacts accepted this round start next round
    for (a, b, floor, accepted) in pact_offers:
        pa, pb = st["players"][a], st["players"][b]
        busy = any(pk["status"] == "active" and ({pk["a"], pk["b"]} & {a, b}) for pk in st["pacts"])
        if accepted and not busy and not pa["out"] and not pb["out"]:
            st["pacts"].append(dict(a=a, b=b, floor=floor, start=t + 1, end=t + CFG["pact_rounds"], status="active"))
            rec["notes"].append(f"Pact {pa['name']}-{pb['name']}: floor ${floor:.2f}, rounds {t + 1}-"
                                f"{t + CFG['pact_rounds']} (visible to the two of them only)")

    # step 14: carry over
    for p in alive:
        p["served_prev"] = 0 if p["out"] else p["_served"]
        p["a_prev"] = p["_A"]
    st["log"].append(rec)
    return rec


def standings(st):
    alive = sorted([p for p in st["players"] if not p["out"]], key=lambda p: -p["cash"])
    dead = sorted([p for p in st["players"] if p["out"]], key=lambda p: (-p["out_round"], -p["cash"]))
    return alive + dead


# ======================= bots for balance tests (not the MVP bots: see report 52) =======================
def forecast(st, me, price, tier):
    """What the UI forecast shows: rivals repeat their last revealed price and tier."""
    alive = [p for p in st["players"] if not p["out"]]

    def appeal(p, pr, ti):
        return r3(p["w"] * price_factor(st["profile"], pr) * QUALITY[ti])

    def reg(p, a_now):
        keep = 1.0 if p["a_prev"] is None else min(1.0, a_now / p["a_prev"])
        return math.floor(CFG["retain"] * p["served_prev"] * keep)

    a_me = appeal(me, price, tier)
    others = [(p, appeal(p, p["price"], p["tier"])) for p in alive if p is not me]
    sum_a = a_me + sum(a for _, a in others)
    reg_sum = reg(me, a_me) + sum(reg(p, a) for p, a in others)
    free = max(0, st["m0"] - reg_sum)
    return reg(me, a_me) + free * a_me / (st["outside"] + sum_a)


def best_staff(demand, tier, staff_now, price, n_index):
    margin = price - unit_cost(tier, n_index)
    best = None
    for s in range(CFG["max_staff"] + 1):
        gain = (min(demand, capacity(s)) * margin - s * WAGE[tier]
                - CFG["hire"] * max(0, s - staff_now) - CFG["fire"] * max(0, staff_now - s))
        if best is None or gain > best[0] + 1e-9:
            best = (gain, s)
    return best[1]


class Fixed:
    tier, price = "std", 6.0

    def decide(self, st, me, n_index):
        fc = forecast(st, me, self.price, self.tier)
        return dict(price=self.price, tier=self.tier, staff=best_staff(fc, self.tier, me["staff"], self.price, n_index))


class Balanced(Fixed):
    tier, price = "std", 6.0


class Discounter(Fixed):
    tier, price = "eco", 5.0


class Premium(Fixed):
    tier, price = "prem", 8.5


class Dumper(Fixed):            # permanent price war
    tier, price = "eco", 3.0


class Undercutter(Fixed):       # always $0.50 below the cheapest rival's last price, never below $3.00
    def decide(self, st, me, n_index):
        rivals = [p["price"] for p in st["players"] if not p["out"] and p is not me]
        self.price = max(3.0, min(rivals) - 0.5) if st["round"] >= 1 else 5.5
        return super().decide(st, me, n_index)


class Poacher(Balanced):        # Balanced + Poach on the busiest rival it can legally hit, every other round
    def decide(self, st, me, n_index):
        mv = super().decide(st, me, n_index)
        t = st["round"] + 1
        if t >= CFG["first_attack_round"] and t % 2 == 1:
            cands = [p for p in st["players"] if not p["out"] and p is not me and p["staff"] >= 1
                     and TIER_RANK[p["tier"]] <= TIER_RANK[self.tier]]
            if cands:
                mv["poach"] = max(cands, key=lambda p: p["served_prev"])["id"]
                if mv["staff"] > me["staff"]:
                    mv["staff"] -= 1     # the poached barista replaces a planned hire
        return mv


class Adaptive:                 # myopic best response over tier x price
    def decide(self, st, me, n_index):
        best = None
        for tier in QUALITY:
            for price in PRICES:
                if price < 3.0:
                    continue
                fc = forecast(st, me, price, tier)
                s = best_staff(fc, tier, me["staff"], price, n_index)
                gain = (min(fc, capacity(s)) * (price - unit_cost(tier, n_index)) - s * WAGE[tier]
                        - CFG["hire"] * max(0, s - me["staff"]) - CFG["fire"] * max(0, me["staff"] - s)
                        - (CFG["tier_switch"] if (tier != me["tier"] and st["round"] >= 1) else 0))
                if best is None or gain > best[0]:
                    best = (gain, dict(price=price, tier=tier, staff=s))
        return best[1]


BOTS = dict(Balanced=Balanced, Discounter=Discounter, Premium=Premium, Dumper=Dumper,
            Undercutter=Undercutter, Poacher=Poacher, Adaptive=Adaptive)


def random_events(rnd, rounds):
    ev = {}
    for s in ([3, 5] if rounds == 6 else [3, 6, 9, 11]):
        kind = rnd.choice(["cost_up", "cost_up", "cost_down", "traffic_up", "traffic_down"])
        val = {"cost_up": dict(N=rnd.choice([1.20, 1.35])), "cost_down": dict(N=0.85),
               "traffic_up": dict(traffic=1.10), "traffic_down": dict(traffic=0.90)}[kind]
        for k in range(2):
            if s + k <= rounds:
                ev[s + k] = val
    return ev


def play(field, seed, rounds=12, profile=None):
    rnd = random.Random(seed)
    n = len(field)
    profile = profile or rnd.choice(["student", "mixed", "office"])
    spots = list(range(n))
    rnd.shuffle(spots)
    st = new_match([f"{s}{i}" for i, s in enumerate(field)], profile=profile, spots=spots,
                   events=random_events(rnd, rounds))
    bots = [BOTS[s]() for s in field]
    for t in range(1, rounds + 1):
        alive = [p for p in st["players"] if not p["out"]]
        if len(alive) <= 1:
            break
        n_index = st["events"].get(t, {}).get("N", 1.0)
        resolve_round(st, {p["id"]: bots[p["id"]].decide(st, p, n_index) for p in alive})
    return dict(profile=profile, winner=standings(st)[0]["id"], players=st["players"])


def tournament(matches, rounds, seed0=1):
    rnd = random.Random(seed0)
    stats = {s: dict(g=0, w=0.0, fair=0.0, out=0, cash=[]) for s in BOTS}
    by_street = {}
    for m in range(matches):
        n = rnd.choice([3, 4, 4, 5, 6])
        field = [rnd.choice(list(BOTS)) for _ in range(n)]
        r = play(field, seed=10_000 + m, rounds=rounds)
        win_s = field[r["winner"]]
        for i, s in enumerate(field):
            stt = stats[s]
            stt["g"] += 1
            stt["fair"] += 1 / n
            stt["out"] += r["players"][i]["out"]
            if not r["players"][i]["out"]:
                stt["cash"].append(r["players"][i]["cash"])
            c = by_street.setdefault(r["profile"], {}).setdefault(s, [0, 0])
            c[1] += 1
        stats[win_s]["w"] += 1
        by_street[r["profile"]][win_s][0] += 1
    return stats, by_street


def one_vs_three(hero, foe, rounds, matches=250):
    w = o = 0
    for m in range(matches):
        r = play([hero, foe, foe, foe], seed=70_000 + m, rounds=rounds)
        w += r["winner"] == 0
        o += r["players"][0]["out"]
    return w / matches, o / matches


# ======================= the worked example (report section 7) =======================
ANA, KAI, LENA, DAN = 0, 1, 2, 3
EXAMPLE_EVENTS = {3: dict(N=1.35), 4: dict(N=1.35), 5: dict(traffic=1.10), 6: dict(traffic=1.10)}
EXAMPLE_MOVES = {   # price, tier, staff target, poach target
    1: {ANA: (8.5, "prem", 1, None), KAI: (6.0, "std", 2, None), LENA: (6.0, "std", 2, None), DAN: (3.5, "eco", 4, None)},
    2: {ANA: (8.5, "prem", 1, None), KAI: (6.0, "std", 2, None), LENA: (6.0, "std", 2, None), DAN: (3.5, "eco", 4, None)},
    3: {ANA: (9.0, "prem", 1, None), KAI: (6.5, "std", 1, None), LENA: (6.5, "std", 1, None), DAN: (3.5, "eco", 4, ANA)},
    4: {ANA: (9.0, "prem", 1, None), KAI: (6.5, "std", 1, None), LENA: (6.5, "std", 1, None), DAN: (3.0, "eco", 4, None)},
    5: {ANA: (8.5, "prem", 1, None), KAI: (5.5, "std", 1, LENA), LENA: (6.5, "std", 1, None), DAN: (3.0, "eco", 4, None)},
    6: {ANA: (8.5, "prem", 1, None), KAI: (5.5, "std", 2, None), LENA: (5.5, "std", 1, KAI), DAN: (3.0, "eco", 4, None)},
}
EXAMPLE_PACTS = {2: [(KAI, LENA, 6.0, True)]}


def run_example(moves=EXAMPLE_MOVES):
    st = new_match(["Ana", "Kai", "Lena", "Dan"], profile="mixed", spots=[0, 1, 2, 3], events=EXAMPLE_EVENTS)
    for t in range(1, 7):
        mv = {pid: dict(price=m[0], tier=m[1], staff=m[2], poach=m[3]) for pid, m in moves[t].items()
              if not st["players"][pid]["out"]}
        resolve_round(st, mv, EXAMPLE_PACTS.get(t, []))
    return st


def print_example(st):
    for rec in st["log"]:
        print(f"\nRound {rec['round']}: N={rec['N']} traffic x{rec['traffic']} M={rec['m_t']} regulars={rec['reg_sum']} "
              f"free={rec['free']} sumA={rec['sum_a']} O+sumA={rec['denom']} lost={rec['lost_sum']} "
              f"spill={rec['spill']} (split by A over {rec['w_el']})")
        for r in rec["rows"].values():
            print(f"  {r['name']:5s} {r['spot']:6s} ${r['price']:.2f} {r['tier']:4s} staff {r['target']}->{r['staff']} "
                  f"cap {r['cap']:5d} A {r['A']:.3f} reg {r['reg']:5d} (keep {r['keep']:.2f}) new {r['new']:5d} "
                  f"demand {r['dem']:5d} served {r['served']:5d} (+{r['extra']}) | rev {r['rev']} cogs {r['cogs']} "
                  f"wages {r['wages']} rent {r['rent']} misc {r['misc']} hire {r['hire']} fire {r['fire']} "
                  f"switch {r['switch']} poach {r['poach']} pact {r['pact']} interest {r['interest']} | "
                  f"cash {r['start']} -> {r['cash']}")
        for note in rec["notes"]:
            print("   *", note)
    print("\nStandings:", [(p["name"], p["cash"]) for p in standings(st)])


def paper_check():
    """Independent recomputation from the printed rule tables only (no engine functions)."""
    pf = {2.0: 27.0, 2.5: 13.82, 3.0: 8.0, 3.5: 5.04, 4.0: 3.38, 4.5: 2.37, 5.0: 1.73, 5.5: 1.30, 6.0: 1.00,
          6.5: 0.79, 7.0: 0.63, 7.5: 0.51, 8.0: 0.42, 8.5: 0.35, 9.0: 0.30, 9.5: 0.25, 10.0: 0.22}   # mixed street
    qf = {"eco": 0.70, "std": 1.00, "prem": 1.90}
    wage = {"eco": 1800, "std": 2000, "prem": 2400}
    uc = {1.00: {"eco": 1.05, "std": 1.40, "prem": 2.50}, 1.35: {"eco": 1.26, "std": 1.68, "prem": 3.06}}
    rank = {"eco": 0, "std": 1, "prem": 2}
    spot = [(1.00, 3700), (0.88, 3000), (0.88, 3000), (0.76, 1500)]
    S = [dict(cash=12000, staff=1, served=0, a=None) for _ in range(4)]
    pact_live = False
    rows = {}
    for t in range(1, 7):
        N, tr = {3: (1.35, 1.0), 4: (1.35, 1.0), 5: (1.0, 1.1), 6: (1.0, 1.1)}.get(t, (1.0, 1.0))
        mv = EXAMPLE_MOVES[t]
        extra = [0] * 4
        if t == 3:
            pact_live = True
        if pact_live and 3 <= t <= 5:
            for x, y in ((KAI, LENA), (LENA, KAI)):
                if mv[x][0] < 6.0:
                    extra[x] += 1000
                    extra[y] -= 1000
                    pact_live = False
        staff = []
        for i in range(4):
            extra[i] += 400 * max(0, mv[i][2] - S[i]["staff"]) + 1000 * max(0, S[i]["staff"] - mv[i][2])
            staff.append(mv[i][2])
        for i in range(4):
            if mv[i][3] is not None:
                j = mv[i][3]
                extra[i] += 1500
                if rank[mv[i][1]] >= rank[mv[j][1]]:
                    staff[j] -= 1
                    staff[i] += 1
        A = [round(spot[i][0] * pf[mv[i][0]] * qf[mv[i][1]], 3) for i in range(4)]
        reg = [math.floor(0.4 * S[i]["served"] * (1.0 if S[i]["a"] is None else min(1.0, round(A[i] / S[i]["a"], 2))) + 1e-9)
               for i in range(4)]
        free = math.floor(12400 * tr + 1e-9) - sum(reg)
        den = round(1.33 + sum(A), 3)
        cap = [500 + 1100 * s for s in staff]
        dem = [reg[i] + math.floor(free * A[i] / den + 1e-9) for i in range(4)]
        srv = [min(dem[i], cap[i]) for i in range(4)]
        sp = math.floor(0.5 * sum(dem[i] - srv[i] for i in range(4)) + 1e-9)
        el = [i for i in range(4) if cap[i] > srv[i]]
        wel = round(sum(A[i] for i in el), 3)
        for i in el:
            srv[i] += min(cap[i] - srv[i], math.floor(sp * A[i] / wel + 1e-9))
        for i in range(4):
            rev = math.floor(srv[i] * mv[i][0] + 0.5)
            cogs = math.floor(srv[i] * uc[N][mv[i][1]] + 0.5)
            S[i]["cash"] += rev - cogs - staff[i] * wage[mv[i][1]] - spot[i][1] - 500 - extra[i]
            S[i].update(staff=staff[i], served=srv[i], a=A[i])
            rows[(t, i)] = (A[i], reg[i], dem[i], srv[i], rev, cogs, S[i]["cash"])
    return rows


def spot_test(rounds, matches=600, fields=None):
    """Mean final cash by spot in mixed fields: rents are tuned so that no spot is a free win."""
    fields = fields or [["Balanced"] * 4, ["Adaptive"] * 4, ["Balanced", "Discounter", "Premium", "Adaptive"]]
    acc = {}
    for m in range(matches):
        r = play(fields[m % len(fields)], seed=30_000 + m, rounds=rounds)
        for p in r["players"]:
            acc.setdefault(p["spot"], []).append(p["cash"])
    return {k: round(statistics.mean(v)) for k, v in acc.items()}


def pact_test(floor, drop=None, matches=400):
    """Two Balanced shops make a pact (rounds 3-5) in a 6-round match vs two random rivals.
    drop: player 0 betrays in round 5 by pricing floor - drop."""
    res = {"A": [], "B": [], "others": []}
    for m in range(matches):
        rnd = random.Random(60_000 + m)
        spots = list(range(4))
        rnd.shuffle(spots)
        st = new_match(["A", "B", "C", "D"], profile=rnd.choice(["student", "mixed", "office"]), spots=spots,
                       events=random_events(rnd, 6))
        bots = [Balanced(), Balanced(), BOTS[rnd.choice(["Discounter", "Premium", "Adaptive"])](),
                BOTS[rnd.choice(["Discounter", "Premium", "Adaptive"])]()]
        for t in range(1, 7):
            n_index = st["events"].get(t, {}).get("N", 1.0)
            moves = {}
            for p in st["players"]:
                if p["out"]:
                    continue
                mv = bots[p["id"]].decide(st, p, n_index)
                if floor is not None and p["id"] in (0, 1) and 3 <= t <= 5:
                    mv["price"] = max(mv["price"], floor)
                    if drop is not None and p["id"] == 0 and t == 5:
                        mv["price"] = floor - drop
                    mv["staff"] = best_staff(forecast(st, p, mv["price"], mv["tier"]), mv["tier"], p["staff"],
                                             mv["price"], n_index)
                moves[p["id"]] = mv
            resolve_round(st, moves, [(0, 1, floor, True)] if (floor is not None and t == 2) else [])
        res["A"].append(st["players"][0]["cash"])
        res["B"].append(st["players"][1]["cash"])
        res["others"] += [st["players"][2]["cash"], st["players"][3]["cash"]]
    return {k: round(statistics.mean(v)) for k, v in res.items()}


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "example"
    if mode == "spots":
        for rounds in (6, 12):
            print(rounds, "rounds, mean final cash by spot, mixed fields:", spot_test(rounds))
            print(rounds, "rounds, mean final cash by spot, 4 x Balanced:", spot_test(rounds, 400, [["Balanced"] * 4]))
            for s in ("Balanced", "Poacher"):
                cash = [p["cash"] for m in range(300) for p in play([s] * 4, seed=90_000 + m, rounds=rounds)["players"]]
                print(rounds, f"rounds, everyone plays {s}: mean final cash {statistics.mean(cash):,.0f}")
    if mode == "pact":
        print("no pact            ", pact_test(None))
        for floor in (6.5, 7.0, 7.5):
            print(f"floor ${floor:.2f} kept    ", pact_test(floor))
            for drop in (0.5, 1.0):
                print(f"floor ${floor:.2f} betray -{drop:.2f}", pact_test(floor, drop))
    if mode == "example":
        print_example(run_example())
    elif mode == "check":
        st = run_example()
        eng = {(rec["round"], pid): (r["A"], r["reg"], r["dem"], r["served"], r["rev"], r["cogs"], r["cash"])
               for rec in st["log"] for pid, r in rec["rows"].items()}
        paper = paper_check()
        bad = [k for k in eng if eng[k] != paper[k]]
        print(f"rows compared: {len(eng)}, mismatches: {len(bad)}")
        for k in bad:
            print(k, eng[k], paper[k])
    elif mode == "tournament":
        for rounds, matches in ((6, 3000), (12, 2000)):
            stats, by_street = tournament(matches, rounds)
            print(f"\nRandom fields of 3-6 bots, {matches} matches, {rounds} rounds")
            print(f"{'strategy':12s} {'win %':>6s} {'fair %':>7s} {'bankrupt %':>11s} {'median cash':>12s}")
            for s, x in stats.items():
                med = statistics.median(x["cash"]) if x["cash"] else float("nan")
                print(f"{s:12s} {100 * x['w'] / x['g']:6.1f} {100 * x['fair'] / x['g']:7.1f} "
                      f"{100 * x['out'] / x['g']:11.1f} {med:12,.0f}")
            for prof in ("student", "mixed", "office"):
                row = by_street[prof]
                print(f"  {prof:8s} " + "  ".join(f"{s[:6]} {100 * row[s][0] / row[s][1]:3.0f}%" for s in BOTS))
            S = ["Balanced", "Discounter", "Premium", "Dumper", "Poacher"]
            print(f"  one vs three, hero win % / hero bankrupt % ({rounds} rounds, fair 25%)")
            print(f"  {'hero':11s} " + " ".join(f"{f:>12s}" for f in S))
            for h in S:
                cells = []
                for f in S:
                    w, o = one_vs_three(h, f, rounds)
                    cells.append(f"{100 * w:5.0f}/{100 * o:3.0f}%")
                print(f"  {h:11s} " + " ".join(f"{c:>12s}" for c in cells))
