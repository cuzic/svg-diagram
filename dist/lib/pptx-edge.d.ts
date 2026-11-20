import { type SpecIssue } from './spec.ts';
import { type TextEngine } from './spec-edge.ts';
import { type SlidePlan } from './pptx/package.ts';
export type { TextEngine } from './spec-edge.ts';
export { TextEngineError } from './spec-edge.ts';
export interface PptxEdgeOptions {
    /** Draws a picture's SVG (text already outlined) as a PNG `scale` times its size. Required by the format as the fallback of every picture. */
    rasterize: (svg: string, scale: number) => Uint8Array | Promise<Uint8Array>;
    /** Typeface written into the text of the native shapes (default BIZ UDPGothic, which Windows has). */
    font?: string;
    /** PNG fallback scale (default 2). */
    pngScale?: number;
    maxHeight?: number;
}
export interface PptxEdgeResult {
    /** The .pptx file, or null when the spec could not be used or laid out. */
    pptx: Uint8Array | null;
    /** Why there is no file. */
    issues: SpecIssue[];
    /** How many bands became native shapes and how many pictures. */
    native: number;
    pictures: number;
}
/** A spec laid out and planned as one slide, its pictures' text outlined: what renderPptxEdge packs, and what a deck places (./pptx-deck-edge.ts). */
export interface FigurePlan {
    plan: SlidePlan;
    width: number;
    height: number;
    native: number; /** The checks the figure raised: `[rule-id] …` (what a deck's 'fill' compares, ADR 0060). */
    findings: string[];
}
/** The spec as a slide plan, or the issues that stop it (with their places in the spec). Throws TextEngineError as renderPptxEdge does. */
export declare function planFigureEdge(spec: unknown, engine: TextEngine, opts?: {
    font?: string;
    maxHeight?: number;
}): Promise<FigurePlan | {
    issues: SpecIssue[];
}>;
/** The entries zipped, the XML deflated where the runtime can (PNGs are stored: they are compressed already). */
export declare function zipPackage(files: readonly {
    name: string;
    data: Uint8Array;
}[]): Promise<Uint8Array>;
/**
 * The spec as a .pptx. A bad spec or a figure that cannot be laid out comes back as issues; a failure of the engine that was handed in
 * throws TextEngineError, and one of `rasterize` throws as it is. The drawing's own checks are renderSpecEdge's: run that first.
 */
export declare function renderPptxEdge(spec: unknown, givenEngine: TextEngine, opts: PptxEdgeOptions): Promise<PptxEdgeResult>;
