// Тексты подсказок для экрана аналитики: одно поле — одна фраза по-английски.
// Нормы и источники — research/reports/04-analytics.md.
import type { Analytics } from '../../../shared/src/types';

export interface GlossaryEntry { label: string; tip: string }

export const GLOSSARY: Record<keyof Analytics, GlossaryEntry> = {
  month: { label: 'Month', tip: 'The game month these numbers belong to; one game month is one real day in the live city.' },
  daysIntoMonth: { label: 'Days into the month', tip: 'How many days of this month are behind us; sales and profit are projected to the full month from them.' },
  revenue: { label: 'Sales (this month, projected)', tip: 'Money customers pay you before any costs, projected to the full month from the days so far; sales tax is not included because it belongs to the state.' },
  profit: { label: 'Profit (this month, projected)', tip: 'What is left after cost of goods, wages, payroll taxes, rent, every monthly bill, estimated income tax and this month’s fines.' },
  cumulativeProfit: { label: 'Profit since opening', tip: 'All monthly profits added up since you opened, including the part of this month already behind you.' },
  netWorth: { label: 'Net worth', tip: 'Cash plus half the value of your equipment and furniture, minus taxes you owe — this is your score for the season.' },
  cogsPct: { label: 'Cost of goods, % of sales', tip: 'Ingredients and packaging as a share of sales; coffee shops usually run 25–35%.' },
  laborPct: { label: 'Labor, % of sales', tip: 'Wages plus payroll taxes as a share of sales; cafes usually run about 30–40%.' },
  rentPct: { label: 'Rent, % of sales', tip: 'Rent as a share of sales; a common rule of thumb is to keep it under 10%, and above 15% it starts to hurt.' },
  primeCostPct: { label: 'Prime cost, % of sales', tip: 'Cost of goods plus labor, the two costs you control every day; restaurants aim for about 60–65%, counter service lower.' },
  netMarginPct: { label: 'Net margin', tip: 'Profit as a share of sales; many cafes and restaurants keep only 3–7 cents of every dollar.' },
  fixedCostsMonth: { label: 'Fixed costs per month', tip: 'Costs you pay even on a day with no customers: rent, salaries, insurance, utilities and other monthly bills.' },
  variableCostPerUnit: { label: 'Variable cost per sale', tip: 'What one more sale costs you: ingredients, cup, card fee.' },
  contributionPerUnit: { label: 'Contribution per sale', tip: 'Price minus variable cost — the part of each sale that goes toward paying your fixed costs.' },
  breakEvenUnitsMonth: { label: 'Break-even sales per month', tip: 'How many sales a month cover all fixed costs: fixed costs divided by contribution per sale.' },
  breakEvenRevenueMonth: { label: 'Break-even sales in dollars', tip: 'The monthly sales in dollars at which you stop losing money.' },
  breakEvenPrice: { label: 'Break-even price', tip: 'The lowest price that still covers all costs if you keep selling as many as you do now.' },
  utilization: { label: 'Staff busy', tip: 'Sales divided by what your team could serve; under 60% you pay for idle hands, near 100% customers wait.' },
  sizeUtilization: { label: 'Room full', tip: 'How full your seats are on average; very full means a line and lost customers, nearly empty means paying for space nobody uses.' },
  lostSalesUnits: { label: 'Customers turned away', tip: 'Customers who wanted to buy but left because there was no seat, no free hands or you were closed.' },
  lostSalesMoney: { label: 'Sales turned away', tip: 'What those turned-away customers would have paid you.' },
  cashRunwayMonths: { label: 'Cash runway', tip: 'How many months your cash lasts at the current loss; empty when you are making money — the median small restaurant holds only about 16 days of cash.' },
  setupInvested: { label: 'Invested to open', tip: 'Everything you spent before opening: equipment, furniture, build-out, deposit and permits.' },
  paybackMonths: { label: 'Payback period', tip: 'Months of current profit needed to earn back what you invested to open; empty while you are losing money.' },
  taxDueNext: { label: 'Next tax payment', tip: 'The next tax bill and its due day; New York sales tax is filed every quarter, 20 days after the quarter ends.' },
  exposure: { label: 'Risk if inspected', tip: 'The fines you would owe today if inspectors found every corner you are cutting; they grow every month it continues.' },
  benchmarks: { label: 'You vs the industry', tip: 'Your cost shares and margin next to typical numbers for this kind of business.' },
  nicheKpis: { label: 'Key numbers', tip: 'The numbers owners of this kind of business watch daily: average ticket, sales per day, seat turnover, sales per square foot and per labor hour.' },
};
