import {PALETTE} from './tokens.ts';
import type {Theme, Roles} from './types/core.ts';
import type {LaidOutBand} from './types/index.ts';
import type {LaidOutOf, LaidOutType} from './band-table.ts';
import {renderChart} from './charts-emit.ts';
import {emojiSpan} from './emit-common.ts';
import {renderWordArt} from './emit-wordart.ts';
import {renderMath} from './emit-figures.ts';
import {renderCaption, renderBox, renderGroup, renderLegend, renderBanner, renderRow, renderGrid, renderPyramid, renderPeople, renderDots, renderCurve, renderRaw, renderSwimlane} from './emit-boxes.ts';
import {renderPlane, renderBars, renderImage, renderQuadrant, renderFlowShape, renderTimeline, renderTree, renderStates, renderCause, renderCloud, renderGantt, renderClasses, renderBpmn} from './emit-figures.ts';
import {renderSequence, renderTable, renderPrims} from './emit-tables.ts';

// Per-band-type SVG emitters. `selfDimming`: the band draws its own spotlight dim state instead of having it painted over its svg.
export interface EmitHandler<B> {
  render(band: B, day: Theme, roles: Roles, stage: number | undefined, dimFill: boolean): string;
  selfDimming?: true;
}

/** One emitter per band type, each checked against its own band type; a band type without one fails to compile. */
export const EMIT_HANDLERS = {
  caption: {render: (b, day) => renderCaption(b, day), selfDimming: true},
  box: {render: (b, day, roles) => renderBox(b, day, roles), selfDimming: true},
  banner: {render: (b, day, roles) => renderBanner(b, day, roles), selfDimming: true},
  group: {render: (b, day, roles) => renderGroup(b, day, roles), selfDimming: true},
  legend: {render: (b, day, roles) => renderLegend(b, day, roles)},
  swimlane: {render: (b, day, roles) => renderSwimlane(b, day, roles)},
  wireframe: {render: (b, day) => renderPrims(b, day)},
  screens: {render: (b, day) => renderPrims(b, day)},
  sequence: {render: (b, day, roles) => renderSequence(b, day, roles)},
  table: {render: (b, day, roles) => renderTable(b, day, roles)},
  row: {render: (b, day, roles, stage) => renderRow(b, day, roles, stage), selfDimming: true},
  grid: {render: (b, day, roles, stage) => renderGrid(b, day, roles, stage), selfDimming: true},
  raw: {render: (b, day) => renderRaw(b, day)},
  pyramid: {render: (b, _day, roles) => renderPyramid(b, roles)},
  curve: {render: (b, day) => renderCurve(b, day)},
  plane: {render: (b, day, _roles, stage) => renderPlane(b, day, stage)},
  quadrant: {render: (b, day) => renderQuadrant(b, day), selfDimming: true},
  wordart: {render: (b, day) => renderWordArt(b, day, !!b.dim), selfDimming: true},
  chevron: {render: (b, day) => renderFlowShape(b, day)},
  funnel: {render: (b, day) => renderFlowShape(b, day)},
  cycle: {render: (b, day) => renderFlowShape(b, day)},
  venn: {render: (b, day) => renderFlowShape(b, day)},
  concentric: {render: (b, day) => renderFlowShape(b, day)},
  bars: {render: (b, day, _roles, stage, dimFill) => renderBars(b, day, stage, dimFill), selfDimming: true},
  chart: {render: (b, day, _roles, stage, dimFill) => renderChart(b, day, emojiSpan, stage, dimFill), selfDimming: true},
  image: {render: (b, day, _roles, stage) => renderImage(b, day, stage), selfDimming: true},
  people: {render: (b, day) => renderPeople(b, day)},
  dots: {render: (b, day) => renderDots(b, day)},
  math: {render: b => renderMath(b)},
  timeline: {render: (b, day) => renderTimeline(b, day), selfDimming: true},
  tree: {render: (b, day) => renderTree(b, day), selfDimming: true},
  states: {render: (b, day) => renderStates(b, day), selfDimming: true},
  cause: {render: (b, day) => renderCause(b, day), selfDimming: true},
  cloud: {render: (b, day) => renderCloud(b, day), selfDimming: true},
  gantt: {render: (b, day) => renderGantt(b, day), selfDimming: true},
  classes: {render: (b, day) => renderClasses(b, day), selfDimming: true},
  bpmn: {render: (b, day) => renderBpmn(b, day), selfDimming: true},
} satisfies {[T in LaidOutType]: EmitHandler<LaidOutOf<T>>};

/** Band types with no emitter in EMIT_HANDLERS: must be `never`. */
export type UnemittedBandTypes = Exclude<LaidOutType, keyof typeof EMIT_HANDLERS>;
export const ALL_BANDS_EMITTED: UnemittedBandTypes extends never ? true : never = true;

const handlerFor = (type: LaidOutType): EmitHandler<LaidOutBand> => EMIT_HANDLERS[type] as EmitHandler<never> as EmitHandler<LaidOutBand>;

export function renderBandPlain(band: LaidOutBand, day: Theme, roles: Roles, stage?: number, dimFill = false): string {
  return handlerFor(band.type).render(band, day, roles, stage, dimFill);
}

export function renderBand(band: LaidOutBand, day: Theme, roles: Roles, stage?: number, dimFill = false): string {
  const svg = renderBandPlain(band, day, roles, stage, dimFill);
  if (!band.dim || handlerFor(band.type).selfDimming) return svg;
  return svg
    .replace(/marker-(start|end)="url\(#dsl-arrow(-strong)?\)"/g, 'marker-$1="url(#dsl-arrow$2-dim)"')
    .replace(/stroke="#[0-9a-fA-F]{6}"/g, `stroke="${PALETTE.muted}"`)
    .replace(/fill="(#[0-9a-fA-F]{6})"/g, (_all, fill: string) => `fill="${fill === PALETTE.bg ? PALETTE.bg : PALETTE.muted}"`);
}
