import type { AreasBand, ConnectBand } from './types/containers.ts';
import type { Roles, WidthOf } from './types/core.ts';
import type { Band } from './types/index.ts';
interface AreaGapContext {
    labelled: readonly ConnectBand[];
    idsIn(band: Band): Set<string>;
    nodeDrop(band: Band, end: {
        id: string;
        side: string;
    }, at: number | undefined, down: boolean, framed: boolean): number;
    onFrame(connect: ConnectBand, end: 'from' | 'to'): boolean;
    roles: Roles;
    widthOf: WidthOf;
}
/** Widen gaps between areas when an unobstructed connector needs label room. */
declare function areasLabelGaps(band: AreasBand, cw: number, { labelled, idsIn, nodeDrop, onFrame, roles, widthOf }: AreaGapContext): {
    gap: number;
    rowGap: number;
};
declare function areasGroupWidths(band: AreasBand, width: number, gap: number): {
    children: Band[];
    width: number;
}[];
export declare const areasPrelayout: {
    labelGaps: typeof areasLabelGaps;
    groupWidths: typeof areasGroupWidths;
};
export {};
