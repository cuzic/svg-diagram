// Per-band-type structural checks of verifyDiagram(): the rects a band contributes to the overlap / connector / bounds checks
// (`rects`), the figure-internal checks it runs (`check`, in the `phase` it belongs to) and its text-contrast check (`contrast`).
// One entry per laid-out band type, each checked against its own band type; a band type without one fails to compile.

import {bareNameIn, qualify, scopeOf} from './anchor-scope.ts';
import {plateStyle} from './image.ts';
import {segHitsRect} from './bars.ts';
import {checkChart} from './charts-verify.ts';
import {PALETTE, colorOf, luminance as lightLuminance, paintOf} from './tokens.ts';
import type {ToneEnv} from './tokens.ts';
import {boxLikeContrastProblems, nowrapProblems} from './verify-box-like.ts';
import {spotlightDim} from './spotlight.ts';
import {legibilityProblem} from './wordart.ts';
import {andClashes} from './cause-clash.ts';
import {sourceOf} from './source-ref.ts';
import type {SourceRef} from './source-ref.ts';
import {anchorRects, scopedRect} from './verify-rects.ts';
import {quadrantProblems} from './verify-quadrant.ts';
import {timelineProblems} from './verify-timeline.ts';
import {flowProblems} from './verify-flow.ts';
import {ganttProblems} from './verify-gantt.ts';
import {CONTRAST_THRESHOLD, dxdy, eachOverlap, issueAt, labelOf, neverTogether, outsideBox, outsideX, rectOverlap, routeHits, routesThroughNodes, statesProblems} from './verify-base.ts';
import type {LaidOutOf, LaidOutType} from './band-table.ts';
import type {ComicLaidBubble, LaidOutComic} from './types/comic.ts';
import type {EmphasisTone, Rect} from './types/core.ts';
import type {LaidOutDiagram} from './types/index.ts';
import type {LaidOutBanner, LaidOutBox, LaidOutCaption} from './types/text-bands.ts';
import type {CheckRect, Issue} from './types/verdicts.ts';

import {must} from './must.ts';
/** Where a band's findings go: `problems` fail the build, `warnings` never do. */
interface VerifyOut {
  problems: {push(...messages: string[]): void};
  warnings: string[];
  forChild(child: LaidOutBox): VerifyOut;
}

function outFor(issues: Issue[], warnings: string[], loc?: SourceRef): VerifyOut {
  return {
    problems: {push(...messages) { for (const message of messages) issues.push(issueAt(message, loc)); }},
    warnings,
    forChild: child => outFor(issues, warnings, sourceOf(child) ?? loc),
  };
}

/**
 * The order the figure checks run in: every phase goes over all the bands, then the next one starts, so the findings of one kind
 * stay together (and in band order) whichever band types produce them.
 */
export const CHECK_PHASES = ['plane', 'quadrant', 'flow', 'wordart', 'bars', 'chart', 'image', 'timeline', 'states', 'cause', 'cloud', 'gantt', 'classes', 'bpmn', 'comic', 'nowrap'] as const;
export type CheckPhase = typeof CHECK_PHASES[number];

export interface VerifyHandler<B> {
  rects?(band: B): CheckRect[];
  // `tones` comes last so a check that draws on no tone colour can leave it off
  check?: {phase: CheckPhase; run(band: B, d: LaidOutDiagram, out: VerifyOut, tones: ToneEnv): void};
  contrast?(band: B, d: LaidOutDiagram, tones: ToneEnv, out: VerifyOut): void;
}

// ---- rects: every checkable rect (captions with no ink box are skipped: no background, and their width is already wrap-constrained) ----

type Anchored = Parameters<typeof anchorRects>[0];
const figureRects = (band: Anchored): CheckRect[] => anchorRects(band);
/** An emblem's obstacle is the bounding box of each shape, not its anchor: a triangle's anchor leaves out its lower corners. */
const emblemRects = (band: Anchored & {bounds?: Anchored['anchors']}): CheckRect[] => anchorRects({...band, anchors: band.bounds ?? band.anchors});
const overlappingFigureRects = (band: Anchored): CheckRect[] => anchorRects(band, `@intentional-overlap:${band.x},${band.y}`);
const ownRect = (band: Rect & {id?: string}): CheckRect[] => [{id: band.id ?? null, label: labelOf(band), x: band.x, y: band.y, w: band.w, h: band.h}];
const holdsFigure = (band: {id?: string}) => band.id ? {holds: [band.id]} : {};
const frameRects = (band: {anchors: (Rect & {id: string})[]}): CheckRect[] => band.anchors.map(a => ({id: a.id, label: a.id, x: a.x, y: a.y, w: a.w, h: a.h}));
const childRects = (band: {children: LaidOutBox[]}): CheckRect[] => band.children.map(c => {
  const loc = sourceOf(c);
  return {id: c.id ?? null, label: labelOf(c), x: c.x, y: c.y, w: c.w, h: c.h, ...(loc ? {loc} : {})};
});

function comicSlotOwners(band: LaidOutComic): Map<string, ComicLaidBubble> {
  const owners = new Map<string, ComicLaidBubble>();
  for (const bubble of band.bubbles) for (const {id} of bubble.slots) {
    // Layout registers only the first anchor when a worksheet repeats a slot id.
    if (!owners.has(id)) owners.set(id, bubble);
  }
  return owners;
}

function comicRects(band: LaidOutComic): CheckRect[] {
  const scope = scopeOf(band), owners = comicSlotOwners(band);
  return band.panels.map(({id, x, y, w, h}) => {
    const holds = band.id ? [band.id] : [];
    for (const [slot, bubble] of owners) if (bubble.panel === id) holds.push(qualify(scope, slot));
    return {id: qualify(scope, id), label: `comic panel ${id}`, x, y, w, h, holds};
  });
}

// ---- figure checks ----

// A transition must not run through a state it does not touch; its label chip must stay inside the figure and clear of states and other chips.
const checkStates = (band: LaidOutOf<'states'>, _d: LaidOutDiagram, {problems}: VerifyOut): void => {
  problems.push(...statesProblems(band));
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
    if (b.x < band.x + (band.lanes[0]?.labelW ?? 0) - 0.5 || b.x + b.w > band.x + band.w + 0.5 || b.y < band.y + (band.lanes[0]?.labelH ?? 0) - 0.5 || b.y + b.h > band.y + band.h + 0.5) problems.push(`bpmn: the text "${b.label}" runs outside its lane area (shorten it, or widen the figure)`);
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
    // a negative branch tree with many side-effect branches: the narrowed / folded top-bottom figure is what crosses (ADR 0037 D4)
    const nbrHint = band.nbr?.vertical ? " NBR で枝が多いときは causeTree(..., {tree: 'nbr', dir: 'right'}) で解消することがある（ただし左右に長くなり、幅が広がることがある: diagram({width}) を広げるか、枝を 2 枚の図に分ける）" : '';
    warnings.push(`[cause-${how === 'crosses' ? 'crossing' : 'parallel'}] cause: arrow ${a.from} -> ${a.to} ${how} arrow ${b.from} -> ${b.to} (reorder the nodes, or change dir)${nbrHint}`);
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

// A comic's data and layout problems (ADR 0074 D6): the findings of its layout that are mistakes (the advice ones are lint findings, lib/rules.ts).
const checkComic = (band: LaidOutComic, d: LaidOutDiagram, {problems}: VerifyOut): void => {
  for (const f of band.findings) if (f.severity === 'problem') problems.push(`comic: ${f.message} [${f.rule}]`);
  if (!d.connects.length) return;
  const scope = scopeOf(band), owners = comicSlotOwners(band);
  for (const c of d.connects) {
    const fromId = bareNameIn(scope, c.fromId), toId = bareNameIn(scope, c.toId);
    const from = fromId === undefined ? undefined : owners.get(fromId), to = toId === undefined ? undefined : owners.get(toId);
    if (!from && !to) continue;
    // Other panels are checked by their frames. Inside the endpoint panels, check the bubbles individually.
    for (const b of band.bubbles) {
      if (b.panel !== from?.panel && b.panel !== to?.panel) continue;
      if (b === from || b === to || b.id === fromId || b.id === toId) continue;
      if (c.pathSegments.some(seg => rectOverlap(seg, b))) {
        problems.push(`connect(${c.fromLabel} -> ${c.toLabel}) の経路がふきだし "${qualify(scope, b.id)}" に重なります。接続の辺か経路を変えてください`);
      }
    }
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

const checkNoWrap = (band: LaidOutBox, out: VerifyOut): void => { out.problems.push(...nowrapProblems(band)); };

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
  problems.push(...(band.clashes ?? []));
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

function contrastFor(band: LaidOutBox | LaidOutBanner | LaidOutCaption, boxTone: EmphasisTone | null, d: LaidOutDiagram, tones: ToneEnv, {problems}: VerifyOut): void {
  problems.push(...boxLikeContrastProblems(band, boxTone, d.day, tones, d.appearance));
}

function barsContrast(band: LaidOutOf<'bars'>, d: LaidOutDiagram, tones: ToneEnv, {problems}: VerifyOut): void {
  const luminance = lum(d, tones);
  for (const b of band.labelBoxes) {
    if (!b.background) continue;
    const dim = b.bar !== undefined && must(band.bars[b.bar]).dim; // a dimmed bar draws its label muted on bg (on the pale fill when spotlight dim is 'fill')
    const fg = dim ? PALETTE.muted : colorOf('bg', d.day), bg = dim ? (spotlightDim(d) === 'fill' ? PALETTE.border : PALETTE.bg) : colorOf(b.background, d.day);
    const delta = Math.abs(luminance(fg) - luminance(bg));
    if (delta < CONTRAST_THRESHOLD) problems.push(`bars: value label "${b.label}" (${fg} on ${bg}) has low contrast (delta=${delta.toFixed(0)}, want >= ${CONTRAST_THRESHOLD})`);
  }
}

function imageContrast(band: LaidOutOf<'image'>, d: LaidOutDiagram, tones: ToneEnv, {problems}: VerifyOut): void {
  const luminance = lum(d, tones);
  for (const p of band.plates) {
    const st = plateStyle(tones, p.tone), fg = colorOf(st.text, d.day), bg = colorOf(st.fill, d.day), delta = Math.abs(luminance(fg) - luminance(bg));
    if (!p.dim && !band.dim && delta < CONTRAST_THRESHOLD) problems.push(`image: label "${p.text}" (${fg} on ${bg}) has low contrast (delta=${delta.toFixed(0)}, want >= ${CONTRAST_THRESHOLD})`);
  }
}

const flowCheck = {phase: 'flow', run: (band: Parameters<typeof flowProblems>[0], _d: LaidOutDiagram, {problems}: VerifyOut) => { problems.push(...flowProblems(band)); }} as const;
const childChecks: VerifyHandler<LaidOutOf<'row' | 'grid'>> = {
  rects: childRects,
  check: {phase: 'nowrap', run: (band, _d, out) => {
    for (const c of band.children) checkNoWrap(c, out.forChild(c));
  }},
  contrast: (band, d, tones, out) => {
    for (const c of band.children) contrastFor(c, c.tone ?? 'plain', d, tones, out.forChild(c));
  },
};

export const VERIFY_HANDLERS = {
  caption: {rects: band => band.inkBox ? [{id: null, label: `group title "${band.text}"`, ...band.inkBox}] : [], contrast: (band, d, tones, out) => contrastFor(band, null, d, tones, out)},
  box: {rects: ownRect, check: {phase: 'nowrap', run: (band, _d, out) => checkNoWrap(band, out)}, contrast: (band, d, tones, out) => contrastFor(band, band.tone ?? 'plain', d, tones, out)},
  banner: {rects: ownRect, contrast: (band, d, tones, out) => contrastFor(band, band.tone ?? 'accent', d, tones, out)},
  group: {},
  legend: {rects: ownRect},
  row: childChecks,
  grid: childChecks,
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
  quadrant: {rects: figureRects, check: {phase: 'quadrant', run: (band, _d, out) => { out.problems.push(...quadrantProblems(band)); }}},
  chevron: {rects: figureRects, check: flowCheck},
  wordart: {rects: ownRect, check: {phase: 'wordart', run: checkWordArt}},
  funnel: {rects: figureRects, check: flowCheck},
  cycle: {rects: figureRects, check: flowCheck},
  venn: {rects: overlappingFigureRects, check: flowCheck},
  concentric: {rects: overlappingFigureRects, check: flowCheck},
  emblem: {rects: emblemRects, check: flowCheck},
  valueChain: {rects: figureRects, check: flowCheck},
  timeline: {rects: ownRect, check: {phase: 'timeline', run: (band, _d, out) => { out.problems.push(...timelineProblems(band)); }}},
  bowtie: {rects: band => band.nodes.map((n, i) => ({id: null, label: band.labelBoxes[i]?.label ?? 'box', x: n.x, y: n.y, w: n.w, h: n.h, ...holdsFigure(band)}))},
  comic: {rects: comicRects, check: {phase: 'comic', run: checkComic}},
  fta: {rects: band => band.nodes.map((n, i) => ({id: n.id ?? null, label: band.labelBoxes[i]?.label ?? 'event', x: n.x, y: n.y, w: n.w, h: n.h, ...holdsFigure(band)}))},
  // a band node has no label box and is checked as the band it is (its own rects), so the label boxes count only the text nodes
  tree: {rects: band => { let li = 0; return band.nodes.flatMap(n => n.band ? [] : [{id: n.id ?? null, label: band.labelBoxes[li++]?.label ?? 'node', x: n.x, y: n.y, w: n.w, h: n.h, ...holdsFigure(band)}]); }},
  states: {rects: figureRects, check: {phase: 'states', run: checkStates}},
  cause: {rects: figureRects, check: {phase: 'cause', run: checkCause}},
  cloud: {rects: band => band.nodes.map(n => ({id: n.id ?? null, label: n.id ?? `cloud box ${n.key.toUpperCase()}`, x: n.x, y: n.y, w: n.w, h: n.h, ...holdsFigure(band)})), check: {phase: 'cloud', run: checkCloud}}, // every box is its own rect (also one without an id)
  gantt: {rects: figureRects, check: {phase: 'gantt', run: (band, _d, out) => { out.problems.push(...ganttProblems(band)); }}},
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
    // comicRects names panels and slots explicitly: a bare band id can have the same spelling as either.
    const scope = band.type === 'comic' ? undefined : scopeOf(band), loc = sourceOf(band);
    const rects = (handlerOf(band).rects?.(band) ?? []).map(r => loc && !r.loc ? {...r, loc} : r);
    return scope ? rects.map(r => scopedRect(band, scope, r)) : rects;
  });
}

/** The figure checks of one phase, over every band in order. */
export function runCheckPhase(d: LaidOutDiagram, tones: ToneEnv, phase: CheckPhase, issues: Issue[], warnings: string[]): void {
  for (const band of d.laidOut) {
    const check = handlerOf(band).check;
    if (check?.phase === phase) check.run(band, d, outFor(issues, warnings, sourceOf(band)), tones);
  }
}

/** The contrast problems of every band, in band order. */
export function contrastProblems(d: LaidOutDiagram, tones: ToneEnv): Issue[] {
  const issues: Issue[] = [], warnings: string[] = [];
  for (const band of d.laidOut) handlerOf(band).contrast?.(band, d, tones, outFor(issues, warnings, sourceOf(band)));
  return issues;
}
