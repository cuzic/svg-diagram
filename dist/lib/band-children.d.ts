import type { Band } from './types/index.ts';
type BandOf<T extends Band['type']> = Extract<Band, {
    type: T;
}>;
/** One entry per band type: the bands it holds as its `children` (group, row, grouprow, grid, and an image's `over` parts). */
export type ChildBandsTable = {
    [T in Band['type']]: (band: BandOf<T>) => Band[];
};
declare const none: () => Band[];
export declare const CHILD_BANDS: {
    spacer: typeof none;
    status: typeof none;
    group: (band: import("./types/containers.ts").GroupBand) => Band[];
    sequence: typeof none;
    table: typeof none;
    image: (band: import("./types/image.ts").ImageBand) => Band[];
    timeline: typeof none;
    bpmn: typeof none;
    fta: typeof none;
    bowtie: typeof none;
    classes: typeof none;
    gantt: typeof none;
    cause: typeof none;
    cloud: typeof none;
    states: typeof none;
    tree: typeof none;
    bars: typeof none;
    chart: typeof none;
    people: typeof none;
    dots: typeof none;
    math: typeof none;
    wireframe: typeof none;
    screens: typeof none;
    swimlane: typeof none;
    legend: typeof none;
    connect: typeof none;
    raw: typeof none;
    grouprow: (band: import("./types/containers.ts").GroupRowBand) => (import("./types/text-bands.ts").BoxBand | import("./types/containers.ts").GroupBand)[];
    row: (band: import("./types/containers.ts").RowBand) => import("./types/text-bands.ts").BoxBand[];
    grid: (band: import("./types/containers.ts").GridBand) => import("./types/text-bands.ts").BoxBand[];
    pyramid: typeof none;
    plane: typeof none;
    quadrant: typeof none;
    chevron: typeof none;
    wordart: typeof none;
    funnel: typeof none;
    cycle: typeof none;
    venn: typeof none;
    concentric: typeof none;
    emblem: typeof none;
    curve: typeof none;
    caption: typeof none;
    box: typeof none;
    banner: typeof none;
};
/** The bands a band holds as children (none for most types). */
export declare function childrenOf(band: Band): Band[];
/** Like childrenOf, plus a swimlane's steps: every band that sits inside another one. */
export declare function nestedBandsOf(band: Band): Band[];
/**
 * One entry per band type: the width its `children` stack is laid out at when the band itself is `cw` wide, or null when it does not
 * stack them one under the other at one width (a row / grid places them side by side, a grouprow sizes each by its column).
 */
export type StackWidthTable = {
    [T in Band['type']]: (band: BandOf<T>, cw: number) => number | null;
};
declare const noStack: () => null;
export declare const STACK_WIDTH: {
    spacer: typeof noStack;
    status: typeof noStack;
    group: (band: import("./types/containers.ts").GroupBand, cw: number) => number;
    sequence: typeof noStack;
    table: typeof noStack;
    image: (band: import("./types/image.ts").ImageBand, cw: number) => number | null;
    timeline: typeof noStack;
    bpmn: typeof noStack;
    fta: typeof noStack;
    bowtie: typeof noStack;
    classes: typeof noStack;
    gantt: typeof noStack;
    cause: typeof noStack;
    cloud: typeof noStack;
    states: typeof noStack;
    tree: typeof noStack;
    bars: typeof noStack;
    chart: typeof noStack;
    people: typeof noStack;
    dots: typeof noStack;
    math: typeof noStack;
    wireframe: typeof noStack;
    screens: typeof noStack;
    swimlane: typeof noStack;
    legend: typeof noStack;
    connect: typeof noStack;
    raw: typeof noStack;
    grouprow: typeof noStack;
    row: typeof noStack;
    grid: typeof noStack;
    pyramid: typeof noStack;
    plane: typeof noStack;
    quadrant: typeof noStack;
    chevron: typeof noStack;
    wordart: typeof noStack;
    funnel: typeof noStack;
    cycle: typeof noStack;
    venn: typeof noStack;
    concentric: typeof noStack;
    emblem: typeof noStack;
    curve: typeof noStack;
    caption: typeof noStack;
    box: typeof noStack;
    banner: typeof noStack;
};
/** The width the children of `band` stack at inside a `cw` wide band, or null (see StackWidthTable). */
export declare function stackWidthOf(band: Band, cw: number): number | null;
export {};
