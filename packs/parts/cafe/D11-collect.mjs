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
// Ветки-владельцы заданий (по HANDOFF и по коммитам). У D15 два исполнителя: основной файл — awesome-bohr, второй — sharp-goldberg (.sharp).
const OWNERS = {
  D00: 'research/d00-cafe-total-search', D01: 'compassionate-hamilton-4ox21k', D02: 'serene-carson-9rbdw5', D03: 'clever-darwin-vbh10q',
  D04: 'eager-hopper-hqtlhu', D05: 'focused-volta-ebhl7l', D06: 'friendly-gates-gm8x06', D07: 'dreamy-shannon-a980qa', D08: 'sharp-gauss-y0pa2n',
  D09: 'nifty-planck-ri02xf', D10: 'friendly-dijkstra-sd1mpr', D12: 'vigilant-lamport-u5wgaj', D13: 'sharp-goldberg-vai9pv', D14: 'epic-volta-lhqkam',
  D15: 'awesome-bohr-7697u3', D16: 'clever-darwin-vbh10q', D17: 'inspiring-ptolemy-thi9ip', D18: 'gifted-thompson-lwbuji',
};
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
  // владелец задания — ветка из OWNERS; для нового задания — ветка, где у него больше всего файлов и самый свежий коммит.
  // Версия файла в другой ветке: если она совпадает с одной из версий этого файла в истории владельца — это старая копия;
  // иначе это работа второго исполнителя, она сохраняется рядом с суффиксом ветки (D15-calibration-premises.sharp.json).
  const ranked = Object.entries(perBranch).map(([b, files]) => ({ b, n: Object.keys(files).length, t: Math.max(...Object.values(files)) })).sort((x, y) => y.n - x.n || y.t - x.t);
  const fixed = OWNERS[tag] && ranked.find((r) => r.b.endsWith(OWNERS[tag]));
  const owner = fixed || ranked[0];
  const ownerFiles = perBranch[owner.b];
  const history = (f) => new Set(sh(`git log --format=%H ${owner.b} -- "${f}"`).split('\n').filter(Boolean).map((c) => { try { return sh(`git rev-parse ${c}:"${f}"`).trim(); } catch { return ''; } }));
  for (const r of [owner, ...ranked.filter((x) => x !== owner)]) {
    for (const f of Object.keys(perBranch[r.b])) {
      let target = f;
      if (r.b !== owner.b) {
        const blob = sh(`git rev-parse ${r.b}:"${f}"`).trim();
        if (ownerFiles[f] !== undefined && history(f).has(blob)) continue; // старая копия файла владельца
        if (ownerFiles[f] === undefined && !/calibration|D1[5-9]/.test(f)) continue; // чужая копия файла без владельца в этой ветке
        if (ownerFiles[f] !== undefined) target = f.replace(/(\.[a-z]+)$/, `.${r.b.split('/').pop().split('-')[0]}$1`);
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
