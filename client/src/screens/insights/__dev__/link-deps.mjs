// Temporary: lets files in ../ (insights) and ../../end resolve this harness's node_modules
// until agent 08's client package exists. Remove the harness when it does.
import { symlinkSync, existsSync, lstatSync, unlinkSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, 'node_modules');
for (const dir of [resolve(here, '..'), resolve(here, '..', '..', 'end')]) {
  const link = resolve(dir, 'node_modules');
  if (existsSync(link) || (() => { try { return lstatSync(link).isSymbolicLink(); } catch { return false; } })()) {
    try { if (lstatSync(link).isSymbolicLink()) unlinkSync(link); else continue; } catch { /* ignore */ }
  }
  symlinkSync(relative(dir, target), link, 'dir');
  console.log(`linked ${relative(process.cwd(), link)} -> ${relative(dir, target)}`);
}
