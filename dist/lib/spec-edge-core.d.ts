import type { WebMeasurer, WebRender } from './web.ts';
import type { TextBoxFn } from './svg-geom.ts';
import { type OutlineFont } from './svg-outline.ts';
import type { SpecIssue } from './spec-kit.ts';
import type { RenderSpecResult } from './spec-result.ts';
export interface TextEngine {
    measure: WebMeasurer;
    textBox: TextBoxFn;
    font: OutlineFont;
}
export declare const MAX_EDGE_HEIGHT = 6000;
export declare const nothing: (issues: SpecIssue[]) => RenderSpecResult;
/** The text engine failed, not the figure: telling the caller to change the spec would be wrong. Thrown out of renderSpecEdge(). */
export declare class TextEngineError extends Error {
    constructor(cause: unknown);
}
/** The engine with each of its failures turned into a TextEngineError (also used by ./pptx-edge.ts). */
export declare function guardedEngine({ measure, textBox, font }: TextEngine): TextEngine;
export declare function missingIssues(spec: unknown, missing: readonly {
    char: string;
}[]): SpecIssue[];
export declare function renderEdgeResult(spec: unknown, engine: TextEngine, maxHeight: number, draw: () => Promise<Pick<WebRender, 'svg' | 'height' | 'width' | 'verdict' | 'xml'>>): Promise<RenderSpecResult>;
