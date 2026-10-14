// chart bands: waterfall, radar, heatmap, stacked bars / mekko, treemap, sankey, tornado. Each is worked out from its data into a
// list of rects / paths / texts (charts-base.ts); this file is the one place bands, layout and the description meet them.
import {sizeOf} from './charts-base.ts';
import type {ChartKind, ChartOpts, LaidOutChartPart} from './charts-base.ts';
import {waterfallTexts, layoutWaterfall} from './charts-waterfall.ts';
import type {WaterfallSpec} from './charts-waterfall.ts';
import {tornadoTexts, layoutTornado} from './charts-tornado.ts';
import type {TornadoSpec} from './charts-tornado.ts';
import {heatmapTexts, layoutHeatmap} from './charts-heatmap.ts';
import type {HeatmapSpec} from './charts-heatmap.ts';
import {layoutStacked, stackedTexts} from './charts-stacked.ts';
import type {StackedSpec} from './charts-stacked.ts';
import {layoutRadar, radarTexts} from './charts-radar.ts';
import type {RadarSpec} from './charts-radar.ts';
import {layoutTreemap, treemapTexts} from './charts-treemap.ts';
import type {TreemapSpec} from './charts-treemap.ts';
import {layoutSankey, sankeyTexts} from './charts-sankey.ts';
import type {SankeySpec} from './charts-sankey.ts';
import {catTexts, layoutCat} from './charts-cat.ts';
import {distAxes, distTexts, layoutDist} from './charts-dist.ts';
import {layoutMulti, multiTexts} from './charts-multi.ts';
import {layoutReg, regAxes, regTexts} from './charts-reg.ts';
import {clusterTexts, layoutCluster} from './charts-cluster.ts';
import type {ClusterSpec} from './charts-cluster.ts';
import type {RegSpec} from './charts-reg.ts';
import type {MultiSpec} from './charts-multi.ts';
import type {DistSpec} from './charts-dist.ts';
import type {CatSpec} from './charts-cat.ts';
import {layoutCausal, layoutDependency, layoutPert, semnetTexts} from './semnet.ts';
import type {CausalSpec, DependencySpec, PertSpec} from './semnet.ts';
import type {FontFamily, Rect, Dimmed, Roles, WidthOf} from './types.ts';
import type {RevealOpts} from './types.ts';

export type ChartSpec = {kind: 'waterfall'; spec: WaterfallSpec} | {kind: 'tornado'; spec: TornadoSpec} | {kind: 'heatmap'; spec: HeatmapSpec} | {kind: 'stacked'; spec: StackedSpec} | {kind: 'radar'; spec: RadarSpec} | {kind: 'treemap'; spec: TreemapSpec} | {kind: 'sankey'; spec: SankeySpec} | {kind: 'catplot'; spec: CatSpec} | {kind: 'distplot'; spec: DistSpec} | {kind: 'multiplot'; spec: MultiSpec} | {kind: 'regplot'; spec: RegSpec} | {kind: 'clustermap'; spec: ClusterSpec} | {kind: 'pert'; spec: PertSpec} | {kind: 'causal'; spec: CausalSpec} | {kind: 'dependency'; spec: DependencySpec};

export interface ChartBand extends RevealOpts {
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

export function chartTexts(band: ChartBand, roles: Roles): [string, number, number, FontFamily][] {
  const size = sizeOf(band.labelRole, roles);
  const list = ((): [string, number][] => {
    switch (band.kind) {
      case 'waterfall': return waterfallTexts(band.spec as WaterfallSpec);
      case 'tornado': return tornadoTexts(band.spec as TornadoSpec);
      case 'heatmap': return heatmapTexts(band.spec as HeatmapSpec);
      case 'stacked': return stackedTexts(band.spec as StackedSpec);
      case 'radar': return radarTexts(band.spec as RadarSpec);
      case 'treemap': return treemapTexts(band.spec as TreemapSpec);
      case 'sankey': return sankeyTexts(band.spec as SankeySpec);
      case 'clustermap': return clusterTexts(band.spec as ClusterSpec);
      case 'regplot': return regTexts(band.spec as RegSpec);
      case 'multiplot': return multiTexts(band.spec as MultiSpec);
      case 'distplot': return distTexts(band.spec as DistSpec);
      case 'catplot': return catTexts(band.spec as CatSpec);
      case 'pert': case 'causal': case 'dependency': return semnetTexts(band.kind, band.spec as PertSpec | CausalSpec | DependencySpec);
      default: return [];
    }
  })();
  return list.map(([s, weight]) => [s, size, weight, 'sans']);
}

export function layoutChart(band: ChartBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles): LaidOutChart {
  const size = sizeOf(band.labelRole, roles), width = Math.min(w, band.width ?? w), left = x + (w - width) / 2;
  const g = {x: left, y, w: width, height: band.height, size, widthOf};
  const part = ((): LaidOutChartPart => {
    switch (band.kind) {
      case 'waterfall': return layoutWaterfall(band.spec as WaterfallSpec, g);
      case 'tornado': return layoutTornado(band.spec as TornadoSpec, g);
      case 'heatmap': return layoutHeatmap(band.spec as HeatmapSpec, g);
      case 'stacked': return layoutStacked(band.spec as StackedSpec, g);
      case 'radar': return layoutRadar(band.spec as RadarSpec, g);
      case 'treemap': return layoutTreemap(band.spec as TreemapSpec, g);
      case 'sankey': return layoutSankey(band.spec as SankeySpec, g);
      case 'clustermap': return layoutCluster(band.spec as ClusterSpec, g);
      case 'regplot': return layoutReg(band.spec as RegSpec, g);
      case 'multiplot': return layoutMulti(band.spec as MultiSpec, g);
      case 'distplot': return layoutDist(band.spec as DistSpec, g);
      case 'catplot': return layoutCat(band.spec as CatSpec, g);
      case 'pert': return layoutPert(band.spec as PertSpec, g);
      case 'causal': return layoutCausal(band.spec as CausalSpec, g);
      case 'dependency': return layoutDependency(band.spec as DependencySpec, g);
      default: throw new Error(`chart(): unknown kind ${band.kind}`);
    }
  })();
  return {type: 'chart', kind: band.kind, id: band.id, alt: band.alt, size, x: left, y, w: width, ...part, ...(band.reveal === undefined ? {} : {reveal: band.reveal}), ...(band.until === undefined ? {} : {until: band.until})};
}

/** The value axes a chart band has when it is drawn, for the kinds that can be told to share them (xRange / yRange); undefined for the others. */
export function chartAxes(band: ChartBand): {x: [number, number]; y: [number, number]} | undefined {
  switch (band.kind) {
    case 'distplot': return distAxes(band.spec as DistSpec);
    case 'regplot': return regAxes(band.spec as RegSpec);
    default: return undefined;
  }
}
