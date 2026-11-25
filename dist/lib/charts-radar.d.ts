import type { ChartGeom, ChartOpts, ChartTone, LaidOutChartPart } from './charts-base.ts';
export interface RadarSeries {
    label: string;
    values: number[];
    id?: string;
}
export interface RadarOpts extends ChartOpts {
    /** The value at the centre (default 0). */
    min?: number;
    /** The value at the outer ring (default: the largest value rounded up to a round number). */
    max?: number;
    /** How many rings (default 4). */
    rings?: number;
    /** Print the value at every vertex. A value with no room (two series on the same spot) is left out of the drawing. */
    values?: boolean;
    unit?: string;
    /** Shade the inside of the polygon (default: when there is one series). */
    fill?: boolean;
}
export interface RadarSpec {
    axes: string[];
    series: RadarSeries[];
    min: number;
    max: number;
    rings: number;
    values: boolean;
    unit: string;
    fill: boolean;
}
export interface SeriesStyle {
    tone: ChartTone;
    dash?: string;
    marker: 'circle' | 'square' | 'diamond' | 'triangle';
}
/** The look of the n-th series: a line style and a marker shape of its own, and a colour besides. */
export declare const SERIES_STYLES: SeriesStyle[];
/** A marker as a path centred on (x, y), 5px out. */
export declare function markerPath(shape: SeriesStyle['marker'], x: number, y: number, r?: number): string;
export declare function resolveRadar(axes: readonly string[], series: readonly RadarSeries[], opts: RadarOpts): RadarSpec;
export declare function radarAlt(s: RadarSpec): string;
export declare function radarTexts(s: RadarSpec): [string, number][];
export declare function layoutRadar(s: RadarSpec, g: ChartGeom): LaidOutChartPart;
