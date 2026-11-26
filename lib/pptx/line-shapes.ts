import {cxnXfrm, glueXml} from './connector-geometry-xml.ts';
import type {Glue} from './connector-geometry-xml.ts';
import type {ConnXfrm} from './geom.ts';
import {emu, endSize, solidFill, arrowEnds, cxnSp} from './xml.ts';
import {unglued, type PathStep} from './free-line.ts';

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

/**
 * An open line, not glued: a brace, a bracket, a curve, or a line no glued connector was made for (free-line.ts unglued decides its shape:
 * a straight segment or an orthogonal 3-segment elbow is a PowerPoint connector, anything else a freeform p:sp with a text body; ADR 0027).
 */
export function freeformPathXml(id: number, name: string, steps: readonly PathStep[], color: string, widthPx: number, opts: LineOpts = {}): string {
  return unglued(id, name, steps, `<a:ln w="${emu(widthPx)}">${solidFill(color)}${dashOf(opts)}${headsOf(opts, widthPx)}</a:ln>`);
}

