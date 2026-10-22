// flow-nodes.ts: the shapes a flowchart adds to a state diagram (ADR 0041): a decision is a diamond that holds its text, a terminator is a pill.
// Pure: sizes come from the measured text, and an arrow that ends on a diamond is brought to its outline.
import {textWidth} from './atoms.ts';
import {measureNode} from './tree.ts';
import type {NodeLines} from './tree.ts';
import type {Roles, WidthOf, WrapMode} from './types/core.ts';
import type {Pt} from './graph-layout.ts';
import {must} from './must.ts';

const PAD_X = 14; // tree.ts's box padding: a pill keeps its text this far from the straight part
const DIAMOND_RATIO = 1.6, TEXT_PAD_X = 8, TEXT_PAD_Y = 6, MIN_TEXT_W = 88;
const grid8 = (v: number): number => Math.ceil(v / 8) * 8;
const lineH = (s: number): number => Math.round(s * 1.4);

type Measure = (maxW: number) => NodeLines;

/** The diamond that holds a text, as small as it can be: the text is a rectangle inscribed in it, `(tw + 2px) / W + (th + 2py) / H <= 1`
 *  with W : H = 1.6 : 1. Each extra line of text makes W wider (the text gets taller), so several widths of text are tried and the narrowest
 *  diamond wins; `maxW` only caps how wide a line of text may be (a larger cap never gives a wider diamond). */
export function diamondLines(label: string, sub: string | undefined, maxW: number, iconH: number, widthOf: WidthOf, roles: Roles, mode: WrapMode, floor: boolean): NodeLines {
  const L = roles.body, S = roles.note;
  const measure: Measure = mw => measureNode(label, sub, mw, widthOf, roles, mode, floor, {keepWords: true});
  // the widths to try for a line of text: a fixed grid up to the cap, so a larger cap only adds choices and can never give a wider diamond
  const widths: number[] = [];
  for (let mw = MIN_TEXT_W; mw <= Math.floor(maxW / 8) * 8; mw += 8) widths.push(mw);
  if (!widths.length) widths.push(maxW);
  let best: NodeLines | undefined;
  for (const mw of widths) {
    const m = measure(mw);
    const tw = Math.max(...m.label.map(l => textWidth(widthOf, l, L, 700)), ...m.sub.map(l => textWidth(widthOf, l, S, 400)));
    const th = m.label.length * lineH(L) + m.sub.length * lineH(S) + iconH;
    const W = grid8((tw + 2 * TEXT_PAD_X) + DIAMOND_RATIO * (th + 2 * TEXT_PAD_Y)), H = grid8(W / DIAMOND_RATIO);
    if (!best || W < best.w || (W === best.w && H < best.h)) best = {label: m.label, sub: m.sub, w: W, h: H};
  }
  return must(best);
}

/** A terminator: the box of the text, with room at both ends for the rounding (the radius is half the height). */
export function pillLines(l: NodeLines, iconH: number): NodeLines {
  const h = l.h + iconH;
  return {...l, h, w: l.w + 2 * Math.max(0, Math.ceil(h / 2) - PAD_X)};
}

/** The four vertices of a diamond (top, right, bottom, left) inside rect r. */
export const diamondPoints = (r: {x: number; y: number; w: number; h: number}): Pt[] => [{x: r.x + r.w / 2, y: r.y}, {x: r.x + r.w, y: r.y + r.h / 2}, {x: r.x + r.w / 2, y: r.y + r.h}, {x: r.x, y: r.y + r.h / 2}];

/** The diamond's half-extent along one axis, at `off` from the middle on the other (the arrows that share a side are spread
 *  around the middle, which for a rectangle is fine and for a diamond leaves each one floating off the slanted outline). */
const halfExtent = (off: number, half: number, along: number): number => along * (1 - Math.min(1, Math.abs(off) / half));

/**
 * An arrow that starts or ends on a diamond is routed to the rect's side; this moves that end along the arrow's last (first) segment onto
 * the outline. `end` is the point at the node's side, `next` its neighbour on the arrow. Other points are left as they are.
 */
export function ontoDiamond(end: Pt, next: Pt, r: {x: number; y: number; w: number; h: number}): Pt {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  if (end.x === next.x && end.y !== next.y) { // a vertical segment meets the top or the bottom
    const top = end.y <= cy, d = halfExtent(end.x - cx, r.w / 2, r.h / 2);
    return {x: end.x, y: top ? r.y + (r.h / 2 - d) : r.y + r.h - (r.h / 2 - d)};
  }
  if (end.y === next.y && end.x !== next.x) { // a horizontal one meets the left or the right
    const left = end.x <= cx, d = halfExtent(end.y - cy, r.h / 2, r.w / 2);
    return {x: left ? r.x + (r.w / 2 - d) : r.x + r.w - (r.w / 2 - d), y: end.y};
  }
  return end;
}

type R = {x: number; y: number; w: number; h: number};
const overlaps = (a: R, b: R): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * The arrows that leave a diamond straight down (the layout puts each target under the diamond, near its corners): start them at the
 * diamond's corners instead of at spots on its lower sides. Two arrows leave the left and right corners, a third the bottom one, so each
 * answer has its own corner. An arrow is moved only when its target's top edge is under the corner (it drops straight onto it) and nothing
 * stands in the way; any other arrow, and any that cannot move, keeps its path. `outs` are in the order of `paths`.
 */
export function vertexDrops(outs: {pts: Pt[]; target: R}[], r: R, others: R[]): Pt[][] {
  const straight = (o: {pts: Pt[]}): boolean => o.pts.length === 2 && must(o.pts[0]).x === must(o.pts[1]).x && must(o.pts[1]).y > must(o.pts[0]).y;
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2, result = outs.map(o => o.pts);
  const movable = outs.map((o, i) => ({o, i})).filter(({o}) => straight(o));
  if (movable.length < 1 || movable.length > 3 || movable.length < outs.length) return result; // a mix of shapes: leave the diamond as it is
  const corners = movable.length === 3 ? [r.x, cx, r.x + r.w] : movable.length === 2 ? [r.x, r.x + r.w] : [cx];
  movable.sort((p, q) => p.o.target.x + p.o.target.w / 2 - (q.o.target.x + q.o.target.w / 2));
  const next = result.slice(); // all or nothing: the answers must line up, so a failure keeps every path
  for (const [k, {o, i}] of movable.entries()) {
    const x = must(corners[k]), t = o.target, tip = must(o.pts[1]);
    if (x < t.x + 10 || x > t.x + t.w - 10) return result; // the target is not under this corner: keep every path (the answers would not line up)
    const seg: R = {x: x - 1, y: cy, w: 2, h: tip.y - cy};
    if (others.some(b => b !== t && overlaps(seg, b))) return result;
    next[i] = [{x, y: cy}, {x, y: tip.y}];
  }
  return next;
}
