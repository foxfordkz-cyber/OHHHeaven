import json, os, sys, importlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import S, REF, ALL
from costfill import COST_FILL

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1]
sel = json.load(open(os.path.join(HERE, 'selected.json')))

groups = []
for mod in ['cal_lease', 'cal_build', 'cal_util', 'cal_entry', 'cal_room', 'cal_more']:
    try:
        m = importlib.import_module(mod)
    except ModuleNotFoundError:
        continue
    groups.append((mod, m.CAL))
    S.update(getattr(m, 'EXTRA_SOURCES', {}))

GROUP_NAME = {'cal_lease': 'lease', 'cal_build': 'buildout_permits', 'cal_util': 'utilities', 'cal_entry': 'entry', 'cal_room': 'room', 'cal_more': 'room'}
MORE_GROUP = {'dob_enforcement_sweep': 'buildout_permits', 'dob_subsequent_filing_fee': 'buildout_permits', 'sign_moratorium_ll15': 'buildout_permits', 'sign_complaint_wave': 'buildout_permits', 'landmark_notice': 'buildout_permits', 'asking_rents_climb': 'lease', 'building_gas_inspection_due': 'utilities', 'd00_closures_nyc_event_sprinkler_stock': 'lease', 'd00_closures_nyc_event_repair_reopening_notice': 'lease', 'd00_closures_nyc_event_reopen_after_peak': 'lease', 'd00_world_event_insurance_claim_dependencies': 'lease', 'd00_world_event_storefront_collision': 'room'}
# player-move option ids aligned to levers that already exist in D01, D06, D09, D10
REMAP = {('guaranty_type','full'): ('guaranty_type','full_personal'), ('guaranty_type','none_big_deposit'): ('guaranty_type','no_guaranty_big_deposit'),
 ('free_rent_deal','long_free'): ('free_rent_deal','six_months_higher_rent'), ('lease_contingencies','rent_from_permits'): ('free_rent_deal','starts_with_permits'),
 ('lease_contingencies','outside_delivery_date'): ('lease_contingencies','delivery_and_permit_clause'),
 ('contractor_choice','insured_contractor'): ('contractor_choice','food_service_specialist'), ('contractor_choice','licensed_trades'): ('contractor_choice','food_service_specialist'),
 ('contractor_choice','lien_waivers'): ('contractor_choice','food_service_specialist'), ('contingency_level','fifteen_percent'): ('contingency_level','standard'),
 ('construction_pace','rush'): ('construction_pace','after_hours'), ('construction_pace','rush_with_variance'): ('construction_pace','after_hours'), ('construction_pace','standard'): ('construction_pace','standard_hours'),
 ('order_ahead','on'): ('order_ahead','open'), ('insurance','business_interruption'): ('insurance_package','full_cover'),
 ('lease_negotiation','renewal_option_cap'): ('lease_terms','ten_with_option')}
for o in ['walk_through','asbestos_survey_before_lease','check_backflow','check_co_before_lease','check_dob_violations','load_letter_before_lease']:
    REMAP[('site_due_diligence', o)] = ('site_due_diligence', 'survey_first')
def remap(moves):
    for m in moves:
        k = (m.get('id'), m.get('optionId'))
        if k in REMAP:
            m['id'], m['optionId'] = REMAP[k]
            m['kind'] = 'lever'
        if m.get('id') == 'apply_before_closing':
            m.update(kind='lever', id='takeover_permit_timing', optionId='apply_before_closing')
        if m.get('id') == 'music_level':
            m.update(kind='choice', id='keep_music_low'); m.pop('optionId', None)
    for m in moves:
        if not m.get('cost'):
            k = m.get('optionId') or m.get('id')
            m['cost'] = COST_FILL[k]
    return moves
events, used, missing = [], set(), []
for mod, cal in groups:
    for eid, c in cal.items():
        o = sel.get(eid)
        new = o is None
        if new and not c.get('new'):
            missing.append(eid)
        o = o or {}
        e = {
            'id': eid,
            'sourceFragment': o.get('_frag', 'D15'),
            'group': MORE_GROUP.get(eid, GROUP_NAME[mod]),
            'name': c.get('name', o.get('name')),
            'text': c.get('text', o.get('text')),
            'tier': c.get('tier', o.get('tier')),
            'scale': c.get('scale', o.get('scale', 'point')),
            'months': c['months'],
            'durationMonths': c.get('dur'),
        }
        if c.get('durNote'): e['durationNote'] = c['durNote']
        e['trigger'] = c.get('trig') or o.get('trigger')
        e['realSignal'] = c.get('signal', o.get('realSignal'))
        for k in ('tiers', 'appliesTo', 'mergedWith'):
            if c.get(k): e[k] = c[k]
        e['effects'] = c['eff']
        e['playerMoves'] = remap(c['moves'])
        e['realFrequency'] = c.get('freq') or o.get('realFrequency')
        e['source'] = S[c['src']][0]
        e['supportingSources'] = [S[k][0] for k in c.get('sup', [])]
        e['confidence'] = c['conf']
        e['note'] = c['note']
        if new: e['newInD15'] = True
        used.update([c['src']] + c.get('sup', []))
        events.append(e)

ids = [e['id'] for e in events]
assert len(ids) == len(set(ids)), 'duplicate ids'
notcal = [i for i in sel if i not in ids]

frag = json.load(open(os.path.join(HERE, 'fragment_extra.json'))) if os.path.exists(os.path.join(HERE, 'fragment_extra.json')) else {}
out = {
    'id': 'cafe',
    'fragment': 'D15-calibration-premises',
    'theme': 'Premises, build-out, entry into the business, lease: numbers for the events',
    'checked': '2026-11-14',
    'basedOn': 'packs/parts/cafe/ from all branches: D00 (research/d00-cafe-total-search), D01, D02, D08, D09, D10, D13, D14; packs/cafe.json of claude/keen-cray-yytcbp',
}
for k in ('levers', 'shortcuts', 'violations', 'ruleCards', 'events'):
    if k in frag: out[k] = frag[k]
extra = {
    'calibrationReference': {
        'note': 'Money effects in notes are computed for the pack reference shop: 800 sq ft, $6,000 rent, $51,000 sales and $9,719 profit a month (packs/cafe.json extra.referenceMonth); build-out classes of keen-cray extra.buildout. A day closed loses about $1,700 of sales and $1,200 of contribution; a day of rent is $200.',
        **REF},
    'eventCatalog': events,
}
for k, v in frag.get('extra', {}).items():
    extra[k] = v
extra['notCalibrated'] = [{'id': i, 'sourceFragment': sel[i]['_frag'], 'reason': frag.get('notCalibratedReasons', {}).get(i, 'not reached in this session')} for i in notcal]
out['extra'] = extra
out['sources'] = [{'url': S[k][0], 'title': S[k][1], 'checked': '2026-11-14', 'confidence': S[k][2]} for k in sorted(used)]
json.dump(out, open(OUT, 'w'), ensure_ascii=False, indent=1)
from collections import Counter
print('events', len(events), Counter(e['tier'] for e in events), 'groups', Counter(e['group'] for e in events))
print('verified', sum(1 for e in events if e['confidence'] == 'verified'), 'sources', len(used))
print('not calibrated', len(notcal), 'missing-from-selection', missing)
core_left = [i for i in notcal if sel[i].get('tier') == 'core']
print('core not calibrated', core_left)
