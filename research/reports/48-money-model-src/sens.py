import copy, model
from model import run, MONTHS, S, COURSE_SALES, CLUB_SALES
def sustained(tot):
    for m in range(2, len(tot)):
        if sum(tot[m-2:m+1])/3 >= 8300: return f'{MONTHS[m]} (M{m+1})'
    return 'not in 18 mo'
def summary(label):
    g, pn, r = run('base')
    t = r['total']
    shares = {k: sum(r[k][:12]) for k in ['revA','revB','revC']}
    tot12 = sum(t[:12])
    print(f'{label:42s} Y1 ${tot12:8,.0f}  M12 ${t[11]:6,.0f}  M18 ${t[17]:6,.0f}  sustained8.3k {sustained(t):16s} shares A {shares["revA"]/tot12:4.0%} B {shares["revB"]/tot12:4.0%} C {shares["revC"]/tot12:4.0%}')
    return tot12, t[17]
for sc in ['cautious','base','bold']:
    g, pn, r = run(sc); t = r['total']
    print(f'{sc:9s} Y1 ${sum(t[:12]):9,.0f}  M12 ${t[11]:7,.0f}  M18 ${t[17]:7,.0f}  sustained {sustained(t)}  Y1 shares A {sum(r["revA"][:12])/sum(t[:12]):.0%} B {sum(r["revB"][:12])/sum(t[:12]):.0%} C {sum(r["revC"][:12])/sum(t[:12]):.0%}')
print()
base_y1, base_m18 = summary('BASE')
orig = copy.deepcopy(S); origC = copy.deepcopy(COURSE_SALES); origK = copy.deepcopy(CLUB_SALES)
def tweak(key, fn, label):
    S[key] = tuple(fn(v) for v in orig[key]); y1, m18 = summary(label); S[key] = orig[key]
    return label, y1 - base_y1, m18 - base_m18
res = []
res.append(tweak('host_conv', lambda v: v/2, 'host conversion halved (5% -> 2.5%)'))
res.append(tweak('payer_churn', lambda v: v*2, 'payer churn doubled (12% -> 24%)'))
res.append(tweak('k', lambda v: v/2, 'viral k halved (0.45 -> 0.225)'))
res.append(tweak('seed_growth', lambda v: v/2, 'seed growth halved (15% -> 7.5%/mo)'))
res.append(tweak('close', lambda v: v/2, 'War Night close rate halved (30% -> 15%)'))
res.append(tweak('rebook', lambda v: v/2, 'War Night rebook halved (50% -> 25%)'))
res.append(tweak('night_price', lambda v: v/2, 'War Night price halved ($990 -> $495)'))
for sc in COURSE_SALES: COURSE_SALES[sc] = [x/2 for x in origC[sc]]
for sc in CLUB_SALES: CLUB_SALES[sc] = [x/2 for x in origK[sc]]
y1, m18 = summary('course + club sales halved'); res.append(('course + club sales halved', y1-base_y1, m18-base_m18))
for sc in COURSE_SALES: COURSE_SALES[sc] = origC[sc]
for sc in CLUB_SALES: CLUB_SALES[sc] = origK[sc]
print('\nRanked by year-1 impact:')
for l, d1, d18 in sorted(res, key=lambda x: x[1]): print(f'  {l:42s} dY1 ${d1:8,.0f}   dM18 ${d18:7,.0f}')
