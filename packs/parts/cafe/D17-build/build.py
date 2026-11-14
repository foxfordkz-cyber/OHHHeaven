# Builds packs/parts/cafe/D17-calibration-people-money.json from the data modules and checks it.
# Run from the repository root:  python3 packs/parts/cafe/D17-build/build.py
import json, os, sys, collections

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import base  # noqa: E402

MODULES = ["d00", "d05", "d09", "others"]
events = []
for m in MODULES:
    try:
        mod = __import__(m)
    except ModuleNotFoundError:
        continue
    events += mod.EVENTS

extra = {}
try:
    import meta  # mechanics, fixes, fieldsUsed
    extra.update(meta.EXTRA)
except ModuleNotFoundError:
    pass

# ---- checks ----
errors, warns = [], []
ids = collections.Counter(e["id"] for e in events)
for k, v in ids.items():
    if v > 1:
        errors.append(f"duplicate id {k}")
MULT_OK = (0.7, 1.3)
FREE_FIELDS = {"violationAccrual", "auditExposure", "saleBlocked"}
for e in events:
    if not e["months"] or any(m not in range(1, 13) for m in e["months"]):
        errors.append(f"{e['id']}: months")
    if not isinstance(e["durationMonths"], int) or e["durationMonths"] < 1:
        errors.append(f"{e['id']}: durationMonths")
    if not e["effects"]:
        errors.append(f"{e['id']}: no effects")
    if len(e["playerMoves"]) < 2:
        warns.append(f"{e['id']}: fewer than two moves")
    for x in e["effects"]:
        if "mult" in x and not (MULT_OK[0] <= x["mult"] <= MULT_OK[1]) and x["field"] in (
                "demand", "cogs", "staffAvailability", "footTraffic", "utilities", "deliveryShare", "rent", "wages", "capacity", "quality", "reputation"):
            if "outsideBandReason" not in x:
                warns.append(f"{e['id']}: {x['field']} mult {x['mult']} outside 0.7-1.3")
    for mvv in e["playerMoves"]:
        if mvv["kind"] == "shortcut":
            if not mvv.get("violation"):
                errors.append(f"{e['id']}: shortcut {mvv['id']} without violation")
        elif not mvv["cost"]:
            errors.append(f"{e['id']}: move {mvv['id']}/{mvv.get('optionId')} has no cost")
    if e["confidence"] not in ("verified", "estimate"):
        errors.append(f"{e['id']}: confidence")
    if not e["source"].startswith("http"):
        errors.append(f"{e['id']}: source")

core = [e for e in events if e["tier"] == "core"]
by_frag = collections.Counter(e["sourceFragment"] for e in events)
by_conf = collections.Counter(e["confidence"] for e in events)
summary = {
    "events": len(events), "core": len(core), "deep": sum(e["tier"] == "deep" for e in events),
    "exotic": sum(e["tier"] == "exotic" for e in events),
    "byFragment": dict(by_frag), "byConfidence": dict(by_conf),
    "duplicatesMarked": sum(1 for e in events if e.get("duplicateOf")),
}

out = {
    "id": "cafe",
    "fragment": "D17-calibration-people-money",
    "researcher": "D17",
    "topic": "People, wages, taxes, money, payments: calibration of events",
    "checked": "2026-11-14",
    "howToRead": "extra.eventCalibration holds one record per event id of the source fragment (sourceFragment). It replaces that event's months, durationMonths and effects, and adds cost/result to each player move. Ids are unchanged.",
    "extra": {"calibrationSummary": summary, "eventCalibration": events, **extra},
}
root = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
path = os.path.join(root, "packs", "parts", "cafe", "D17-calibration-people-money.json")
with open(path, "w") as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
print(json.dumps(summary, ensure_ascii=False))
print("errors:", len(errors)); [print("  E", x) for x in errors]
print("warnings:", len(warns)); [print("  W", x) for x in warns[:60]]
sys.exit(1 if errors else 0)
