import { DEF } from '../band-def.ts';
import type { BandDef, WithBandDef } from '../band-def.ts';
import { image as build } from '../dsl/image.ts';
import type { ImageBand, ImageMark, ImageOpts, LaidOutImage } from '../types/image.ts';
import type { Band } from '../types/index.ts';
export type SelectedBand = Band & {
    readonly [DEF]: object;
};
export declare const imageDefinition: BandDef<ImageBand, LaidOutImage>;
/** Embed a raster data URI without a file loader. */
export declare function image<const M extends readonly ImageMark[] = [], const Id extends string = never, C extends SelectedBand | SelectedBand[] = []>(src: string, opts: Omit<ImageOpts, 'over'> & {
    id?: Id;
    marks?: M;
    over?: C;
}): WithBandDef<ReturnType<typeof build<M, Id, C>>, LaidOutImage>;
