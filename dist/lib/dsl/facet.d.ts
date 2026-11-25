import type { RowBand } from '../types/containers.ts';
import type { Band } from '../types/index.ts';
export interface FacetOpts {
    /** Panels per row (default 2). The last row keeps the same column width. */
    cols?: number;
    /** Draw a frame (with the panel's name as its title) around each panel (default true; false: only the name above). */
    frame?: boolean;
    /**
     * Which axes the panels share (as seaborn's sharex / sharey): 'xy' (default), 'x', 'y' or 'none'. The panels are drawn once to see their axes,
     * then again with the combined range handed to `make` as its 4th argument (`{xRange, yRange}`: spread it into the chart's options). Only
     * histplot / kdeplot / ecdfplot / displot / regplot / residplot panels have axes to share; by default other panels are left alone,
     * and an explicit 'x' / 'y' / 'xy' with no such panel is an error.
     */
    share?: 'xy' | 'x' | 'y' | 'none';
}
/** The axes a facet() hands to `make` so that the panels agree. */
export interface FacetAxes {
    xRange?: [number, number];
    yRange?: [number, number];
}
/**
 * パネル分割 (seaborn FacetGrid / relplot / catplot's col=): one panel per key of `data`, each drawn by `make`, titled with the key, laid out in rows.
 * The panels share their axes (`share`): pass the 4th argument on to the chart.
 *   .add(...facet({東京: a, 大阪: b, 名古屋: c}, (name, values, _i, axes) => histplot(values, {...axes}), {cols: 3}))
 */
export declare function facet<T>(data: Readonly<Record<string, T>>, make: (key: string, value: T, index: number, axes: FacetAxes) => Band, opts?: FacetOpts): RowBand[];
