import type { BandDef, WithBandDef } from '../band-def.ts';
import type { quadrant as legacy } from '../dsl/figures.ts';
import type { LaidOutQuadrant, QuadrantBand, QuadrantItem, QuadrantOpts, QuadrantPreset } from '../quadrant.ts';
declare function build<const Id extends string = never, const I extends readonly QuadrantItem[] = readonly []>(opts: Omit<QuadrantOpts, 'items'> & {
    id?: Id;
    items?: I;
}): WithBandDef<ReturnType<typeof legacy<Id, I>>, LaidOutQuadrant>;
declare function preset<const Id extends string = never, const I extends readonly QuadrantItem[] = readonly []>(name: QuadrantPreset, opts?: Omit<QuadrantOpts, 'items' | 'preset'> & {
    id?: Id;
    items?: I;
}): WithBandDef<QuadrantBand & import("../strict.ts").Declares<Id | (I[number] extends infer E ? E extends {
    readonly id: infer X extends string;
} ? X : never : never)> & import("../strict.ts").HandleOf<Id>, LaidOutQuadrant>;
export declare const quadrant: typeof build & {
    preset: typeof preset;
};
/** @internal Definition used by the full renderer. */
export declare const quadrantDefinition: BandDef<QuadrantBand, LaidOutQuadrant>;
export {};
