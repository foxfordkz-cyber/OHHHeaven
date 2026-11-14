# Season balance — 40 owners, 3 officials, 200 seasons, seed 1
engine: stub, data: stub

## Q1. Prize places (top 3 of each niche) and bankruptcies by character
| character | owner-seasons | share of prize places | prize rate | bankrupt | mean net worth | mean fines | mean savings |
|---|---|---|---|---|---|---|---|
| premium | 800 | 25.0% | 37.5% | 49.9% | $32,108 | $0 | $0 |
| honest | 800 | 20.0% | 30.0% | 0.0% | $48,061 | $0 | $0 |
| unreliable | 600 | 14.7% | 29.3% | 0.0% | $47,357 | $0 | $0 |
| complainer | 800 | 14.5% | 21.8% | 0.1% | $44,647 | $3,225 | $0 |
| social | 600 | 12.8% | 25.7% | 0.0% | $47,609 | $0 | $0 |
| newbie | 600 | 11.8% | 23.7% | 30.8% | $31,830 | $1,111 | $0 |
| cut_taxes | 800 | 1.2% | 1.8% | 3.0% | $26,879 | $31,749 | $22,453 |
| cut_all | 800 | 0.0% | 0.0% | 66.8% | $4,886 | $41,659 | $24,594 |
| cut_bribe | 800 | 0.0% | 0.0% | 100.0% | $0 | $53,797 | $16,474 |
| dumper | 800 | 0.0% | 0.0% | 23.9% | $24,336 | $0 | $0 |
| manager | 600 | 0.0% | 0.0% | 78.3% | $3,042 | $0 | $0 |

check: max share premium 25.0% (target ≤ 35%) → OK; cut_all bankrupt 66.8% vs honest 0.0% → OK

## Q2. Net worth of cheaters minus honest, by detection channel and frequency
| detection | complainers | cut_all − honest | cut_taxes − honest | cut_all bankrupt | cut_taxes caught |
|---|---|---|---|---|---|
| tax flags on, health routine every 12 mo | 0% (0) | $-21,516 | $-10,882 | 26.7% | 100.0% |
| tax flags on, health routine every 12 mo | 15% (6) | $-28,735 | $-9,687 | 43.3% | 100.0% |
| tax flags on, health routine every 12 mo | 30% (12) | $-29,398 | $-6,288 | 61.7% | 100.0% |
| tax flags on, health routine every 6 mo | 0% (0) | $-32,336 | $-10,694 | 46.7% | 100.0% |
| tax flags on, health routine every 6 mo | 15% (6) | $-33,768 | $-10,151 | 63.3% | 100.0% |
| tax flags on, health routine every 6 mo | 30% (12) | $-32,459 | $-8,257 | 76.7% | 100.0% |
| no tax flags, health routine every 6 mo | 0% (0) | $15,919 | $25,811 | 1.7% | 0.0% |
| no tax flags, health routine every 6 mo | 30% (12) | $15,741 | $32,214 | 5.0% | 0.0% |
| no tax flags, routine tax audit every 6 mo | 15% (6) | $-11,420 | $7,974 | 25.0% | 100.0% |
| no tax flags, routine tax audit every 4 mo | 15% (6) | $-21,535 | $-153 | 33.3% | 100.0% |
| no tax flags, routine tax audit every 3 mo | 15% (6) | $-31,920 | $-7,596 | 51.7% | 100.0% |
| no tax flags, routine tax audit every 2 mo | 15% (6) | $-40,909 | $-17,337 | 86.7% | 100.0% |

## Q3. Honest newbies bankrupt within the season, by startCapital
baseline (main run): newbie bankrupt 30.8%, honest 0.0%

| startCapital | barbershop: newbie bankrupt | cafe: newbie bankrupt | honest bankrupt |
|---|---|---|---|
| ×0.6 | $30,000: 30.8% | $45,000: 100.0% | 87.9% |
| ×0.75 | $37,500: 36.7% | $56,250: 56.7% | 42.5% |
| ×0.9 | $45,000: 20.0% | $67,500: 46.7% | 2.5% |
| ×1 | $50,000: 22.5% | $75,000: 39.2% | 0.0% |
| ×1.2 | $60,000: 18.3% | $90,000: 26.7% | 0.0% |

pick for barbershop: startCapital $50,000 (×1) → newbies bankrupt 22.5% (target 15–30%)
pick for cafe: startCapital $90,000 (×1.2) → newbies bankrupt 26.7% (target 15–30%)

## Q4. Cash wages: net worth minus honest twin, by pctOfSaved of off_books_payroll
| pctOfSaved | saved per season | fines per season | caught at least once | net worth vs honest | bankrupt |
|---|---|---|---|---|---|
| 0 | $9,446 | $2,000 | 100.0% | $9,441 | 0.0% |
| 0.5 | $9,443 | $6,141 | 100.0% | $5,530 | 0.0% |
| 1 | $9,409 | $10,232 | 100.0% | $2,190 | 0.0% |
| 1.5 | $9,532 | $14,499 | 100.0% | $-2,424 | 1.3% |
| 2 | $9,422 | $18,496 | 100.0% | $-5,923 | 1.9% |
| 3 | $9,309 | $26,399 | 100.0% | $-14,124 | 12.5% |

zero expected value at pctOfSaved ≈ 1.24

## Q5. Complaints
| main run | mean net worth | prize rate | mean fines (false reports) |
|---|---|---|---|
| complainer | $44,647 | 21.8% | $3,225 |
| honest | $48,061 | 30.0% | $0 |

| complainers | their net worth | their fines | niche leaders (rank 1) net worth | everyone else | complainer prize rate |
|---|---|---|---|---|---|
| report only when suspicious | $43,348 | $1,580 | $68,505 | $37,536 | 18.0% |
| harass the leader weekly | $24,490 | $22,530 | $67,012 | $37,792 | 1.0% |

## Q6. Deals: social owner vs a loner who refuses every deal (same mix of neighbours)
| rules | social net worth | honest (accepts offers) | loner (refuses all) | social ahead of loner | honest ahead of loner |
|---|---|---|---|---|---|
| current rules | $43,982 | $44,117 | $45,550 | -3.4% | -3.1% |
| block fund threshold 0.6 → 0.4 | $45,814 | $45,861 | $47,670 | -3.9% | -3.8% |
| block fund fee $300 → $150 | $45,993 | $44,135 | $45,551 | 1.0% | -3.1% |
| cross promo demand 1.06 → 1.12 | $46,272 | $44,295 | $45,731 | 1.2% | -3.1% |
| joint purchase 0.94 → 0.90 + cross promo 1.10 | $47,313 | $44,305 | $45,648 | 3.6% | -2.9% |
| cross promo price 0.98 → 1.00 | $46,559 | $45,255 | $45,855 | 1.5% | -1.3% |
| joint 0.90, cross 1.10 at price 1.00, fund fee $150 | $51,771 | $45,679 | $46,135 | 12.2% | -1.0% |

## Q7. Monthly profit by room size (months 2–4, honest orders, 9 standard competitors)
### barbershop
| chairs | prime | mid | cheap |
|---|---|---|---|
| 2 | $-7,086 | $-1,697 | $-1,057 |
| 3 | $-3,625 | $2,941 | $2,998 |
| 4 | $-225 | $3,491 | $2,959 |
| 5 | $-264 | $3,452 | $2,920 |
| 6 | $-304 | $3,413 | $2,881 |
| 7 | $-343 | $3,374 | $2,547 |
| 8 | $-382 | $3,079 | $922 |
| 9 | $-421 | $1,532 | $709 |
| 10 | $-852 | $1,300 | $670 |

- prime (1040 sq ft, fits 10): best 4 chairs, $-225/mo, inner optimum
- mid (1040 sq ft, fits 10): best 4 chairs, $3,491/mo, inner optimum
- cheap (1040 sq ft, fits 10): best 3 chairs, $2,998/mo, inner optimum

### cafe
| seats | prime | mid | cheap |
|---|---|---|---|
| 6 | $-17,486 | $-11,853 | $-7,502 |
| 9 | $-14,044 | $-8,411 | $-6,677 |
| 12 | $-13,220 | $-4,969 | $-3,235 |
| 15 | $-9,778 | $-1,527 | $78 |
| 18 | $-6,336 | $1,711 | $2,255 |
| 21 | $-2,928 | $1,100 | $1,968 |
| 24 | $174 | $3,350 | $2,683 |
| 27 | $-904 | $4,576 | $3,173 |
| 30 | $1,310 | $5,157 | $3,129 |
| 33 | $3,315 | $5,113 | $3,084 |
| 36 | — | — | — |
| 39 | — | — | — |

- prime (1040 sq ft, fits 34): best 33 seats, $3,315/mo, edge
- mid (1040 sq ft, fits 34): best 30 seats, $5,157/mo, inner optimum
- cheap (1040 sq ft, fits 34): best 27 seats, $3,173/mo, inner optimum

## Q8. Do weather and events decide the places? Same seasons with flat weather and no events
| seasons compared | rank correlation (Spearman) | prize winners unchanged | mean rank move |
|---|---|---|---|
| 40 | 0.950 | 81.7% | 1.14 |

## Q9. Owner who logs in once a game month with a manager vs one who plays every day
| setup | manager-run net worth | manager-run bankrupt | daily player net worth | daily player bankrupt |
|---|---|---|---|---|
| main run (pack manager salary) | $3,042 | 78.3% | $48,061 | 0.0% |
| manager salary ×0.5 ($2,250 / $2,750) | $24,459 | 17.5% | $45,350 | 0.0% |
| manager salary ×0.25 ($1,125 / $1,375) | $37,723 | 0.0% | $45,992 | 0.0% |

done in 71.4 s
