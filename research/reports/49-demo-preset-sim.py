"""Researcher 49: demo-preset checks on the shared-market model of report 24.

Usage:
    python3 research/reports/49-demo-preset-sim.py path/to/24-market-sim.py

Report 24 and its script live in branch claude/exciting-mccarthy-r7904m
(research/reports/24-market-sim.py). Nothing here changes the model: the script
imports it, swaps the starting cash and adds one scripted bot for the stage demo.

1) Without a scripted bot, does anyone go bankrupt within a 6-round blitz?
2) "Discount Dan": a labelled BOT that overspends and must go bankrupt in a
   known round whatever first-time players (Rookie) do.
3) Control: Rookie bankruptcy by round 12 must match report 24 (58%).
600 matches per configuration, fixed seeds, about 10 seconds in total.
"""
import collections
import importlib.util
import sys

path = sys.argv[1] if len(sys.argv) > 1 else "research/reports/24-market-sim.py"
spec = importlib.util.spec_from_file_location("market_sim", path)
ms = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ms)
N = 600


def bust_round(hist):
    """Round in which a player went bankrupt (1-12), or None."""
    for i, v in enumerate(hist):
        if v <= -1e8:
            return i + 1
    return None


def make_dan(price_mult, staff, ads, bid_mult):
    class DiscountDan(ms.Bot):    # scripted demo villain: cheap premium coffee, too many staff, loud ads
        hedge = False

        def decide(self, me, view):
            return dict(price=ms.P_REF * price_mult, tier="prem", ads=ads, wage=ms.WAGE * 1.15,
                        staff=staff, order=view["forecast"] * 1.3, bid=ms.SLOT_RENT[0] * bid_mult,
                        loan=0, poach=None)
    return DiscountDan


def no_villain(field, cash, seed0=900_000):
    ms.START_CASH = cash
    rook = [i for i, s in enumerate(field) if s == "Rookie"]
    bots = [i for i, s in enumerate(field) if s != "Rookie"]
    anyone = bot = judge_r4 = 0
    for m in range(N):
        b = [bust_round(h) for h in ms.play(field, seed=seed0 + m)["hist"]]
        anyone += any(x and x <= 6 for x in b)
        bot += any(b[i] and b[i] <= 6 for i in bots)
        judge_r4 += any(b[i] and b[i] <= 4 for i in rook)
    ms.START_CASH = 12000
    print(f"  {'+'.join(field):38s} ${cash:>6,}: anyone out by R6 {100 * anyone / N:5.1f}% | "
          f"a bot out by R6 {100 * bot / N:4.1f}% | a judge out by R4 {100 * judge_r4 / N:4.1f}%")


def villain(label, params, target, field, seed0=990_000):
    ms.STRATS["Dan"] = make_dan(*params)
    dan = field.index("Dan")
    rook = [i for i, s in enumerate(field) if s == "Rookie"]
    hit = judge = 0
    for m in range(N):
        b = [bust_round(h) for h in ms.play(field, seed=seed0 + m)["hist"]]
        hit += b[dan] == target
        judge += any(b[i] and b[i] <= target for i in rook)
    print(f"  {label} {'+'.join(field):30s}: Dan out exactly in R{target} {100 * hit / N:5.1f}% | "
          f"a judge out by R{target} {100 * judge / N:4.1f}%")


if __name__ == "__main__":
    print("1) No scripted villain, 6-round blitz window")
    for cash in (12000, 6000, 4000):
        no_villain(["Rookie", "Rookie", "Rookie", "Balanced", "Premium"], cash)
    no_villain(["Rookie", "Rookie", "Rookie", "Undercutter", "Premium"], 4000)
    no_villain(["Rookie", "Rookie", "Rookie", "Blitz", "Premium"], 4000)

    print("2) Discount Dan (premium beans, wage x1.15): blitz-6 = price x0.95, 4 staff, ads $2,000, corner bid x1.4;"
          " blitz-3 = price x0.85, 4 staff, ads $2,500, corner bid x1.4")
    for label, params, target in (("blitz-6", (0.95, 4, 2000, 1.4), 4), ("blitz-3", (0.85, 4, 2500, 1.4), 3)):
        for field in (["Rookie", "Rookie", "Rookie", "Dan", "Premium"], ["Rookie", "Rookie", "Dan", "Balanced"],
                      ["Rookie", "Rookie", "Rookie", "Rookie", "Dan"]):
            villain(label, params, target, field)

    print("3) Control: Rookie vs Balanced, Discounter, Premium (report 24 says 58% bankrupt by R12)")
    by_round = collections.Counter()
    for m in range(N):
        by_round[bust_round(ms.play(["Rookie", "Balanced", "Discounter", "Premium"], seed=150_000 + m)["hist"][0])] += 1
    r6 = sum(v for k, v in by_round.items() if k and k <= 6)
    r12 = sum(v for k, v in by_round.items() if k)
    print(f"  Rookie bankrupt by R6 {100 * r6 / N:.1f}%, by R12 {100 * r12 / N:.1f}%")
