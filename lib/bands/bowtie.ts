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
  measure(data, {atoms, roles}) {
    for (const [text, size, weight, font] of bowtieMeasure(data, roles)) atoms(text, size, weight, font);
  },
  layout(data, {x, y, w, widthOf, roles, wrap}) {
    const laid = layoutBowtie(data, x, snapGrid(y), w, widthOf, roles, {wrap, keepWords: false});
    return {laid, h: laid.h};
  },
  emit: (laid, {theme, tones}) => renderBowtie(laid, theme, tones),
  verify: {rects: bowtieRects},
} satisfies BandDef<BowtieBand, LaidOutBowtie>;

export function bowtie<const Id extends string = never>(input: BowtieInput, opts?: BowtieOpts & {id?: Id}): WithBandDef<ReturnType<typeof build<Id>>, LaidOutBowtie> {
  const data = build<Id>(input, opts);
  return band<typeof data, LaidOutBowtie>(definition, data);
}
