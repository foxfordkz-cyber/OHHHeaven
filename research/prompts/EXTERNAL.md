# Промпты для GPT Pro и Gemini Pro (репозиторий не видят — копировать целиком)

Ведущий, 14 ноября 2026, 10:50 UTC. Включить режим Deep Research. E2 помогает агенту 12 (кафе), E4 — агентам 13 и 14 (остальные ниши), E1 и E3 — питчу. Ответ сохранить в `research/full/` под именем из заголовка: вставить текст в файл и закоммитить или прислать ведущему.

## E1 — Gemini Deep Research (пользователь) → `research/full/E1-gemini-law.md`

```text
Deep research, answer in Russian, every claim with a primary-source link (statutes, court opinions, regulator pages, company terms).
We are building a multiplayer business-simulation game for US adults 21–45, set in New York City. Players pay a $5 entry fee per season; fees form a city prize pool; the top players split 90% by a pre-announced payout table; outcome is decided by skill (pricing, staffing, compliance decisions), not by random draws.
1) Is a paid-entry skill tournament with cash prizes legal in New York State (NY Penal Law 225.00, "material degree" chance test, White v. Cuomo 2022)? In which US states do Skillz, Papaya Gaming, Triumph and WorldWinner NOT offer cash tournaments, and why?
2) What do Stripe, PayPal, Apple App Store and Google Play rules say about real-money skill games? Which payment processors serve them?
3) Lawsuits and FTC actions against Skillz, Papaya and similar apps (bots, deceptive matching) and the lessons.
4) Alternative: free entry with sponsor-funded prizes (NY GBL 369-e registration and bonding over $5,000). Requirements and costs.
5) Recommend one launch structure and give a 60-word English answer to a judge asking "Isn't this gambling?".
Mark anything you could not verify. This is research, not legal advice.
```

## E2 — GPT Pro Deep Research (пользователь) → `research/full/E2-gpt-nyc-cafe-costs.md`

```text
Deep research, answer in Russian with tables, every number with a primary or reputable source link and the year.
What does it really cost to open and run a small independent coffee shop (15–25 seats, about 800 sq ft) in New York City in 2026? I need a complete A-to-Z list:
1) Before opening: lease deposit, build-out per sq ft, furniture and equipment item by item with prices, initial inventory, LLC formation and publication, insurance, every required permit and license (DOHMH food service establishment permit, Food Protection Certificate, sign permits, sidewalk cafe / Dining Out NYC and others) with fees and waiting times.
2) Every month: retail rent per sq ft by neighborhood (prime Manhattan, mid Brooklyn, cheaper Queens), utilities, insurance, supplies, cleaning, pest control, commercial waste, POS and card fees, accounting, marketing.
3) Staff: 2026 NYC minimum wage, tipped cash wage and tip credit for food service, employer payroll taxes (FICA, FUTA, NY SUI, MCTMT), workers' comp, paid sick leave.
4) Taxes: sales tax rules for coffee and food, Commercial Rent Tax, NYC Unincorporated Business Tax.
5) Typical monthly P&L: customers per day, average ticket, COGS %, labor %, rent %, net margin.
6) The most common ways owners illegally cut costs (cash wages off the books, underreporting cash sales, skipping pest control and cleaning, no Food Protection Certificate) and the real penalties for each (statute, fine amounts, who audits).
Mark estimates clearly.
```

## E3 — GPT Pro Deep Research (напарник) → `research/full/E3-gpt-pain-competitors.md`

```text
Deep research, answer in Russian, every number with a primary-source link opened today.
Product: a multiplayer game where US adults 21–45 run a realistic small business in New York City (real rent, permits, payroll, taxes, inspections), compete for a prize pool, and can cut corners at the risk of being caught by other players acting as inspectors.
1) Evidence of the pain: how many Americans want to start a business versus actually start (Gallup, Census Business Formation Statistics, Kauffman, SBA Office of Advocacy); survival rates by year (BLS); top reasons for failure; financial literacy levels (FINRA NFCS, TIAA P-Fin Index).
2) Narrow to ONE user and ONE pain (the hackathon rule): propose three candidates and pick one.
3) Competitors table: Big Ambitions, Venture Valley, Capsim, Marketplace Simulations, Cashflow (Rich Dad), Coffee Inc 2, Monopoly GO, Landlord GO, Upland, Skillz games: price, audience, revenue if known, what they lack.
4) Which hackathon track fits best: MONEY ("Where does money hurt?"), ENTERTAINMENT ("What makes downtime feel wasted?") or SKILLS ("What do people fail to master?"), and why. The organizer is Zimran (global B2C lifestyle and EdTech apps such as Finelo).
5) Willingness to pay: prices of business simulations, courses and paid skill-game entries.
Discard any number you could not confirm.
```

## E4 — Gemini Deep Research (напарник) → `research/full/E4-gemini-four-niches.md`

```text
Deep research, answer in Russian with tables, every number with a source link and year.
For each of these four small businesses in New York City in 2026: (a) barbershop with 3–5 chairs, (b) bodega / deli grocery, (c) small guesthouse or legal short-term rental, (d) small landlord with a 4–8 unit building, give:
1) All required licenses and registrations with agency, fee, renewal period and penalty for operating without one.
2) Startup costs item by item (furniture, equipment, deposit, build-out, inventory).
3) Monthly costs and a typical monthly P&L.
4) The inspecting agencies, what they check, and the fine schedule for the 10 most common violations.
5) The most common illegal shortcuts owners take to earn more (unlicensed staff, cash off the books, selling tobacco to under-21, unregistered short-term rentals under Local Law 18, cutting heat, illegal basement units, oversize security deposits) and the real penalty for each with the statute.
Mark estimates clearly.
```

## E5 — GPT Pro (пользователь): питч, деньги и вопросы жюри → `docs/pitch/gpt-pitch.md`

```text
You are the pitch coach for a two-person student team at a 24-hour product hackathon (Business Cup 2.0, Astana; organizer Zimran, a company that builds global B2C apps and cares about one clear user, one pain, a working product, retention and monetization). The final is a 5-minute pitch plus 2 minutes of questions. Answer in Russian; write the pitch text itself in English. Use web research and give a primary-source link for every number.

Product: "First Year" — a multiplayer web game where an adult rehearses the first year of a small business in real New York. User: a 25–45-year-old with a job and a family who wants to start a business and is afraid to lose savings. Pain: they do not know what really awaits them — documents, money, suppliers, taxes, inspections. In the game they pick a real storefront on a real map (OpenStreetMap), get the real opening checklist (LLC, permits with fees and waiting days), a setup with real prices (a coffee shop needs about $141,000 to open and $224,000 in total liquidity), then run the shop: price, staff, seats, cleaning. The city runs by itself: one game month is one real day, 12 days a season, 10–15 minutes a day. They can cut corners (cash wages off the books) and get caught: neighbours report them, city officials (other players or AI) inspect, real fines apply. Neighbours also cooperate: joint purchasing, cross-promotion, a block fund, loans, partnerships. At the end the player gets a personal real-world plan: budget, documents with links, where to find suppliers, and the three mistakes that cost the most. What works today: the whole loop in the browser on phone and laptop, two niches (coffee shop, barbershop), AI-run neighbours, real NYC cost data.

Deliver:
1) A 5-minute pitch script (max 700 words) with timing by seconds: pain, user, 2-minute live demo, why they pay, market, what is next.
2) A demo script by clicks for those 2 minutes, with one sentence to say at each step.
3) A money model to $100,000 a year. The weak spot: a $5 entry with a prize pool looks like gambling and pays almost nothing (10 players: first prize $22.50). Propose and compare subscription, a paid personal plan, sponsor-funded seasons, and sales to courses and colleges; pick one main model and show the arithmetic.
4) Evidence of the pain: how many Americans want to start a business versus do it, small-business survival rates, top reasons for failure, cost to open a coffee shop in NYC.
5) The 15 hardest jury questions with 30-word answers, including: "Is this gambling?", "Are you teaching tax evasion?", "Why New York if you are in Astana?", "How is this better than Big Ambitions or a business course?", "Who pays first?".
6) Which track fits best — MONEY ("Where does money hurt?"), ENTERTAINMENT, or SKILLS ("What do people fail to master?") — and why.
Be blunt about what is weak.
```
