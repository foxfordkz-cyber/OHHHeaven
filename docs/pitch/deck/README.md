# Pitch deck

Ten pages, 1920×1080, in the order of the judging criteria. One HTML file is the source; the PDF is printed from it.

| File | What it is |
|---|---|
| `index.html` | the deck: one `<section class="page">` per page |
| `deck.css` | its look — the light "paper" theme of the product (`client/src/ui/glass.css`, `build/DESIGN.md`) at deck scale |
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

The build fails (exit 1) when there are more than ten pages, when a page overflows, when text runs into the footer
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
