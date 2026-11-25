import type { LaidOutDiagram } from './types/index.ts';
import type { CheckRect, Issue } from './types/verdicts.ts';
export declare function checkConnectionGeometry(diagram: LaidOutDiagram, rects: CheckRect[]): Issue[];
