import type { PartDef } from '../spec-kit.ts';
export declare function defineSwimlanePart<Result extends readonly {
    type: string;
    cols?: number;
}[]>(builder: (lanes: never, steps: never, opts: never) => Result): PartDef<Result>;
