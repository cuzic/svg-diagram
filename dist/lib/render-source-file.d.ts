import { closeMeasurer } from './measure.ts';
export interface RenderSourceOptions {
    /** 'cacheOnly' (default) never starts a dev server to measure a slide; 'measure' does, and caches the result. */
    budget?: 'measure' | 'cacheOnly';
    /** Re-read the source, and the local files it imports, even if they were imported before (for watch mode). */
    fresh?: boolean;
    /** Also return the figure as HTML/CSS (`html`), as `svg-diagram build --html` writes it. */
    html?: boolean;
    /** Draw without diagram({sourceLine}) (ADR 0023; `build --no-source-line`). The source is not changed. */
    noSourceLine?: boolean;
    /** Where to look for .svg-diagram.json (default: the source's directory). */
    configFrom?: string;
}
export interface RenderSourceResult {
    svg: string;
    /** The HTML/CSS fragment (a <style> and a <div class="sd">), when options.html is set. */
    html?: string;
    /** false when verification or the XML check failed — the svg is still the picture that was drawn. */
    ok: boolean;
    problems: string[];
    warnings: string[];
    notes: string[];
    width: number;
    height: number;
    /** The source, the local files it imports, and the settings (.svg-diagram.json, svg-diagram.icons.json) it was drawn with, absolute — what a watcher should rebuild on. */
    deps: string[];
}
export declare function renderSource(file: string, opts?: RenderSourceOptions): Promise<RenderSourceResult>;
/** Stops the Chromium that text measurement started. Call once when done (a long-lived dev server may leave it open). */
export { closeMeasurer as close };
