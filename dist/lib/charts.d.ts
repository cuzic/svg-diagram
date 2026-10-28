import type { ChartKind, ChartOpts, LaidOutChartPart } from './charts-base.ts';
import type { WaterfallSpec } from './charts-waterfall.ts';
import type { TornadoSpec } from './charts-tornado.ts';
import type { HeatmapSpec } from './charts-heatmap.ts';
import type { StackedSpec } from './charts-stacked.ts';
import type { RadarSpec } from './charts-radar.ts';
import type { TreemapSpec } from './charts-treemap.ts';
import type { SankeySpec } from './charts-sankey.ts';
import type { BubbleSpec } from './charts-bubble.ts';
import type { ButterflySpec } from './charts-butterfly.ts';
import type { ComboSpec } from './charts-combo.ts';
import type { HarveySpec } from './charts-harvey.ts';
import type { ClusterSpec } from './charts-cluster.ts';
import type { RegSpec } from './charts-reg.ts';
import type { MultiSpec } from './charts-multi.ts';
import type { DistSpec } from './charts-dist.ts';
import type { CatSpec } from './charts-cat.ts';
import type { CausalSpec, DependencySpec, PertSpec } from './semnet.ts';
import type { FontFamily, Rect, Dimmed, Roles, WidthOf, WrapMode } from './types/core.ts';
import type { RevealOpts, ScopeOpts } from './types/core.ts';
export type ChartSpec = {
    kind: 'waterfall';
    spec: WaterfallSpec;
} | {
    kind: 'tornado';
    spec: TornadoSpec;
} | {
    kind: 'heatmap';
    spec: HeatmapSpec;
} | {
    kind: 'stacked';
    spec: StackedSpec;
} | {
    kind: 'radar';
    spec: RadarSpec;
} | {
    kind: 'treemap';
    spec: TreemapSpec;
} | {
    kind: 'sankey';
    spec: SankeySpec;
} | {
    kind: 'catplot';
    spec: CatSpec;
} | {
    kind: 'distplot';
    spec: DistSpec;
} | {
    kind: 'multiplot';
    spec: MultiSpec;
} | {
    kind: 'regplot';
    spec: RegSpec;
} | {
    kind: 'clustermap';
    spec: ClusterSpec;
} | {
    kind: 'bubble';
    spec: BubbleSpec;
} | {
    kind: 'butterfly';
    spec: ButterflySpec;
} | {
    kind: 'combo';
    spec: ComboSpec;
} | {
    kind: 'harvey';
    spec: HarveySpec;
} | {
    kind: 'pert';
    spec: PertSpec;
} | {
    kind: 'causal';
    spec: CausalSpec;
} | {
    kind: 'dependency';
    spec: DependencySpec;
};
export interface ChartBand extends RevealOpts, ScopeOpts {
    type: 'chart';
    kind: ChartKind;
    spec: ChartSpec['spec'];
    id?: string;
    /** What a reader / the <desc> gets: the figure's data in words. */
    alt: string;
    width?: number;
    height?: number;
    labelRole?: ChartOpts['labelRole'];
    /** The ids of the elements that are anchors (a bar, a cell, a node), for the reveal stages and the typed connect() ids. */
    ids: string[];
}
export interface LaidOutChart extends Rect, Dimmed, LaidOutChartPart {
    type: 'chart';
    kind: ChartKind;
    id?: string;
    alt: string;
    size: number;
    /** Spotlight: the ids of the elements drawn dimmed (the figure's other parts stay lit). */
    dimIds?: string[];
    reveal?: number;
    until?: number;
}
export declare function chartTexts(band: ChartBand, roles: Roles): [string, number, number, FontFamily][];
export declare function layoutChart(band: ChartBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, wrap: WrapMode): LaidOutChart;
/** The value axes a chart band has when it is drawn, for the kinds that can be told to share them (xRange / yRange); undefined for the others. */
export declare function chartAxes(band: ChartBand): {
    x: [number, number];
    y: [number, number];
} | undefined;
