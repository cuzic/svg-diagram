import type { BandDef, WithBandDef } from '../band-def.ts';
import { faultTree as build } from '../dsl/fta.ts';
import type { FtaBand, FtaEvent, FtaOpts, LaidOutFta } from '../types/diagrams.ts';
export declare function faultTree<const T extends FtaEvent, const Id extends string = never>(top: T, opts?: FtaOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof build<T, Id>>, LaidOutFta>;
/** @internal Definition used by the full renderer. */
export declare const ftaDefinition: BandDef<FtaBand, LaidOutFta>;
