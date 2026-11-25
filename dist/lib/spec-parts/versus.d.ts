import type { PartDef } from '../spec-kit.ts';
export declare function defineVersusPart<Result>(builder: (left: never, right: never, opts?: {
    shared: never;
    connectLabels?: {
        left?: string;
        right?: string;
    };
}) => Result, box: (opts: never) => unknown): PartDef<Result>;
