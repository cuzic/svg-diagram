import type { FontBox } from './emit-html.ts';
import type { DiagramData } from './types/core.ts';
import type { LaidOutDiagram } from './types/index.ts';
import type { Verdict } from './types/verdicts.ts';
/** A pass over the band tree before layout (it may mutate and returns the tree to hand on). */
export interface PreLayoutStage {
    name: string;
    run(d: DiagramData): DiagramData;
}
/** A pass over the laid-out tree before it is verified and drawn. */
export interface PostLayoutStage {
    name: string;
    run(d: LaidOutDiagram): LaidOutDiagram;
}
export declare const PRE_LAYOUT_STAGES: readonly PreLayoutStage[];
export declare const POST_LAYOUT_STAGES: readonly PostLayoutStage[];
/** Every stage in run order, layout / verify / emit / xml included: test/pipeline.test.ts pins it. */
export declare const PIPELINE_ORDER: readonly [...string[], "verify", "emit", "xml"];
/** Run the pre-layout passes in order. */
export declare function runPreLayout(d: DiagramData): DiagramData;
/** Run the post-layout passes in order. */
export declare function runPostLayout(laidOut: LaidOutDiagram): LaidOutDiagram;
/**
 * Pre-layout passes, then `layout` (the caller's: it owns the slide budget and the fill / font-scale search, which write into
 * the prepared tree before laying out), then the post-layout passes, then verify. Verify is last because it judges exactly what
 * emit will draw.
 */
export declare function runChecked(d: DiagramData, layout: (prepared: DiagramData) => Promise<LaidOutDiagram>): Promise<{
    laidOut: LaidOutDiagram;
    verdict: Verdict;
}>;
export interface Emitted {
    svg: string;
    html?: string;
    xml: string[];
}
/** Emit the final drawing (`reveal`: the last stage when the diagram has click stages) and check the SVG is well-formed XML. */
export declare function emitOutputs(laidOut: LaidOutDiagram, opts?: {
    html?: boolean;
    reveal?: number;
    fontBox?: FontBox;
    nodeIds?: boolean;
}): Emitted;
/** One reveal stage's SVG (stage 0 = nothing revealed yet), from the same laid-out tree as the final drawing. */
export declare function emitRevealStage(laidOut: LaidOutDiagram, stage: number, opts?: {
    nodeIds?: boolean;
}): string;
