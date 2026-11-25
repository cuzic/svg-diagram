import { DEF } from '../band-def.ts';
import type { BandDef, WithBandDef } from '../band-def.ts';
import { areas as buildAreas } from '../dsl/areas.ts';
import type { AreaContent } from '../dsl/areas.ts';
import type { AreasBand, AreasOpts, LaidOutRow } from '../types/containers.ts';
export declare function areas<const C extends Record<string, AreaContent & {
    readonly [DEF]: object;
}>, const Id extends string = never>(template: string | readonly string[], cells: C, opts?: AreasOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof buildAreas<C, Id>>, LaidOutRow>;
/** @internal Definition used by the full renderer. */
export declare const areasDefinition: BandDef<AreasBand, LaidOutRow>;
