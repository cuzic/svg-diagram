// Per-band-type structural checks of verifyDiagram(): the rects a band contributes to the overlap / connector / bounds checks
// (`rects`), the figure-internal checks it runs (`check`, in the `phase` it belongs to) and its text-contrast check (`contrast`).
// One entry per laid-out band type, each checked against its own band type; a band type without one fails to compile.

import {qualify, scopeOf} from './anchor-scope.ts';
import {plateStyle} from './image.ts';
import {segHitsRect} from './bars.ts';
import {checkChart} from './charts-verify.ts';
import {PALETTE, colorOf, luminance as lightLuminance, runColorOf, paintOf} from './tokens.ts';
import type {ToneEnv} from './tokens.ts';
import {resolveTextColor, resolveBoxStyle} from './emit-common.ts';
import {spotlightDim} from './spotlight.ts';
import {legibilityProblem} from './wordart.ts';
import {andClashes} from './cause-clash.ts';
import {CONTRAST_THRESHOLD, dxdy, eachOverlap, labelOf, neverTogether, outsideBox, outsideX, rectOverlap, routeHits, routesThroughNodes, statesProblems} from './verify-base.ts';
import type {LaidOutOf, LaidOutType} from './band-table.ts';
import type {EmphasisTone, Rect} from './types/core.ts';
import type {LaidOutDiagram} from './types/index.ts';
import type {LaidOutBanner, LaidOutBox, LaidOutCaption} from './types/text-bands.ts';
import type {CheckRect} from './types/verdicts.ts';

import {must} from './must.ts';
/** Where a band's findings go: `problems` fail the build, `warnings` never do. */
export interface VerifyOut {problems: string[]; warnings: string[]}

/**
 * The order the figure checks run in: every phase goes over all the bands, then the next one starts, so the findings of one kind
 * stay together (and in band order) whichever band types produce them.
 */
export const CHECK_PHASES = ['plane', 'quadrant', 'flow', 'wordart', 'bars', 'chart', 'image', 'timeline', 'states', 'cause', 'cloud', 'gantt', 'classes', 'bpmn', 'nowrap'] as const;
export type CheckPhase = typeof CHECK_PHASES[number];

export interface VerifyHandler<B> {
  rects?(band: B): CheckRect[];
  // `tones` comes last so a check that draws on no tone colour can leave it off
  check?: {phase: CheckPhase; run(band: B, d: LaidOutDiagram, out: VerifyOut, tones: ToneEnv): void};
  contrast?(band: B, d: LaidOutDiagram, tones: ToneEnv): string[];
}

// ---- rects: every checkable rect (captions with no ink box are skipped: no background, and their width is already wrap-constrained) ----

type Anchored = Rect & {id?: string; anchors: (Rect & {id: string})[]};
/** Each anchor is its own rect; `holds`: a connector that ends on the whole figure (its id) may run among them. */
const anchorRects = (band: Anchored, intentional?: string): CheckRect[] =>
  band.anchors.map(a => ({id: a.id, label: a.id, x: a.x, y: a.y, w: a.w, h: a.h, ...((band.id || intentional) ? {holds: [band.id, intentional].filter((x): x is string => !!x)} : {})}));
const figureRects = (band: Anchored): CheckRect[] => anchorRects(band);
const overlappingFigureRects = (band: Anchored): CheckRect[] => anchorRects(band, `@intentional-overlap:${band.x},${band.y}`);
const ownRect = (band: Rect & {id?: string}): CheckRect[] => [{id: band.id ?? null, label: labelOf(band), x: band.x, y: band.y, w: band.w, h: band.h}];
const holdsFigure = (band: {id?: string}) => band.id ? {holds: [band.id]} : {};
const frameRects = (band: {anchors: (Rect & {id: string})[]}): CheckRect[] => band.anchors.map(a => ({id: a.id, label: a.id, x: a.x, y: a.y, w: a.w, h: a.h}));
const childRects = (band: {children: (Rect & {id?: string})[]}): CheckRect[] => band.children.map(c => ({id: c.id ?? null, label: labelOf(c), x: c.x, y: c.y, w: c.w, h: c.h}));

// ---- figure checks ----

const checkTimeline = (band: LaidOutOf<'timeline'>, _d: LaidOutDiagram, {problems}: VerifyOut): void => {
  const line = band.fullLine && {x: band.fullLine.x - 1, y: band.fullLine.y1, w: 2, h: band.fullLine.y2 - band.fullLine.y1};
  for (const [i, b] of band.labelBoxes.entries()) {
    if (line && rectOverlap(b, line)) problems.push(`timeline: label "${b.label}" is crossed by the deadline line (move the mark or change the axis range)`);
    if (outsideX(b, band)) problems.push(`timeline: label "${b.label}" runs outside the figure (shorten it or widen the figure)`);
    for (let j = i + 1; j < band.labelBoxes.length; j++) {
      const o = rectOverlap(b, must(band.labelBoxes[j]));
      if (o) problems.push(`timeline: label "${b.label}" overlaps label "${must(band.labelBoxes[j]).label}" by ${dxdy(o)}`);
    }
  }
};

// A transition must not run through a state it does not touch; its label chip must stay inside the figure and clear of states and other chips.
const checkStates = (band: LaidOutOf<'states'>, _d: LaidOutDiagram, {problems}: VerifyOut): void => {
  problems.push(...statesProblems(band));
};

// A gantt's texts must stay inside the figure and apart (the today label against the tick labels, a long tick against the edge).
const checkGantt = (band: LaidOutOf<'gantt'>, _d: LaidOutDiagram, {problems}: VerifyOut): void => {
  for (const d of band.deps) { // a dependency arrow must not run through the bar of a task it does not join
    for (const [k, bar] of band.bars.entries()) {
      if (k === d.from || k === d.to) continue;
      if (routeHits(d.points, bar)) problems.push(`gantt: the arrow "${must(band.bars[d.from]).label}" -> "${must(band.bars[d.to]).label}" runs through the bar "${bar.label}" (reorder the rows, or drop the dependency)`);
    }
  }
  for (const [i, b] of band.labelBoxes.entries()) {
    if (outsideX(b, band)) problems.push(`gantt: label "${b.label}" runs outside the figure (shorten it or widen the figure)`);
    for (let j = i + 1; j < band.labelBoxes.length; j++) {
      const o = rectOverlap(b, must(band.labelBoxes[j]));
      if (o) problems.push(`gantt: label "${b.label}" overlaps label "${must(band.labelBoxes[j]).label}" by ${dxdy(o)}`);
    }
  }
};

// Relations must not run through a class they do not touch; labels and multiplicities must stay clear of classes and each other.
const checkClasses = (band: LaidOutOf<'classes'>, _d: LaidOutDiagram, {problems}: VerifyOut): void => {
  problems.push(...routesThroughNodes(band.edges, band.anchors, (e, n) => `classes: relation ${e.from} -> ${e.to} runs through class "${n.id}" (reorder the classes, or change dir)`));
  for (const [i, l] of band.labels.entries()) {
    if (outsideX(l, band)) problems.push(`classes: label "${l.text}" runs outside the figure`);
    for (const n of band.anchors) if (rectOverlap(l, n)) problems.push(`classes: label "${l.text}" overlaps class "${n.id}"`);
    band.edges.forEach((e, k) => { // the chip is white: on another relation it would cut it
      if (k !== l.edge && routeHits(e.points, l)) problems.push(`classes: label "${l.text}" sits on the relation ${e.from} -> ${e.to} (it belongs to another relation)`);
    });
    for (let j = i + 1; j < band.labels.length; j++) {
      const o = rectOverlap(l, must(band.labels[j]));
      if (o) problems.push(`classes: label "${l.text}" overlaps label "${must(band.labels[j]).text}" by ${dxdy(o)}`);
    }
  }
};

// A flow must not run through a node it does not touch; flow labels must stay clear of nodes and each other.
const checkBpmn = (band: LaidOutOf<'bpmn'>, _d: LaidOutDiagram, {problems}: VerifyOut): void => {
  problems.push(...routesThroughNodes(band.edges, band.anchors, (e, n) => `bpmn: flow ${e.from} -> ${e.to} runs through "${n.id}" (move a node to another lane, or reorder the flow)`));
  // the text of an event / gateway (and a task's name): inside the figure and clear of the lane names, of every flow, and of the other nodes
  for (const b of band.labelBoxes) {
    if (band.anchors.some(a => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h)) continue; // a node's own box
    if (b.x < band.x + (band.lanes[0]?.labelW ?? 0) - 0.5 || b.x + b.w > band.x + band.w + 0.5 || b.y < band.y - 0.5 || b.y + b.h > band.y + band.h + 0.5) problems.push(`bpmn: the text "${b.label}" runs outside its lane area (shorten it, or widen the figure)`);
    for (const n of band.anchors) if (rectOverlap(b, n)) problems.push(`bpmn: the text "${b.label}" overlaps "${n.id}"`);
    for (const e of band.edges) if (routeHits(e.points, b) && !band.labels.some(l => l.x === b.x && l.y === b.y)) problems.push(`bpmn: the text "${b.label}" is crossed by the flow ${e.from} -> ${e.to}`);
  }
  for (const [i, l] of band.labels.entries()) {
    band.edges.forEach((e, k) => { // the chip is white: on another flow it would cut it
      if (k !== l.edge && routeHits(e.points, l)) problems.push(`bpmn: label "${l.text}" sits on the flow ${e.from} -> ${e.to} (it belongs to another flow)`);
    });
    for (const n of band.anchors) if (rectOverlap(l, n)) problems.push(`bpmn: label "${l.text}" overlaps "${n.id}"`);
    for (let j = i + 1; j < band.labels.length; j++) {
      const o = rectOverlap(l, must(band.labels[j]));
      if (o) problems.push(`bpmn: label "${l.text}" overlaps label "${must(band.labels[j]).text}" by ${dxdy(o)}`);
    }
  }
};

// A cause arrow must not run through an entity it does not touch; the arrows of an AND must be joined by their arc.
const checkCause = (band: LaidOutOf<'cause'>, _d: LaidOutDiagram, {problems, warnings}: VerifyOut): void => {
  problems.push(...routesThroughNodes(band.edges, band.anchors, (e, n) => `cause: arrow ${e.from} -> ${e.to} runs through "${n.id}" (reorder the nodes, or change dir)`));
  // an AND's arc must cover only its own arrows, and must not touch another arc
  for (const [i, a] of band.ands.entries()) {
    const span = (p: {x: number; y: number}): number => Math.abs(a.p0.y - a.p1.y) < 1 ? p.x : p.y; // along the arc's length
    const us = [span(a.p0), span(a.p1)].sort((p, q) => p - q), u0 = must(us[0]), u1 = must(us[1]);
    // an arrow that ends on another side of the box (a return) is not under the arc, whatever its coordinate along it: compare the other coordinate with the AND's tips
    const across = (p: {x: number; y: number}): number => Math.abs(a.p0.y - a.p1.y) < 1 ? p.y : p.x;
    const member = band.edges.find(m => m.to === a.to && a.from.includes(m.from));
    const memberAt = member ? across(must(member.points.at(-1))) : undefined;
    for (const e of band.edges) {
      if (e.to !== a.to) continue;
      const tip = must(e.points.at(-1)), u = span(tip);
      if (memberAt !== undefined && Math.abs(across(tip) - memberAt) > 1) continue;
      const inside = u > u0 + 0.5 && u < u1 - 0.5;
      if (inside && !a.from.includes(e.from)) problems.push(`cause: the AND arc into "${a.to}" also covers the arrow from "${e.from}" (it reads as part of the AND)`);
    }
    for (let j = i + 1; j < band.ands.length; j++) {
      const b = must(band.ands[j]);
      if (b.to !== a.to) continue;
      const vs = [span(b.p0), span(b.p1)].sort((p, q) => p - q), v0 = must(vs[0]), v1 = must(vs[1]);
      if (Math.min(u1, v1) - Math.max(u0, v0) > -8) problems.push(`cause: two AND arcs into "${a.to}" touch (they read as one AND; give them more room)`);
    }
  }
  // arrows into an effect that has an AND: two of them should not cross (a warning: it can be unavoidable) and must not run together
  // (which arrow belongs to the AND would be unclear). A crossing elsewhere is left alone: many cause graphs cannot be drawn without one.
  for (const {a, b, how} of andClashes(band.edges, band.ands)) {
    // a crossing may be unavoidable (an AND's causes in different layers around an OR cause), and long arrows can share a run: warnings
    warnings.push(`[cause-${how === 'crosses' ? 'crossing' : 'parallel'}] cause: arrow ${a.from} -> ${a.to} ${how} arrow ${b.from} -> ${b.to} (reorder the nodes, or change dir)`);
  }
  for (const to of band.loose) problems.push(`cause: the arrows into "${to}" do not reach it on one side, so their AND arc is not drawn (an arrow of a cycle arrives from the other side: break the cycle, or split the AND)`);
};

// The numbers on a cloud's arrows must clear the boxes and each other, and stay inside the figure.
const checkCloud = (band: LaidOutOf<'cloud'>, _d: LaidOutDiagram, {problems}: VerifyOut): void => {
  for (const [i, c] of band.chips.entries()) {
    if (outsideX(c, band)) problems.push(`cloud: the number "${c.text}" on the ${c.arrow} arrow runs outside the figure`);
    for (const n of band.nodes) if (rectOverlap(c, n)) problems.push(`cloud: the number "${c.text}" on the ${c.arrow} arrow overlaps box ${n.key.toUpperCase()} (fewer assumptions on one arrow, or a wider figure)`);
    for (const e of band.edges) if (e.arrow !== c.arrow && routeHits(e.points, c)) problems.push(`cloud: ${c.conflict ? 'the conflict label' : `the number "${c.text}"`} sits on the ${e.arrow} arrow (shorten it)`);
    for (let j = i + 1; j < band.chips.length; j++) if (rectOverlap(c, must(band.chips[j]))) problems.push(`cloud: ${c.conflict || must(band.chips[j]).conflict ? 'the conflict label and the numbers' : `the numbers on the ${c.arrow} and ${must(band.chips[j]).arrow} arrows`} overlap`);
  }
};

const checkBars = (band: LaidOutOf<'bars'>, _d: LaidOutDiagram, {problems}: VerifyOut): void => {
  for (const b of band.labelBoxes) {
    if (outsideBox(b, band)) problems.push(`bars: value label "${b.label}" runs outside the figure (raise width / height or shorten the unit)`);
  }
  // the reference lines, the cumulative line and its guide must not run through a label (the curve over a histogram may)
  const segs = [...(band.ink?.lines ?? []).filter(l => !l.soft), ...(band.ink?.polylines ?? []).filter(l => !l.soft).flatMap(l => l.pts.slice(1).map((q, k) => ({x1: must(l.pts[k]).x, y1: must(l.pts[k]).y, x2: q.x, y2: q.y})))];
  for (const b of band.labelBoxes) {
    const hit = segs.find(sg => segHitsRect(sg, {x: b.x + 1, y: b.y + 2, w: b.w - 2, h: b.h - 4}));
    if (hit) problems.push(`bars: a reference line (a limit, a target, the guide or the cumulative line) runs through the label "${b.label}" (move the line, or hide the values with labels: 'category')`);
  }
  for (let i = 0; i < band.labelBoxes.length; i++) for (let j = i + 1; j < band.labelBoxes.length; j++) {
    const [a, b] = [must(band.labelBoxes[i]), must(band.labelBoxes[j])];
    if (a.bar !== undefined && b.bar !== undefined && neverTogether(must(band.bars[a.bar]), must(band.bars[b.bar]))) continue; // one replaces the other
    const o = rectOverlap(a, b);
    if (o) problems.push(`bars: value label "${a.label}" overlaps value label "${b.label}" by ${dxdy(o)}`);
  }
};

// image(): a label plate must stay inside the picture and clear of the other plates (it sits on the picture, so a plate over a plate hides words).
const checkImage = (band: LaidOutOf<'image'>, _d: LaidOutDiagram, {problems}: VerifyOut): void => {
  for (const p of band.plates) {
    if (outsideBox(p, band)) problems.push(`image: label "${p.text}" does not fit inside the picture (shorten it or make the picture bigger)`);
  }
  eachOverlap(band.plates, (a, b, o) => problems.push(`image: label "${a.text}" overlaps label "${b.text}" by ${dxdy(o)} (move one: its position is a fraction of the picture)`));
};

const checkNoWrap = (b: LaidOutBox, out: VerifyOut): void => {
  for (const o of b.nowrapOverflow ?? []) out.problems.push(`stat: value "${o.value}" does not fit its box even at the smallest size (${o.min}px: needs ${Math.ceil(o.width)}px, the box has ${Math.floor(o.avail)}px).\n  fix: widen the box (span / flex / width), shorten the value, or put the unit in the label.`);
};

// quadrant(): items keep clear of each other, of every label and of the arrows; every label stays inside the figure.
const checkQuadrant = (band: LaidOutOf<'quadrant'>, _d: LaidOutDiagram, {problems}: VerifyOut): void => {
  const nearRect = (cx: number, cy: number, r: number, b: Rect): boolean => Math.hypot(cx - Math.max(b.x, Math.min(cx, b.x + b.w)), cy - Math.max(b.y, Math.min(cy, b.y + b.h))) < r - 0.5;
  const fig = {x: band.x, y: band.y, w: band.w, h: band.h}, boxes = band.labelBoxes, bs = band.bubbles;
  for (const b of boxes) {
    const lim = b.kind === 'item' ? band.plot : fig;
    if (outsideBox(b, lim)) problems.push(`quadrant: label "${b.label}" runs outside the ${b.kind === 'item' ? 'plot' : 'figure'} (shorten it or widen the figure)`);
  }
  eachOverlap(boxes, (a, b, o) => problems.push(`quadrant: label "${a.label}" overlaps label "${b.label}" by ${dxdy(o)}`));
  // an item (its mark and its label) stays inside its own cell: one on a border reads as the other cell's
  const within = (r: Rect, c: Rect) => r.x >= c.x - 0.5 && r.y >= c.y - 0.5 && r.x + r.w <= c.x + c.w + 0.5 && r.y + r.h <= c.y + c.h + 0.5;
  bs.forEach(q => { if (!within({x: q.x - q.cr, y: q.y - q.cr, w: 2 * q.cr, h: 2 * q.cr}, must(band.cells[q.cell]))) problems.push(`quadrant: item "${q.label}" crosses the border of its cell`); });
  for (const b of boxes) if (b.kind === 'item' && b.item !== undefined && !within(b, must(band.cells[must(bs[b.item]).cell]))) problems.push(`quadrant: the label of "${b.label}" runs out of its cell`);
  bs.forEach((q, i) => {
    for (let j = i + 1; j < bs.length; j++) if (Math.hypot(q.x - must(bs[j]).x, q.y - must(bs[j]).y) < q.cr + must(bs[j]).cr - 1) problems.push(`quadrant: item "${q.label}" overlaps item "${must(bs[j]).label}" (move one, or give the cell more room)`);
    for (const b of boxes) if (nearRect(q.x, q.y, q.cr, b)) problems.push(`quadrant: item "${q.label}" sits on the label "${b.label}"`);
    if (q.x - q.cr < band.plot.x - 0.5 || q.x + q.cr > band.plot.x + band.plot.w + 0.5 || q.y - q.cr < band.plot.y - 0.5 || q.y + q.cr > band.plot.y + band.plot.h + 0.5) problems.push(`quadrant: item "${q.label}" runs outside the plot`);
  });
  band.arrows.forEach((a, k) => {
    const n = Math.max(1, Math.ceil(Math.hypot(a.x2 - a.x1, a.y2 - a.y1) / 3));
    const on = (r: Rect) => Array.from({length: n + 1}, (_v, s) => ({x: a.x1 + (a.x2 - a.x1) * s / n, y: a.y1 + (a.y2 - a.y1) * s / n})).some(p => p.x >= r.x - 1 && p.x <= r.x + r.w + 1 && p.y >= r.y - 1 && p.y <= r.y + r.h + 1);
    for (const b of boxes) if (b.kind !== 'arrow' && !(b.kind === 'axis') && on(b)) problems.push(`quadrant: arrow ${k + 1} runs through the label "${b.label}" (move an item, or a label's cell)`);
    for (const q of bs) if (Array.from({length: n + 1}, (_v, s) => ({x: a.x1 + (a.x2 - a.x1) * s / n, y: a.y1 + (a.y2 - a.y1) * s / n})).some(p => Math.hypot(p.x - q.x, p.y - q.y) < q.cr - 1)) problems.push(`quadrant: arrow ${k + 1} runs through the item "${q.label}"`);
  });
};

const checkFlowShape = (band: LaidOutOf<'chevron' | 'funnel' | 'cycle' | 'venn' | 'concentric'>, _d: LaidOutDiagram, {problems}: VerifyOut): void => {
  for (const t of band.labelBoxes) if (outsideBox(t, band)) problems.push(`${band.type}: label "${t.label}" runs outside the figure`);
  eachOverlap(band.labelBoxes, (a, b, o) => { if (o.dx > 1 && o.dy > 1) problems.push(`${band.type}: label "${a.label}" overlaps label "${b.label}" by ${dxdy(o)}`); });
};

// wordart(): the letters must read against what is behind them (see legibilityProblem). (The ink always stays inside the band: inkReach
// widens the rect on every side, and a shadow or a mirror image cannot be placed outside it.)
const checkWordArt = (band: LaidOutOf<'wordart'>, d: LaidOutDiagram, {problems}: VerifyOut, tones: ToneEnv): void => {
  const why = legibilityProblem(band.look, d.day, paintOf(tones, d.appearance));
  if (why) problems.push(`wordart "${band.text.slice(0, 20)}": ${why}`);
};

// plane(): every label it placed must stay inside the figure and clear of the other labels.
const checkPlane = (band: LaidOutOf<'plane'>, _d: LaidOutDiagram, {problems}: VerifyOut): void => {
  const boxes = band.labelBoxes, fig = band.bounds;
  for (const b of boxes) {
    if (outsideBox(b, fig)) problems.push(`plane: label "${b.label}" runs outside the figure (move its point, change labelAt / side, or enlarge the figure)`);
  }
  eachOverlap(boxes, (a, b, o) => problems.push(`plane: label "${a.label}" overlaps label "${b.label}" by ${dxdy(o)} (change labelAt / side)`));
  (band.paths ?? []).forEach((pa, i) => {
    if (pa.overshoot > 1.5) problems.push(`plane: path ${i + 1} leaves the axes by ${Math.round(pa.overshoot)}px (a curve through these points swings outside the plot; use smooth: false, add points, or widen the axis range)`);
  });
  // a label must not sit on the plane's ink either: an axis or its arrowhead, a tick mark, a point, a guide or a dimension line
  for (const b of boxes) {
    const hit = new Map<string, {dx: number; dy: number}>();
    for (const ob of band.obstacles) {
      if (ob.dim !== undefined && ob.dim === b.dim) continue; // a dimension's own label sits on its own line
      const o = rectOverlap(b, ob);
      if (o && !hit.has(ob.what)) hit.set(ob.what, o);
    }
    for (const [what, o] of hit) problems.push(`plane: label "${b.label}" overlaps ${what} by ${dxdy(o)} (move the label: labelAt / side / offset / anchor)`);
  }
};

// ---- contrast: computed purely from the known, closed set of (tone, day) colour combinations the DSL can ever produce ----
// The same formula lint-svg.ts uses, evaluated on values we already know.

const lum = (d: LaidOutDiagram, tones: ToneEnv) => { const paint = paintOf(tones, d.appearance); return (hex: string) => lightLuminance(paint(hex)); }; // judged on the colours as drawn

function contrastFor(band: LaidOutBox | LaidOutBanner | LaidOutCaption, boxTone: EmphasisTone | null, d: LaidOutDiagram, tones: ToneEnv): string[] {
  const luminance = lum(d, tones);
  const boxFill = band.dim ? PALETTE.bg : boxTone ? resolveBoxStyle(tones, boxTone, d.day).fill : PALETTE.bg;
  const found: string[] = [];
  for (const run of band.wrappedRuns ?? []) {
    const fg = band.dim ? PALETTE.muted : runColorOf(tones, run.tone, boxTone ?? undefined, d.day); // dim first: a dimmed solid box is white
    const delta = Math.abs(luminance(fg) - luminance(boxFill));
    if (delta < CONTRAST_THRESHOLD) {
      found.push(`"${run.text.slice(0, 20)}" (${fg} on ${boxFill}, in "${labelOf(band)}") has low contrast (delta=${delta.toFixed(0)}, want >= ${CONTRAST_THRESHOLD})`);
    }
    // a coloured piece of the run is its own text colour on the same fill (a dimmed box paints every piece muted: the run's check covers it)
    if (!band.dim) for (const sp of run.spans ?? []) {
      if (!sp.tone) continue;
      const spanFg = resolveTextColor(tones, sp.tone, d.day), spanDelta = Math.abs(luminance(spanFg) - luminance(boxFill));
      if (spanDelta < CONTRAST_THRESHOLD) found.push(`"${sp.text.slice(0, 20)}" (${spanFg} on ${boxFill}, in "${labelOf(band)}") has low contrast (delta=${spanDelta.toFixed(0)}, want >= ${CONTRAST_THRESHOLD})`);
    }
  }
  return found;
}

function barsContrast(band: LaidOutOf<'bars'>, d: LaidOutDiagram, tones: ToneEnv): string[] {
  const luminance = lum(d, tones), problems: string[] = [];
  for (const b of band.labelBoxes) {
    if (!b.background) continue;
    const dim = b.bar !== undefined && must(band.bars[b.bar]).dim; // a dimmed bar draws its label muted on bg (on the pale fill when spotlight dim is 'fill')
    const fg = dim ? PALETTE.muted : colorOf('bg', d.day), bg = dim ? (spotlightDim(d) === 'fill' ? PALETTE.border : PALETTE.bg) : colorOf(b.background, d.day);
    const delta = Math.abs(luminance(fg) - luminance(bg));
    if (delta < CONTRAST_THRESHOLD) problems.push(`bars: value label "${b.label}" (${fg} on ${bg}) has low contrast (delta=${delta.toFixed(0)}, want >= ${CONTRAST_THRESHOLD})`);
  }
  return problems;
}

function imageContrast(band: LaidOutOf<'image'>, d: LaidOutDiagram, tones: ToneEnv): string[] {
  const luminance = lum(d, tones), problems: string[] = [];
  for (const p of band.plates) {
    const st = plateStyle(tones, p.tone), fg = colorOf(st.text, d.day), bg = colorOf(st.fill, d.day), delta = Math.abs(luminance(fg) - luminance(bg));
    if (!p.dim && !band.dim && delta < CONTRAST_THRESHOLD) problems.push(`image: label "${p.text}" (${fg} on ${bg}) has low contrast (delta=${delta.toFixed(0)}, want >= ${CONTRAST_THRESHOLD})`);
  }
  return problems;
}

const flowCheck = {phase: 'flow', run: checkFlowShape} as const;

export const VERIFY_HANDLERS = {
  caption: {rects: band => band.inkBox ? [{id: null, label: `group title "${band.text}"`, ...band.inkBox}] : [], contrast: (band, d, tones) => contrastFor(band, null, d, tones)},
  box: {rects: ownRect, check: {phase: 'nowrap', run: (band, _d, out) => checkNoWrap(band, out)}, contrast: (band, d, tones) => contrastFor(band, band.tone ?? 'plain', d, tones)},
  banner: {rects: ownRect, contrast: (band, d, tones) => contrastFor(band, band.tone ?? 'accent', d, tones)},
  group: {},
  legend: {rects: ownRect},
  row: {rects: childRects, check: {phase: 'nowrap', run: (band, _d, out) => { for (const c of band.children) checkNoWrap(c, out); }}, contrast: (band, d, tones) => band.children.flatMap(c => contrastFor(c, c.tone ?? 'plain', d, tones))},
  grid: {rects: childRects, check: {phase: 'nowrap', run: (band, _d, out) => { for (const c of band.children) checkNoWrap(c, out); }}, contrast: (band, d, tones) => band.children.flatMap(c => contrastFor(c, c.tone ?? 'plain', d, tones))},
  raw: {rects: ownRect},
  status: {rects: band => [{id: null, label: 'status badge', ...band.pill}]},
  pyramid: {rects: ownRect},
  curve: {rects: ownRect},
  plane: {rects: ownRect, check: {phase: 'plane', run: checkPlane}},
  bars: {
    rects: band => band.bars.map((b, i) => ({id: b.id ?? null, label: b.id ?? `bar ${i + 1}`, x: b.x, y: b.y, w: b.w, h: b.h, ...(b.until === undefined && !b.reveal ? {} : {life: {reveal: b.reveal, until: b.until}})})),
    check: {phase: 'bars', run: checkBars},
    contrast: barsContrast,
  },
  chart: {
    rects: band => band.anchors.map(a => ({id: a.id, label: a.id, x: a.x, y: a.y, w: a.w, h: a.h, ...holdsFigure(band)})), // each bar / cell / node with an id is its own rect: a connector from outside must not run through one
    check: {phase: 'chart', run: (band, d, {problems}, tones) => { problems.push(...checkChart(band, d, tones)); }},
  },
  image: {
    rects: band => [{id: band.id ?? null, label: band.id ?? 'image', x: band.x, y: band.y, w: band.w, h: band.h, holds: band.anchors.map(a => a.id), ...(band.backdrop ? {backdrop: true} : {})}],
    check: {phase: 'image', run: checkImage},
    contrast: imageContrast,
  },
  people: {rects: ownRect},
  dots: {rects: ownRect},
  math: {rects: ownRect},
  quadrant: {rects: figureRects, check: {phase: 'quadrant', run: checkQuadrant}},
  chevron: {rects: figureRects, check: flowCheck},
  wordart: {rects: ownRect, check: {phase: 'wordart', run: checkWordArt}},
  funnel: {rects: figureRects, check: flowCheck},
  cycle: {rects: figureRects, check: flowCheck},
  venn: {rects: overlappingFigureRects, check: flowCheck},
  concentric: {rects: overlappingFigureRects, check: flowCheck},
  timeline: {rects: ownRect, check: {phase: 'timeline', run: checkTimeline}},
  bowtie: {rects: band => band.nodes.map((n, i) => ({id: null, label: band.labelBoxes[i]?.label ?? 'box', x: n.x, y: n.y, w: n.w, h: n.h, ...holdsFigure(band)}))},
  fta: {rects: band => band.nodes.map((n, i) => ({id: n.id ?? null, label: band.labelBoxes[i]?.label ?? 'event', x: n.x, y: n.y, w: n.w, h: n.h, ...holdsFigure(band)}))},
  tree: {rects: band => band.nodes.map((n, i) => ({id: n.id ?? null, label: band.labelBoxes[i]?.label ?? 'node', x: n.x, y: n.y, w: n.w, h: n.h, ...holdsFigure(band)}))},
  states: {rects: figureRects, check: {phase: 'states', run: checkStates}},
  cause: {rects: figureRects, check: {phase: 'cause', run: checkCause}},
  cloud: {rects: band => band.nodes.map(n => ({id: n.id ?? null, label: n.id ?? `cloud box ${n.key.toUpperCase()}`, x: n.x, y: n.y, w: n.w, h: n.h, ...holdsFigure(band)})), check: {phase: 'cloud', run: checkCloud}}, // every box is its own rect (also one without an id)
  gantt: {rects: figureRects, check: {phase: 'gantt', run: checkGantt}},
  classes: {rects: figureRects, check: {phase: 'classes', run: checkClasses}},
  bpmn: {rects: figureRects, check: {phase: 'bpmn', run: checkBpmn}},
  swimlane: {},
  sequence: {rects: ownRect},
  table: {rects: ownRect},
  wireframe: {rects: ownRect},
  screens: {rects: frameRects}, // each screen frame, not the bounding box that holds them all
} satisfies {[T in LaidOutType]: VerifyHandler<LaidOutOf<T>>};

/** Band types with no entry in VERIFY_HANDLERS: must be `never`. */
export type UnverifiedBandTypes = Exclude<LaidOutType, keyof typeof VERIFY_HANDLERS>;
export const ALL_BANDS_VERIFIED: UnverifiedBandTypes extends never ? true : never = true;

const handlerOf = (band: LaidOutDiagram['laidOut'][number]): VerifyHandler<LaidOutDiagram['laidOut'][number]> => VERIFY_HANDLERS[band.type] as VerifyHandler<never> as VerifyHandler<LaidOutDiagram['laidOut'][number]>;

/** Every checkable rect, in band order. */
export function collectRects(d: LaidOutDiagram): CheckRect[] {
  return d.laidOut.flatMap(band => {
    const rects = handlerOf(band).rects?.(band) ?? [], scope = scopeOf(band);
    return scope ? rects.map(r => scopedRect(band, scope, r)) : rects;
  });
}

/** A rect of a scoped band answers to the names a connect() holds (`plan.p0`), not the bare ids the band's own output keeps (ADR 0012). The band's own id is a name of the whole figure. */
function scopedRect(band: {type: string; id?: string}, scope: string, r: CheckRect): CheckRect {
  const own = band.type === 'box' ? undefined : band.id; // a swimlane step is a box: its id is the item's
  const name = (id: string): string => id === own || id.startsWith('@') ? id : qualify(scope, id);
  return {...r, id: r.id === null ? null : name(r.id), ...(r.holds ? {holds: r.holds.map(name)} : {})};
}

/** The figure checks of one phase, over every band in order. */
export function runCheckPhase(d: LaidOutDiagram, tones: ToneEnv, phase: CheckPhase, out: VerifyOut): void {
  for (const band of d.laidOut) {
    const check = handlerOf(band).check;
    if (check?.phase === phase) check.run(band, d, out, tones);
  }
}

/** The contrast problems of every band, in band order. */
export function contrastProblems(d: LaidOutDiagram, tones: ToneEnv): string[] {
  return d.laidOut.flatMap(band => handlerOf(band).contrast?.(band, d, tones) ?? []);
}
