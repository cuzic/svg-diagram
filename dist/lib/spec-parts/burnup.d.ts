import type { PartDef } from '../spec-kit.ts';
export declare function defineBurnupPart<Result>(builder: (spec: never, opts: never) => Result, lines: (series: never, opts: never) => Result): PartDef<Result>;
