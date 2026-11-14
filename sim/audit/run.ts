import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { main, readJson, ROOT } from './harness';

main(() => {
  const cli = readJson<{ bin: string }>('node_modules/tsx/package.json').bin;
  const rows = ['probes', 'sweep', 'diversity'].map(name => {
    console.log(`\n--- ${name} ---`);
    const result = spawnSync(process.execPath, [join(ROOT, 'node_modules/tsx', cli), join(ROOT, `sim/audit/${name}.ts`)], { cwd: ROOT, stdio: 'inherit' });
    return { audit: name, exitCode: result.status ?? 2, error: result.error?.message ?? result.signal ?? null };
  });
  console.table(rows);
  process.exitCode = rows.some(r => r.exitCode > 1 || r.error) ? 2 : rows.some(r => r.exitCode !== 0) ? 1 : 0;
});
