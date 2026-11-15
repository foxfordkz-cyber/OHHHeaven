# First Year — двадцать жёстких вопросов жюри

B17, третий заход. Ответ — два предложения, по-английски, вслух. Порядок — по критериям жюри: работает ли (40%), что продаём (20%), кому (15%), почему деньги (15%), новое ли (10%), затем неудобные.

**Правила ответа.** Не обещаем того, чего нет в продукте. Оценку называем оценкой. Числа рынка — из `docs/pitch/USER.md` (B15), денег — из `docs/pitch/MONEY.md` и `node docs/pitch/model.mjs` (B16, коммит 897ac38); если модель поменялась, числа в ответах 9, 12, 13, 14 сверить с её выводом. Чего не знаем — так и говорим.

Подтверждено в коде и данных на 14 ноября, 22:20 UTC: 73 из 138 ключевых чисел в пакетах помечены `verified` (`node scripts/validate-all.mjs`); один игровой месяц — одни настоящие сутки (`context/08-game-v5.md`); насыщение рынка — `npx tsx sim/audit/saturation.ts`; снимки экранов и месяц торговли — `docs/pitch/deck/img/capture.json`.

---

## Работает ли (40%)

**1. Is the demo scripted?**
The starting city is prepared; every action and every result you saw was computed live by the engine. The inspection verdict and the forecast are not stored anywhere before you ask for them.

**2. Why should anyone trust your numbers?**
Every number in the data packs carries a source and is marked verified or estimate; seventy-three of the one hundred thirty-eight key numbers are verified at the primary source today. The pack validator refuses data without a source, and the estimates are labelled on screen.

**3. Is the value real, or is it hard-coded?**
The bet on the setup screen — how many orders a day pay your bills against what an average shop on that corner sells — is computed from the storefront's rent, size, foot traffic and rivals, and it changes with every decision you make. Two cafés on the same block split one foot-traffic stream, so a crowded street really pays less — `sim/audit/saturation.ts` checks that.

**4. Does it work end to end, or only the parts you showed?**
`node scripts/smoke.mjs` walks the whole loop over HTTP on every push: two owners join, open, trade a month, one reports the other, a case ends in a notice, a deal is signed. The deck's screenshots were taken by a script that opened a café through the phone interface and ran it for a month.

**5. Your real world is random — your simulation has no randomness. Isn't that unrealistic?**
We removed dice on purpose: events come from the real calendar and real data and are announced in advance, so the same decision always gives the same result. That makes the game a fair rehearsal — you can compare two decisions instead of two lucky rolls.

**6. What did AI write, and who is accountable for the code?**
AI agents wrote most of the code under a written contract between seven packages; each agent owned named files and kept a journal in the repo. Two people wrote the contract and the rules, and a branch is merged only when type checks, tests and the end-to-end run are green.

## Что продаём (20%)

**7. What exactly does someone pay for?**
For nineteen dollars a month: your decisions after the first month, every business type, the advisor beyond three free questions, and a personal plan built from your own game — your address, your costs, your permits with official links. The city, your storefront, your first month open and every move with neighbours stay free.

**8. Why would someone come back tomorrow?**
The city keeps its own clock: one game month passes every real day, so tomorrow there is a new month report, a neighbour's move and a decision waiting. That is a daily reason to return during the months someone is actually preparing to open.

**9. Opening a café is a one-time event. Why would they keep paying?**
The paid period is the preparation itself — months of choosing a place, a budget and a setup — not a lifetime. Our model already assumes heavy churn: on RevenueCat benchmarks only 8% of monthly payers remain at month twelve, and a payer is still worth $120.

## Кому продаём (15%)

**10. Who is your user, exactly?**
One person: an American, twenty-one to forty-five, who wants to open a place of their own and is afraid of losing the savings. Americans filed a record 5.67 million business applications in 2025, about 300,000 of them in food service and lodging (Census Business Formation Statistics).

**11. Why not sell to banks, incubators or the SBA? That is an easier sale.**
That would be B2B, and our user is the person whose savings are at risk, not the institution. We sell to that person directly, by subscription.

**12. How will you reach them?**
Ads that show one real moment of the year — the orders a café needs against what its corner sells, a neighbour's offer — then one question, "what would you open?", and their own storefront with its cost; the first month is free. We have not run these ads yet: the model's $47 blended cost per payer ($265 through ads alone) is built from public benchmarks, and measuring it is our first test.

## Почему это деньги (15%)

**13. Show us LTV greater than CAC.**
LTV $120 against a blended CAC of $47 is 2.5×, paid back in 3.6 months, built on public benchmarks for retention, ad clicks and landing conversion — our own conversion is not measured yet. Paid ads alone give 0.44×, so `docs/pitch/model.mjs` assumes 90% of payers arrive organically, and changing any assumption recalculates every number in the deck.

**14. How do you get to $100M ARR?**
Coffee and food in New York first (about 900 payers), then every small business in New York (about 16,000), then every US metro: 557,000 payers at an average $14.95 a month make $100M. That is 4.1% of the 13.7 million Americans aged 21–45 in cities who consider starting a business (NORC, Census), and the engine already runs a barbershop on the same code.

**15. Each city needs new data. Doesn't that kill scaling?**
A city is a data pack — rents, wages, permits, taxes — checked by the same validator, while the engine stays the same. The research per city is real work, and it is the main cost of adding a city.

## Новое ли (10%)

**16. How is this different from business simulation games?**
Café tycoon games, five to twenty dollars on Steam, use invented prices and no permits or laws. We use one real city's sourced numbers, a shared city with other owners, and you leave with a plan for your own lease.

**17. Why not just ask a chatbot, use a plan template or hire a consultant?**
A chatbot or a template gives numbers you cannot check and no month three, when rent keeps running and the regulars have not come yet; a consultant does that work for three to fifteen thousand dollars, before the lease. Whether living the year is worth nineteen dollars a month is exactly what we test next.

## Неудобные

**18. Isn't the entry fee with a prize bank gambling?**
In the demo city the entry is test money and nothing is charged. The business we propose is a subscription for practice, independent of any prize.

**19. Your game shows a neighbour hiding wages. Are you teaching tax evasion?**
We show what the shortcut costs once an inspector finds it: the saving turns into a liability in the books. The lesson is compliance, not evasion.

**20. What is the weakest part right now?**
We have not proven that people pay or return: price, retention and acquisition are hypotheses. And some numbers are still estimates — they are labelled as such, and replacing them with verified ones is ongoing work.

---

## Если спросят то, чего нет в списке

- Не знаем — говорим: “We don't know yet. Here is how we would find out.”
- Про число, которого нет на слайде, — не называем на память: “It is in the repo, with the source; I won't guess it on stage.”
- Про пользователей: на сцене двое людей, остальные жители помечены AI. Живых платящих пользователей у нас нет.
