// connect() resolution: the "id:side@t" reference syntax, the polyline a connector follows, its label / chip placement, and
// bracket() / callout() annotations. Pure functions of the anchors laid out so far.

import type {LayoutCtx} from './layout-ctx.ts';
import {connectLabelWidth, labelRects, parseRef} from './connect-geometry.ts';
export {connectLabelWidth, labelRects, parseRef} from './connect-geometry.ts';
import {textWidth} from './atoms.ts';
import {resolveAnchor, unknownHint} from './scope-table.ts';
import type {ScopeTable} from './scope-table.ts';
import {CONNECT_LABEL_SIZE} from './tokens.ts';
import type {ConnectBand, LaidOutConnect} from './types/containers.ts';
import type {Bend, ConnectRef, Point, Rect, Roles, WidthOf} from './types/core.ts';

import {must} from './must.ts';
/**
 * A reference as written, with its id turned into the name the anchor is registered under (ADR 0012): a qualified name is itself,
 * a bare id that only one scoped item answers to is that item's qualified name, and one several answer to throws. Without scoped
 * items (the usual case) the reference comes back as it is.
 */
export function resolveRef(ref: string, anchors: ReadonlyMap<string, Rect>, scopes?: ScopeTable): ConnectRef {
  const r = parseRef(ref);
  return scopes?.byBare.size ? {...r, id: resolveAnchor(scopes, r.id, n => anchors.has(n)) ?? r.id} : r;
}

function anchorPoint(rect: Rect, side: string, at = 0.5): Point {
  switch (side) {
    case 'left': return {x: rect.x, y: rect.y + rect.h * at};
    case 'right': return {x: rect.x + rect.w, y: rect.y + rect.h * at};
    case 'top': return {x: rect.x + rect.w * at, y: rect.y};
    case 'bottom': return {x: rect.x + rect.w * at, y: rect.y + rect.h};
    default: return {x: rect.x + rect.w / 2, y: rect.y + rect.h / 2};
  }
}

// positions along a leg to try for a chip, nearest the middle first
const CHIP_TS = Array.from({length: 41}, (_, i) => 0.1 + i * 0.02).sort((a, b) => Math.abs(a - 0.5) - Math.abs(b - 0.5));
const CONNECT_STROKE_PAD = 3; // half-thickness allowance so a perfectly horizontal/vertical path segment still has a non-zero-area bbox to check

function segRect(x0: number, y0: number, x1: number, y1: number): Rect {
  const xa = Math.min(x0, x1), xb = Math.max(x0, x1);
  const ya = Math.min(y0, y1), yb = Math.max(y0, y1);
  return {x: xa - CONNECT_STROKE_PAD, y: ya - CONNECT_STROKE_PAD, w: (xb - xa) + 2 * CONNECT_STROKE_PAD, h: (yb - ya) + 2 * CONNECT_STROKE_PAD};
}

// Polyline the connector follows. 'straight' is a single segment; 'loop-under'
// is down/across/up; 'elbow' is orthogonal — vertical-horizontal-vertical when
// leaving a top/bottom side, horizontal-vertical-horizontal when leaving a
// left/right side (`bend`, 0..1, is where the middle leg sits between the two
// endpoints). Collinear/duplicate points are dropped so a degenerate elbow
// (aligned endpoints) is just a straight line.
/** How far (px) a levelled end stays from the top and bottom of its box: clear of the rounded corners (rx 8). */
const LEVEL_CLEAR = 12;

/**
 * a.right → b.left (or a.left → b.right) between boxes of different heights: each side's middle is at a different y, so the
 * line would come out slightly slanted (or, as an elbow, with a tiny step). When one end's middle is well inside the other box's
 * height, only the other end moves (to that middle; when both qualify, the end on the taller box); otherwise, when the two heights overlap enough, both ends move to the middle
 * of the overlap. An arrow of a branch() fan moves only its target end, so the fan keeps one start. An end placed with `@` stays put.
 */
function levelSides(band: ConnectBand, fromSide: string, toSide: string, fromRect: Rect, toRect: Rect, from: Point, to: Point): void {
  if (band.route !== 'straight' && band.route !== 'elbow') return;
  const facing = (fromSide === 'right' && toSide === 'left' && to.x >= from.x) || (fromSide === 'left' && toSide === 'right' && to.x <= from.x);
  const placed = (ref: string): boolean => /:[^:]*@/.test(ref);
  if (!facing || placed(band.from) || placed(band.to) || from.y === to.y) return;
  const within = (y: number, r: Rect): boolean => y >= r.y + LEVEL_CLEAR && y <= r.y + r.h - LEVEL_CLEAR;
  // the end on the taller box moves, so the line runs at the shorter box's middle (a fan keeps its start, whatever the heights)
  const moveFrom = !band.fan && toRect.h < fromRect.h && within(to.y, fromRect);
  if (moveFrom) { from.y = to.y; return; }
  if (within(from.y, toRect)) { to.y = from.y; return; }
  if (band.fan) return;
  if (within(to.y, fromRect)) { from.y = to.y; return; }
  const lo = Math.max(fromRect.y, toRect.y) + LEVEL_CLEAR, hi = Math.min(fromRect.y + fromRect.h, toRect.y + toRect.h) - LEVEL_CLEAR;
  if (hi >= lo) from.y = to.y = (lo + hi) / 2;
}

function routePoints(band: ConnectBand, from: Point, to: Point, fromSide: string): Point[] {
  let pts: Point[];
  if (band.route === 'loop-side') {
    // out past the shared side, along it, and back in: the way round a column (or row) of boxes that a straight line would cut through
    if (fromSide === 'top') { const y = Math.min(from.y, to.y) - band.dip; pts = [from, {x: from.x, y}, {x: to.x, y}, to]; }
    else { const x = fromSide === 'left' ? Math.min(from.x, to.x) - band.dip : Math.max(from.x, to.x) + band.dip; pts = [from, {x, y: from.y}, {x, y: to.y}, to]; }
  } else if (band.route === 'loop-under') {
    const midY = Math.max(from.y, to.y) + band.dip;
    pts = [from, {x: from.x, y: midY}, {x: to.x, y: midY}, to];
  } else if (band.route === 'elbow') {
    const vertical = fromSide === 'top' || fromSide === 'bottom' || (fromSide === 'center' && Math.abs(to.y - from.y) > Math.abs(to.x - from.x));
    if (vertical) {
      const midY = band.bend === 'end' ? to.y - Math.sign(to.y - from.y) * (band.bendOffset ?? 14) : band.bend === 'start' ? from.y + Math.sign(to.y - from.y) * (band.bendOffset ?? 14) : from.y + (to.y - from.y) * (band.bend as number); // 'auto' only reaches here from resolveConnect, which replaces the result
      pts = [from, {x: from.x, y: midY}, {x: to.x, y: midY}, to];
    } else {
      const midX = band.bend === 'end' ? to.x - Math.sign(to.x - from.x) * (band.bendOffset ?? 14) : band.bend === 'start' ? from.x + Math.sign(to.x - from.x) * (band.bendOffset ?? 14) : from.x + (to.x - from.x) * (band.bend as number);
      pts = [from, {x: midX, y: from.y}, {x: midX, y: to.y}, to];
    }
  } else {
    pts = [from, to];
  }
  return pts.filter((p, i) => i === 0 || p.x !== must(pts[i - 1]).x || p.y !== must(pts[i - 1]).y);
}

// The path's ink as a list of thin segment rects rather than one bounding
// box — a loop-under/elbow path's bbox would cover empty space that other
// boxes legitimately occupy.
function pathSegments(points: Point[]): Rect[] {
  const segs: Rect[] = [];
  for (let i = 0; i < points.length - 1; i++) segs.push(segRect(must(points[i]).x, must(points[i]).y, must(points[i + 1]).x, must(points[i + 1]).y));
  return segs;
}

const ANNOT_LEG = 16, ANNOT_GAP = 4, CALLOUT_LEN = 28;
/** bracket(): ⊔ (below) / ⊓ (above) from one anchor's x to the other's, label outside it. callout(): a leader line to the target, the text in a pill at its far end. */
function resolveAnnotation(band: ConnectBand, annot: NonNullable<ConnectBand['annot']>, anchors: Map<string, Rect>, widthOf: WidthOf, roles: Roles, scopes?: ScopeTable): LaidOutConnect {
  const {kind, side} = annot, size = roles.connectLabel ?? CONNECT_LABEL_SIZE;
  const fromRef = resolveRef(band.from, anchors, scopes), toRef = resolveRef(band.to, anchors, scopes);
  const fromRect = anchors.get(fromRef.id), toRect = anchors.get(toRef.id);
  if (!fromRect) throw new Error(`${kind}(): unknown anchor id "${fromRef.id}" (give the box an id)${scopes ? unknownHint(scopes, fromRef.id) : ''}`);
  if (!toRect) throw new Error(`${kind}(): unknown anchor id "${toRef.id}" (give the box an id)${scopes ? unknownHint(scopes, toRef.id) : ''}`);
  const from = anchorPoint(fromRect, fromRef.side, fromRef.at), to = anchorPoint(toRect, toRef.side, toRef.at);
  const lw = band.label ? textWidth(widthOf, band.label, size, 400) : 0;
  let points: Point[], labelX: number | undefined, labelY: number | undefined, labelBox: Rect | undefined, chipBox: Rect | undefined;
  if (kind === 'bracket') {
    const below = side === 'below';
    const edge = below ? Math.max(fromRect.y + fromRect.h, toRect.y + toRect.h) : Math.min(fromRect.y, toRect.y), y = edge + (below ? ANNOT_LEG : -ANNOT_LEG);
    const e0 = edge + (below ? ANNOT_GAP : -ANNOT_GAP); // a hair off the boxes, so the line does not touch them
    points = [{x: from.x, y: e0}, {x: from.x, y}, {x: to.x, y}, {x: to.x, y: e0}];
    if (band.label) {
      labelX = Math.round((from.x + to.x) / 2);
      labelY = Math.round(below ? y + 6 + size : y - 6);
      labelBox = {x: labelX - lw / 2, y: labelY - size, w: lw, h: size + 4};
    }
  } else {
    // `to` is the target; the bubble sits `side` of it. A leader of CALLOUT_LEN px runs from the pill to a point ANNOT_GAP short of the target's edge.
    const pw = lw + 16, ph = 24, vertical = side === 'above' || side === 'below', dir = side === 'above' || side === 'left' ? -1 : 1;
    const edge: Point = vertical
      ? (toRef.side === 'top' || toRef.side === 'bottom' ? to : {x: to.x, y: side === 'above' ? toRect.y : toRect.y + toRect.h})
      : (toRef.side === 'left' || toRef.side === 'right' ? to : {x: side === 'left' ? toRect.x : toRect.x + toRect.w, y: to.y});
    const end: Point = vertical ? {x: edge.x, y: edge.y + dir * ANNOT_GAP} : {x: edge.x + dir * ANNOT_GAP, y: edge.y};
    const reach = CALLOUT_LEN + (vertical ? ph : pw) / 2;
    const c: Point = vertical ? {x: end.x, y: end.y + dir * reach} : {x: end.x + dir * reach, y: end.y};
    const start: Point = vertical ? {x: c.x, y: c.y - dir * ph / 2} : {x: c.x - dir * pw / 2, y: c.y};
    points = [start, end];
    labelX = Math.round(c.x);
    labelY = Math.round(c.y + 5);
    chipBox = {x: labelX - pw / 2, y: labelY - 17, w: pw, h: ph};
    labelBox = chipBox;
  }
  return {...band, from: must(points[0]), to: must(points[points.length - 1]), fromId: fromRef.id, toId: toRef.id, fromLabel: band.from, toLabel: band.to, points, pathSegments: pathSegments(points), labelX, labelY, labelBox, chipBox};
}

/** A framed group's rectangle (and its id), as connect({via}) reads them off the laid-out bands. */
export type Frame = Rect & {id?: string};
const SIDES = ['left', 'right', 'top', 'bottom'];

/**
 * connect({via}) (ADR 0069 D2): the rectangle each end is joined at. An end with via stops on the frame of the outermost framed group that
 * holds its box but not the other end, on the side its ref names: the rectangle is that edge of the frame across the box's span, so `@t`,
 * plumb and levelSides read the box's range as before. Also the frames themselves (fromVia / toVia).
 */
function viaEnds(band: ConnectBand, fromRef: ConnectRef, toRef: ConnectRef, fromRect: Rect, toRect: Rect, frames: readonly Frame[]): {fromEnd: Rect; toEnd: Rect; fromVia?: Rect; toVia?: Rect} {
  const who = `connect(${band.from} -> ${band.to})`, via = band.via;
  if (!via) return {fromEnd: fromRect, toEnd: toRect};
  if (band.route !== 'straight' && band.route !== 'elbow') throw new Error(`${who}: via works with route 'straight' or 'elbow' (a ${band.route} runs round the boxes, not up to a frame)`);
  const holds = (f: Rect, r: Rect): boolean => r.x >= f.x - 0.5 && r.y >= f.y - 0.5 && r.x + r.w <= f.x + f.w + 0.5 && r.y + r.h <= f.y + f.h + 0.5;
  const out: {fromEnd: Rect; toEnd: Rect; fromVia?: Rect; toVia?: Rect} = {fromEnd: fromRect, toEnd: toRect};
  let moved = false;
  for (const end of ['from', 'to'] as const) {
    if (via !== 'group' && via[end] !== 'group') continue;
    const [ref, rect, other, written] = end === 'from' ? [fromRef, fromRect, toRect, band.from] : [toRef, toRect, fromRect, band.to];
    const own = frames.find(f => f.id !== undefined && f.id === ref.id); // the end is a framed group (ids are unique)
    if (own && via !== 'group') throw new Error(`${who}: "${ref.id}" is a group, so "${written}" already ends on its frame: drop via ${end}`);
    // the frames round the box (not its own, when the end is a group) that do not hold the other end; nested or apart, never crossing,
    // so the largest is the outermost (stopping on an inner one would cross the outer frame)
    const around = frames.filter(f => f !== own && holds(f, rect) && !holds(f, other)).sort((a, b) => b.w * b.h - a.w * a.h)[0];
    if (!around) {
      if (via !== 'group') throw new Error(`${who}: via ${end}: "${ref.id}" is not inside a framed group that leaves out the other end — drop via, or put the box in a group`);
      continue;
    }
    if (!SIDES.includes(ref.side)) throw new Error(`${who}: via needs a side on "${written}" (left / right / top / bottom): the side says which edge of the frame the line stops on`);
    const F = {x: around.x, y: around.y, w: around.w, h: around.h};
    const edge = ref.side === 'left' ? {x: F.x, y: rect.y, w: 0, h: rect.h} : ref.side === 'right' ? {x: F.x + F.w, y: rect.y, w: 0, h: rect.h}
      : ref.side === 'top' ? {x: rect.x, y: F.y, w: rect.w, h: 0} : {x: rect.x, y: F.y + F.h, w: rect.w, h: 0};
    if (end === 'from') { out.fromEnd = edge; out.fromVia = F; } else { out.toEnd = edge; out.toVia = F; }
    moved = true;
  }
  if (!moved) throw new Error(`${who}: via 'group', but neither end is inside a framed group that leaves out the other end — drop via, or put a box in a group`);
  return out;
}

/** An end stopped on a frame must face the other end: a left edge has it to the left, a top edge above ... (else the line crosses its own frame). */
function assertFacing(band: ConnectBand, side: string, p: Point, other: Point, written: string): void {
  const ok = side === 'left' ? other.x < p.x : side === 'right' ? other.x > p.x : side === 'top' ? other.y < p.y : other.y > p.y;
  if (!ok) throw new Error(`connect(${band.from} -> ${band.to}): via stops "${written}" on the ${side} edge of its frame, but the other end is not on that side — the line would cross the frame: use the side that faces the other end`);
}

/**
 * The leg at an end stopped on a frame must leave the frame, not run along it: an elbow that reaches a top / bottom edge horizontally (or a
 * left / right one vertically) would draw its last leg on the frame line itself, where no check sees it (a frame is not a check rectangle).
 */
function assertOffEdge(band: ConnectBand, side: string, end: Point, next: Point, written: string): void {
  const along = side === 'top' || side === 'bottom' ? Math.abs(next.y - end.y) < 0.5 && Math.abs(next.x - end.x) > 0.5 : Math.abs(next.x - end.x) < 0.5 && Math.abs(next.y - end.y) > 0.5;
  if (along) throw new Error(`connect(${band.from} -> ${band.to}): the elbow runs along the ${side} edge of the frame at "${written}" (its leg there lies on the frame line) — give the other end a side that leaves the same way (a ${side === 'top' || side === 'bottom' ? 'top / bottom' : 'left / right'} side, so the elbow starts that way), or use route 'straight'`);
}

export function resolveConnect(band: ConnectBand, anchors: Map<string, Rect>, areaIds: Set<string>, widthOf: WidthOf, roles: Roles, nodeBottoms: Map<string, number> = new Map(), scopes?: ScopeTable, frames: readonly Frame[] = []): LaidOutConnect {
  if (band.annot && band.via) throw new Error(`connect(${band.from} -> ${band.to}): a ${band.annot.kind}() takes no via`);
  if (band.annot) return resolveAnnotation(band, band.annot, anchors, widthOf, roles, scopes);
  const fromRef = resolveRef(band.from, anchors, scopes), toRef = resolveRef(band.to, anchors, scopes);
  const fromRect = anchors.get(fromRef.id);
  const toRect = anchors.get(toRef.id);
  if (!fromRect) throw new Error(`connect(): unknown anchor id "${fromRef.id}" (give the source box an id: '${fromRef.id}')${scopes ? unknownHint(scopes, fromRef.id) : ''}`);
  if (!toRect) throw new Error(`connect(): unknown anchor id "${toRef.id}" (give the target box an id: '${toRef.id}')${scopes ? unknownHint(scopes, toRef.id) : ''}`);
  if (band.route === 'loop-side' && (fromRef.side !== toRef.side || !['left', 'right', 'top'].includes(fromRef.side))) throw new Error(`connect(${band.from} -> ${band.to}): route 'loop-side' joins two anchors on the same left / right / top side (got ${fromRef.side} and ${toRef.side}); for the bottom side use 'loop-under'`);
  const {fromEnd, toEnd, fromVia, toVia} = viaEnds(band, fromRef, toRef, fromRect, toRect, frames);
  const from = anchorPoint(fromEnd, fromRef.side, fromRef.at);
  const to = anchorPoint(toEnd, toRef.side, toRef.at);
  if (fromVia) assertFacing(band, fromRef.side, from, to, band.from);
  if (toVia) assertFacing(band, toRef.side, to, from, band.to);
  // a node: left / right / top meet its icon, but bottom is under its label (not an end on a frame: it would be pulled back inside)
  if (!fromVia && fromRef.side === 'bottom' && nodeBottoms.has(fromRef.id)) from.y = must(nodeBottoms.get(fromRef.id));
  if (!toVia && toRef.side === 'bottom' && nodeBottoms.has(toRef.id)) to.y = must(nodeBottoms.get(toRef.id));
  if (band.plumb && (toRef.side === 'top' || toRef.side === 'bottom')) to.x = Math.min(toEnd.x + toEnd.w, Math.max(toEnd.x, from.x));
  levelSides(band, fromRef.side, toRef.side, fromEnd, toEnd, from, to);
  // a way back under a swimlane row runs below the row's lowest box, not below its two end boxes
  const u = band.under, rowBottom = u?.rows[u.group];
  if (u && rowBottom !== undefined) band = {...band, dip: rowBottom + u.off - Math.max(from.y, to.y)};
  let points = routePoints(band, from, to, fromRef.side);
  if (band.route === 'elbow' && band.bend === 'auto') {
    // Pick the first bend whose path stays clear of every box except the two it joins.
    const inside = (r: Rect, a?: Rect) => !!a && Math.min(r.x + r.w, a.x + a.w) - Math.max(r.x, a.x) > 0.5 && Math.min(r.y + r.h, a.y + a.h) - Math.max(r.y, a.y) > 0.5;
    const fromArea = areaIds.has(fromRef.id) ? fromRect : undefined, toArea = areaIds.has(toRef.id) ? toRect : undefined; // the boxes inside a row / column end belong to that end
    // (and the boxes in a frame an end stops on: the line comes from outside up to the frame)
    const others = [...anchors.entries()].filter(([id, r]) => id !== fromRef.id && id !== toRef.id && !areaIds.has(id) && !inside(r, fromArea) && !inside(r, toArea) && !inside(r, fromVia) && !inside(r, toVia)).map(([, r]) => r);
    const clear = (pts: Point[]) => pathSegments(pts).every(seg => others.every(r => {
      const ox = Math.min(seg.x + seg.w, r.x + r.w) - Math.max(seg.x, r.x);
      const oy = Math.min(seg.y + seg.h, r.y + r.h) - Math.max(seg.y, r.y);
      return ox <= 0.5 || oy <= 0.5;
    }));
    const cands = (['end', 'start', 0.5, 0.25, 0.75] as Bend[]).map(b => routePoints({...band, bend: b}, from, to, fromRef.side));
    points = cands.find(clear) ?? must(cands[0]);
  }
  if (fromVia) assertOffEdge(band, fromRef.side, must(points[0]), must(points[1]), band.from);
  if (toVia) assertOffEdge(band, toRef.side, must(points[points.length - 1]), must(points[points.length - 2]), band.to);
  const segments = pathSegments(points);

  let labelX: number | undefined, labelY: number | undefined, labelBox: Rect | undefined, chipBox: Rect | undefined;
  if (band.label) {
    const labelWidth = connectLabelWidth(band.label, roles, widthOf);
    const dy = band.chip ? 5 : -6; // a chip sits ON the line; a plain label sits above it
    if (band.route === 'elbow' && points.length === 4) {
      // vertical-first: label rides the middle (horizontal) leg; horizontal-
      // first: it rides the first leg, so a fan of branches from one box
      // gets labels at distinct x positions.
      const a = must(points[0]), b = must(points[1]), c2 = must(points[2]);
      const [p, q] = a.x === b.x ? [b, c2] : [a, b];
      labelX = Math.round((p.x + q.x) / 2);
      labelY = Math.round(p.y + dy);
      // A chip sits on the longest leg, at the first spot along it where the pill touches neither endpoint box.
      if (band.chip && points.length === 4) {
        const cw2 = labelWidth + 16;
        const legs: {p0: Point; p1: Point; len: number}[] = [];
        for (let i = 0; i < points.length - 1; i++) {
          const p0 = must(points[i]), p1 = must(points[i + 1]);
          legs.push({p0, p1, len: Math.abs(p1.x - p0.x) + Math.abs(p1.y - p0.y)});
        }
        legs.sort((x, y) => y.len - x.len);
        const hit = (r: Rect, bx: Rect) => !(bx.x + bx.w <= r.x || r.x + r.w <= bx.x || bx.y + bx.h <= r.y || r.y + r.h <= bx.y);
        let pick: {mx: number; my: number} | null = null;
        for (const l of legs) {
          if (l.len < 24) continue;
          for (const t of CHIP_TS) {
            const mx = l.p0.x + (l.p1.x - l.p0.x) * t, my = l.p0.y + (l.p1.y - l.p0.y) * t;
            const bx = {x: mx - cw2 / 2, y: my - 12, w: cw2, h: 24};
            if (!hit(fromVia ?? fromRect, bx) && !hit(toVia ?? toRect, bx)) { pick = {mx, my}; break; }
          }
          if (pick) break;
        }
        if (pick) { labelX = Math.round(pick.mx); labelY = Math.round(pick.my + dy); }
      }
    } else {
      const t = band.labelAt ?? 0.5;
      labelX = Math.round(from.x + (to.x - from.x) * t);
      labelY = Math.round((band.route === 'loop-under' ? Math.max(from.y, to.y) + band.dip : from.y + (to.y - from.y) * t) + dy);
      if (band.route === 'loop-side') {
        // the label rides the outer leg: beside it (outside) for a plain label, on it for a chip; on a top loop it sits above the line
        const outer = fromRef.side === 'top' ? undefined : must(points[1]).x;
        if (outer === undefined) { labelX = Math.round((from.x + to.x) / 2); labelY = Math.round(must(points[1]).y + dy); }
        else { labelX = Math.round(band.chip ? outer : outer + (fromRef.side === 'left' ? -1 : 1) * (labelWidth / 2 + 8)); labelY = Math.round((from.y + to.y) / 2 + (band.chip ? 5 : (roles.connectLabel ?? CONNECT_LABEL_SIZE) / 2 - 2)); }
      }
      // a plain label centred on a vertical line would be struck through by it: it sits beside the line instead (a chip is meant to sit on it)
      if (!band.chip && band.route === 'straight' && Math.round(from.x) === Math.round(to.x)) {
        labelX = Math.round(from.x + labelWidth / 2 + 8);
        labelY = Math.round(from.y + (to.y - from.y) * t + (roles.connectLabel ?? CONNECT_LABEL_SIZE) / 2 - 2);
      }
    }
    ({labelBox, chipBox} = labelRects(labelWidth, roles, !!band.chip, labelX, labelY));
  }

  // fromLabel/toLabel preserve the original "id:side" strings for error
  // messages — `from`/`to` themselves get overwritten by the spread below
  // with the resolved {x,y} points emit.ts's renderConnectPath needs.
  return {...band, from, to, fromId: fromRef.id, toId: toRef.id, fromArea: areaIds.has(fromRef.id) ? fromRect : undefined, toArea: areaIds.has(toRef.id) ? toRect : undefined, ...(fromVia ? {fromVia} : {}), ...(toVia ? {toVia} : {}), fromLabel: band.from, toLabel: band.to, points, pathSegments: segments, labelX, labelY, labelBox, chipBox};
}

export function layoutConnect(band: ConnectBand, ctx: LayoutCtx): void {
  const {roles, widthOf} = ctx;
  // Resolved immediately (not deferred) so a loop-under route can
  // reserve real vertical space for its dip + label — a zero-height
  // overlay resolved only after the whole stack is laid out would let
  // the return path silently collide with whatever comes next (this
  // was caught by lint-svg.ts's container-overflow check on the first
  // real test: a loop-under label overlapped the following banner).
  // When an anchor is not laid out yet (connect() declared before a box it
  // names) resolution waits until the whole stack is placed; such a
  // connector reserves no loop-under space.
  // A bare id that a scoped item also answers to waits too (ADR 0012): whether it is ambiguous is known only when every band is placed.
  const waits = (id: string): boolean => !ctx.anchors.has(id) || ctx.scopes.byBare.has(id);
  // a connect({via}) stops on a group's frame, read off the final laid-out groups (ADR 0069 D2): kept out of the layout state that
  // snapshotCtx / restoreCtx take back, so a frame a row or an areas() lays out again is never read in its first, discarded size
  if (band.via || waits(parseRef(band.from).id) || waits(parseRef(band.to).id)) { ctx.deferred.push(band); return; }
  const resolved = resolveConnect(band, ctx.anchors, ctx.areaIds, widthOf, roles, ctx.nodeBottoms, ctx.scopes);
  ctx.connects.push(resolved);
  // a bracket / callout under its boxes needs room for its line and label, as a loop-under does
  if (band.annot?.side === 'below') ctx.y = Math.max(ctx.y, ...resolved.pathSegments.map(r => r.y + r.h), resolved.labelBox ? resolved.labelBox.y + resolved.labelBox.h : 0) + 8;
  if (band.route === 'loop-under' && !band.under) { // a swimlane's ways back have their room inside the lane already
    const labelClearance = band.label ? 24 : 8;
    ctx.y = Math.max(resolved.from.y, resolved.to.y, ctx.y) + band.dip + labelClearance;
  }
}
