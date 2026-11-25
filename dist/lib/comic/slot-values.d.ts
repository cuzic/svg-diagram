import type { ComicFinding, ComicLaidSlot, ComicWorksheet, LaidOutComic, Values } from '../types/comic.ts';
import type { FontWeight, MeasureRequest, WidthOf } from '../types/core.ts';
export type ValueTable = Readonly<Partial<Values>>;
export declare function slotValue(slot: ComicLaidSlot, values: ValueTable): {
    text: string;
    weight: FontWeight;
} | undefined;
export declare function slotFontSize(slot: ComicLaidSlot, value: {
    text: string;
    weight: FontWeight;
}, widthOf?: WidthOf): number;
/** Both sizes are requested up front so rendering and verification can be synchronous. */
export declare function valueAtoms(laid: LaidOutComic, values: ValueTable): Iterable<Required<MeasureRequest>>;
export declare function valueFindings(sheet: ComicWorksheet, laid: LaidOutComic, values: ValueTable, widthOf?: WidthOf): ComicFinding[];
