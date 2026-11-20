import type { DiagramData, Roles, WidthOf } from './types/core.ts';
import type { LaidOutDiagram } from './types/index.ts';
/** Pass 2, synchronous: lay the diagram out with the widths already measured. */
export declare function layoutWith(data: DiagramData, roles: Roles, widthOf: WidthOf): LaidOutDiagram;
