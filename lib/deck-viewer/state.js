// The deck viewer's state transitions (ADR 0018, unit A): pure functions, no DOM and no `window`.
// A plain ES module on purpose: the viewer's script (unit C) embeds it into the page as it is, and the tests import it directly.
//
// State: {index (0-based), total, grid, zoom}. Inputs are {type: 'next' | 'prev' | 'first' | 'last' | 'toggleGrid' | 'closeGrid' | 'toggleZoom'},
// {type: 'goto', n} (n is the 1-based slide number, as in the URL hash) and {type: 'select', n} (goto, and leave the grid: a click on a thumbnail).

/** The state of a deck of `total` slides, on the slide `index` (0-based; clamped). */
export function initialState(total, index = 0) {
  const t = Math.max(0, Math.trunc(Number(total)) || 0);
  return {index: clampIndex(index, t), total: t, grid: false, zoom: false};
}

function clampIndex(i, total) {
  const n = Math.round(Number(i));
  if (!Number.isFinite(n) || total <= 0) return 0;
  return Math.min(Math.max(n, 0), total - 1);
}

/** The next state. Never moves past either end (no wrap-around); an unknown input changes nothing. Always returns a new object. */
export function reduce(state, input) {
  const s = {...state};
  const move = i => {
    const to = clampIndex(i, s.total);
    if (to !== s.index) { s.index = to; s.zoom = false; } // the zoom belongs to one slide
  };
  const number = n => (Number.isFinite(Number(n)) ? Number(n) - 1 : 0);
  switch (input && input.type) {
    case 'next': move(s.index + 1); break;
    case 'prev': move(s.index - 1); break;
    case 'first': move(0); break;
    case 'last': move(s.total - 1); break;
    case 'goto': move(number(input.n)); break;
    case 'select': move(number(input.n)); s.grid = false; break;
    case 'toggleGrid': s.grid = !s.grid; s.zoom = false; break;
    case 'closeGrid': s.grid = false; break;
    case 'toggleZoom': if (!s.grid) s.zoom = !s.zoom; break; // the grid has no zoom: it would break the columns
    default: break;
  }
  return s;
}

/**
 * The URL hash -> {index, grid}. `#3` is slide 3 (1-based), `#name` is the slide whose name it is, `#grid` is the overview
 * (on `current`, the slide that was shown). Anything else (empty, 0, past the end, an unknown name) is the first slide.
 */
export function parseHash(hash, names, total, current = 0) {
  let h = String(hash || '').replace(/^#/, '');
  try { h = decodeURIComponent(h); } catch { /* keep it as written */ }
  if (h === 'grid') return {index: clampIndex(current, total), grid: true};
  if (/^[0-9]+$/.test(h)) {
    const n = Number(h);
    return {index: n >= 1 && n <= total ? n - 1 : 0, grid: false};
  }
  const i = h === '' ? -1 : (names || []).indexOf(h);
  return {index: i >= 0 && i < total ? i : 0, grid: false};
}

/** The state -> the hash to show (`#grid` for the overview, else the 1-based number). */
export function formatHash(state) {
  return state.grid ? '#grid' : '#' + (state.index + 1);
}

/**
 * A key event -> an input, or null when the viewer must leave the key alone.
 * `ev`: {key, shiftKey, ctrlKey, altKey, metaKey}. `ctx`: {typing} (focus is in an input / textarea / select),
 * {interactive} (focus is on a button / a / summary: Space and Enter belong to it), {grid} (the overview is open).
 */
export function keyToInput(ev, ctx = {}) {
  if (ev.ctrlKey || ev.altKey || ev.metaKey || ctx.typing) return null;
  switch (ev.key) {
    case 'ArrowRight': case 'PageDown': return {type: 'next'};
    case 'ArrowLeft': case 'PageUp': return {type: 'prev'};
    case 'Home': return {type: 'first'};
    case 'End': return {type: 'last'};
    case ' ': case 'Spacebar': return ctx.interactive ? null : {type: ev.shiftKey ? 'prev' : 'next'};
    case 'g': case 'G': return {type: 'toggleGrid'};
    case 'Escape': return ctx.grid ? {type: 'closeGrid'} : null;
    case 'z': case 'Z': return {type: 'toggleZoom'};
    default: return null;
  }
}
