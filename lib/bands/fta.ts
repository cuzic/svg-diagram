import {layoutFitRules, layoutFitVerification} from '../verify-layout-fit.ts';
import {texts} from '../band-text-sizes.ts';
import {analysisFindings} from '../finding-rules.ts';
import {ftaFindings} from '../fta-rules.ts';
import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {faultTree as build} from '../dsl/fta.ts';
import {renderFta} from '../emit-fta.ts';
import {ftaIds, ftaTexts, layoutFta} from '../fta.ts';
import {snapGrid} from '../layout-util.ts';
import {scopeOf} from '../scope-name.ts';
import type {FtaBand, FtaEvent, FtaOpts, LaidOutFta} from '../types/diagrams.ts';
import {ftaRects} from '../verify-fta-rects.ts';

const definition = {
  type: 'fta',
  textSizes: texts,
  ids: data => ftaIds(data.root),
  measure(data, {atoms, roles}) {
    for (const [text, size, weight, font] of ftaTexts(data, roles)) atoms(text, size, weight, font);
  },
  layout(data, {x, y, w, widthOf, roles, wrap, keepWords = false, space}) {
    const placed = layoutFta(data, x, snapGrid(y), w, widthOf, roles, {wrap, keepWords, space});
    const scope = scopeOf(data);
    const laid = scope ? {...placed, scope} : placed;
    return {laid, h: laid.h, anchors: laid.anchors};
  },
  emit: (laid, {theme, tones}) => renderFta(laid, theme, tones),
  rules: layoutFitRules,
  verify: {...layoutFitVerification, rects: ftaRects, findings: (data, {rcaCheck}) => analysisFindings(data, ftaFindings(data), rcaCheck === 'strict' ? 'warn' : 'info')},
} satisfies BandDef<FtaBand, LaidOutFta>;

export function faultTree<const T extends FtaEvent, const Id extends string = never>(top: T, opts?: FtaOpts & {id?: Id}): WithBandDef<ReturnType<typeof build<T, Id>>, LaidOutFta> {
  const data = build<T, Id>(top, opts);
  return band<typeof data, LaidOutFta>(definition, data);
}

/** @internal Definition used by the full renderer. */
export const ftaDefinition: BandDef<FtaBand, LaidOutFta> = definition;
