import type { Roles, WidthOf, WrapEnv } from './types/core.ts';
import type { BpmnBand, LaidOutBpmn } from './types/diagrams.ts';
export declare function layoutBpmnVertical(band: BpmnBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, env: WrapEnv): LaidOutBpmn;
