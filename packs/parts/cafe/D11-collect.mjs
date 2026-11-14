#!/usr/bin/env node
// D11: подтянуть файлы packs/parts/cafe/ из всех веток в эту ветку.
// У каждого задания (DNN) есть ветка-владелец; файлы задания берутся только из неё (в других ветках лежат старые копии).
// Если у задания два исполнителя в разных ветках, файлы второго сохраняются с суффиксом ветки.
// Запуск из корня репозитория: node packs/parts/cafe/D11-collect.mjs
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const sh = (c) => execSync(c, { encoding: 'utf8', maxBuffer: 64 << 20 });
sh(`git fetch -q origin '+refs/heads/*:refs/remotes/origin/*'`);
const me = sh('git rev-parse --abbrev-ref HEAD').trim();
const DEST = 'packs/parts/cafe/';
const branches = sh(`git for-each-ref --format='%(refname:short)' refs/remotes/origin`).split('\n').filter((b) => b && b !== `origin/${me}`);

// tag -> { branch -> { file -> lastCommitTime } }
const byTag = {};
for (const b of branches) {
  const files = sh(`git ls-tree -r --name-only ${b} -- ${DEST}`).split('\n').filter((f) => f && !/__pycache__|\.pyc$/.test(f));
  for (const f of files) {
    const tag = path.basename(f).slice(0, 3);
    if (!/^D\d\d$/.test(tag) || tag === 'D11') continue;
    // файл «свой» для ветки, если последний коммит, менявший его в этой ветке, сделан не слиянием и не копией из другой ветки
    const t = +sh(`git log -1 --format=%ct ${b} -- "${f}"`).trim();
    ((byTag[tag] ||= {})[b] ||= {})[f] = t;
  }
}
const report = [];
for (const [tag, perBranch] of Object.entries(byTag).sort()) {
  // владелец — ветка, где у задания больше всего файлов и самый свежий коммит; второй исполнитель — ветка со своим файлом, которого нет у владельца, или с более свежей версией общего файла
  const ranked = Object.entries(perBranch).map(([b, files]) => ({ b, n: Object.keys(files).length, t: Math.max(...Object.values(files)) })).sort((x, y) => y.n - x.n || y.t - x.t);
  const owner = ranked[0];
  const ownerFiles = perBranch[owner.b];
  for (const r of ranked) {
    for (const [f, t] of Object.entries(perBranch[r.b])) {
      let target = f;
      if (r.b !== owner.b) {
        const ownT = ownerFiles[f];
        if (ownT !== undefined && ownT >= t) continue;           // у владельца та же или более новая версия
        if (ownT === undefined && !/calibration|D1[5-9]/.test(f)) continue; // чужая старая копия
        if (ownT !== undefined) target = f.replace(/(\.[a-z]+)$/, `.${r.b.split('/').pop().split('-')[0]}$1`);
      }
      const content = sh(`git show ${r.b}:"${f}"`);
      const old = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
      if (old === content) continue;
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content);
      report.push(`${old === null ? 'new' : 'upd'}  ${target}  <- ${r.b}`);
    }
  }
}
console.log(report.join('\n') || 'nothing new');
