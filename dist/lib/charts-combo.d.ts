import type { ChartGeom, ChartOpts, ChartTone, LaidOutChartPart } from './charts-base.ts';
export interface ComboSeries {
    label: string;
    type: 'bar' | 'line';
    /** One value per category (null: no value — a gap in a line, no bar). */
    values: readonly (number | null)[];
    /** The axis a line reads on (default 'right'). A bar is always on the left. */
    axis?: 'left' | 'right';
    tone?: ChartTone;
    id?: string;
}
export interface ComboAxis {
    min?: number;
    max?: number; /** The unit written after every value on this axis ('億円', '%'). */
    unit?: string; /** A title over the axis (default: the unit). */
    title?: string;
}
export interface ComboOpts extends ChartOpts {
    y?: ComboAxis;
    y2?: ComboAxis;
    /** Write the values (default true). */
    values?: boolean;
    /** Stack the bar series in one column per category (values must be >= 0); the column's total is written above it. */
    stack?: boolean;
}
export interface ComboSpec {
    categories: string[];
    series: (Required<Pick<ComboSeries, 'label' | 'type' | 'axis'>> & {
        values: (number | null)[];
        tone: ChartTone;
        id?: string;
    })[];
    y: ComboAxis;
    y2: ComboAxis;
    values: boolean;
    stack: boolean;
}
export declare function resolveCombo(categories: readonly string[], series: readonly ComboSeries[], opts?: ComboOpts): ComboSpec;
export declare function comboAlt(s: ComboSpec): string;
export declare function comboTexts(s: ComboSpec): [string, number][];
export declare function layoutCombo(s: ComboSpec, g: ChartGeom): LaidOutChartPart;
