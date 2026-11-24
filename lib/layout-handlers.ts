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
import {layoutCurve} from './layout-curve.ts';
import {layoutPyramid} from './layout-pyramid.ts';
import {layoutLegend} from './layout-legend.ts';
import {layoutRaw} from './layout-raw.ts';
import {narrowField} from './tree.ts';
import {originOf, placedBand, rectOf, setScope} from './layout-placed.ts';
import {layoutTree} from './layout-tree.ts';
import {layoutStatesBand} from './states.ts';
import {statesWords} from './states-words.ts';
import {layoutCauseBand, layoutCloudBand} from './toc.ts';
import {layoutGantt} from './gantt.ts';
import {layoutStatus} from './status.ts';
import {layoutClassesBand} from './classes.ts';
import {layoutBpmn} from './bpmn.ts';
import {layoutBpmnVertical} from './bpmn-vertical.ts';
import {layoutFta} from './fta.ts';
import {layoutBowtie} from './bowtie.ts';
import {layoutComic} from './comic/layout.ts';
import {layoutChart} from './charts.ts';
import {placeScreens, placeWireframe} from './layout-wireframes.ts';
import type {LegendBand, SpacerBand, StatusBand} from './types/containers.ts';
import type {LabelRole} from './types/core.ts';
import type {ImageBand} from './types/image.ts';
import type {Band} from './types/index.ts';
import type {SwimlaneBand, LaidOutLane, LaidOutPhase, LaidOutSwimlane} from './types/sequence-table-swimlane.ts';
import type {BandLayoutHandler, BandLayoutHandlers, LayoutCtx} from './layout-ctx.ts';
import {canvasFontScale} from './tokens.ts';
import {
  LINE_HEIGHT_EM, boundaryChipH, SWIMLANE_COMFY_COL,
  snapGrid,
} from './layout-util.ts';
import {layoutConnect} from './layout-connect.ts';
import {layoutBoxLikeBand} from './layout-box-like.ts';
import {layoutGroup} from './layout-group.ts';
export {GROUP_FILL_MIN, groupFillPlan} from './layout-group.ts';
import {layoutGroupRow} from './layout-group-row.ts';
import {layoutGridBand} from './layout-grid.ts';
import {layoutRow} from './layout-row.ts';
import {addScoped, qualify, scopeOf} from './anchor-scope.ts';

import {must} from './must.ts';
type BandOf<T extends Band['type']> = Extract<Band, {type: T}>;
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
  wireframe: placeWireframe,
  screens: placeScreens,
  swimlane: layoutSwimlane,
  legend: (band: LegendBand, ctx, x, w) => {
    const laid = layoutLegend(band, x, ctx.y, w, ctx.widthOf, ctx.roles);
    ctx.laidOut.push(laid);
    ctx.y += laid.h + ctx.d.gap;
  },
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
