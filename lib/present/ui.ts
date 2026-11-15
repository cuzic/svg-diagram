// The pages of a presentation (ADR 0056 D4, D7; ADR 0062): the viewer's, the presenter's and the print page, the same for the local server
// and the Worker. The script and the stylesheet are strings here (a Worker has no files to read), served at ASSET_JS / ASSET_CSS; a page carries
// its settings as JSON in a <script type="application/json">, so no inline script runs and the pages work under `script-src 'self'`.

export const ASSET_JS = '/assets/present.js', ASSET_CSS = '/assets/present.css';

export interface PageConfig {
  role: 'viewer' | 'presenter';
  /** How this page follows: Server-Sent Events plus POST (local), or a WebSocket (Worker). */
  transport: 'sse' | 'ws';
  /** The SSE or WebSocket URL (a path; the page makes a ws: / wss: URL of it). */
  events: string;
  /** Where a presenter's messages (go, link, pointer) are POSTed (sse only). */
  go?: string;
  /** The print page (every slide, for the browser's print to PDF). */
  print?: string;
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

const OVERVIEW = `<div id="overview" class="overview" hidden role="dialog" aria-label="スライドの一覧"></div>`;
const HELP = `<div id="help" class="help" hidden role="dialog" aria-label="ショートカットキー"><div class="helpbox"><h2>ショートカットキー</h2><div id="helpkeys"></div><p>? か Esc で閉じる</p></div></div>`;

/**
 * The viewer's page (ADR 0062): the slide filling the window, moved by the presenter while linked, and by the viewer too (keys, the bar,
 * a swipe, the wheel, the overview, a slide number); the bar shows where the presenter is and brings the viewer back there.
 */
export function viewerPage(title: string, cfg: PageConfig): string {
  return page(title, cfg, `<main class="stage" id="stage"><div class="zbox" id="zbox"><img id="slide" alt="" draggable="false"><div id="spot" class="spot" hidden></div><div id="laser" class="laser" hidden></div></div></main>`
    + `<div id="progress" class="progress"><div id="progressbar"></div></div>`
    + `<nav id="nav" class="nav" aria-label="スライドの操作">`
    + `<button id="prev" type="button" title="前 (←)" aria-label="前のスライド">‹</button><span id="pos" class="pos">-</span>`
    + `<button id="next" type="button" title="次 (→)" aria-label="次のスライド">›</button>`
    + `<button id="zout" type="button" title="縮小 (-)" aria-label="縮小">－</button><button id="zreset" type="button" title="元の大きさ (0)">100%</button><button id="zin" type="button" title="拡大 (+)" aria-label="拡大">＋</button>`
    + `<button id="ov" type="button" title="一覧 (o)">一覧</button><button id="fs" type="button" title="全画面 (f)">全画面</button>`
    + `${cfg.print ? `<a id="print" href="${esc(cfg.print)}" target="_blank" rel="noopener" title="全スライドを印刷・PDF に">印刷</a>` : ''}`
    + `<button id="helpbtn" type="button" title="ショートカットキー (?)" aria-label="ショートカットキー">?</button><button id="follow" type="button" class="follow" hidden></button></nav>`
    + `<div id="status" class="status" role="status" hidden></div><div id="live" class="sr" aria-live="polite"></div>`
    + `<div id="hint" class="hint" hidden>横にすると大きく見えます</div>${OVERVIEW}${HELP}`);
}

/** The presenter's page: the current and next slides, the notes, the timer and pace, linking, the laser, the count of viewers, the QR, the problems. */
export function presenterPage(title: string, cfg: PageConfig): string {
  return page(title, cfg, `<div class="pgrid">`
    + `<section class="cur"><div class="curwrap zbox" id="stage"><img id="slide" alt="" draggable="false"><div id="spot" class="spot" hidden></div><div id="laser" class="laser" hidden></div></div><div id="live" class="sr" aria-live="polite"></div>`
    + `<div class="pnav"><button id="prev" type="button" aria-label="前のスライド">‹ 前</button><span id="pos" class="pos">-</span><button id="next" type="button" aria-label="次のスライド">次 ›</button>`
    + `<span class="zctl"><button id="zout" type="button" title="縮小 (-)" aria-label="縮小">－</button><button id="zreset" type="button" title="元の大きさ (0)。連動中は聴き手にも見える">100%</button><button id="zin" type="button" title="拡大 (+)" aria-label="拡大">＋</button></span></div></section>`
    + `<aside class="side"><div class="nextslide"><div class="label">次</div><img id="nextimg" alt=""></div>`
    + `<div class="bar"><span id="timer" class="timer">00:00</span><button id="tstart" type="button" title="開始・一時停止 (t)">開始</button><button id="treset" type="button" title="0 に戻す (r)">0 に</button>`
    + `<label class="dur">予定 <input id="duration" type="number" min="1" max="600" step="1" value="30"> 分</label><span id="clock"></span></div>`
    + `<div id="pace" class="pace" title="予定の時間に対する、今のスライドの位置"><div id="pacetime"></div><div id="paceslide"></div></div><div id="pacenote" class="pacenote"></div>`
    + `<div class="bar"><button id="link" type="button" class="on" aria-pressed="true" title="連動 (k): 入っていると、動かすたびに聴き手も同じスライドに移る">連動 ON</button>`
    + `<button id="laserbtn" type="button" aria-pressed="false" title="レーザー (l): スライドの上でマウスを動かすと、聴き手に赤い点が出る">レーザー</button>`
    + `<button id="spotbtn" type="button" aria-pressed="false" title="スポットライト (s): マウスの周りだけを明るく、ほかを暗くする。[ ] で大きさ">スポット</button>`
    + `<span id="viewers" title="接続している聴き手">聴き手 0</span></div>`
    + `<div id="status" class="status" role="status" hidden></div>`
    + `<pre id="notes" class="notes"></pre>`
    + `<div class="qr"><div id="qr"></div><div id="qrurl" class="qrurl"></div><div id="qrnote" class="qrnote"></div></div>`
    + `<div class="keys">? でショートカットキーの一覧　→ 次　← 前　o 一覧　+ / − 拡大・縮小　k 連動　l レーザー　s スポットライト　t タイマー</div></aside></div>`
    + `<div id="problems" class="problems" hidden></div>${OVERVIEW}${HELP}`);
}

/** Every slide on its own 1280 × 720 page, for the browser's print (no notes). */
export function printPage(title: string, slides: readonly {url: string; text: string}[]): string {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>${esc(title || 'スライド')}</title>`
    + `<link rel="stylesheet" href="${ASSET_CSS}"></head><body class="print">${slides.map(s => `<img src="${esc(s.url)}" alt="${esc(s.text)}">`).join('')}</body></html>`;
}

export const PRESENT_CSS = `*{box-sizing:border-box}[hidden]{display:none!important}html,body{margin:0;height:100%}
body{background:#111;color:#eee;font-family:system-ui,-apple-system,'Hiragino Sans','Noto Sans JP',sans-serif}
body.viewer{overflow:hidden}
button,.nav a{font:inherit;background:#333;color:#fff;border:0;border-radius:6px;padding:4px 10px;cursor:pointer;text-decoration:none}
button:focus-visible,.nav a:focus-visible{outline:2px solid #60a5fa;outline-offset:2px}
.stage{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}
.zbox{position:relative;overflow:hidden;touch-action:none}
.stage .zbox{width:100vw;max-height:100vh;aspect-ratio:16/9}
@media (min-aspect-ratio:16/9){.stage .zbox{width:auto;height:100vh}}
.zbox img{display:block;width:100%;height:100%;background:#fff;transition:opacity .18s;transform-origin:0 0;user-select:none;-webkit-user-drag:none}
body.zoomed .zbox{cursor:grab}body.zoomed.panning .zbox{cursor:grabbing}
.zctl{display:inline-flex;gap:4px;margin-left:12px}.zctl button{font-size:15px;padding:6px 10px}
img.fading{opacity:.15}
@media (prefers-reduced-motion:reduce){.zbox img{transition:none}}
.spot{position:absolute;inset:0;pointer-events:none;z-index:3;transition:background .05s}
.help{position:fixed;inset:0;background:#000b;display:flex;align-items:center;justify-content:center;z-index:12;padding:16px}
.helpbox{background:#1c1c1c;border:1px solid #444;border-radius:10px;padding:16px 20px;max-width:720px;max-height:90vh;overflow:auto;font-size:14px}
.helpbox h2{margin:0 0 10px;font-size:18px}.helpbox p{margin:10px 0 0;color:#aaa;font-size:12px}
.helpbox table{border-collapse:collapse;width:100%}.helpbox td{padding:3px 8px;border-top:1px solid #333;vertical-align:top}.helpbox td:first-child{white-space:nowrap;color:#93c5fd;font-family:ui-monospace,monospace}
.helpbox th{text-align:left;padding:10px 8px 4px;color:#fbbf24;font-weight:600}
#spotbtn[aria-pressed=true]{background:#7c3aed}
.laser{position:absolute;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;background:#ef4444;box-shadow:0 0 12px 4px #ef4444aa;pointer-events:none;z-index:4}
.progress{position:fixed;left:0;right:0;bottom:0;height:3px;background:#0004;z-index:3}.progress div{height:100%;width:0;background:#60a5fa;transition:width .2s}
.nav{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);display:flex;gap:6px;align-items:center;background:#000c;padding:6px 8px;border-radius:10px;z-index:6;opacity:0;transition:opacity .2s;font-size:14px;max-width:calc(100vw - 16px);flex-wrap:wrap;justify-content:center}
.nav.show,.nav:focus-within{opacity:1}
.nav .pos{min-width:64px;text-align:center;font-variant-numeric:tabular-nums}
.follow{background:#1d4ed8}.follow.off{background:#b45309}
.status{position:fixed;right:12px;top:12px;padding:4px 10px;border-radius:12px;background:#b45309;color:#fff;font-size:13px;z-index:7}
.status.down{background:#b91c1c}
.hint{position:fixed;left:50%;top:24px;transform:translateX(-50%);background:#000c;color:#fff;padding:8px 14px;border-radius:8px;font-size:14px;z-index:7}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
body.hide-cursor{cursor:none}
.pgrid{display:grid;grid-template-columns:minmax(0,2fr) minmax(300px,1fr);gap:12px;height:100vh;padding:12px}
.cur{display:flex;flex-direction:column;justify-content:center;gap:8px;min-width:0}
.curwrap{position:relative;width:100%;aspect-ratio:16/9}
body.lasering .curwrap{cursor:crosshair}
.pnav{display:flex;gap:8px;align-items:center;justify-content:center}.pnav button{font-size:18px;padding:8px 22px}.pnav .pos{min-width:80px;text-align:center;font-variant-numeric:tabular-nums;font-size:18px}
.side{display:flex;flex-direction:column;gap:10px;min-height:0}
.nextslide img{width:100%;aspect-ratio:16/9;background:#fff;opacity:.9}
.label{font-size:12px;color:#aaa}
.bar{display:flex;gap:8px;align-items:center;font-variant-numeric:tabular-nums;flex-wrap:wrap}
.timer{font-size:24px;min-width:72px}.dur{font-size:13px;color:#ccc}.dur input{width:56px;background:#222;color:#fff;border:1px solid #444;border-radius:4px;padding:2px 4px}
#clock{margin-left:auto;font-size:18px}
#link.on{background:#1d4ed8}#laserbtn[aria-pressed=true]{background:#b91c1c}
.pace{position:relative;height:8px;background:#222;border-radius:4px;overflow:hidden}.pace div{position:absolute;left:0;top:0;bottom:0}
#pacetime{background:#555;width:0}#paceslide{background:#22c55e;height:4px;top:2px;width:0}
.pacenote{font-size:12px;color:#aaa;min-height:1em}.pacenote.late{color:#f87171}.pacenote.early{color:#60a5fa}
.notes{flex:1;min-height:80px;overflow:auto;white-space:pre-wrap;font:16px/1.6 inherit;font-family:inherit;margin:0;background:#1c1c1c;padding:10px;border-radius:6px}
.qr{display:flex;flex-direction:column;align-items:flex-start;gap:4px}.qr svg{width:132px;height:132px}
.qrurl{font-size:12px;word-break:break-all;color:#ccc}.qrnote{font-size:12px;color:#fbbf24}
.keys{font-size:11px;color:#888}
body.presenter .status{position:static}
.problems{position:fixed;left:12px;right:12px;bottom:12px;max-height:40vh;overflow:auto;background:#450a0a;border:1px solid #f87171;color:#fee2e2;padding:10px;border-radius:8px;white-space:pre-wrap;font-size:13px;z-index:8}
.overview{position:fixed;inset:0;background:#000e;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));align-content:start;gap:12px;padding:16px;z-index:10}
.overview button{background:none;border:2px solid transparent;padding:0;cursor:pointer;color:#ccc;text-align:left;font-size:12px}
.overview button.at{border-color:#60a5fa}.overview button.here{border-color:#f59e0b}.overview img{width:100%;aspect-ratio:16/9;background:#fff;display:block}
body.print{background:#fff}body.print img{display:block;width:1280px;height:720px;page-break-after:always;break-after:page}
@page{size:1280px 720px;margin:0}
@media (max-width:760px){.pgrid{grid-template-columns:1fr;height:auto}.pnav button{flex:1;font-size:22px;padding:14px}}
`;

/** The page script (ADR 0062): follows the server's state, lets a viewer move on their own, and on the presenter's page moves it. Plain ES2020, no modules. */
export const PRESENT_JS = String.raw`(function () {
'use strict';
var cfg = JSON.parse(document.getElementById('sd-config').textContent);
var presenter = cfg.role === 'presenter';
var $ = function (id) { return document.getElementById(id); };
var held = null, deck = null, notes = null, failures = 0, connectedAt = 0, connected = false, sock = null;
// a viewer's own place: following the presenter, or where they moved to (ADR 0062)
var pos = -1, following = true, pointer = null;
// the zoom (ADR 0063): z times around (x, y) of the slide (0..1); own: this viewer zoomed by themselves (the presenter's zoom no longer applies
// until the slide changes); shown: the slide the zoom is for (a new slide is whole again)
var presenterZoom = null, zoom = {z: 1, x: 0.5, y: 0.5, own: false, shown: -1, timer: 0}, MAX_ZOOM = 6, lastZoomSent = 0, lasering = false, spotting = false, spotR = 0.12, lastPointer = 0;
var store = { get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} } };
var keep = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
var LAST = 'sd-last-index:' + location.pathname;
var total = function () { return deck ? deck.slides.length : held ? held.total : 0; };

function status(text, down) {
  var s = $('status'); if (!s) return;
  if (!text) { s.hidden = true; return; }
  s.hidden = false; s.textContent = text; s.className = 'status' + (down ? ' down' : '');
}
function takes(got) { return !held || held.epoch !== got.epoch || got.seq > held.seq; }
function slideAt(i) {
  if (deck && deck.slides[i]) return deck.slides[i];
  if (held && i === held.index) return {url: held.slide, text: held.alt, title: ''};
  return null;
}
function setImg(img, url, alt) {
  if (!url || img.getAttribute('src') === url) return;
  img.classList.add('fading');
  img.onload = function () { img.classList.remove('fading'); };
  img.onerror = function () { img.classList.remove('fading'); };
  img.src = url; img.alt = alt || '';
}

// --- what this page shows ------------------------------------------------------------------------------------------------
function draw() {
  var i = presenter ? (held ? held.index : -1) : pos, s = slideAt(i);
  if (!s) return;
  if (zoom.shown !== i) { zoom.shown = i; zoom.z = 1; zoom.x = 0.5; zoom.y = 0.5; zoom.own = false; applyZoom(); }
  setImg($('slide'), s.url, s.text);
  var n = total();
  $('pos').textContent = (i + 1) + ' / ' + n;
  $('live').textContent = (i + 1) + ' / ' + n + (s.text ? ': ' + s.text.split('\n')[0] : '');
  if (!presenter) {
    $('progressbar').style.width = (n ? (i + 1) / n * 100 : 0) + '%';
    try { history.replaceState(null, '', '#' + (i + 1)); } catch (e) {}
    var f = $('follow'), at = held ? held.index : -1;
    if (at < 0) f.hidden = true;
    else if (following && i === at) { f.hidden = false; f.className = 'follow'; f.textContent = held.linked ? '発表者に連動中' : '発表者と同じ'; }
    else { f.hidden = false; f.className = 'follow off'; f.textContent = '発表者に合わせる (' + (at + 1) + ')'; }
    showLaser();
  } else {
    store.set(LAST, String(i));
    var nx = slideAt(i + 1), ni = $('nextimg');
    if (nx) { setImg(ni, nx.url, nx.text); ni.style.visibility = ''; } else ni.style.visibility = 'hidden';
    $('notes').textContent = notes ? (notes[i] || '') : '';
    pace();
  }
  if (!$('overview').hidden) drawOverview();
}

// --- zoom ------------------------------------------------------------------------------------------------------------------------
var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
function applyZoom() {
  var img = $('slide'), z = zoom.z, w = img.offsetWidth, h = img.offsetHeight;
  zoom.x = clamp(zoom.x, 0.5 / z, 1 - 0.5 / z); zoom.y = clamp(zoom.y, 0.5 / z, 1 - 0.5 / z);
  img.style.transform = z === 1 ? '' : 'translate(' + (w / 2 - z * zoom.x * w) + 'px,' + (h / 2 - z * zoom.y * h) + 'px) scale(' + z + ')';
  document.body.classList.toggle('zoomed', z > 1);
  var r = $('zreset'); if (r) r.textContent = Math.round(z * 100) + '%';
  showLaser();
}
/** Zoom to z around (x, y); own: the viewer's own doing. The presenter's zoom goes to the viewers while linked. */
function setZoom(z, x, y, own) {
  zoom.z = clamp(z, 1, MAX_ZOOM); zoom.x = x; zoom.y = y;
  if (zoom.z < 1.01) { zoom.z = 1; zoom.x = 0.5; zoom.y = 0.5; }
  if (!presenter && own) zoom.own = true;
  applyZoom();
  if (presenter && held) {
    var t = Date.now();
    clearTimeout(zoom.timer);
    var out = function () { lastZoomSent = Date.now(); send({type: 'zoom', index: held.index, z: Math.round(zoom.z * 1e3) / 1e3, x: Math.round(zoom.x * 1e4) / 1e4, y: Math.round(zoom.y * 1e4) / 1e4}); };
    if (t - lastZoomSent >= 60) out(); else zoom.timer = setTimeout(out, 60);
  }
}
/** Zoom by factor keeping the point under (cx, cy) on the screen where it is (the middle of the slide without a point). */
function zoomBy(factor, cx, cy) {
  var r = $('slide').getBoundingClientRect(), box = $('stage').getBoundingClientRect(), w = $('slide').offsetWidth, h = $('slide').offsetHeight;
  if (cx === undefined) { cx = box.left + box.width / 2; cy = box.top + box.height / 2; }
  var px = (cx - r.left) / r.width, py = (cy - r.top) / r.height, z2 = clamp(zoom.z * factor, 1, MAX_ZOOM);
  var sx = (cx - box.left) - w / 2, sy = (cy - box.top) - h / 2;
  setZoom(z2, px - sx / (z2 * w), py - sy / (z2 * h), true);
}
function panBy(dx, dy) { if (zoom.z <= 1) return; var w = $('slide').offsetWidth, h = $('slide').offsetHeight; setZoom(zoom.z, zoom.x - dx / (zoom.z * w), zoom.y - dy / (zoom.z * h), true); }
function resetZoom() { setZoom(1, 0.5, 0.5, true); }

function showLaser() {
  var l = $('laser'), sp = $('spot'), img = $('slide');
  if (!pointer || pointer.index !== (presenter ? held && held.index : pos)) { l.hidden = true; sp.hidden = true; return; }
  var r = img.getBoundingClientRect(), box = $('stage').getBoundingClientRect();
  var x = r.left - box.left + pointer.x * r.width, y = r.top - box.top + pointer.y * r.height;
  if (pointer.spot) {
    // the spotlight: a circle of radius r (a share of the slide's width, as it is drawn now) stays bright, the rest is dimmed
    var rad = pointer.r * r.width;
    l.hidden = true; sp.hidden = false;
    sp.style.background = 'radial-gradient(circle at ' + x + 'px ' + y + 'px, transparent ' + rad + 'px, rgba(0,0,0,.72) ' + (rad + 3) + 'px)';
    return;
  }
  sp.hidden = true; l.hidden = false;
  l.style.left = x + 'px';
  l.style.top = y + 'px';
}

// --- moving -------------------------------------------------------------------------------------------------------------------
/** A viewer moving on their own: they stop following until they come back (the bar's button) or the presenter moves while linked. */
function goto(i) {
  var n = total(); if (!n) return;
  i = Math.max(0, Math.min(n - 1, i));
  if (presenter) { send({type: 'go', index: i}); return; }
  // back on the presenter's slide is following again; anywhere else is the viewer's own
  pos = i; following = !!held && i === held.index;
  draw();
}
function step(d) { if (presenter) send({type: 'go', delta: d}); else goto(pos + d); }
function backToPresenter() {
  if (!held) return;
  following = true; pos = held.index; draw();
  // and to the presenter's zoom, if they have one on this slide
  zoom.own = false;
  var m = presenterZoom;
  if (m && m.index === pos) { zoom.z = m.z; zoom.x = m.x; zoom.y = m.y; } else { zoom.z = 1; zoom.x = 0.5; zoom.y = 0.5; }
  applyZoom();
}

function onMessage(m) {
  if (m.type === 'hello') { if (presenter && m.role !== 'presenter') status('発表者として認められていません: 発表者の URL を開き直してください', true); }
  else if (m.type === 'state') {
    if (!takes(m)) return;
    var fresh = !held || held.epoch !== m.epoch, last = Number(store.get(LAST));
    var moved = !held || m.seq !== held.seq;
    held = m;
    if (presenter) {
      $('link').className = m.linked ? 'on' : ''; $('link').textContent = m.linked ? '連動 ON' : '連動 OFF'; $('link').setAttribute('aria-pressed', String(m.linked));
    } else if (pos < 0) {
      // the first state: a slide number in the URL (#3) is where this viewer starts on their own; else the presenter's slide
      var h = /^#(\d+)$/.exec(location.hash), want = h ? Number(h[1]) - 1 : -1;
      if (want >= 0 && want < m.total && want !== m.index) { pos = want; following = false; } else { pos = m.index; following = true; }
    } else if (moved && (m.linked || following)) {
      // linked: every move of the presenter brings every viewer back; unlinked: a viewer who stays with the presenter still follows
      if (m.linked) following = true;
      pos = m.index;
    }
    if (pos >= m.total) pos = m.total - 1;
    draw();
    // a local server started again: nobody has moved yet, so the presenter's page puts back the slide it was on (ADR 0056 D6)
    if (presenter && fresh && !m.moved && last > 0 && last !== m.index) send({type: 'go', index: last});
  } else if (m.type === 'deck') { deck = m; if (presenter) loadNotes(); draw(); }
  else if (m.type === 'pointer') { pointer = m.off ? null : m; showLaser(); }
  else if (m.type === 'zoom' && !presenter) {
    // the presenter's zoom, on the slide this viewer is on, unless they zoomed by themselves
    presenterZoom = m;
    if (!zoom.own && m.index === pos && held && (held.linked || following)) { zoom.z = m.z; zoom.x = m.x; zoom.y = m.y; applyZoom(); }
  }
  else if (m.type === 'count' && presenter) { $('viewers').textContent = '聴き手 ' + m.viewers; }
  else if (m.type === 'problems' && presenter) { var p = $('problems'); var lines = (m.errors || []).map(function (e) { return '✗ ' + e; }).concat((m.warnings || []).map(function (w) { return '⚠ ' + w; })); p.hidden = !(m.errors || []).length; p.textContent = lines.join('\n'); }
}

function loadNotes() {
  if (!cfg.notes) return;
  fetch(cfg.notes, {credentials: 'same-origin', cache: 'no-store'}).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j) { notes = j.notes; draw(); } }).catch(function () {});
}

function drawOverview() {
  var o = $('overview'); o.textContent = '';
  if (!deck) return;
  var here = presenter ? (held ? held.index : -1) : pos;
  deck.slides.forEach(function (s, i) {
    var b = document.createElement('button'); b.type = 'button';
    b.className = (held && held.index === i ? 'at' : '') + (!presenter && i === here && held && held.index !== i ? ' here' : '');
    var im = document.createElement('img'); im.src = s.url; im.alt = s.text || ''; im.loading = 'lazy';
    b.appendChild(im); b.appendChild(document.createTextNode((i + 1) + '. ' + (s.title || '')));
    b.onclick = function () { goto(i); o.hidden = true; };
    o.appendChild(b);
  });
}
// --- ? : the shortcut keys of this page ----------------------------------------------------------------------------------------
var KEYS = presenter ? [
  ['スライド', [['→ / space / PageDown / ↓', '次'], ['← / PageUp / ↑', '前'], ['Home / End', '最初 / 最後'], ['g', '番号を入れて移動'], ['o', 'スライドの一覧'], ['スワイプ', '次 / 前(携帯)']]],
  ['聴き手', [['k', '連動の入・切(入っていると、動かすたびに聴き手も移る)'], ['p', '聴き手の画面を別の窓で開く']]],
  ['指す', [['l', 'レーザーポインター(スライドの上でマウスを動かす)'], ['s', 'スポットライト(マウスの周りだけ明るく)'], ['[ / ]', 'スポットライトを小さく / 大きく']]],
  ['拡大', [['+ / -', '拡大 / 縮小(連動中は聴き手にも見える)'], ['0 / Esc', '元の大きさ'], ['Ctrl + ホイール / ピンチ', '指した所を拡大・縮小'], ['ダブルクリック', 'その所を拡大 / 元に戻す'], ['ドラッグ / 矢印(拡大中)', '見る所をずらす']]],
  ['時間', [['t', 'タイマーの開始 / 一時停止'], ['r', 'タイマーを 0 に']]],
  ['画面', [['f', '全画面'], ['?', 'この一覧']]]
] : [
  ['スライド', [['→ / space / PageDown / ↓', '次'], ['← / PageUp / ↑', '前'], ['Home / End', '最初 / 最後'], ['g', '番号を入れて移動'], ['o', 'スライドの一覧'], ['スワイプ / ホイール', '次 / 前']]],
  ['発表者', [['b / Enter', '発表者のスライドに合わせる'], ['(自動)', '発表者が「連動」で動かすと、発表者のスライドに移る']]],
  ['拡大', [['+ / -', '拡大 / 縮小'], ['0 / Esc', '元の大きさ'], ['Ctrl + ホイール / ピンチ', '指した所を拡大・縮小'], ['ダブルクリック / ダブルタップ', 'その所を拡大 / 元に戻す'], ['ドラッグ / 矢印(拡大中)', '見る所をずらす']]],
  ['画面', [['f', '全画面'], ['?', 'この一覧']]]
];
function toggleHelp() {
  var h = $('help');
  if (h.hidden) {
    var t = document.createElement('table');
    KEYS.forEach(function (g) {
      var hr = t.insertRow(), th = document.createElement('th'); th.colSpan = 2; th.textContent = g[0]; hr.appendChild(th);
      g[1].forEach(function (k) { var r = t.insertRow(); r.insertCell().textContent = k[0]; r.insertCell().textContent = k[1]; });
    });
    var box = $('helpkeys'); box.textContent = ''; box.appendChild(t);
  }
  h.hidden = !h.hidden;
}
function toggleOverview() { var o = $('overview'); o.hidden = !o.hidden; if (!o.hidden) drawOverview(); }

function send(msg) {
  if (!presenter) return;
  if (!connected) { if (msg.type === 'go') status('切断中: 押したキーは届いていません', true); return; }
  if (cfg.transport === 'ws') { try { sock.send(JSON.stringify(msg)); } catch (e) {} return; }
  fetch(cfg.go, {method: 'POST', credentials: 'same-origin', headers: {'content-type': 'application/json'}, body: JSON.stringify(msg)}).then(function (r) {
    if (r.status === 403) status('発表者として認められていません', true);
  }).catch(function () { if (msg.type === 'go') status('切断中: 押したキーは届いていません', true); });
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
// keep the screen on while the slides are up (where the browser has a Wake Lock)
var lock = null;
function wake() { if (document.visibilityState !== 'visible' || !navigator.wakeLock || lock) return; navigator.wakeLock.request('screen').then(function (l) { lock = l; l.addEventListener('release', function () { lock = null; }); }).catch(function () {}); }
document.addEventListener('visibilitychange', wake);
wake();

// --- keys, swipe, wheel: for both pages ----------------------------------------------------------------------------------------
document.addEventListener('keydown', function (e) {
  if (e.altKey || e.ctrlKey || e.metaKey || (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName))) return;
  var k = e.key, o = $('overview'), hp = $('help');
  if (k === '?' || (k === 'Escape' && !hp.hidden)) { toggleHelp(); e.preventDefault(); return; }
  if (k === 'Escape' && !o.hidden) { o.hidden = true; return; }
  // zoomed in: Esc is the whole slide again, and the arrows move the view (as PowerPoint Live does); at 100% they turn the slides
  if (k === 'Escape' && zoom.z > 1) { resetZoom(); e.preventDefault(); return; }
  if (zoom.z > 1 && /^Arrow/.test(k)) { var d = 60; panBy(k === 'ArrowLeft' ? d : k === 'ArrowRight' ? -d : 0, k === 'ArrowUp' ? d : k === 'ArrowDown' ? -d : 0); e.preventDefault(); return; }
  if (k === 'ArrowRight' || k === ' ' || k === 'PageDown' || k === 'ArrowDown') step(1);
  else if (k === 'ArrowLeft' || k === 'PageUp' || k === 'ArrowUp') step(-1);
  else if (k === 'Home') goto(0);
  else if (k === 'End') goto(total() - 1);
  else if (k === 'o') toggleOverview();
  else if (k === '+' || k === '=' || k === ';') zoomBy(1.25);
  else if (k === '-' || k === '_') zoomBy(1 / 1.25);
  else if (k === '0') resetZoom();
  else if (k === 'f') fullscreen();
  else if (k === 'g') { var n = Number(prompt('スライドの番号 (1〜' + total() + ')')); if (n >= 1) goto(n - 1); }
  else if (!presenter && (k === 'b' || k === 'Enter')) backToPresenter();
  else if (presenter && k === 'k') send({type: 'link', on: !(held && held.linked)});
  else if (presenter && k === 'l') toggleLaser();
  else if (presenter && k === 's') toggleSpot();
  else if (presenter && (k === '[' || k === ']') && spotting) { spotR = clamp(spotR * (k === ']' ? 1.2 : 1 / 1.2), 0.04, 0.4); keep.set('sd-spot', String(spotR)); if (pointer) { pointer.r = spotR; showLaser(); sendPointer(); } }
  else if (presenter && k === 't') toggleTimer();
  else if (presenter && k === 'r') resetTimer();
  else if (presenter && k === 'p') { if (cfg.viewerPath || cfg.viewerUrl) window.open(cfg.viewerPath || cfg.viewerUrl, 'sd-viewer'); }
  else return;
  e.preventDefault();
});
var sx = null, sy = null, pinch = null, panFrom = null, tapAt = 0;
var dist = function (t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); };
$('stage').addEventListener('touchstart', function (e) {
  if (e.touches.length === 2) { pinch = {d: dist(e.touches), z: zoom.z}; sx = null; panFrom = null; return; }
  sx = e.touches[0].clientX; sy = e.touches[0].clientY; panFrom = zoom.z > 1 ? {x: sx, y: sy} : null;
}, {passive: true});
$('stage').addEventListener('touchmove', function (e) {
  if (pinch && e.touches.length === 2) {
    var t = e.touches, mx = (t[0].clientX + t[1].clientX) / 2, my = (t[0].clientY + t[1].clientY) / 2;
    zoomBy(pinch.z * dist(t) / pinch.d / zoom.z, mx, my);
  } else if (panFrom && e.touches.length === 1) {
    var x = e.touches[0].clientX, y = e.touches[0].clientY;
    panBy(x - panFrom.x, y - panFrom.y); panFrom = {x: x, y: y};
  }
}, {passive: true});
$('stage').addEventListener('touchend', function (e) {
  if (pinch) { if (e.touches.length < 2) pinch = null; return; }
  if (sx === null) return;
  var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy, wasPan = !!panFrom; sx = null; panFrom = null;
  if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
    var t = Date.now();
    // a double tap zooms in on the point (or back to the whole slide)
    if (t - tapAt < 300) { tapAt = 0; if (zoom.z > 1) resetZoom(); else zoomBy(2.5, e.changedTouches[0].clientX, e.changedTouches[0].clientY); return; }
    tapAt = t;
    if (!presenter) showNav();
    return;
  }
  if (!wasPan && zoom.z === 1 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
}, {passive: true});
var wheelAt = 0;
$('stage').addEventListener('wheel', function (e) {
  // ctrl + wheel (a trackpad's pinch comes as this too) zooms at the pointer; when zoomed, the wheel pans; else it turns the slides
  if (e.ctrlKey) { e.preventDefault(); zoomBy(Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY); return; }
  if (zoom.z > 1) { e.preventDefault(); panBy(-e.deltaX, -e.deltaY); return; }
  if (Math.abs(e.deltaY) < 30 && Math.abs(e.deltaX) < 30) return;
  var now = Date.now(); if (now - wheelAt < 600) return; wheelAt = now;
  step((Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX) > 0 ? 1 : -1);
}, {passive: false});
$('stage').addEventListener('dblclick', function (e) { if (zoom.z > 1) resetZoom(); else zoomBy(2.5, e.clientX, e.clientY); });
var drag = null;
$('stage').addEventListener('mousedown', function (e) { if (zoom.z > 1 && !lasering && e.button === 0) { drag = {x: e.clientX, y: e.clientY}; document.body.classList.add('panning'); e.preventDefault(); } });
window.addEventListener('mousemove', function (e) { if (drag) { panBy(e.clientX - drag.x, e.clientY - drag.y); drag = {x: e.clientX, y: e.clientY}; } });
window.addEventListener('mouseup', function () { drag = null; document.body.classList.remove('panning'); });
$('zin').onclick = function () { zoomBy(1.25); };
$('zout').onclick = function () { zoomBy(1 / 1.25); };
$('zreset').onclick = resetZoom;
$('prev').onclick = function () { step(-1); };
$('next').onclick = function () { step(1); };
window.addEventListener('resize', applyZoom);

// --- the viewer's bar --------------------------------------------------------------------------------------------------------
var navTimer = null;
function showNav() { var n = $('nav'); if (!n) return; n.classList.add('show'); clearTimeout(navTimer); navTimer = setTimeout(function () { n.classList.remove('show'); }, 2500); }
if (!presenter) {
  $('ov').onclick = toggleOverview;
  $('fs').onclick = fullscreen;
  $('follow').onclick = backToPresenter;
  $('helpbtn').onclick = toggleHelp;
  document.addEventListener('mousemove', showNav);
  showNav();
  if (innerHeight > innerWidth * 1.1 && !keep.get('sd-hint')) { $('hint').hidden = false; keep.set('sd-hint', '1'); setTimeout(function () { $('hint').hidden = true; }, 6000); }
}

// --- the presenter's timer, pace, linking, laser ---------------------------------------------------------------------------
var startedAt = 0, elapsed = 0, running = false;
function now() { return elapsed + (running ? Date.now() - startedAt : 0); }
function toggleTimer() { if (running) { elapsed = now(); running = false; } else { startedAt = Date.now(); running = true; } $('tstart').textContent = running ? '一時停止' : (elapsed ? '再開' : '開始'); }
function resetTimer() { elapsed = 0; startedAt = Date.now(); $('timer').textContent = '00:00'; pace(); }
function pace() {
  if (!presenter || !held) return;
  var mins = Number($('duration').value) || 30, t = now() / 60000, frac = Math.min(1, t / mins), n = total() || 1, at = (held.index + 1) / n;
  $('pacetime').style.width = frac * 100 + '%'; $('paceslide').style.width = at * 100 + '%';
  var note = $('pacenote'), diff = (at - frac) * mins;
  if (!running && !elapsed) { note.textContent = '予定 ' + mins + ' 分。開始を押すと、時間とスライドの進み具合を比べます'; note.className = 'pacenote'; return; }
  if (Math.abs(diff) < 1) { note.textContent = '予定どおり'; note.className = 'pacenote'; }
  else { note.textContent = diff > 0 ? '予定より ' + Math.round(diff) + ' 分早い' : '予定より ' + Math.round(-diff) + ' 分遅い'; note.className = 'pacenote ' + (diff > 0 ? 'early' : 'late'); }
}
function pointing() { document.body.classList.toggle('lasering', lasering || spotting); $('laserbtn').setAttribute('aria-pressed', String(lasering)); $('spotbtn').setAttribute('aria-pressed', String(spotting)); }
function toggleLaser() {
  clearTimeout(pointerLater);
  lasering = !lasering; if (lasering) spotting = false; pointing();
  send({type: 'pointer', off: true}); pointer = null; showLaser();
}
/** The spotlight (ADR 0064): like the laser, the presenter's pointer, but as a bright circle with the rest of the slide dimmed. */
function toggleSpot() {
  clearTimeout(pointerLater);
  spotting = !spotting; if (spotting) lasering = false; pointing();
  send({type: 'pointer', off: true}); pointer = null; showLaser();
}
var pointerLater = 0;
function sendPointer() {
  if (!pointer || !held) return;
  var t = Date.now();
  // at most one in 50 ms; the last one in a burst still goes, when its 50 ms are up
  if (t - lastPointer < 50) { clearTimeout(pointerLater); pointerLater = setTimeout(sendPointer, 50 - (t - lastPointer)); return; }
  lastPointer = t;
  var m = {type: 'pointer', index: held.index, x: Math.round(pointer.x * 1e4) / 1e4, y: Math.round(pointer.y * 1e4) / 1e4};
  if (pointer.spot) { m.spot = true; m.r = Math.round(pointer.r * 1e4) / 1e4; }
  send(m);
}
if (presenter) {
  var two = function (n) { return (n < 10 ? '0' : '') + n; };
  setInterval(function () {
    var s = Math.floor(now() / 1000);
    $('timer').textContent = (s >= 3600 ? Math.floor(s / 3600) + ':' : '') + two(Math.floor(s / 60) % 60) + ':' + two(s % 60);
    var d = new Date(); $('clock').textContent = two(d.getHours()) + ':' + two(d.getMinutes());
    pace();
  }, 500);
  $('tstart').onclick = toggleTimer;
  $('treset').onclick = resetTimer;
  var saved = Number(keep.get('sd-duration')); if (saved > 0) $('duration').value = String(saved);
  $('duration').onchange = function () { keep.set('sd-duration', $('duration').value); pace(); };
  $('link').onclick = function () { send({type: 'link', on: !(held && held.linked)}); };
  $('laserbtn').onclick = toggleLaser;
  $('spotbtn').onclick = toggleSpot;
  var savedSpot = Number(keep.get('sd-spot')); if (savedSpot > 0) spotR = clamp(savedSpot, 0.04, 0.4);
  $('stage').addEventListener('mousemove', function (e) {
    if ((!lasering && !spotting) || !held) return;
    var r = $('slide').getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    pointer = spotting ? {index: held.index, x: x, y: y, spot: true, r: spotR} : {index: held.index, x: x, y: y};
    showLaser(); sendPointer();
  });
  $('stage').addEventListener('mouseleave', function () { if (lasering || spotting) { clearTimeout(pointerLater); send({type: 'pointer', off: true}); pointer = null; showLaser(); } });
  if (cfg.qrSvg) $('qr').innerHTML = cfg.qrSvg;
  if (cfg.viewerUrl) $('qrurl').textContent = cfg.viewerUrl;
  $('qrnote').textContent = (cfg.qrNote || '') + (cfg.sseLimit ? (cfg.qrNote ? '　' : '') + '同じブラウザでこのサーバーの窓を 5 つ以上開かないでください' : '');
}
$('help').onclick = function (e) { if (e.target === $('help')) toggleHelp(); };
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
