// Puts the data of the cafe model parts (packs/parts/cafe/B0*-*.json) into packs/cafe.json.
// Owner: the integrator (B04, build/ROUND3.md). Run: node packs/parts/cafe/apply-parts.mjs [B03 B01 …] [--dry]
// With no ids it applies every B0*-*.json in this folder. Each part file has `extra.<key>`; that key replaces
// packs/cafe.json → extra.<key>. `newRoles` inside it are added to pack.staff (by id, existing ids are kept as they
// are), `newLeverOptions` are added to the lever they name. Both lists stay in extra too, so the part can read them.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const packPath = join(here, '..', '..', 'cafe.json');
const args = process.argv.slice(2);
const dry = args.includes('--dry');
const want = args.filter((a) => !a.startsWith('--'));

const files = readdirSync(here)
  .filter((f) => /^B0\d-.*\.json$/.test(f))
  .filter((f) => want.length === 0 || want.some((id) => f.startsWith(id + '-')))
  .sort();
if (files.length === 0) {
  console.error(`no part files for ${want.join(', ') || 'B0*'} in ${here}`);
  process.exit(1);
}

const raw = readFileSync(packPath, 'utf8');
const pack = JSON.parse(raw);
pack.extra ??= {};

for (const f of files) {
  const part = JSON.parse(readFileSync(join(here, f), 'utf8'));
  const keys = Object.keys(part.extra ?? {});
  if (keys.length === 0) { console.log(`${f}: no extra, skipped`); continue; }
  for (const key of keys) {
    const data = part.extra[key];
    pack.extra[key] = data;
    const said = [`${f}: extra.${key}`];
    for (const role of data?.newRoles ?? []) {
      if (pack.staff.some((s) => s.id === role.id)) { said.push(`role ${role.id} already in staff`); continue; }
      pack.staff.push(role);
      said.push(`role ${role.id} added to staff`);
    }
    for (const lo of data?.newLeverOptions ?? []) {
      const lever = pack.levers.find((l) => l.id === lo.leverId);
      if (!lever) { said.push(`lever ${lo.leverId} not in pack, option ${lo.option?.id} skipped`); continue; }
      if (lever.options.some((o) => o.id === lo.option.id)) { said.push(`option ${lo.leverId}.${lo.option.id} already there`); continue; }
      lever.options.push(lo.option);
      said.push(`option ${lo.leverId}.${lo.option.id} added`);
    }
    console.log(said.join('; '));
  }
}

const indent = raw.match(/^\{\n(\s+)/)?.[1] ?? '  ';
const out = JSON.stringify(pack, null, indent) + (raw.endsWith('\n') ? '\n' : '');
if (dry) console.log(`dry run: ${packPath} not written (${out.length} bytes)`);
else { writeFileSync(packPath, out); console.log(`wrote ${packPath}`); }
