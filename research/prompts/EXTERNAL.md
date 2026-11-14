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

## E6 — GPT Pro (пользователь): питч как живой показ, а не слайды → `docs/pitch/gpt-show.md`

Заменяет «слайдовую» часть E5 (деньги, доказательства боли и вопросы жюри из E5 остаются нужны). Вставлять целиком, включить поиск. Перед отправкой впиши трек и критерии жюри, если они известны.

```text
You are a pitch director for a two-person team at a 24-hour hackathon (Business Cup 2.0 "From Zero to Product", Astana, organizer Zimran). The final is 5 minutes on stage plus 2 minutes of questions, in front of a jury of entrepreneurs and investors. Every other team will click through slides. I do not want a slide deck. I want a short live show built around the working product, where slides are at most 2-3 silent title cards.

THE PRODUCT (it works, it is on a laptop and on phones)
"First Year" is a slow multiplayer business game set in real New York. An adult who is afraid to start a business (25-45, has a family, cannot risk savings) types an idea, for example "a coffee shop near the subway". The system picks a real address in the East Village on a live map, shows the real opening roadmap (LLC, EIN, sales tax certificate, health permit: agency, fee, days of waiting), recommends a setup kit with real prices, and the person runs the shop next to about 100 other players and AI-run neighbors. One game day is 48 real minutes, so a month takes one real day and nobody has to sit in the game: you leave standing orders, a hired manager covers you, and you come back to "while you were away". Owners make deals (joint purchase, cross-promo, block fund, loan, partnership) or report a rival to the city. Other players are city officials: an inspector and a tax auditor who take cases and earn points. There are temptations with real consequences, such as paying wages in cash to dodge payroll tax, shown with the real law and the real fine. Weather and street events change demand. Analytics look like a real owner's: break-even, cash runway, payback. At the end the player gets a "real-world plan": documents, money, suppliers. Top 3 in every niche win prizes (test money in the demo). A demo city runs at 2 seconds per game day, so a full year fits into a few minutes on stage.
Worked example we can show: a cafe with $224,000 start capital, $139,500 setup, 200 tickets a day at $8.50, break-even at 177 tickets a day, about +$4,152 a month with a manager.
Stage tools: one laptop on the projector (city screen with the live map, leaderboards and feed), our two phones as two players, and any jury phone via a QR code.

WHAT I NEED FROM YOU

1. THREE DIFFERENT SHOW CONCEPTS, each in 5-6 lines, honestly compared (wow effect, risk of failure on stage, how hard to rehearse in 3 hours). Examples of the kind of thing I mean, invent better ones:
   - "The jury's idea": we ask a jury member for any small business idea, type it in, and run one year of it live while we talk; the last 20 seconds reveal whether it survived and why.
   - "Two founders, one street": the two of us open rival cafes on the same block from our phones; one plays honest, one cuts corners; an inspector arrives on the projector.
   - "The receipt": we open with one real number of what a failed cafe costs a family in New York, then replay that failure in 60 seconds for free.
   Then pick ONE and say why.

2. A DIRECTOR'S SCRIPT for the chosen concept, second by second, as a table with columns: time (0:00-5:00, steps of 10-20 seconds) | what the projector shows | what each phone shows | who speaks | exact words (short spoken English sentences, 12 words at most each) | what a hand does (click, tap, scan). Include:
   - a cold open in the first 15 seconds with no greeting and no "we are team X";
   - three "reveal" moments where something on screen changes because of what was just said;
   - one moment where the jury does something themselves (scan a QR, vote, choose);
   - where the money slide of the business itself fits (who pays, how it reaches $100,000 a year) in no more than 40 seconds;
   - the last line: one sentence the jury will repeat to each other afterwards.

3. THE 2-3 TITLE CARDS: exact text on each (7 words at most), when it appears, for how many seconds.

4. A FALLBACK TREE: what we do if (a) the wifi dies, (b) the map does not load, (c) the jury member's idea is not a cafe or a barbershop (those two are the only playable niches), (d) a phone fails, (e) we are cut to 3 minutes. For each: the sentence we say and the action we take, so that the show looks planned.

5. A REHEARSAL PLAN for 3 hours and 2 people: what to pre-seed in the demo city (names, a rival, an inspection that fires at a known second), what to practice in what order, and the 5 most likely ways this goes wrong.

6. A LEAVE-BEHIND instead of a deck: one thing the jury keeps after we leave the stage (for example a printed "real-world plan" for a cafe with real fees, or a QR to a city that keeps running). Describe exactly what is on it.

7. TEN HOSTILE JURY QUESTIONS for this specific show, each with an answer of two sentences at most.

RULES
- Use web search to check any real-world number you add (fees, failure rates, costs) and give the source link next to it. If you cannot verify a number, write "unverified" next to it. Do not invent statistics.
- Do not promise features that are not in the product description above.
- Spoken lines in simple English. Everything else (explanations, comparisons, the plans) in Russian.
- No filler, no motivational phrases. Write it so that two tired people can perform it at 11 in the morning.
```
