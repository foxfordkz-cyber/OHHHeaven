#!/usr/bin/env node
// Runs build/validate-pack.mjs on every packs/*.json (owner: agent 01). Exit 1 if any pack has an ERROR.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(ROOT, 'packs');
const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).sort((a, b) => (a === '_common.json' ? -1 : b === '_common.json' ? 1 : a.localeCompare(b))) : [];
if (!files.length) { console.log('validate-all: no packs/*.json yet — nothing to check'); process.exit(0); }

let failed = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, [join(ROOT, 'build/validate-pack.mjs'), join(dir, f)], { encoding: 'utf8' });
  const ok = r.status === 0;
  if (!ok) failed += 1;
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim();
  console.log(`${ok ? '✔' : '✖'} packs/${f}${out ? `\n${out.split('\n').map((l) => `    ${l}`).join('\n')}` : ''}`);
}
console.log(`\nvalidate-all: ${files.length - failed}/${files.length} packs pass`);
process.exit(failed ? 1 : 0);
