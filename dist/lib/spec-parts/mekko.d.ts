import type { PartDef } from '../spec-kit.ts';
import type { StackedOpts } from '../charts-stacked.ts';
type MekkoOptions = Omit<StackedOpts, 'percent'>;
export declare function defineMekkoPart<Result>(builder: (columns: never, opts: MekkoOptions) => Result): PartDef<Result>;
export {};
