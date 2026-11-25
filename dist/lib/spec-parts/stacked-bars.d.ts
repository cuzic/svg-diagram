import type { StackColumn } from '../charts-stacked.ts';
import type { PartDef } from '../spec-kit.ts';
export declare function defineStackedBarsPart<Result>(builder: (columns: readonly StackColumn[], opts: never) => Result): PartDef<Result>;
