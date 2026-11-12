// A band with no mapping of its own (charts, swimlanes, sequence and Gantt diagrams, ...) drawn as native shapes from its own SVG: each
// rect, circle, polygon and path becomes a shape (a path that closes or is filled a freeform, an open one a line, with its head where it
// has a marker), each text a text box at its baseline. The SVG the band draws is the source, so the slide looks as the figure does, and
// every piece can be selected and edited. Anything outside the small set of elements and attributes read here (a transform, a <use>, a
// <tspan>, a gradient, ...) returns null, and the band is placed as a picture instead: a piece is never dropped or drawn wrong.
import {parseXml, type El} from '../svg-dom.ts';
import {freeformPathXml, type PathStep} from './connectors.ts';
import {nameOf, pathShapeXml, polygonXml, presetXml, textLineXml, dashOfSvg, type Paint} from './prims.ts';
import {svgPathSteps} from './svg-path.ts';
import type {Fonts} from './xml.ts';

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

/** The figure's shapes, or null when the SVG has something this does not read. Coordinates are the figure's own (the band's viewBox only crops). */
export function svgShapesXml(svg: string, fonts: Fonts, next: () => number): string | null {
  let root: El;
  try { root = parseXml(svg); } catch { return null; }
  const out: string[] = [];
  const num = (e: El, k: string, d = 0): number => { const v = e.attrs[k]; return v === undefined ? d : Number(v); };
  const visit = (e: El): boolean => {
    for (const c of e.children) {
      if (typeof c === 'string') { if (c.trim() && e.tag !== 'text') return false; continue; }
      if (SKIP.has(c.tag)) continue;
      if (!DRAWN.has(c.tag)) return false;
      if (Object.keys(c.attrs).some(k => !KNOWN.has(k))) return false;
      if (c.tag !== 'text' && !draw(c)) return false;
      if (c.tag === 'text' && !text(c)) return false;
    }
    return true;
  };
  const paintOf = (e: El): Paint | null => {
    const fill = color(e.attrs['fill'] ?? (e.tag === 'path' || e.tag === 'polyline' || e.tag === 'line' ? 'none' : '#000000')), stroke = color(e.attrs['stroke']);
    if (fill === null || stroke === null) return null;
    const op = e.attrs['fill-opacity'];
    return {...(fill ? {fill} : {}), ...(op !== undefined ? {fillOpacity: Number(op)} : {}), ...(stroke ? {stroke, widthPx: num(e, 'stroke-width', 1)} : {}), ...dashOfSvg(e.attrs['stroke-dasharray'])};
  };
  const draw = (e: El): boolean => {
    const paint = paintOf(e);
    if (!paint) return false;
    const id = next();
    const arrow = e.attrs['marker-end'] !== undefined;
    if (e.tag === 'rect') {
      const r = {x: num(e, 'x'), y: num(e, 'y'), w: num(e, 'width'), h: num(e, 'height')}, rx = num(e, 'rx', num(e, 'ry'));
      out.push(presetXml(id, `rect-${id}`, rx > 0 ? 'roundRect' : 'rect', r, paint, rx > 0 && Math.min(r.w, r.h) > 0 ? Math.min(50000, rx / Math.min(r.w, r.h) * 100000) : undefined));
    } else if (e.tag === 'circle' || e.tag === 'ellipse') {
      const rx = e.tag === 'circle' ? num(e, 'r') : num(e, 'rx'), ry = e.tag === 'circle' ? num(e, 'r') : num(e, 'ry');
      out.push(presetXml(id, `circle-${id}`, 'ellipse', {x: num(e, 'cx') - rx, y: num(e, 'cy') - ry, w: 2 * rx, h: 2 * ry}, paint));
    } else if (e.tag === 'polygon' || e.tag === 'polyline') {
      const v = (e.attrs['points'] ?? '').trim().split(/[\s,]+/).map(Number);
      const pts = Array.from({length: Math.floor(v.length / 2)}, (_, i) => ({x: v[2 * i] ?? 0, y: v[2 * i + 1] ?? 0}));
      if (pts.length < 2) return true;
      if (e.tag === 'polygon') out.push(polygonXml(id, `polygon-${id}`, pts, paint));
      else out.push(freeformPathXml(id, `line-${id}`, pts.map((p, i) => ({op: i ? 'L' as const : 'M' as const, pts: [p]})), paint.stroke ?? '#000000', paint.widthPx ?? 1, {dashed: paint.dashed, dotted: paint.dotted, arrow}));
    } else if (e.tag === 'line') {
      out.push(freeformPathXml(id, `line-${id}`, [{op: 'M', pts: [{x: num(e, 'x1'), y: num(e, 'y1')}]}, {op: 'L', pts: [{x: num(e, 'x2'), y: num(e, 'y2')}]}], paint.stroke ?? '#000000', paint.widthPx ?? 1, {dashed: paint.dashed, dotted: paint.dotted, arrow}));
    } else {
      let steps: PathStep[];
      try { ({steps} = svgPathSteps(e.attrs['d'] ?? '')); } catch { return false; }
      if (!steps.length) return true;
      if (paint.fill) out.push(pathShapeXml(id, `shape-${id}`, steps, paint));
      else if (paint.stroke) out.push(freeformPathXml(id, `line-${id}`, steps, paint.stroke, paint.widthPx ?? 1, {dashed: paint.dashed, dotted: paint.dotted, arrow}));
    }
    return true;
  };
  const text = (e: El): boolean => {
    if (e.children.some(c => typeof c !== 'string')) return false; // a <tspan>: rich text is not read here
    const content = e.children.join('');
    if (!content.trim()) return true;
    const fill = color(e.attrs['fill'] ?? '#000000');
    if (!fill) return false;
    const a = e.attrs['text-anchor'];
    const anchor = a === 'middle' ? 'middle' : a === 'end' ? 'end' : 'start';
    const id = next();
    out.push(textLineXml(id, nameOf('text', id, content), {text: content, x: num(e, 'x'), y: num(e, 'y'), anchor, size: num(e, 'font-size', 16), bold: Number(e.attrs['font-weight'] ?? 400) >= 600 || e.attrs['font-weight'] === 'bold', color: fill}, fonts));
    return true;
  };
  return visit(root) ? out.join('') : null;
}
