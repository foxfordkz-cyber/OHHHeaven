# Researcher 48 revenue model (Python mirror of the spreadsheet formulas)
MONTHS = ['Dec 26','Jan 27','Feb 27','Mar 27','Apr 27','May 27','Jun 27','Jul 27','Aug 27','Sep 27','Oct 27','Nov 27','Dec 27','Jan 28','Feb 28','Mar 28','Apr 28','May 28']
T = len(MONTHS)
FEE_PCT, FEE_FIX = 0.05, 0.50
def net(p): return p - (p*FEE_PCT + FEE_FIX)
S = {
 # name: (cautious, base, bold)
 'seed_m1': (1500, 3000, 5000), 'seed_m2': (1000, 1500, 2000), 'seed_growth': (0.05, 0.15, 0.20),
 'k': (0.30, 0.45, 0.55), 'host_share': (0.30, 0.30, 0.30), 'host_conv': (0.03, 0.05, 0.07), 'payer_churn': (0.18, 0.12, 0.09),
 'annual_share': (0.40, 0.40, 0.40), 'pass_month': (4.99,)*3, 'pass_year': (39.99,)*3,
 'outreach': (200, 300, 400), 'reply': (0.03, 0.04, 0.045), 'demo': (0.5, 0.5, 0.5), 'close': (0.20, 0.30, 0.35),
 'warm_pilots_m1': (1, 3, 4), 'rebook': (0.35, 0.50, 0.55), 'pilot_price': (490,)*3, 'night_price': (990,)*3,
 'course_price': (399,)*3, 'course_pilot_price': (99,)*3, 'club_price': (99,)*3,
}
SEASON_B2B = [1.2,1,1,1,1,1,1,0.6,0.6,1,1,1, 1.2,1,1,1,1,1]
COURSE_SALES = {  # licences sold per month: cautious, base, bold
 'cautious': [0,1,1,0,0,0,0,0,5,5,0,0, 0,3,2,0,0,0], 'base': [0,3,2,0,0,0,2,0,12,12,0,0, 0,10,6,0,0,0], 'bold': [0,6,3,0,0,0,4,0,22,22,0,0, 0,18,10,0,0,0]}
COURSE_PILOT_MONTHS = {1,2}   # Jan-Feb 2027 (index) sold at $99 pilot price
CLUB_SALES = {'cautious': [0,1,1,1,1,1,0,0,0,1,1,1, 0,1,1,1,1,1], 'base': [1,3,3,3,3,3,1,1,1,3,3,3, 1,3,3,3,3,3], 'bold': [2,5,5,5,5,5,2,2,2,5,5,5, 2,5,5,5,5,5]}

def run(sc):
    i = ['cautious','base','bold'].index(sc)
    g = {k: v[i] for k, v in S.items()}
    pass_net = (1-g['annual_share'])*net(g['pass_month']) + g['annual_share']*net(g['pass_year'])/12
    rows = {k: [] for k in ['seed','new_players','new_hosts','new_payers','payers','revA','new_clients','repeat','events','revB','courses_rec','clubs_rec','revC','total']}
    for m in range(T):
        seed = g['seed_m1'] if m == 0 else (g['seed_m2'] if m == 1 else rows['seed'][-1]*(1+g['seed_growth']))
        newp = seed + (g['k']*rows['new_players'][-1] if m else 0)
        nh = newp*g['host_share']; npay = nh*g['host_conv']
        pay = (rows['payers'][-1]*(1-g['payer_churn']) if m else 0) + npay
        revA = pay*pass_net
        nc = g['outreach']*g['reply']*g['demo']*g['close']*SEASON_B2B[m] + (g['warm_pilots_m1'] if m == 0 else 0)
        rep = g['rebook']*(rows['new_clients'][m-3] + rows['repeat'][m-3]) if m >= 3 else 0
        ev = nc + rep
        price_new = g['pilot_price'] if m <= 1 else g['night_price']
        revB = nc*net(price_new) + rep*net(g['night_price'])
        # licences recognised over 4 months
        def rec(sales, price_fn):
            return sum(sales[j]*net(price_fn(j)) for j in range(max(0,m-3), m+1))/4
        crec = rec(COURSE_SALES[sc], lambda j: g['course_pilot_price'] if j in COURSE_PILOT_MONTHS else g['course_price'])
        krec = rec(CLUB_SALES[sc], lambda j: g['club_price'])
        revC = crec + krec
        for k, v in zip(rows.keys(), [seed,newp,nh,npay,pay,revA,nc,rep,ev,revB,crec,krec,revC,revA+revB+revC]): rows[k].append(v)
    return g, pass_net, rows

if __name__ == '__main__':
    for sc in ['cautious','base','bold']:
        g, pn, r = run(sc)
        hit = next((MONTHS[m] + f' (M{m+1})' for m, t in enumerate(r['total']) if t >= 8300), 'not in 12 months')
        print(f'== {sc}: pass net/mo ${pn:.3f}; hits $8,300 in {hit}; year-1 total ${sum(r["total"][:12]):,.0f}; months 13-18 ${sum(r["total"][12:]):,.0f}')
        for k in ['new_players','payers','revA','events','revB','revC','total']:
            print(f'  {k:12s}', ' '.join(f'{v:7.0f}' for v in r[k]))
