// Пробный прогон сборки города показа без HTTP: печатает проверки, ветки, жалобу и время сборки.
import { buildPitch, pitchSummary } from '@ohh/host/pitch';
import { loadData } from '../src/data';
import { serverDeps } from '../src/deps';

const t0 = performance.now();
const data = loadData();
const setup = buildPitch(data.ctx, serverDeps());
const ms = Math.round(performance.now() - t0);
console.log(setup.log.join('\n'));
console.log(JSON.stringify({ places: setup.places, shortcut: setup.shortcut, complaint: setup.complaint, branches: setup.branches, summary: pitchSummary(setup.start, setup) }, null, 1));
for (const c of setup.checks) console.log(`${c.ok ? 'PASS' : c.level === 'must' ? 'FAIL' : 'WARN'} ${c.id}: ${c.text}`);
console.log(`built in ${ms} ms`);
