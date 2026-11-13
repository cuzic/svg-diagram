// A band with no mapping of its own (charts, swimlanes, sequence and Gantt diagrams, BPMN, ...) drawn as native shapes from its own SVG.
// The SVG the band draws is the source, so the slide looks as the figure does; it is read in two passes so that the slide is also edited
// as a diagram is:
//   - a box (a rect, circle or diamond) takes the lines of text drawn inside it as its own text, so the text moves and wraps with the box;
//   - a line whose end touches a box is a connector glued to that box (a bent connector where the route is orthogonal), so it follows;
//   - a small filled triangle at the end of a line is that line's arrowhead, not a shape of its own.
// Everything else is a shape of its own: a path that closes or is filled a freeform, an open one a line, a text a text box at its baseline.
// Anything outside the small set of elements and attributes read here (a transform, a <use>, a <tspan> other than an emoji's, a gradient, ...) returns null, and
// the band is placed as a picture instead: a piece is never dropped or drawn wrong.
import {parseXml, type El} from '../svg-dom.ts';
import {fitConnector, inOutline, siteIndex, type Pt} from './geom.ts';
import {connectorShapeXml, freeformPathXml, type EndType, type Glue, type PathStep} from './connectors.ts';
import {boxTextFits, boxTextXml, dashOfSvg, geomShapeXml, nameOf, outlineGeomXml, pathShapeXml, polygonXml, prstGeomXml, roundGeomXml, textLineXml, type Paint, type TextLine} from './prims.ts';
import {svgPathSteps} from './svg-path.ts';
import type {Fonts, Rect} from './xml.ts';

/** What may appear, and what is skipped (it draws nothing a slide needs). */
const SKIP: ReadonlySet<string> = new Set(['title', 'desc', 'style', 'defs', 'metadata']);
const DRAWN: ReadonlySet<string> = new Set(['rect', 'circle', 'ellipse', 'polygon', 'polyline', 'line', 'path', 'text']);
/** The attributes read; any other on a drawn element sends the band back to a picture. */
const KNOWN: ReadonlySet<string> = new Set(['x', 'y', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r', 'points', 'x1', 'y1', 'x2', 'y2', 'd', 'fill', 'fill-opacity', 'stroke', 'stroke-width',
  'stroke-dasharray', 'stroke-linejoin', 'stroke-linecap', 'marker-end', 'font-size', 'font-weight', 'text-anchor', 'id', 'role', 'aria-label', 'aria-hidden', 'data-node', 'data-assumed-bg', 'class']);

const COLOR = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;
/** A paint the slide can carry (a hex colour or none); anything else (a gradient, currentColor) is unknown. */
function color(v: string | undefined): string | null | undefined {
  if (v === undefined || v === 'none') return undefined;
  if (!COLOR.test(v)) return null;
  return v.length === 4 ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}` : v;
}

/** A box: what text can sit in and lines can glue to. Its geometry has the four sites top, left, bottom, right (0 to 3). */
interface Box {kind: 'box'; id: number; rect: Rect; geom: string; paint: Paint; texts: TextLine[]}
interface Line {kind: 'line'; id: number; pts: Pt[]; paint: Paint; start?: EndType; end?: EndType; /** The length of the mark each end took (px). */ headPx?: {start?: number; end?: number}}
/** A small mark at a line's end: a filled triangle, an open V (`arrow`, drawn as a 3-point line) or a filled diamond. `xml` draws it when no line takes it. */
interface Head {kind: 'head'; id: number; type: EndType; pts: Pt[]; xml: () => string; used: boolean}
interface Text {kind: 'text'; id: number; t: TextLine; inBox: boolean}
interface Other {kind: 'other'; xml: string}
type Item = Box | Line | Head | Text | Other;

/** How far (px) a line's end may lie from a box's outline and still be glued to it. */
const TOUCH = 2.5;
/** A triangle at most this large (px^2) is an arrowhead when a line ends in it. */
const HEAD_AREA = 400;

/** The area of a closed outline (shoelace). */
const areaOf = (pts: readonly Pt[]): number => Math.abs(pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length] as Pt; return s + p.x * q.y - q.x * p.y; }, 0)) / 2;
const bboxOf = (pts: readonly Pt[]): Rect => { const xs = pts.map(p => p.x), ys = pts.map(p => p.y), x = Math.min(...xs), y = Math.min(...ys); return {x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y}; };
/** Whether p lies on the outline of the box (its rectangle's sides; a circle's or diamond's lie inside, so near the box is enough there). */
function touches(b: Box, p: Pt): boolean {
  const r = b.rect, inX = p.x >= r.x - TOUCH && p.x <= r.x + r.w + TOUCH, inY = p.y >= r.y - TOUCH && p.y <= r.y + r.h + TOUCH;
  if (!inX || !inY) return false;
  if (b.geom.startsWith('<a:custGeom')) return true;
  return Math.abs(p.x - r.x) <= TOUCH || Math.abs(p.x - r.x - r.w) <= TOUCH || Math.abs(p.y - r.y) <= TOUCH || Math.abs(p.y - r.y - r.h) <= TOUCH;
}

/** The figure's shapes, or null when the SVG has something this does not read. Coordinates are the figure's own (the band's viewBox only crops). */
export function svgShapesXml(svg: string, fonts: Fonts, next: () => number): string | null {
  let root: El;
  try { root = parseXml(svg); } catch { return null; }
  const items: Item[] = [];
  const num = (e: El, k: string, d = 0): number => { const v = e.attrs[k]; return v === undefined ? d : Number(v); };
  const paintOf = (e: El): Paint | null => {
    const fill = color(e.attrs['fill'] ?? (e.tag === 'path' || e.tag === 'polyline' || e.tag === 'line' ? 'none' : '#000000')), stroke = color(e.attrs['stroke']);
    if (fill === null || stroke === null) return null;
    const op = e.attrs['fill-opacity'];
    return {...(fill ? {fill} : {}), ...(op !== undefined ? {fillOpacity: Number(op)} : {}), ...(stroke ? {stroke, widthPx: num(e, 'stroke-width', 1)} : {}), ...dashOfSvg(e.attrs['stroke-dasharray'])};
  };
  const lineOpts = (l: Line) => ({dashed: l.paint.dashed, dotted: l.paint.dotted, ...(l.headPx ? {headPx: l.headPx} : {}), ends: {...(l.start ? {start: l.start} : {}), ...(l.end ? {end: l.end} : {})}});
  /** A filled mark whose fill is its outline's colour too (or that has none): what a line end can be drawn as. */
  const solidMark = (paint: Paint) => !!paint.fill && (!paint.stroke || paint.stroke.toLowerCase() === paint.fill.toLowerCase()) && paint.fillOpacity === undefined;
  /**
   * A closed outline: a small filled triangle or diamond (a possible line end), else a box: a rectangle as a rectangle, a diamond as a
   * diamond, any other filled outline as itself (`steps`). An unfilled one is just drawn.
   */
  const closedShape = (pts: Pt[], steps: PathStep[] | undefined, paint: Paint, fallback: () => string): Item => {
    const id = next();
    if (pts.length > 1 && Math.hypot((pts[0]?.x ?? 0) - (pts.at(-1)?.x ?? 0), (pts[0]?.y ?? 0) - (pts.at(-1)?.y ?? 0)) < 0.01) pts = pts.slice(0, -1);
    const small = areaOf(pts) <= HEAD_AREA && solidMark(paint);
    if (!steps && pts.length === 3 && small) return {kind: 'head', id, type: 'triangle', pts, xml: fallback, used: false};
    const [t, r, b, l] = pts;
    // a diamond, or a kite (a UML composition mark: its waist off the middle)
    const diamond = pts.length === 4 && t && r && b && l && Math.abs(t.x - b.x) < 1 && Math.abs(r.y - l.y) < 1 && r.y > t.y && r.y < b.y && r.x > t.x && l.x < t.x;
    if (!steps && diamond && small) return {kind: 'head', id, type: 'diamond', pts, xml: fallback, used: false};
    if (!paint.fill) return {kind: 'other', xml: fallback()};
    const rect = bboxOf(pts);
    if (!steps && diamond) return {kind: 'box', id, rect, geom: roundGeomXml('diamond', rect.w, rect.h), paint, texts: []};
    const axisRect = !steps && pts.length === 4 && pts.every(p => (Math.abs(p.x - rect.x) < 0.5 || Math.abs(p.x - rect.x - rect.w) < 0.5) && (Math.abs(p.y - rect.y) < 0.5 || Math.abs(p.y - rect.y - rect.h) < 0.5));
    if (axisRect) return {kind: 'box', id, rect, geom: prstGeomXml('rect'), paint, texts: []};
    const outline = steps ?? [...pts.map((p, i) => ({op: i ? 'L' as const : 'M' as const, pts: [p]})), {op: 'Z' as const, pts: []}];
    return {kind: 'box', id, rect, geom: outlineGeomXml(outline, rect), paint, texts: []};
  };
  const read = (e: El): Item | null | undefined => {
    const paint = paintOf(e);
    if (!paint) return null;
    const end: EndType | undefined = e.attrs['marker-end'] !== undefined ? 'triangle' : undefined;
    if (e.tag === 'rect') {
      const r = {x: num(e, 'x'), y: num(e, 'y'), w: num(e, 'width'), h: num(e, 'height')}, rx = num(e, 'rx', num(e, 'ry'));
      return {kind: 'box', id: next(), rect: r, geom: rx > 0 ? prstGeomXml('roundRect', Math.min(r.w, r.h) > 0 ? Math.min(50000, rx / Math.min(r.w, r.h) * 100000) : 0) : prstGeomXml('rect'), paint, texts: []};
    }
    if (e.tag === 'circle' || e.tag === 'ellipse') {
      const rx = e.tag === 'circle' ? num(e, 'r') : num(e, 'rx'), ry = e.tag === 'circle' ? num(e, 'r') : num(e, 'ry');
      const rect = {x: num(e, 'cx') - rx, y: num(e, 'cy') - ry, w: 2 * rx, h: 2 * ry};
      return {kind: 'box', id: next(), rect, geom: roundGeomXml('ellipse', rect.w, rect.h), paint, texts: []};
    }
    if (e.tag === 'polygon' || e.tag === 'polyline') {
      const v = (e.attrs['points'] ?? '').trim().split(/[\s,]+/).map(Number);
      const pts = Array.from({length: Math.floor(v.length / 2)}, (_, i) => ({x: v[2 * i] ?? 0, y: v[2 * i + 1] ?? 0}));
      if (pts.length < 2) return undefined;
      if (e.tag === 'polygon') return closedShape(pts, undefined, paint, () => polygonXml(next(), 'polygon', pts, paint));
      return paint.stroke ? openLine(pts, paint, end) : undefined;
    }
    if (e.tag === 'line') return paint.stroke ? {kind: 'line', id: next(), pts: [{x: num(e, 'x1'), y: num(e, 'y1')}, {x: num(e, 'x2'), y: num(e, 'y2')}], paint, ...(end ? {end} : {})} : undefined;
    let steps: PathStep[], closed: boolean;
    try { ({steps, closed} = svgPathSteps(e.attrs['d'] ?? '')); } catch { return null; }
    if (!steps.length) return undefined;
    const straight = steps.every((s, i) => (i === 0 ? s.op === 'M' : s.op === 'L' || (s.op === 'Z' && i === steps.length - 1)));
    const corners = steps.filter(s => s.op !== 'Z').map(s => s.pts[s.pts.length - 1]).filter((p): p is Pt => !!p);
    if (closed && steps.filter(s => s.op === 'M').length === 1) return closedShape(corners, straight ? undefined : steps, paint, () => pathShapeXml(next(), 'shape', steps, paint));
    if (paint.fill) return {kind: 'other', xml: pathShapeXml(next(), 'shape', steps, paint)};
    if (!paint.stroke) return undefined;
    // one run of straight segments: a line that can become a connector; anything else stays a freeform
    if (straight && !closed) return openLine(corners, paint, end);
    const id = next();
    return {kind: 'other', xml: freeformPathXml(id, `line-${id}`, steps, paint.stroke, paint.widthPx ?? 1, {dashed: paint.dashed, dotted: paint.dotted, arrow: !!end})};
  };
  /** An open line; a short V of 3 points (both arms under 20px) is an open arrowhead a line may end in. */
  const openLine = (pts: Pt[], paint: Paint, end: EndType | undefined): Item => {
    const [a, b, c] = pts, id = next();
    const line: Line = {kind: 'line', id, pts, paint, ...(end ? {end} : {})};
    if (pts.length === 3 && a && b && c && !end && !paint.dashed && !paint.dotted && Math.hypot(a.x - b.x, a.y - b.y) < 20 && Math.hypot(c.x - b.x, c.y - b.y) < 20)
      return {kind: 'head', id, type: 'arrow', pts, xml: () => lineXmlOf(line), used: false};
    return line;
  };
  const lineXmlOf = (it: Line): string => {
    const fit = fitConnector(it.pts), color = it.paint.stroke ?? '#000000', w = it.paint.widthPx ?? 1;
    if (fit.ok) return connectorShapeXml(it.id, `line-${it.id}`, fit.x, color, w, glueAt(it.pts[0], it.pts[1]), glueAt(it.pts[it.pts.length - 1], it.pts[it.pts.length - 2]), lineOpts(it));
    return freeformPathXml(it.id, `line-${it.id}`, it.pts.map((p, i) => ({op: i ? 'L' as const : 'M' as const, pts: [p]})), color, w, lineOpts(it));
  };
  const readText = (e: El): Item | null | undefined => {
    // an emoji's <tspan class="emoji"> only picks its font: its text is the line's (PowerPoint draws it in the system's emoji font); any other
    // <tspan> is rich text, not read here
    const plain = (c: El | string): c is string | El => typeof c === 'string' || (c.tag === 'tspan' && Object.keys(c.attrs).every(k => k === 'class') && c.attrs['class'] === 'emoji' && c.children.every(x => typeof x === 'string'));
    if (!e.children.every(plain)) return null;
    const content = e.children.map(c => typeof c === 'string' ? c : c.children.join('')).join('');
    if (!content.trim()) return undefined;
    const fill = color(e.attrs['fill'] ?? '#000000');
    if (!fill) return null;
    const a = e.attrs['text-anchor'];
    const anchor = a === 'middle' ? 'middle' : a === 'end' ? 'end' : 'start';
    return {kind: 'text', id: next(), inBox: false, t: {text: content, x: num(e, 'x'), y: num(e, 'y'), anchor, size: num(e, 'font-size', 16), bold: Number(e.attrs['font-weight'] ?? 400) >= 600 || e.attrs['font-weight'] === 'bold', color: fill}};
  };
  for (const c of root.children) {
    if (typeof c === 'string') { if (c.trim()) return null; continue; }
    if (SKIP.has(c.tag)) continue;
    if (!DRAWN.has(c.tag) || Object.keys(c.attrs).some(k => !KNOWN.has(k))) return null;
    const it = c.tag === 'text' ? readText(c) : read(c);
    if (it === null) return null;
    if (it) items.push(it);
  }
  const boxes = items.filter((i): i is Box => i.kind === 'box');
  const heads = items.filter((i): i is Head => i.kind === 'head');

  // text into boxes: each text goes to the smallest box holding it; a box keeps them only if they share one anchor and x (within the
  // layout's rounding) and the box is tight around them (a lane or a chart's plot holds texts it is not the frame of)
  const byBox = new Map<Box, Text[]>();
  for (const it of items) {
    if (it.kind !== 'text') continue;
    const {t} = it, w = [...t.text].length * t.size * 0.55;
    const left = t.anchor === 'middle' ? t.x - w / 2 : t.anchor === 'end' ? t.x - w : t.x;
    const holding = boxes.filter(b => left >= b.rect.x - 1 && left + w <= b.rect.x + b.rect.w + 1 && t.y - t.size * 0.8 >= b.rect.y - 1 && t.y <= b.rect.y + b.rect.h + 1);
    const smallest = holding.toSorted((p, q) => p.rect.w * p.rect.h - q.rect.w * q.rect.h)[0];
    if (smallest) byBox.set(smallest, [...(byBox.get(smallest) ?? []), it]);
  }
  // strictly smaller: two shapes on one rectangle (a fill and its outline) do not frame each other
  const inside = (a: Rect, b: Rect) => a.w * a.h < b.w * b.h - 1 && a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
  for (const [b, texts] of byBox) {
    const ys = texts.map(x => x.t.y), block = Math.max(...ys) - Math.min(...ys) + Math.max(...texts.map(x => x.t.size)) * 1.4;
    // a box framing other boxes (a lane, a chart's plot) is a background, unless it is tight around its texts
    if (b.rect.h > block + 40 && boxes.some(o => inside(o.rect, b.rect))) continue;
    if (!boxTextFits(b.rect, texts.map(x => x.t))) continue;
    for (const x of texts) x.inBox = true;
    b.texts = texts.map(x => x.t);
  }

  // line ends: a line ending in a mark (in a triangle or diamond, or at an open V's point) takes it as its end's shape, and its end moves
  // to the mark's far corner (the one farthest from the line's next point: the tip, on the box it points at)
  for (const it of items) {
    if (it.kind !== 'line') continue;
    for (const which of ['end', 'start'] as const) {
      const i = which === 'end' ? it.pts.length - 1 : 0, p = it.pts[i], q = it.pts[which === 'end' ? it.pts.length - 2 : 1];
      if (!p || !q || it[which]) continue;
      const h = heads.find(x => !x.used && (x.type === 'arrow' ? Math.hypot((x.pts[1]?.x ?? 0) - p.x, (x.pts[1]?.y ?? 0) - p.y) <= 1.5 : inOutline(p, x.pts, 1.5)));
      if (!h) continue;
      h.used = true;
      it[which] = h.type;
      const [tip, ...rest] = h.pts.toSorted((u, v) => Math.hypot(v.x - q.x, v.y - q.y) - Math.hypot(u.x - q.x, u.y - q.y)) as [Pt, ...Pt[]];
      it.pts[i] = tip;
      // the mark's length, tip to the middle of the rest: PowerPoint sizes an end by the line's width, so this picks the size (xml.ts endSize)
      const mid = {x: rest.reduce((a, p) => a + p.x, 0) / rest.length, y: rest.reduce((a, p) => a + p.y, 0) / rest.length};
      it.headPx = {...it.headPx, [which]: Math.hypot(tip.x - mid.x, tip.y - mid.y)};
    }
  }

  const out: string[] = [];
  // an end is glued to a box it touches and leaves outward: 3px along the line it is outside the box (a grid line that starts on the edge
  // of a background and runs across it is not a line from that box)
  const glueAt = (p: Pt | undefined, toward: Pt | undefined): Glue | undefined => {
    if (!p || !toward) return undefined;
    const d = Math.hypot(toward.x - p.x, toward.y - p.y), q = d ? {x: p.x + (toward.x - p.x) / d * 3, y: p.y + (toward.y - p.y) / d * 3} : p;
    // 3px along, the line must be clear of the box: not inside it, and not running along its edge
    const clear = (r: Rect) => q.x < r.x - 0.5 || q.x > r.x + r.w + 0.5 || q.y < r.y - 0.5 || q.y > r.y + r.h + 0.5;
    const b = boxes.filter(x => touches(x, p) && clear(x.rect)).toSorted((u, v) => u.rect.w * u.rect.h - v.rect.w * v.rect.h)[0];
    return b && {id: b.id, idx: siteIndex(b.rect, p, '')};
  };
  for (const it of items) {
    if (it.kind === 'box') {
      const name = it.texts.length ? nameOf('box', it.id, it.texts.toSorted((a, b) => a.y - b.y).map(t => t.text).join('')) : `shape-${it.id}`;
      out.push(geomShapeXml(it.id, name, it.rect, it.geom, it.paint, it.texts.length ? boxTextXml(it.rect, it.texts, fonts) : undefined));
    } else if (it.kind === 'line') out.push(lineXmlOf(it));
    else if (it.kind === 'head') {
      if (!it.used) out.push(it.xml());
    } else if (it.kind === 'text') {
      if (!it.inBox) out.push(textLineXml(it.id, nameOf('text', it.id, it.t.text), it.t, fonts));
    } else out.push(it.xml);
  }
  return out.join('');
}
