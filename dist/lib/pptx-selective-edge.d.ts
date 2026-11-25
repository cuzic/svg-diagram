import { type TextEngine } from './spec-edge-core.ts';
import { type PptxEdgeOptions, type PptxEdgeResult, type FigurePlan } from './pptx-edge-core.ts';
import { prepareSpecLayout } from './spec-selective.ts';
import type { SpecIssue } from './spec-kit.ts';
import { type SelectiveSlideOptions } from './pptx/selective.ts';
export { TextEngineError, type TextEngine } from './spec-edge-core.ts';
export type SelectedFigureOptions = Parameters<typeof prepareSpecLayout>[1] & SelectiveSlideOptions & Pick<PptxEdgeOptions, 'maxHeight'>;
type Options = SelectedFigureOptions & PptxEdgeOptions;
export declare function planSelectedFigureEdge(spec: unknown, engine: TextEngine, opts: SelectedFigureOptions): Promise<FigurePlan | {
    issues: SpecIssue[];
}>;
/** Draw a spec using only the selected parts and PPTX adapters in a portable runtime. */
export declare function renderPptxEdge(spec: unknown, givenEngine: TextEngine, opts: Options): Promise<PptxEdgeResult>;
