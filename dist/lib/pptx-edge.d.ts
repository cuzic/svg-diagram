import { type SpecIssue } from './spec.ts';
import { type TextEngine } from './spec-edge.ts';
import { type PptxEdgeOptions, type PptxEdgeResult, type FigurePlan } from './pptx-edge-core.ts';
export { zipPackage, type PptxEdgeOptions, type PptxEdgeResult, type FigurePlan } from './pptx-edge-core.ts';
export type { TextEngine } from './spec-edge.ts';
export { TextEngineError } from './spec-edge.ts';
/** The spec as a slide plan, or the issues that stop it (with their places in the spec). Throws TextEngineError as renderPptxEdge does. */
export declare function planFigureEdge(spec: unknown, engine: TextEngine, opts?: {
    font?: string;
    maxHeight?: number;
}): Promise<FigurePlan | {
    issues: SpecIssue[];
}>;
/**
 * The spec as a .pptx. A bad spec or a figure that cannot be laid out comes back as issues; a failure of the engine that was handed in
 * throws TextEngineError, and one of `rasterize` throws as it is. The drawing's own checks are renderSpecEdge's: run that first.
 */
export declare function renderPptxEdge(spec: unknown, givenEngine: TextEngine, opts: PptxEdgeOptions): Promise<PptxEdgeResult>;
