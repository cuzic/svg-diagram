import { prepareVerifiedSpecRender } from './spec-selective.ts';
import type { FontSpecs } from './types/project.ts';
export { MAX_FIGURE_HEIGHT } from './spec-node-result.ts';
export type { RenderSpecResult } from './spec-result.ts';
export { partCatalog, specSchemaFor, validateSpec } from './spec-selective.ts';
/** Render and verify registered spec parts using the Node font backend. */
export declare function renderSpec(spec: unknown, options: Parameters<typeof prepareVerifiedSpecRender>[1] & {
    fonts?: FontSpecs;
    maxHeight?: number;
}): Promise<import("./spec-result.ts").RenderSpecResult>;
