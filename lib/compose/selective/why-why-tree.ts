import {band} from '../../band-def.ts';
import type {WithBandDef} from '../../band-def.ts';
import {captionDefinition} from '../../bands/caption.ts';
import {causeDefinition} from '../../bands/cause.ts';
import {whyWhyTree as build} from '../../dsl/diagrams.ts';
import type {WhyWhyTreeOpts} from '../../dsl/diagrams.ts';
import type {Declares, HandleOf} from '../../strict.ts';
import type {CauseBand, LaidOutCause, WhyNode} from '../../types/diagrams.ts';
import type {CaptionBand, LaidOutCaption} from '../../types/text-bands.ts';

export type {WhyNode, WhyWhyTreeOpts};

type SelectedCause = WithBandDef<CauseBand, LaidOutCause>;
type SelectedCaption = WithBandDef<CaptionBand, LaidOutCaption>;

export function whyWhyTree<const Id extends string>(problem: string, whys: readonly WhyNode[], opts: WhyWhyTreeOpts & {id: Id}):
  [SelectedCause & Declares<Id | `${Id}.problem` | `${Id}.w${string}`> & HandleOf<Id>, ...SelectedCaption[]];
export function whyWhyTree(problem: string, whys: readonly WhyNode[], opts?: WhyWhyTreeOpts): (SelectedCause | SelectedCaption)[];
export function whyWhyTree(problem: string, whys: readonly WhyNode[], opts?: WhyWhyTreeOpts) {
  return build(problem, whys, opts).map(data => data.type === 'cause'
    ? band(causeDefinition, data)
    : band(captionDefinition, data));
}
