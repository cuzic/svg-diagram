import type { NodeLines } from './tree.ts';
import type { FontFamily, Roles, WidthOf, WrapEnv } from './types/core.ts';
import type { BpmnBand, BpmnNodeKind, LaidOutBpmn } from './types/diagrams.ts';
export declare const lineH: (s: number) => number;
export declare const isEvent: (k: BpmnNodeKind) => boolean;
export declare const isGate: (k: BpmnNodeKind) => boolean;
export declare const BPMN_KINDS: readonly ['task', 'start', 'end', 'xor', 'and', 'or'];
/** ADR 0054: a node's part, named by what it is (a task, an event, a gateway). */
export declare const nodePart: (id: string, kind: BpmnNodeKind, label: string) => string;
export declare function bpmnTexts(band: BpmnBand, roles: Roles): [string, number, number, FontFamily][];
/** The checks both directions share: lane ids, node ids and kinds, flows between known nodes, no flow into a start or out of an end. */
export declare function checkBpmnInput(band: BpmnBand): {
    laneIdx: Map<string, number>;
    kindOf: Map<string, BpmnNodeKind>;
};
/** The size of each node (the shape; an event / gateway label hangs below it, or beside it in a vertical flow: `extent` is for the horizontal layout). */
export interface BpmnMeasure {
    w: number;
    h: number;
    lines?: NodeLines;
    label: string[];
    extent: number;
}
export declare function measureBpmnNodes(band: BpmnBand, kindOf: ReadonlyMap<string, BpmnNodeKind>, taskMax: number, widthOf: WidthOf, roles: Roles, env: WrapEnv): Map<string, BpmnMeasure>;
export declare function layoutBpmn(band: BpmnBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, env: WrapEnv): LaidOutBpmn;
