import type { ChartGeom, ChartOpts, ChartTone, LaidOutChartPart } from './charts-base.ts';
export interface TreemapNode {
    label: string;
    /** A leaf's value (the area). A group takes the sum of its children. */
    value?: number;
    children?: TreemapNode[];
    id?: string;
    /** A leaf in a solid colour to stand out (default: the pale shade of its group). */
    tone?: Extract<ChartTone, 'accent' | 'danger'>;
}
export interface TreemapOpts extends ChartOpts {
    unit?: string;
    /** Add each cell's share of the whole to its value ("120 (12%)"). */
    percent?: boolean;
    /** A label that does not fit is an error instead of being left out of the drawing. */
    strict?: boolean;
}
export interface TreemapSpec {
    nodes: TreemapNode[];
    unit: string;
    percent: boolean;
    strict: boolean;
    total: number;
}
export declare function resolveTreemap(tree: TreemapNode | readonly TreemapNode[], opts: TreemapOpts): TreemapSpec;
export declare function treemapAlt(s: TreemapSpec): string;
export declare function treemapTexts(s: TreemapSpec): [string, number][];
interface Cell {
    n: TreemapNode;
    v: number;
    x: number;
    y: number;
    w: number;
    h: number;
}
/** Squarified layout (Bruls, Huizing, van Wijk): items sorted by value, laid in rows along the shorter side. */
export declare function squarify(items: {
    n: TreemapNode;
    v: number;
}[], x: number, y: number, w: number, h: number): Cell[];
export declare function layoutTreemap(s: TreemapSpec, g: ChartGeom): LaidOutChartPart;
export {};
