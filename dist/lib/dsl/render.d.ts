import type { Diagram, DiagramData } from '../types/core.ts';
import type { RenderResult, CheckResult } from '../types/verdicts.ts';
export declare function renderDiagram(input: Diagram, opts: {
    name: string;
    budget: 'measure' | 'cacheOnly';
    html?: boolean; /** `data-node="id"` on the outline of each author-named node (ADR 0034) */
    nodeIds?: boolean;
}): Promise<RenderResult>;
export declare function checkDiagram(input: DiagramData): Promise<CheckResult>;
