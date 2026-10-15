// The deck viewer's DOM layer (ADR 0018, unit C): keys / clicks / the URL hash -> state.js -> hidden, inert, aria-*, classes.
// A plain script on purpose. lib/deck-viewer.ts joins state.js and this file into the document's one script element (the `import` line
// below and the `export` keywords of state.js are cut out there), so this file must not import anything else.
// It never copies a figure and never sets a `style` attribute: the overview is the same section elements under the class `grid` on #deck,
// and everything visual is a class (so a CSP that names the one style element by its hash holds).
import {initialState, reduce, parseHash, formatHash, keyToInput} from './state.js';

function startViewer(document, window) {
  const deck = document.getElementById('deck');
  if (!deck) return;
  const slides = Array.from(deck.querySelectorAll('.slide'));
  const total = slides.length;
  if (total === 0) return;
  const names = slides.map(s => s.getAttribute('data-name') || '');
  const ja = /^ja/i.test(document.documentElement.getAttribute('lang') || '');
  const T = ja
    ? {prev: '前のスライド', next: '次のスライド', grid: '一覧', bar: 'スライドの操作'}
    : {prev: 'Previous slide', next: 'Next slide', grid: 'Overview', bar: 'Slide controls'};

  const el = (tag, attrs, text) => {
    const e = document.createElement(tag);
    for (const k of Object.keys(attrs)) e.setAttribute(k, attrs[k]);
    if (text) e.textContent = text;
    return e;
  };
  const flag = (e, name, on) => { if (on) e.setAttribute(name, ''); else e.removeAttribute(name); };

  // the frame: buttons, a counter and a live region — made here, so a page without script has none of them
  const bar = el('div', {class: 'deck-bar', role: 'group', 'aria-label': T.bar});
  const prevBtn = el('button', {type: 'button', 'aria-label': T.prev}, '‹');
  const nextBtn = el('button', {type: 'button', 'aria-label': T.next}, '›');
  const gridBtn = el('button', {type: 'button', 'aria-label': T.grid, 'aria-pressed': 'false'}, T.grid);
  const count = el('span', {class: 'deck-count', 'aria-hidden': 'true'});
  const live = el('div', {class: 'sr-only', role: 'status', 'aria-live': 'polite'});
  for (const e of [prevBtn, count, nextBtn, gridBtn]) bar.appendChild(e);
  document.body.appendChild(bar);
  document.body.appendChild(live);
  // one transparent button over each slide (hidden by the stylesheet except in the overview)
  const picks = slides.map((s, i) => {
    const b = el('button', {type: 'button', class: 'deck-pick', 'aria-label': s.getAttribute('aria-label') || String(i + 1)});
    b.addEventListener('click', () => go({type: 'select', n: i + 1}));
    s.appendChild(b);
    return b;
  });

  let st = initialState(total, 0);

  function writeHash(was) {
    const h = formatHash(st);
    if (window.location.hash === h) return;
    try {
      if (st.grid && !was.grid) window.history.pushState(null, '', h); // only the overview takes a history entry: back closes it
      else window.history.replaceState(null, '', h);
    } catch (e) { /* a sandboxed or opaque origin: the hash is a convenience */ }
  }

  function render(announce) {
    deck.classList.toggle('grid', st.grid);
    deck.classList.toggle('zoom', st.zoom);
    slides.forEach((s, i) => {
      flag(s, 'hidden', !st.grid && i !== st.index);
      if (i === st.index) s.setAttribute('aria-current', 'true'); else s.removeAttribute('aria-current');
      const svg = s.querySelector('svg');
      if (svg) { if (st.grid) svg.setAttribute('aria-hidden', 'true'); else svg.removeAttribute('aria-hidden'); }
    });
    // only the frame's own controls go inert in the overview — never #deck or a section, which hold the overview's buttons
    flag(prevBtn, 'inert', st.grid);
    flag(nextBtn, 'inert', st.grid);
    flag(prevBtn, 'disabled', st.index === 0);
    flag(nextBtn, 'disabled', st.index === total - 1);
    gridBtn.setAttribute('aria-pressed', st.grid ? 'true' : 'false');
    count.textContent = (st.index + 1) + ' / ' + total;
    if (announce) live.textContent = st.grid ? T.grid + ' (' + total + ')' : (slides[st.index].getAttribute('aria-label') || '');
  }

  // focus stays on the frame while moving; the overview puts it on the current slide's button, and gives it back when it closes
  function go(input, keepOnPick) {
    const was = st;
    st = reduce(st, input);
    render(true);
    writeHash(was);
    if (st.grid && (!was.grid || keepOnPick)) picks[st.index].focus();
    else if (!st.grid && was.grid) deck.focus();
  }

  const tagOf = t => (t && t.tagName ? String(t.tagName).toUpperCase() : '');
  document.addEventListener('keydown', ev => {
    const tag = tagOf(ev.target);
    const input = keyToInput(ev, {
      typing: tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!(ev.target && ev.target.isContentEditable),
      interactive: tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY',
      grid: st.grid,
    });
    if (!input) return;
    if (input.type === 'toggleZoom' && st.grid) return; // no zoom in the overview: it would break the columns
    ev.preventDefault();
    go(input, ['next', 'prev', 'first', 'last'].includes(input.type));
  });
  prevBtn.addEventListener('click', () => go({type: 'prev'}));
  nextBtn.addEventListener('click', () => go({type: 'next'}));
  gridBtn.addEventListener('click', () => go({type: 'toggleGrid'}));
  deck.addEventListener('click', ev => {
    const tag = tagOf(ev.target);
    if (st.grid || tag === 'BUTTON' || tag === 'A') return; // in the overview a click is the slide button's, and there is no zoom
    go({type: 'toggleZoom'});
  });
  window.addEventListener('hashchange', () => {
    const h = parseHash(window.location.hash, names, total, st.index);
    st = {...st, index: h.index, grid: h.grid, zoom: h.index === st.index && !h.grid ? st.zoom : false};
    render(true);
  });

  const h0 = parseHash(window.location.hash, names, total, 0);
  st = {...initialState(total, h0.index), grid: h0.grid};
  document.documentElement.classList.remove('no-js');
  render(false);
  if (st.grid) picks[st.index].focus();
}

startViewer(document, window);
