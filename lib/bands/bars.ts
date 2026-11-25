import {hiddenBarsDescription} from '../diagram-description.ts';
import {definedDiagramTitle} from '../diagram-title.ts';
import {findingAcceptanceHint} from '../finding-rules.ts';
import {selectedAxisFindings} from '../axis-selected.ts';
import {texts} from '../band-text-sizes.ts';
import {band, walkDefinedBands} from '../band-def.ts';
import type {BandDef, DiagramFindings, WithBandDef} from '../band-def.ts';
import {barsTexts, layoutBars, barsValueAxis} from '../bars.ts';
import {bars as build, histogram as buildHistogram, pareto as buildPareto, rangeBars as buildRangeBars} from '../dsl/bars.ts';
import type {HistogramOpts, ParetoOpts} from '../dsl/bars.ts';
import {renderBars} from '../emit-bars.ts';
import {snapGrid} from '../layout-util.ts';
import {revealBarElements} from '../reveal-bars.ts';
import {scopeOf} from '../scope-name.ts';
import {fillTextSize} from '../slide-fill.ts';
import {luminance, paintOf} from '../tokens.ts';
import type {BarDatum, BarsBand, BarsOpts, LaidOutBars} from '../types/bars.ts';
import {barsContrastProblems, barsProblems, barsRects, hiddenBarsTitleFindings, thinBarFindings} from '../verify-bars.ts';

const hiddenValuesFindings: DiagramFindings = (diagram, stage) =>
  hiddenBarsTitleFindings(diagram, () => definedDiagramTitle(diagram, stage), walkDefinedBands, stage);

const definition = {
  type: 'bars',
  describe(data, stage) {
    const description = hiddenBarsDescription(data, stage);
    return description ? ['values', description] : undefined;
  },
  valueAxis: barsValueAxis,
  textSizes: texts,
  fillTextSize: (data, roles) => fillTextSize(roles, data.labelRole),
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
    diagramFindings: [thinBarFindings, selectedAxisFindings, hiddenValuesFindings],
    acceptHint: rule => rule === 'bars-values-hidden' ? findingAcceptanceHint(rule) : undefined,
    check: laid => barsProblems(laid).map(message => ({rule: 'bars', severity: 'problem', message})),
    contrast(laid, {theme, tones, appearance}) {
      const paint = paintOf(tones, appearance);
      return barsContrastProblems(laid, theme, hex => luminance(paint(hex)));
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

/** @internal Definition used by the full renderer. */
export const barsDefinition: BandDef<BarsBand, LaidOutBars> = definition;
