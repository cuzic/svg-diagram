// An unglued line of the slide (ADR 0027): PowerPoint refuses or repairs a connector (p:cxnSp) with a custom geometry, so a line that is not
// one of PowerPoint's connector shapes is a freeform p:sp with the text body PowerPoint saves with one. Kept small: the core writer
// (connectors.ts) draws its unfitted routes through here without the band line helpers (line-shapes.ts).
import type {ConnXfrm} from './geom.ts';
import {cxnXfrm} from './connector-geometry-xml.ts';
import {emu, cxnSp, sp} from './xml.ts';

/** One step of a freeform path: move, line, quadratic curve (control, end), cubic curve (two controls, end), or close. */
export interface PathStep {op: 'M' | 'L' | 'Q' | 'C' | 'Z'; pts: {x: number; y: number}[]}

/** The text body PowerPoint saves with a shape that has no text. */
export const EMPTY_TEXT_BODY = '<a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p>';

/**
 * The line `steps` drawn with `ln` (its `<a:ln>` element), not glued: a straight segment or an orthogonal 3-segment elbow is a p:cxnSp with
 * PowerPoint's straightConnector1 / bentConnector3 (presetLine); anything else (curves, diagonals, a U, longer polylines) a p:sp with the
 * path (fill="none") and an empty text body, and nothing only a connector has.
 */
export function unglued(id: number, name: string, steps: readonly PathStep[], ln: string): string {
  const fit = presetLine(steps);
  if (fit) return cxnSp(id, name, undefined, `${cxnXfrm(fit, true)}<a:prstGeom prst="${fit.prst}"><a:avLst>${fit.adj.map((v, i) => `<a:gd name="adj${i + 1}" fmla="val ${v}"/>`).join('')}</a:avLst></a:prstGeom>${ln}`);
  const all = steps.flatMap(s => s.pts);
  const xs = all.map(p => p.x), ys = all.map(p => p.y);
  const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(1, Math.max(...xs) - x), h = Math.max(1, Math.max(...ys) - y);
  const path = pathXml(steps, p => `<a:pt x="${emu(p.x - x)}" y="${emu(p.y - y)}"/>`);
  return sp(id, name, `<a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm><a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="l" t="t" r="r" b="b"/><a:pathLst><a:path w="${emu(w)}" h="${emu(h)}" fill="none">${path}</a:path></a:pathLst></a:custGeom>${ln}`, EMPTY_TEXT_BODY);
}

/**
 * The connector preset of a path of straight steps that is one segment, or an orthogonal 3-segment elbow whose ends differ in both x and y,
 * as PowerPoint saves them; null for any other path (a U, a curve, a diagonal elbow, a longer polyline). A V-H-V elbow is a bentConnector3
 * turned 90deg clockwise: its box is the pre-rotation one (ext = |E.y-S.y| by |E.x-S.x|, centred between the ends), flipH when the end is above
 * the start, flipV when it is right of the start. geom.ts evalConnector draws these back onto the same points (test/pptx-lines.test.ts).
 */
export function presetLine(steps: readonly PathStep[]): ConnXfrm | null {
  if (steps[0]?.op !== 'M' || steps.slice(1).some(s => s.op !== 'L') || steps.some(s => s.pts.length !== 1)) return null;
  const p = steps.map(s => s.pts[0] as {x: number; y: number}), S = p[0], E = p[p.length - 1];
  if (!S || !E) return null;
  const eq = (a: number, b: number): boolean => Math.abs(a - b) < 0.01;
  const [sx, sy, ex, ey] = [emu(S.x), emu(S.y), emu(E.x), emu(E.y)];
  if (p.length === 2) return {prst: 'straightConnector1', offX: Math.min(sx, ex), offY: Math.min(sy, ey), extX: Math.abs(ex - sx), extY: Math.abs(ey - sy), rot: 0, flipH: ex < sx, flipV: ey < sy, adj: []};
  const [a, b] = [p[1], p[2]];
  if (p.length !== 4 || !a || !b || eq(S.x, E.x) || eq(S.y, E.y)) return null;
  const adj = (m: number, s: number, e: number): number[] => [Math.round(100000 * (m - s) / (e - s))];
  if (eq(S.y, a.y) && eq(a.x, b.x) && eq(b.y, E.y)) // H-V-H
    return {prst: 'bentConnector3', offX: Math.min(sx, ex), offY: Math.min(sy, ey), extX: Math.abs(ex - sx), extY: Math.abs(ey - sy), rot: 0, flipH: ex < sx, flipV: ey < sy, adj: adj(a.x, S.x, E.x)};
  if (eq(S.x, a.x) && eq(a.y, b.y) && eq(b.x, E.x)) { // V-H-V
    const w = Math.abs(ey - sy), h = Math.abs(ex - sx);
    return {prst: 'bentConnector3', offX: Math.round((sx + ex - w) / 2), offY: Math.round((sy + ey - h) / 2), extX: w, extY: h, rot: 5400000, flipH: ey < sy, flipV: ex > sx, adj: adj(a.y, S.y, E.y)};
  }
  return null;
}

const TAG = {M: 'moveTo', L: 'lnTo', Q: 'quadBezTo', C: 'cubicBezTo'} as const;
/** The DrawingML of a path's steps, its points mapped by `pt`. */
export const pathXml = (steps: readonly PathStep[], pt: (p: {x: number; y: number}) => string): string =>
  steps.map(s => s.op === 'Z' ? '<a:close/>' : `<a:${TAG[s.op]}>${s.pts.map(pt).join('')}</a:${TAG[s.op]}>`).join('');
