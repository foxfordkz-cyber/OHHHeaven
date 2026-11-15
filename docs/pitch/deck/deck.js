// First Year — питч-презентация как кино: десять страниц, на каждой несколько шагов (сцен).
// Четыре приёма движения: счётчик, камера, линия, сквозные деньги. Каждый шаг заканчивается за полторы секунды.
// Числа не набраны руками: data.js (его пишет build.mjs) несёт модель денег, съёмку продукта и счёт репозитория.
// Нарисованные сцены (чек, улица, часы и календарь, лестница, лента суток) строятся здесь же из тех же данных.
(() => {
  const D = window.DECK || {};
  const qs = new URLSearchParams(location.search);
  const root = document.documentElement;
  const printAll = qs.has('print');
  const still = printAll || qs.has('static') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (still) root.classList.add('static');
  if (printAll) root.classList.add('print');

  const pages = [...document.querySelectorAll('.page')];
  const $ = (sel, el = document) => el.querySelector(sel);
  const one = (path) => String(path).split('.').reduce((o, k) => (o == null ? o : o[k]), D);
  // путь в данных; «x,y,w,h» — прямоугольник, набранный на месте; «a+b» — прямоугольник вокруг двух
  const get = (path) => {
    path = String(path);
    if (/^\d+(,\d+){3}$/.test(path)) { const [x, y, w, h] = path.split(',').map(Number); return { x, y, w, h }; }
    if (!path.includes('+')) return one(path);
    const rs = path.split('+').map(one);
    if (rs.some((r) => !r)) return undefined;
    const x = Math.min(...rs.map((r) => r.x)), y = Math.min(...rs.map((r) => r.y));
    return { x, y, w: Math.max(...rs.map((r) => r.x + r.w)) - x, h: Math.max(...rs.map((r) => r.y + r.h)) - y };
  };
  const usd = (n) => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
  const usdM = (n) => '$' + (n / 1e6 >= 10 ? Math.round(n / 1e6) : (n / 1e6).toFixed(n / 1e6 >= 1 ? 1 : 2).replace('.', ',')) + 'M';
  const formats = {
    usd, usdM,
    usdPlus: (n) => (n < 0 ? '−$' : '+$') + Math.abs(Math.round(n)).toLocaleString('en-US'),
    int: (n) => Math.round(n).toLocaleString('ru-RU').replace(/ /g, ' '),
    k: (n) => (n >= 1e4 ? Math.round(n / 1e3) + ' тыс.' : Math.round(n).toLocaleString('ru-RU')),
    x: (n) => '×' + n.toFixed(1).replace('.', ','),
    pct: (n) => (n * 100).toFixed(1).replace('.', ',') + '%',
    pct0: (n) => Math.round(n * 100) + '%',
    text: (s) => String(s),
  };
  const fmt = (el, v) => (formats[el.dataset.f || 'int'] || formats.int)(v);
  // знак доллара в крупном числе красится отдельно (data-cur)
  const write = (el, s) => { if ('cur' in el.dataset) el.innerHTML = String(s).replace(/^([+−-]?)\$/, '$1<i class="cur">$</i>'); else el.textContent = s; };
  const miss = (el, what) => { el.dataset.missing = '1'; el.dataset.v ??= what; };
  const svg = (el, html) => { el.innerHTML = html; };

  const LOGO = '<svg class="logo" viewBox="0 0 32 32" aria-hidden="true"><rect class="logo__tile" width="32" height="32" rx="9"/><path class="logo__ink" d="M6.5 13.2 9 8h14l2.5 5.2v.9a2.3 2.3 0 0 1-4.6.2 2.3 2.3 0 0 1-4.6 0 2.3 2.3 0 0 1-4.6 0 2.3 2.3 0 0 1-4.6-.2Z"/><path class="logo__line" d="M9 18v6.2h14V18" fill="none" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><rect class="logo__door" x="13.6" y="19.2" width="4.8" height="5" rx=".8"/></svg>';
  for (const el of document.querySelectorAll('[data-logo]')) el.innerHTML = LOGO;

  // ── Рамка кадра: знак, раздел, десять делений, номер, уголки ──
  pages.forEach((p, i) => {
    const seg = pages.map((_, k) => `<i class="${k < i ? 'done' : k === i ? 'now' : ''}"></i>`).join('');
    p.insertAdjacentHTML('beforeend', `<div class="chrome" data-nw aria-hidden="true"><div class="chrome__brand">${LOGO}<b>First Year</b><span>${p.dataset.sec || ''}</span></div><div class="chrome__prog">${seg}</div><div class="chrome__no"><b>${String(i + 1).padStart(2, '0')}</b> / ${pages.length}</div><i class="crop crop--tl"></i><i class="crop crop--tr"></i><i class="crop crop--bl"></i><i class="crop crop--br"></i></div>`);
  });

  // ── 1. Чек: строки личного плана из игры; сумма сверена в build.mjs ──
  const receipt = $('.receipt');
  if (receipt) {
    const pl = D.capture?.plan ?? {};
    if (!pl.lines?.length) miss(receipt, 'capture.plan.lines');
    else {
      const row = (label, v, cls = '') => `<div class="rc__row ${cls}"><span>${label}</span><i></i><b>${usd(v)}</b></div>`;
      receipt.innerHTML = `<div class="rc__head">${LOGO}FIRST YEAR · NYC</div><div class="rc__addr">${pl.address}<br>coffee shop · 18 seats</div><div class="rc__rule"></div>`
        + pl.lines.map((l) => row(l.label, l.amount)).join('')
        + `<div class="rc__rule"></div>${row('To open', pl.moneyYouNeed, 'rc__sub')}${row('Reserve · 6 months', pl.reserve, 'rc__sub')}${row('ALL IN', pl.allIn, 'rc__total')}<div class="rc__bars"></div><div class="rc__foot">BEFORE YOU SIGN THE LEASE</div>`;
    }
  }

  // ── 2. Улица: десять витрин; гаснут те, чей шаг наступил (доли — из BLS, facts.json) ──
  const street = $('.street');
  if (street) {
    const N = 10, W = 172.8, G = 380;
    const hs = [262, 304, 276, 326, 258, 296, 314, 268, 300, 280];
    const year = Math.round((D.closed?.year ?? 0) * N), five = Math.round((D.closed?.five ?? 0) * N);
    if (!year || !five) miss(street, 'closed.year');
    // порядок, в котором гаснут: сперва «за год», потом остальные «за пять лет»
    const order = [2, 7, 0, 4, 8, 5, 9, 1, 6, 3];
    const stepOfShop = (i) => { const k = order.indexOf(i); return k < year ? 2 : k < five ? 3 : 0; };
    let h = '<defs><linearGradient id="warm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbe3a0"/><stop offset="1" stop-color="#d9a441"/></linearGradient>'
      + '<radialGradient id="halo"><stop offset="0" stop-color="#e3c260" stop-opacity=".5"/><stop offset="1" stop-color="#e3c260" stop-opacity="0"/></radialGradient></defs>';
    h += `<line x1="-96" y1="${G + 1}" x2="1824" y2="${G + 1}" stroke="#3a3b37" stroke-width="3"/><line x1="-96" y1="${G + 24}" x2="1824" y2="${G + 24}" stroke="#262724" stroke-width="2" stroke-dasharray="38 22"/>`;
    for (let i = 0; i < N; i++) {
      const x = 11 + i * W, hh = hs[i], top = G - hh, st = stepOfShop(i), v = i % 3;
      const d = st ? (order.indexOf(i) % 5) * 0.16 : 0;
      const aw = v === 0 ? ['#e3c260', '#f1f1ee'] : v === 1 ? ['#e3c260', '#e3c260'] : ['#f1f1ee', '#d67d70'];
      let stripes = '';
      for (let k = 0; k < 6; k++) stripes += `<path d="M${4 + k * 23.7} ${G - 150}h23.7l${1.6 + (k + 1) * 0.6 - 2} 34h-${23.7 + 0.6}z" fill="${aw[k % 2]}"/>`;
      let scal = '';
      for (let k = 0; k < 6; k++) scal += `<path d="M${-1 + k * 25.4} ${G - 116}a12.7 11 0 0 0 25.4 0z" fill="${aw[k % 2]}"/>`;
      h += `<g class="shop" ${st ? `data-go="${st}" style="--d:${d.toFixed(2)}s"` : ''} transform="translate(${x.toFixed(1)} 0)">`
        + `<ellipse class="lit" cx="75" cy="${G - 60}" rx="150" ry="120" fill="url(#halo)" opacity=".5"/>`
        + `<rect x="-3" y="${top - 9}" width="156" height="11" rx="2" fill="#30312d"/><rect x="0" y="${top}" width="150" height="${hh}" fill="#171816" stroke="#30312d" stroke-width="2"/>`
        + `<rect x="20" y="${top + 26}" width="38" height="${Math.min(52, hh - 212)}" rx="2" fill="#23241f"/><rect x="92" y="${top + 26}" width="38" height="${Math.min(52, hh - 212)}" rx="2" fill="#23241f"/>`
        + (v !== 1 ? `<rect class="lit" x="92" y="${top + 26}" width="38" height="${Math.min(52, hh - 212)}" rx="2" fill="#e3c260" opacity=".55"/>` : '')
        + `<rect x="8" y="${G - 186}" width="134" height="28" rx="4" fill="#23241f"/><rect class="lit" x="20" y="${G - 176}" width="${58 + v * 16}" height="8" rx="4" fill="#fbe3a0"/>`
        // витрина и дверь: тёмная основа, тёплый свет сверху
        + `<rect x="10" y="${G - 104}" width="84" height="84" rx="3" fill="#0f100f" stroke="#30312d" stroke-width="2"/><rect x="104" y="${G - 104}" width="36" height="104" rx="3" fill="#0f100f" stroke="#30312d" stroke-width="2"/>`
        + `<g class="lit"><rect x="11" y="${G - 103}" width="82" height="82" rx="2" fill="url(#warm)"/><path d="M52 ${G - 103}v82" stroke="#b8862d" stroke-width="2"/><circle cx="32" cy="${G - 80}" r="6" fill="#fff6d8"/><path d="M32 ${G - 103}v17" stroke="#8a6a1f" stroke-width="2"/><rect x="18" y="${G - 46}" width="68" height="6" rx="2" fill="#8a6a1f" opacity=".6"/>`
        + `<rect x="105" y="${G - 103}" width="34" height="102" rx="2" fill="#e8c46a"/><rect x="111" y="${G - 96}" width="22" height="46" rx="2" fill="#fff6d8" opacity=".7"/><circle cx="133" cy="${G - 44}" r="2.6" fill="#8a6a1f"/></g>`
        + `<g class="lit">${stripes}${scal}</g>`
        + (st ? `<g class="shut"><path d="M4 ${G - 150}h142l10 34h-162z" fill="#30312d"/><rect x="11" y="${G - 103}" width="82" height="82" rx="2" fill="#1b1c1a"/><path d="M11 ${G - 90}h82M11 ${G - 77}h82M11 ${G - 64}h82M11 ${G - 51}h82M11 ${G - 38}h82" stroke="#30312d" stroke-width="2"/><rect x="105" y="${G - 103}" width="34" height="102" rx="2" fill="#1b1c1a"/></g>`
          + `<g class="lease" transform="rotate(-6 52 ${G - 62})"><rect x="16" y="${G - 78}" width="72" height="32" rx="3" fill="#f1f1ee"/><text x="52" y="${G - 57}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-weight="800" font-size="11.5" letter-spacing=".6" fill="#a2463c">FOR LEASE</text></g>` : '')
        + '</g>';
    }
    svg(street, h);
  }

  // ── 3. Метки города: места заведений найдены на самом снимке (build.mjs → capture.cityDots) ──
  const lights = $('.streets .lights');
  const dots = D.capture?.cityDots ?? [];
  if (lights && dots.length) {
    lights.innerHTML = dots.map((d, i) => `<circle class="a-fade" style="--d:${(0.5 + (i / dots.length) * 0.6).toFixed(2)}s" cx="${d.x}" cy="${d.y}" r="13"/>`).join('');
    const me = dots[Math.floor(dots.length / 2)];
    // единственный бесконечный цикл презентации: тихий пульс на карте
    lights.insertAdjacentHTML('afterend', `<circle class="beat" data-go="3" cx="${me.x}" cy="${me.y}" r="18"/><circle class="me a-pop" data-go="3" cx="${me.x}" cy="${me.y}" r="11"/>`);
    D.capture.me = { x: me.x - 16, y: me.y - 16, w: 32, h: 32 };
  }

  // ── 5. Клетки: каждое число и каждый тест — своя клетка ──
  for (const el of document.querySelectorAll('.cells')) {
    const n = get(el.dataset.n), on = get(el.dataset.on);
    if (typeof n !== 'number' || typeof on !== 'number') { miss(el, el.dataset.n); continue; }
    let h = '';
    for (let i = 0; i < n; i++) h += `<i style="--i:${i}"${i < on ? ' class="on"' : ''}></i>`;
    el.innerHTML = h;
  }

  // ── 7. Сутки → месяц: стрелка часов делает один оборот, календарь заполняется ──
  const rhythm = $('.rhythm');
  if (rhythm) {
    const cx = 250, cy = 290, R = 204;
    let h = `<circle class="dial" cx="${cx}" cy="${cy}" r="${R}"/>`;
    h += `<circle class="arc a-draw" pathLength="1" style="--t:1.25s;--d:.15s" cx="${cx}" cy="${cy}" r="${R - 30}" transform="rotate(-90 ${cx} ${cy})"/>`;
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2, big = k % 6 === 0, r0 = R - (big ? 64 : 56), r1 = R - 48;
      h += `<line class="tk${big ? ' big' : ''}" x1="${(cx + Math.sin(a) * r0).toFixed(1)}" y1="${(cy - Math.cos(a) * r0).toFixed(1)}" x2="${(cx + Math.sin(a) * r1).toFixed(1)}" y2="${(cy - Math.cos(a) * r1).toFixed(1)}"/>`;
    }
    [['6', 112, 7], ['12', 0, 126], ['18', -112, 7]].forEach(([t, dx, dy]) => { h += `<text x="${cx + dx}" y="${cy + dy}" text-anchor="middle">${t}</text>`; });
    h += `<line class="hand" data-go="1" x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - 122}"/><circle class="hub" cx="${cx}" cy="${cy}" r="13"/>`;
    h += `<text x="${cx}" y="548" text-anchor="middle">1 ДЕНЬ · 24 ЧАСА</text>`;
    h += '<g class="eq a-fade" style="--d:.9s"><path d="M486 290h76M538 262l28 28-28 28"/></g>';
    // лист календаря: тридцать клеток, последняя — день, когда ты вернулся
    h += '<g class="cal" data-go="1"><rect class="sheet" x="596" y="86" width="300" height="408" rx="24"/><path class="band" d="M596 110a24 24 0 0 1 24-24h252a24 24 0 0 1 24 24v58h-300z"/><circle cx="662" cy="127" r="10" fill="#e3c260"/><circle cx="830" cy="127" r="10" fill="#e3c260"/>';
    for (let i = 0; i < 30; i++) {
      const c = i % 6, r = Math.floor(i / 6);
      h += `<rect class="day${i === 29 ? ' last' : ''}" style="--i:${i}" x="${614 + c * 45.6}" y="${196 + r * 56}" width="36" height="44" rx="7"/>`;
    }
    h += '</g><text x="746" y="548" text-anchor="middle">1 МЕСЯЦ · 30 ДНЕЙ</text>';
    svg(rhythm, h);
  }

  // ── 8. Лестница выручки: высота ступеней — из модели денег, шкала логарифмическая ──
  const stairs = $('.stairs');
  const rungAt = [];
  if (stairs) {
    const st = D.model?.steps ?? [];
    if (st.length < 3) miss(stairs, 'model.steps');
    else {
      const top = 204, dec = 168, base = 790, xs = [72, 404, 742, 1112];
      const y = (arr) => top + (8 - Math.log10(arr)) * dec;
      const ys = st.map((s) => y(s.arr));
      let h = '';
      [[1e5, '$0.1M'], [1e6, '$1M'], [1e7, '$10M'], [1e8, '$100M']].forEach(([v, t]) => { h += `<line class="grid" x1="72" x2="1112" y1="${y(v)}" y2="${y(v)}"/><text x="60" y="${y(v) + 6}" text-anchor="end">${t}</text>`; });
      h += `<path class="under" data-go="3" style="--d:.3s" d="M${xs[0]} ${base}V${ys[0]}H${xs[1]}V${ys[1]}H${xs[2]}V${base}Z"/>`;
      h += `<path class="under" data-go="4" style="--d:.5s" d="M${xs[2]} ${base}V${ys[2]}H${xs[3]}V${base}Z"/>`;
      h += `<path class="line a-draw" pathLength="1" data-go="3" style="--t:1.1s;--d:.05s" d="M${xs[0]} ${ys[0]}H${xs[1]}V${ys[1]}H${xs[2]}"/>`;
      h += `<path class="line a-draw" pathLength="1" data-go="4" style="--t:.95s;--d:.05s" d="M${xs[2]} ${ys[1]}V${ys[2]}H${xs[3]}"/>`;
      h += `<circle class="knot" data-go="3" style="--d:.1s" cx="${xs[0]}" cy="${ys[0]}" r="11"/><circle class="knot" data-go="3" style="--d:.55s" cx="${xs[1]}" cy="${ys[1]}" r="11"/><circle class="knot" data-go="4" style="--d:.9s" cx="${xs[3]}" cy="${ys[2]}" r="14"/>`;
      svg(stairs, h);
      rungAt.push({ x: xs[0], y: ys[0] }, { x: xs[1], y: ys[1] }, { x: xs[2], y: ys[2] });
    }
  }
  for (const el of document.querySelectorAll('.rung')) {
    const at = rungAt[Number(el.dataset.rung)];
    if (!at) { miss(el, 'model.steps'); continue; }
    const cs = getComputedStyle(stairs);
    el.style.left = parseFloat(cs.left) + at.x + 30 + 'px';
    el.dataset.top = parseFloat(cs.top) + at.y;
  }

  // ── 9. Лента суток: столбик — коммиты за четверть часа ──
  const dayline = $('.dayline');
  if (dayline) {
    const t = D.repo?.ticks ?? [];
    if (!t.length) miss(dayline, 'repo.ticks');
    else {
      const B = 96, W = 1728, base = 322, H = 290, bins = new Array(B).fill(0);
      for (const x of t) bins[Math.min(B - 1, Math.floor(x * B))]++;
      const max = Math.max(...bins);
      let h = '';
      bins.forEach((n, i) => {
        if (!n) return;
        const bh = Math.max(5, (n / max) * H);
        h += `<rect class="bar${n >= max * 0.6 ? ' peak' : ''}" style="--i:${i}" x="${(i * (W / B) + 2).toFixed(1)}" y="${(base - bh).toFixed(1)}" width="${W / B - 4}" height="${bh.toFixed(1)}" rx="3"/>`;
      });
      h += `<line class="axis" x1="0" y1="${base + 4}" x2="${W}" y2="${base + 4}"/>`;
      for (let hr = 0; hr <= 24; hr += 3) h += `<text x="${(hr / 24) * W}" y="${base + 40}" text-anchor="${hr === 0 ? 'start' : hr === 24 ? 'end' : 'middle'}">${hr} ч</text>`;
      const last = t[t.length - 1] * W;
      h += `<line class="now a-fade" style="--d:1.1s" x1="${last}" x2="${last}" y1="${base - 120}" y2="${base}"/><text class="now-t a-fade" style="--d:1.1s" x="${last + 12}" y="${base - 104}">HEAD · ${String(D.repo.hours).replace('.', ',')} ч</text>`;
      svg(dayline, h);
    }
  }

  // Числа и строки из данных: <b data-v="model.ltv" data-f="usd">. Нет данных — видно сразу, а не тихо пусто.
  for (const el of document.querySelectorAll('[data-v]')) {
    if (el.dataset.missing) continue;
    const v = get(el.dataset.v);
    if (v == null) { el.textContent = '—'; el.dataset.missing = '1'; } else write(el, fmt(el, v));
  }
  for (const el of document.querySelectorAll('[data-html]')) { const v = get(el.dataset.html); if (v) el.innerHTML = v; else miss(el, el.dataset.html); }
  for (const el of document.querySelectorAll('[data-href]')) { const v = get(el.dataset.href); if (v) el.setAttribute('href', v); }
  for (const el of document.querySelectorAll('[data-plural]')) {
    const n = get(el.dataset.plural), f = el.dataset.forms.split('|');
    if (typeof n !== 'number') { miss(el, el.dataset.plural); continue; }
    const a = n % 10, b = n % 100;
    el.textContent = a === 1 && b !== 11 ? f[0] : a >= 2 && a <= 4 && (b < 12 || b > 14) ? f[1] : f[2];
  }
  // ступени стоят над своей площадкой — высота известна только после того, как в них попал текст
  for (const el of document.querySelectorAll('.rung')) if (el.dataset.top) el.style.top = Number(el.dataset.top) - el.offsetHeight - 26 + 'px';

  // Шаг элемента: data-step — появляется на этом шаге; data-go — на этом шаге начинает двигаться (виден и раньше).
  const stepOf = (el) => { const s = el.closest('[data-go],[data-step]'); return s ? Number(s.dataset.go || s.dataset.step) : 1; };
  const stepsOf = (p) => Number(p.dataset.steps || 1);

  // Сквозной счётчик денег: на каждой странице свой шаг истории, от стартового капитала до конца года и обратно.
  let prevMoney = null, prevLabel = '';
  const money = new Map();
  pages.forEach((p) => {
    const to = get(p.dataset.money || '');
    const box = document.createElement('div');
    box.className = 'money';
    box.innerHTML = '<span class="money__label"></span><span class="money__row"><span class="money__delta"></span><span class="money__value"></span></span>';
    p.appendChild(box);
    const from = prevMoney ?? to;
    money.set(p, { box, from, to, step: Number(p.dataset.moneyStep || 1), label: p.dataset.moneyLabel || '', before: prevLabel || p.dataset.moneyLabel || '', delta: !p.dataset.moneyQuiet });
    if (to != null) prevMoney = to;
    prevLabel = p.dataset.moneyLabel || prevLabel;
  });

  // Камера: наезд на часть снимка. Координаты — в точках снимка 1440×900, из съёмки (capture.json → rects).
  // У окна может быть две цели: data-focus (шаг data-cam-step) и data-focus2 (шаг data-cam-step2).
  const cams = new Map();
  for (const win of document.querySelectorAll('.win__view')) {
    const screen = win.querySelector('.screen');
    const cam = win.querySelector('.cam');
    if (!screen || !cam) continue;
    const ws = win.clientWidth / 1440;
    screen.style.setProperty('--ws', ws);
    const vw = Number(win.dataset.vw || 1440); // видимая часть окна в точках снимка
    const vh = Number(win.dataset.vh || win.clientHeight / ws);
    const target = (n) => {
      const f = get(win.dataset['focus' + n] || '');
      if (!f) return null;
      const pad = Number(win.dataset['pad' + n] ?? 40);
      const s = Number(win.dataset['zoom' + n]) || Math.min(vw / (f.w + pad * 2), vh / (f.h + pad * 2));
      const [ax, ay] = (win.dataset['at' + n] || '0.5,0.5').split(',').map(Number);
      return {
        step: Number(win.dataset['camStep' + n] || 1), s,
        tx: Math.min(0, Math.max(vw - s * 1440, vw * ax - s * (f.x + f.w / 2))),
        ty: Math.min(0, Math.max(vh - s * 900, vh * ay - s * (f.y + f.h / 2))),
      };
    };
    const list = [target(''), target('2')].filter(Boolean).sort((a, b) => a.step - b.step);
    const at = (beat) => list.filter((c) => c.step <= beat).pop() ?? { s: 1, tx: 0, ty: 0 };
    // где прямоугольник снимка оказывается в окне к данному шагу
    const box = (r, beat) => { const { s, tx, ty } = at(beat); return { x: ws * (tx + s * r.x), y: ws * (ty + s * r.y), w: ws * s * r.w, h: ws * s * r.h }; };
    cams.set(win, { cam, at, box });
    // обводка и подпись стоят в координатах окна — там, куда к их шагу приехала камера
    const place = (el) => {
      if (el.dataset.xy) { const [x, y] = el.dataset.xy.split(',').map(Number); Object.assign(el.style, { left: x + 'px', top: y + 'px' }); return; }
      const r = get(el.dataset.at);
      if (!r) { miss(el, el.dataset.at); return; }
      const { x, y, w, h } = box(r, stepOf(el));
      const g = Number(el.dataset.grow ?? 6), dx = Number(el.dataset.dx || 0), dy = Number(el.dataset.dy || 0), side = el.dataset.side;
      if (el.classList.contains('ring')) Object.assign(el.style, { left: x - g + 'px', top: y - g + 'px', width: w + g * 2 + 'px', height: h + g * 2 + 'px' });
      else if (side === 'in') Object.assign(el.style, { left: x + dx + 'px', top: y + h / 2 - el.offsetHeight / 2 + dy + 'px' });
      else if (side === 'top') Object.assign(el.style, { left: x + dx + 'px', top: y - el.offsetHeight - (dy || 22) + 'px' });
      else if (side === 'right') Object.assign(el.style, { left: x + w + (dx || 26) + 'px', top: y + h / 2 - el.offsetHeight / 2 + dy + 'px' });
      else Object.assign(el.style, { left: x + dx + 'px', top: y + h + (dy || 18) + 'px' });
    };
    win.querySelectorAll('.ring, .tag').forEach(place);
    // курсор едет в точках снимка: к середине data-to, после нажатия — к data-to2 (экран под ним сдвинулся)
    const cur = win.querySelector('.cursor');
    const to = cur && get(cur.dataset.to);
    if (to) {
      const x1 = to.x + to.w / 2, y1 = to.y + to.h / 2, to2 = get(cur.dataset.to2 || '') || to;
      const set = (k, v) => cur.style.setProperty(k, v + 'px');
      set('--x1', x1); set('--y1', y1); set('--x0', x1 + 260); set('--y0', y1 + 200);
      set('--x2', to2.x + to2.w / 2); set('--y2', to2.y + to2.h / 2);
    }
  }

  // Линия от места на снимке к нарисованному: начало — край обводки или край окна на высоте обводки.
  for (const wire of document.querySelectorAll('.wire')) {
    const page = wire.closest('.page'), frame = $(wire.dataset.win, page), view = frame && $('.win__view', frame), c = view && cams.get(view);
    const r = get(wire.dataset.from || '');
    if (!c || !r) { miss(wire, wire.dataset.from); continue; }
    const b = c.box(r, stepOf(wire));
    const ox = frame.offsetLeft + view.offsetLeft, oy = frame.offsetTop + view.offsetTop;
    const edge = wire.dataset.edge || 'right';
    const cyv = oy + b.y + b.h / 2;
    const p0 = edge === 'left' ? [ox + b.x - 12, cyv] : edge === 'right' ? [ox + b.x + b.w + 12, cyv] : edge === 'win-left' ? [frame.offsetLeft, cyv] : edge === 'win-right' ? [frame.offsetLeft + frame.offsetWidth, cyv] : [ox + b.x + b.w / 2, oy + b.y + b.h + 12];
    const [x1, y1] = wire.dataset.to.split(',').map(Number);
    const [x0, y0] = p0, dx = x1 - x0, dy = y1 - y0;
    const d = wire.dataset.bend === 'drop' ? `M${x0} ${y0}C${x0 - 150} ${y0} ${x1} ${y0 + 30} ${x1} ${y1}` : wire.dataset.bend === 'v' ? `M${x0} ${y0}C${x0 + dx * 0.9} ${y0} ${x1} ${y0 + dy * 0.1} ${x1} ${y1}` : `M${x0} ${y0}C${x0 + dx * 0.55} ${y0} ${x0 + dx * 0.45} ${y1} ${x1} ${y1}`;
    wire.setAttribute('viewBox', '0 0 1920 1080');
    wire.innerHTML = `<path pathLength="1" d="${d}"/><circle cx="${x0}" cy="${y0}" r="9"/><circle cx="${x1}" cy="${y1}" r="11"/>`;
  }

  // Всё, что движется, и счётчики — после того как страницы достроены.
  const MOVING = '[class*="a-"],.f2,.f3,.cursor,.ring,.tag,.wire,.shop,.cells,.beat,h1,[data-step],[data-go]';
  const moving = new Map(pages.map((p) => [p, [...p.querySelectorAll(MOVING)].map((el) => ({ el, step: stepOf(el) }))]));
  const fading = new Map(pages.map((p) => [p, [...p.querySelectorAll('[data-until]')]]));
  // Счётчик: data-seq="1:путь,2:путь" — на каждом названном шаге число набегает от прежнего к новому.
  const counters = new Map(pages.map((p) => [p, [...p.querySelectorAll('[data-seq],[data-count]')].map((el) => ({
    el,
    seq: (el.dataset.seq ? el.dataset.seq.split(',').map((s) => s.split(':')) : [[stepOf(el), el.dataset.v]]).map(([k, path]) => ({ step: Number(k), value: get(path) })),
  }))]));
  for (const list of counters.values()) for (const c of list) if (c.seq.some((s) => typeof s.value !== 'number')) miss(c.el, c.el.dataset.seq);

  const ease = (t) => 1 - Math.pow(1 - t, 3);
  function count(el, from, to, ms, format, animate) {
    const token = (el._run = {});
    if (!animate || !(ms > 0)) { write(el, format(to)); return; }
    const t0 = performance.now();
    const step = (now) => {
      if (el._run !== token) return;
      const t = Math.min(1, (now - t0) / ms);
      write(el, format(from + (to - from) * ease(t)));
      if (t < 1) requestAnimationFrame(step);
    };
    write(el, format(from));
    requestAnimationFrame(step);
  }

  // Поставить страницу на шаг. animate — сыграть движение этого шага; иначе сразу его конечный вид.
  function apply(p, beat, animate) {
    p.dataset.beat = beat;
    for (const { el, step } of moving.get(p)) el.classList.toggle('go', step <= beat);
    for (const el of fading.get(p)) el.classList.toggle('out', Number(el.dataset.until) <= beat);
    for (const win of p.querySelectorAll('.win__view')) {
      const c = cams.get(win);
      if (!c) continue;
      const { s, tx, ty } = c.at(beat);
      c.cam.style.setProperty('--cs', s); c.cam.style.setProperty('--cx', tx + 'px'); c.cam.style.setProperty('--cy', ty + 'px');
    }
    for (const { el, seq } of counters.get(p)) {
      const i = seq.map((s) => s.step <= beat).lastIndexOf(true);
      if (i < 0 || typeof seq[i].value !== 'number') continue;
      const from = i > 0 ? seq[i - 1].value : Number(el.dataset.count) || 0;
      count(el, from, seq[i].value, Number(el.dataset.ms || 1000), (v) => fmt(el, v), animate && seq[i].step === beat);
    }
    const m = money.get(p);
    if (m.to != null) {
      const label = m.box.querySelector('.money__label'), value = m.box.querySelector('.money__value'), delta = m.box.querySelector('.money__delta');
      const on = beat >= m.step, d = m.to - m.from;
      label.textContent = on ? m.label : m.before;
      count(value, m.from, on ? m.to : m.from, 900, usd, animate && beat === m.step && d !== 0);
      delta.textContent = on && d !== 0 && m.delta ? (d > 0 ? '+' : '') + usd(d) : '';
      delta.classList.toggle('up', d > 0);
      m.box.classList.toggle('moved', on && d !== 0 && beat === m.step);
    }
  }
  const quiet = (p, fn) => { p.classList.add('noanim'); fn(); void p.offsetWidth; requestAnimationFrame(() => p.classList.remove('noanim')); };

  // Листание: → пробел клик свайп — следующий шаг; ← — назад; F — весь экран; P — кино само; адрес — #страница.шаг
  const total = pages.reduce((n, p) => n + stepsOf(p), 0);
  const bar = document.querySelector('.progress i');
  let at = -1, beat = 1;
  function show(n, b, animate) {
    n = Math.max(0, Math.min(pages.length - 1, n));
    const p = pages[n];
    b = Math.max(1, Math.min(stepsOf(p), b));
    if (n !== at) {
      const old = pages[at];
      at = n;
      pages.forEach((q, i) => q.classList.toggle('is-on', i === n));
      if (old) setTimeout(() => { if (pages[at] !== old) quiet(old, () => apply(old, 0, false)); }, 650);
      if (animate && b === 1) { p.classList.add('noanim'); apply(p, 0, false); void p.offsetWidth; p.classList.remove('noanim'); void p.offsetWidth; apply(p, 1, true); }
      else quiet(p, () => apply(p, b, false));
    } else if (animate && b === beat + 1) apply(p, b, true);
    else quiet(p, () => apply(p, b, false));
    beat = b;
    if (bar) bar.style.transform = `scaleX(${(pages.slice(0, n).reduce((k, q) => k + stepsOf(q), 0) + b) / total})`;
    try { history.replaceState(null, '', `#${n + 1}${b > 1 ? '.' + b : ''}`); } catch { /* файл открыт во встроенном окне без адреса */ }
  }
  const next = () => { if (beat < stepsOf(pages[at])) show(at, beat + 1, true); else if (at < pages.length - 1) show(at + 1, 1, true); else return false; return true; };
  const prev = () => { if (beat > 1) show(at, beat - 1, false); else if (at > 0) show(at - 1, 99, false); };
  const fromHash = () => { const m = location.hash.match(/^#(\d+)(?:\.(\d+))?/); return m ? [Number(m[1]) - 1, m[2] ? Number(m[2]) : null] : [0, null]; };
  function fit() { root.style.setProperty('--k', Math.min(innerWidth / 1920, innerHeight / 1080)); }

  // Кино само: шаг раз в 2,8 секунды, последний шаг страницы держится дольше.
  let timer = null;
  function play(on) {
    clearTimeout(timer); timer = null;
    root.classList.toggle('playing', on);
    if (!on) return;
    const tick = () => { timer = setTimeout(() => { if (next()) tick(); else play(false); }, beat === stepsOf(pages[at]) ? 3400 : 2800); };
    tick();
  }

  const finalAll = () => pages.forEach((p) => { p.classList.add('is-on'); apply(p, stepsOf(p), false); });
  if (printAll) finalAll();
  else {
    pages.forEach((p) => apply(p, 0, false));
    fit();
    addEventListener('resize', fit);
    addEventListener('hashchange', () => { const [n, b] = fromHash(); if (n !== at || (b ?? 1) !== beat) show(n, b ?? 1, false); });
    addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (['ArrowRight', ' ', 'PageDown', 'Enter'].includes(k)) { e.preventDefault(); play(false); next(); }
      else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); play(false); prev(); }
      else if (k === 'Home') show(0, 1, true);
      else if (k === 'End') show(pages.length - 1, 99, false);
      else if ('fFаА'.includes(k)) { if (document.fullscreenElement) document.exitFullscreen(); else root.requestFullscreen?.(); }
      else if ('pPзЗ'.includes(k)) play(!timer);
    });
    addEventListener('click', (e) => { if (e.target.closest('a')) return; play(false); if (e.clientX < innerWidth * 0.2) prev(); else next(); });
    let sx = null;
    addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
    addEventListener('touchend', (e) => {
      if (sx == null) return;
      const dx = e.changedTouches[0].clientX - sx; sx = null;
      if (Math.abs(dx) > 40) { play(false); if (dx < 0) next(); else prev(); }
    });
    // печать из меню браузера: все страницы сразу в конечном виде
    addEventListener('beforeprint', () => { play(false); root.classList.add('static', 'print'); finalAll(); });
    addEventListener('afterprint', () => location.reload());
    const [n, b] = fromHash();
    // без шага в адресе: при показе — с первой сцены, в конечном виде (?static, reduced motion) — сразу последняя
    show(n, b ?? (still ? 99 : 1), !still && b == null);
    if (qs.has('play') && !still) play(true);
  }
  root.dataset.ready = '1';
})();
