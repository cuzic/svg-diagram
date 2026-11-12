// The plain pieces a drawn band becomes when it has no boxes of its own to map: a line of text at its baseline, a preset shape, a closed
// polygon, a straight line. A band that draws with these (quadrant, flow shapes, ...) is native: every piece can be selected and edited.
import {LINE_HEIGHT_EM} from '../layout-util.ts';
import {fitConnector, type Pt} from './geom.ts';
import {connectorShapeXml, freeformPathXml, type LineOpts} from './connectors.ts';
import {emu, hex, solidFill, sp, xfrm, type Fonts, type Rect} from './xml.ts';
import {runXml} from './text.ts';

export interface Paint {fill?: string; stroke?: string; widthPx?: number; dashed?: boolean}

const lineOf = (p: Paint): string => p.stroke
  ? `<a:ln w="${emu(p.widthPx ?? 2)}">${solidFill(p.stroke)}${p.dashed ? '<a:prstDash val="dash"/>' : ''}</a:ln>`
  : '<a:ln><a:noFill/></a:ln>';
const fillOf = (p: Paint): string => p.fill ? solidFill(p.fill) : '<a:noFill/>';
const EMPTY_TEXT = '<a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="ja-JP"/></a:p>';

/** One line of text whose baseline is at (x, y), anchored as the svg anchors it. Not wrapped, so typing more makes it longer, not taller. */
export interface TextLine {text: string; x: number; y: number; anchor: 'start' | 'middle' | 'end'; size: number; bold: boolean; color: string}
export function textLineXml(id: number, name: string, t: TextLine, fonts: Fonts): string {
  const pitch = Math.round(t.size * LINE_HEIGHT_EM);
  // the box only places the line: wide enough for the text in any font, its edge or centre at the anchor
  const w = Math.max(16, [...t.text].length * t.size * 1.1 + 8), top = t.y - pitch * 0.8;
  const x = t.anchor === 'middle' ? t.x - w / 2 : t.anchor === 'end' ? t.x - w : t.x;
  const algn = t.anchor === 'middle' ? 'ctr' : t.anchor === 'end' ? 'r' : 'l';
  return sp(id, name, `${xfrm({x, y: top, w, h: pitch})}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln>`,
    `<a:bodyPr wrap="none" lIns="0" tIns="0" rIns="0" bIns="0" anchor="t"><a:noAutofit/></a:bodyPr><a:lstStyle/><a:p><a:pPr algn="${algn}"><a:lnSpc><a:spcPts val="${Math.round(pitch * 75)}"/></a:lnSpc></a:pPr>${runXml(t.text, t.size, t.bold, false, hex(t.color), fonts)}</a:p>`);
}

/** A preset shape (rect, roundRect, ellipse, diamond, triangle, ...) with no text. `adj` is the preset's first adjustment, if any. */
export function presetXml(id: number, name: string, prst: string, r: Rect, paint: Paint, adj?: number): string {
  const av = adj === undefined ? '' : `<a:gd name="adj" fmla="val ${Math.round(adj)}"/>`;
  return sp(id, name, `${xfrm(r)}<a:prstGeom prst="${prst}"><a:avLst>${av}</a:avLst></a:prstGeom>${fillOf(paint)}${lineOf(paint)}`, EMPTY_TEXT);
}

/** A shape of a given geometry (a custGeom from roundGeomXml) with no text. */
export function geomShapeXml(id: number, name: string, r: Rect, geom: string, paint: Paint): string {
  return sp(id, name, `${xfrm(r)}${geom}${fillOf(paint)}${lineOf(paint)}`, EMPTY_TEXT);
}

/** A closed polygon as a freeform shape (it keeps its points when moved, and its fill). */
export function polygonXml(id: number, name: string, points: readonly Pt[], paint: Paint): string {
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(1, Math.max(...xs) - x), h = Math.max(1, Math.max(...ys) - y);
  const pt = (p: Pt) => `<a:pt x="${emu(p.x - x)}" y="${emu(p.y - y)}"/>`;
  const path = points.map((p, i) => i === 0 ? `<a:moveTo>${pt(p)}</a:moveTo>` : `<a:lnTo>${pt(p)}</a:lnTo>`).join('') + '<a:close/>';
  return sp(id, name, `${xfrm({x, y, w, h})}<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="l" t="t" r="r" b="b"/><a:pathLst><a:path w="${emu(w)}" h="${emu(h)}">${path}</a:path></a:pathLst></a:custGeom>${fillOf(paint)}${lineOf(paint)}`, EMPTY_TEXT);
}

/** A straight line from a to b, a connector (so it can be re-routed), with an arrowhead at b if asked. */
export function lineXml(id: number, name: string, a: Pt, b: Pt, color: string, widthPx: number, opts: LineOpts = {}): string {
  const fit = fitConnector([a, b]);
  if (fit.ok) return connectorShapeXml(id, name, fit.x, color, widthPx, undefined, undefined, opts);
  return freeformPathXml(id, name, [{op: 'M', pts: [a]}, {op: 'L', pts: [b]}], color, widthPx, opts);
}

/** The name of a shape: its text when it has some (what PowerPoint's selection pane shows), else the kind and id. */
export const nameOf = (kind: string, id: number, text?: string): string => text ? `${kind}: ${[...text].slice(0, 40).join('')}` : `${kind}-${id}`;

/**
 * A diamond, ellipse, pill or hexagon (pointed left and right, as an obstacle) as a custGeom of w x h px whose text area is the whole box (a preset's is inset, which would move the text
 * off the layout's lines) and whose connection sites are the middles of the top, left, bottom and right sides: 0 to 3, as siteIndex counts.
 */
export function roundGeomXml(kind: 'diamond' | 'ellipse' | 'pill' | 'hex', w: number, h: number): string {
  const W = emu(w), H = emu(h), pos = (x: number, y: number) => `<a:pos x="${Math.round(x)}" y="${Math.round(y)}"/>`;
  const sites = `<a:cxn ang="16200000">${pos(W / 2, 0)}</a:cxn><a:cxn ang="10800000">${pos(0, H / 2)}</a:cxn><a:cxn ang="5400000">${pos(W / 2, H)}</a:cxn><a:cxn ang="0">${pos(W, H / 2)}</a:cxn>`;
  const pt = (x: number, y: number) => `<a:pt x="${Math.round(x)}" y="${Math.round(y)}"/>`;
  const arc = (r: number, rv: number, st: number, sw: number) => `<a:arcTo wR="${Math.round(r)}" hR="${Math.round(rv)}" stAng="${st}" swAng="${sw}"/>`;
  let path: string;
  if (kind === 'diamond') path = `<a:moveTo>${pt(W / 2, 0)}</a:moveTo><a:lnTo>${pt(W, H / 2)}</a:lnTo><a:lnTo>${pt(W / 2, H)}</a:lnTo><a:lnTo>${pt(0, H / 2)}</a:lnTo><a:close/>`;
  else if (kind === 'hex') { const k = emu(Math.min(16, h / 2)); path = `<a:moveTo>${pt(k, 0)}</a:moveTo><a:lnTo>${pt(W - k, 0)}</a:lnTo><a:lnTo>${pt(W, H / 2)}</a:lnTo><a:lnTo>${pt(W - k, H)}</a:lnTo><a:lnTo>${pt(k, H)}</a:lnTo><a:lnTo>${pt(0, H / 2)}</a:lnTo><a:close/>`; }
  else if (kind === 'ellipse') path = `<a:moveTo>${pt(0, H / 2)}</a:moveTo>${arc(W / 2, H / 2, 10800000, 10800000)}${arc(W / 2, H / 2, 0, 10800000)}<a:close/>`;
  else { const r = Math.min(W, H) / 2; path = `<a:moveTo>${pt(r, 0)}</a:moveTo><a:lnTo>${pt(W - r, 0)}</a:lnTo>${arc(r, r, 16200000, 10800000)}<a:lnTo>${pt(r, H)}</a:lnTo>${arc(r, r, 5400000, 10800000)}<a:close/>`; }
  return `<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst>${sites}</a:cxnLst><a:rect l="l" t="t" r="r" b="b"/><a:pathLst><a:path w="${W}" h="${H}">${path}</a:path></a:pathLst></a:custGeom>`;
}
