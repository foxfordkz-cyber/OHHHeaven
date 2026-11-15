// First Year — питч-презентация как кино: десять страниц, на каждой несколько шагов (сцен).
// Четыре приёма движения: счётчик, камера, линия, сквозные деньги. Каждый шаг заканчивается за полторы секунды.
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
  const usd = (n) => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
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

  // Шаг элемента: data-step — появляется на этом шаге; data-go — на этом шаге начинает двигаться (виден и раньше).
  const stepOf = (el) => { const s = el.closest('[data-go],[data-step]'); return s ? Number(s.dataset.go || s.dataset.step) : 1; };
  const stepsOf = (p) => Number(p.dataset.steps || 1);

  // Метки города: места заведений найдены на самом снимке (build.mjs → capture.cityDots), загораются по очереди.
  const lights = document.querySelector('.streets .lights');
  const dots = D.capture?.cityDots ?? [];
  if (lights && dots.length) {
    lights.innerHTML = dots.map((d, i) => `<circle class="a-fade" style="--d:${(0.5 + (i / dots.length) * 0.6).toFixed(2)}s" cx="${d.x}" cy="${d.y}" r="12"/>`).join('');
    const me = dots[Math.floor(dots.length / 2)];
    // единственный бесконечный цикл презентации: тихий пульс на карте
    lights.insertAdjacentHTML('afterend', `<circle class="beat" cx="${me.x}" cy="${me.y}" r="18"/>`);
  }
  // Лента суток: каждая черта — настоящий коммит; линия рисуется слева направо за секунду.
  const day = document.querySelector('.day');
  if (day && D.repo?.ticks) {
    const W = 1728, H = 250;
    let h = `<line class="axis a-draw" pathLength="1" style="--t:1s;--d:.1s" x1="0" y1="${H}" x2="${W}" y2="${H}"/>`;
    for (const t of D.repo.ticks) h += `<line class="tick" style="--d:${(0.1 + t).toFixed(3)}s" x1="${(t * W).toFixed(1)}" y1="${H - 12}" x2="${(t * W).toFixed(1)}" y2="${H - 12 - 200}"/>`;
    for (const hr of [0, 6, 12, 18, 24]) h += `<text x="${(hr / 24) * W}" y="${H + 44}" text-anchor="${hr === 0 ? 'start' : hr === 24 ? 'end' : 'middle'}">${hr}:00</text>`;
    day.innerHTML = h;
  }

  // Сквозной счётчик денег: на каждой странице свой шаг истории, от стартового капитала до конца года и обратно.
  let prevMoney = null, prevLabel = '';
  const money = new Map();
  pages.forEach((p, i) => {
    const to = get(p.dataset.money || '');
    const box = document.createElement('div');
    box.className = 'money' + (p.dataset.moneyChip ? ' money--chip' : '');
    box.innerHTML = '<span class="money__label"></span><span class="money__value"></span><span class="money__delta"></span>';
    p.appendChild(box);
    const from = prevMoney ?? to;
    money.set(p, { box, from, to, step: Number(p.dataset.moneyStep || 1), label: p.dataset.moneyLabel || '', before: prevLabel || p.dataset.moneyLabel || '', delta: !p.dataset.moneyQuiet });
    if (to != null) prevMoney = to;
    prevLabel = p.dataset.moneyLabel || prevLabel;
    const no = document.createElement('div');
    no.className = 'pageno';
    no.textContent = `${i + 1} / ${pages.length}`;
    p.appendChild(no);
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
    const vw = Number(win.dataset.vw || 1440); // видимая часть окна в точках снимка (окно может уходить за край страницы)
    const vh = Number(win.dataset.vh || win.clientHeight / ws);
    const target = (n) => {
      const f = get(win.dataset['focus' + n] || '');
      if (!f) return null;
      const pad = Number(win.dataset['pad' + n] || 40);
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
    cams.set(win, { cam, at });
    // обводка, подпись и линия стоят в координатах окна — там, куда к их шагу приехала камера
    const place = (el) => {
      const r = get(el.dataset.at);
      if (!r) { el.dataset.missing = '1'; el.dataset.v = el.dataset.at; return; }
      const { s, tx, ty } = at(stepOf(el));
      const g = Number(el.dataset.grow || 6);
      const x = ws * (tx + s * r.x), y = ws * (ty + s * r.y), w = ws * s * r.w, h = ws * s * r.h;
      const dx = Number(el.dataset.dx || 0);
      if (el.classList.contains('ring')) Object.assign(el.style, { left: x - g + 'px', top: y - g + 'px', width: w + g * 2 + 'px', height: h + g * 2 + 'px' });
      else if (el.dataset.side === 'in') Object.assign(el.style, { left: x + dx + 'px', top: y + h / 2 - el.offsetHeight / 2 + 'px' });
      else if (el.dataset.side === 'top') Object.assign(el.style, { left: x + dx + 'px', top: y - el.offsetHeight - Number(el.dataset.dy || 22) + 'px' });
      else if (el.dataset.side === 'right') Object.assign(el.style, { left: x + w + (dx || 26) + 'px', top: y + h / 2 - el.offsetHeight / 2 + 'px' });
      else Object.assign(el.style, { left: x + dx + 'px', top: y + h + Number(el.dataset.dy || 18) + 'px' });
    };
    win.querySelectorAll('.ring, .tag').forEach(place);
    for (const el of win.querySelectorAll('.vline')) {
      const a = get(el.dataset.from), b = get(el.dataset.to);
      if (!a || !b) { el.dataset.missing = '1'; el.dataset.v = el.dataset.from; continue; }
      const { s, tx, ty } = at(stepOf(el));
      const y0 = ws * (ty + s * (a.y + a.h / 2)), y1 = ws * (ty + s * (b.y + b.h / 2));
      Object.assign(el.style, { left: ws * (tx + s * (a.x + a.w)) + 18 + 'px', top: y0 + 'px', height: y1 - y0 + 'px' });
    }
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

  // Всё, что движется, и счётчики — после того как страницы достроены.
  const MOVING = '.a-rise,.a-fade,.a-draw,.f2,.f3,.cursor,.ring,.tag,.vline,.shop i,.cal__leaf,.cal__grid i,.tick,.beat,[data-step],[data-go]';
  const moving = new Map(pages.map((p) => [p, [...p.querySelectorAll(MOVING)].map((el) => ({ el, step: stepOf(el) }))]));
  const fading = new Map(pages.map((p) => [p, [...p.querySelectorAll('[data-until]')]]));
  // Счётчик: data-seq="1:путь,2:путь" — на каждом названном шаге число набегает от прежнего к новому.
  const counters = new Map(pages.map((p) => [p, [...p.querySelectorAll('[data-seq],[data-count]')].map((el) => ({
    el,
    seq: (el.dataset.seq ? el.dataset.seq.split(',').map((s) => s.split(':')) : [[stepOf(el), el.dataset.v]]).map(([k, path]) => ({ step: Number(k), value: get(path) })),
  }))]));
  for (const list of counters.values()) for (const c of list) if (c.seq.some((s) => typeof s.value !== 'number')) { c.el.dataset.missing = '1'; c.el.dataset.v ??= c.el.dataset.seq; }

  const ease = (t) => 1 - Math.pow(1 - t, 3);
  function count(el, from, to, ms, format, animate) {
    const token = (el._run = {});
    if (!animate || !(ms > 0)) { el.textContent = format(to); return; }
    const t0 = performance.now();
    const step = (now) => {
      if (el._run !== token) return;
      const t = Math.min(1, (now - t0) / ms);
      el.textContent = format(from + (to - from) * ease(t));
      if (t < 1) requestAnimationFrame(step);
    };
    el.textContent = format(from);
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
      if (old) setTimeout(() => { if (pages[at] !== old) quiet(old, () => apply(old, 0, false)); }, 450);
      if (animate && b === 1) { p.classList.add('noanim'); apply(p, 0, false); void p.offsetWidth; p.classList.remove('noanim'); void p.offsetWidth; apply(p, 1, true); }
      else quiet(p, () => apply(p, b, false));
    } else if (animate && b === beat + 1) apply(p, b, true);
    else quiet(p, () => apply(p, b, false));
    beat = b;
    if (bar) bar.style.transform = `scaleX(${(pages.slice(0, n).reduce((k, q) => k + stepsOf(q), 0) + b) / total})`;
    history.replaceState(null, '', `#${n + 1}${b > 1 ? '.' + b : ''}`);
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
