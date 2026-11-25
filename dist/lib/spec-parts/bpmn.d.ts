import type { PartDef } from '../spec-kit.ts';
export declare function defineBpmnPart<Result>(builder: (lanes: never, nodes: never, flows: never, opts: {
    fit: 'shrink';
}) => Result): PartDef<Result>;
