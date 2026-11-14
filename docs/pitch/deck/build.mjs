// Prints the deck to PDF and one PNG per page.
//
//   node docs/pitch/deck/build.mjs            → docs/pitch/deck/deck.pdf, docs/pitch/deck/pages/page-NN.png
//   node docs/pitch/deck/build.mjs --no-png   → PDF only
//
// Uses the Playwright that is already installed (require('playwright') works from any directory).
// Fails if a page overflows 1920×1080 or if there are more than 10 pages.
import { createRequire } from 'node:module';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const html = join(here, 'index.html');
const pdf = join(here, 'deck.pdf');
const pagesDir = join(here, 'pages');
const wantPng = !process.argv.includes('--no-png');
const MAX_PAGES = 10;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(html).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);

  const report = await page.$$eval('section.page', (pages) =>
    pages.map((el, i) => ({
      n: i + 1,
      id: el.id || '',
      overflowY: el.scrollHeight - el.clientHeight,
      overflowX: el.scrollWidth - el.clientWidth,
      tbd: el.querySelectorAll('.tbd').length,
      // content must end above the footer line (bottom 100 px of the page)
      intoFooter: Math.max(0, ...[...el.querySelectorAll('*')].filter((c) => !c.closest('.foot') && !c.closest('svg')).map((c) => c.getBoundingClientRect().bottom - el.getBoundingClientRect().top)) - 980,
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
