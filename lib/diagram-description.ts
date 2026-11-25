import {fmt} from './axis-ticks.ts';
import {visibleAt} from './reveal-visibility.ts';
import type {BarsBand} from './types/bars.ts';
import type {Band} from './types/index.ts';
import type {SequenceBand, SwimlaneBand, TableBand} from './types/sequence-table-swimlane.ts';

export const oneLine = (t: unknown): string => String(t ?? '').replace(/\s*\n\s*/g, ' ').trim();

/** Values are on neither a label nor a scale: the figure alone cannot be read for them. */
export const barsValuesHidden = (band: BarsBand): boolean => band.labels !== undefined && band.labels !== 'all' && band.axis === false;

/** Screen-reader values for bars without either value labels or a scale. */
export function hiddenBarsDescription(b: BarsBand, stage?: number): string {
  return barsValuesHidden(b) ? `値: ${b.data.filter(x => visibleAt(x, stage)).map(x => `${oneLine(x.label)} ${x.range ? `${fmt(x.range[0])}〜${fmt(x.range[1])}` : fmt(x.value ?? 0)}${b.unit ?? ''}`).join('、')}` : '';
}

export type BandDescription = readonly [section: 'structure' | 'box' | 'image' | 'math' | 'values' | 'chart', text: string];

export const describeTable = (band: TableBand): string =>
  `表${band.title ? `「${oneLine(band.title)}」` : ''}: 列 ${band.columns.map(column => oneLine(column.label)).join('、')}`;
export const describeSequence = (band: SequenceBand): string =>
  `参加者: ${band.actors.map(actor => oneLine(actor.label)).join('、')}`;
export function describeSwimlane(band: SwimlaneBand, stage?: number): string {
  const lanes = band.lanes.map(lane => oneLine(lane.label)).join('、');
  const steps = band.steps.filter(step => visibleAt(step, stage)).map(step => oneLine(step.title)).join('、');
  return `レーン: ${lanes}。手順: ${steps}`;
}

/** Group accessible descriptions in reading order, using box titles as a fallback. */
export function joinBandDescriptions(parts: Iterable<BandDescription>): string {
  const sections: Record<BandDescription[0], string[]> = {structure: [], box: [], image: [], math: [], values: [], chart: []};
  for (const [section, text] of parts) sections[section].push(text);
  const {structure, box, image, math, values, chart} = sections;
  const first = structure.length ? structure : box.length ? [`要素: ${box.slice(0, 16).join('、')}${box.length > 16 ? ' ほか' : ''}`] : [];
  return [...first, ...image, ...math, ...values, ...chart].join('。');
}

/** The complete renderer uses the original band model. */
export function describeBands(all: Band[], stage?: number): string {
  const parts: BandDescription[] = [];
  for (const band of all) {
    if (band.type === 'image' && band.alt) parts.push(['image', `画像: ${oneLine(band.alt)}`]);
    if (band.type === 'math') parts.push(['math', `数式: ${oneLine(band.alt)}`]);
    if (!visibleAt(band, stage)) continue;
    if (band.type === 'swimlane') parts.push(['structure', describeSwimlane(band, stage)]);
    else if (band.type === 'sequence') parts.push(['structure', describeSequence(band)]);
    else if (band.type === 'table') parts.push(['structure', describeTable(band)]);
    else if (band.type === 'box' && band.title) parts.push(['box', oneLine(band.title)]);
    else if (band.type === 'bars' && barsValuesHidden(band)) parts.push(['values', hiddenBarsDescription(band, stage)]);
    else if (band.type === 'chart') parts.push(['chart', oneLine(band.alt)]);
  }
  return joinBandDescriptions(parts);
}
