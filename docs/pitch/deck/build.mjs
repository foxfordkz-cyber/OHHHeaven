// Prints the deck to PDF and one PNG per page.
//
//   node docs/pitch/deck/build.mjs                  → docs/pitch/deck/deck.pdf, docs/pitch/deck/pages/page-NN.png
//   node docs/pitch/deck/build.mjs --no-png         → PDF only
//   node docs/pitch/deck/build.mjs --model <path>   → money numbers from another copy of the model
//   node docs/pitch/deck/build.mjs --url https://…  → the public address on pages 1 and 10 (or DECK_URL)
//
// Uses the Playwright that is already installed (require('playwright') works from any directory).
// Fails if a page overflows 1920×1080, if content runs into the footer, if an image is missing,
// or if there are more than 10 pages.
//
// Money numbers are not typed into the deck. Every element with data-model="outputs.<key>" or
// data-model="inputs.<key>" is filled from docs/pitch/model.mjs (B16): change an assumption there and rebuild.
// data-format: usd | usd0 | usdM | x | pct | months | count. The path may go deeper: "outputs.steps.2.payers". If the model or a key is missing, the element keeps its
// dashed TBD look and the report names the key.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const html = join(here, 'index.html');
const pdf = join(here, 'deck.pdf');
const pagesDir = join(here, 'pages');
const wantPng = !process.argv.includes('--no-png');
const MAX_PAGES = 10;
const argAfter = (flag) => {
  const i = process.argv.indexOf(flag);
  return i > 0 ? process.argv[i + 1] : undefined;
};
let modelPath = argAfter('--model') ? resolve(argAfter('--model')) : join(here, '..', 'model.mjs');
// --model-ref <git ref>: take B16's model from another branch without merging it (e.g. origin/claude/nifty-davinci-j7t4c3).
const modelRef = argAfter('--model-ref');
if (modelRef) {
  const dir = mkdtempSync(join(tmpdir(), 'deck-model-'));
  modelPath = join(dir, 'model.mjs');
  writeFileSync(modelPath, execFileSync('git', ['show', `${modelRef}:docs/pitch/model.mjs`], { cwd: here }));
  const commit = execFileSync('git', ['rev-parse', '--short', modelRef], { cwd: here }).toString().trim();
  console.log(`model taken from ${modelRef} (${commit})`);
}

/** { inputs, outputs, kinds } from B16's model, or null while it is not in this branch. */
async function loadModel() {
  if (!existsSync(modelPath)) return null;
  const m = await import(pathToFileURL(modelPath).href);
  if (typeof m.compute !== 'function' || !m.INPUTS) return null;
  const entries = Object.entries(m.INPUTS);
  return {
    inputs: Object.fromEntries(entries.map(([k, i]) => [k, i.value])),
    kinds: Object.fromEntries(entries.map(([k, i]) => [k, i.kind])),
    outputs: m.compute(m.INPUTS),
  };
}
const model = await loadModel();
console.log(model ? `model: ${modelPath}` : `model: not found at ${modelPath} — money numbers stay TBD`);

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(html).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);

  const missingKeys = await page.evaluate((m) => {
    const fmt = (v, f) => {
      if (f === 'usd') return Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(v >= 1e8 ? 0 : 1)}M` : `$${v.toLocaleString('en-US', { maximumFractionDigits: Math.abs(v) < 100 ? 2 : 0 })}`;
      if (f === 'usd0') return `$${Math.round(v).toLocaleString('en-US')}`;
      if (f === 'x') return `${v.toFixed(v < 1 ? 2 : 1)}×`;
      if (f === 'pct') return `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`;
      if (f === 'usdM') return `$${(v / 1e6).toFixed(v < 1e6 ? 2 : v < 1e7 ? 1 : 0)}M`;
      if (f === 'months') return v.toFixed(1);
      // count
      if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
      if (Math.abs(v) >= 1e5) return `${Math.round(v / 1e3)}K`;
      if (Math.abs(v) >= 1e4) return `${(v / 1e3).toFixed(1)}K`;
      return Math.round(v).toLocaleString('en-US');
    };
    const missing = [];
    for (const el of document.querySelectorAll('[data-model]')) {
      // a dotted path into { inputs, outputs }: "outputs.ltv", "outputs.steps.2.payers"
      const v = el.dataset.model.split('.').reduce((o, k) => (o == null ? undefined : o[k]), m);
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        missing.push(el.dataset.model);
        continue;
      }
      el.textContent = fmt(v, el.dataset.format);
      el.classList.remove('tbd');
    }
    return missing;
  }, model);
  if (missingKeys.length) console.log(`model keys not filled: ${[...new Set(missingKeys)].join(', ')}`);

  // Ad lines quote numbers from the screenshots next to them. They are not typed either: an element with
  // data-frame="ad-bet" data-re="pay those bills · (\d+)" takes group 1 of that pattern from the text the capture
  // recorded for that frame (img/capture.json → frames). A pattern that no longer matches leaves a dashed TBD.
  // The public address of the game: --url https://... (or DECK_URL). Without it the "Play: ..." lines are left out
  // rather than printed with a placeholder.
  const url = (argAfter('--url') ?? process.env.DECK_URL ?? '').trim();
  await page.evaluate((u) => {
    for (const el of document.querySelectorAll('[data-url]')) el.textContent = u.replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!u) for (const el of document.querySelectorAll('[data-url-wrap]')) el.remove();
  }, url);
  console.log(url ? `public address: ${url}` : 'public address: none given (--url) — the "Play:" lines are left out');

  const capturePath = join(here, 'img', 'capture.json');
  const frames = existsSync(capturePath) ? (JSON.parse(readFileSync(capturePath, 'utf8')).frames ?? {}) : {};
  const staleFrames = await page.evaluate((fr) => {
    const stale = [];
    for (const el of document.querySelectorAll('[data-frame]')) {
      const m = new RegExp(el.dataset.re).exec(fr[el.dataset.frame] ?? '');
      if (m) el.textContent = m[1];
      else {
        el.classList.add('tbd');
        stale.push(`${el.dataset.frame}: /${el.dataset.re}/`);
      }
    }
    return stale;
  }, frames);
  if (staleFrames.length) console.log(`ad numbers not found in the frames: ${staleFrames.join('; ')}`);

  const report = await page.$$eval('section.page', (pages) =>
    pages.map((el, i) => ({
      n: i + 1,
      id: el.id || '',
      overflowY: el.scrollHeight - el.clientHeight,
      overflowX: el.scrollWidth - el.clientWidth,
      tbd: el.querySelectorAll('.tbd').length,
      // content must end above the footer line (bottom 100 px of the page)
      intoFooter: Math.max(0, ...[...el.querySelectorAll('*')].filter((c) => !c.closest('.foot') && !c.closest('svg')).map((c) => c.getBoundingClientRect().bottom - el.getBoundingClientRect().top)) - 980,
      // a card, a screenshot or a table box whose own content spills out of it (overlaps its neighbours)
      spills: [...el.querySelectorAll('.card, .shot, .step, table')].filter((c) => c.scrollHeight - c.clientHeight > 2).map((c) => (c.innerText || '').trim().split('\n')[0].slice(0, 30)),
      missingImages: [...el.querySelectorAll('img')].filter((img) => !img.complete || img.naturalWidth === 0).map((img) => img.getAttribute('src')),
    })),
  );

  let bad = false;
  if (report.length > MAX_PAGES) {
    console.error(`FAIL: ${report.length} pages, limit ${MAX_PAGES}`);
    bad = true;
  }
  for (const r of report) {
    const notes = [];
    if (r.overflowY > 1 || r.overflowX > 1) {
      notes.push(`overflow ${r.overflowX}×${r.overflowY}px`);
      bad = true;
    }
    if (r.intoFooter > 0) {
      notes.push(`content runs ${Math.ceil(r.intoFooter)}px into the footer`);
      bad = true;
    }
    if (r.spills.length) {
      notes.push(`content spills out of: ${r.spills.map((t) => `"${t}"`).join(', ')}`);
      bad = true;
    }
    if (r.missingImages.length) {
      notes.push(`missing images: ${r.missingImages.join(', ')}`);
      bad = true;
    }
    if (r.tbd) notes.push(`${r.tbd} number(s) still TBD`);
    console.log(`page ${String(r.n).padStart(2)} ${r.id.padEnd(10)} ${notes.length ? notes.join('; ') : 'ok'}`);
  }

  await page.pdf({ path: pdf, width: '1920px', height: '1080px', printBackground: true, preferCSSPageSize: true });
  console.log(`PDF: ${pdf}`);

  if (wantPng) {
    rmSync(pagesDir, { recursive: true, force: true });
    mkdirSync(pagesDir, { recursive: true });
    const sections = await page.$$('section.page');
    for (let i = 0; i < sections.length; i++) {
      await sections[i].screenshot({ path: join(pagesDir, `page-${String(i + 1).padStart(2, '0')}.png`) });
    }
    console.log(`PNG: ${pagesDir}/page-01..${String(sections.length).padStart(2, '0')}.png`);
  }

  if (bad) process.exitCode = 1;
} finally {
  await browser.close();
}
