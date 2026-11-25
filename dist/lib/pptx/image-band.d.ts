import type { LaidOutDiagram, LaidOutBand } from '../types/index.ts';
export type { Picture } from './image-band-core.ts';
export declare function bandPicture(ld: LaidOutDiagram, band: LaidOutBand, index: number): {
    picture: import("./image-band-core.ts").Picture;
    rect: import("./xml.ts").Rect;
};
