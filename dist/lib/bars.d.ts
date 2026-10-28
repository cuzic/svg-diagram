import type { BarDatum, BarsBand, LaidOutBars } from './types/bars.ts';
import type { FontFamily, WidthOf, Roles } from './types/core.ts';
/** Where a bar starts and ends along the value axis: a range `[lo, hi]`, or 0 up to the value. Every geometry and text of a bar reads this, never `d.value` (a range datum has none). */
export declare const barSpan: (d: BarDatum) => {
    lo: number;
    hi: number;
};
/** What the bar's value says: `5.8万円`, or for a range `3.2〜5.8万円`. */
export declare const spanText: (d: BarDatum, format: BarsBand['valueFormat'], unit: string | undefined) => string;
/** Values are on neither a label nor a scale: the figure alone cannot be read for them. */
export declare const barsValuesHidden: (band: BarsBand) => boolean;
/** Every string bars() draws, registered before its geometry is calculated. */
export declare function barsTexts(band: BarsBand, roles: Roles): [string, number, number, FontFamily][];
/** Does the segment pass through the rectangle (Liang-Barsky)? */
export declare function segHitsRect(sg: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}, r: {
    x: number;
    y: number;
    w: number;
    h: number;
}): boolean;
/** Cumulative share (0-100) after each bar, in the order of the data. */
export declare const cumulativeOf: (data: readonly BarDatum[]) => number[];
/** The row / column each bar sits in: a bar that `replaces` another takes that one's slot (they are never on screen together). */
export declare function slotsOf(data: readonly BarDatum[]): {
    slots: number[];
    count: number;
};
export declare function layoutBars(band: BarsBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles): LaidOutBars;
