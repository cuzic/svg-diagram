import { steps as buildSteps } from '../steps.ts';
import type { StepItem, StepsOpts } from '../steps.ts';
import { DEF } from '../band-def.ts';
import type { BandDef, WithBandDef } from '../band-def.ts';
import type { Declares, IdsOf, RowHandleOf } from '../strict.ts';
import type { LaidOutRow, RowBand, RowOpts } from '../types/containers.ts';
import type { BoxBand } from '../types/text-bands.ts';
export declare const rowDefinition: BandDef<RowBand, LaidOutRow>;
export declare function row<C extends BoxBand & {
    readonly [DEF]: object;
}, const Id extends string = never>(children: C[], opts?: RowOpts & {
    id?: Id;
}): WithBandDef<RowBand & Declares<IdsOf<C> | Id> & RowHandleOf<Id>, LaidOutRow>;
export type { StepItem, StepsOpts } from '../steps.ts';
export declare function steps<const Id extends string = never>(items: StepItem[], opts?: StepsOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof buildSteps<Id>>, LaidOutRow>;
