import type {LaidOutBand} from './types/index.ts';
import type {WrappedRun} from './types/text-bands.ts';

type TextSizes<B> = (band: B) => Iterable<number>;

export const sizesOf = (xs: readonly {size: number}[]): number[] => xs.map(x => x.size);
const runSizes = (runs: readonly WrappedRun[]): number[] => runs.map(r => r.size);
/** A band's own text runs (what box / caption / banner carry); any band that has them. */
export const ownRunSizes = (band: LaidOutBand): number[] => 'wrappedRuns' in band ? runSizes(band.wrappedRuns) : [];
export const childRuns = (band: {children: readonly {wrappedRuns: WrappedRun[]}[]}): number[] => band.children.flatMap(c => runSizes(c.wrappedRuns));
export const texts: TextSizes<{texts: readonly {size: number}[]}> = band => sizesOf(band.texts);
export const textsAndLabels: TextSizes<{texts: readonly {size: number}[]; labels: readonly {size: number}[]}> = band => [...sizesOf(band.texts), ...sizesOf(band.labels)];
