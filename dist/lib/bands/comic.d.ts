import type { BandDef, WithBandDef } from '../band-def.ts';
import { comic as build } from '../dsl/comic.ts';
import type { ComicBand, ComicOpts, ComicWorksheet, LaidOutComic } from '../types/comic.ts';
/** Builds a comic worksheet band for renderBands(). */
export declare function comic<const Id extends string = never, const Sheet extends ComicWorksheet = ComicWorksheet>(sheet: Sheet, opts?: ComicOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof build<Id, Sheet>>, LaidOutComic>;
/** @internal Definition used by the full renderer. */
export declare const comicDefinition: BandDef<ComicBand, LaidOutComic>;
