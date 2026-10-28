import { type Render } from './markdown-target.ts';
export interface ExpandOptions {
    /** The Markdown file's path — sources are resolved from its directory. */
    file: string;
    mode?: 'file' | 'inline';
    /** 'svg' (default) or 'html' (HTML/CSS, always inline). A `#svg` / `#html` on an image's target wins. */
    render?: Render;
    /** Where the SVGs will be written, relative to the Markdown file's directory (default: svg). Used for the image targets. */
    svgDir?: string;
    /** Sources must be inside this folder (default: the working folder). */
    root?: string;
    /** Passed to renderSource. */
    fresh?: boolean;
}
export interface Figure {
    /** The source, absolute. */
    source: string;
    /** The SVG's file name inside svgDir (mode 'file'): the source's name and a hash of its path, so pages sharing a folder never overwrite each other. */
    name: string;
    svg: string;
    html: string;
    warnings: string[];
}
export interface ExpandResult {
    markdown: string;
    figures: Figure[];
    /** `source: problem` — one per failed check, or per source that did not load. */
    problems: string[];
    /** Figures that were not put where they were asked (an inline figure inside a list or a quote became a file image). */
    notes: string[];
}
export declare function expandMarkdown(text: string, opts: ExpandOptions): Promise<ExpandResult>;
