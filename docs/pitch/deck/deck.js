// First Year — питч-презентация. Листание, масштаб и четыре приёма движения: счётчик, камера, линия, деньги.
// Числа не набраны руками: data.js (его пишет build.mjs) несёт модель денег, съёмку продукта и счёт репозитория.
(() => {
  const D = window.DECK || {};
  const qs = new URLSearchParams(location.search);
  const root = document.documentElement;
  const printAll = qs.has('print');
  const still = printAll || qs.has('static') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (still) root.classList.add('static');
  if (printAll) root.classList.add('print');

  const pages = [...document.querySelectorAll('.page')];
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
  const usd = (n) => '$' + Math.round(n).toLocaleString('en-US');
  const formats = {
    usd,
    int: (n) => Math.round(n).toLocaleString('ru-RU').replace(/ /g, ' '),
    usdM: (n) => '$' + (n / 1e6 >= 10 ? Math.round(n / 1e6) : (n / 1e6).toFixed(n / 1e6 >= 1 ? 1 : 2).replace('.', ',')) + 'M',
    k: (n) => (n >= 1e4 ? Math.round(n / 1e3) + ' тыс.' : Math.round(n).toLocaleString('ru-RU')),
    x: (n) => n.toFixed(1).replace('.', ',') + '×',
    pct: (n) => (n * 100).toFixed(1).replace('.', ',') + '%',
    text: (s) => String(s),
  };
  const fmt = (el, v) => (formats[el.dataset.f || 'int'] || formats.int)(v);

  // Числа и строки из данных: <b data-v="model.ltv" data-f="usd">. Нет данных — видно сразу, а не тихо пусто.
  for (const el of document.querySelectorAll('[data-v]')) {
    const v = get(el.dataset.v);
    el.textContent = v == null ? '—' : fmt(el, v);
    if (v == null) el.dataset.missing = '1';
  }
  for (const el of document.querySelectorAll('[data-html]')) { const v = get(el.dataset.html); if (v) el.innerHTML = v; else el.dataset.missing = '1'; }
  for (const el of document.querySelectorAll('[data-href]')) { const v = get(el.dataset.href); if (v) el.setAttribute('href', v); }

  // Сквозной счётчик денег: на каждой странице свой шаг истории, от стартового капитала до конца года.
  let prevMoney = null;
  pages.forEach((p, i) => {
    const v = get(p.dataset.money || '');
    const box = document.createElement('div');
    box.className = 'money' + (p.dataset.moneyChip ? ' money--chip' : '');
    box.innerHTML = `<span class="money__label">${p.dataset.moneyLabel || ''}</span><span class="money__value"></span>`;
    const val = box.querySelector('.money__value');
    val.dataset.to = v ?? '';
    val.dataset.from = prevMoney ?? v ?? '';
    val.textContent = v == null ? '—' : usd(v);
    if (v != null) prevMoney = v;
    p.appendChild(box);
    const no = document.createElement('div');
    no.className = 'pageno';
    no.textContent = `${i + 1} / ${pages.length}`;
    p.appendChild(no);
  });

  // Камера: наезд на часть снимка. Координаты — в точках снимка 1440×900, из съёмки (capture.json → rects).
  for (const win of document.querySelectorAll('.win__view')) {
    const screen = win.querySelector('.screen');
    const cam = win.querySelector('.cam');
    if (!screen || !cam) continue;
    const ws = win.clientWidth / 1440;
    screen.style.setProperty('--ws', ws);
    // видимая часть окна в точках снимка (окно может уходить за край страницы)
    const vw = Number(win.dataset.vw || 1440);
    const vh = Number(win.dataset.vh || win.clientHeight / ws);
    const f = get(win.dataset.focus || '');
    let s = 1, tx = 0, ty = 0;
    if (f) {
      const pad = Number(win.dataset.pad || 40);
      s = Number(win.dataset.zoom) || Math.min(vw / (f.w + pad * 2), vh / (f.h + pad * 2));
      const [ax, ay] = (win.dataset.at || '0.5,0.5').split(',').map(Number);
      tx = Math.min(0, Math.max(vw - s * 1440, vw * ax - s * (f.x + f.w / 2)));
      ty = Math.min(0, Math.max(vh - s * 900, vh * ay - s * (f.y + f.h / 2)));
    }
    cam.style.setProperty('--cs', s);
    cam.style.setProperty('--cx', tx + 'px');
    cam.style.setProperty('--cy', ty + 'px');
    // обводка и подпись стоят в координатах окна, на месте, куда приехала камера
    const place = (el) => {
      const r = get(el.dataset.at);
      if (!r) return;
      const g = Number(el.dataset.grow || 6);
      const x = ws * (tx + s * r.x), y = ws * (ty + s * r.y), w = ws * s * r.w, h = ws * s * r.h;
      if (el.classList.contains('ring')) Object.assign(el.style, { left: x - g + 'px', top: y - g + 'px', width: w + g * 2 + 'px', height: h + g * 2 + 'px' });
      else if (el.dataset.side === 'in') Object.assign(el.style, { left: x + Number(el.dataset.dx || 0) + 'px', top: y + h / 2 - el.offsetHeight / 2 + 'px' });
      else if (el.dataset.side === 'corner') Object.assign(el.style, { left: x + w - el.offsetWidth + 16 + 'px', top: y - el.offsetHeight / 2 + 'px' });
      else if (el.dataset.side === 'top') Object.assign(el.style, { left: x + Number(el.dataset.dx || 0) + 'px', top: y - el.offsetHeight - Number(el.dataset.dy || 22) + 'px' });
      else if (el.dataset.side === 'left') Object.assign(el.style, { left: x - el.offsetWidth - Number(el.dataset.dx || 26) + 'px', top: y + h / 2 - el.offsetHeight / 2 + 'px' });
      else if (el.dataset.side === 'right') Object.assign(el.style, { left: x + w + Number(el.dataset.dx || 26) + 'px', top: y + h / 2 - el.offsetHeight / 2 + 'px' });
      else Object.assign(el.style, { left: x + Number(el.dataset.dx || 0) + 'px', top: y + h + Number(el.dataset.dy || 18) + 'px' });
    };
    win.querySelectorAll('.ring, .tag').forEach(place);
    for (const el of win.querySelectorAll('.vline')) {
      const a = get(el.dataset.from), b = get(el.dataset.to);
      if (!a || !b) { el.dataset.missing = '1'; el.dataset.v = el.dataset.from; continue; }
      const y0 = ws * (ty + s * (a.y + a.h / 2)), y1 = ws * (ty + s * (b.y + b.h / 2));
      Object.assign(el.style, { left: ws * (tx + s * (a.x + a.w)) + 18 + 'px', top: y0 + 'px', height: y1 - y0 + 'px' });
    }
    // курсор едет в точках снимка: от data-from к середине data-to
    const cur = win.querySelector('.cursor');
    if (cur) {
      const to = get(cur.dataset.to);
      if (to) {
        const x1 = to.x + to.w / 2, y1 = to.y + to.h / 2;
        cur.style.setProperty('--x1', x1 + 'px'); cur.style.setProperty('--y1', y1 + 'px');
        cur.style.setProperty('--x0', x1 + Number(cur.dataset.fromDx || 260) + 'px'); cur.style.setProperty('--y0', y1 + Number(cur.dataset.fromDy || 200) + 'px');
        // после первого нажатия экран сдвигается: курсор переезжает на новое место той же кнопки
        const to2 = get(cur.dataset.to2 || '') || to;
        cur.style.setProperty('--x2', to2.x + to2.w / 2 + 'px'); cur.style.setProperty('--y2', to2.y + to2.h / 2 + 'px');
      }
    }
  }

  // Метки города: места заведений найдены на самом снимке (build.mjs → capture.cityDots), загораются по очереди.
  const lights = document.querySelector('.streets .lights');
  const dots = D.capture?.cityDots ?? [];
  if (lights && dots.length) {
    lights.innerHTML = dots.map((d, i) => `<circle class="a-fade" style="--d:${(0.7 + (i / dots.length) * 0.6).toFixed(2)}s" cx="${d.x}" cy="${d.y}" r="12"/>`).join('');
    const me = dots[Math.floor(dots.length / 2)];
    // единственный бесконечный цикл презентации: тихий пульс на карте
    lights.insertAdjacentHTML('afterend', `<circle class="beat" cx="${me.x}" cy="${me.y}" r="18"/>`);
  }

  // Лента суток: каждая черта — настоящий коммит; линия рисуется слева направо за секунду.
  const day = document.querySelector('.day');
  if (day && D.repo?.ticks) {
    const W = 1728, H = 250;
    let h = `<line class="axis a-draw" pathLength="1" style="--t:1s;--d:.1s" x1="0" y1="${H}" x2="${W}" y2="${H}"/>`;
    for (const t of D.repo.ticks) h += `<line class="tick" style="--d:${(0.1 + t).toFixed(3)}s" x1="${(t * W).toFixed(1)}" y1="${H - 12}" x2="${(t * W).toFixed(1)}" y2="${H - 12 - 200}" opacity="0.5"/>`;
    for (const hr of [0, 6, 12, 18, 24]) h += `<text x="${(hr / 24) * W}" y="${H + 44}" text-anchor="${hr === 0 ? 'start' : hr === 24 ? 'end' : 'middle'}">${hr}:00</text>`;
    day.innerHTML = h;
  }

  // Счётчик: число набегает за секунду и останавливается.
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  function count(el, from, to, ms, format) {
    if (still || !(ms > 0)) { el.textContent = format(to); return; }
    const t0 = performance.now();
    const token = (el._run = {});
    const step = (now) => {
      if (el._run !== token) return;
      const t = Math.min(1, (now - t0) / ms);
      el.textContent = format(from + (to - from) * ease(t));
      if (t < 1) requestAnimationFrame(step);
    };
    el.textContent = format(from);
    requestAnimationFrame(step);
  }
  function enter(p) {
    for (const el of p.querySelectorAll('[data-count]')) {
      const to = get(el.dataset.v);
      if (typeof to !== 'number') continue;
      const from = Number(el.dataset.count) || 0;
      const delay = Number(el.dataset.delay || 0);
      el.textContent = fmt(el, from);
      setTimeout(() => count(el, from, to, Number(el.dataset.ms || 1100), (v) => fmt(el, v)), still ? 0 : delay);
    }
    const m = p.querySelector('.money__value');
    if (m && m.dataset.to !== '') count(m, Number(m.dataset.from), Number(m.dataset.to), 900, usd);
  }

  // Листание: ← → пробел, клик, свайп; F — весь экран; номер страницы в адресе (#4).
  let at = -1;
  function go(n, quiet) {
    n = Math.max(0, Math.min(pages.length - 1, n));
    if (n === at) return;
    at = n;
    pages.forEach((p, i) => p.classList.toggle('is-on', i === n));
    void pages[n].offsetWidth; // перезапуск движения страницы
    enter(pages[n]);
    if (!quiet) history.replaceState(null, '', '#' + (n + 1));
  }
  const fromHash = () => Math.max(1, parseInt(location.hash.slice(1), 10) || 1) - 1;
  function fit() {
    if (printAll) return;
    root.style.setProperty('--k', Math.min(innerWidth / 1920, innerHeight / 1080));
  }
  if (printAll) {
    pages.forEach((p) => { p.classList.add('is-on'); enter(p); });
  } else {
    fit();
    addEventListener('resize', fit);
    addEventListener('hashchange', () => go(fromHash(), true));
    addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (['ArrowRight', ' ', 'PageDown', 'Enter'].includes(e.key)) { e.preventDefault(); go(at + 1); }
      else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); go(at - 1); }
      else if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(pages.length - 1);
      else if (e.key === 'f' || e.key === 'F' || e.key === 'а' || e.key === 'А') {
        if (document.fullscreenElement) document.exitFullscreen(); else root.requestFullscreen?.();
      }
    });
    addEventListener('click', (e) => { if (e.target.closest('a')) return; go(at + (e.clientX < innerWidth * 0.25 ? -1 : 1)); });
    let sx = null;
    addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
    addEventListener('touchend', (e) => {
      if (sx == null) return;
      const dx = e.changedTouches[0].clientX - sx; sx = null;
      if (Math.abs(dx) > 40) go(at + (dx < 0 ? 1 : -1));
    });
    // печать из меню браузера: все страницы сразу в конечном виде
    addEventListener('beforeprint', () => { root.classList.add('static', 'print'); pages.forEach((p) => { p.classList.add('is-on'); enter(p); }); });
    addEventListener('afterprint', () => location.reload());
    go(fromHash(), true);
  }
  root.dataset.ready = '1';
})();
