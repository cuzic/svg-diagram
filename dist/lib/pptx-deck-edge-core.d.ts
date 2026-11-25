import type { SpecIssue } from './spec-kit.ts';
import { type TextEngine } from './spec-edge-core.ts';
import { type FigurePlan, type PptxEdgeOptions } from './pptx-edge-core.ts';
export interface DeckSlideResult {
    /** How much the figure was scaled onto the slide, and its smallest text after (pt); null without a figure. */
    scale: number | null;
    minTextPt: number | null;
    /** Bands that became native shapes, and pictures. */
    native: number;
    pictures: number;
    /** Per column (ADR 0058): its figure's scale and smallest text (null for a text column). */
    columns: {
        scale: number | null;
        minTextPt: number | null;
    }[];
}
export interface DeckEdgeResult {
    /** The .pptx file, or null when the deck could not be used or a figure could not be laid out. */
    pptx: Uint8Array | null;
    /** Why there is no file, with places such as `slides[1].figure.parts[0].nodes[2]`. */
    issues: SpecIssue[];
    /** The file is made, but a slide may be hard to read (a figure scaled until its text is small). */
    warnings: SpecIssue[];
    slides: DeckSlideResult[];
}
/**
 * The deck as a .pptx. A bad deck, a figure that cannot be laid out or a slide with no room for its figure comes back as issues; a failure of
 * the engine throws TextEngineError, and one of `rasterize` throws as it is. Each figure's own checks are renderSpecEdge's: run that first.
 */
export declare function renderDeckPptxEdgeWith(input: unknown, givenEngine: TextEngine, opts: PptxEdgeOptions, services: {
    validate(input: unknown): SpecIssue[];
    plan(spec: unknown, engine: TextEngine): Promise<FigurePlan | {
        issues: SpecIssue[];
    }>;
}): Promise<DeckEdgeResult>;
