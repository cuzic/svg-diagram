import {MAX_SPEC_PARTS} from './spec-kit.ts';
import type {SelectedPart} from './spec-selective.ts';

// A name from the CLI can select only these package-owned modules.
export const specPartLoaders: Readonly<Record<string, () => Promise<SelectedPart>>> = {
  'affinity': () => import('./spec-parts/selective/affinity.ts').then(m => m.affinityPart),
  'bars': () => import('./spec-parts/selective/bars.ts').then(m => m.barsPart),
  'board': () => import('./spec-parts/selective/board.ts').then(m => m.boardPart),
  'bowtie': () => import('./spec-parts/selective/bowtie.ts').then(m => m.bowtiePart),
  'boxplot': () => import('./spec-parts/selective/boxplot.ts').then(m => m.boxplotPart),
  'bpmn': () => import('./spec-parts/selective/bpmn.ts').then(m => m.bpmnPart),
  'bubble': () => import('./spec-parts/selective/bubble.ts').then(m => m.bubblePart),
  'burndown': () => import('./spec-parts/selective/burndown.ts').then(m => m.burndownPart),
  'burnup': () => import('./spec-parts/selective/burnup.ts').then(m => m.burnupPart),
  'butterfly': () => import('./spec-parts/selective/butterfly.ts').then(m => m.butterflyPart),
  'causal-loop': () => import('./spec-parts/selective/causal-loop.ts').then(m => m.causalLoopPart),
  'cause-tree': () => import('./spec-parts/selective/cause-tree.ts').then(m => m.causeTreePart),
  'check-sheet': () => import('./spec-parts/selective/check-sheet.ts').then(m => m.checkSheetPart),
  'chevron': () => import('./spec-parts/selective/chevron.ts').then(m => m.chevronPart),
  'class-diagram': () => import('./spec-parts/selective/class-diagram.ts').then(m => m.classDiagramPart),
  'cloud': () => import('./spec-parts/selective/cloud.ts').then(m => m.cloudPart),
  'combo': () => import('./spec-parts/selective/combo.ts').then(m => m.comboPart),
  'compare': () => import('./spec-parts/selective/compare.ts').then(m => m.comparePart),
  'concentric': () => import('./spec-parts/selective/concentric.ts').then(m => m.concentricPart),
  'control-chart': () => import('./spec-parts/selective/control-chart.ts').then(m => m.controlChartPart),
  'cycle': () => import('./spec-parts/selective/cycle.ts').then(m => m.cyclePart),
  'decision-ladder': () => import('./spec-parts/selective/decision-ladder.ts').then(m => m.decisionLadderPart),
  'dependency-network': () => import('./spec-parts/selective/dependency-network.ts').then(m => m.dependencyNetworkPart),
  'fault-tree': () => import('./spec-parts/selective/fault-tree.ts').then(m => m.faultTreePart),
  'flowchart': () => import('./spec-parts/selective/flowchart.ts').then(m => m.flowchartPart),
  'fmea': () => import('./spec-parts/selective/fmea.ts').then(m => m.fmeaPart),
  'funnel': () => import('./spec-parts/selective/funnel.ts').then(m => m.funnelPart),
  'gantt': () => import('./spec-parts/selective/gantt.ts').then(m => m.ganttPart),
  'harvey': () => import('./spec-parts/selective/harvey.ts').then(m => m.harveyPart),
  'heatmap': () => import('./spec-parts/selective/heatmap.ts').then(m => m.heatmapPart),
  'histogram': () => import('./spec-parts/selective/histogram.ts').then(m => m.histogramPart),
  'is-is-not': () => import('./spec-parts/selective/is-is-not.ts').then(m => m.isIsNotPart),
  'journey-map': () => import('./spec-parts/selective/journey-map.ts').then(m => m.journeyMapPart),
  'lines': () => import('./spec-parts/selective/lines.ts').then(m => m.linesPart),
  'matrix': () => import('./spec-parts/selective/matrix.ts').then(m => m.matrixPart),
  'mekko': () => import('./spec-parts/selective/mekko.ts').then(m => m.mekkoPart),
  'mindmap': () => import('./spec-parts/selective/mindmap.ts').then(m => m.mindmapPart),
  'pareto': () => import('./spec-parts/selective/pareto.ts').then(m => m.paretoPart),
  'pdpc': () => import('./spec-parts/selective/pdpc.ts').then(m => m.pdpcPart),
  'pert': () => import('./spec-parts/selective/pert.ts').then(m => m.pertPart),
  'pyramid': () => import('./spec-parts/selective/pyramid.ts').then(m => m.pyramidPart),
  'qfd': () => import('./spec-parts/selective/qfd.ts').then(m => m.qfdPart),
  'quadrant': () => import('./spec-parts/selective/quadrant.ts').then(m => m.quadrantPart),
  'raci': () => import('./spec-parts/selective/raci.ts').then(m => m.raciPart),
  'radar': () => import('./spec-parts/selective/radar.ts').then(m => m.radarPart),
  'range-bars': () => import('./spec-parts/selective/range-bars.ts').then(m => m.rangeBarsPart),
  'relation-diagram': () => import('./spec-parts/selective/relation-diagram.ts').then(m => m.relationDiagramPart),
  'sankey': () => import('./spec-parts/selective/sankey.ts').then(m => m.sankeyPart),
  'scatter': () => import('./spec-parts/selective/scatter.ts').then(m => m.scatterPart),
  'sequence': () => import('./spec-parts/selective/sequence.ts').then(m => m.sequencePart),
  'stacked-bars': () => import('./spec-parts/selective/stacked-bars.ts').then(m => m.stackedBarsPart),
  'state-diagram': () => import('./spec-parts/selective/state-diagram.ts').then(m => m.stateDiagramPart),
  'steps': () => import('./spec-parts/selective/steps.ts').then(m => m.stepsPart),
  'strategy-canvas': () => import('./spec-parts/selective/strategy-canvas.ts').then(m => m.strategyCanvasPart),
  'swimlane': () => import('./spec-parts/selective/swimlane.ts').then(m => m.swimlanePart),
  'table': () => import('./spec-parts/selective/table.ts').then(m => m.tablePart),
  'timeline': () => import('./spec-parts/selective/timeline.ts').then(m => m.timelinePart),
  'forest': () => import('./spec-parts/selective/forest.ts').then(m => m.forestPart),
  'tornado': () => import('./spec-parts/selective/tornado.ts').then(m => m.tornadoPart),
  'tree': () => import('./spec-parts/selective/tree.ts').then(m => m.treePart),
  'treemap': () => import('./spec-parts/selective/treemap.ts').then(m => m.treemapPart),
  'value-chain': () => import('./spec-parts/selective/value-chain.ts').then(m => m.valueChainPart),
  'venn': () => import('./spec-parts/selective/venn.ts').then(m => m.vennPart),
  'versus': () => import('./spec-parts/selective/versus.ts').then(m => m.versusPart),
  'waterfall': () => import('./spec-parts/selective/waterfall.ts').then(m => m.waterfallPart),
  'why-why-table': () => import('./spec-parts/selective/why-why-table.ts').then(m => m.whyWhyTablePart),
  'why-why-tree': () => import('./spec-parts/selective/why-why-tree.ts').then(m => m.whyWhyTreePart),
};

/** Load definitions for the discriminants present in a structurally plausible JSON figure. */
export async function loadSpecPartsFor(figure: unknown): Promise<SelectedPart[] | undefined> {
  const parts = (figure as {parts?: unknown} | null)?.parts;
  if (!Array.isArray(parts) || parts.length === 0 || parts.length > MAX_SPEC_PARTS) return undefined;
  const names = new Set(parts.map(part => (part as {type?: unknown} | null)?.type));
  const loaders: (() => Promise<SelectedPart>)[] = [];
  for (const name of names) {
    if (typeof name !== 'string') return undefined;
    // JSON preserves the catalog's camelCase names. Package paths use kebab-case.
    const entry = name.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase());
    if (!Object.hasOwn(specPartLoaders, entry)) return undefined;
    const load = specPartLoaders[entry];
    if (load) loaders.push(load);
  }
  return Promise.all(loaders.map(load => load()));
}
