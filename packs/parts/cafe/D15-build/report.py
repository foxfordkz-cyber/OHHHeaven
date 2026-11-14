import json, os, sys
from urllib.parse import urlparse
HERE = os.path.dirname(os.path.abspath(__file__))
out = json.load(open(sys.argv[1]))
head = open(os.path.join(HERE, 'report_head.md')).read()
nv = sum(1 for x in out['sources'] if x['confidence'] == 'verified')
head = head.replace('{SRC_TOTAL}', str(len(out['sources']))).replace('{SRC_VER}', str(nv)).replace('{SRC_SEC}', str(len(out['sources']) - nv))
lines = [head.rstrip(), ""]
ver = [s for s in out['sources'] if s['confidence'] == 'verified']
sec = [s for s in out['sources'] if s['confidence'] != 'verified']
for s in ver:
    lines.append(f"- [{s['title']}]({s['url']})")
lines += ["", "Вторичные источники и выдержки поиска (числа из них помечены `estimate`):", ""]
for s in sec:
    lines.append(f"- [{s['title']}]({s['url']})")
lines += ["", "Для сравнения с Россией и Испанией (`extra.comparisonsAbroad`):", ""]
seen = set()
for c in out['extra'].get('comparisonsAbroad', []):
    for u in c['sources']:
        if u not in seen and not any(x['url'] == u for x in out['sources']):
            seen.add(u); lines.append(f"- {u}")

GROUP_RU = {'lease': 'Аренда и арендодатель', 'buildout_permits': 'Ремонт и разрешения', 'utilities': 'Газ, электричество, вода', 'entry': 'Вход в бизнес: покупка, франшиза, тележка', 'room': 'Зал и помещение'}

def eff_str(f):
    v = None
    for k in ('mult', 'add', 'set', 'formula'):
        if k in f:
            v = {'mult': '×', 'add': '+' if (isinstance(f[k], (int, float)) and f[k] >= 0) else '', 'set': '=', 'formula': '='}[k] + (f"{f[k]:,}" if isinstance(f[k], (int, float)) and k == 'add' else str(f[k]))
            break
    s = f"`{f['field']}` {v}"
    for k in ('byBuildoutClass', 'byTier', 'byGuaranty'):
        if k in f:
            s += " (" + ", ".join(f"{a} {b:,}" if isinstance(b, (int, float)) else f"{a} {b}" for a, b in f[k].items()) + ")"
    if f.get('appliesIf'):
        s += " если " + f['appliesIf'][:40]
    return s.replace('|', '/')

def months_str(m):
    if len(m) == 12: return 'все'
    return ','.join(str(x) for x in m)

lines += ["", "## Приложение А. Таблица «событие → эффект → источник»", "",
          "Порядок: по группам, внутри — core, deep, exotic. Конф.: V — первоисточник открыт мной (`verified`), E — оценка (`estimate`). «Мес.» — месяцы года, «Длит.» — `durationMonths`.", ""]
order = {'core': 0, 'deep': 1, 'exotic': 2}
for g in ['lease', 'buildout_permits', 'utilities', 'entry', 'room']:
    evs = sorted([e for e in out['extra']['eventCatalog'] if e['group'] == g], key=lambda e: (order[e['tier']], e['id']))
    lines += [f"### {GROUP_RU[g]} ({len(evs)})", "", "| Событие | Уровень | Из | Эффект | Мес. | Длит. | Источник | Конф. |", "|---|---|---|---|---|---|---|---|"]
    for e in evs:
        effs = "; ".join(eff_str(f) for f in e['effects'][:3])
        dom = urlparse(e['source']).netloc.replace('www.', '')
        dur = '—' if e['durationMonths'] is None else e['durationMonths']
        name = e['id'] + (' ⇢ ' + e['mergedWith'] if e.get('mergedWith') else '') + (' (новое)' if e.get('newInD15') else '')
        lines.append(f"| `{name}` | {e['tier']} | {e['sourceFragment']} | {effs} | {months_str(e['months'])} | {dur} | [{dom}]({e['source']}) | {'V' if e['confidence'] == 'verified' else 'E'} |")
    lines.append("")

lines += ["## Приложение Б. Что не откалибровано и почему", "",
          "Среди отобранных событий темы таких нет: все 190 отобранных и 5 новых получили числа. Ниже — соседние события из тех же каталогов, которые я сознательно оставил другим темам, чтобы не дублировать:", "",
          "| Событие | Из | Кому | Причина |", "|---|---|---|---|"]
handoff = [
 ("cloudburst_floods_cellar, grease_backup, ac_fails_in_heat_wave", "D02", "D16 / D18", "поломки оборудования и ливни: погода и техника, а не помещение"),
 ("backflow_notice, backflow_penalty_bill", "D02", "D19", "ежегодная проверка и штрафы DEP; установку устройства (`d00_premises_backflow_install`) я откалибровал"),
 ("dim_bar_at_inspection, candles_without_a_permit", "D02", "D19", "санитарная и пожарная проверка"),
 ("snowfall_overnight, freeze_after_snow, dsny_snow_sweep, slip_claim_letter, blizzard_travel_ban, wet_floor_inside, insurance_renewal_after_claim", "D14", "D18 / D19", "зима у входа и иски — темы погоды и закона"),
 ("first_graded_inspection, vending_enforcement_sweep, market_inspector_walks_the_stalls, milk_drinks_change_the_cart_class", "D01", "D19", "проверки и их последствия"),
 ("machine_tariff", "D01", "D16", "цена оборудования"),
 ("d00_premises_inspector_arrives, ombuds_not_appeal, platform_allergy, poster_languages, dog_papers, dinein_safety, renewal_docs", "D00", "D19", "проверки, плакаты, продление разрешения"),
 ("d00_premises_pfe_service_scope, pfe_tag, pest_record, pest_door_gap, delivery_pests", "D00", "D16 / D19", "обслуживание огнетушителей и дезинсекция"),
 ("d00_premises_personal_playlist, live_music_license, biometric_camera, wine_layout, alcohol_passed, outdoor_floor, outdoor_heater, penny_change", "D00", "D17 / D19", "лицензии на музыку, алкоголь, касса"),
 ("shed_goes_up, shed_idle_months, shed_comes_down, demolition_next_door, corner_lot_double_duty, street_dig", "D07 / D10", "D18", "улица и стройки рядом; я калибровал только `d00_street_hidden_sign` как эффект на вывеску"),
]
for a, b, c, d in handoff:
    lines.append(f"| {a} | {b} | {c} | {d} |")
lines.append("")
open(sys.argv[2], 'w').write("\n".join(lines) + "\n")
print('report lines', len(lines))
