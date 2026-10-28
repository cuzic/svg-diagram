// chart bands: waterfall, radar, heatmap, stacked bars / mekko, treemap, sankey, tornado, bubble, butterfly, combo, harvey. Each is worked out from its data into a
// list of rects / paths / texts (charts-base.ts); this file is the one place bands, layout and the description meet them.
import { sizeOf } from './charts-base.js';
import { waterfallTexts, layoutWaterfall } from './charts-waterfall.js';
import { tornadoTexts, layoutTornado } from './charts-tornado.js';
import { heatmapTexts, layoutHeatmap } from './charts-heatmap.js';
import { layoutStacked, stackedTexts } from './charts-stacked.js';
import { layoutRadar, radarTexts } from './charts-radar.js';
import { layoutTreemap, treemapTexts } from './charts-treemap.js';
import { layoutSankey, sankeyTexts } from './charts-sankey.js';
import { bubbleTexts, layoutBubble } from './charts-bubble.js';
import { butterflyTexts, layoutButterfly } from './charts-butterfly.js';
import { comboTexts, layoutCombo } from './charts-combo.js';
import { harveyTexts, layoutHarvey } from './charts-harvey.js';
import { catTexts, layoutCat } from './charts-cat.js';
import { distAxes, distTexts, layoutDist } from './charts-dist.js';
import { layoutMulti, multiTexts } from './charts-multi.js';
import { layoutReg, regAxes, regTexts } from './charts-reg.js';
import { clusterTexts, layoutCluster } from './charts-cluster.js';
import { layoutCausal, layoutDependency, layoutPert, semnetTexts } from './semnet.js';
export function chartTexts(band, roles) {
    const size = sizeOf(band.labelRole, roles);
    const list = (() => {
        switch (band.kind) {
            case 'waterfall': return waterfallTexts(band.spec);
            case 'tornado': return tornadoTexts(band.spec);
            case 'heatmap': return heatmapTexts(band.spec);
            case 'stacked': return stackedTexts(band.spec);
            case 'radar': return radarTexts(band.spec);
            case 'treemap': return treemapTexts(band.spec);
            case 'sankey': return sankeyTexts(band.spec);
            case 'bubble': return bubbleTexts(band.spec);
            case 'butterfly': return butterflyTexts(band.spec);
            case 'combo': return comboTexts(band.spec);
            case 'harvey': return harveyTexts(band.spec);
            case 'clustermap': return clusterTexts(band.spec);
            case 'regplot': return regTexts(band.spec);
            case 'multiplot': return multiTexts(band.spec);
            case 'distplot': return distTexts(band.spec);
            case 'catplot': return catTexts(band.spec);
            case 'pert':
            case 'causal':
            case 'dependency': return semnetTexts(band.kind, band.spec);
            default: return [];
        }
    })();
    return list.map(([s, weight]) => [s, size, weight, 'sans']);
}
export function layoutChart(band, x, y, w, widthOf, roles, wrap) {
    const size = sizeOf(band.labelRole, roles), width = Math.min(w, band.width ?? w), left = x + (w - width) / 2;
    const g = { x: left, y, w: width, height: band.height, size, widthOf, wrap };
    const part = (() => {
        switch (band.kind) {
            case 'waterfall': return layoutWaterfall(band.spec, g);
            case 'tornado': return layoutTornado(band.spec, g);
            case 'heatmap': return layoutHeatmap(band.spec, g);
            case 'stacked': return layoutStacked(band.spec, g);
            case 'radar': return layoutRadar(band.spec, g);
            case 'treemap': return layoutTreemap(band.spec, g);
            case 'sankey': return layoutSankey(band.spec, g);
            case 'bubble': return layoutBubble(band.spec, g);
            case 'butterfly': return layoutButterfly(band.spec, g);
            case 'combo': return layoutCombo(band.spec, g);
            case 'harvey': return layoutHarvey(band.spec, g);
            case 'clustermap': return layoutCluster(band.spec, g);
            case 'regplot': return layoutReg(band.spec, g);
            case 'multiplot': return layoutMulti(band.spec, g);
            case 'distplot': return layoutDist(band.spec, g);
            case 'catplot': return layoutCat(band.spec, g);
            case 'pert': return layoutPert(band.spec, g);
            case 'causal': return layoutCausal(band.spec, g);
            case 'dependency': return layoutDependency(band.spec, g);
            default: throw new Error(`chart(): unknown kind ${band.kind}`);
        }
    })();
    return { type: 'chart', kind: band.kind, id: band.id, alt: band.alt, size, x: left, y, w: width, ...part, ...(band.reveal === undefined ? {} : { reveal: band.reveal }), ...(band.until === undefined ? {} : { until: band.until }) };
}
/** The value axes a chart band has when it is drawn, for the kinds that can be told to share them (xRange / yRange); undefined for the others. */
export function chartAxes(band) {
    switch (band.kind) {
        case 'distplot': return distAxes(band.spec);
        case 'regplot': return regAxes(band.spec);
        default: return undefined;
    }
}
