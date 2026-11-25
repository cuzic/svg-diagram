import { DEF } from './band-def.js';
import { walkBands } from './legend-notation.js';
import { areasDefinition } from './bands/areas.js';
import { bannerDefinition } from './bands/banner.js';
import { barsDefinition } from './bands/bars.js';
import { bowtieDefinition } from './bands/bowtie.js';
import { boxDefinition } from './bands/box.js';
import { bpmnDefinition } from './bands/bpmn.js';
import { bubbleDefinition } from './bands/bubble.js';
import { butterflyDefinition } from './bands/butterfly.js';
import { captionDefinition } from './bands/caption.js';
import { catplotDefinition } from './bands/catplot.js';
import { causalDefinition } from './bands/causal.js';
import { causeDefinition } from './bands/cause.js';
import { chevronDefinition } from './bands/chevron.js';
import { classesDefinition } from './bands/classes.js';
import { cloudDefinition } from './bands/cloud.js';
import { clustermapDefinition } from './bands/clustermap.js';
import { comboDefinition } from './bands/combo.js';
import { comicDefinition } from './bands/comic.js';
import { compareDefinition } from './bands/compare.js';
import { concentricDefinition } from './bands/concentric.js';
import { connectDefinition } from './bands/connect.js';
import { curveDefinition } from './bands/curve.js';
import { cycleDefinition } from './bands/cycle.js';
import { dependencyDefinition } from './bands/dependency.js';
import { distplotDefinition } from './bands/distplot.js';
import { dotsDefinition } from './bands/dots.js';
import { emblemDefinition } from './bands/emblem.js';
import { ftaDefinition } from './bands/fta.js';
import { funnelDefinition } from './bands/funnel.js';
import { ganttDefinition } from './bands/gantt.js';
import { gridDefinition } from './bands/grid.js';
import { groupDefinition } from './bands/group.js';
import { groupRowDefinition } from './bands/group-row.js';
import { harveyDefinition } from './bands/harvey.js';
import { heatmapDefinition } from './bands/heatmap.js';
import { imageDefinition } from './bands/image.js';
import { legendDefinition } from './bands/legend.js';
import { multiplotDefinition } from './bands/multiplot.js';
import { peopleDefinition } from './bands/people.js';
import { pertDefinition } from './bands/pert.js';
import { planeDefinition } from './bands/plane.js';
import { pyramidDefinition } from './bands/pyramid.js';
import { quadrantDefinition } from './bands/quadrant.js';
import { radarDefinition } from './bands/radar.js';
import { rawDefinition } from './bands/raw.js';
import { regplotDefinition } from './bands/regplot.js';
import { rowDefinition } from './bands/row.js';
import { sankeyDefinition } from './bands/sankey.js';
import { screenGridDefinition, stateMatrixDefinition } from './bands/screens.js';
import { sequenceDefinition } from './bands/sequence.js';
import { spacerDefinition } from './bands/spacer.js';
import { stackedDefinition } from './bands/stacked.js';
import { statesDefinition } from './bands/states.js';
import { statusDefinition } from './bands/status.js';
import { swimlaneDefinition } from './bands/swimlane.js';
import { tableDefinition } from './bands/table.js';
import { timelineDefinition } from './bands/timeline.js';
import { tornadoDefinition } from './bands/tornado.js';
import { treeDefinition } from './bands/tree.js';
import { treemapDefinition } from './bands/treemap.js';
import { valueChainDefinition } from './bands/value-chain.js';
import { vennDefinition } from './bands/venn.js';
import { waterfallDefinition } from './bands/waterfall.js';
import { wireframeDefinition } from './bands/wireframe.js';
import { wordartDefinition } from './bands/wordart.js';
import { mathDefinition } from './math-band-definition.js';
const chartDefinitions = {
    bubble: bubbleDefinition,
    butterfly: butterflyDefinition,
    catplot: catplotDefinition,
    causal: causalDefinition,
    clustermap: clustermapDefinition,
    combo: comboDefinition,
    compare: compareDefinition,
    dependency: dependencyDefinition,
    distplot: distplotDefinition,
    harvey: harveyDefinition,
    heatmap: heatmapDefinition,
    multiplot: multiplotDefinition,
    pert: pertDefinition,
    radar: radarDefinition,
    regplot: regplotDefinition,
    sankey: sankeyDefinition,
    stacked: stackedDefinition,
    tornado: tornadoDefinition,
    treemap: treemapDefinition,
    waterfall: waterfallDefinition,
};
// Any omitted band needs a reason here. The remaining Band types are required in the table below.
export const UNDEFINED_BANDS = {};
export const FULL_DEFINITIONS = {
    areas: areasDefinition,
    banner: bannerDefinition,
    bars: barsDefinition,
    bowtie: bowtieDefinition,
    box: boxDefinition,
    bpmn: bpmnDefinition,
    caption: captionDefinition,
    cause: causeDefinition,
    chart: data => chartDefinitions[data.kind],
    chevron: chevronDefinition,
    classes: classesDefinition,
    cloud: cloudDefinition,
    comic: comicDefinition,
    concentric: concentricDefinition,
    connect: connectDefinition,
    curve: curveDefinition,
    cycle: cycleDefinition,
    dots: dotsDefinition,
    emblem: emblemDefinition,
    fta: ftaDefinition,
    funnel: funnelDefinition,
    gantt: ganttDefinition,
    grid: gridDefinition,
    group: groupDefinition,
    grouprow: groupRowDefinition,
    image: imageDefinition,
    legend: legendDefinition,
    math: mathDefinition,
    people: peopleDefinition,
    plane: planeDefinition,
    pyramid: pyramidDefinition,
    quadrant: quadrantDefinition,
    raw: rawDefinition,
    row: rowDefinition,
    screens: data => data.matrix || ('layoutKind' in data && data.layoutKind === 'matrix') ? stateMatrixDefinition : screenGridDefinition, // a placed band keeps its layout kind
    sequence: sequenceDefinition,
    spacer: spacerDefinition,
    states: statesDefinition,
    status: statusDefinition,
    swimlane: swimlaneDefinition,
    table: tableDefinition,
    timeline: timelineDefinition,
    tree: treeDefinition,
    valueChain: valueChainDefinition,
    venn: vennDefinition,
    wireframe: wireframeDefinition,
    wordart: wordartDefinition,
};
/** @internal Resolve a band against the full set of built-in definitions. */
export function definitionFor(data) {
    const table = FULL_DEFINITIONS;
    const entry = table[data.type];
    return typeof entry === 'function' ? entry(data) : entry;
}
/** The definition a band carries, or else the built-in one of its type: plain data from the all-in-one builders has none until it is rendered. */
export const definitionOfBand = (band) => band[DEF] ?? definitionFor(band);
/** Every band, nested ones included, of plain data or of bands that carry their definitions. */
export const walkAnyBands = (bands, out = []) => walkBands(bands, out, definitionOfBand);
