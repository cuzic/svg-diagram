// The checks on a rendering — low-contrast text, content past the canvas, text over text, text out of its box, a shape over a text — done
// on the SVG's own geometry instead of in a browser. The boxes are what a browser reports (lib/svg-geom.ts); the text boxes come from the
// same font files the layout is measured with, so no browser is started. lib/lint-browser.ts is the same five checks in Chromium, kept as
// `lint --engine browser` and as the reference this is tested against (test/svg-lint.test.ts).
import {apply, closest, colourGroups, computeStyles, elements, IDENTITY, multiply, parseColor, parseTransform, parseXml, textOf, type El, type Matrix, type RGBA, type Style} from './svg-dom.ts';
import {boxOf, isShape, outlineOf, sampleAlong, textBoxOf, transformBox, unionBox, type Box, type Outline} from './svg-geom.ts';
import type {FontSpecs} from './types/project.ts';

export interface RenderChecks {
  contrast: {txt: string; delta: number; fg: string; bg: string}[];
  overflow: {dx: number; dy: number} | null;
  textOverlap: {a: string; b: string; ratio: number}[];
  containerOverflow: {txt: string; over: number}[];
  covered: {txt: string; by: string; how: 'covers' | 'crosses'}[];
}

const NOT_DRAWN = new Set(['defs', 'marker', 'clipPath', 'mask', 'pattern', 'symbol', 'linearGradient', 'radialGradient', 'filter', 'title', 'desc', 'metadata', 'style', 'script']);
const SIZED = new Set(['rect', 'circle', 'ellipse', 'path', 'line', 'polygon', 'polyline', 'text', 'image']);

interface Item {el: El; tag: string; style: Style; outline: Outline | null; user: Box | null; screen: Box | null; toScreen: Matrix}

const luminance = (c: RGBA) => 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
const over = (fg: RGBA, bg: RGBA): RGBA => ({r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1});
/** A colour the way a browser prints a computed one. */
const css = (c: RGBA) => c.a === 1 ? `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})` : `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${+c.a.toFixed(3)})`;
const fixed = (n: number, d: number) => Number(n.toFixed(d));

/** null when there is no <svg>; throws (with the reason) for XML it cannot read, and when a font file for the text boxes cannot be found. */
export function geometryChecks(src: string, specs?: FontSpecs): RenderChecks | null {
  let root: El;
  try { root = parseXml(src); } catch (e) { if ((e as Error).message === 'no <svg> element') return null; throw new Error(`not well-formed XML (${(e as Error).message})`); }
  const styles = computeStyles(root);

  const vbm = /^\s*(-?[\d.]+)[\s,]+(-?[\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*$/.exec(root.attrs.viewBox ?? '');
  const vb = vbm ? {x: +vbm[1], y: +vbm[2], w: +vbm[3], h: +vbm[4]} : null;
  const attrPx = (n: string) => { const m = /^\s*([\d.]+)(px)?\s*$/.exec(root.attrs[n] ?? ''); return m ? parseFloat(m[1]) : 0; };
  const W = vb?.w || attrPx('width'), H = vb?.h || attrPx('height');
  // the viewBox → viewport mapping (preserveAspectRatio "xMidYMid meet"): the identity when the two sizes agree
  let view: Matrix = IDENTITY;
  if (vb && vb.w && vb.h && attrPx('width') && attrPx('height')) {
    const s = Math.min(attrPx('width') / vb.w, attrPx('height') / vb.h);
    view = [s, 0, 0, s, (attrPx('width') - vb.w * s) / 2 - vb.x * s, (attrPx('height') - vb.h * s) / 2 - vb.y * s];
  }
  const vp = {w: W, h: H};

  const items: Item[] = [];
  const walk = (el: El, ctm: Matrix, drawn: boolean) => {
    const hidden = !drawn || NOT_DRAWN.has(el.tag) || el.attrs.display === 'none' || /display\s*:\s*none/.test(el.attrs.style ?? '');
    const m = el === root ? ctm : multiply(ctm, parseTransform(el.attrs.transform));
    if (!hidden && SIZED.has(el.tag)) {
      const style = styles.get(el)!;
      const toScreen = multiply(view, m);
      let outline: Outline | null = null, local: Box | null;
      if (el.tag === 'text') local = textBoxOf(el, styles, specs);
      else if (el.tag === 'image') { const n = (k: string) => parseFloat(el.attrs[k] ?? '0') || 0; local = n('width') && n('height') ? {x: n('x'), y: n('y'), w: n('width'), h: n('height')} : null; }
      else { outline = isShape(el) ? outlineOf(el, vp) : null; local = outline?.box ?? null; }
      // a transformed element's box is the box of its own box's corners (as a browser reports it), not of its outline's points
      items.push({el, tag: el.tag, style, outline, user: local && transformBox(local, m), screen: local && transformBox(local, toScreen), toScreen});
    }
    for (const c of el.children) if (typeof c !== 'string') walk(c, m, !hidden);
  };
  walk(root, IDENTITY, true);

  const result: RenderChecks = {contrast: [], overflow: null, textOverlap: [], containerOverflow: [], covered: []};
  // a copy of a text drawn for decoration (the shadow / outer outlines of a wordart) is marked data-decor: it is not a label, so it is not
  // judged as one for contrast and overlap (it still counts for overflow); an author's aria-hidden does not buy that exemption
  const decorative = (el: El): boolean => !!closest(el, e => e.attrs['data-decor'] !== undefined);
  const texts = items.filter(i => i.tag === 'text' && i.user && i.user.w > 0 && !decorative(i.el));

  // a transparent diagram has no page rectangle: it is judged against the page colour it was drawn for (data-assumed-bg), else white
  const am = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(root.attrs['data-assumed-bg'] ?? '');
  const page: RGBA = am ? {r: parseInt(am[1], 16), g: parseInt(am[2], 16), b: parseInt(am[3], 16), a: 1} : {r: 255, g: 255, b: 255, a: 1};
  // 1. contrast: the colour behind a text's centre is the page colour with every filled shape that holds the centre painted over it, in order
  const shapes = items.filter(i => ['rect', 'circle', 'ellipse', 'polygon', 'path'].includes(i.tag) && i.user && i.style.fill !== 'none')
    .map(i => { const c = parseColor(i.style.fill, i.style.color); return c ? {box: i.user!, c: {...c, a: c.a * i.style.fillOpacity * i.style.opacity}} : null; })
    .filter((x): x is {box: Box; c: RGBA} => x !== null);
  for (const t of texts) {
    const txt = textOf(t.el).trim();
    if (!txt) continue;
    const b = t.user!, cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    // an <image>'s pixels are unknown, so text drawn on one is judged by what is between them: it needs an opaque shape behind the whole
    // text (a plate); without one the contrast cannot be checked and is reported
    const at = items.indexOf(t);
    const pic = items.findLastIndex((i, k) => k < at && i.tag === 'image' && i.user && cx >= i.user.x && cx <= i.user.x + i.user.w && cy >= i.user.y && cy <= i.user.y + i.user.h);
    if (pic >= 0 && !items.slice(pic + 1, at).some(i => ['rect', 'circle', 'ellipse', 'polygon', 'path'].includes(i.tag) && i.user && i.style.fill !== 'none'
      && i.style.fillOpacity * i.style.opacity >= 0.9 && (parseColor(i.style.fill, i.style.color)?.a ?? 0) >= 0.9
      && b.x >= i.user.x - 1 && b.x + b.w <= i.user.x + i.user.w + 1 && b.y >= i.user.y - 1 && b.y + b.h <= i.user.y + i.user.h + 1)) {
      result.contrast.push({txt: txt.slice(0, 40), delta: 0, fg: css(parseColor(t.style.fill, t.style.color) ?? {r: 0, g: 0, b: 0, a: 1}), bg: 'image (no opaque plate behind the text)'});
      continue;
    }
    let bg: RGBA = page;
    for (const s of shapes) if (cx >= s.box.x && cx <= s.box.x + s.box.w && cy >= s.box.y && cy <= s.box.y + s.box.h) bg = over(s.c, bg);
    // a tspan with a colour of its own is judged on its own (against the text's box, as the centre of a word is no nearer than that)
    const groups = colourGroups(t.el, styles);
    for (const g of groups) {
      const tc = parseColor(g.style.fill, g.style.color);
      if (!tc) continue;
      const d = Math.abs(luminance(tc) - luminance(bg));
      // an outlined letter reads by its rim when its fill is too close to the ground (a white letter with a dark outline)
      // (a hairline or a faint stroke is not a rim: the outer half of the stroke must be at least 3% of the text, and 1px)
      // (opaque means the stroke colour's own alpha and every enclosing <g opacity> too, not only stroke-opacity)
      let shown = t.style.strokeOpacity;
      for (let e: El | null = t.el; e; e = e.parent) shown *= styles.get(e)?.opacity ?? 1;
      const strokeColour = t.style.stroke !== 'none' ? parseColor(t.style.stroke, t.style.color) : null;
      const seen = t.style.strokeWidth / 2 >= Math.max(1, 0.03 * t.style.fontSize) && shown * (strokeColour?.a ?? 1) >= 0.9;
      const rim = seen ? strokeColour : null;
      if (d < 70 && !(rim && Math.abs(luminance(rim) - luminance(bg)) >= 70)) result.contrast.push({txt: (groups.length > 1 ? g.txt.trim() : txt).slice(0, 40), delta: fixed(d, 0), fg: css(tc), bg: `rgb(${bg.r | 0},${bg.g | 0},${bg.b | 0})`});
    }
  }

  // 2. content past the canvas (the box of everything drawn, without strokes)
  const all = unionBox(items.map(i => i.user));
  if (all && (all.y + all.h > H + 2 || all.x + all.w > W + 2)) result.overflow = {dx: fixed(all.x + all.w - W, 0), dy: fixed(all.y + all.h - H, 0)};

  // 3. text over text
  const labelled = items.filter(i => i.tag === 'text' && i.screen && i.screen.w && i.screen.h && textOf(i.el).trim() && !decorative(i.el))
    .map(i => ({txt: textOf(i.el).trim().slice(0, 30), bb: i.screen!}));
  for (let i = 0; i < labelled.length; i++) for (let j = i + 1; j < labelled.length; j++) {
    const a = labelled[i].bb, b = labelled[j].bb;
    const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (ix <= 0 || iy <= 0) continue;
    const ratio = (ix * iy) / Math.min(a.w * a.h, b.w * b.h);
    if (ratio > 0.3) result.textOverlap.push({a: labelled[i].txt, b: labelled[j].txt, ratio: fixed(ratio, 2)});
  }

  // 4. text out of the smallest box that holds its centre (rects, and badge groups as one box)
  const containers: Box[] = [];
  for (const el of elements(root)) {
    if (el.tag === 'g' && el.attrs['data-badge'] !== undefined && !closest(el, e => NOT_DRAWN.has(e.tag))) {
      const inside = items.filter(i => i.screen && closest(i.el, e => e === el));
      const b = unionBox(inside.map(i => i.screen));
      if (b && b.w && b.h) containers.push(b);
    }
  }
  for (const i of items) if (i.tag === 'rect' && i.screen && i.screen.w && i.screen.h && !(i.style.fill === 'none' && i.style.stroke === 'none')) containers.push(i.screen);
  const PAD = 4;
  for (const t of labelled) {
    const bb = t.bb, cx = bb.x + bb.w / 2, cy = bb.y + bb.h / 2;
    let best: Box | null = null;
    for (const r of containers) {
      if (cx < r.x || cx > r.x + r.w || cy < r.y || cy > r.y + r.h) continue;
      if (r.w * r.h < bb.w * bb.h) continue;
      if (!best || r.w * r.h < best.w * best.h) best = r;
    }
    if (!best) continue;
    const o = Math.max(best.x + PAD - bb.x, (bb.x + bb.w) - (best.x + best.w - PAD), best.y + PAD - bb.y, (bb.y + bb.h) - (best.y + best.h - PAD));
    if (o > 3) result.containerOverflow.push({txt: t.txt, over: fixed(o, 1)});
  }

  // 5. a shape painted after a text covers it, or a line runs through it (data-allow-cover on the shape or an ancestor excuses it)
  items.forEach((t, i) => {
    if (t.tag !== 'text' || !t.screen || !t.screen.w || !textOf(t.el).trim()) return;
    const tb = t.screen, tr = tb.x + tb.w, tbm = tb.y + tb.h;
    for (let j = i + 1; j < items.length; j++) {
      const sh = items[j];
      if (sh.tag === 'text' || !sh.screen || (!sh.screen.w && !sh.screen.h) || closest(sh.el, e => e.attrs['data-allow-cover'] !== undefined)) continue;
      const sr = sh.screen.x + sh.screen.w, sb = sh.screen.y + sh.screen.h;
      const ow = Math.min(tr, sr) - Math.max(tb.x, sh.screen.x), oh = Math.min(tbm, sb) - Math.max(tb.y, sh.screen.y);
      if (ow < 0 || oh < 0) continue; // (a vertical or horizontal line has a zero-width box: it can still run through the text)
      const fill = sh.style.fill !== 'none', stroke = sh.style.stroke !== 'none' && sh.style.strokeWidth > 0, op = sh.style.opacity * sh.style.fillOpacity;
      if (fill && op >= 0.5 && ow >= 3 && oh >= 3 && ow * oh >= 30) { result.covered.push({txt: textOf(t.el).trim(), by: sh.tag, how: 'covers'}); break; }
      if (stroke && !fill && sh.tag !== 'rect' && sh.outline) {
        const hit = sh.outline.polylines.some(pl => sampleAlong(pl.map(([x, y]) => apply(sh.toScreen, x, y)), 3)
          .some(([x, y]) => x >= tb.x && x <= tr && y >= tb.y + 2 && y <= tbm - 2));
        if (hit) { result.covered.push({txt: textOf(t.el).trim(), by: sh.tag, how: 'crosses'}); break; }
      }
    }
  });
  return result;
}
export {boxOf};
