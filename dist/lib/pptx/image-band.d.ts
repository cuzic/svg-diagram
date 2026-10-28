import type { LaidOutDiagram, LaidOutBand } from '../types/index.ts';
import type { Rect } from './xml.ts';
/** One band drawn on its own: `svg` is what `svgBlip` carries, `pngSvg` the twin resvg can draw (it ignores `auto-start-reverse`). */
export interface Picture {
    svg: string;
    pngSvg: string;
}
/** The picture of a band and the rectangle it covers on the slide. */
export declare function bandPicture(ld: LaidOutDiagram, band: LaidOutBand & {
    h: number;
}, index: number): {
    picture: Picture;
    rect: Rect;
};
