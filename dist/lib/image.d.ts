import type { ToneEnv } from './tokens.ts';
import type { FontFamily, Roles, WidthOf } from './types/core.ts';
import type { ImageBand, ImageLabel, LaidOutImage } from './types/image.ts';
/** Larger than this and rules.ts warns (`image-large`): the whole file travels inside every SVG, and again in every reveal stage. */
export declare const IMAGE_WARN_BYTES: number;
declare const MARK_STROKE = 3;
/** Space between the picture's edge and the parts laid over it (`pad` overrides). */
export declare const IMAGE_PAD = 16;
/** The picture's drawn size in a content width `cw`: the one place it is worked out, so the width pass and the layout agree. */
export declare function imageSize(band: ImageBand, cw: number): {
    w: number;
    h: number;
};
/** Every string an image() draws, registered before its geometry is calculated. */
export declare function imageTexts(band: ImageBand, roles: Roles): [string, number, number, FontFamily][];
export declare function layoutImage(band: ImageBand, x: number, y: number, cw: number, widthOf: WidthOf, roles: Roles): LaidOutImage;
/** What a plate in a tone looks like: fill, outline and text colour keys. */
export declare const plateStyle: (tones: ToneEnv, tone: ImageLabel['tone'] | undefined) => {
    fill: import("./types/core.ts").ColorKey;
    stroke: import("./types/core.ts").ColorKey;
    text: import("./types/core.ts").ColorKey;
    ink: import("./types/core.ts").ColorKey;
};
export { MARK_STROKE };
