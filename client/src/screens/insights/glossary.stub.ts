// Tap-to-explain texts for every number on the Insights tab. Stand-in for agent 04's
// engine/src/analytics/glossary.ts: when it lands, glossary.ts prefers its texts and falls back to these.
export interface GlossaryEntry { title: string; what: string; why: string }

export const GLOSSARY_STUB: Record<string, GlossaryEntry> = {
  profit: { title: 'Profit this month', what: 'Sales minus every cost of the month, projected to day 30 from the days so far.', why: 'Profit, not sales, is what pays you back and keeps the doors open.' },
  cash: { title: 'Cash', what: 'Money in the bank right now, including sales tax you collected and still owe the state.', why: 'Businesses close when cash runs out, even profitable ones.' },
  runway: { title: 'Cash runway', what: 'How many months your cash lasts if you keep losing money at this rate.', why: 'Under two months means one bad month can close you: act now, not next month.' },
  payback: { title: 'Payback', what: 'How many months of this profit it takes to earn back the money you put in to open.', why: 'Small cafes that pay back within two years are usually worth the risk; beyond that, the savings are at risk.' },
  breakEven: { title: 'Break-even', what: 'The number of sales a month at which sales cover all fixed costs. Below it you lose money, above it you earn.', why: 'It turns a vague goal into a daily target you can check every evening.' },
  fixedCostsMonth: { title: 'Fixed costs', what: 'Costs you pay no matter how much you sell: rent, scheduled wages, insurance, utilities.', why: 'They set the bar your sales must clear every month.' },
  variableCostPerUnit: { title: 'Cost of one sale', what: 'What one sale costs you in ingredients, cups and card fees.', why: 'Price minus this is what each sale adds toward your fixed costs.' },
  contributionPerUnit: { title: 'Contribution per sale', what: 'Price minus the cost of one sale.', why: 'Fixed costs ÷ contribution = sales you need to break even.' },
  costMix: { title: 'Where your money goes', what: 'Each cost as a share of all costs last month.', why: 'One oversized slice — usually rent or labor — is where to look first.' },
  benchmarks: { title: 'Against the industry', what: 'Your cost shares of sales next to typical shares for this kind of business.', why: 'Shares far above the norm are the usual reason small shops fail.' },
  cogsPct: { title: 'Cost of sales', what: 'Ingredients and supplies as a share of sales.', why: 'High means the price is too low or there is waste.' },
  laborPct: { title: 'Labor', what: 'Wages and payroll taxes as a share of sales.', why: 'It is the cost you control every week through the schedule.' },
  rentPct: { title: 'Rent', what: 'Rent as a share of sales.', why: 'Rent is fixed for years: a share above the norm rarely fixes itself.' },
  netMarginPct: { title: 'Net margin', what: 'Profit as a share of sales.', why: 'It tells you how much of every dollar you keep.' },
  trend: { title: 'Month by month', what: 'Sales, profit and cash at the end of each month; the last point is this month’s forecast.', why: 'The direction matters more than any single month.' },
  utilization: { title: 'Staff load', what: 'Sales served as a share of what your staff could serve.', why: 'Near 100% means people walk out; far below means you pay for idle hours.' },
  sizeUtilization: { title: 'Seats in use', what: 'Sales served as a share of what your room can handle.', why: 'A full room turns customers away; an empty one drives reputation down.' },
  lostSales: { title: 'Lost sales', what: 'Customers who wanted to buy but left, with the reason and the money they would have spent.', why: 'It is the cheapest growth: the demand is already at your door.' },
  taxes: { title: 'Taxes ahead', what: 'Tax you owe, when it is due, and whether today’s cash covers it.', why: 'Sales tax you collect belongs to the state; spending it is how shops end up in debt.' },
  exposure: { title: 'Fines if found', what: 'What all your current violations would cost if an inspector or auditor found them today.', why: 'Compare it with what cutting corners saved you: usually the fine is bigger.' },
  savings: { title: 'Saved by cutting corners', what: 'Money you kept by breaking rules that have not been found yet.', why: 'It is not yours to keep until the trail goes cold.' },
  nicheKpis: { title: 'Your niche numbers', what: 'The few numbers owners in this niche watch every day.', why: 'They show trouble before it reaches the bank account.' },
};
