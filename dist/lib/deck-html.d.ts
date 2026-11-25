export interface DeckSlide {
    /** The source's basename (no extension): the URL hash name and the last resort for the slide's name. */
    name: string;
    /** The figure's SVG as `renderSource` returns it, or an exported .svg read from disk. */
    svg: string;
    /** The slide's name for assistive technology. Default: the figure's own <title>, then `name`. */
    title?: string;
}
export interface DeckOptions {
    /** The viewer's CSS (unit C) and script (unit C: state.js + viewer.js). Embedded as they are; neither may contain its closing tag. */
    css: string;
    js: string;
    /** The document's <title> and the label of the viewer. Default `svg-diagram deck`. */
    title?: string;
    lang?: string;
    /** Emit a `<meta http-equiv="Content-Security-Policy">` that allows exactly the one <style> and the one <script> (by SHA-256). */
    csp?: boolean;
    /** Columns of the overview, as the custom property `--deck-cols` on `#deck` (the stylesheet decides what to do without it). */
    cols?: number;
}
/** The text of the figure's `<title>` (what a doc-sized figure is named by), or undefined. */
export declare function svgTitle(svg: string): string | undefined;
/** The hash name of a slide: a file name made safe to sit in an id and in a URL (`#flow`). */
export declare function slideHashName(name: string): string;
/**
 * What stops an SVG being self-contained: an `href` / `src` that is not a data URI or a `#fragment`, an `@import`, a `url(...)` that is
 * not `#fragment` or `data:`. (The `xmlns` namespace names are not references.) Empty when there is none.
 */
export declare function externalRefs(svg: string): string[];
/** The deck: one HTML document holding every slide, the viewer's CSS and script, and (with `csp`) a policy that admits only those two blocks. */
export declare function buildDeck(slides: readonly DeckSlide[], opts: DeckOptions): string;
