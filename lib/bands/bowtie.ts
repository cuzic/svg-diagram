import {layoutFitRules, layoutFitVerification} from '../verify-layout-fit.ts';
import {texts} from '../band-text-sizes.ts';
import {analysisFindings} from '../finding-rules.ts';
import {bowtieFindings} from '../rca-rules.ts';
import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {bowtieMeasure, layoutBowtie} from '../bowtie.ts';
import {bowtie as build} from '../dsl/bowtie.ts';
import {renderBowtie} from '../emit-bowtie.ts';
import {snapGrid} from '../layout-util.ts';
import type {BowtieBand, BowtieInput, BowtieOpts, LaidOutBowtie} from '../types/diagrams.ts';
import {bowtieRects} from '../verify-bowtie-rects.ts';

const definition = {
  type: 'bowtie',
  textSizes: texts,
  measure(data, {atoms, roles}) {
    for (const [text, size, weight, font] of bowtieMeasure(data, roles)) atoms(text, size, weight, font);
  },
  layout(data, {x, y, w, widthOf, roles, wrap, keepWords = false, space}) {
    const laid = layoutBowtie(data, x, snapGrid(y), w, widthOf, roles, {wrap, keepWords, space});
    return {laid, h: laid.h};
  },
  emit: (laid, {theme, tones}) => renderBowtie(laid, theme, tones),
  rules: layoutFitRules,
  verify: {...layoutFitVerification, rects: bowtieRects, findings: data => analysisFindings(data, bowtieFindings(data))},
} satisfies BandDef<BowtieBand, LaidOutBowtie>;

export function bowtie<const Id extends string = never>(input: BowtieInput, opts?: BowtieOpts & {id?: Id}): WithBandDef<ReturnType<typeof build<Id>>, LaidOutBowtie> {
  const data = build<Id>(input, opts);
  return band<typeof data, LaidOutBowtie>(definition, data);
}

/** @internal Definition used by the full renderer. */
export const bowtieDefinition: BandDef<BowtieBand, LaidOutBowtie> = definition;
