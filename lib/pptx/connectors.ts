import {PALETTE, textColorOf} from '../tokens.ts';
import type {ToneEnv} from '../tokens.ts';
import type {LaidOutDiagram} from '../types/index.ts';
import type {LaidOutConnect} from '../types/containers.ts';
import type {ConnXfrm} from './geom.ts';
import {emu, endSize, solidFill, arrowEnds, cxnSp} from './xml.ts';

export interface Glue {id: number; idx: number}
function cxnXfrm(x: Omit<ConnXfrm, 'prst'>, withRot: boolean): string {
  const rot = withRot && x.rot ? ` rot="${x.rot}"` : '';
  return `<a:xfrm${rot}${x.flipH ? ' flipH="1"' : ''}${x.flipV ? ' flipV="1"' : ''}><a:off x="${x.offX}" y="${x.offY}"/><a:ext cx="${x.extX}" cy="${x.extY}"/></a:xfrm>`;
}

const glueXml = (start?: Glue, end?: Glue): string =>
  `${start ? `<a:stCxn id="${start.id}" idx="${start.idx}"/>` : ''}${end ? `<a:endCxn id="${end.id}" idx="${end.idx}"/>` : ''}`;

const widthPx = (c: LaidOutConnect): number => c.weight === 'strong' ? 5 : 2;
const lineWidth = (c: LaidOutConnect): number => emu(widthPx(c));

/** A straight arrow between two boxes of a `row` band, 2.5px as the svg draws it. */
export function rowArrowXml(id: number, name: string, x: ConnXfrm, start?: Glue, end?: Glue): string {
  return cxnSp(id, name, glueXml(start, end), `${cxnXfrm(x, false)}<a:prstGeom prst="straightConnector1"><a:avLst/></a:prstGeom><a:ln w="${emu(2.5)}">${solidFill(PALETTE.text)}${arrowEnds('end', 2.5)}</a:ln>`);
}

/** A `bentConnector` fitted to the routed points, glued at either end where the shape is a native one. */
export function connectorXml(id: number, c: LaidOutConnect, x: ConnXfrm, day: LaidOutDiagram['day'], tones: ToneEnv, start?: Glue, end?: Glue): string {
  const dash = c.line === 'dashed' ? '<a:prstDash val="dash"/>' : c.line === 'dotted' ? '<a:prstDash val="sysDot"/>' : '';
  const cmpd = c.line === 'double' ? ' cmpd="dbl"' : '';
  const av = x.adj.map((v, i) => `<a:gd name="adj${i + 1}" fmla="val ${v}"/>`).join('');
  return cxnSp(id, `connect-${c.fromId}-${c.toId}`, glueXml(start, end), `${cxnXfrm(x, true)}<a:prstGeom prst="${x.prst}"><a:avLst>${av}</a:avLst></a:prstGeom><a:ln w="${lineWidth(c)}"${cmpd}>${solidFill(textColorOf(tones, c.tone, day))}${dash}${arrowEnds(c.arrow, widthPx(c))}</a:ln>`);
}

/** The fallback for a route no connector preset fits (and for annotations): a polyline, not glued. */
export function freeformXml(id: number, c: LaidOutConnect, day: LaidOutDiagram['day'], tones: ToneEnv): string {
  const xs = c.points.map(p => p.x), ys = c.points.map(p => p.y);
  const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(1, Math.max(...xs) - x), h = Math.max(1, Math.max(...ys) - y);
  const path = c.points.map((p, i) => `<a:${i === 0 ? 'moveTo' : 'lnTo'}><a:pt x="${emu(p.x - x)}" y="${emu(p.y - y)}"/></a:${i === 0 ? 'moveTo' : 'lnTo'}>`).join('');
  return cxnSp(id, `freeform-${c.fromId}-${c.toId}`, undefined, `<a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm><a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="l" t="t" r="r" b="b"/><a:pathLst><a:path w="${emu(w)}" h="${emu(h)}">${path}</a:path></a:pathLst></a:custGeom><a:ln w="${lineWidth(c)}">${solidFill(textColorOf(tones, c.tone, day))}${arrowEnds(c.arrow, widthPx(c))}</a:ln>`);
}

/** A connector of a band's own lines (a tree's), in a colour and width of its own, with no arrowhead; glued where the ends are shapes. */
export function connectorShapeXml(id: number, name: string, x: Omit<ConnXfrm, 'prst'> & {prst: string}, color: string, widthPx: number, start?: Glue, end?: Glue, opts: LineOpts = {}): string {
  const av = x.adj.map((v, i) => `<a:gd name="adj${i + 1}" fmla="val ${v}"/>`).join('');
  const dash = dashOf(opts);
  return cxnSp(id, name, glueXml(start, end), `${cxnXfrm(x, true)}<a:prstGeom prst="${x.prst}"><a:avLst>${av}</a:avLst></a:prstGeom><a:ln w="${emu(widthPx)}">${solidFill(color)}${dash}${headsOf(opts, widthPx)}</a:ln>`);
}

/** How a band's own line is drawn: dashed or dotted, and with an arrowhead at its end. */
/** The shape of a line end: a filled triangle, an open V (`arrow`), or a filled diamond. */
export type EndType = 'triangle' | 'arrow' | 'diamond';
/** `arrow`: a triangle at the end; `heads` names the ends explicitly; `ends` names each end's shape (and wins over both). */
export interface LineOpts {dashed?: boolean; dotted?: boolean; arrow?: boolean; heads?: 'start' | 'end' | 'both' | 'none'; ends?: {start?: EndType; end?: EndType}; /** The length (px) of the svg's mark at each end, when known (else the svg's usual head for the width). */ headPx?: {start?: number; end?: number}}
// a diamond mark (UML composition) is drawn large, as the svg's is; a triangle or V is sized for the line (xml.ts endSize)
const endXml = (tag: 'headEnd' | 'tailEnd', t: EndType | undefined, widthPx: number, headPx?: number): string => { if (!t) return ''; const s = t === 'diamond' ? 'lg' : endSize(widthPx, headPx); return `<a:${tag} type="${t}" w="${s}" len="${s}"/>`; };
const headsOf = (o: LineOpts, widthPx: number): string => o.ends ? endXml('headEnd', o.ends.start, widthPx, o.headPx?.start) + endXml('tailEnd', o.ends.end, widthPx, o.headPx?.end) : o.heads ? arrowEnds(o.heads, widthPx) : o.arrow ? arrowEnds('end', widthPx) : '';
const dashOf = (o: LineOpts): string => o.dotted ? '<a:prstDash val="sysDot"/>' : o.dashed ? '<a:prstDash val="dash"/>' : '';

/** One step of a freeform path: move, line, quadratic curve (control, end), cubic curve (two controls, end), or close. */
export interface PathStep {op: 'M' | 'L' | 'Q' | 'C' | 'Z'; pts: {x: number; y: number}[]}

/** An open freeform path (no fill), not glued: a brace, or a line no connector preset fits. */
export function freeformPathXml(id: number, name: string, steps: readonly PathStep[], color: string, widthPx: number, opts: LineOpts = {}): string {
  const all = steps.flatMap(s => s.pts);
  const xs = all.map(p => p.x), ys = all.map(p => p.y);
  const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(1, Math.max(...xs) - x), h = Math.max(1, Math.max(...ys) - y);
  const pt = (p: {x: number; y: number}) => `<a:pt x="${emu(p.x - x)}" y="${emu(p.y - y)}"/>`;
  const path = pathXml(steps, pt);
  return cxnSp(id, name, undefined, `<a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm><a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="l" t="t" r="r" b="b"/><a:pathLst><a:path w="${emu(w)}" h="${emu(h)}" fill="none">${path}</a:path></a:pathLst></a:custGeom><a:ln w="${emu(widthPx)}">${solidFill(color)}${dashOf(opts)}${headsOf(opts, widthPx)}</a:ln>`);
}

const TAG = {M: 'moveTo', L: 'lnTo', Q: 'quadBezTo', C: 'cubicBezTo'} as const;
/** The DrawingML of a path's steps, its points mapped by `pt`. */
export const pathXml = (steps: readonly PathStep[], pt: (p: {x: number; y: number}) => string): string =>
  steps.map(s => s.op === 'Z' ? '<a:close/>' : `<a:${TAG[s.op]}>${s.pts.map(pt).join('')}</a:${TAG[s.op]}>`).join('');
