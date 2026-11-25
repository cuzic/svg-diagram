import type { PartDef } from '../spec-kit.ts';
export declare function defineWaterfallPart<Result>(builder: (steps: never, opts: never) => Result): PartDef<Result>;
