// Live deck: one page at a time, scaled to the screen.
//   → / Space / PageDown / click — next; ← / PageUp / click on the left quarter — back; Home / End;
//   F — full screen; the page number lives in the address (#3); swipe on a phone.
// ?static (used by build.mjs for the PDF and the pictures) keeps every page on the page, in its final state.
// A classic script (not a module), so the deck also runs when opened straight from the file on a laptop.
(function () {
const qrMatrix = (text) => window.FYQR.qrMatrix(text);

const root = document.documentElement;
const pages = [...document.querySelectorAll('section.page')];
const params = new URLSearchParams(location.search);
const isStatic = params.has('static');
const motionOK = !matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- the address of the game: the deck is served by the game itself at /deck/, so its origin is the game ----
function gameAddress() {
  const given = params.get('url');
  if (given) return given;
  const baked = document.querySelector('[data-url]')?.textContent?.trim();
  if (baked && baked !== 'public URL') return baked.startsWith('http') ? baked : `https://${baked}`;
  if (location.protocol === 'http:' || location.protocol === 'https:') return `${location.origin}/`;
  return '';
}
function drawQr(svg, text) {
  const q = qrMatrix(text);
  const quiet = 4;
  const n = q.size + quiet * 2;
  let d = '';
  for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++) if (q.modules[y][x]) d += `M${x + quiet} ${y + quiet}h1v1h-1z`;
  svg.setAttribute('viewBox', `0 0 ${n} ${n}`);
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.innerHTML = `<rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#141513"/>`;
}
const address = gameAddress();
if (address) {
  const shown = address.replace(/^https?:\/\//, '').replace(/\/$/, '');
  for (const el of document.querySelectorAll('[data-url]')) el.textContent = shown;
  for (const svg of document.querySelectorAll('svg[data-qr]')) drawQr(svg, address);
} else {
  for (const el of document.querySelectorAll('[data-url-wrap]')) el.remove();
}

// ---- counters: the final number is in the page; on entry it runs up to it ----
function runCounters(page) {
  if (!motionOK) return;
  for (const el of page.querySelectorAll('[data-count]')) {
    const final = el.dataset.final ?? (el.dataset.final = el.textContent);
    const target = Number(el.dataset.count);
    const fmt = (v) => final.replace(/[\d,. ]*\d/, Math.round(v).toLocaleString('en-US'));
    const start = performance.now();
    const delay = Number(el.dataset.delay ?? 0) * 1000;
    const dur = 1000;
    el.textContent = fmt(0);
    const tick = (now) => {
      const t = Math.min(1, Math.max(0, (now - start - delay) / dur));
      const eased = 1 - (1 - t) ** 3;
      el.textContent = t >= 1 ? final : fmt(target * eased);
      if (t < 1 && page.classList.contains('is-active')) requestAnimationFrame(tick);
      else el.textContent = final;
    };
    requestAnimationFrame(tick);
  }
}

if (isStatic) {
  root.classList.add('static');
} else {
  root.classList.add('live');
  const deck = document.querySelector('.deck');
  const bar = document.querySelector('.deck-bar i');
  const hint = document.querySelector('.deck-hint');
  let current = -1;

  const fit = () => {
    const s = Math.min(innerWidth / 1920, innerHeight / 1080);
    deck.style.setProperty('--scale', String(s));
  };
  fit();
  addEventListener('resize', fit);

  const show = (i, fromHash = false) => {
    i = Math.max(0, Math.min(pages.length - 1, i));
    if (i === current) return;
    const prev = pages[current];
    if (prev) prev.classList.remove('is-active');
    current = i;
    const page = pages[i];
    void page.offsetWidth; // restart the page's animations
    page.classList.add('is-active');
    runCounters(page);
    bar.style.width = `${((i + 1) / pages.length) * 100}%`;
    document.title = `${i + 1}/${pages.length} · First Year`;
    if (!fromHash) history.replaceState(null, '', `#${i + 1}`);
  };
  const fromHash = () => {
    const n = parseInt(location.hash.slice(1), 10);
    return Number.isFinite(n) ? n - 1 : 0;
  };
  show(fromHash(), true);
  addEventListener('hashchange', () => show(fromHash(), true));

  const next = () => show(current + 1);
  const back = () => show(current - 1);
  addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); next(); }
    else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); back(); }
    else if (e.key === 'Home') show(0);
    else if (e.key === 'End') show(pages.length - 1);
    else if (e.key === 'f' || e.key === 'F' || e.key === 'а' || e.key === 'А') {
      if (document.fullscreenElement) document.exitFullscreen();
      else root.requestFullscreen?.().catch(() => {});
    }
  });
  addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    if (e.clientX < innerWidth / 4) back(); else next();
  });
  // touch: a swipe turns the page; a tap works like a click (and the click that follows is cancelled)
  let touch = null;
  addEventListener('touchstart', (e) => { touch = e.touches[0] ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null; }, { passive: true });
  addEventListener('touchend', (e) => {
    const t = e.changedTouches[0];
    if (!touch || !t) return;
    const dx = t.clientX - touch.x;
    const dy = t.clientY - touch.y;
    touch = null;
    e.preventDefault();
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { if (dx < 0) next(); else back(); }
    else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) { if (t.clientX < innerWidth / 4) back(); else next(); }
  }, { passive: false });
  setTimeout(() => hint?.classList.add('is-hidden'), 4000);
}
})();
