import type { Diagram, DiagramData } from '../types/core.ts';
import type { RenderResult, CheckResult } from '../types/verdicts.ts';
type RenderOptions = {
    name: string;
    budget: 'measure' | 'cacheOnly';
    html?: boolean; /** `data-node="id"` on the outline of each author-named node (ADR 0034) */
    nodeIds?: boolean;
};
export declare function renderDiagram(input: Diagram, opts: RenderOptions): Promise<RenderResult>;
export declare function checkDiagram(input: DiagramData): Promise<CheckResult>;
export {};
