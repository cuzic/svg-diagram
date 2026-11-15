// The pages of a presentation (ADR 0056 D4, D7): the viewer's, the presenter's and the print page, the same for the local server and the
// Worker. The script and the stylesheet are strings here (a Worker has no files to read), served at ASSET_JS / ASSET_CSS; a page carries
// its settings as JSON in a <script type="application/json">, so no inline script runs and the pages work under `script-src 'self'`.

export const ASSET_JS = '/assets/present.js', ASSET_CSS = '/assets/present.css';

export interface PageConfig {
  role: 'viewer' | 'presenter';
  /** How this page follows: Server-Sent Events plus POST (local), or a WebSocket (Worker). */
  transport: 'sse' | 'ws';
  /** The SSE or WebSocket URL (a path; the page makes a ws: / wss: URL of it). */
  events: string;
  /** Where a presenter's go is POSTed (sse only). */
  go?: string;
  /** Where a presenter reads the notes (JSON). */
  notes?: string;
  /** The viewer's URL and its QR code (an SVG), shown to the presenter; null where other devices cannot reach this server. */
  viewerUrl?: string | null;
  qrSvg?: string | null;
  /** A note under the QR (how to let other devices in). */
  qrNote?: string;
  /** The SSE warning: a browser opens at most 6 connections to one local server (HTTP/1.1). */
  sseLimit?: boolean;
  /** Where the presenter's page hands the token in its URL's hash (#token=…) for a cookie, before it connects (ADR 0056 D9, D13). */
  claim?: string;
  /** Where the page goes once the token is traded (the Worker's /p/<id>/t goes on to /p/<id>/presenter). */
  afterClaim?: string;
  /** The viewer's page on this server (opened by `p`). */
  viewerPath?: string;
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** JSON that is safe inside a <script> element. */
const scriptJson = (v: unknown): string => JSON.stringify(v).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

function page(title: string, cfg: PageConfig, body: string): string {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">`
    + `<title>${esc(title || 'スライド')}</title><link rel="stylesheet" href="${ASSET_CSS}"></head><body class="${cfg.role}">${body}`
    + `<script type="application/json" id="sd-config">${scriptJson(cfg)}</script><script src="${ASSET_JS}"></script></body></html>`;
}

/** The viewer's page: the current slide filling the window, the connection's state, full screen. */
export function viewerPage(title: string, cfg: PageConfig): string {
  return page(title, cfg, `<main class="stage"><img id="slide" alt=""></main>`
    + `<div id="status" class="status" role="status" hidden></div><div id="live" class="sr" aria-live="polite"></div>`
    + `<button id="fs" class="fs" type="button" title="全画面 (f)" aria-label="全画面">全画面</button>`
    + `<div id="hint" class="hint" hidden>横にすると大きく見えます</div>`);
}

/** The presenter's page: the current and next slides, the notes, the times, the count of viewers, the QR, the problems, the overview. */
export function presenterPage(title: string, cfg: PageConfig): string {
  return page(title, cfg, `<div class="pgrid">`
    + `<section class="cur"><img id="slide" alt=""><div id="live" class="sr" aria-live="polite"></div></section>`
    + `<aside class="side"><div class="next"><div class="label">次</div><img id="next" alt=""></div>`
    + `<div class="bar"><span id="pos">-</span><button id="timer" type="button" title="押すと 0 に">00:00</button><span id="clock"></span><span id="viewers" title="接続している聴き手">聴き手 0</span></div>`
    + `<div id="status" class="status" role="status" hidden></div>`
    + `<pre id="notes" class="notes"></pre>`
    + `<div class="qr"><div id="qr"></div><div id="qrurl" class="qrurl"></div><div id="qrnote" class="qrnote"></div></div>`
    + `<div class="keys">→ / space 次　← 前　Home / End　o 一覧　g 番号へ　f 全画面　p 聴き手の画面を別窓で</div></aside></div>`
    + `<div id="problems" class="problems" hidden></div><div id="overview" class="overview" hidden></div>`);
}

/** Every slide on its own 1280 × 720 page, for the browser's print (no notes). */
export function printPage(title: string, slides: readonly {url: string; text: string}[]): string {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>${esc(title || 'スライド')}</title>`
    + `<link rel="stylesheet" href="${ASSET_CSS}"></head><body class="print">${slides.map(s => `<img src="${esc(s.url)}" alt="${esc(s.text)}">`).join('')}</body></html>`;
}

export const PRESENT_CSS = `*{box-sizing:border-box}[hidden]{display:none!important}html,body{margin:0;height:100%}
body{background:#111;color:#eee;font-family:system-ui,-apple-system,'Hiragino Sans','Noto Sans JP',sans-serif}
body.viewer{overflow:hidden}
.stage{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}
.stage img{max-width:100vw;max-height:100vh;width:100vw;height:auto;aspect-ratio:16/9;object-fit:contain;background:#fff}
@media (min-aspect-ratio:16/9){.stage img{width:auto;height:100vh}}
.status{position:fixed;right:12px;bottom:12px;padding:4px 10px;border-radius:12px;background:#b45309;color:#fff;font-size:13px;z-index:5}
.status.down{background:#b91c1c}
.fs{position:fixed;right:12px;top:12px;opacity:.2;background:#0008;color:#fff;border:0;border-radius:6px;font-size:13px;padding:4px 10px;cursor:pointer}
.fs:hover,.fs:focus{opacity:1}
.hint{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#000c;color:#fff;padding:8px 14px;border-radius:8px;font-size:14px}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
body.hide-cursor{cursor:none}
.pgrid{display:grid;grid-template-columns:minmax(0,2fr) minmax(280px,1fr);gap:12px;height:100vh;padding:12px}
.cur{display:flex;align-items:center;justify-content:center;min-width:0}
.cur img{width:100%;height:auto;aspect-ratio:16/9;background:#fff}
.side{display:flex;flex-direction:column;gap:10px;min-height:0}
.next img{width:100%;aspect-ratio:16/9;background:#fff;opacity:.9}
.label{font-size:12px;color:#aaa}
.bar{display:flex;gap:12px;align-items:center;font-variant-numeric:tabular-nums;font-size:18px;flex-wrap:wrap}
.bar button{font:inherit;background:#333;color:#fff;border:0;border-radius:6px;padding:2px 8px;cursor:pointer}
.notes{flex:1;min-height:80px;overflow:auto;white-space:pre-wrap;font:16px/1.6 inherit;font-family:inherit;margin:0;background:#1c1c1c;padding:10px;border-radius:6px}
.qr{display:flex;flex-direction:column;align-items:flex-start;gap:4px}.qr svg{width:132px;height:132px}
.qrurl{font-size:12px;word-break:break-all;color:#ccc}.qrnote{font-size:12px;color:#fbbf24}
.keys{font-size:11px;color:#888}
body.presenter .status{position:static}
.problems{position:fixed;left:12px;right:12px;bottom:12px;max-height:40vh;overflow:auto;background:#450a0a;border:1px solid #f87171;color:#fee2e2;padding:10px;border-radius:8px;white-space:pre-wrap;font-size:13px}
.overview{position:fixed;inset:0;background:#000e;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;padding:16px;z-index:10}
.overview button{background:none;border:2px solid transparent;padding:0;cursor:pointer;color:#ccc;text-align:left;font-size:12px}
.overview button.at{border-color:#60a5fa}.overview img{width:100%;aspect-ratio:16/9;background:#fff;display:block}
body.print{background:#fff}body.print img{display:block;width:1280px;height:720px;page-break-after:always;break-after:page}
@page{size:1280px 720px;margin:0}
@media (max-width:760px){.pgrid{grid-template-columns:1fr;height:auto}}
`;

/** The page script: follows the server's state, and on the presenter's page moves it. Plain ES2020, no modules. */
export const PRESENT_JS = String.raw`(function () {
'use strict';
var cfg = JSON.parse(document.getElementById('sd-config').textContent);
var presenter = cfg.role === 'presenter';
var $ = function (id) { return document.getElementById(id); };
var held = null, deck = null, notes = null, failures = 0, connectedAt = 0, connected = false, sock = null;
var store = { get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} } };
var LAST = 'sd-last-index:' + location.pathname;

function status(text, down) {
  var s = $('status'); if (!s) return;
  if (!text) { s.hidden = true; return; }
  s.hidden = false; s.textContent = text; s.className = 'status' + (down ? ' down' : '');
}
function takes(got) { return !held || held.epoch !== got.epoch || got.seq > held.seq; }

function show(st) {
  var img = $('slide');
  if (img.getAttribute('src') !== st.slide) { img.src = st.slide; img.alt = st.alt || ''; $('live').textContent = (st.index + 1) + ' / ' + st.total + (st.alt ? ': ' + st.alt.split('\n')[0] : ''); }
  if (presenter) { store.set(LAST, String(st.index)); drawPresenter(); }
}

function onMessage(m) {
  if (m.type === 'hello') { if (presenter && m.role !== 'presenter') status('発表者として認められていません: 発表者の URL を開き直してください', true); }
  else if (m.type === 'state') {
    if (!takes(m)) return;
    var fresh = !held || held.epoch !== m.epoch, last = Number(store.get(LAST));
    held = m; show(m);
    // a local server started again: nobody has moved yet, so the presenter's page puts back the slide it was on (ADR 0056 D6)
    if (presenter && fresh && m.seq === 0 && last > 0 && last !== m.index) send({type: 'go', index: last});
  } else if (m.type === 'deck' && presenter) { deck = m; loadNotes(); drawPresenter(); if (!$('overview').hidden) drawOverview(); }
  else if (m.type === 'count' && presenter) { $('viewers').textContent = '聴き手 ' + m.viewers; }
  else if (m.type === 'problems' && presenter) { var p = $('problems'); var lines = (m.errors || []).map(function (e) { return '✗ ' + e; }).concat((m.warnings || []).map(function (w) { return '⚠ ' + w; })); p.hidden = !(m.errors || []).length; p.textContent = lines.join('\n'); }
}

function loadNotes() {
  if (!cfg.notes) return;
  fetch(cfg.notes, {credentials: 'same-origin', cache: 'no-store'}).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j) { notes = j.notes; drawPresenter(); } }).catch(function () {});
}

function drawPresenter() {
  if (!held) return;
  $('pos').textContent = (held.index + 1) + ' / ' + held.total;
  var nx = deck && deck.slides[held.index + 1], ni = $('next');
  if (nx) { if (ni.getAttribute('src') !== nx.url) { ni.src = nx.url; ni.alt = nx.text || ''; } ni.style.visibility = ''; } else ni.style.visibility = 'hidden';
  $('notes').textContent = notes ? (notes[held.index] || '') : '';
}

function drawOverview() {
  var o = $('overview'); o.textContent = '';
  if (!deck) return;
  deck.slides.forEach(function (s, i) {
    var b = document.createElement('button'); b.type = 'button'; if (held && held.index === i) b.className = 'at';
    var im = document.createElement('img'); im.src = s.url; im.alt = s.text || ''; im.loading = 'lazy';
    b.appendChild(im); b.appendChild(document.createTextNode((i + 1) + '. ' + (s.title || '')));
    b.onclick = function () { send({type: 'go', index: i}); o.hidden = true; };
    o.appendChild(b);
  });
}

function send(msg) {
  if (!presenter) return;
  if (!connected) { status('切断中: 押したキーは届いていません', true); return; }
  if (cfg.transport === 'ws') { try { sock.send(JSON.stringify(msg)); } catch (e) {} return; }
  fetch(cfg.go, {method: 'POST', credentials: 'same-origin', headers: {'content-type': 'application/json'}, body: JSON.stringify(msg)}).then(function (r) {
    if (r.status === 403) status('発表者として認められていません', true);
  }).catch(function () { status('切断中: 押したキーは届いていません', true); });
}

function up() { connected = true; connectedAt = Date.now(); status(''); }
function down() {
  connected = false;
  if (connectedAt && Date.now() - connectedAt >= 10000) failures = 0;
  connectedAt = 0;
  var wait = Math.round(Math.min(30000, 500 * Math.pow(2, failures)) * (0.5 + Math.random()));
  failures++;
  status(presenter ? '切断中: 再接続しています' : '再接続中', presenter);
  setTimeout(connect, wait);
}

function connect() {
  if (cfg.transport === 'ws') {
    var u = new URL(cfg.events, location.href); u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
    var ws; try { ws = new WebSocket(u.href); } catch (e) { down(); return; }
    sock = ws; var closed = false;
    ws.onopen = up;
    ws.onmessage = function (e) { try { onMessage(JSON.parse(e.data)); } catch (x) {} };
    ws.onclose = ws.onerror = function () { if (closed) return; closed = true; down(); };
  } else {
    var es = new EventSource(cfg.events, {withCredentials: true});
    es.onopen = up;
    es.onmessage = function (e) { try { onMessage(JSON.parse(e.data)); } catch (x) {} };
    es.onerror = function () { es.close(); down(); };
  }
}

function fullscreen() { if (document.fullscreenElement) document.exitFullscreen(); else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {}); }

if (presenter) {
  var started = Date.now();
  var two = function (n) { return (n < 10 ? '0' : '') + n; };
  setInterval(function () {
    var s = Math.floor((Date.now() - started) / 1000);
    $('timer').textContent = (s >= 3600 ? Math.floor(s / 3600) + ':' : '') + two(Math.floor(s / 60) % 60) + ':' + two(s % 60);
    var d = new Date(); $('clock').textContent = two(d.getHours()) + ':' + two(d.getMinutes());
  }, 500);
  $('timer').onclick = function () { started = Date.now(); };
  if (cfg.qrSvg) $('qr').innerHTML = cfg.qrSvg;
  if (cfg.viewerUrl) $('qrurl').textContent = cfg.viewerUrl;
  $('qrnote').textContent = (cfg.qrNote || '') + (cfg.sseLimit ? (cfg.qrNote ? '　' : '') + '同じブラウザでこのサーバーの窓を 5 つ以上開かないでください' : '');
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    var k = e.key, o = $('overview');
    if (k === 'Escape' && !o.hidden) { o.hidden = true; return; }
    if (k === 'ArrowRight' || k === ' ' || k === 'PageDown' || k === 'ArrowDown') send({type: 'go', delta: 1});
    else if (k === 'ArrowLeft' || k === 'PageUp' || k === 'ArrowUp') send({type: 'go', delta: -1});
    else if (k === 'Home') send({type: 'go', index: 0});
    else if (k === 'End') send({type: 'go', index: 9999});
    else if (k === 'o') { o.hidden = !o.hidden; if (!o.hidden) drawOverview(); }
    else if (k === 'f') fullscreen();
    else if (k === 'g') { var n = Number(prompt('スライドの番号')); if (n >= 1) send({type: 'go', index: n - 1}); }
    else if (k === 'p') { if (cfg.viewerUrl || cfg.viewerPath) window.open(cfg.viewerPath || cfg.viewerUrl, 'sd-viewer'); }
    else return;
    e.preventDefault();
  });
  var sx = null;
  document.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, {passive: true});
  document.addEventListener('touchend', function (e) { if (sx === null) return; var dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 50) send({type: 'go', delta: dx < 0 ? 1 : -1}); }, {passive: true});
} else {
  $('fs').onclick = fullscreen;
  document.addEventListener('keydown', function (e) { if (e.key === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey) fullscreen(); });
  var hint = function () {
    if (innerHeight > innerWidth * 1.1) { var seen = null; try { seen = localStorage.getItem('sd-hint'); } catch (x) {} if (!seen) { $('hint').hidden = false; try { localStorage.setItem('sd-hint', '1'); } catch (x) {} setTimeout(function () { $('hint').hidden = true; }, 6000); } }
  };
  hint();
}
var idle;
document.addEventListener('mousemove', function () { document.body.classList.remove('hide-cursor'); clearTimeout(idle); idle = setTimeout(function () { document.body.classList.add('hide-cursor'); }, 2000); });
var token = /[#&]token=([A-Za-z0-9_-]+)/.exec(location.hash);
if (presenter && cfg.claim && token) {
  // the token leaves the address bar at once (a projected screen shows it), and is traded for a cookie before the page connects
  history.replaceState(null, '', location.pathname + location.search);
  fetch(cfg.claim, {method: 'POST', credentials: 'same-origin', headers: {'content-type': 'application/json'}, body: JSON.stringify({token: token[1]})})
    .then(function (r) {
      if (r.ok && cfg.afterClaim) { location.replace(cfg.afterClaim); return; }
      if (!r.ok) status('発表者のトークンが違います', true);
      connect();
    }, function () { connect(); });
} else connect();
})();
`;
