import type { BandDef, WithBandDef } from '../band-def.ts';
import { wireframe as build } from '../dsl/wireframe.ts';
import type { LaidOutWireframe, WfRoot, WireframeBand, WireframeOpts } from '../types/wireframe.ts';
export { wf } from '../wireframe.ts';
export declare function wireframe<const Id extends string = never>(root: WfRoot, opts?: WireframeOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof build<Id>>, LaidOutWireframe>;
/** @internal Definition used by the full renderer. */
export declare const wireframeDefinition: BandDef<WireframeBand, LaidOutWireframe>;
