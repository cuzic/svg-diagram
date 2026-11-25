import { DEF } from '../band-def.ts';
import type { BandDef, WithBandDef } from '../band-def.ts';
import { grid as buildGrid } from '../dsl/grid.ts';
import type { GridBand, LaidOutGrid, GridOpts } from '../types/containers.ts';
import type { BoxBand } from '../types/text-bands.ts';
export declare const gridDefinition: BandDef<GridBand, LaidOutGrid>;
export declare function grid<C extends BoxBand & {
    readonly [DEF]: object;
}>(children: C[], opts: GridOpts): WithBandDef<ReturnType<typeof buildGrid<C>>, LaidOutGrid>;
