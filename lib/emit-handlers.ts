import {renderImage} from './emit-image.ts';
import {dimBandSvg} from './emit-spotlight.ts';
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
import {renderComicBand} from './comic/emit.ts';
import {renderPlane, renderBars, renderQuadrant, renderFlowShape, renderTimeline, renderTree, renderStates, renderCause, renderCloud, renderGantt, renderClasses, renderBpmn} from './emit-figures.ts';
import {renderSequence, renderTable, renderPrims} from './emit-tables.ts';

export interface EmitHandler<B extends object> {
  selfDimming?: true;
  render(band: B, day: Theme, tones: ToneEnv, roles: Roles, stage: number | undefined, dimFill: boolean): string;
}

/** One emitter per band type, each checked against its own band type; a band type without one fails to compile. */
export const EMIT_HANDLERS = {
  caption: {selfDimming: true, render: (b, day, tones) => renderCaption(b, day, tones)},
  status: {render: b => renderStatus(b)},
  box: {selfDimming: true, render: (b, day, tones, roles) => renderBox(b, day, tones, roles)},
  banner: {selfDimming: true, render: (b, day, tones, roles) => renderBanner(b, day, tones, roles)},
  group: {selfDimming: true, render: (b, day, tones, roles) => renderGroup(b, day, tones, roles)},
  legend: {render: (b, day, tones, roles) => renderLegend(b, day, tones, roles)},
  swimlane: {render: (b, day, _tones, roles) => renderSwimlane(b, day, roles)},
  wireframe: {render: (b, day) => renderPrims(b, day)},
  screens: {render: (b, day) => renderPrims(b, day)},
  sequence: {render: (b, day, tones, roles) => renderSequence(b, day, tones, roles)},
  table: {render: (b, day, tones, roles) => renderTable(b, day, tones, roles)},
  row: {selfDimming: true, render: (b, day, tones, roles, stage) => renderRow(b, day, tones, roles, stage)},
  grid: {selfDimming: true, render: (b, day, tones, roles, stage) => renderGrid(b, day, tones, roles, stage)},
  raw: {render: (b, day) => renderRaw(b, day)},
  pyramid: {render: (b, _day, _tones, roles) => renderPyramid(b, roles)},
  curve: {render: (b, day, tones) => renderCurve(b, day, tones)},
  plane: {render: (b, day, tones, _roles, stage) => renderPlane(b, day, tones, stage)},
  quadrant: {selfDimming: true, render: (b, day, tones) => renderQuadrant(b, day, tones)},
  wordart: {selfDimming: true, render: (b, day) => renderWordArt(b, day, !!b.dim)},
  chevron: {selfDimming: true, render: (b, day, tones) => renderFlowShape(b, day, tones)},
  funnel: {selfDimming: true, render: (b, day, tones) => renderFlowShape(b, day, tones)},
  cycle: {selfDimming: true, render: (b, day, tones) => renderFlowShape(b, day, tones)},
  venn: {selfDimming: true, render: (b, day, tones) => renderFlowShape(b, day, tones)},
  concentric: {selfDimming: true, render: (b, day, tones) => renderFlowShape(b, day, tones)},
  emblem: {selfDimming: true, render: (b, day, tones) => renderFlowShape(b, day, tones)},
  valueChain: {selfDimming: true, render: (b, day, tones) => renderFlowShape(b, day, tones)},
  bars: {selfDimming: true, render: (b, day, _tones, _roles, stage, dimFill) => renderBars(b, day, stage, dimFill)},
  chart: {selfDimming: true, render: (b, day, _tones, _roles, stage, dimFill) => renderChart(b, day, emojiSpan, stage, dimFill)},
  image: {selfDimming: true, render: (b, day, tones, _roles, stage) => renderImage(b, day, tones, stage)},
  people: {render: (b, day, tones) => renderPeople(b, day, tones)},
  dots: {render: (b, day, tones) => renderDots(b, day, tones)},
  math: {render: b => renderMath(b)},
  timeline: {selfDimming: true, render: (b, day) => renderTimeline(b, day)},
  tree: {selfDimming: true, render: (b, day, tones, _roles, stage) => renderTree(b, day, tones, stage)},
  states: {selfDimming: true, render: (b, day, tones) => renderStates(b, day, tones)},
  cause: {selfDimming: true, render: (b, day, tones) => renderCause(b, day, tones)},
  cloud: {selfDimming: true, render: (b, day, tones) => renderCloud(b, day, tones)},
  gantt: {selfDimming: true, render: (b, day) => renderGantt(b, day)},
  classes: {selfDimming: true, render: (b, day, tones) => renderClasses(b, day, tones)},
  bpmn: {selfDimming: true, render: (b, day, tones) => renderBpmn(b, day, tones)},
  fta: {selfDimming: true, render: (b, day, tones) => renderFta(b, day, tones)},
  comic: {render: b => renderComicBand(b)},
  bowtie: {selfDimming: true, render: (b, day, tones) => renderBowtie(b, day, tones)},
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
  return band.dim && !handlerFor(band.type).selfDimming ? dimBandSvg(svg) : svg;
}
