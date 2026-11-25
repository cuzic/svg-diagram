import { MAX_SPEC_PARTS } from './spec-kit.js';
// A name from the CLI can select only these package-owned modules.
export const specPartLoaders = {
    'affinity': () => import('./spec-parts/selective/affinity.js').then(m => m.affinityPart),
    'bars': () => import('./spec-parts/selective/bars.js').then(m => m.barsPart),
    'board': () => import('./spec-parts/selective/board.js').then(m => m.boardPart),
    'bowtie': () => import('./spec-parts/selective/bowtie.js').then(m => m.bowtiePart),
    'boxplot': () => import('./spec-parts/selective/boxplot.js').then(m => m.boxplotPart),
    'bpmn': () => import('./spec-parts/selective/bpmn.js').then(m => m.bpmnPart),
    'bubble': () => import('./spec-parts/selective/bubble.js').then(m => m.bubblePart),
    'burndown': () => import('./spec-parts/selective/burndown.js').then(m => m.burndownPart),
    'burnup': () => import('./spec-parts/selective/burnup.js').then(m => m.burnupPart),
    'butterfly': () => import('./spec-parts/selective/butterfly.js').then(m => m.butterflyPart),
    'causal-loop': () => import('./spec-parts/selective/causal-loop.js').then(m => m.causalLoopPart),
    'cause-tree': () => import('./spec-parts/selective/cause-tree.js').then(m => m.causeTreePart),
    'check-sheet': () => import('./spec-parts/selective/check-sheet.js').then(m => m.checkSheetPart),
    'chevron': () => import('./spec-parts/selective/chevron.js').then(m => m.chevronPart),
    'class-diagram': () => import('./spec-parts/selective/class-diagram.js').then(m => m.classDiagramPart),
    'cloud': () => import('./spec-parts/selective/cloud.js').then(m => m.cloudPart),
    'combo': () => import('./spec-parts/selective/combo.js').then(m => m.comboPart),
    'compare': () => import('./spec-parts/selective/compare.js').then(m => m.comparePart),
    'concentric': () => import('./spec-parts/selective/concentric.js').then(m => m.concentricPart),
    'control-chart': () => import('./spec-parts/selective/control-chart.js').then(m => m.controlChartPart),
    'cycle': () => import('./spec-parts/selective/cycle.js').then(m => m.cyclePart),
    'dependency-network': () => import('./spec-parts/selective/dependency-network.js').then(m => m.dependencyNetworkPart),
    'fault-tree': () => import('./spec-parts/selective/fault-tree.js').then(m => m.faultTreePart),
    'flowchart': () => import('./spec-parts/selective/flowchart.js').then(m => m.flowchartPart),
    'fmea': () => import('./spec-parts/selective/fmea.js').then(m => m.fmeaPart),
    'funnel': () => import('./spec-parts/selective/funnel.js').then(m => m.funnelPart),
    'gantt': () => import('./spec-parts/selective/gantt.js').then(m => m.ganttPart),
    'harvey': () => import('./spec-parts/selective/harvey.js').then(m => m.harveyPart),
    'heatmap': () => import('./spec-parts/selective/heatmap.js').then(m => m.heatmapPart),
    'histogram': () => import('./spec-parts/selective/histogram.js').then(m => m.histogramPart),
    'is-is-not': () => import('./spec-parts/selective/is-is-not.js').then(m => m.isIsNotPart),
    'journey-map': () => import('./spec-parts/selective/journey-map.js').then(m => m.journeyMapPart),
    'lines': () => import('./spec-parts/selective/lines.js').then(m => m.linesPart),
    'matrix': () => import('./spec-parts/selective/matrix.js').then(m => m.matrixPart),
    'mekko': () => import('./spec-parts/selective/mekko.js').then(m => m.mekkoPart),
    'mindmap': () => import('./spec-parts/selective/mindmap.js').then(m => m.mindmapPart),
    'pareto': () => import('./spec-parts/selective/pareto.js').then(m => m.paretoPart),
    'pdpc': () => import('./spec-parts/selective/pdpc.js').then(m => m.pdpcPart),
    'pert': () => import('./spec-parts/selective/pert.js').then(m => m.pertPart),
    'pyramid': () => import('./spec-parts/selective/pyramid.js').then(m => m.pyramidPart),
    'qfd': () => import('./spec-parts/selective/qfd.js').then(m => m.qfdPart),
    'quadrant': () => import('./spec-parts/selective/quadrant.js').then(m => m.quadrantPart),
    'raci': () => import('./spec-parts/selective/raci.js').then(m => m.raciPart),
    'radar': () => import('./spec-parts/selective/radar.js').then(m => m.radarPart),
    'range-bars': () => import('./spec-parts/selective/range-bars.js').then(m => m.rangeBarsPart),
    'relation-diagram': () => import('./spec-parts/selective/relation-diagram.js').then(m => m.relationDiagramPart),
    'sankey': () => import('./spec-parts/selective/sankey.js').then(m => m.sankeyPart),
    'scatter': () => import('./spec-parts/selective/scatter.js').then(m => m.scatterPart),
    'sequence': () => import('./spec-parts/selective/sequence.js').then(m => m.sequencePart),
    'stacked-bars': () => import('./spec-parts/selective/stacked-bars.js').then(m => m.stackedBarsPart),
    'state-diagram': () => import('./spec-parts/selective/state-diagram.js').then(m => m.stateDiagramPart),
    'steps': () => import('./spec-parts/selective/steps.js').then(m => m.stepsPart),
    'strategy-canvas': () => import('./spec-parts/selective/strategy-canvas.js').then(m => m.strategyCanvasPart),
    'swimlane': () => import('./spec-parts/selective/swimlane.js').then(m => m.swimlanePart),
    'table': () => import('./spec-parts/selective/table.js').then(m => m.tablePart),
    'timeline': () => import('./spec-parts/selective/timeline.js').then(m => m.timelinePart),
    'tornado': () => import('./spec-parts/selective/tornado.js').then(m => m.tornadoPart),
    'tree': () => import('./spec-parts/selective/tree.js').then(m => m.treePart),
    'treemap': () => import('./spec-parts/selective/treemap.js').then(m => m.treemapPart),
    'value-chain': () => import('./spec-parts/selective/value-chain.js').then(m => m.valueChainPart),
    'venn': () => import('./spec-parts/selective/venn.js').then(m => m.vennPart),
    'versus': () => import('./spec-parts/selective/versus.js').then(m => m.versusPart),
    'waterfall': () => import('./spec-parts/selective/waterfall.js').then(m => m.waterfallPart),
    'why-why-table': () => import('./spec-parts/selective/why-why-table.js').then(m => m.whyWhyTablePart),
    'why-why-tree': () => import('./spec-parts/selective/why-why-tree.js').then(m => m.whyWhyTreePart),
};
/** Load definitions for the discriminants present in a structurally plausible JSON figure. */
export async function loadSpecPartsFor(figure) {
    const parts = figure?.parts;
    if (!Array.isArray(parts) || parts.length === 0 || parts.length > MAX_SPEC_PARTS)
        return undefined;
    const names = new Set(parts.map(part => part?.type));
    const loaders = [];
    for (const name of names) {
        if (typeof name !== 'string')
            return undefined;
        // JSON preserves the catalog's camelCase names. Package paths use kebab-case.
        const entry = name.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase());
        if (!Object.hasOwn(specPartLoaders, entry))
            return undefined;
        const load = specPartLoaders[entry];
        if (load)
            loaders.push(load);
    }
    return Promise.all(loaders.map(load => load()));
}
