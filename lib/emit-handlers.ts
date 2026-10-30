import {PALETTE} from './tokens.ts';
import type {ToneEnv} from './tokens.ts';
import type {Theme, Roles} from './types/core.ts';
import type {LaidOutBand} from './types/index.ts';
import type {LaidOutOf, LaidOutType} from './band-table.ts';
import {renderChart} from './charts-emit.ts';
import {emojiSpan} from './emit-common.ts';
import {renderWordArt} from './emit-wordart.ts';
import {renderMath} from './emit-figures.ts';
import {renderCaption, renderBox, renderGroup, renderLegend, renderBanner, renderRow, renderGrid, renderPyramid, renderPeople, renderDots, renderCurve, renderRaw, renderStatus, renderSwimlane} from './emit-boxes.ts';
import {renderFta} from './emit-fta.ts';
import {renderBowtie} from './emit-bowtie.ts';
import {renderPlane, renderBars, renderImage, renderQuadrant, renderFlowShape, renderTimeline, renderTree, renderStates, renderCause, renderCloud, renderGantt, renderClasses, renderBpmn} from './emit-figures.ts';
import {renderSequence, renderTable, renderPrims} from './emit-tables.ts';

// Per-band-type SVG emitters. `selfDimming`: the band draws its own spotlight dim state instead of having it painted over its svg.
export interface EmitHandler<B> {
  render(band: B, day: Theme, tones: ToneEnv, roles: Roles, stage: number | undefined, dimFill: boolean): string;
  selfDimming?: true;
}

/** One emitter per band type, each checked against its own band type; a band type without one fails to compile. */
export const EMIT_HANDLERS = {
  caption: {render: (b, day, tones) => renderCaption(b, day, tones), selfDimming: true},
  status: {render: b => renderStatus(b)},
  box: {render: (b, day, tones, roles) => renderBox(b, day, tones, roles), selfDimming: true},
  banner: {render: (b, day, tones, roles) => renderBanner(b, day, tones, roles), selfDimming: true},
  group: {render: (b, day, tones, roles) => renderGroup(b, day, tones, roles), selfDimming: true},
  legend: {render: (b, day, tones, roles) => renderLegend(b, day, tones, roles)},
  swimlane: {render: (b, day, _tones, roles) => renderSwimlane(b, day, roles)},
  wireframe: {render: (b, day) => renderPrims(b, day)},
  screens: {render: (b, day) => renderPrims(b, day)},
  sequence: {render: (b, day, tones, roles) => renderSequence(b, day, tones, roles)},
  table: {render: (b, day, tones, roles) => renderTable(b, day, tones, roles)},
  row: {render: (b, day, tones, roles, stage) => renderRow(b, day, tones, roles, stage), selfDimming: true},
  grid: {render: (b, day, tones, roles, stage) => renderGrid(b, day, tones, roles, stage), selfDimming: true},
  raw: {render: (b, day) => renderRaw(b, day)},
  pyramid: {render: (b, _day, _tones, roles) => renderPyramid(b, roles)},
  curve: {render: (b, day, tones) => renderCurve(b, day, tones)},
  plane: {render: (b, day, tones, _roles, stage) => renderPlane(b, day, tones, stage)},
  quadrant: {render: (b, day, tones) => renderQuadrant(b, day, tones), selfDimming: true},
  wordart: {render: (b, day) => renderWordArt(b, day, !!b.dim), selfDimming: true},
  chevron: {render: (b, day, tones) => renderFlowShape(b, day, tones), selfDimming: true},
  funnel: {render: (b, day, tones) => renderFlowShape(b, day, tones), selfDimming: true},
  cycle: {render: (b, day, tones) => renderFlowShape(b, day, tones), selfDimming: true},
  venn: {render: (b, day, tones) => renderFlowShape(b, day, tones), selfDimming: true},
  concentric: {render: (b, day, tones) => renderFlowShape(b, day, tones), selfDimming: true},
  emblem: {render: (b, day, tones) => renderFlowShape(b, day, tones), selfDimming: true},
  valueChain: {render: (b, day, tones) => renderFlowShape(b, day, tones), selfDimming: true},
  bars: {render: (b, day, _tones, _roles, stage, dimFill) => renderBars(b, day, stage, dimFill), selfDimming: true},
  chart: {render: (b, day, _tones, _roles, stage, dimFill) => renderChart(b, day, emojiSpan, stage, dimFill), selfDimming: true},
  image: {render: (b, day, tones, _roles, stage) => renderImage(b, day, tones, stage), selfDimming: true},
  people: {render: (b, day, tones) => renderPeople(b, day, tones)},
  dots: {render: (b, day, tones) => renderDots(b, day, tones)},
  math: {render: b => renderMath(b)},
  timeline: {render: (b, day) => renderTimeline(b, day), selfDimming: true},
  tree: {render: (b, day, tones) => renderTree(b, day, tones), selfDimming: true},
  states: {render: (b, day, tones) => renderStates(b, day, tones), selfDimming: true},
  cause: {render: (b, day, tones) => renderCause(b, day, tones), selfDimming: true},
  cloud: {render: (b, day, tones) => renderCloud(b, day, tones), selfDimming: true},
  gantt: {render: (b, day) => renderGantt(b, day), selfDimming: true},
  classes: {render: (b, day, tones) => renderClasses(b, day, tones), selfDimming: true},
  bpmn: {render: (b, day, tones) => renderBpmn(b, day, tones), selfDimming: true},
  fta: {render: (b, day, tones) => renderFta(b, day, tones), selfDimming: true},
  bowtie: {render: (b, day, tones) => renderBowtie(b, day, tones), selfDimming: true},
} satisfies {[T in LaidOutType]: EmitHandler<LaidOutOf<T>>};

/** Band types with no emitter in EMIT_HANDLERS: must be `never`. */
export type UnemittedBandTypes = Exclude<LaidOutType, keyof typeof EMIT_HANDLERS>;
export const ALL_BANDS_EMITTED: UnemittedBandTypes extends never ? true : never = true;

const handlerFor = (type: LaidOutType): EmitHandler<LaidOutBand> => EMIT_HANDLERS[type] as EmitHandler<never> as EmitHandler<LaidOutBand>;

export function renderBandPlain(band: LaidOutBand, day: Theme, tones: ToneEnv, roles: Roles, stage?: number, dimFill = false): string {
  return handlerFor(band.type).render(band, day, tones, roles, stage, dimFill);
}

export function renderBand(band: LaidOutBand, day: Theme, tones: ToneEnv, roles: Roles, stage?: number, dimFill = false): string {
  const svg = renderBandPlain(band, day, tones, roles, stage, dimFill);
  if (!band.dim || handlerFor(band.type).selfDimming) return svg;
  return svg
    .replace(/marker-(start|end)="url\(#dsl-arrow(-strong)?\)"/g, 'marker-$1="url(#dsl-arrow$2-dim)"')
    .replace(/stroke="#[0-9a-fA-F]{6}"/g, `stroke="${PALETTE.muted}"`)
    .replace(/fill="(#[0-9a-fA-F]{6})"/g, (_all, fill: string) => `fill="${fill === PALETTE.bg ? PALETTE.bg : PALETTE.muted}"`);
}
