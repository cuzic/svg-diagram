import type { Diagram } from '../types/core.ts';
import type { MathBand, MathOpts } from '../types/math.ts';
import type { ImageBand, ImageMark, ImageOpts } from '../types/image.ts';
import type { Band } from '../types/index.ts';
import type { BuildResult } from '../types/verdicts.ts';
import type { AnchorsOf, Declares, IdsOf, HandleOf, Refers, RefsOf } from '../strict.ts';
type MarkIds<M extends readonly ImageMark[]> = Extract<M[number]['id'], string>;
/**
 * A picture (PNG / JPEG / GIF / WebP) as a part, embedded as a data URI (a file is read when the diagram is drawn or checked) so the SVG stays one file. `marks` outline regions
 * (spotlight and connect() can point at their ids); `labels` put words on opaque plates. Positions are fractions of the picture.
 * `src`: a path (relative: next to the diagram source), `new URL('./a.png', import.meta.url)`, or a data URI.
 */
export declare function image<const M extends readonly ImageMark[] = [], const Id extends string = never, C extends Band | Band[] = []>(src: string | URL, opts: Omit<ImageOpts, 'over'> & {
    id?: Id;
    marks?: M;
    over?: C;
}): ImageBand & Declares<Id | MarkIds<M> | IdsOf<C>> & Refers<RefsOf<C>> & HandleOf<Id> & AnchorsOf<MarkIds<M>>;
export declare function build(d: Diagram, outPath: string, opts?: {
    lint?: boolean;
    name?: string;
    html?: boolean;
}): Promise<BuildResult>;
export declare function math<const Id extends string = never>(tex: string, opts?: MathOpts & {
    id?: Id;
}): MathBand & Declares<Id> & HandleOf<Id>;
export {};
