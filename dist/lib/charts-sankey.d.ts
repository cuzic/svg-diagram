import type { ChartGeom, ChartOpts, ChartTone, LaidOutChartPart } from './charts-base.ts';
import type { IconName } from './icons.ts';
import type { IconGlyph } from './icon-store.ts';
export interface SankeyNode {
    id: string;
    label?: string;
    tone?: ChartTone;
    /** An installed SVG icon (see `icon`) before the node's label, as tall as a line of it. */
    icon?: IconName;
    /** Internal: the installed path of `icon`, resolved by sankey(). */
    iconGlyph?: IconGlyph;
}
export interface SankeyLink {
    from: string;
    to: string;
    value: number; /** `danger` ribbons are drawn with a dashed outline too. */
    tone?: Extract<ChartTone, 'accent' | 'danger' | 'muted'>;
}
export interface SankeyOpts extends ChartOpts {
    unit?: string;
    /** Where the nodes with no outflow go: 'justify' (the last layer, default) or 'left' (where their longest path ends). */
    align?: 'justify' | 'left';
    /** Print the value on each ribbon thick enough for it (default true). */
    linkLabels?: boolean;
}
export interface SankeySpec {
    nodes: {
        id: string;
        label: string;
        tone: ChartTone;
        icon?: {
            name: string;
            glyph: IconGlyph;
        };
    }[];
    links: {
        from: string;
        to: string;
        value: number;
        tone: 'accent' | 'danger' | 'muted';
    }[];
    unit: string;
    align: 'justify' | 'left';
    linkLabels: boolean;
}
export declare function resolveSankey(nodes: readonly (SankeyNode | string)[], links: readonly SankeyLink[], opts: SankeyOpts): SankeySpec;
/** The layer of each node: the longest path from a source (a cycle throws); sinks go to the last layer unless align is 'left'. */
export declare function layersOf(s: SankeySpec): Map<string, number>;
export declare function sankeyAlt(s: SankeySpec): string;
export declare function sankeyTexts(s: SankeySpec): [string, number][];
export declare function layoutSankey(s: SankeySpec, g: ChartGeom): LaidOutChartPart;
