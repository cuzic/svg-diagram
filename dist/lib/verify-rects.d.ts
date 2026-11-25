import type { BandDef } from './band-def.ts';
import type { LaidOutBand } from './types/index.ts';
import type { LaidOutStatus } from './types/containers.ts';
import type { Rect } from './types/core.ts';
import type { LaidOutBox } from './types/text-bands.ts';
import type { CheckRect } from './types/verdicts.ts';
type Anchored = Rect & {
    id?: string;
    anchors: (Rect & {
        id: string;
    })[];
};
/** Each anchor is its own rect; `holds`: a connector that ends on the whole figure (its id) may run among them. */
export declare const anchorRects: (band: Anchored, intentional?: string) => CheckRect[];
export declare const figureRects: (band: Anchored) => CheckRect[];
/** An emblem's obstacle is the bounding box of each shape, not its anchor: a triangle's anchor leaves out its lower corners. */
export declare const emblemRects: (band: Anchored & {
    bounds?: Anchored['anchors'];
}) => CheckRect[];
export declare const overlappingFigureRects: (band: Anchored) => CheckRect[];
export declare const childRects: (band: {
    children: LaidOutBox[];
}) => CheckRect[];
export declare const statusRects: (band: LaidOutStatus) => CheckRect[];
/** A rect of a scoped band answers to the names a connect() holds (`plan.p0`), not the bare ids the band's own output keeps (ADR 0012). The band's own id is a name of the whole figure. */
export declare function scopedRect(band: {
    type: string;
    id?: string;
}, scope: string, r: CheckRect): CheckRect;
export declare const frameRects: (band: {
    anchors: (Rect & {
        id: string;
    })[];
}) => CheckRect[];
export declare const ownRect: (band: Rect & {
    id?: string;
}) => CheckRect[];
/** Every checkable rect of a laid-out figure, in band order: what each band's definition lists, or the band as a whole when it lists none. */
export declare function collectRectsWith(figure: {
    laidOut: readonly LaidOutBand[];
}, definitionOf: (band: LaidOutBand) => BandDef | undefined): CheckRect[];
export {};
