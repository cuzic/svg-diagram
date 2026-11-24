import {texts} from '../band-text-sizes.ts';
import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {barsTexts, layoutBars} from '../bars.ts';
import {bars as build, histogram as buildHistogram, pareto as buildPareto, rangeBars as buildRangeBars} from '../dsl/bars.ts';
import type {HistogramOpts, ParetoOpts} from '../dsl/bars.ts';
import {renderBars} from '../emit-figures.ts';
import {snapGrid} from '../layout-util.ts';
import {revealBarElements} from '../reveal-bars.ts';
import {scopeOf} from '../scope-name.ts';
import {luminance, paintOf} from '../tokens.ts';
import type {BarDatum, BarsBand, BarsOpts, LaidOutBars} from '../types/bars.ts';
import {barsContrastProblems, barsProblems, barsRects, thinBarFindings} from '../verify-bars.ts';

const definition = {
  type: 'bars',
  textSizes: texts,
  measure(data, {atoms, roles}) {
    for (const [text, size, weight, font] of barsTexts(data, roles)) atoms(text, size, weight, font);
  },
  layout(data, {x, y, w, widthOf, roles, canvas, geometryScale}) {
    const scope = scopeOf(data);
    const sized = canvas && data.labelRole === undefined ? {...data, labelRole: 'note' as const} : data;
    const placed = layoutBars(sized, x, snapGrid(y), w, widthOf, roles, geometryScale);
    const laid = scope ? {...placed, scope} : placed;
    return {laid, h: laid.h, anchors: laid.anchors};
  },
  revealElements: revealBarElements,
  emit: (laid, {theme, stage}) => renderBars(laid, theme, stage),
  verify: {
    rects: barsRects,
    diagramFindings: thinBarFindings,
    check(laid, {theme, tones, appearance}) {
      const paint = paintOf(tones, appearance);
      return [...barsProblems(laid), ...barsContrastProblems(laid, theme, hex => luminance(paint(hex)))]
        .map(message => ({rule: 'bars', severity: 'problem', message}));
    },
  },
} satisfies BandDef<BarsBand, LaidOutBars>;

function define<D extends BarsBand>(data: D): WithBandDef<D, LaidOutBars> {
  return band<D, LaidOutBars>(definition, data);
}

export function bars<const D extends readonly BarDatum[], const Id extends string = never>(data: D, opts?: BarsOpts & {id?: Id}) {
  return define(build<D, Id>(data, opts));
}

export function rangeBars<const D extends readonly (Omit<BarDatum, 'value' | 'range'> & {range: readonly [number, number]})[], const Id extends string = never>(data: D, opts?: BarsOpts & {id?: Id}) {
  return define(buildRangeBars<D, Id>(data, opts));
}

export function pareto<const Id extends string = never>(items: Parameters<typeof buildPareto>[0], opts?: ParetoOpts & {id?: Id}) {
  return define(buildPareto<Id>(items, opts));
}

export function histogram<const Id extends string = never>(values: readonly number[], opts?: HistogramOpts & {id?: Id}) {
  return define(buildHistogram<Id>(values, opts));
}
