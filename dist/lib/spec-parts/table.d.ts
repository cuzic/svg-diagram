import type { PartDef } from '../spec-kit.ts';
export declare function defineTablePart<Result>(builder: (columns: never, rows: never, opts: never) => Result): PartDef<Result>;
