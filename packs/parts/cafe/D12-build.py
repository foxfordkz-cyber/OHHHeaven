#!/usr/bin/env python3
"""D12: build the corrected-records fragment from the cafe pack (v2, branch claude/keen-cray-yytcbp)
and packs/_common.json. Each patch keeps the record id; the fragment holds full corrected records.
Also prints the "was -> now -> source" table for the report.
Run from the repo root:  python3 packs/parts/cafe/D12-build.py"""
import json, subprocess, copy, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
def load_git(ref, path):
    return json.loads(subprocess.check_output(['git', 'show', f'{ref}:{path}']))
try:
    CAFE = load_git('origin/claude/keen-cray-yytcbp', 'packs/cafe.json')
except Exception:
    CAFE = json.load(open('packs/cafe.json'))
COMMON = json.load(open('packs/_common.json'))
CHECKED = '2026-11-14'
sys.path.insert(0, HERE)
from D12_patches import CAFE_PATCHES, COMMON_PATCHES, NEW_SOURCES, CHECKED_ONLY, LEVER_NOTES, SHORTCUT_NOTES  # noqa: E402
import D12_patches  # noqa: E402

def find(pack, section, rid):
    sec = pack
    for part in section.split('.'):
        sec = sec[part]
    if isinstance(sec, list):
        for r in sec:
            if r.get('id') == rid:
                return r
        raise KeyError(f'{section}[{rid}] not found')
    # dict section (unit, market, sizing, manager, benchmarks, extra.*)
    return sec if rid is None else sec[rid]

def apply(pack, patches):
    frag, rows = {}, []
    for p in patches:
        section, rid, upd = p['section'], p.get('id'), p['set']
        rec = copy.deepcopy(find(pack, section, rid))
        before = {k: rec.get(k) for k in upd if k != 'note'}
        for k, v in upd.items():
            if isinstance(v, dict) and isinstance(rec.get(k), dict) and k not in ('fine',):
                rec[k].update(v)
            else:
                rec[k] = v
        after = {k: rec.get(k) for k in upd if k != 'note'}
        top = section.split('.')[0]
        if isinstance(pack[top], list):
            frag.setdefault(top, []).append(rec)
        else:
            # dict section: put it under the same path
            node = frag
            parts = section.split('.') + ([rid] if rid else [])
            for part in parts[:-1]:
                node = node.setdefault(part, {})
            node[parts[-1]] = rec
        rows.append((f"{section}[{rid}]" if rid else section, before, after, rec.get('source', ''), p.get('why', ''), rec.get('confidence', '')))
    return frag, rows

cafe_frag, cafe_rows = apply(CAFE, CAFE_PATCHES)
common_frag, common_rows = apply(COMMON, COMMON_PATCHES)
# levers: add source/confidence/note to each option that has a number
levers = {l['id']: copy.deepcopy(l) for l in CAFE['levers']}
for ln in LEVER_NOTES:
    for o in levers[ln['lever']]['options']:
        if o['id'] == ln['option']:
            o.update({k: ln[k] for k in ('note', 'source', 'confidence')})
            if ln['lever'] == 'hours' and ln['option'] == 'long':
                cafe_rows.append(('levers[hours].options[long]', {'monthlyCost': o['monthlyCost']}, {'monthlyCost': 2000}, ln['source'], 'пересчёт от ставки $18 вместо $21', 'estimate'))
                o['monthlyCost'] = 2000
cafe_frag['levers'] = [levers[k] for k in levers if any(ln['lever'] == k for ln in LEVER_NOTES)]
shortcuts = []
for sc in CAFE['shortcuts']:
    if sc['id'] in SHORTCUT_NOTES:
        sc = copy.deepcopy(sc)
        sc['note'], sc['source'] = SHORTCUT_NOTES[sc['id']]
        sc['confidence'] = 'estimate'
        shortcuts.append(sc)
cafe_frag['shortcuts'] = shortcuts
common_sc = []
for sc in COMMON['shortcuts']:
    if sc['id'] in getattr(D12_patches, 'COMMON_SHORTCUT_NOTES', {}):
        sc = copy.deepcopy(sc)
        sc['note'], sc['source'] = D12_patches.COMMON_SHORTCUT_NOTES[sc['id']]
        sc['confidence'] = 'estimate'
        common_sc.append(sc)
if common_sc:
    common_frag['shortcuts'] = common_sc
cafe_frag['sources'] = [dict(s, checked=CHECKED) for s in NEW_SOURCES]
cafe_frag['extra'] = cafe_frag.get('extra', {})
cafe_frag['extra']['d12CheckedUnchanged'] = CHECKED_ONLY
for name, frag in (('D12-number-check.json', cafe_frag), ('D12-number-check.common.json', common_frag)):
    with open(os.path.join(HERE, name), 'w') as f:
        json.dump(frag, f, ensure_ascii=False, indent=2)
        f.write('\n')

def fmt(d):
    return '; '.join(f"{k}={json.dumps(v, ensure_ascii=False)}" for k, v in d.items())
with open(os.path.join(HERE, 'D12-table.md'), 'w') as f:
    f.write('| Запись | Было | Стало | Пометка | Источник | Почему |\n|---|---|---|---|---|---|\n')
    for pack, rows in (('cafe', cafe_rows), ('_common', common_rows)):
        for where, b, a, src, why, conf in rows:
            f.write(f"| {pack}: `{where}` | {fmt(b)} | {fmt(a)} | {conf} | {src} | {why} |\n")
print(len(cafe_rows), 'cafe patches,', len(common_rows), 'common patches,', len(CHECKED_ONLY), 'checked-only')
