// Per-band-type layout handlers for layoutBands() pass 2. Each takes the band, the LayoutCtx (cursor, anchors, laid-out list ...)
// and the x / width it is placed at; the table at the bottom is what stack() dispatches through.

import {coreDispatch, withLegacyTables} from './band-dispatch.ts';
import {layoutSequence, layoutTable} from './seq-table.ts';
import {layoutPlane} from './plane.ts';
import {layoutImageBand} from './layout-image.ts';
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
import {layoutSwimlane} from './layout-swimlane.ts';
import {placedBand, rectOf, setScope} from './layout-placed.ts';
import {layoutTree} from './layout-tree.ts';
import {layoutStatesBand} from './states.ts';
import {statesWords} from './states-words.ts';
import {placeCause} from './layout-cause.ts';
import {layoutCloudBand} from './cloud.ts';
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
import type {Band} from './types/index.ts';
import type {BandLayoutHandler, BandLayoutHandlers, LayoutCtx} from './layout-ctx.ts';
import {canvasFontScale} from './tokens.ts';
import {
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
  const placed = layoutWordArt(band, padX, ctx.originOf(band, ctx.y), cw, ctx.widthOf, ctx.roles, ctx.wrap);
  if (band.id) { if (ctx.anchors.has(band.id)) ctx.claimed(band.id, 'a wordart takes an id that another anchor already has'); ctx.anchors.set(band.id, placed); }
  ctx.laidOut.push(placed); ctx.y += placed.h + ctx.d.gap;
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
const layoutCloud = placedBand((band: BandOf<'cloud'>, x, y, w, ctx) => layoutCloudBand(band, x, y, w, ctx.widthOf, ctx.roles, ctx),
  'a cloud takes an id that another anchor already has', 'a cloud box takes an id that another anchor already has');
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
  cause: placeCause,
  cloud: layoutCloud,
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
