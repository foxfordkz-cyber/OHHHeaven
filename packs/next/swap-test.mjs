#!/usr/bin/env node
// Подстановка packs/next/cafe.json и packs/next/_common.json на копии репозитория (задание A2).
// Рабочая копия не меняется: файлы копируются во временную папку (node_modules — жёсткими ссылками),
// там packs/cafe.json и packs/_common.json заменяются новыми, затем запускаются валидатор, npm run check,
// npm test и node scripts/smoke.mjs. Итог печатается и пишется в <копия>/swap-result.json.
//
//   node packs/next/swap-test.mjs [--dir /tmp/swap] [--only engine,client]
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, writeFileSync, copyFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const args = process.argv.slice(2);
const argOf = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };

const ONLY = argOf('--only')?.split(',');

const dir = argOf('--dir') ?? mkdtempSync(join(tmpdir(), 'ohh-swap-'));
if (existsSync(dir) && readdirSync(dir).length && !args.includes('--dir')) throw new Error(`${dir} не пустая`);
console.log(`копия: ${dir}`);

// 1. копия без .git и node_modules, затем node_modules жёсткими ссылками
for (const name of readdirSync(ROOT)) {
  if (name === '.git' || name === 'node_modules') continue;
  cpSync(join(ROOT, name), join(dir, name), { recursive: true, verbatimSymlinks: true, filter: (s) => !/\/node_modules(\/|$)/.test(s.slice(ROOT.length)) });
}
const linkModules = (from, to) => { if (existsSync(from)) execFileSync('cp', ['-al', from, to]); };
linkModules(join(ROOT, 'node_modules'), join(dir, 'node_modules'));
for (const ws of ['shared', 'engine', 'ai', 'host', 'server', 'bots', 'client']) linkModules(join(ROOT, ws, 'node_modules'), join(dir, ws, 'node_modules'));

// 2. подстановка
copyFileSync(join(ROOT, 'packs/next/cafe.json'), join(dir, 'packs/cafe.json'));
copyFileSync(join(ROOT, 'packs/next/_common.json'), join(dir, 'packs/_common.json'));
const kb = (f) => Math.round(statSync(f).size / 1024);
console.log(`подставлено: packs/cafe.json ${kb(join(dir, 'packs/cafe.json'))} КБ, packs/_common.json ${kb(join(dir, 'packs/_common.json'))} КБ`);

const run = (label, cmd, cmdArgs, opts = {}) => {
  const t = Date.now();
  const r = spawnSync(cmd, cmdArgs, { cwd: dir, encoding: 'utf8', maxBuffer: 256 << 20, env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' }, ...opts });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  const s = Math.round((Date.now() - t) / 1000);
  console.log(`${r.status === 0 ? 'OK  ' : 'FAIL'} ${label} (${s} с)`);
  return { label, status: r.status, seconds: s, out };
};

const results = [];
results.push(run('validate cafe', 'node', ['build/validate-pack.mjs', 'packs/cafe.json', 'packs/_common.json']));
results.push(run('validate _common', 'node', ['build/validate-pack.mjs', 'packs/_common.json']));
results.push(run('validate-all', 'node', ['scripts/validate-all.mjs']));
results.push(run('npm run check', 'npm', ['run', 'check']));
const workspaces = ONLY ?? ['shared', 'engine', 'ai', 'host', 'server', 'bots', 'client'];
for (const ws of workspaces) results.push(run(`npm test -w ${ws}`, 'npm', ['test', '-w', ws, '--if-present']));
results.push(run('smoke', 'node', ['scripts/smoke.mjs']));

// 3. упавшие тесты по именам
const failed = [];
for (const r of results) {
  if (r.status === 0) continue;
  for (const line of r.out.split('\n')) {
    const m = line.match(/^\s*(?:FAIL|×|✗)\s+(.+)$/);
    if (m && !failed.includes(`${r.label}: ${m[1].trim()}`)) failed.push(`${r.label}: ${m[1].trim()}`);
  }
}
const summary = results.map((r) => {
  const tests = [...r.out.matchAll(/Tests\s+(.+?)\s*$/gm)].map((m) => m[1]).join('; ');
  const tail = r.out.trim().split('\n').slice(-3).join(' | ');
  return { label: r.label, ok: r.status === 0, seconds: r.seconds, tests, tail: r.label.startsWith('validate') || r.label === 'smoke' ? tail : undefined };
});
writeFileSync(join(dir, 'swap-result.json'), JSON.stringify({ summary, failed, logs: Object.fromEntries(results.map((r) => [r.label, r.out])) }, null, 2));
console.log('\nитог:');
for (const s of summary) console.log(`  ${s.ok ? 'OK  ' : 'FAIL'} ${s.label}${s.tests ? ` — ${s.tests}` : ''}${s.tail ? ` — ${s.tail}` : ''}`);
if (failed.length) console.log(`\nупали:\n  ${failed.join('\n  ')}`);
console.log(`\nполные логи: ${join(dir, 'swap-result.json')}`);
console.log(`копия оставлена для разбора; удалить: rm -rf ${dir}`);
process.exit(results.every((r) => r.status === 0) ? 0 : 1);
