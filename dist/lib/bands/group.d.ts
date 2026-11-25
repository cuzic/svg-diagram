import { DEF } from '../band-def.ts';
import type { BandDef, WithBandDef } from '../band-def.ts';
import { group as buildGroup } from '../dsl/group.ts';
import type { GroupBand, GroupOpts, LaidOutGroup } from '../types/containers.ts';
import type { Band } from '../types/index.ts';
type SelectedBand = Band & {
    readonly [DEF]: object;
};
export declare const groupDefinition: BandDef<GroupBand, LaidOutGroup>;
export declare function group<C extends SelectedBand | SelectedBand[], const Id extends string = never>(children: C, opts?: GroupOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof buildGroup<C, Id>>, LaidOutGroup>;
export {};
