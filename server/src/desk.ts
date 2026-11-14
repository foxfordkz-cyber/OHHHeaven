// Пульт ведущего показа: GET /pitch. Большие кнопки вместо консоли (LIVE-SHOW: «никто не читает код или консоль»).
// Страница читает состояние раз в секунду и шлёт команды в POST /api/worlds/pitch/pitch с ключом часов.

const STYLE = `:root{color-scheme:light dark;--bg:#f6f4ef;--fg:#1b1a17;--muted:#69645a;--card:#fff;--line:#e3dfd6;--accent:#1f6f5c;--on-accent:#fff;--warn:#a15c00;--bad:#b3261e;--ok:#1f6f5c}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#121110;--fg:#f0ede6;--muted:#a39d92;--card:#1d1b19;--line:#33302b;--accent:#5fc4a8;--on-accent:#0d201a;--warn:#f0a840;--bad:#ff8a80;--ok:#5fc4a8}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
.wrap{max-width:1180px;margin:0 auto;padding:16px}
header{display:flex;flex-wrap:wrap;gap:12px;align-items:baseline;justify-content:space-between;margin-bottom:12px}
h1{font-size:20px;margin:0}.clock{font:700 28px/1.1 ui-monospace,monospace}.state{font-weight:700;padding:2px 10px;border-radius:999px;border:2px solid currentColor}
.paused{color:var(--warn)}.running{color:var(--ok)}
.grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px}
.card h2{font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:0 0 8px}
.btns{display:grid;gap:8px;grid-template-columns:repeat(2,minmax(0,1fr))}
button{min-height:52px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--fg);font:600 16px system-ui;cursor:pointer}
button.main{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}button.danger{color:var(--bad);border-color:var(--bad)}
button:disabled{opacity:.5;cursor:wait}
.num{font-variant-numeric:tabular-nums}.muted{color:var(--muted)}.small{font-size:13px}
ul{margin:0;padding:0;list-style:none}li{margin:2px 0}.ok{color:var(--ok)}.bad{color:var(--bad)}.warn{color:var(--warn)}
.codes{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.codes img{width:160px;height:160px;background:#fff;border-radius:8px}
code{font:600 18px ui-monospace,monospace;letter-spacing:.12em}
#msg{min-height:22px;margin:8px 0 0}
input{font:16px system-ui;padding:10px;border-radius:8px;border:1px solid var(--line);background:transparent;color:var(--fg);width:100%}`;

const SCRIPT = `
const K='ohh.pitch.key';let key='';try{key=sessionStorage.getItem(K)||''}catch(e){}
const $=(id)=>document.getElementById(id);
const money=(n)=>typeof n==='number'?'$'+Math.round(n).toLocaleString('en-US'):'—';
const esc=(s)=>String(s).replace(/[&<>"]/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
async function api(method,body){const r=await fetch('/api/worlds/pitch/pitch'+(key?'?key='+encodeURIComponent(key):''),{method,headers:{'content-type':'application/json'},body:body?JSON.stringify(body):undefined});const j=await r.json().catch(()=>({ok:false,error:'HTTP '+r.status}));return j}
function render(d){
  $('day').textContent='Day '+d.day+' · '+d.date;
  const st=$('state');st.textContent=d.paused?'PAUSED':'RUNNING '+(d.dayMs/1000)+' s/day';st.className='state '+(d.paused?'paused':'running');
  $('start').textContent=d.atStart?'Prepared moment':'Moved on from day '+d.preparedDay;
  const m=d.summary.maya,v=d.summary.viktor;
  $('maya').innerHTML=m?'<b>'+esc(m.business)+'</b><br><span class=num>cash '+money(m.cash)+' · price $'+m.price.toFixed(2)+' · '+m.seats+' seats</span>':'—';
  $('viktor').innerHTML=v?'<b>'+esc(v.business)+'</b><br><span class=num>cash '+money(v.cash)+'</span><br><span class=small>shortcuts: '+esc(v.shortcuts.join(', ')||'none')+'</span>':'—';
  const c=d.complaint;$('case').innerHTML=c?'<b>'+esc(c.status)+'</b>'+(c.official?' · '+esc(c.official):'')+(c.found.length?'<br>found: '+esc(c.found.join(', ')):'')+(c.fine?'<br>fine '+money(c.fine):'')+(d.autoPause?'<br><span class=warn>pauses itself at the notice</span>':''):'<span class=muted>No complaint yet. Expected: '+esc(d.shortcut.name)+' → '+esc(d.shortcut.reportName)+'</span>';
  $('checks').innerHTML=d.checks.map((x)=>'<li class='+(x.ok?'ok':x.level==='must'?'bad':'warn')+'>'+(x.ok?'✓ ':x.level==='must'?'✗ ':'! ')+esc(x.text)+'</li>').join('');
  const j=d.join;$('guest').innerHTML='<code>'+esc(j.guest.code)+'</code><br><span class=small>'+esc(j.guest.url)+'</span>';
  if(!$('qr').getAttribute('src'))$('qr').setAttribute('src','/p/'+encodeURIComponent(j.guest.code)+'/qr.svg');
  $('owners').innerHTML=j.maya?'Maya <code>'+esc(j.maya.code)+'</code> · Viktor <code>'+esc(j.viktor.code)+'</code><br><span class=small>'+esc(j.enter)+'</span>':'<span class=warn>Owner codes need the clock key.</span>';
  $('keybox').hidden=!!j.maya;
}
async function tick(){const r=await api('GET');if(r.ok)render(r.data);else $('msg').textContent=r.error||'No pitch city on this server';}
async function send(body,label){document.querySelectorAll('button[data-cmd]').forEach((b)=>b.disabled=true);$('msg').textContent=label+'…';const r=await api('POST',body);$('msg').textContent=r.ok?label+': done':label+': '+(r.error||'failed');if(r.ok)render(r.data);document.querySelectorAll('button[data-cmd]').forEach((b)=>b.disabled=false)}
document.querySelectorAll('button[data-cmd]').forEach((b)=>b.addEventListener('click',()=>{const body=JSON.parse(b.dataset.cmd);if(b.dataset.confirm&&!confirm(b.dataset.confirm))return;send(body,b.textContent.trim())}));
$('savekey').addEventListener('click',()=>{key=$('key').value.trim();try{sessionStorage.setItem(K,key)}catch(e){}tick()});
tick();setInterval(tick,1000);`;

export function deskPage(): string {
  const b = (label: string, cmd: object, cls = '', confirm = '') =>
    `<button data-cmd='${JSON.stringify(cmd)}'${cls ? ` class="${cls}"` : ''}${confirm ? ` data-confirm="${confirm}"` : ''}>${label}</button>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pitch Desk</title><style>${STYLE}</style></head><body><div class="wrap">
<header><div><h1>First Year — pitch desk</h1><div class="muted" id="start">Loading…</div></div><div class="clock num" id="day">—</div><span id="state" class="state">—</span></header>
<div class="grid">
<section class="card"><h2>Clock</h2><div class="btns">
${b('Pause', { command: 'pause' }, 'main')}${b('Resume · 1 s/day', { command: 'resume', dayMs: 1000 })}
${b('+1 day', { command: 'advance', days: 1 })}${b('+7 days', { command: 'advance', days: 7 })}
${b('Back to start', { command: 'reset' }, 'danger', 'Return the city to the prepared moment?')}${b('Status', { command: 'status' })}
</div><p id="msg" class="small muted"></p></section>
<section class="card"><h2>Jury choice — for Maya</h2><div class="btns">
${b('Raise the price', { command: 'branch', branch: 'price' })}${b('Add seats', { command: 'branch', branch: 'seats' })}
</div><p class="small muted">Backup only: the main path is Maya's phone, Manage.</p>
<h2>Complaint</h2><div class="btns">${b('Maya reports Viktor · run to notice', { command: 'complaint', run: true }, 'main')}</div>
<p class="small muted">Files the report, runs the city at 1 s per day and pauses at the fine notice.</p></section>
<section class="card"><h2>Maya</h2><p id="maya">—</p><h2>Viktor</h2><p id="viktor">—</p><h2>Case</h2><p id="case">—</p></section>
<section class="card"><h2>Guest join</h2><div class="codes"><img id="qr" alt="QR code for the guest view"><div id="guest"></div></div><h2 style="margin-top:12px">Owner phones</h2><p id="owners"></p>
<div id="keybox" hidden><input id="key" type="password" placeholder="Clock key" aria-label="Clock key"><button id="savekey" style="margin-top:8px;width:100%">Use key</button></div></section>
<section class="card" style="grid-column:1/-1"><h2>City checks</h2><ul id="checks"></ul></section>
</div></div><script>${SCRIPT}</script></body></html>`;
}
