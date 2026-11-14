"""Researcher 53: calibrate the stage-demo villain DAN (BOT) on report 43's final constants.

Usage (needs report 43's simulator, branch claude/exciting-mccarthy-r7904m):
    python3 research/reports/53-dan-on-43.py research/reports/43-economy-sim.py

Nothing in report 43's model is changed: the script imports it, sets rounds=6 (blitz)
and adds one labelled bot. 'Rookie' = report 43's random-but-plausible first-time player.
DAN: Specialty beans, price 0.97 x reference, 3 baristas, $1,500 ads, market wage, bids for the corner.
About 10 seconds.
"""
import collections
import importlib.util
import sys

path = sys.argv[1] if len(sys.argv) > 1 else "research/reports/43-economy-sim.py"
spec = importlib.util.spec_from_file_location("econ43", path)
E = importlib.util.module_from_spec(spec)
spec.loader.exec_module(E)


def dan(me, view, c):
    return dict(price=0.97 * c["p_ref"], tier="prem", wage=1.0, ads=1500, staff=3,
                bid=c["spot_rent"][0] * 1.25, card=None)


E.BOTS["Dan"] = dan
C = dict(E.FINAL, rounds=6)
N = 1000
print("Blitz: 6 rounds on report 43 FINAL constants (start $9,000, overdraft limit $6,000), 1,000 matches each")
for name, lineup in (("4 judges + DAN", ["Rookie"] * 4 + ["Dan"]),
                     ("3 judges + DAN", ["Rookie"] * 3 + ["Dan"]),
                     ("2 judges + DAN + Premium (PAULA)", ["Rookie"] * 2 + ["Dan", "Premium"]),
                     ("4 judges, no DAN", ["Rookie"] * 4)):
    lives = collections.Counter()
    judge_out = anyone_out = dan_win = 0
    for m in range(N):
        r = E.play(C, lineup, seed=920_000 + m)
        out = [not a for a in r["alive"]]
        anyone_out += any(out)
        judge_out += any(out[j] for j in range(len(lineup)) if lineup[j] == "Rookie")
        if "Dan" in lineup:
            i = lineup.index("Dan")
            lives[r["life"][i] if out[i] else 99] += 1
            dan_win += r["winner"] == i
    line = f"  {name:34s} | anyone bankrupt by R6 {100 * anyone_out / N:5.1f}% | a judge bankrupt by R6 {100 * judge_out / N:5.1f}%"
    if "Dan" in lineup:
        r35 = sum(v for k, v in lives.items() if 3 <= k <= 5)
        line += (f" | DAN out in R3-R5 {100 * r35 / N:5.1f}%, exactly R4 {100 * lives[4] / N:5.1f}%"
                 f" | DAN wins {100 * dan_win / N:.1f}% | DAN round of exit {dict(sorted(lives.items()))}")
    print(line)
