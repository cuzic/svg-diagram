import type { FontFamily, Roles, WidthOf, WrapEnv } from './types/core.ts';
import type { BpmnBand, LaidOutBpmn } from './types/diagrams.ts';
export declare const BPMN_KINDS: readonly ['task', 'start', 'end', 'xor', 'and', 'or'];
export declare function bpmnTexts(band: BpmnBand, roles: Roles): [string, number, number, FontFamily][];
export declare function layoutBpmn(band: BpmnBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, env: WrapEnv): LaidOutBpmn;
