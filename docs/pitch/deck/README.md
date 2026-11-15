# Pitch deck

A live HTML deck in Russian: ten pages, 1920×1080, in the order of the judging criteria, each with its own drawing and
one animation that shows the page's point. No network: no CDN, no web fonts. The PDF is printed from the same page.

**Show it.** Open `index.html` in a browser (straight from the file works), or the game's own `/deck/` when the server
runs (`npm run build && npm start` → `http://<address>:8787/deck/`). → / Space / click / swipe — next; ← — back;
F — full screen; the page number is in the address (`#3`). The stage scales to any 16:9 screen. Served from the game,
the last page shows the game's address and a QR code to it.

**Final state.** Every element's normal style is its final state; an animation only plays into it, on the page you
enter, and is over within 1.5 s. The PDF (`?static`), print and `prefers-reduced-motion` show the final page at once.

| File | What it is |
|---|---|
| `index.html` | the deck: one `<section class="page">` per page, drawings as inline SVG |
| `deck.css` | its look — the light "paper" theme of the product (`client/src/ui/glass.css`, `build/DESIGN.md`) at deck scale |
| `live.css` | the stage, the animations and their final states |
| `deck.js` | navigation, scaling, counters, the game's address and QR |
| `qr.js` | QR encoder without dependencies, compiled from `server/src/qr.ts` |
| `publish.mjs` | copies the deck to `client/public/deck` — the game serves it at `/deck/` |
| `deck.pdf` | the printed deck |
| `pages/page-NN.png` | each page as a picture, for reading on GitHub |
| `img/` | real screenshots of the product and how they were taken (`img/README.md`, `img/capture.json`) |
| `build.mjs` | prints the PDF and the pictures, checks every page |
| `capture.mjs` | takes the screenshots from the running product |
| `words.mjs` | counts the spoken words of `docs/pitch/SCRIPT.md` (limit 650) |

## Build

```bash
node docs/pitch/deck/build.mjs
```

To try the money model from another branch without merging it: `node docs/pitch/deck/build.mjs --model-ref <git ref>`.

Once the game has a public address, put it on pages 1 and 10 (without it, the "Play:" lines are left out):

```bash
node docs/pitch/deck/build.mjs --url https://<address>
```

The build also writes the filled numbers back into `index.html` (so the live deck shows them too) and copies the deck to
`client/public/deck`. It fails (exit 1) when there are more than ten pages, when a page overflows, when text runs into the footer
or spills out of its card, or when a screenshot is missing. It also prints how many numbers on each page are still
waiting for their source (dashed boxes).

## Where the numbers come from

- **Money** (pages 7–8) is never typed in: every element with `data-model="outputs.ltv"`, `data-model="inputs.cacPaid"`,
  `data-model="outputs.steps.2.payers"` and so on is filled at build time from `docs/pitch/model.mjs`. Change an
  assumption there and rebuild.
- **Ad lines** (page 7) quote the screenshots next to them: `data-frame="ad-bet" data-re="pay those bills · (\d+)"`
  takes the number from the text the capture recorded for that frame (`img/capture.json` → `frames`), so a retake
  cannot leave an ad line that disagrees with its picture.
- **Market and pain** (pages 2 and 9) — `docs/pitch/USER.md` and `docs/pitch/COMPETITORS.md`, each number with a link.
- **What is real** (page 5) — `node scripts/validate-all.mjs` (verified numbers), `npm test` (tests),
  `npx tsx sim/audit/saturation.ts` (the shared market).
- **Screens** (pages 3–7) — one recorded run of the real product: `img/capture.json` keeps the commit, the city and
  every number the run produced. The cafe's numbers on stage are whatever the game shows at that moment.

## Retake the screenshots

```bash
npm run build && npm start
```

```bash
node docs/pitch/deck/capture.mjs
```

Against a deployed city: `CAPTURE_URL=https://<address> node docs/pitch/deck/capture.mjs`.

## The talk and the questions

- `docs/pitch/SCRIPT.md` — five minutes, page by page, with what is shown live (the pitch city: `docs/pitch/RUNBOOK.md`).
- `docs/pitch/QA.md` — twenty hard questions, two sentences each.
