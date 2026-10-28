import type { LaidOutDiagram } from './types/index.ts';
/** The ascent and descent of the primary font at a size: given by the shell (lib/font-box.ts), which reads the font files. */
export type FontBox = (size: number, weight: number, mono: boolean) => {
    ascent: number;
    descent: number;
};
/** A self-contained HTML fragment (a <div> and a <style>) for the diagram. `id` scopes the CSS (default: a hash of the content, so the same figure always gets the same id and two figures do not share one). */
export declare function emitHtml(d: LaidOutDiagram, opts: {
    reveal?: number;
    id?: string;
    fontBox: FontBox;
}): string;
