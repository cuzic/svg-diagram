import type { BandDef } from './band-def.ts';
import type { LaidOutDiagram } from './types/index.ts';
import type { FontBox } from './html-native.ts';
export type { FontBox } from './html-native.ts';
type HtmlOptions = {
    reveal?: number;
    id?: string;
    fontBox: FontBox; /** The definitions of the bands, when the figure was copied without them (JSON, structuredClone); by type. */
    definitions?: readonly BandDef[];
    emit?: (diagram: LaidOutDiagram, noRecolor: boolean) => string;
};
/** A self-contained HTML fragment (a <div> and a <style>) for the diagram. `id` scopes the CSS (default: a hash of the content, so the same figure always gets the same id and two figures do not share one). */
export declare function emitHtml(d: LaidOutDiagram, opts: HtmlOptions): string;
