import type { BandDef, WithBandDef } from '../band-def.ts';
import { wordart as build } from '../dsl/wordart.ts';
import type { LaidOutWordArt, WordArtBand, WordArtOpts } from '../wordart-types.ts';
export declare function wordart<const Id extends string = never>(text: string, opts?: WordArtOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof build<Id>>, LaidOutWordArt>;
/** @internal Definition used by the full renderer. */
export declare const wordartDefinition: BandDef<WordArtBand, LaidOutWordArt>;
