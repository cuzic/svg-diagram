import type { WithBandDef } from '../band-def.ts';
import { image as build } from '../dsl/image.ts';
import type { ImageMark, ImageOpts, LaidOutImage } from '../types/image.ts';
import type { SelectedBand } from './image.ts';
/** Read an image file before passing its band to the selective renderer. */
export declare function imageFile<const M extends readonly ImageMark[] = [], const Id extends string = never, C extends SelectedBand | SelectedBand[] = []>(src: string | URL, opts: Omit<ImageOpts, 'over'> & {
    id?: Id;
    marks?: M;
    over?: C;
    baseDir?: string;
}): WithBandDef<ReturnType<typeof build<M, Id, C>>, LaidOutImage>;
