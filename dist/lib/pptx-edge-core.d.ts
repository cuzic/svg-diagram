import { type TextEngine } from './spec-edge-core.ts';
import type { SpecIssue } from './spec-kit.ts';
import type { SlidePlan } from './pptx/package.ts';
export interface FigurePlan {
    plan: SlidePlan;
    width: number;
    height: number;
    native: number; /** The checks the figure raised: `[rule-id] …` (what a deck's 'fill' compares, ADR 0060). */
    findings: string[];
}
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
export declare const noPptx: (issues: SpecIssue[]) => PptxEdgeResult;
/** The entries zipped, the XML deflated where the runtime can (PNGs are stored: they are compressed already). */
export declare function zipPackage(files: readonly {
    name: string;
    data: Uint8Array;
}[]): Promise<Uint8Array>;
export declare function outlinePptxPictures(spec: unknown, plan: SlidePlan, engine: TextEngine): SpecIssue[];
