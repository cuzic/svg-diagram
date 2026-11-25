import type { TextEngine } from './spec-edge-core.ts';
import { prepareVerifiedSpecRender } from './spec-selective.ts';
export { MAX_EDGE_HEIGHT, TextEngineError } from './spec-edge-core.ts';
export type { TextEngine } from './spec-edge-core.ts';
export type { RenderSpecResult } from './spec-result.ts';
export type { OutlineFont } from './svg-outline.ts';
export { partCatalog, specSchemaFor, validateSpec } from './spec-selective.ts';
/** Draw and outline only the registered spec parts, with a caller-supplied text engine. */
export declare function renderSpecEdge(spec: unknown, givenEngine: TextEngine, options: Parameters<typeof prepareVerifiedSpecRender>[1] & {
    maxHeight?: number;
}): Promise<import("./spec-result.ts").RenderSpecResult>;
