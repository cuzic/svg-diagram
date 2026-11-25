import type { PartDef } from '../spec-kit.ts';
export declare function defineWhyWhyTreePart<Result>(builder: (problem: string, whys: never, opts: {
    readingNote?: boolean;
}) => Result): PartDef<Result>;
