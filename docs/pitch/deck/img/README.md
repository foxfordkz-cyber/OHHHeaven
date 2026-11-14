# Deck screenshots

Only real screens of the running product, taken by `docs/pitch/deck/capture.mjs`. Nothing is drawn over them. Wide map screens are JPEG, phone screens PNG.

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
| `home.jpg` | Home, wide | — |
| `start-idea.png` | Opening, step 1: idea | — |
| `start-place.png` | Opening, step 2: storefront card | 3 |
| `start-plan.png` | Opening, step 3: 25 steps with agency, fee, wait | — |
| `start-setup.png` | Opening, step 5: recommended setup and the computed first year | 3 |
| `start-waiting.png` | Opening, step 6: permits in progress, rent running | 7 (ad 1) |
| `biz-away.png` | "While you were away" card on return | 6, 7 (ad 2) |
| `biz-today.png` | Business, Today | — |
| `biz-manage.png` | Business, Manage: projected month | 3 |
| `biz-books.png` | Business, Books: taxes owed with due dates | 5 |
| `biz-insights.png` | Business, Insights: profit, runway, advisor | — |
| `biz-network.png` | Business, Network: neighbours | 4 |
| `city.jpg` | Public city screen for a projector | 4 |
| `end.png` | Season over: rank, "Where you lost money", next time | 6, 7 (ad 3) |
| `end-wide.png` | The same, wide | — |
| `plan.png` | Your real-world plan: money to start, every month | 6 |
| `plan-wide.png` | The same, wide | — |

The map is the offline schematic map (map tiles are not reachable from the capture machine). Retake against
the public address once it is up: `CAPTURE_URL=https://<address> node docs/pitch/deck/capture.mjs`.
