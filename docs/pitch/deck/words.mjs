// Counts the spoken English words in docs/pitch/SCRIPT.md, page by page.
//
//   node docs/pitch/deck/words.mjs     → words per page, total, exit 1 above the 650-word limit
//
// Spoken text = plain lines under a "## m:ss–m:ss" heading. Not counted: headings, stage directions (lines
// starting with ▸), the notes before the first timed heading and after the next untimed one.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const LIMIT = 650;
const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'SCRIPT.md');
const lines = readFileSync(file, 'utf8').split('\n');
const timed = /^## \d+:\d\d–\d+:\d\d/;

const pages = [];
let current = null;
for (const line of lines) {
  if (line.startsWith('## ')) {
    current = timed.test(line) ? { title: line.slice(3), words: 0, placeholders: 0 } : null;
    if (current) pages.push(current);
    continue;
  }
  if (!current || !line.trim() || line.startsWith('▸') || line.startsWith('---')) continue;
  current.placeholders += (line.match(/\[[^\]]*\]/g) ?? []).length;
  current.words += line.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
}

let total = 0;
for (const p of pages) {
  total += p.words;
  console.log(`${String(p.words).padStart(4)}  ${p.title}${p.placeholders ? `  (${p.placeholders} placeholder)` : ''}`);
}
console.log(`${String(total).padStart(4)}  total, limit ${LIMIT}`);
if (total > LIMIT) process.exitCode = 1;
