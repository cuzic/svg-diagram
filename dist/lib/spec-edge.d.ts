import type { RenderSpecResult } from './spec-result.ts';
import type { TextEngine } from './spec-edge-core.ts';
export { guardedEngine, MAX_EDGE_HEIGHT, missingIssues, TextEngineError } from './spec-edge-core.ts';
export type { TextEngine } from './spec-edge-core.ts';
export type { OutlineFont } from './svg-outline.ts';
export type { RenderSpecResult } from './spec-result.ts';
/**
 * Draw and check a spec, and turn its text into outlines. A bad spec, a figure that does not fit, or a character the font lacks comes back in the
 * result, with its place. A failure of the engine that was handed in throws TextEngineError.
 */
export declare function renderSpecEdge(spec: unknown, givenEngine: TextEngine, opts?: {
    maxHeight?: number;
}): Promise<RenderSpecResult>;
