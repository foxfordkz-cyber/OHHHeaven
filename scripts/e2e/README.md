# Browser walk of the whole game

`journey.mjs` plays First Year in Chromium the way a new player does, from the landing page to the personal plan at the end of the season, on a phone (375 px) and on a desktop (1440 px).

```bash
node scripts/e2e/journey.mjs                    # starts its own server on a free port
node scripts/e2e/journey.mjs --url https://…    # the same walk against a deployed game
scripts/e2e/cycle.sh <branch>                   # a fresh worktree of a branch: install, build, walk
scripts/e2e/prod.sh https://… [CLOCK_KEY]      # everything against a deployed game: walk, first minute, speed, stage show
```

Options: `--scheme dark` (dark system theme and the app's own dark theme), `--widths 375,1440`, `--out <dir>`, `--shots <dir>` (retina screenshots of what the player sees, for the deck), `--no-end` (stop before the season ends), `--root <checkout>` (serve the game from another checkout).

## What it does

Each run creates its own demo city through the API and pauses its clock, so the walk does not depend on who else is in the shared demo city; game days are moved forward through the demo clock endpoint.

| Step | Through the UI | Checked |
|---|---|---|
| home | type an idea, "See my plan" | lands on the wizard |
| idea | niche and business name | the idea is recognised |
| place | the cheapest affordable storefront, "Open here" | button enabled within budget |
| plan | read the opening plan | steps and official links counted |
| join | name, test payment | a session is saved |
| setup | "Open with recommended setup" | the business exists in the engine |
| permits | wait (5 game days at a time), "Open doors" | open; days of rent before the first sale |
| biz, tab-* | the five tabs of My business | each has content, no placeholder |
| whatif | price +$0.50 | the forecast changes before saving; the engine gets the price; Today the next day |
| advice | "Apply" on the first advice on Today | orders or size change in the engine |
| live-edit | edit the price while the city runs | the unsaved edit survives new days |
| deal | cross-promo to a neighbour from the Network tab | the neighbour accepts, the deal is active |
| offer | the neighbour offers a loan (API); "Accept" in Network | Today says an offer waits; the deal is active |
| report | report the neighbour | the case is in the inspector's queue |
| brief | come back after 3 weeks, `/brief` | cash then → now, one decision, the rival |
| pro | after the free month: save a change, `/pro`, "Get Pro" (test) | the change is refused, then goes through; the free player's plan screen |
| desk | an inspector's own browser at /desk | the case is listed and can be taken |
| month | 32 days later, Books | a month report exists |
| end, plan-final | season over, "Open my plan" | rank, debrief, plan with links and print |

On every step: a full-page screenshot, horizontal overflow, page errors, console errors, failed requests and 5xx answers from the API. A step that fails in the UI is written down with a screenshot and then done through the API, so one broken button does not hide everything after it. Exit code 1 when any UI step failed.

## Three more checks

- `first-minute.mjs` — a newcomer on a phone with the demo city running at its own speed (no paused clock): seconds until the first decision, the first number that answers it, the signed lease, the open doors and the first sale; the longest stretch with nothing to decide. Writes `TIMELINE.md`.
- `pitch-show.mjs` — the five-minute stage show from `docs/pitch/RUNBOOK.md` in four browsers: Maya's and Viktor's phones by their codes, the projector by the guest code, the presenter desk `/pitch`. Maya takes the jury's branch on her phone (`--branch price` or `seats`), reports Viktor; the desk runs the city to the fine notice; Viktor pays on his phone; the desk goes back to the start. Writes `PITCH.md` and screenshots.
- `perf.mjs` — the first screen on a desktop and on a phone throttled like Lighthouse mobile (Slow 4G, CPU ×4): bytes over the wire, which files are large and whether they are compressed, time until the idea field is ready, LCP, long tasks.

Output: `RUN.md` (one line per step) and `results.json` in `docs/qa/runs/<time>/` (not committed). Findings live in `docs/qa/BUGS.md`; whether each screen gives the player a decision, a visible consequence and a reason to come back is in `docs/qa/HOOK.md`.

Only Chromium is installed here: Safari (WebKit) and Firefox are not covered.
