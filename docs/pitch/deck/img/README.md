# Deck screenshots

Only real screens of the running product, taken by `docs/pitch/deck/capture.mjs`. Nothing is drawn over them.

How they were made (the exact run is in `capture.json`: commit, city id, every step and the month report):

1. `npm run build && npm start` — the production build on port 8787.
2. `node docs/pitch/deck/capture.mjs` — creates its own demo city, walks the opening in a phone browser
   (390×844) as a new player would: idea "Coffee near the subway" → the cheapest storefront to open →
   the 25-step opening plan → join → recommended setup → waiting for permits. Then moves the city clock to
   opening day, presses "Open doors" in the UI, lets the city run a month and photographs the business tabs
   and the public city screen (1440×900).

| File | Screen | Used on page |
|---|---|---|
| `home.png` | Home, wide | — |
| `start-idea.png` | Opening, step 1: idea | — |
| `start-place.png` | Opening, step 2: storefront card | 3 |
| `start-plan.png` | Opening, step 3: 25 steps with agency, fee, wait | — |
| `start-setup.png` | Opening, step 5: recommended setup and the computed first year | 3 |
| `start-waiting.png` | Opening, step 6: permits in progress, rent running | — |
| `biz-away.png` | "While you were away" card on return | 5 |
| `biz-today.png` | Business, Today | — |
| `biz-manage.png` | Business, Manage: projected month | 3 |
| `biz-books.png` | Business, Books: taxes owed with due dates | 4 |
| `biz-insights.png` | Business, Insights: profit, runway, advisor | — |
| `biz-network.png` | Business, Network: neighbours | 8 |
| `city.png` | Public city screen for a projector | 8 |

The map is the offline schematic map (map tiles are not reachable from the capture machine). Retake against
the public address once it is up: `CAPTURE_URL=https://<address> node docs/pitch/deck/capture.mjs`.
