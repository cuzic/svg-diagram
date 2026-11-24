// Per-band-type layout handlers for layoutBands() pass 2. Each takes the band, the LayoutCtx (cursor, anchors, laid-out list ...)
// and the x / width it is placed at; the table at the bottom is what stack() dispatches through.

import {coreDispatch, withLegacyTables} from './band-dispatch.ts';
import {splitAtoms, textWidth} from './atoms.ts';
import {wrapAtoms} from './wrap.ts';
import {layoutSequence, layoutTable} from './seq-table.ts';
import {layoutPlane} from './plane.ts';
import {IMAGE_PAD, layoutImage} from './image.ts';
import {layoutBars} from './bars.ts';
import {layoutDots, layoutPeople} from './people.ts';
import {layoutMath} from './math.ts';
import {layoutTimeline} from './timeline.ts';
import {layoutQuadrant} from './quadrant.ts';
import {layoutFlowShape} from './flow-shapes.ts';
import {layoutWordArt} from './wordart.ts';
import {layoutAreas} from './layout-areas.ts';
import {layoutRaw} from './layout-raw.ts';
import {layoutTreeBand, narrowField, treeItems} from './tree.ts';
import {resolveAnchor} from './anchor-scope.ts';
import {layoutStatesBand} from './states.ts';
import {statesWords} from './states-words.ts';
import {CAUSE_ROLES, layoutCauseBand, layoutCloudBand} from './toc.ts';
import {layoutGantt} from './gantt.ts';
import {layoutStatus} from './status.ts';
import {layoutClassesBand} from './classes.ts';
import {layoutBpmn} from './bpmn.ts';
import {layoutBpmnVertical} from './bpmn-vertical.ts';
import {layoutFta} from './fta.ts';
import {layoutBowtie} from './bowtie.ts';
import {layoutComic} from './comic/layout.ts';
import {layoutChart} from './charts.ts';
import {layoutWireframe, layoutScreens} from './wireframe.ts';
import type {LegendBand, SpacerBand, StatusBand, LaidOutLegendItem} from './types/containers.ts';
import type {LabelRole, Rect} from './types/core.ts';
import type {LaidOutTree, TreeItem} from './types/diagrams.ts';
import type {PyramidBand, CurveBand, LaidOutPyramidLayer} from './types/figures.ts';
import type {ImageBand} from './types/image.ts';
import type {Band, LaidOutBand} from './types/index.ts';
import type {SwimlaneBand, LaidOutLane, LaidOutPhase, LaidOutSwimlane} from './types/sequence-table-swimlane.ts';
import type {BandLayoutHandler, BandLayoutHandlers, LayoutCtx} from './layout-ctx.ts';
import {PALETTE, SHADES, blendLuminance, bestTextColor, canvasFontScale, paintOf} from './tokens.ts';
import {
  LINE_HEIGHT_EM, boundaryChipH, LEGEND_ITEM_GAP, LEGEND_ROW_H, LEGEND_SWATCH_W, SWIMLANE_COMFY_COL,
  snapGrid,
} from './layout-util.ts';
import {layoutConnect} from './layout-connect.ts';
import {layoutBoxLikeBand} from './layout-box-like.ts';
import {layoutGroup} from './layout-group.ts';
export {GROUP_FILL_MIN, groupFillPlan} from './layout-group.ts';
import {snapshotCtx, restoreCtx} from './layout-ctx.ts';
import {layoutGroupRow} from './layout-group-row.ts';
import {layoutGridBand} from './layout-grid.ts';
import {layoutRow} from './layout-row.ts';
import {addScoped, qualify, scopeOf} from './anchor-scope.ts';

import {must} from './must.ts';
type BandOf<T extends Band['type']> = Extract<Band, {type: T}>;
const rectOf = (p: Rect): Rect => ({x: p.x, y: p.y, w: p.w, h: p.h});
/** Writes `scope` onto a laid-out band/step whose static type has no such field (ADR 0012: scope is bolted on after layout, not part of each band's own shape). */
const setScope = (placed: object, scope: string | undefined): void => { if (scope) (placed as unknown as {scope: string}).scope = scope; };

/**
 * Band types whose insides are not on the 4px grid yet (a plot's fractional scale, the wireframe parts' own sizes): placed from the
 * cursor as it is, because a grid origin would move some of their shapes by a whole step (4px) when the emitter snaps them.
 */
const OFF_GRID_BANDS: ReadonlySet<string> = new Set(['plane', 'quadrant', 'timeline', 'wireframe', 'screens', 'wordart']);
/** Where a band of `type` is placed when the cursor is at `y` (U1b: on the 4px grid, so its frames and its text start from the same line). */
const originOf = (type: string, y: number): number => OFF_GRID_BANDS.has(type) ? y : snapGrid(y);

/**
 * A band laid out by one call (`layout`) that returns its own placement: its id (and its marks' ids, when `anchorWhat` is given)
 * become anchors, it is pushed, and the cursor moves past it. `what` / `anchorWhat` finish the duplicate-id message.
 */
type Describe<B> = string | ((band: B) => string);
const say = <B,>(s: Describe<B>, band: B): string => typeof s === 'string' ? s : s(band);
function placedBand<B extends Band & {id?: string}, P extends LaidOutBand & Rect>(
  layout: (band: B, x: number, y: number, w: number, ctx: LayoutCtx) => P,
  what: Describe<B>,
  anchorWhat?: Describe<B>,
): BandLayoutHandler<B> {
  return (band, ctx, padX, cw) => {
    const placed = layout(band, padX, originOf(band.type, ctx.y), cw, ctx); // placed on the grid; the cursor stays where it was (no drift)
    const scope = scopeOf(band); // ADR 0012: the band's items are registered as `scope.id`; the band's own output keeps its bare ids, and says which scope they belong to
    setScope(placed, scope);
    if (band.id) ctx.register(band.id, rectOf(placed), say(what, band));
    const unanchored = (band as {unanchored?: readonly string[]}).unanchored; // whyWhyTree(): entities the maker named itself are not names the author can use
    if (anchorWhat !== undefined) for (const a of (placed as unknown as {anchors: (Rect & {id: string})[]}).anchors) if (!unanchored?.includes(a.id)) ctx.register(a.id, rectOf(a), say(anchorWhat, band), scope);
    ctx.laidOut.push(placed);
    ctx.y += placed.h + ctx.d.gap;
  };
}

function layoutSpacer(band: SpacerBand, ctx: LayoutCtx): void { ctx.y += band.h; }

function layoutStatusBand(band: StatusBand, ctx: LayoutCtx, padX: number, cw: number): void {
  const placed = layoutStatus(band, padX, snapGrid(ctx.y), cw, ctx.widthOf, ctx.roles);
  ctx.laidOut.push(placed);
  ctx.y += placed.h + ctx.d.gap;
}

function layoutSeqTable(band: Band & {type: 'sequence' | 'table'}, ctx: LayoutCtx, padX: number, cw: number): void {
  const {d, roles, widthOf} = ctx;
  const placed = band.type === 'sequence' ? layoutSequence(band, padX, snapGrid(ctx.y), cw, widthOf, roles, ctx.wrap) : layoutTable(band, padX, snapGrid(ctx.y), cw, widthOf, roles, ctx.wrap);
  if (band.id) ctx.register(band.id, rectOf(placed), `a ${band.type} takes an id that another anchor already has`);
  ctx.laidOut.push(placed);
  ctx.y += placed.h + d.gap;
}

function layoutWireframeBand(band: Band & {type: 'wireframe' | 'screens'}, ctx: LayoutCtx, padX: number, cw: number): void {
  const {d, widthOf} = ctx;
  const placed = band.type === 'wireframe' ? layoutWireframe(band, padX, originOf(band.type, ctx.y), cw, widthOf, ctx.tones, ctx.wrap) : layoutScreens(band, padX, originOf(band.type, ctx.y), cw, widthOf, ctx.tones, ctx.wrap);
  for (const a of placed.anchors) if (a.id) ctx.register(a.id, rectOf(a), `a ${band.type} takes an id that another anchor already has`);
  ctx.laidOut.push(placed);
  ctx.y += placed.h + d.gap;
}

function layoutFlowShapeBand(band: Band & {type: 'chevron' | 'funnel' | 'cycle' | 'venn' | 'concentric' | 'emblem' | 'valueChain'}, ctx: LayoutCtx, padX: number, cw: number): void {
  const {d, roles, widthOf} = ctx;
  const placed = layoutFlowShape(band, padX, snapGrid(ctx.y), cw, widthOf, roles, ctx.wrap);
  const scope = scopeOf(band);
  setScope(placed, scope);
  if (band.id) { if (ctx.anchors.has(band.id)) ctx.claimed(band.id, `a ${band.type} takes an id that another anchor already has`); ctx.anchors.set(band.id, placed); }
  for (const a of placed.anchors) { const name = qualify(scope, a.id); if (ctx.anchors.has(name)) ctx.claimed(name, `a ${band.type} item takes an id that another anchor already has`); ctx.anchors.set(name, a); if (scope) addScoped(ctx.scopes, scope, a.id); }
  ctx.laidOut.push(placed); ctx.y += placed.h + d.gap;
}

function layoutWordArtBand(band: Band & {type: 'wordart'}, ctx: LayoutCtx, padX: number, cw: number): void {
  const placed = layoutWordArt(band, padX, originOf(band.type, ctx.y), cw, ctx.widthOf, ctx.roles, ctx.wrap);
  if (band.id) { if (ctx.anchors.has(band.id)) ctx.claimed(band.id, 'a wordart takes an id that another anchor already has'); ctx.anchors.set(band.id, placed); }
  ctx.laidOut.push(placed); ctx.y += placed.h + ctx.d.gap;
}

function layoutImageBand(band: ImageBand, ctx: LayoutCtx, padX: number, cw: number): void {
  const {d, roles, widthOf} = ctx;
  const top = ctx.y, placed = layoutImage(band, padX, snapGrid(top), cw, widthOf, roles);
  if (band.id) {
    if (ctx.anchors.has(band.id)) ctx.claimed(band.id, 'an image takes an id that another anchor already has');
    ctx.anchors.set(band.id, {x: placed.x, y: placed.y, w: placed.w, h: placed.h});
  }
  const scope = scopeOf(band);
  setScope(placed, scope);
  for (const a of placed.anchors) ctx.register(a.id, {x: a.x, y: a.y, w: a.w, h: a.h}, 'a mark takes an id that another anchor already has', scope);
  ctx.laidOut.push(placed);
  if (band.children?.length) { // the picture is a backdrop: its parts stack from the top inside it, drawn after it
    const pad = band.pad ?? IMAGE_PAD;
    ctx.y = placed.y + pad;
    ctx.stack(band.children, placed.x + pad, placed.w - 2 * pad);
    const bottom = ctx.y - d.gap, room = placed.y + placed.h - pad;
    if (bottom > room + 0.5) throw new Error(`image(): the parts over it need ${Math.round(bottom - placed.y + pad)}px of height but the picture is ${placed.h}px high (make the picture bigger with width / height, or use less content)`);
  }
  ctx.y = top + placed.h + d.gap;
}

function layoutSwimlane(band: SwimlaneBand, ctx: LayoutCtx, padX: number, cw: number): void {
  const {d, roles, widthOf} = ctx;
  // a boundary's name sits in a chip across the label column: the column is never narrower than the longest name + the chip's round ends, fit: 'shrink' included
  const chipText = Math.max(0, ...(band.boundaries ?? []).filter(b => b.label).map(b => textWidth(widthOf, b.label as string, roles.note, 700)));
  const minLabelW = chipText ? Math.ceil(chipText) + 36 : 0;
  // labelW 'fit' (the default on a canvas, whose text is scaled up): the longest lane name on one line (+ the column's 24px padding), 128..30% of the width
  const fitLabel = band.labelW === 'fit' || (band.labelW === undefined && d.canvas !== undefined);
  // the canvas default gives way to the columns: never so wide that a column falls under the comfortable width (an author's 'fit' is taken as written)
  const roomForLabel = band.labelW === undefined ? cw - 2 * 14 - (band.cols - 1) * (band.colGap ?? 28) - band.cols * SWIMLANE_COMFY_COL : Infinity;
  const fitW = fitLabel ? Math.min(Math.ceil(Math.max(0, ...band.lanes.map(l => textWidth(widthOf, l.label, roles.title, 700)))) + 24, Math.floor(cw * 0.3), roomForLabel) : 0;
  let labelW = typeof band.labelW === 'number' ? band.labelW : Math.max(128, minLabelW, fitW), colGap = band.colGap ?? 28, padX2 = 14; // no labelW given: wide enough for the longest line name
  const padY = 14;
  const colWAt = (): number => (cw - labelW - 2 * padX2 - (band.cols - 1) * colGap) / band.cols;
  if (band.fit === 'shrink' && colWAt() < SWIMLANE_COMFY_COL) { // free room for the columns: lane labels and gaps give way first, a step at a time
    const steps: [number, number, number][] = [[104, 20, 12], [88, 12, 8]];
    for (const [lw, cg, px] of steps) {
      labelW = Math.min(labelW, Math.max(lw, minLabelW)); colGap = Math.min(colGap, cg); padX2 = Math.min(padX2, px);
      if (colWAt() >= SWIMLANE_COMFY_COL) break;
    }
  }
  if (minLabelW > labelW) throw new Error(`swimlane(): boundaries: the longest line name is ${Math.ceil(chipText)}px wide and needs a label column of ${minLabelW}px, but labelW is ${labelW}px — shorten the name or widen labelW`);
  const bodyX = padX + labelW;
  const colW = colWAt();
  if (colW < 60) throw new Error(`swimlane(): ${band.cols} columns leave only ${Math.round(colW)}px each — widen the diagram, ${minLabelW && labelW <= minLabelW ? `shorten the line names (they need a ${minLabelW}px label column)` : 'shrink labelW'}, or use fewer columns`);
  const top0 = ctx.y, startY = snapGrid(top0); // on the grid; the cursor moves on from where it was (no drift)
  const wrapLines = (text: string, size: number, weight: number, maxW: number) => wrapAtoms(splitAtoms(text), {maxWidth: Math.max(20, maxW), atomWidth: (a: string) => widthOf(a, size, weight, 'sans'), mode: ctx.wrap});
  // column-group headers across the top
  let phaseH = 0;
  const phases = (band.phases ?? []).map((ph): LaidOutPhase => {
    const x = bodyX + padX2 + (ph.from - 1) * (colW + colGap) - colGap / 2;
    const w = (ph.to - ph.from + 1) * (colW + colGap);
    const lines = wrapLines(ph.label, roles.note, 700, w - 16);
    phaseH = Math.max(phaseH, lines.length * roles.note * LINE_HEIGHT_EM + 16);
    return {x, w, lines};
  });
  // steps first at y=0 (heights depend on wrapping), then lanes get the tallest step
  const stepsPlaced = band.steps.map(st => {
    const x = bodyX + padX2 + (st.col - 1) * (colW + colGap);
    const w = st.span * colW + (st.span - 1) * colGap;
    const step = ctx.placeBoxLike({...st, padX: st.padX ?? 12, padY: st.padY ?? 10}, x, 0, w, true, scopeOf(band));
    const stepScope = scopeOf(band);
    setScope(step, stepScope); // a step's id is bare in its output; the scope says what it is called in the figure
    return step;
  });
  const laneIndex = new Map(band.lanes.map((l, i) => [l.id, i]));
  const rowGap = 12;
  let y = startY + phaseH;
  const lanes = band.lanes.map((lane, i): LaidOutLane => {
    const labelLines = wrapLines(lane.label, roles.title, 700, labelW - 24);
    const labelH = labelLines.length * roles.title * LINE_HEIGHT_EM;
    const mine = stepsPlaced.filter(s => laneIndex.get(s.lane) === i);
    const maxStep = Math.max(0, ...mine.map(s => s.h));
    const rows = 1 + Math.max(0, ...mine.map(s => s.row ?? 0));
    const blockH = rows * maxStep + (rows - 1) * rowGap;
    // a named boundary below this lane puts a chip across the lane border: the centred lane label leaves room for half of it
    const chipHalf = boundaryChipH(roles.note) / 2 + 2, nChip = (band.boundaries ?? []).filter(b => b.label && (b.after === lane.id || band.lanes[i - 1]?.id === b.after)).length;
    const h = Math.max(blockH, labelH + (nChip ? 2 * chipHalf : 0)) + 2 * padY;
    const out = {y, h, labelLines, labelTop: y + (h - labelH) / 2, tone: lane.tone, maxStep, blockTop: y + (h - blockH) / 2};
    y += h;
    return out;
  });
  const boundaries = (band.boundaries ?? []).map(b => {
    const at = must(laneIndex.get(b.after)), next = must(lanes[at + 1]);
    return {y: next.y, ...(b.label ? {label: b.label} : {})};
  });
  const frame: LaidOutSwimlane = {type: 'swimlane', x: padX, y: startY, w: cw, h: y - startY, labelW, bodyX, phaseH, phases, lanes, ...(boundaries.length ? {boundaries} : {}), ...(band.fit === 'shrink' ? narrowField(stepsPlaced.flatMap(s => s.wrappedRuns.map(r => r.lines))) : {}), id: band.id, reveal: band.reveal, ...(band.until === undefined ? {} : {until: band.until})};
  const frameScope = scopeOf(band);
  setScope(frame, frameScope);
  ctx.laidOut.push(frame); // before its steps so the lanes draw underneath
  if (band.id) {
    if (ctx.anchors.has(band.id)) ctx.claimed(band.id, 'a swimlane takes an id that another anchor already has');
    ctx.anchors.set(band.id, {x: frame.x, y: frame.y, w: frame.w, h: frame.h});
  }
  for (const st of stepsPlaced) {
    const ln = must(lanes[laneIndex.get(st.lane) ?? -1], `a lane "${st.lane}" in the swimlane (a step's lane is not one of the lanes)`); // an unknown lane id throws here, as before
    st.y = snapGrid(ln.blockTop + (st.row ?? 0) * (ln.maxStep + rowGap) + (ln.maxStep - st.h) / 2);
    if (st.id) ctx.anchors.set(qualify(scopeOf(band), st.id), {x: st.x, y: st.y, w: st.w, h: st.h}); // placeBoxLike already claimed (and checked) the id; this moves it to the lane row
    if (st.tagBox) st.tagBox.y = st.y - st.tagBox.h / 2;
    ctx.laidOut.push(st);
  }
  frame.span = stepsPlaced.length;
  ctx.y = top0 + (y - startY) + d.gap;
}

function layoutLegend(band: LegendBand, ctx: LayoutCtx, padX: number, cw: number): void {
  const {d, roles, widthOf} = ctx;
  const items = band.items.map(item => {
    const tw = textWidth(widthOf, item.label, roles.note, 400);
    const swatch = item.role ? {tone: CAUSE_ROLES[item.role].tone, ...(CAUSE_ROLES[item.role].double ? {double: true} : {}), ...(CAUSE_ROLES[item.role].dashed ? {dashed: true} : {}), ...(item.role === 'obstacle' || item.role === 'risk' ? {hex: true} : {})} : undefined;
    return {...item, ...(swatch ? {swatch} : {}), textW: tw, w: LEGEND_SWATCH_W + 8 + tw};
  });
  const rows: (typeof items)[] = [[]];
  let rowW = 0;
  for (const it of items) {
    const add = (must(rows.at(-1)).length ? LEGEND_ITEM_GAP : 0) + it.w;
    if (must(rows.at(-1)).length && rowW + add > cw) { rows.push([]); rowW = 0; }
    rowW += (must(rows.at(-1)).length ? LEGEND_ITEM_GAP : 0) + it.w;
    must(rows.at(-1)).push(it);
  }
  const placedItems: LaidOutLegendItem[] = [];
  rows.forEach((r, ri) => {
    const total = r.reduce((a, it) => a + it.w, 0) + (r.length - 1) * LEGEND_ITEM_GAP;
    let x = band.align === 'left' ? padX : padX + (cw - total) / 2;
    for (const it of r) { placedItems.push({...it, x, y: snapGrid(ctx.y) + ri * (LEGEND_ROW_H + 8)}); x += it.w + LEGEND_ITEM_GAP; }
  });
  const h = rows.length * LEGEND_ROW_H + (rows.length - 1) * 8;
  ctx.laidOut.push({type: 'legend', x: padX, y: snapGrid(ctx.y), w: cw, h, items: placedItems});
  ctx.y += h + d.gap;
}

function layoutPyramid(band: PyramidBand, ctx: LayoutCtx, padX: number, cw: number): void {
  const {d, roles, widthOf} = ctx;
  const paint = paintOf(ctx.tones, d.appearance);
  const n = band.layers.length;
  const baseWidth = band.width ?? Math.min(cw, 520);
  const apexWidth = baseWidth * band.apexRatio;
  const layerH = band.layerHeight;
  const totalH = n * layerH;
  const cx = padX + cw / 2;
  const layersOut: LaidOutPyramidLayer[] = [];
  for (let i = 0; i < n; i++) { // i=0 is the bottom (widest) layer
    const bottomY = snapGrid(ctx.y) + totalH - i * layerH;
    const topY = bottomY - layerH;
    const bottomW = baseWidth - (baseWidth - apexWidth) * (i / n);
    const topW = baseWidth - (baseWidth - apexWidth) * ((i + 1) / n);
    // Opacity climbs bottom->top using SHADES (see tokens.ts) — the
    // apex (i = n-1) always gets SHADES[0] = fully opaque, matching
    // every hand-authored pyramid/funnel in this deck.
    const opacity = must(SHADES[Math.min(SHADES.length - 1, n - 1 - i)]);
    // bg luminance is a real alpha-blend against white, so the text
    // color choice is provably safe (see tokens.ts's bestTextColor
    // doc comment) without needing a Playwright-rendered check.
    const bgLum = blendLuminance(paint(PALETTE.bg), paint(PALETTE[d.day].accent), opacity);
    const textColor = bestTextColor(bgLum, paint);
    // Wrapped at the narrower (top) edge of this layer, minus padding —
    // conservative since the layer is only wider than that going down,
    // so the label can never spill past the trapezoid's slanted sides.
    const wrapWidth = Math.max(40, topW - 24);
    const atomW = (atom: string) => widthOf(atom, roles.title, 700, 'sans');
    const lines = wrapAtoms(splitAtoms(must(band.layers[i]).text), {maxWidth: wrapWidth, atomWidth: atomW, mode: ctx.wrap});
    const midY = (topY + bottomY) / 2;
    const lineGap = roles.title * LINE_HEIGHT_EM;
    const textYs = lines.map((_, li) => Math.round(midY + (li - (lines.length - 1) / 2) * lineGap + roles.title * 0.35));
    layersOut.push({
      points: [[cx - bottomW / 2, bottomY], [cx + bottomW / 2, bottomY], [cx + topW / 2, topY], [cx - topW / 2, topY]],
      opacity, textColor, lines, textYs, cx,
    });
  }
  ctx.laidOut.push({type: 'pyramid', x: cx - baseWidth / 2, y: snapGrid(ctx.y), w: baseWidth, h: totalH, day: d.day, layers: layersOut});
  ctx.y += totalH + d.gap;
}

function layoutCurve(band: CurveBand, ctx: LayoutCtx, padX: number, cw: number): void {
  const {d} = ctx;
  const w = band.width ?? cw;
  const h = band.height;
  const x = padX + (cw - w) / 2;
  const y = snapGrid(ctx.y);
  const AXIS_LABEL_W = 44, AXIS_BOTTOM_GAP = 28, TOP_PAD = 14, RIGHT_PAD = 8;
  const axisX = x + AXIS_LABEL_W;
  const axisRight = x + w - RIGHT_PAD;
  const axisTop = y + TOP_PAD;
  const axisBottom = y + h - AXIS_BOTTOM_GAP;
  const n = band.points.length;
  const points = band.points.map((p, i) => ({
    x: n === 1 ? axisX : axisX + i * (axisRight - axisX) / (n - 1),
    y: axisBottom - Math.max(0, Math.min(1, p.y)) * (axisBottom - axisTop),
    emphasis: p.emphasis,
    dropLine: !!p.dropLine,
  }));
  ctx.laidOut.push({
    type: 'curve', x, y, w, h, axisX, axisRight, axisTop, axisBottom, points,
    yTopLabel: band.yTopLabel, yBottomLabel: band.yBottomLabel, xLabel: band.xLabel,
  });
  ctx.y += h + d.gap;
}

const layoutTimelineBand = placedBand((band: BandOf<'timeline'>, x, y, w, ctx) => layoutTimeline(band, x, y, w, ctx.widthOf, ctx.roles), 'a timeline takes an id that another anchor already has');
const layoutBpmnBand = placedBand((band: BandOf<'bpmn'>, x, y, w, ctx) => (band.dir === 'v' ? layoutBpmnVertical : layoutBpmn)(band, x, y, w, ctx.widthOf, ctx.roles, ctx), 'a bpmn diagram takes an id that another anchor already has', 'a bpmn node takes an id that another anchor already has');
const layoutBowtieBand = placedBand((band: BandOf<'bowtie'>, x, y, w, ctx) => layoutBowtie(band, x, y, w, ctx.widthOf, ctx.roles, ctx), 'a bow-tie takes an id that another anchor already has');
const layoutComicBand = placedBand((band: BandOf<'comic'>, x, y, w, ctx) => layoutComic(band, x, y, w, ctx.widthOf), 'a comic takes an id that another anchor already has', 'a comic panel or bubble takes an id that another anchor already has');
const layoutFtaBand = placedBand((band: BandOf<'fta'>, x, y, w, ctx) => layoutFta(band, x, y, w, ctx.widthOf, ctx.roles, ctx), 'a fault tree takes an id that another anchor already has', 'a fault-tree event takes an id that another anchor already has');
const layoutClasses = placedBand((band: BandOf<'classes'>, x, y, w, ctx) => layoutClassesBand(band, x, y, w, ctx.widthOf, ctx.roles, ctx, ctx.d.canvas?.height ?? ctx.d.maxDisplayHeight), 'a class diagram takes an id that another anchor already has', 'a class takes an id that another anchor already has');
/**
 * On a canvas every text is scaled to minText (lib/dsl/render.ts), but the fixed pixel sizes of a band (a gantt's rows, a PERT box, a
 * plane's tick-label offsets) were drawn for 14px text, so the scaled labels ran into the ticks and into each other. These two scale
 * them with the text on a canvas only: off a canvas (a document figure, fill mode) every band is laid out exactly as before.
 * canvasGeom: the factor (the canvas's font scale, 1 off a canvas). scaledGeometry: a bars / plane band without a labelRole keeps its
 * offsets at 14px (only an explicit labelRole scales them), so on a canvas it is laid out as with labelRole 'note' (the same text size).
 */
const canvasGeom = (ctx: LayoutCtx): number => ctx.d.canvas ? canvasFontScale(ctx.d.canvas.minText) : 1;
const scaledGeometry = <B extends {labelRole?: LabelRole}>(band: B, ctx: LayoutCtx): B => ctx.d.canvas && band.labelRole === undefined ? {...band, labelRole: 'note'} : band;
const layoutGanttBand = placedBand((band: BandOf<'gantt'>, x, y, w, ctx) => layoutGantt(band, x, y, w, ctx.widthOf, ctx.roles, canvasGeom(ctx)), 'a gantt takes an id that another anchor already has', 'a gantt task takes an id that another anchor already has');
/** ADR 0070 D7: a cause tree's own band (not pdpc / relationDiagram / whyWhyTree) has its lines scale with the canvas's text (never below 1: a canvas with small text keeps today's spacing); `WrapEnv.lineScale`. */
const scaledLines = (ctx: LayoutCtx, band: {base?: unknown; layerFrom?: unknown}): number | undefined => { const s = Math.max(1, canvasGeom(ctx)); return s > 1 && band.base === undefined && band.layerFrom === undefined ? s : undefined; };
/** The band's lines: the canvas's scale, or none for a band that `fitLineScale` (the whole-figure retry) drops it from. `retried`: it was dropped by the retry (told like the band's own fallback does). */
const lineEnv = (ctx: LayoutCtx, band: {base?: unknown; layerFrom?: unknown}): {env: LayoutCtx; retried: boolean} => {
  const s = scaledLines(ctx, band);
  if (s === undefined) return {env: ctx, retried: false};
  return ctx.lines.seen++ < ctx.lines.drop ? {env: ctx, retried: true} : {env: {...ctx, lineScale: s}, retried: false};
};
const layoutCauseBandHere = (band: Band & {type: 'cause'}, x: number, y: number, w: number, ctx: LayoutCtx) => {
  const {env, retried} = lineEnv(ctx, band);
  const laid = layoutCauseBand(band, x, y, w, ctx.widthOf, ctx.roles, ctx.lines.exchange ? {...env, tallerSeen: () => { ctx.lines.taller = true; }} : {...env, exchange: false}, ctx.d.canvas?.height ?? ctx.d.maxDisplayHeight, ctx.d.canvas?.height !== undefined);
  if (retried) laid.lineScaleDropped = true;
  return laid;
};
const layoutCauseOrCloud = placedBand((band: Band & {type: 'cause' | 'cloud'}, x, y, w, ctx) => band.type === 'cause' ? layoutCauseBandHere(band, x, y, w, ctx) : layoutCloudBand(band, x, y, w, ctx.widthOf, ctx.roles, ctx),
  band => `${band.type === 'cause' ? 'a cause tree' : 'a cloud'} takes an id that another anchor already has`,
  band => `${band.type === 'cause' ? 'a cause tree node' : 'a cloud box'} takes an id that another anchor already has`);
const layoutStates = placedBand((band: BandOf<'states'>, x, y, w, ctx) => layoutStatesBand(band, x, y, w, ctx.widthOf, ctx.roles, ctx, ctx.d.canvas?.height ?? ctx.d.maxDisplayHeight), band => `${statesWords(band.flavor).diagram} takes an id that another anchor already has`, band => `a ${statesWords(band.flavor).node} takes an id that another anchor already has`);
// A tree whose nodes are bands (ADR 0049): each band is measured once per width (laid out, then taken back), the tree is placed from those sizes, and
// every band is laid out for real inside its node's rectangle.
function measureBandHeight(ctx: LayoutCtx, band: Band, w: number): number {
  const before = snapshotCtx(ctx);
  try {
    ctx.y = 0;
    ctx.stack([band], 0, w);
    return Math.max(0, ctx.y - ctx.d.gap); // every handler leaves the cursor one gap below what it placed (a raw() of height 0 leaves none: clamped)
  } finally { restoreCtx(ctx, before); }
}
/** A band node is laid out on the grid like any band: its rectangle (and the ends of the lines that reach it) move to where the band will really sit. */
function snapBandNodes(placed: LaidOutTree, band: BandOf<'tree'>): void {
  treeItems(band.root).forEach((n, i) => {
    const node = placed.nodes[i];
    if (!n.band || !node) return;
    const dy = originOf(n.band.type, node.y) - node.y;
    if (dy === 0) return;
    const touches = (p: {x: number; y: number}, o: {x: number; y: number; w: number; h: number}): boolean => p.y >= o.y - 0.5 && p.y <= o.y + o.h + 0.5 && p.x >= o.x - 0.5 && p.x <= o.x + o.w + 0.5;
    const on = (p: {x: number; y: number}): boolean => p.y >= node.y - 0.5 && p.y <= node.y + node.h + 0.5 && (Math.abs(p.x - node.x) < 0.5 || Math.abs(p.x - node.x - node.w) < 0.5 || (p.x >= node.x - 0.5 && p.x <= node.x + node.w + 0.5 && (Math.abs(p.y - node.y) < 0.5 || Math.abs(p.y - node.y - node.h) < 0.5)));
    const mid = node.y + node.h / 2;
    for (const e of placed.edges) {
      const pts = e.points, last = pts.length - 1;
      for (const [k, next] of [[0, 1], [last, last - 1]] as const) {
        const p = must(pts[k]), q = pts[next];
        if (!on(p)) continue;
        // a horizontal leg stays horizontal; a line of two points keeps the end that sits on another node, but moves one that ends on a `{` or a spine
        if (q && q.y === p.y && (pts.length > 2 || !placed.nodes.some(o => o !== node && touches(q, o)))) q.y += dy;
        p.y += dy;
      }
    }
    for (const br of placed.braces ?? []) { // a `{` reaches the middle of its children's sides: its end moves with the child
      if (Math.abs(br.y1 - mid) <= 3) br.y1 += dy;
      if (Math.abs(br.y2 - mid) <= 3) br.y2 += dy;
    }
    node.y += dy;
    const anchor = placed.anchors.find((a: {id: string}) => a.id === n.id);
    if (anchor && n.id) anchor.y += dy;
  });
}
const treePlaced = placedBand((band: BandOf<'tree'>, x, y, w, ctx) => {
  const placed = layoutTreeBand(band, x, y, w, ctx.widthOf, ctx.roles, ctx, ctx.d.canvas?.height ?? ctx.d.maxDisplayHeight, (b, bw) => measureBandHeight(ctx, b, bw));
  snapBandNodes(placed, band);
  return placed;
}, 'a tree takes an id that another anchor already has', 'a tree node takes an id that another anchor already has');
const layoutTree: BandLayoutHandler<BandOf<'tree'>> = (band, ctx, padX, cw) => {
  treePlaced(band, ctx, padX, cw);
  const items = treeItems(band.root);
  if (!items.some(n => n.band)) return;
  const placed = ctx.laidOut[ctx.laidOut.length - 1] as LaidOutTree, after = ctx.y;
  const first = new Map<TreeItem, LaidOutBand | undefined>(); // what each band node put down first: its own figure (a group's frame comes before what is inside it)
  items.forEach((n, i) => {
    const node = placed.nodes[i];
    if (!n.band || !node) return;
    ctx.y = node.y;
    const n0 = ctx.laidOut.length;
    ctx.stack([n.band], node.x, node.w);
    first.set(n, ctx.laidOut[n0]);
  });
  ctx.y = after;
  funnelEdges(band, placed, items, first, ctx);
};
/** The two end points of the side of a shape that faces `dir` ('bottom' / 'top'): the corners of the drawn polygons when the shape is a flow shape (a chevron's side stops short of its point), else the rectangle's. */
function facingEnds(rect: Rect, polygons: [number, number][][], dir: 'bottom' | 'top'): [{x: number; y: number}, {x: number; y: number}] {
  const pts = polygons.flat();
  if (!pts.length) { const y = dir === 'bottom' ? rect.y + rect.h : rect.y; return [{x: rect.x, y}, {x: rect.x + rect.w, y}]; }
  const edge = dir === 'bottom' ? Math.max(...pts.map(p => p[1])) : Math.min(...pts.map(p => p[1])), onEdge = pts.filter(p => Math.abs(p[1] - edge) < 0.5);
  return [{x: Math.min(...onEdge.map(p => p[0])), y: edge}, {x: Math.max(...onEdge.map(p => p[0])), y: edge}];
}
const polygonsOf = (b: LaidOutBand | undefined): [number, number][][] => ((b as {primitives?: {k: string; points?: [number, number][]}[]} | undefined)?.primitives ?? []).flatMap(pr => pr.k === 'polygon' && pr.points ? [pr.points] : []);
const polygonsIn = (ctx: LayoutCtx, within: (pts: [number, number][]) => boolean, node?: (id: string | undefined) => boolean): [number, number][][] =>
  ctx.laidOut.flatMap(b => ((b as {primitives?: {k: string; points?: [number, number][]; node?: string}[]}).primitives ?? []).flatMap(pr => pr.k === 'polygon' && pr.points && within(pr.points) && (!node || node(pr.node)) ? [pr.points] : []));
/** A child with `from` is joined from a part inside its parent's band (known only now that the bands are placed): from the near side of that part (starting at the edge of the parent's band) to the near side of the child, as two lines (a funnel). */
function funnelEdges(tree: BandOf<'tree'>, placed: LaidOutTree, items: TreeItem[], first: Map<TreeItem, LaidOutBand | undefined>, ctx: LayoutCtx): void {
  if (!items.some(n => n.from !== undefined)) return;
  const kind = tree.balanced ? tree.layout ?? 'radial' : tree.dir === 'right' ? 'right' : 'down'; // (a tree whose direction was left to the layout is judged by where the child landed)
  if (!['down', 'up', 'org'].includes(kind)) throw new Error(`tree(): from draws a funnel to a child under (or over) its parent's band; ${tree.balanced ? `this mindmap's layout is '${kind}'` : "this tree grows to the right"} (use dir: 'down'; a mindmap: layout 'down', 'up' or 'org')`);
  const parentOf = new Map<TreeItem, TreeItem>();
  for (const n of items) for (const c of n.children ?? []) parentOf.set(c, n);
  const rectOf = (n: TreeItem): Rect => must(placed.nodes[items.indexOf(n)]);
  const inside = (r: Rect, o: Rect): boolean => r.x >= o.x - 0.5 && r.y >= o.y - 0.5 && r.x + r.w <= o.x + o.w + 0.5 && r.y + r.h <= o.y + o.h + 0.5;
  const treeIds = new Set(placed.anchors.map(a => a.id));
  items.forEach((child, i) => {
    if (child.from === undefined) return;
    const parent = must(parentOf.get(child)), pr = rectOf(parent), cr = rectOf(child);
    const below = cr.y >= pr.y + pr.h - 0.5, above = cr.y + cr.h <= pr.y + 0.5;
    if (!below && !above) throw new Error(`tree(): "${child.label}": from joins a child that lies below or above its parent's band, but this one is beside it (dir: 'right', a mindmap's radial / right / left / brace ...); use dir: 'down' (a mindmap: layout 'down', 'up' or 'org')`);
    const name = resolveAnchor(ctx.scopes, child.from, n => ctx.anchors.has(n)), part = name === undefined ? undefined : ctx.anchors.get(name);
    const bandId = (must(parent.band) as {id?: string}).id; // a name of the whole band (or of the tree node) is not a part of it
    if (!name || !part || !inside(part, pr) || treeIds.has(name) || name === bandId) {
      const ids = [...ctx.anchors].filter(([k, r]) => !treeIds.has(k) && k !== bandId && inside(r, pr)).map(([k]) => k);
      throw new Error(`tree(): "${child.label}": from "${child.from}" is not an id inside the band of "${parent.label}"${ids.length ? ` (ids there: ${ids.join(', ')})` : ' (that band declares no ids)'}`);
    }
    placed.edges = placed.edges.filter(e => e.child !== i);
    const partPolys = polygonsIn(ctx, pts => pts.every(p => p[0] >= part.x - 0.5 && p[0] <= part.x + part.w + 0.5 && p[1] >= part.y - 0.5 && p[1] <= part.y + part.h + 0.5), id => id !== undefined && (name === id || name.endsWith(`.${id}`)));
    const childPolys = polygonsOf(first.get(child)); // the child's own figure only: a chevron inside a group is not the group's edge
    const [pl, pRight] = facingEnds(part, partPolys, below ? 'bottom' : 'top'), [cl, cRight] = facingEnds(cr, childPolys, below ? 'top' : 'bottom');
    const y0 = below ? pr.y + pr.h : pr.y; // from the edge of the parent's band: a part inside it (a swimlane's step) does not draw a line across the parts below it
    const stage = Math.max((child.band as {reveal?: number}).reveal ?? 0, (must(parent.band) as {reveal?: number}).reveal ?? 0), untils = [(child.band as {until?: number}).until, (must(parent.band) as {until?: number}).until].filter((u): u is number => u !== undefined), until = untils.length ? Math.min(...untils) : undefined; // gone with the earlier of the two
    const own = {child: i, ...(stage > (placed.reveal ?? 0) ? {reveal: stage} : {}), ...(until === undefined ? {} : {until})};
    placed.edges.push({points: [{x: pl.x, y: y0}, cl], ...own}, {points: [{x: pRight.x, y: y0}, cRight], ...own});
  });
}
const layoutBarsBand = placedBand((band: BandOf<'bars'>, x, y, w, ctx) => layoutBars(scaledGeometry(band, ctx), x, y, w, ctx.widthOf, ctx.roles, canvasGeom(ctx)), 'a bars band takes an id that another anchor already has', 'a bar takes an id that another anchor already has');
const layoutChartBand = placedBand((band: BandOf<'chart'>, x, y, w, ctx) => layoutChart(band, x, y, w, ctx.widthOf, ctx.roles, ctx.wrap, canvasGeom(ctx)), 'a chart takes an id that another anchor already has', 'a chart element takes an id that another anchor already has');
const layoutPeopleOrDots = placedBand((band: Band & {type: 'people' | 'dots'}, x, y, w, ctx) => band.type === 'people' ? layoutPeople(band, x, y, w, ctx.widthOf, ctx.d.day, ctx.roles) : layoutDots(band, x, y, w, ctx.widthOf, ctx.d.day, ctx.roles),
  band => `a ${band.type} band takes an id that another anchor already has`);
const layoutMathBand = placedBand((band: BandOf<'math'>, x, y, w, ctx) => layoutMath(band, x, y, w, ctx.roles[band.role], ctx.d.day, ctx.tones), 'a math band takes an id that another anchor already has');
const layoutPlaneBand = placedBand((band: BandOf<'plane'>, x, y, w, ctx) => layoutPlane(scaledGeometry(band, ctx), x, y, w, ctx.widthOf, ctx.roles, canvasGeom(ctx)), 'a plane takes an id that another anchor already has');
const layoutQuadrantBand = placedBand((band: BandOf<'quadrant'>, x, y, w, ctx) => layoutQuadrant(band, x, y, w, ctx.widthOf, ctx.roles, ctx.wrap), 'a quadrant takes an id that another anchor already has', 'a quadrant item takes an id that another anchor already has');

/**
 * The handler of every band type. Typed per key, so each handler is checked against its own band type; the `satisfies` below
 * and UnhandledBandTypes make a band type without one a compile error.
 */
export const LAYOUT_HANDLERS = {
  spacer: layoutSpacer,
  status: layoutStatusBand,
  group: layoutGroup,
  sequence: layoutSeqTable,
  table: layoutSeqTable,
  image: layoutImageBand,
  timeline: layoutTimelineBand,
  bpmn: layoutBpmnBand,
  fta: layoutFtaBand,
  bowtie: layoutBowtieBand,
  comic: layoutComicBand,
  classes: layoutClasses,
  gantt: layoutGanttBand,
  cause: layoutCauseOrCloud,
  cloud: layoutCauseOrCloud,
  states: layoutStates,
  tree: layoutTree,
  bars: layoutBarsBand,
  chart: layoutChartBand,
  people: layoutPeopleOrDots,
  dots: layoutPeopleOrDots,
  math: layoutMathBand,
  wireframe: layoutWireframeBand,
  screens: layoutWireframeBand,
  swimlane: layoutSwimlane,
  legend: layoutLegend,
  connect: layoutConnect,
  raw: layoutRaw,
  grouprow: layoutGroupRow,
  row: layoutRow,
  grid: layoutGridBand,
  areas: layoutAreas,
  pyramid: layoutPyramid,
  plane: layoutPlaneBand,
  quadrant: layoutQuadrantBand,
  chevron: layoutFlowShapeBand,
  wordart: layoutWordArtBand,
  funnel: layoutFlowShapeBand,
  cycle: layoutFlowShapeBand,
  venn: layoutFlowShapeBand,
  concentric: layoutFlowShapeBand,
  emblem: layoutFlowShapeBand,
  valueChain: layoutFlowShapeBand,
  curve: layoutCurve,
  caption: layoutBoxLikeBand,
  box: layoutBoxLikeBand,
  banner: layoutBoxLikeBand,
} satisfies BandLayoutHandlers;

/** Band types with no handler in LAYOUT_HANDLERS: must be `never`, so adding a band type without one fails to compile. */
export type UnhandledBandTypes = Exclude<Band['type'], keyof typeof LAYOUT_HANDLERS>;
export const ALL_BANDS_HANDLED: UnhandledBandTypes extends never ? true : never = true;

const layoutDispatch = withLegacyTables(coreDispatch, {layout: LAYOUT_HANDLERS});

/** The layout hook stack() runs for the band. */
export function layoutHandlerFor(band: {type: string}): BandLayoutHandler<never> {
  return layoutDispatch.hook(band, 'layout') as BandLayoutHandler<never>;
}
