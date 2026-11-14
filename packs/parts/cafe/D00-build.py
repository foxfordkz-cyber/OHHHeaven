#!/usr/bin/env python3
"""Assemble D00 evidence only; never write the live cafe pack or engine."""
import argparse
import collections
import copy
import json
import pathlib
import re
import urllib.parse

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parents[2]
SHARDS = HERE / 'D00-evidence'

def canonical(url):
    u = urllib.parse.urlsplit(url)
    host = u.netloc.lower()
    if host.startswith('www.'):
        host = host[4:]
    if re.fullmatch(r'home\d+\.nyc\.gov', host):
        host = 'nyc.gov'
    q = [(k, v) for k, v in urllib.parse.parse_qsl(u.query, keep_blank_values=True)
         if not k.startswith('utm_') and k not in {'fbclid', 'gclid'}]
    return urllib.parse.urlunsplit(('https', host, u.path.rstrip('/'), urllib.parse.urlencode(sorted(q)), ''))

def dump(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')

def overlay(base, patch):
    out = copy.deepcopy(base)
    for k, v in patch.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = overlay(out[k], v)
        elif k == 'sources' and isinstance(v, list):
            merged = {canonical(x['url']): x for x in out.get(k, [])}
            merged.update({canonical(x['url']): x for x in v})
            out[k] = list(merged.values())
        elif isinstance(v, list) and all(isinstance(x, dict) and 'id' in x for x in v):
            old = out.get(k, [])
            by_id = {x['id']: x for x in v}
            out[k] = [overlay(x, by_id.pop(x['id'])) if x.get('id') in by_id else x for x in old]
            out[k].extend(by_id.values())
        else:
            out[k] = copy.deepcopy(v)
    return out

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--final', action='store_true')
    args = parser.parse_args()
    base = json.loads((REPO / 'packs/cafe.json').read_text())
    extra = {k: [] for k in ('eventCatalog', 'nonObvious', 'failureStories', 'researchLevers', 'searchLog', 'gaps', 'ownerDay', 'ownerYear', 'mechanics', 'verifiedFacts', 'calendarAnchors')}
    sources = {}
    patch = {'id': 'cafe'}
    shard_counts = {}
    for file in sorted(SHARDS.glob('*.json')):
        data = json.loads(file.read_text())
        shard_counts[file.stem] = {k: len(data.get(k, [])) for k in ('eventCatalog', 'nonObvious', 'failureStories', 'sources')}
        for k in extra:
            for row in data.get(k, []):
                if isinstance(row, str):
                    row = {'id': f'd00_gap_{file.stem}_{len(extra[k])}', 'text': row, 'tier': 'deep'}
                row = copy.deepcopy(row)
                row.setdefault('tier', 'deep')
                row['evidenceShard'] = file.name
                extra[k].append(row)
        for row in data.get('sources', []):
            row = copy.deepcopy(row)
            row['checked'] = '2026-11-14'
            row.setdefault('tier', 'deep')
            key = canonical(row['url'])
            if key in sources:
                old = sources[key]
                old.setdefault('aliases', []).append(row['id'])
                old.setdefault('alsoConsultedIn', []).append(file.name)
                # A successful direct open takes precedence over a blocked fetch or excerpt.
                rank = {'opened_primary': 4, 'opened_secondary': 3, 'search_excerpt': 2, 'blocked': 1}
                if rank.get(row.get('access'), 0) > rank.get(old.get('access'), 0):
                    for field in ('access', 'evidence', 'type'):
                        old[field] = row.get(field, old.get(field))
            else:
                sources[key] = row
        for k, v in data.get('corrections', {}).items():
            patch[k] = v

    for row in extra['eventCatalog']:
        row['implementationStatus'] = 'research_only_pending_calibration'
        row['playerMoveRegistry'] = 'extra.researchLevers'
        row['activationPolicy'] = 'A recorded player-state trigger or a preannounced shared scenario; never a random monthly draw.'
        row.setdefault('realFrequency', 'Not estimated; the cited evidence is not a representative incidence sample.')
    source_list = list(sources.values())
    source_lookup = {canonical(x['url']): x for x in source_list}
    usages = collections.defaultdict(set)
    def track(obj, record_id='metadata'):
        if isinstance(obj, dict):
            record_id = obj.get('id', record_id)
            for k, v in obj.items():
                if k == 'source' and isinstance(v, str) and v.startswith('http'):
                    usages[canonical(v)].add(record_id)
                elif k in ('supportingSources', 'additionalSources') and isinstance(v, list):
                    for url in v:
                        if isinstance(url, str) and url.startswith('http'):
                            usages[canonical(url)].add(record_id)
                        else:
                            track(url, record_id)
                elif k != 'sources':
                    track(v, record_id)
        elif isinstance(obj, list):
            for x in obj:
                track(x, record_id)
    track(extra)
    track(patch)
    for row in source_list:
        row['usedBy'] = sorted(usages.get(canonical(row['url']), []))
    # The counted registry excludes any reading-list item not actually used by a record.
    unused = [x for x in source_list if not x['usedBy']]
    source_list = [x for x in source_list if x['usedBy']]

    extra['baselineCoverage'] = []
    coverage = [
        ('Opening and fit-out', ['buildout', 'architect_expediter', 'get_fse_permit'], 'Costs and broad steps exist; dependencies, stop-work, failed signoffs and contracted rent during each delay need state.', 'premises_law'),
        ('Takeover', ['second_generation_space', 'security_deposit'], 'The comparison branch adds a takeover estimate; buyer tax exposure, liens, transferability and consent remain separate.', 'premises_law'),
        ('Equipment', ['espresso_machine', 'water_filtration', 'maintenance'], 'Purchase allowances exist; water suitability, warranties, parts, failure diagnosis and restart procedures are missing.', 'equipment_food'),
        ('Food handling', ['spoiled_food', 'keep_old_food'], 'Existing text conflates old food and unsafe food; add batch handling, cooling, cross-contact and recalls.', 'equipment_food'),
        ('Supplier terms', ['coffee_beans', 'dairy', 'pastry'], 'Vendor categories exist; delivery terms, allocation, rejection, package mismatch and item-level substitutions need state.', 'equipment_food'),
        ('Labor', ['barista', 'shift_lead', 'staff_pay', 'spread_of_hours_unpaid'], 'Wages and a few violations exist; coverage, leave eligibility, payroll evidence and owner workload need detail.', 'labor_finance'),
        ('Money and exit', ['card_fees', 'card_fixed_fee', 'sales_tax'], 'Cost averages exist; settlement, holds, debt principal, cash restrictions and surviving closure liabilities are absent.', 'labor_finance'),
        ('Insurance', ['insurance'], 'A premium allowance does not express exclusions, claim documentation, deductibles or coverage triggers.', 'labor_finance'),
        ('Snow and ice', [], 'No baseline event models the entrance, clearing deadline, assigned responsibility and safe access decision.', 'street_demand'),
        ('Street construction', ['sidewalk_shed'], 'A fixed traffic penalty exists; notices, accessible approach, wayfinding and delivery access require distinct choices.', 'street_demand'),
        ('Demand', ['restaurant_week'], 'Comparison-branch footfall work is acknowledged; school, office and route changes still need observed triggers rather than universal uplifts.', 'street_demand'),
        ('Commodity prices', ['coffee_price_spike', 'milk_price_up'], 'Baseline multipliers are estimates; actual supplier invoices, inventory and menu mix must mediate price changes.', 'equipment_food'),
        ('Heat and sickness', ['summer_power_peak', 'flu_season'], 'Baseline multipliers are estimates; actual equipment demand and qualified relief coverage should determine consequences.', 'labor_finance'),
        ('Closure evidence', [], 'No baseline closure corpus separates reported cause, unresolved cause, retirement, branch closure and temporary interruption.', 'closures_nyc'),
        ('External owner comparisons', [], 'Foreign anecdotes supply operational hypotheses, not New York law or representative failure rates.', 'closures_world'),
        ('Day and year', [], 'No baseline walkthrough separates receiving, trading, closing, administration and calendar deadlines.', 'synthesis'),
    ]
    for i, (name, ids, finding, shard) in enumerate(coverage):
        candidates = [x for x in extra['eventCatalog'] if x['evidenceShard'] == shard + '.json']
        extra['baselineCoverage'].append({'id': f'd00_coverage_{i:02d}', 'name': name, 'existingIds': ids, 'finding': finding, 'newRecordIds': [x['id'] for x in candidates], 'tier': 'core', 'source': (candidates[0]['source'] if candidates else source_list[0]['url']), 'confidence': 'estimate', 'note': 'Comparison of local baseline records and evidence shards, not a numerical impact estimate.'})

    numeric_audit = []
    for section in ('setup', 'monthlyCosts', 'staff', 'taxes', 'violations'):
        for row in base[section]:
            def numeric_fields(x, path=''):
                acc = []
                for k, v in x.items():
                    p = f'{path}.{k}' if path else k
                    if isinstance(v, (float, int)) and not isinstance(v, bool):
                        acc.append(p)
                    elif isinstance(v, dict):
                        acc.extend(numeric_fields(v, p))
                return acc
            source = row.get('source', '')
            accessed = source_lookup.get(canonical(source), {}) if source else {}
            numeric_audit.append({'id': f'd00_audit_{section.lower()}_{row["id"]}', 'record': f'{section}.{row["id"]}', 'fields': numeric_fields(row), 'baselineConfidence': row.get('confidence', 'unspecified'), 'source': source, 'tier': 'core', 'confidence': 'estimate', 'sourceAccessInD00': accessed.get('access', 'not_reopened_in_this_session'), 'verdict': 'No blanket re-verification. Product price, planning allowance, lifespan, quality/reputation effect and legal amount are distinct claims.', 'requiredEvidence': ('Case-specific legal amount and condition; game reputation and elapsed-month fine terms require separate calibration.' if section == 'violations' else 'Exact current quotation or rate with scope; actual usage/hours/quantity and calculation for any planning allowance.'), 'note': 'Audits all baseline numeric records for evidence status; an opened source alone does not verify every field. Values not established remain unresolved, not promoted to verified.'})
    extra['baselineNumericAudit'] = numeric_audit
    extra['d00ResearchStatus'] = {
        'tier': 'core', 'status': 'complete_catalog' if args.final else 'in_progress', 'date': '2026-11-14',
        'baseCommit': '0dd297bd0b9470e616f85c50c0a675ac5f58d862',
        'comparisonCommit': '2b2521f202989e19a40a866de19e54f9250ce6c0',
        'branch': 'research/d00-cafe-total-search',
        'scope': 'Small owner-operated NYC cafe; external cases clearly identified as comparisons.',
        'mergePolicy': 'Merge dictionaries recursively and arrays by id. Partial corrections preserve untouched baseline fields. This is a fragment, not a standalone replacement pack.',
        'numericPolicy': 'No new assumed effect multiplier, breakdown frequency, unquoted price or repair duration. Clock/calendar labels are explicitly illustrative scheduling metadata.',
        'sourcePolicy': 'Only unique canonical URLs used in research records count. Successful opens and search-excerpt evidence are distinguished. No claim that the whole internet has been exhausted.',
        'activationPolicy': 'Catalog decisions are specified under extra.researchLevers because PackLever requires numeric monthlyCost; unknown cost is not zero. The host must calibrate before activation.'
    }
    patch['sources'] = source_list
    patch['extra'] = extra
    errors = []
    for key, rows in extra.items():
        if not isinstance(rows, list):
            continue
        ids = [x.get('id') for x in rows if isinstance(x, dict)]
        if len(ids) != len(set(ids)):
            errors.append(f'{key}: duplicate id')
        for row in rows:
            if row.get('tier') not in {'core', 'deep', 'exotic'}:
                errors.append(f'{key}: invalid tier {row.get("id")}')
    levers = {x['id']: x for x in extra['researchLevers']}
    for e in extra['eventCatalog']:
        for field in ('id', 'name', 'text', 'realSignal', 'source', 'confidence', 'note'):
            if not e.get(field):
                errors.append(f'{e.get("id")}: missing {field}')
        if e.get('scale') not in {'point', 'block', 'city', 'country', 'world'}:
            errors.append(f'{e["id"]}: invalid scale')
        if len(e.get('playerMoves', [])) < 2:
            errors.append(f'{e["id"]}: fewer than two choices')
        if e.get('effects'):
            errors.append(f'{e["id"]}: unexpected numerical effect needs audit')
        for move in e.get('playerMoves', []):
            lever = levers.get(move['id'])
            if not lever:
                errors.append(f'{e["id"]}: unresolved move {move["id"]}')
            elif move.get('optionId') not in {x['id'] for x in lever['options']}:
                errors.append(f'{e["id"]}: unresolved option')
    for key in ('eventCatalog', 'nonObvious', 'failureStories', 'researchLevers'):
        for row in extra[key]:
            if canonical(row.get('source', '')) not in sources:
                errors.append(f'{row["id"]}: unregistered source')
    quotes = collections.defaultdict(int)
    for row in extra['failureStories']:
        for field in ('what', 'cause', 'lesson', 'source', 'quote', 'quoteAttribution', 'status'):
            if not row.get(field):
                errors.append(f'{row["id"]}: missing {field}')
        quotes[canonical(row['source'])] += len(row.get('quote', '').split())
        if any(x in row.get('status', '') for x in ('planned', 'announced_future', 'pending')):
            errors.append(f'{row["id"]}: pending closure must not count')
    for url, words in quotes.items():
        if words > 25 and 'reddit.com/' not in url:
            errors.append(f'quote budget {words}: {url}')
    counts = {k: len(extra[k]) for k in ('eventCatalog', 'nonObvious', 'failureStories', 'researchLevers', 'ownerDay', 'ownerYear', 'mechanics', 'baselineNumericAudit')}
    counts['sources'] = len(source_list)
    minima = {'eventCatalog': 300, 'nonObvious': 150, 'failureStories': 60, 'sources': 200}
    if args.final:
        for k, n in minima.items():
            if counts[k] < n:
                errors.append(f'{k}: {counts[k]} < {n}')
    checks = {'tier': 'core', 'counts': counts, 'minima': minima, 'minimumsMet': all(counts[k] >= n for k, n in minima.items()), 'errors': errors, 'byShard': shard_counts, 'scales': dict(collections.Counter(x['scale'] for x in extra['eventCatalog'])), 'sourceAccess': dict(collections.Counter(x['access'] for x in source_list)), 'languages': dict(collections.Counter(x['language'] for x in source_list)), 'closureStatus': dict(collections.Counter(x['status'] for x in extra['failureStories'])), 'unusedSourcesExcluded': [x['url'] for x in unused], 'limits': 'Structural checks do not certify truth or independently reproduce every quotation. Quotes, causal attribution and source applicability also require researcher review.'}
    dump(HERE / 'D00-total-search.json', patch)
    dump(HERE / 'D00-validation.json', checks)
    dump(pathlib.Path('/tmp/d00-cafe-overlay.json'), overlay(base, patch))
    print(json.dumps(checks, ensure_ascii=False, indent=2))
    if errors:
        raise SystemExit(1)

if __name__ == '__main__':
    main()
