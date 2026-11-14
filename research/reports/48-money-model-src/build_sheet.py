import openpyxl
from openpyxl.utils import get_column_letter as L
from model import MONTHS, SEASON_B2B, COURSE_SALES, CLUB_SALES, S
T = len(MONTHS)
FIRST = 3  # column C = month 1
col = lambda m: L(FIRST + m)          # m = 0..T-1
last12 = col(11)
rows = []      # list of (label, cells dict col->value, note)
R = {}         # name -> row number
def add(name, label, cells=None, note=''):
    rows.append((name, label, cells or {}, note)); R[name] = len(rows)
# --- header and inputs
add('title', 'Street War — revenue model (researcher 48). Net = after Paddle 5% + $0.50 per transaction.')
add('scenario', 'Scenario: 1 = cautious, 2 = base, 3 = bold', {'B': 2})
add('blank1', '')
add('hdr', 'Input', {'B': 'Cautious', 'C': 'Base', 'D': 'Bold', 'E': 'Selected', 'F': 'Source / calculation'})
INPUTS = [
 ('fee_pct', 'Payment fee, % (Paddle)', (0.05,)*3, 'paddle.com/pricing: 5% + 50c'),
 ('fee_fix', 'Payment fee, fixed $ (Paddle)', (0.5,)*3, 'paddle.com/pricing'),
 ('pass_month', 'Host Pass monthly price $', (4.99,)*3, 'BGA Premium $5/mo, table creator pays (BGA forum, FAQ)'),
 ('pass_year', 'Host Pass annual price $', (39.99,)*3, 'BGA Premium $42/yr since 2025-07'),
 ('annual_share', 'Share of payers on annual plan', (0.4,)*3, 'estimate'),
 ('pass_net', 'Host Pass net $ per paying host per month', None, 'formula: blend of monthly and annual/12 after fees'),
 ('seed_m1', 'Seeded new players, month 1 (launch)', S['seed_m1'], 'estimate: Reddit 300-1,000 (report 11) + Show HN/PH/itch + friends'),
 ('seed_m2', 'Seeded new players, month 2', S['seed_m2'], 'estimate: launch spike gone'),
 ('seed_growth', 'Seeded players growth per month from month 3', S['seed_growth'], 'estimate: content compounding (clips, city pages, portals)'),
 ('k', 'Invited new players per new player (k)', S['k'], 'estimate: 30% host x 1.5 new friends; report 11 used 0.4'),
 ('host_share', 'Share of new players who host a room', S['host_share'], 'estimate: rooms of ~3.3 humans -> 1 host in 3.3'),
 ('host_conv', 'Host -> Host Pass conversion', S['host_conv'], 'estimate vs RevenueCat freemium median 2.1-2.2% of all users'),
 ('payer_churn', 'Paying host churn per month', S['payer_churn'], 'estimate: RevenueCat monthly plans 6.7% left after 1 yr (=~20%/mo), cheap annual 36%'),
 ('outreach', 'War Night prospects contacted per month', S['outreach'], 'estimate: 15 personal messages per workday'),
 ('reply', 'Reply rate per prospect sequence', S['reply'], 'Hunter 2025: 4.5% per sequence; Mailshake: 1-4% norm'),
 ('demo', 'Replies -> call', S['demo'], 'estimate'),
 ('close', 'Call -> paid War Night', S['close'], 'estimate'),
 ('warm_pilots', 'Warm-network pilots in month 1', S['warm_pilots_m1'], 'estimate: founders network, week-1 offer'),
 ('rebook', 'Clients rebooking within 3 months', S['rebook'], 'estimate: team budget $147-212/employee/yr (Teambonders via CustomInk)'),
 ('pilot_price', 'War Night pilot price $ (months 1-2)', S['pilot_price'], 'decision'),
 ('night_price', 'War Night price $ (up to 30 people)', S['night_price'], '$33/person vs Confetti-type $20-60/person (3rd-party)'),
 ('course_price', 'Course licence $ per section per semester', S['course_price'], 'vs GoVenture $29/student, Wharton $49, PersonalFinanceLab $595/yr/class'),
 ('course_pilot_price', 'Course pilot price $ (Jan-Feb 2027)', S['course_pilot_price'], 'decision'),
 ('club_price', 'Club League Kit $ per semester', S['club_price'], 'decision'),
 ('mau_keep', 'Share of last month MAU still active', (0.3,)*3, 'estimate'),
 ('matches_per_mau', 'Matches per active player per month', (6,)*3, 'estimate'),
 ('humans_per_match', 'Humans per match (rest are bots)', (3.3,)*3, 'estimate'),
 ('cost_match', 'Server + AI cost per match $', (0.0011,)*3, 'Durable Objects ~$0.001 (report 30 calc) + Haiku review $0.0001'),
 ('fixed_cost', 'Fixed infra $ per month', (50,)*3, 'VPS + Postgres $25 + news deck $5.4 (report 30)'),
 ('target', 'Target net revenue per month $', (8300,)*3, '$100k / 12'),
]
for name, label, vals, note in INPUTS:
    if vals is None: add(name, label, {}, note)
    else: add(name, label, {'B': vals[0], 'C': vals[1], 'D': vals[2]}, note)
r = R['pass_net']
for c in 'BCD':
    rows[r-1][2][c] = f"=(1-{c}{R['annual_share']})*({c}{R['pass_month']}-({c}{R['pass_month']}*{c}{R['fee_pct']}+{c}{R['fee_fix']}))+{c}{R['annual_share']}*({c}{R['pass_year']}-({c}{R['pass_year']}*{c}{R['fee_pct']}+{c}{R['fee_fix']}))/12"
for name, *_ in INPUTS:
    rows[R[name]-1][2]['E'] = f"=INDEX(B{R[name]}:D{R[name]},$B${R['scenario']})"
E = lambda name: f"$E${R[name]}"
add('blank2', '')
# --- monthly block
add('month', 'Month #', {'B': 'Year 1 total', **{col(m): m+1 for m in range(T)}})
add('cal', 'Calendar month', {col(m): MONTHS[m] for m in range(T)})
add('season', 'War Night seasonality (Dec x1.2, Jul-Aug x0.6)', {col(m): SEASON_B2B[m] for m in range(T)})
for sc in ['cautious', 'base', 'bold']:
    add(f'cs_{sc}', f'Course licences sold — {sc}', {col(m): COURSE_SALES[sc][m] for m in range(T)})
add('cs', 'Course licences sold — selected', {col(m): f"=INDEX({col(m)}{R['cs_cautious']}:{col(m)}{R['cs_bold']},$B${R['scenario']})" for m in range(T)})
add('cprice', 'Course price this month $', {col(m): f"=IF(OR({col(m)}{R['month']}=2,{col(m)}{R['month']}=3),{E('course_pilot_price')},{E('course_price')})" for m in range(T)})
for sc in ['cautious', 'base', 'bold']:
    add(f'ks_{sc}', f'Club kits sold — {sc}', {col(m): CLUB_SALES[sc][m] for m in range(T)})
add('ks', 'Club kits sold — selected', {col(m): f"=INDEX({col(m)}{R['ks_cautious']}:{col(m)}{R['ks_bold']},$B${R['scenario']})" for m in range(T)})
add('blank3', '')
add('hA', 'A. HOST PASS')
add('seed', 'Seeded new players', {col(m): (f"={E('seed_m1')}" if m == 0 else f"={E('seed_m2')}" if m == 1 else f"={col(m-1)}{len(rows)+1}*(1+{E('seed_growth')})") for m in range(T)})
add('newp', 'New players (seed + invites)', {col(m): (f"={col(m)}{R['seed']}" if m == 0 else f"={col(m)}{R['seed']}+{E('k')}*{col(m-1)}{len(rows)+1}") for m in range(T)})
add('newh', 'New hosts', {col(m): f"={col(m)}{R['newp']}*{E('host_share')}" for m in range(T)})
add('newpay', 'New paying hosts', {col(m): f"={col(m)}{R['newh']}*{E('host_conv')}" for m in range(T)})
add('payers', 'Paying hosts, end of month', {col(m): (f"={col(m)}{R['newpay']}" if m == 0 else f"={col(m-1)}{len(rows)+1}*(1-{E('payer_churn')})+{col(m)}{R['newpay']}") for m in range(T)})
add('revA_g', 'A gross $', {col(m): f"={col(m)}{R['payers']}*((1-{E('annual_share')})*{E('pass_month')}+{E('annual_share')}*{E('pass_year')}/12)" for m in range(T)})
add('revA', 'A net $', {col(m): f"={col(m)}{R['payers']}*{E('pass_net')}" for m in range(T)})
add('blank4', '')
add('hB', 'B. WAR NIGHT FOR TEAMS')
add('newc', 'New clients (first event)', {col(m): f"={E('outreach')}*{E('reply')}*{E('demo')}*{E('close')}*{col(m)}{R['season']}" + (f"+{E('warm_pilots')}" if m == 0 else '') for m in range(T)})
add('rep', 'Repeat events', {col(m): ('=0' if m < 3 else f"={E('rebook')}*({col(m-3)}{R['newc']}+{col(m-3)}{len(rows)+1})") for m in range(T)})
add('events', 'Events total', {col(m): f"={col(m)}{R['newc']}+{col(m)}{R['rep']}" for m in range(T)})
add('fprice', 'Price of a first event $', {col(m): f"=IF({col(m)}{R['month']}<=2,{E('pilot_price')},{E('night_price')})" for m in range(T)})
add('revB_g', 'B gross $', {col(m): f"={col(m)}{R['newc']}*{col(m)}{R['fprice']}+{col(m)}{R['rep']}*{E('night_price')}" for m in range(T)})
add('revB', 'B net $', {col(m): f"={col(m)}{R['newc']}*({col(m)}{R['fprice']}-({col(m)}{R['fprice']}*{E('fee_pct')}+{E('fee_fix')}))+{col(m)}{R['rep']}*({E('night_price')}-({E('night_price')}*{E('fee_pct')}+{E('fee_fix')}))" for m in range(T)})
add('blank5', '')
add('hC', 'C. COURSE AND CLUB LICENCES')
add('cg', 'Licence sales gross $ (cash)', {col(m): f"={col(m)}{R['cs']}*{col(m)}{R['cprice']}+{col(m)}{R['ks']}*{E('club_price')}" for m in range(T)})
add('cn', 'Licence sales net $ (cash)', {col(m): f"={col(m)}{R['cs']}*({col(m)}{R['cprice']}-({col(m)}{R['cprice']}*{E('fee_pct')}+{E('fee_fix')}))+{col(m)}{R['ks']}*({E('club_price')}-({E('club_price')}*{E('fee_pct')}+{E('fee_fix')}))" for m in range(T)})
add('revC_g', 'C gross recognised $ (spread over 4 months)', {col(m): f"=SUM({col(max(0,m-3))}{R['cg']}:{col(m)}{R['cg']})/4" for m in range(T)})
add('revC', 'C net recognised $', {col(m): f"=SUM({col(max(0,m-3))}{R['cn']}:{col(m)}{R['cn']})/4" for m in range(T)})
add('blank6', '')
add('hT', 'TOTALS')
add('gross', 'Gross revenue $', {col(m): f"={col(m)}{R['revA_g']}+{col(m)}{R['revB_g']}+{col(m)}{R['revC_g']}" for m in range(T)})
add('total', 'Net revenue $ (after payment fees)', {col(m): f"={col(m)}{R['revA']}+{col(m)}{R['revB']}+{col(m)}{R['revC']}" for m in range(T)})
add('fees', 'Payment fees $', {col(m): f"={col(m)}{R['gross']}-{col(m)}{R['total']}" for m in range(T)})
add('avg3', '3-month average of net revenue $', {col(m): (f"=AVERAGE({col(m-2)}{R['total']}:{col(m)}{R['total']})" if m >= 2 else '') for m in range(T)})
add('pace', 'On $8,300 pace (1 = yes)', {col(m): (f"=IF({col(m)}{R['avg3']}>={E('target')},1,0)" if m >= 2 else '=0') for m in range(T)})
add('mau', 'Monthly active players (estimate)', {col(m): (f"={col(m)}{R['newp']}" if m == 0 else f"={col(m)}{R['newp']}+{E('mau_keep')}*{col(m-1)}{len(rows)+1}") for m in range(T)})
add('matches', 'Matches per month', {col(m): f"={col(m)}{R['mau']}*{E('matches_per_mau')}/{E('humans_per_match')}" for m in range(T)})
add('infra', 'Server + AI + data cost $', {col(m): f"={E('fixed_cost')}+{col(m)}{R['matches']}*{E('cost_match')}" for m in range(T)})
add('costpp', 'Cost per active player $', {col(m): f"={col(m)}{R['infra']}/{col(m)}{R['mau']}" for m in range(T)})
add('after', 'Net revenue after infra $', {col(m): f"={col(m)}{R['total']}-{col(m)}{R['infra']}" for m in range(T)})
add('blank7', '')
add('hS', 'SUMMARY')
add('y1', 'Year-1 net revenue (Dec 2026 - Nov 2027) $', {'B': f"=SUM(C{R['total']}:{last12}{R['total']})"})
add('y1A', 'Year-1 share: Host Pass', {'B': f"=SUM(C{R['revA']}:{last12}{R['revA']})/B{R['y1']}"})
add('y1B', 'Year-1 share: War Night', {'B': f"=SUM(C{R['revB']}:{last12}{R['revB']})/B{R['y1']}"})
add('y1C', 'Year-1 share: licences', {'B': f"=SUM(C{R['revC']}:{last12}{R['revC']})/B{R['y1']}"})
add('m12', 'Net revenue in month 12 (Nov 2027) $', {'B': f"={last12}{R['total']}"})
add('m18', 'Net revenue in month 18 (May 2028) $', {'B': f"={col(T-1)}{R['total']}"})
add('first', 'First month on $8,300 pace (3-month average)', {'B': f'=IFERROR(INDEX(C{R["cal"]}:{col(T-1)}{R["cal"]},MATCH(1,C{R["pace"]}:{col(T-1)}{R["pace"]},0)),"not within 18 months")'})
add('feeshare', 'Year-1 payment fees as % of gross', {'B': f"=SUM(C{R['fees']}:{last12}{R['fees']})/SUM(C{R['gross']}:{last12}{R['gross']})"})
# Year-1 totals in column B for the main monthly rows
for name in ['newp','newpay','revA','newc','events','revB','revC','gross','total','fees','infra','after']:
    rows[R[name]-1][2]['B'] = f"=SUM(C{R[name]}:{last12}{R[name]})"

def write_xlsx(path, scenario):
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = 'Model'
    for i, (name, label, cells, note) in enumerate(rows, start=1):
        ws.cell(row=i, column=1, value=label)
        for c, v in cells.items():
            ws[f'{c}{i}'] = v
        if note: ws[f'F{i}'] = note
    ws['B2'] = scenario
    ws.column_dimensions['A'].width = 46
    wb.save(path)

def write_tsv(path):
    with open(path, 'w') as f:
        for i, (name, label, cells, note) in enumerate(rows, start=1):
            line = [label] + [''] * (FIRST + T - 2)
            for c, v in cells.items():
                idx = openpyxl.utils.column_index_from_string(c) - 1
                while len(line) <= idx: line.append('')
                line[idx] = str(v)
            if note:
                while len(line) < 6: line.append('')
                line[5] = note
            f.write('\t'.join(line).rstrip('\t') + '\n')

if __name__ == '__main__':
    for sc in (1, 2, 3): write_xlsx(f'm48_s{sc}.xlsx', sc)
    write_xlsx('48-money-model.xlsx', 2)
    write_tsv('48-money-model.tsv')
    import json; json.dump(R, open('rows.json', 'w'))
    print('rows', len(rows), 'total row', R['total'], 'summary rows', R['y1'], R['first'])
