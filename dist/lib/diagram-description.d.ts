import type { BarsBand } from './types/bars.ts';
import type { Band } from './types/index.ts';
import type { SequenceBand, SwimlaneBand, TableBand } from './types/sequence-table-swimlane.ts';
export declare const oneLine: (t: unknown) => string;
/** Values are on neither a label nor a scale: the figure alone cannot be read for them. */
export declare const barsValuesHidden: (band: BarsBand) => boolean;
/** Screen-reader values for bars without either value labels or a scale. */
export declare function hiddenBarsDescription(b: BarsBand, stage?: number): string;
export type BandDescription = readonly [section: 'structure' | 'box' | 'image' | 'math' | 'values' | 'chart', text: string];
export declare const describeTable: (band: TableBand) => string;
export declare const describeSequence: (band: SequenceBand) => string;
export declare function describeSwimlane(band: SwimlaneBand, stage?: number): string;
/** Group accessible descriptions in reading order, using box titles as a fallback. */
export declare function joinBandDescriptions(parts: Iterable<BandDescription>): string;
/** The complete renderer uses the original band model. */
export declare function describeBands(all: Band[], stage?: number): string;
