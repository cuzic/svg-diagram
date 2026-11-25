import type { ChartGeom, ChartOpts, LaidOutChartPart } from './charts-base.ts';
import type { Merge } from './stats.ts';
export interface ClusterOpts extends ChartOpts {
    unit?: string;
    /** Cluster the rows / the columns (default true for both). A column order that is not clustered stays as given. */
    rows?: boolean;
    cols?: boolean;
    /** Scale each row ('row') or column ('col') to 0..1 before clustering and shading (the numbers written stay the originals). Default none. */
    scale?: 'row' | 'col';
    /** Write the numbers in the cells (default true; they are left out of cells too small for them). */
    values?: boolean;
}
export interface ClusterSpec {
    rows: string[];
    cols: string[];
    values: number[][];
    unit: string;
    scale?: 'row' | 'col';
    showValues: boolean;
    rowTree?: {
        merges: Merge[];
        order: number[];
        pos: number[];
    };
    colTree?: {
        merges: Merge[];
        order: number[];
        pos: number[];
    };
    /** The table scaled for shading and clustering. */
    shade: number[][];
}
export declare function resolveCluster(rows: readonly string[], cols: readonly string[], values: readonly (readonly number[])[], opts: ClusterOpts): ClusterSpec;
export declare function clusterAlt(s: ClusterSpec): string;
export declare function clusterTexts(s: ClusterSpec): [string, number][];
export declare function layoutCluster(s: ClusterSpec, g: ChartGeom): LaidOutChartPart;
