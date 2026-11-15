// Copies the live deck into the client's static files, so the game's server serves it at /deck/
// (Vite copies client/public/ into client/dist/; the server serves client/dist — no server code involved).
//
//   node docs/pitch/deck/publish.mjs      (build.mjs runs it at the end)
//
// Copies index.html, the styles, the scripts and only the screenshots the page uses.
import { copyFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', '..', '..', 'client', 'public', 'deck');

export function publish() {
  const html = readFileSync(join(here, 'index.html'), 'utf8');
  const images = [...new Set([...html.matchAll(/src="(img\/[^"]+)"/g)].map((m) => m[1]))];
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, 'img'), { recursive: true });
  for (const f of ['index.html', 'deck.css', 'live.css', 'deck.js', 'qr.js', ...images]) copyFileSync(join(here, f), join(out, f));
  return { out, files: 5 + images.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const r = publish();
  console.log(`published ${r.files} files to ${r.out} → served at /deck/`);
}
