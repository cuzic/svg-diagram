import type { BubbleKind, ComicAspect, ComicBand, ComicLaidBubble, ComicLaidHead, ComicLayoutName, ComicSlotDef, LaidOutComic } from '../types/comic.ts';
import type { Rect, WidthOf } from '../types/core.ts';
/** The panels of each named layout: columns x rows. */
export declare const LAYOUT_GRID: Readonly<Record<ComicLayoutName, {
    cols: number;
    rows: number;
}>>;
/** The default shape of a panel in a column of panels (ADR 0074 Q10; see the measurement in the ADR). */
export declare const DEFAULT_COLUMN_ASPECT: ComicAspect;
export declare const aspectOf: (layout: ComicLayoutName, aspect: ComicAspect | undefined) => ComicAspect;
/** The size of one panel: 420 wide in a column (360 in a 2x2), the height from the aspect on the 4px grid. */
export declare function panelSize(layout: ComicLayoutName, aspect: ComicAspect | undefined): {
    w: number;
    h: number;
};
/** The band over the heads that the bubbles stack in: from ZONE_TOP to HEAD_KEEP above the head circle, as distances from the panel's top. */
export declare const zoneOf: (panelH: number) => {
    top: number;
    bottom: number;
};
/** The most lines two stacked bubbles may have together: what the zone holds (4 at 7:5, 6 at 6:5). */
export declare const lineBudget: (panelH: number) => number;
/** The height of a bubble of `n` lines. */
export declare const bubbleHeight: (n: number) => number;
export declare const slotMax: (def: ComicSlotDef | undefined) => number | undefined;
export declare function layoutComic(band: ComicBand, x: number, y: number, w: number, widthOf: WidthOf): LaidOutComic;
/** The tail: its tip is on the line from the bubble's centre to the speaker's mouth, stopping TAIL_STOP outside the head circle (never over the face); the outline (lib/comic/balloon-path.ts) works out where the wedge meets the body. */
export declare function tailOf(b: Rect & {
    kind: BubbleKind;
}, speaker: ComicLaidHead): ComicLaidBubble['tail'];
