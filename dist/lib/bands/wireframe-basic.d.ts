import type { WithBandDef } from '../band-def.ts';
import { wireframe as build } from '../dsl/wireframe.ts';
import type { LaidOutWireframe, WfRoot, WireframeOpts } from '../types/wireframe.ts';
import type { WireframeRuntime } from '../wireframe-layout-core.ts';
export declare function wireframeFor(runtime: WireframeRuntime): <const Id extends string = never>(root: WfRoot, opts?: WireframeOpts & {
    id?: Id;
}) => WithBandDef<ReturnType<typeof build<Id>>, LaidOutWireframe>;
export declare const wireframe: <const Id extends string = never>(root: WfRoot, opts?: WireframeOpts & {
    id?: Id;
}) => WithBandDef<ReturnType<typeof build<Id>>, LaidOutWireframe>;
