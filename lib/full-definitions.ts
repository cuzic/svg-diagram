// The full renderer may import every built-in definition. Selective entries must keep this table out of their dependency graph.
import type {BandDef} from './band-def.ts';
import {DEF} from './band-def.ts';
import {walkBands} from './legend-notation.ts';
import {areasDefinition} from './bands/areas.ts';
import {bannerDefinition} from './bands/banner.ts';
import {barsDefinition} from './bands/bars.ts';
import {bowtieDefinition} from './bands/bowtie.ts';
import {boxDefinition} from './bands/box.ts';
import {bubbleDefinition} from './bands/bubble.ts';
import {butterflyDefinition} from './bands/butterfly.ts';
import {captionDefinition} from './bands/caption.ts';
import {catplotDefinition} from './bands/catplot.ts';
import {causalDefinition} from './bands/causal.ts';
import {causeDefinition} from './bands/cause.ts';
import {chevronDefinition} from './bands/chevron.ts';
import {classesDefinition} from './bands/classes.ts';
import {cloudDefinition} from './bands/cloud.ts';
import {clustermapDefinition} from './bands/clustermap.ts';
import {comboDefinition} from './bands/combo.ts';
import {chatDefinition} from './bands/chat.ts';
import {comicDefinition} from './bands/comic.ts';
import {compareDefinition} from './bands/compare.ts';
import {concentricDefinition} from './bands/concentric.ts';
import {connectDefinition} from './bands/connect.ts';
import {curveDefinition} from './bands/curve.ts';
import {cycleDefinition} from './bands/cycle.ts';
import {dependencyDefinition} from './bands/dependency.ts';
import {distplotDefinition} from './bands/distplot.ts';
import {dotsDefinition} from './bands/dots.ts';
import {emblemDefinition} from './bands/emblem.ts';
import {ftaDefinition} from './bands/fta.ts';
import {funnelDefinition} from './bands/funnel.ts';
import {ganttDefinition} from './bands/gantt.ts';
import {gridDefinition} from './bands/grid.ts';
import {groupDefinition} from './bands/group.ts';
import {groupRowDefinition} from './bands/group-row.ts';
import {harveyDefinition} from './bands/harvey.ts';
import {heatmapDefinition} from './bands/heatmap.ts';
import {imageDefinition} from './bands/image.ts';
import {legendDefinition} from './bands/legend.ts';
import {multiplotDefinition} from './bands/multiplot.ts';
import {peopleDefinition} from './bands/people.ts';
import {pertDefinition} from './bands/pert.ts';
import {planeDefinition} from './bands/plane.ts';
import {pyramidDefinition} from './bands/pyramid.ts';
import {quadrantDefinition} from './bands/quadrant.ts';
import {radarDefinition} from './bands/radar.ts';
import {rawDefinition} from './bands/raw.ts';
import {regplotDefinition} from './bands/regplot.ts';
import {rowDefinition} from './bands/row.ts';
import {sankeyDefinition} from './bands/sankey.ts';
import {screenGridDefinition, stateMatrixDefinition} from './bands/screens.ts';
import {sequenceDefinition} from './bands/sequence.ts';
import {spacerDefinition} from './bands/spacer.ts';
import {stackedDefinition} from './bands/stacked.ts';
import {statesDefinition} from './bands/states.ts';
import {statusDefinition} from './bands/status.ts';
import {swimlaneAutoDefinition, swimlaneDefinition} from './bands/swimlane.ts';
import {tableDefinition} from './bands/table.ts';
import {timelineDefinition} from './bands/timeline.ts';
import {tornadoDefinition} from './bands/tornado.ts';
import {forestDefinition} from './bands/forest.ts';
import {treeDefinition} from './bands/tree.ts';
import {treemapDefinition} from './bands/treemap.ts';
import {valueChainDefinition} from './bands/value-chain.ts';
import {vennDefinition} from './bands/venn.ts';
import {waterfallDefinition} from './bands/waterfall.ts';
import {wireframeDefinition} from './bands/wireframe.ts';
import {wordartDefinition} from './bands/wordart.ts';
import {mathDefinition} from './math-band-definition.ts';
import type {Band} from './types/index.ts';

type BandOf<T extends Band['type']> = Extract<Band, {type: T}>;
type DefinitionEntry<T extends Band['type']> = BandDef<BandOf<T>, object> | ((data: BandOf<T>) => BandDef<BandOf<T>, object>);

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
  forest: forestDefinition,
  treemap: treemapDefinition,
  waterfall: waterfallDefinition,
} satisfies Record<BandOf<'chart'>['kind'], BandDef<BandOf<'chart'>, object>>;

// Any omitted band needs a reason here. The remaining Band types are required in the table below.
export const UNDEFINED_BANDS = {} satisfies Partial<Record<Band['type'], string>>;

type FullDefinitions = {[T in Exclude<Band['type'], keyof typeof UNDEFINED_BANDS>]: DefinitionEntry<T>};

export const FULL_DEFINITIONS: FullDefinitions = {
  areas: areasDefinition,
  banner: bannerDefinition,
  bars: barsDefinition,
  bowtie: bowtieDefinition,
  box: boxDefinition,
  bpmn: swimlaneAutoDefinition,
  caption: captionDefinition,
  cause: causeDefinition,
  chart: data => chartDefinitions[data.kind],
  chevron: chevronDefinition,
  classes: classesDefinition,
  cloud: cloudDefinition,
  chat: chatDefinition,
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
export function definitionFor(data: Band): BandDef<never, object> | undefined {
  const table: Partial<Record<Band['type'], BandDef<never, object> | ((data: never) => BandDef<never, object>)>> = FULL_DEFINITIONS;
  const entry = table[data.type];
  return typeof entry === 'function' ? entry(data as never) : entry;
}

/** The definition a band carries, or else the built-in one of its type: plain data from the all-in-one builders has none until it is rendered. */
export const definitionOfBand = (band: Band): BandDef | undefined => (band as {[DEF]?: BandDef})[DEF] ?? definitionFor(band);

/** Every band, nested ones included, of plain data or of bands that carry their definitions. */
export const walkAnyBands = (bands: Band[], out: Band[] = []): Band[] => walkBands(bands, out, definitionOfBand);
