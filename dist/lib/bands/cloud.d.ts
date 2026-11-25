import type { BandDef, WithBandDef } from '../band-def.ts';
import { cloud as build } from '../dsl/cloud.ts';
import type { CloudBand, CloudBox, CloudOpts, LaidOutCloud } from '../types/diagrams.ts';
export declare function cloud<const A extends CloudBox, const B extends CloudBox, const C extends CloudBox, const D extends CloudBox, const D2 extends CloudBox, const Id extends string = never>(boxes: {
    a: A;
    b: B;
    c: C;
    d: D;
    d2: D2;
}, opts?: CloudOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof build<A, B, C, D, D2, Id>>, LaidOutCloud>;
/** @internal Definition used by the full renderer. */
export declare const cloudDefinition: BandDef<CloudBand, LaidOutCloud>;
