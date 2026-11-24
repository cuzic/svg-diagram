import {oneLine, type BandDescription} from './diagram-description.ts';
import type {BandDef, PublicEnv} from './band-def.ts';
import {placeChart} from './chart-placement.ts';
import {sizeOf} from './charts-base.ts';
import type {ChartGeom, LaidOutChartPart} from './charts-base.ts';
import {renderChart} from './charts-emit.ts';
import {checkChart} from './charts-verify.ts';
import type {ChartBand, LaidOutChart} from './charts.ts';
import {emojiSpan} from './emit-common.ts';
import {snapGrid} from './layout-util.ts';
import {scopeOf} from './scope-name.ts';
import {anchorRects} from './verify-rects.ts';

type ChartDefinition = BandDef<ChartBand, LaidOutChart>;
type MeasureEnv = Parameters<NonNullable<ChartDefinition['measure']>>[1];

export const describeChart = (data: ChartBand): BandDescription => ['chart', oneLine(data.alt)];

export function measureChart(data: ChartBand, {atoms, roles}: MeasureEnv, texts: readonly [string, number][]): void {
  const size = sizeOf(data.labelRole, roles);
  for (const [text, weight] of texts) atoms(text, size, weight);
}

export function layoutSelectiveChart(data: ChartBand, {x, y, w, widthOf, roles, wrap, geometryScale = 1}: PublicEnv, layout: (g: ChartGeom) => LaidOutChartPart) {
  const placed = placeChart(data, x, snapGrid(y), w, widthOf, roles, wrap, geometryScale, layout);
  const scope = scopeOf(data);
  const laid = scope ? {...placed, scope} : placed;
  return {laid, h: laid.h, anchors: laid.anchors};
}

export const chartIds = (data: ChartBand): string[] => data.ids;
export const emitChart: ChartDefinition['emit'] = (laid, {theme, stage}) => renderChart(laid, theme, emojiSpan, stage);
export const verifyChart: NonNullable<ChartDefinition['verify']> = {
  rects: laid => anchorRects(laid),
  check: (laid, {theme, tones, appearance}) => checkChart(laid, {day: theme, appearance}, tones)
    .map(message => ({rule: 'chart', severity: 'problem', message})),
};
