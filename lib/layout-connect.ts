// connect() resolution: the "id:side@t" reference syntax, the polyline a connector follows, its label / chip placement, and
// bracket() / callout() annotations. Pure functions of the anchors laid out so far.

import {textWidth} from './atoms.ts';
import {resolveAnchor, unknownHint} from './anchor-scope.ts';
import type {ScopeTable} from './anchor-scope.ts';
import {CONNECT_LABEL_SIZE} from './tokens.ts';
import type {ConnectBand, LaidOutConnect} from './types/containers.ts';
import type {Bend, ConnectRef, Point, Rect, Roles, WidthOf} from './types/core.ts';

import {must} from './must.ts';
// 'id', 'id:side', or 'id:side@t' — t (0..1) slides the anchor along that side
// (default 0.5) so several connectors can leave/enter the same side in parallel.
export function parseRef(ref: string): ConnectRef {
  const [id, sideAt] = ref.split(':');
  const [side, at] = (sideAt ?? 'center').split('@');
  return {id: must(id), side: must(side), at: at === undefined ? 0.5 : Number(at)};
}

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

export function resolveConnect(band: ConnectBand, anchors: Map<string, Rect>, areaIds: Set<string>, widthOf: WidthOf, roles: Roles, nodeBottoms: Map<string, number> = new Map(), scopes?: ScopeTable): LaidOutConnect {
  if (band.annot) return resolveAnnotation(band, band.annot, anchors, widthOf, roles, scopes);
  const fromRef = resolveRef(band.from, anchors, scopes), toRef = resolveRef(band.to, anchors, scopes);
  const fromRect = anchors.get(fromRef.id);
  const toRect = anchors.get(toRef.id);
  if (!fromRect) throw new Error(`connect(): unknown anchor id "${fromRef.id}" (give the source box an id: '${fromRef.id}')${scopes ? unknownHint(scopes, fromRef.id) : ''}`);
  if (!toRect) throw new Error(`connect(): unknown anchor id "${toRef.id}" (give the target box an id: '${toRef.id}')${scopes ? unknownHint(scopes, toRef.id) : ''}`);
  if (band.route === 'loop-side' && (fromRef.side !== toRef.side || !['left', 'right', 'top'].includes(fromRef.side))) throw new Error(`connect(${band.from} -> ${band.to}): route 'loop-side' joins two anchors on the same left / right / top side (got ${fromRef.side} and ${toRef.side}); for the bottom side use 'loop-under'`);
  const from = anchorPoint(fromRect, fromRef.side, fromRef.at);
  const to = anchorPoint(toRect, toRef.side, toRef.at);
  // a node: left / right / top meet its icon, but bottom is under its label
  if (fromRef.side === 'bottom' && nodeBottoms.has(fromRef.id)) from.y = must(nodeBottoms.get(fromRef.id));
  if (toRef.side === 'bottom' && nodeBottoms.has(toRef.id)) to.y = must(nodeBottoms.get(toRef.id));
  if (band.plumb && (toRef.side === 'top' || toRef.side === 'bottom')) to.x = Math.min(toRect.x + toRect.w, Math.max(toRect.x, from.x));
  let points = routePoints(band, from, to, fromRef.side);
  if (band.route === 'elbow' && band.bend === 'auto') {
    // Pick the first bend whose path stays clear of every box except the two it joins.
    const inside = (r: Rect, a?: Rect) => !!a && Math.min(r.x + r.w, a.x + a.w) - Math.max(r.x, a.x) > 0.5 && Math.min(r.y + r.h, a.y + a.h) - Math.max(r.y, a.y) > 0.5;
    const fromArea = areaIds.has(fromRef.id) ? fromRect : undefined, toArea = areaIds.has(toRef.id) ? toRect : undefined; // the boxes inside a row / column end belong to that end
    const others = [...anchors.entries()].filter(([id, r]) => id !== fromRef.id && id !== toRef.id && !areaIds.has(id) && !inside(r, fromArea) && !inside(r, toArea)).map(([, r]) => r);
    const clear = (pts: Point[]) => pathSegments(pts).every(seg => others.every(r => {
      const ox = Math.min(seg.x + seg.w, r.x + r.w) - Math.max(seg.x, r.x);
      const oy = Math.min(seg.y + seg.h, r.y + r.h) - Math.max(seg.y, r.y);
      return ox <= 0.5 || oy <= 0.5;
    }));
    const cands = (['end', 'start', 0.5, 0.25, 0.75] as Bend[]).map(b => routePoints({...band, bend: b}, from, to, fromRef.side));
    points = cands.find(clear) ?? must(cands[0]);
  }
  const segments = pathSegments(points);

  let labelX: number | undefined, labelY: number | undefined, labelBox: Rect | undefined, chipBox: Rect | undefined;
  if (band.label) {
    const labelWidth = textWidth(widthOf, band.label, (roles.connectLabel ?? CONNECT_LABEL_SIZE), 400);
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
            if (!hit(fromRect, bx) && !hit(toRect, bx)) { pick = {mx, my}; break; }
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
    labelBox = {x: labelX - labelWidth / 2, y: labelY - (roles.connectLabel ?? CONNECT_LABEL_SIZE), w: labelWidth, h: (roles.connectLabel ?? CONNECT_LABEL_SIZE) + 4};
    if (band.chip) {
      chipBox = {x: labelX - (labelWidth + 16) / 2, y: labelY - 17, w: labelWidth + 16, h: 24};
      labelBox = chipBox;
    }
  }

  // fromLabel/toLabel preserve the original "id:side" strings for error
  // messages — `from`/`to` themselves get overwritten by the spread below
  // with the resolved {x,y} points emit.ts's renderConnectPath needs.
  return {...band, from, to, fromId: fromRef.id, toId: toRef.id, fromArea: areaIds.has(fromRef.id) ? fromRect : undefined, toArea: areaIds.has(toRef.id) ? toRect : undefined, fromLabel: band.from, toLabel: band.to, points, pathSegments: segments, labelX, labelY, labelBox, chipBox};
}
