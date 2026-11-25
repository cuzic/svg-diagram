import type { WithBandDef } from '../../band-def.ts';
import type { WhyWhyTreeOpts } from '../../dsl/diagrams.ts';
import type { Declares, HandleOf } from '../../strict.ts';
import type { CauseBand, LaidOutCause, WhyNode } from '../../types/diagrams.ts';
import type { CaptionBand, LaidOutCaption } from '../../types/text-bands.ts';
export type { WhyNode, WhyWhyTreeOpts };
type SelectedCause = WithBandDef<CauseBand, LaidOutCause>;
type SelectedCaption = WithBandDef<CaptionBand, LaidOutCaption>;
export declare function whyWhyTree<const Id extends string>(problem: string, whys: readonly WhyNode[], opts: WhyWhyTreeOpts & {
    id: Id;
}): [
    SelectedCause & Declares<Id | `${Id}.problem` | `${Id}.w${string}`> & HandleOf<Id>,
    ...SelectedCaption[]
];
export declare function whyWhyTree(problem: string, whys: readonly WhyNode[], opts?: WhyWhyTreeOpts): (SelectedCause | SelectedCaption)[];
