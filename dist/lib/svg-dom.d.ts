export interface El {
    tag: string;
    attrs: Record<string, string>;
    children: (El | string)[];
    parent: El | null;
    order: number;
}
/** Parses well-formed XML (xmlProblems() says whether it is) into a tree; returns the root element. Throws on what it cannot read. */
export declare function parseXml(src: string): El;
/** Parses a well-formed XML fragment — several top-level elements and text, like the HTML of `build --html` — into a '#document' node. */
export declare function parseXmlFragment(src: string): El;
export declare const elements: (el: El) => El[];
export declare const textOf: (el: El) => string;
/**
 * The text of a <text> grouped by the colour it is drawn in (a tspan with its own fill is a group of its own; a tspan that
 * inherits the colour, an emoji's, joins the text's). A <text> drawn in one colour is one group. In order of first appearance.
 */
export declare function colourGroups(text: El, styles: Map<El, Style>): {
    style: Style;
    txt: string;
}[];
export declare const closest: (el: El | null, test: (e: El) => boolean) => El | null;
export interface RGBA {
    r: number;
    g: number;
    b: number;
    a: number;
}
/** The colour a paint value stands for; null for none, a url() reference, or anything not understood (as a computed style that is not rgb()). */
export declare function parseColor(value: string, current?: string): RGBA | null;
export type Matrix = [number, number, number, number, number, number];
export declare const IDENTITY: Matrix;
export declare const multiply: (m: Matrix, n: Matrix) => Matrix;
export declare const apply: (m: Matrix, x: number, y: number) => [number, number];
export declare function parseTransform(value: string | undefined): Matrix;
export interface Style {
    fill: string;
    stroke: string;
    strokeWidth: number;
    opacity: number;
    fillOpacity: number;
    strokeOpacity: number;
    fontSize: number;
    fontWeight: number;
    fontFamily: string;
    textAnchor: string;
    color: string;
}
/** The computed style of every element (the properties lint reads), by the rules of presentation attributes < <style> rules < style="". */
export declare function computeStyles(root: El): Map<El, Style>;
