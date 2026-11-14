import openpyxl
from openpyxl.utils import get_column_letter as L
from model import MONTHS, SEASON_B2B, COURSE_SALES, CLUB_SALES
T = 12
col = lambda m: L(2 + m)  # B..M
rows, R = [], {}
def add(name, label, cells=None):
    rows.append((label, cells or {})); R[name] = len(rows)
add('t', 'Street War revenue model, base scenario (net of Paddle 5% + $0.50). Paste into cell A1.')
add('h', 'INPUTS (edit column B)')
inputs = [('fee_pct','Payment fee %',0.05),('fee_fix','Payment fee fixed $',0.5),('pm','Host Pass $ per month',4.99),('py','Host Pass $ per year',39.99),
 ('ann','Share of payers on annual plan',0.4),('pnet','Host Pass net $ per payer per month',None),('s1','Seeded new players, month 1',3000),('s2','Seeded new players, month 2',1500),
 ('sg','Seed growth per month from month 3',0.15),('k','Invited new players per new player',0.45),('hs','Share of new players who host',0.3),('hc','Host -> Host Pass conversion',0.05),
 ('ch','Paying host churn per month',0.12),('out','War Night prospects per month',300),('rr','Reply rate',0.04),('dm','Reply -> call',0.5),('cl','Call -> paid',0.3),
 ('wp','Warm pilots in month 1',3),('rb','Rebook within 3 months',0.5),('pp','War Night pilot price $ (months 1-2)',490),('np','War Night price $',990),
 ('cp','Course licence $ per semester',399),('cpp','Course pilot price $ (months 2-3)',99),('kp','Club kit $ per semester',99),('tg','Target net revenue per month $',8300)]
for n, lab, v in inputs: add(n, lab, {'B': v} if v is not None else {})
B = lambda n: f'$B${R[n]}'
rows[R['pnet']-1][1]['B'] = f"=(1-{B('ann')})*({B('pm')}-({B('pm')}*{B('fee_pct')}+{B('fee_fix')}))+{B('ann')}*({B('py')}-({B('py')}*{B('fee_pct')}+{B('fee_fix')}))/12"
add('b0', '')
add('mo', 'Month #', {col(m): m+1 for m in range(T)})
add('cal', 'Calendar', {col(m): MONTHS[m] for m in range(T)})
add('se', 'War Night seasonality', {col(m): SEASON_B2B[m] for m in range(T)})
add('cs', 'Course licences sold', {col(m): COURSE_SALES['base'][m] for m in range(T)})
add('cpr', 'Course price this month $', {col(m): f"=IF(OR({col(m)}{R['mo']}=2,{col(m)}{R['mo']}=3),{B('cpp')},{B('cp')})" for m in range(T)})
add('ks', 'Club kits sold', {col(m): CLUB_SALES['base'][m] for m in range(T)})
add('b1', '')
add('seed', 'A. Seeded new players', {col(m): (f"={B('s1')}" if m == 0 else f"={B('s2')}" if m == 1 else f"={col(m-1)}{len(rows)+1}*(1+{B('sg')})") for m in range(T)})
add('np_', 'A. New players (seed + invites)', {col(m): (f"={col(m)}{R['seed']}" if m == 0 else f"={col(m)}{R['seed']}+{B('k')}*{col(m-1)}{len(rows)+1}") for m in range(T)})
add('npay', 'A. New paying hosts', {col(m): f"={col(m)}{R['np_']}*{B('hs')}*{B('hc')}" for m in range(T)})
add('pay', 'A. Paying hosts, end of month', {col(m): (f"={col(m)}{R['npay']}" if m == 0 else f"={col(m-1)}{len(rows)+1}*(1-{B('ch')})+{col(m)}{R['npay']}") for m in range(T)})
add('A', 'A. Host Pass net $', {col(m): f"={col(m)}{R['pay']}*{B('pnet')}" for m in range(T)})
add('nc', 'B. New War Night clients', {col(m): f"={B('out')}*{B('rr')}*{B('dm')}*{B('cl')}*{col(m)}{R['se']}" + (f"+{B('wp')}" if m == 0 else '') for m in range(T)})
add('rp', 'B. Repeat War Nights', {col(m): ('=0' if m < 3 else f"={B('rb')}*({col(m-3)}{R['nc']}+{col(m-3)}{len(rows)+1})") for m in range(T)})
add('Bn', 'B. War Night net $', {col(m): (f"={col(m)}{R['nc']}*(IF({col(m)}{R['mo']}<=2,{B('pp')},{B('np')})*(1-{B('fee_pct')})-{B('fee_fix')})+{col(m)}{R['rp']}*({B('np')}*(1-{B('fee_pct')})-{B('fee_fix')})") for m in range(T)})
add('cn', 'C. Licence sales net $ (cash)', {col(m): f"={col(m)}{R['cs']}*({col(m)}{R['cpr']}*(1-{B('fee_pct')})-{B('fee_fix')})+{col(m)}{R['ks']}*({B('kp')}*(1-{B('fee_pct')})-{B('fee_fix')})" for m in range(T)})
add('Cn', 'C. Licences net $ (spread over 4 months)', {col(m): f"=SUM({col(max(0,m-3))}{R['cn']}:{col(m)}{R['cn']})/4" for m in range(T)})
add('tot', 'TOTAL net revenue $', {col(m): f"={col(m)}{R['A']}+{col(m)}{R['Bn']}+{col(m)}{R['Cn']}" for m in range(T)})
add('avg', '3-month average $', {col(m): (f"=AVERAGE({col(m-2)}{R['tot']}:{col(m)}{R['tot']})" if m >= 2 else '') for m in range(T)})
add('y1', 'Year-1 net revenue $', {'B': f"=SUM(B{R['tot']}:M{R['tot']})"})
add('gap', 'Month-12 gap to target $', {'B': f"={B('tg')}-M{R['tot']}"})
def tsv():
    out = []
    for label, cells in rows:
        line = [label] + [''] * 12
        for c, v in cells.items():
            idx = openpyxl.utils.column_index_from_string(c) - 1
            line[idx] = str(v)
        out.append('\t'.join(line).rstrip('\t'))
    return '\n'.join(out) + '\n'
wb = openpyxl.Workbook(); ws = wb.active; ws.title = 'Model'
for i, (label, cells) in enumerate(rows, start=1):
    ws.cell(row=i, column=1, value=label)
    for c, v in cells.items(): ws[f'{c}{i}'] = v
wb.save('compact.xlsx')
open('48-money-model-compact.tsv', 'w').write(tsv())
import json; json.dump(R, open('rows_compact.json', 'w'))
print(len(rows), 'rows')
