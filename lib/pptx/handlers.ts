import type {ChartKind} from '../charts-base.ts';
import type {LaidOutOf, LaidOutType} from '../band-table.ts';

export type PptxMode = 'native' | 'image';
export interface PptxHandler<B> {mode: PptxMode; readonly _band?: B}

const native = <B>(): PptxHandler<B> => ({mode: 'native'});
const image = <B>(): PptxHandler<B> => ({mode: 'image'});

/** One PPTX disposition per laid-out band type. Missing band types fail compilation. */
export const PPTX_HANDLERS = {
  caption: native(), box: native(), banner: native(), group: native(), row: native(), grid: native(), table: native(),
  legend: image(), swimlane: image(), wireframe: image(), screens: image(), sequence: image(), raw: image(), pyramid: image(),
  curve: image(), plane: image(), quadrant: image(), wordart: image(), chevron: image(), funnel: image(), cycle: image(),
  venn: image(), concentric: image(), bars: image(), chart: image(), image: image(), people: image(), dots: image(), math: image(),
  timeline: image(), tree: image(), states: image(), cause: image(), cloud: image(), gantt: image(), classes: image(), bpmn: image(),
} satisfies {[T in LaidOutType]: PptxHandler<LaidOutOf<T>>};

export type UnhandledPptxBand = Exclude<LaidOutType, keyof typeof PPTX_HANDLERS>;
export const ALL_PPTX_BANDS_HANDLED: UnhandledPptxBand extends never ? true : never = true;

/** Charts are deliberately declared by semantic kind, independently of the `chart` band row above. */
export const PPTX_CHART_HANDLERS = {
  waterfall: 'image', tornado: 'image', heatmap: 'image', stacked: 'image', radar: 'image', treemap: 'image', sankey: 'image',
  catplot: 'image', distplot: 'image', multiplot: 'image', regplot: 'image', clustermap: 'image', bubble: 'image', butterfly: 'image',
  combo: 'image', harvey: 'image', pert: 'image', causal: 'image', dependency: 'image',
} satisfies Record<ChartKind, PptxMode>;

export function pptxDispositionRows(): {band: string; mode: PptxMode}[] {
  const bands = Object.entries(PPTX_HANDLERS).filter(([k]) => k !== 'chart').map(([band, h]) => ({band, mode: h.mode}));
  const charts = Object.entries(PPTX_CHART_HANDLERS).map(([kind, mode]) => ({band: `chart:${kind}`, mode}));
  return [...bands, ...charts].sort((a, b) => a.band.localeCompare(b.band));
}
