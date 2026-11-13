// The plain pieces a drawn band becomes when it has no boxes of its own to map: a line of text at its baseline, a preset shape, a closed
// polygon, a straight line. A band that draws with these (quadrant, flow shapes, ...) is native: every piece can be selected and edited.
import {LINE_HEIGHT_EM} from '../layout-util.ts';
import {fitConnector, type Pt} from './geom.ts';
import {connectorShapeXml, freeformPathXml, pathXml, type LineOpts, type PathStep} from './connectors.ts';
import {emu, hex, solidFill, sp, xfrm, type Fonts, type Rect} from './xml.ts';
import {runXml} from './text.ts';

/** `fillOpacity`: 0 to 1 (a tinted area). */
export interface Paint {fill?: string; fillOpacity?: number; stroke?: string; widthPx?: number; dashed?: boolean; dotted?: boolean}

const lineOf = (p: Paint): string => p.stroke
  ? `<a:ln w="${emu(p.widthPx ?? 2)}">${solidFill(p.stroke)}${p.dotted ? '<a:prstDash val="sysDot"/>' : p.dashed ? '<a:prstDash val="dash"/>' : ''}</a:ln>`
  : '<a:ln><a:noFill/></a:ln>';
const fillOf = (p: Paint): string => !p.fill ? '<a:noFill/>' : p.fillOpacity === undefined || p.fillOpacity >= 1 ? solidFill(p.fill) : `<a:solidFill><a:srgbClr val="${hex(p.fill)}"><a:alpha val="${Math.round(p.fillOpacity * 100000)}"/></a:srgbClr></a:solidFill>`;
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

/** The prstGeom of a preset, with its first adjustment if any. */
export const prstGeomXml = (prst: string, adj?: number): string => `<a:prstGeom prst="${prst}"><a:avLst>${adj === undefined ? '' : `<a:gd name="adj" fmla="val ${Math.round(adj)}"/>`}</a:avLst></a:prstGeom>`;

/** A preset shape (rect, roundRect, ellipse, diamond, triangle, ...) with no text. `adj` is the preset's first adjustment, if any. */
export function presetXml(id: number, name: string, prst: string, r: Rect, paint: Paint, adj?: number): string {
  return sp(id, name, `${xfrm(r)}${prstGeomXml(prst, adj)}${fillOf(paint)}${lineOf(paint)}`, EMPTY_TEXT);
}

/** A shape of a given geometry (a prstGeom, or a custGeom from roundGeomXml), holding `text` (a txBody from boxTextXml) if given. */
export function geomShapeXml(id: number, name: string, r: Rect, geom: string, paint: Paint, text = EMPTY_TEXT): string {
  return sp(id, name, `${xfrm(r)}${geom}${fillOf(paint)}${lineOf(paint)}`, text);
}

/**
 * The text body of a shape whose text the layout placed as separate lines: each line a paragraph at its own baseline (exact line
 * spacing, the space before making up the gap), aligned as anchored (left, centred, right), the insets putting each anchor where it was.
 * The text wraps at the box, so text typed into it stays inside.
 */
/** The insets that put every line at its anchor, or null when the lines' anchors cannot share one text area (see boxTextXml). */
function boxInsets(r: Rect, lines: readonly TextLine[]): {l: number; r: number} | null {
  const xs = (a: TextLine['anchor']) => [...new Set(lines.filter(t => t.anchor === a).map(t => Math.round(t.x)))];
  const starts = xs('start'), ends = xs('end'), mids = xs('middle');
  const near = (v: readonly number[]) => v.length === 0 || Math.max(...v) - Math.min(...v) <= 2;
  if (!near(starts) || !near(ends) || !near(mids)) return null;
  const l = starts.length ? (starts[0] ?? 0) - r.x : undefined, rr = ends.length ? r.x + r.w - (ends[0] ?? 0) : undefined;
  if (mids.length && l === undefined && rr === undefined) {
    // centred lines only: the text area is centred on them
    const x = mids[0] ?? 0, half = Math.max(0, Math.min(x - r.x, r.x + r.w - x));
    return {l: x - half - r.x, r: r.x + r.w - x - half};
  }
  // mixed: centred lines must sit at the middle of the text area, which the two insets bound
  const L = l ?? rr ?? 2, R = rr ?? l ?? 2;
  if (mids.length && Math.abs((mids[0] ?? 0) - (r.x + L + (r.w - L - R) / 2)) > 2) return null;
  if (L < -1 || R < -1 || L + R >= r.w) return null;
  return {l: Math.max(0, L), r: Math.max(0, R)};
}

/** The lines grouped by baseline (within a pixel), top to bottom. */
function rowsOf(lines: readonly TextLine[]): TextLine[][] {
  const rows: TextLine[][] = [];
  for (const t of lines.toSorted((a, b) => a.y - b.y)) {
    const last = rows[rows.length - 1];
    if (last && Math.abs((last[0]?.y ?? 0) - t.y) <= 1) last.push(t); else rows.push([t]);
  }
  return rows;
}
/** A row is one line, or a left and a right line on one baseline (PERT's "ES 5 ... EF 9"), which one paragraph holds with a right tab. */
const rowFits = (row: readonly TextLine[]): boolean => {
  if (row.length === 1) return true;
  const [a, b] = row.toSorted((u, v) => u.x - v.x);
  return row.length === 2 && a?.anchor === 'start' && b?.anchor === 'end';
};

/** Whether these lines can be the text of this box (boxTextXml can place every one at its anchor). */
export const boxTextFits = (r: Rect, lines: readonly TextLine[]): boolean => lines.length > 0 && boxInsets(r, lines) !== null && rowsOf(lines).every(rowFits);

/** The width (px) of the text area boxTextXml gives these lines in this box (the box less its insets), or null when they cannot share one. */
export function boxTextWidth(r: Rect, lines: readonly TextLine[]): number | null {
  const ins = lines.length ? boxInsets(r, lines) : null;
  return ins && r.w - ins.l - ins.r;
}

export function boxTextXml(r: Rect, lines: readonly TextLine[], fonts: Fonts): string {
  const rows = rowsOf(lines), first = rows[0]?.[0], ins = boxInsets(r, lines);
  if (!first || !ins || !rows.every(rowFits)) return EMPTY_TEXT;
  const l = ins.l, rr = ins.r;
  const algnOf = (t: TextLine) => t.anchor === 'middle' ? 'ctr' : t.anchor === 'end' ? 'r' : 'l';
  const pitch = (t: TextLine) => Math.round(t.size * LINE_HEIGHT_EM);
  const top = (t: TextLine) => t.y - pitch(t) * 0.8;
  const run = (t: TextLine, text = t.text) => runXml(text, t.size, t.bold, false, hex(t.color), fonts);
  const paras = rows.map((row, i) => {
    const t = row[0] as TextLine, prev = rows[i - 1]?.[0];
    const before = prev ? Math.max(0, top(t) - top(prev) - pitch(prev)) : 0;
    const spacing = `<a:lnSpc><a:spcPts val="${Math.round(pitch(t) * 75)}"/></a:lnSpc><a:spcBef><a:spcPts val="${Math.round(before * 75)}"/></a:spcBef>`;
    if (row.length === 2) {
      // a left and a right line on one baseline: one paragraph, the right one after a tab stop at the right edge of the text area
      const [a, b] = row.toSorted((u, v) => u.x - v.x) as [TextLine, TextLine];
      return `<a:p><a:pPr algn="l">${spacing}<a:tabLst><a:tab pos="${emu(Math.max(0, r.w - l - rr))}" algn="r"/></a:tabLst></a:pPr>${run(a)}${run(b, `\t${b.text}`)}</a:p>`;
    }
    return `<a:p><a:pPr algn="${algnOf(t)}">${spacing}</a:pPr>${run(t)}</a:p>`;
  }).join('');
  return `<a:bodyPr wrap="square" lIns="${emu(Math.max(0, l))}" tIns="${emu(Math.max(0, top(first) - r.y))}" rIns="${emu(Math.max(0, rr))}" bIns="0" anchor="t"><a:noAutofit/></a:bodyPr><a:lstStyle/>${paras}`;
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
/** A shape's or group's name (ADR 0054 D7): its kind and text (40 characters at most), and its DSL id after it when it has one. */
export const namedAs = (kind: string, text: string, dslId?: string): string => `${kind}${text ? `: ${[...text].slice(0, 40).join('')}` : ''}${dslId ? ` [${dslId}]` : ''}`;

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

/** A filled shape of any outline (the steps of a path that closes), as a freeform. */
export function pathShapeXml(id: number, name: string, steps: readonly PathStep[], paint: Paint): string {
  const all = steps.flatMap(s => s.pts);
  const xs = all.map(p => p.x), ys = all.map(p => p.y);
  const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(1, Math.max(...xs) - x), h = Math.max(1, Math.max(...ys) - y);
  const path = pathXml(steps, p => `<a:pt x="${emu(p.x - x)}" y="${emu(p.y - y)}"/>`);
  return sp(id, name, `${xfrm({x, y, w, h})}<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="l" t="t" r="r" b="b"/><a:pathLst><a:path w="${emu(w)}" h="${emu(h)}">${path}</a:path></a:pathLst></a:custGeom>${fillOf(paint)}${lineOf(paint)}`, EMPTY_TEXT);
}

/** An svg `stroke-dasharray` as a DrawingML dash: dots when the dash is no longer than the line is wide, dashes otherwise. */
export const dashOfSvg = (dash: string | undefined): Pick<Paint, 'dashed' | 'dotted'> => {
  if (!dash) return {};
  const first = Number(dash.split(/[ ,]+/)[0]);
  return first <= 2 ? {dotted: true} : {dashed: true};
};

/** A closed outline (path steps) as a custGeom over its bounding box `r`, its text area the whole box and its sites the middles of the
 *  box's top, left, bottom and right sides (0 to 3, as siteIndex counts). */
export function outlineGeomXml(steps: readonly PathStep[], r: Rect): string {
  const W = emu(r.w), H = emu(r.h), pos = (x: number, y: number) => `<a:pos x="${Math.round(x)}" y="${Math.round(y)}"/>`;
  const sites = `<a:cxn ang="16200000">${pos(W / 2, 0)}</a:cxn><a:cxn ang="10800000">${pos(0, H / 2)}</a:cxn><a:cxn ang="5400000">${pos(W / 2, H)}</a:cxn><a:cxn ang="0">${pos(W, H / 2)}</a:cxn>`;
  const path = pathXml(steps, p => `<a:pt x="${emu(p.x - r.x)}" y="${emu(p.y - r.y)}"/>`);
  return `<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst>${sites}</a:cxnLst><a:rect l="l" t="t" r="r" b="b"/><a:pathLst><a:path w="${W}" h="${H}">${path}</a:path></a:pathLst></a:custGeom>`;
}
