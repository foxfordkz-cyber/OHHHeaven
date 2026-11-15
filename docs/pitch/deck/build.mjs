// Собирает презентацию: данные → data.js, снимки страниц → pages/, печать → deck.pdf, копия для сервера → client/public/deck.
//
//   node docs/pitch/deck/build.mjs                       # всё
//   node docs/pitch/deck/build.mjs --url https://<адрес> # адрес игры и QR на последней странице
//   node docs/pitch/deck/build.mjs --data                # только data.js
//
// Числа не набираются руками: деньги — из docs/pitch/model.mjs, экраны и касса — из img/capture.json (capture.mjs),
// счёт репозитория — git и facts.json. Сборка падает, если страниц не десять, на странице больше 15 слов,
// числу не хватило данных или снимок не с компьютера.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1] ?? ''; };
const sh = (cmd) => execSync(cmd, { cwd: repo, maxBuffer: 1 << 26 }).toString().trim();

// ── 1. Данные ──
const model = JSON.parse(sh('node docs/pitch/model.mjs --json'));
const capture = JSON.parse(readFileSync(join(here, 'img/capture.json'), 'utf8'));
const facts = existsSync(join(here, 'facts.json')) ? JSON.parse(readFileSync(join(here, 'facts.json'), 'utf8')) : {};
// Касса по ходу года: шаги сквозного счётчика берутся из съёмки, по дням сезона.
const cash = capture.story?.cash ?? [];
const near = (day) => cash.reduce((best, c) => (best == null || Math.abs(c.day - day) < Math.abs(best.day - day) ? c : best), null);
if (cash.length) {
  capture.story.mid = near(180)?.cash;
  capture.story.midDay = near(180)?.day;
  capture.story.late = near(270)?.cash;
  capture.story.lateDay = near(270)?.day;
}
// Чек на первой странице: строки личного плана из игры. Сумма строк обязана сойтись с итогом на том же экране.
{
  const text = capture.frames?.plan ?? '';
  const names = [['Buying the business', 'Buying the business'], ['Lease deposit', 'Lease deposit'], ['Rent before the first sale', 'Rent before 1st sale'], ['Legal, hiring, insurance and other', 'Legal, hiring, other'], ['Opening order', 'Opening order'], ['Permits and licenses', 'Permits and licenses']];
  const lines = names.map(([full, label]) => { const m = text.match(new RegExp(full.replace(/[.,]/g, '\\$&') + ' \\$([\\d,]+)')); return m ? { label, amount: Number(m[1].replace(/,/g, '')) } : null; });
  const sum = lines.reduce((n, l) => n + (l?.amount ?? NaN), 0);
  if (sum !== capture.plan?.moneyYouNeed || capture.plan.moneyYouNeed + capture.plan.reserve !== capture.plan.allIn) throw new Error(`чек не сходится: строки ${sum}, на экране ${capture.plan?.moneyYouNeed} + ${capture.plan?.reserve} = ${capture.plan?.allIn}`);
  capture.plan.lines = lines;
}
if (capture.manage) capture.manage.delta = capture.manage.profitThen - capture.manage.profitNow;
if (capture.rule?.href) capture.rule.hrefShort = capture.rule.href.replace(/^https?:\/\//, '');
// Доля закрывшихся: из выживаемости по BLS (facts.json → survival, источник в docs/pitch/USER.md)
const closed = facts.survival ? { year: 1 - facts.survival.year1, five: 1 - facts.survival.year5 } : null;
const times = sh('git log --format=%ct').split('\n').map(Number);
const t0 = Math.min(...times);
const utc = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ');
const inDay = times.filter((t) => t - t0 <= 86400);
const repoFacts = {
  commits: inDay.length,
  commitsAll: times.length,
  hours: Math.round((Math.max(...inDay) - t0) / 360) / 10,
  span: `${utc(t0)} — ${utc(Math.max(...inDay))} UTC`,
  ticks: inDay.map((t) => Math.round(((t - t0) / 86400) * 10000) / 10000).sort((a, b) => a - b),
  head: sh('git rev-parse --short HEAD'),
  shallow: sh('git rev-parse --is-shallow-repository') === 'true',
};
if (repoFacts.shallow) console.warn('ВНИМАНИЕ: история неполная (shallow clone) — счёт коммитов занижен; git fetch --unshallow');
// Адрес игры: --url или facts.json. Пока игра не выложена, последняя страница честно ведёт в репозиторий.
const gameUrl = flag('--url') || facts.url || null;
const repoUrl = sh('git remote get-url origin').replace(/^.*github\.com[:/]/, 'https://github.com/').replace(/\.git$/, '');
const url = gameUrl ?? repoUrl;
// тот же генератор QR, что у сервера игры (server/src/qr.ts) — без сети
const qr = sh(`npx tsx docs/pitch/deck/qr.ts ${JSON.stringify(url)}`);
const urlShort = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
const urlNote = gameUrl ? 'Первый месяц своей кофейни — бесплатно, без карты.' : 'QR ведёт в репозиторий. Адрес игры ставит сборка: node docs/pitch/deck/build.mjs --url https://<адрес>';
if (!gameUrl) console.warn('ВНИМАНИЕ: адрес игры не задан — страница 10 ведёт в репозиторий. Пересобери с --url https://<адрес>');
// Метки на снимке города: ищем кружки заведений по цвету на самом снимке, чтобы обводки стояли там, где они есть.
{
  const require = createRequire(import.meta.url);
  const { chromium } = require('playwright');
  const br = await chromium.launch();
  const pg = await br.newPage();
  const src = `data:image/jpeg;base64,${readFileSync(join(here, 'img/city.jpg')).toString('base64')}`;
  capture.cityDots = await pg.evaluate(async (url) => {
    const im = new Image(); im.src = url; await im.decode();
    const c = document.createElement('canvas'); c.width = 1440; c.height = 900;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0, 1440, 900);
    const W = 950, d = g.getImageData(0, 0, W, 900).data, groups = [];
    for (let y = 110; y < 850; y += 2) for (let x = 4; x < W - 4; x += 2) {
      const i = (y * W + x) * 4, r = d[i], gr = d[i + 1], b = d[i + 2];
      const cafe = r > 170 && r < 228 && gr > 120 && gr < 178 && b > 50 && b < 118 && r - b > 80;
      const barber = b > 150 && b < 208 && gr > 128 && gr < 172 && r > 82 && r < 132 && b - r > 45;
      if (!cafe && !barber) continue;
      const k = groups.find((q) => Math.hypot(q.sx / q.n - x, q.sy / q.n - y) < 12);
      if (k) { k.sx += x; k.sy += y; k.n++; k.x0 = Math.min(k.x0, x); k.x1 = Math.max(k.x1, x); k.y0 = Math.min(k.y0, y); k.y1 = Math.max(k.y1, y); }
      else groups.push({ sx: x, sy: y, n: 1, x0: x, x1: x, y0: y, y1: y });
    }
    // кружок заведения — круглое пятно 8–20 точек в поперечнике; плашки мест и пунктир сделок отсеиваются
    return groups.filter((q) => q.n >= 10 && q.x1 - q.x0 <= 20 && q.y1 - q.y0 <= 20 && q.x1 - q.x0 >= 6 && q.y1 - q.y0 >= 6)
      .map((q) => ({ x: Math.round(q.sx / q.n), y: Math.round(q.sy / q.n) })).sort((a, b) => a.x - b.x);
  }, src);
  await br.close();
  console.log(`метки на снимке города: ${capture.cityDots.length}`);
}
const data = { urlShort, urlNote, gameUrl, closed, model: { ...model.outputs, inputs: Object.fromEntries(Object.entries(model.inputs).map(([k, v]) => [k, v.value])) }, capture, repo: repoFacts, facts, url, qr, builtAt: new Date().toISOString() };
writeFileSync(join(here, 'data.js'), `// Пишет build.mjs. Руками не править.\nwindow.DECK = ${JSON.stringify(data)};\n`);
console.log(`data.js: модель, съёмка ${capture.commit} (${capture.world}), ${repoFacts.commits} коммитов за ${repoFacts.hours} ч`);
if (args.includes('--data')) process.exit(0);

// ── 2. Проверки и снимки страниц ──
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const browser = await chromium.launch();
const problems = [];
const index = pathToFileURL(join(here, 'index.html')).href;
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const failed = [];
  page.on('requestfailed', (r) => failed.push(r.url()));
  page.on('request', (r) => { if (/^https?:/.test(r.url())) problems.push(`сеть: ${r.url()}`); });
  page.on('pageerror', (e) => problems.push(`ошибка скрипта: ${e.message}`));
  await page.goto(`${index}?static`);
  await page.waitForFunction(() => document.documentElement.dataset.ready === '1');
  await page.evaluate(() => document.fonts.ready);
  const report = await page.evaluate(() => [...document.querySelectorAll('.page')].map((p, i) => {
    const steps = Number(p.dataset.steps || 1);
    const skip = (el) => el.closest('.src, .money, .pageno, [data-nw], svg, script');
    const stepOf = (el) => { const s = el.closest('[data-step]'); return s ? Number(s.dataset.step) : 1; };
    const untilOf = (el) => { const s = el.closest('[data-until]'); return s ? Number(s.dataset.until) : Infinity; };
    // слова на каждом шаге: только то, что на этом шаге видно
    const words = [];
    for (let b = 1; b <= steps; b++) {
      let n = 0;
      const walk = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
      for (let t = walk.nextNode(); t; t = walk.nextNode()) {
        const el = t.parentElement;
        if (skip(el) || stepOf(el) > b || untilOf(el) <= b) continue;
        n += (t.textContent.match(/[^\s—–·«»"“”().,:;!?→]+/g) ?? []).filter((w) => /\p{L}/u.test(w) && !/^[$\d]/.test(w)).length;
      }
      words.push(n);
    }
    return {
      n: i + 1, steps, words,
      missing: [...p.querySelectorAll('[data-missing]')].map((e) => e.dataset.v),
      images: [...p.querySelectorAll('img')].map((im) => ({ src: im.getAttribute('src'), w: im.naturalWidth, h: im.naturalHeight })),
      h1: Math.round(parseFloat(getComputedStyle(p.querySelector('h1') ?? p).fontSize)),
    };
  }));
  if (report.length !== 10) problems.push(`страниц ${report.length}, нужно 10`);
  for (const r of report) {
    r.words.forEach((w, k) => { if (w > 15) problems.push(`страница ${r.n}, шаг ${k + 1}: ${w} слов, предел 15`); });
    for (const m of r.missing) problems.push(`страница ${r.n}: нет данных для ${m}`);
    for (const im of r.images) {
      if (!im.w) problems.push(`страница ${r.n}: снимок ${im.src} не загрузился`);
      else if (im.w !== 2880 || im.h !== 1800) problems.push(`страница ${r.n}: снимок ${im.src} ${im.w}×${im.h}, а не с компьютера 2880×1800`);
    }
    if (r.h1 < 72) problems.push(`страница ${r.n}: заголовок ${r.h1} px, нужно от 72`);
  }
  for (const f of failed) problems.push(`не загрузилось: ${f}`);
  const beats = report.reduce((n, r) => n + r.steps, 0);
  console.log(report.map((r) => `  ${String(r.n).padStart(2)} · шагов ${r.steps} · слов по шагам ${r.words.join(', ')} · заголовок ${r.h1} px · снимков ${r.images.length}`).join('\n'));
  console.log(`  всего шагов: ${beats}`);

  // каждая страница в конечном виде (pages/page-NN.png) и каждый шаг (pages/beats/NN-K.png)
  rmSync(join(here, 'pages'), { recursive: true, force: true });
  mkdirSync(join(here, 'pages', 'beats'), { recursive: true });
  const cells = [];
  for (const r of report) {
    for (let k = 1; k <= r.steps; k++) {
      await page.goto(`${index}?static#${r.n}.${k}`);
      await page.evaluate((h) => { location.hash = h; }, `#${r.n}.${k}`);
      await page.waitForTimeout(200);
      const file = `beats/${String(r.n).padStart(2, '0')}-${k}.jpg`;
      await page.screenshot({ path: join(here, 'pages', file), type: 'jpeg', quality: 72 });
      cells.push(file);
      if (k === r.steps) await page.screenshot({ path: join(here, 'pages', `page-${String(r.n).padStart(2, '0')}.png`) });
    }
  }
  // раскадровки: десять страниц разом и все шаги разом
  const sheetOf = async (name, files, cols, w) => {
    const h = Math.round((w * 9) / 16), rows = Math.ceil(files.length / cols);
    const sheet = await browser.newPage({ viewport: { width: cols * (w + 8) + 8, height: rows * (h + 8) + 8 }, deviceScaleFactor: 1 });
    writeFileSync(join(here, 'pages', `${name}.html`), `<body style="margin:0;background:#777;display:grid;grid-template-columns:repeat(${cols},${w}px);gap:8px;padding:8px">${files.map((f) => `<img src="${f}" style="width:${w}px;height:${h}px;display:block">`).join('')}</body>`);
    await sheet.goto(pathToFileURL(join(here, 'pages', `${name}.html`)).href);
    await sheet.waitForTimeout(500);
    await sheet.screenshot({ path: join(here, 'pages', `${name}.png`) });
    rmSync(join(here, 'pages', `${name}.html`));
    await sheet.close();
  };
  await sheetOf('storyboard', report.map((r) => `page-${String(r.n).padStart(2, '0')}.png`), 4, 480);
  await sheetOf('beats', cells, 5, 384);

  // ── 3. Печать ──
  const print = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await print.goto(`${index}?print`);
  await print.waitForFunction(() => document.documentElement.dataset.ready === '1');
  await print.evaluate(() => document.fonts.ready);
  await print.waitForTimeout(600);
  await print.pdf({ path: join(here, 'deck.pdf'), width: '1920px', height: '1080px', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  const pdfPages = (readFileSync(join(here, 'deck.pdf')).toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  if (pdfPages !== 10) problems.push(`в deck.pdf ${pdfPages} страниц, нужно 10`);
  console.log(`deck.pdf: ${pdfPages} страниц; pages/: 10 страниц, ${beats} шагов, две раскадровки`);
} finally {
  await browser.close();
}

// ── 4. Копия для сервера игры: client/public/deck → client/dist/deck → адрес /deck/ ──
const pub = join(repo, 'client/public/deck');
rmSync(pub, { recursive: true, force: true });
mkdirSync(pub, { recursive: true });
const html = readFileSync(join(here, 'index.html'), 'utf8');
const used = new Set([...html.matchAll(/img\/[\w.-]+\.(?:jpg|png|svg)/g)].map((m) => m[0]));
for (const f of ['index.html', 'deck.css', 'deck.js', 'data.js', 'deck.pdf']) cpSync(join(here, f), join(pub, f));
cpSync(join(here, 'fonts'), join(pub, 'fonts'), { recursive: true });
mkdirSync(join(pub, 'img'), { recursive: true });
for (const f of used) cpSync(join(here, f), join(pub, f));
if (existsSync(join(repo, 'client/dist'))) cpSync(pub, join(repo, 'client/dist/deck'), { recursive: true });
console.log(`client/public/deck: ${used.size} снимков; сервер игры отдаёт /deck/ после npm run build`);

// ── 5. Один файл: шрифт, снимки и данные внутри — открыть двойным щелчком, переслать, показать без сети ──
{
  const b64 = (f) => readFileSync(join(here, f)).toString('base64');
  const inline = (f) => readFileSync(join(here, f), 'utf8').replace(/<\/(script)/gi, '<\\/$1');
  const css = readFileSync(join(here, 'deck.css'), 'utf8').replace(/url\('(fonts\/[^']+)'\)/g, (_, f) => `url('data:font/woff2;base64,${b64(f)}')`);
  const one = html
    .replace('<link rel="stylesheet" href="deck.css">', () => `<style>\n${css}\n</style>`)
    .replace(/src="(img\/[^"]+\.jpg)"/g, (_, f) => `src="data:image/jpeg;base64,${b64(f)}"`)
    .replace('<script src="data.js"></script>', () => `<script>\n${inline('data.js')}\n</script>`)
    .replace('<script src="deck.js"></script>', () => `<script>\n${inline('deck.js')}\n</script>`);
  writeFileSync(join(here, 'first-year-deck.html'), one);
  console.log(`first-year-deck.html: один файл, ${(one.length / 1e6).toFixed(1)} МБ (в репозиторий не идёт)`);
}

if (problems.length) {
  console.error(`\nНЕ ГОТОВО:\n${problems.map((p) => `  · ${p}`).join('\n')}`);
  process.exit(1);
}
console.log('\nГотово: 10 страниц, проверки пройдены.');
