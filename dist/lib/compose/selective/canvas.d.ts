import type { CanvasContent, CanvasOpts, CanvasTemplate } from '../canvas.ts';
export type { CanvasContent, CanvasKey, CanvasOpts, CanvasTemplate } from '../canvas.ts';
export declare function canvas<const T extends CanvasTemplate, const Id extends string = never>(template: T, content: CanvasContent<T>, opts?: CanvasOpts<T> & {
    id?: Id;
}): import("../../band-def.ts").WithBandDef<import("../../dsl-pure.ts").GridBand, import("../../dsl-pure.ts").LaidOutGrid>;
