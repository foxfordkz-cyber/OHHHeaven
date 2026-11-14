# Deck screenshots

Only real screens of the running product, taken by `docs/pitch/deck/capture.mjs`. Nothing is drawn over them. Wide map screens are JPEG, phone screens PNG. The ad frames (`ad-*.png`) are one card of a real screen, cut out by the script around a piece of text.

Current set: the integration build of the night (`claude/cool-archimedes-blis6z`, commit 19a73f0, 23:05 UTC), the build the main branch is fast-forwarded to — `capture.json` says which.

How they were made (the exact run is in `capture.json`: commit, city id, every step and the month report):

1. `npm run build && npm start` — the production build on port 8787.
2. `node docs/pitch/deck/capture.mjs` — creates its own demo city, walks the opening in a phone browser
   (390×844) as a new player would: idea "Coffee near the subway" → the cheapest storefront to open →
   the 25-step opening plan → join → recommended setup → waiting for permits. Then moves the city clock to
   opening day, presses "Open doors" in the UI, lets the city run a month, closes the page for a week (so the
   return card has news), photographs the business tabs and the public city screen (1440×900), then moves the
   clock to the end of the season and photographs the year-end screen and the personal plan.

| File | Screen | Used on page |
|---|---|---|
| `home.jpg` | Home, wide | 1 |
| `start-idea.png` | Opening, step 1: idea | — |
| `start-place.png` | Opening, step 2: storefront card | 3 |
| `start-plan.png` | Opening, step 3: the plan by days | — |
| `start-decision.png` | Opening, step 5: decision 1 of 7 (team), cash left, opening day and bills on top | 3 |
| `start-setup.png` | Opening, step 5: where the money goes and "Your bet" | — |
| `ad-bet.png` | The "Your bet" card alone | 7 (ad 1) |
| `start-waiting.png` | Opening, step 6: permits in progress | — |
| `brief.png` | Return screen `/brief`: cash then and now, one decision today, the month report | 6, 7 (ad 2) |
| `pro.png` | Plan screen `/pro` for a free player at the end of the free month | — |
| `biz-away.png`, `ad-away.png` | "While you were away" card on the business screen | — |
| `biz-today.png` | Business, Today | — |
| `biz-manage.png` | Business, Manage: the next 30 days if nothing changes, the limit | 3 |
| `biz-books.png` | Business, Books: taxes owed with due dates | 5 |
| `biz-insights.png` | Business, Insights | — |
| `biz-network.png` | Business, Network: offers waiting, the closest rival | 4 |
| `city.jpg` | Public city screen for a projector | 4 |
| `end.png`, `end-wide.png` | Season over: rank, "Where you lost money" | 6 |
| `ad-loss.png` | The "Rent above the norm" card | 7 (ad 3) |
| `plan.png`, `plan-wide.png` | Your real-world plan (Pro, taken in test mode: nothing charged) | 6 |

The map is the offline schematic map (map tiles are not reachable from the capture machine). Retake against
the public address once it is up: `CAPTURE_URL=https://<address> node docs/pitch/deck/capture.mjs`.
