import { type WebMeasurer } from './web.ts';
import type { TextBoxFn } from './svg-geom.ts';
import { type OutlineFont } from './svg-outline.ts';
import { type RenderSpecResult, type SpecIssue } from './spec.ts';
export type { OutlineFont } from './svg-outline.ts';
export type { RenderSpecResult } from './spec.ts';
export interface TextEngine {
    measure: WebMeasurer;
    textBox: TextBoxFn;
    font: OutlineFont;
}
export declare const MAX_EDGE_HEIGHT = 6000;
/** The text engine failed, not the figure: telling the caller to change the spec would be wrong. Thrown out of renderSpecEdge(). */
export declare class TextEngineError extends Error {
    constructor(cause: unknown);
}
/** The engine with each of its failures turned into a TextEngineError (also used by ./pptx-edge.ts). */
export declare function guardedEngine({ measure, textBox, font }: TextEngine): TextEngine;
export declare function missingIssues(spec: unknown, missing: readonly {
    char: string;
}[]): SpecIssue[];
/**
 * Draw and check a spec, and turn its text into outlines. A bad spec, a figure that does not fit, or a character the font lacks comes back in the
 * result, with its place. A failure of the engine that was handed in throws TextEngineError.
 */
export declare function renderSpecEdge(spec: unknown, givenEngine: TextEngine, opts?: {
    maxHeight?: number;
}): Promise<RenderSpecResult>;
