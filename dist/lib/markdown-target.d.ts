export type Render = 'svg' | 'html';
/** The source path and the per-figure output choice, or undefined when the target is not a diagram source (a URL, any other file). */
export declare function diagramTarget(target: string): {
    file: string;
    render?: Render;
} | undefined;
/** A markdown target is percent-encoded; a lone `%` (`100%.diagram.ts`) is read as it is. */
export declare function decodeTarget(file: string): string;
/** `dir/flow.diagram.ts` → `flow` */
export declare const figureName: (file: string) => string;
/** Markdown HTML blocks end at a blank line, so the fragment must not contain one. */
export declare const noBlankLines: (s: string) => string;
export declare const escAttr: (s: string) => string;
/**
 * The figure's <svg>, ready to sit in a page: its ids (and every reference to them) get a prefix of their own, so two figures —
 * or the same one twice (`seen` counts them) — never share an id; its <style> applies to it alone; an `alt` becomes its name
 * (instead of the <title> it was labelled by); it shrinks to the page's width.
 */
export declare function inlineSvg(svg: string, alt: string | undefined, seen: Map<string, number>): string;
/**
 * The HTML/CSS form of a figure, in a wrapper that carries the alt text. It is made of <div>s, and an HTML parser closes an open <p>
 * at a <div> — whatever sits between — so it can only stand as a block of its own, never inside running text (that is drawn as an <svg>).
 */
export declare function htmlFigure(html: string, alt: string | undefined, seen: Map<string, number>): string;
/** Markdown inline text as plain text, for an `aria-label`: `**x**` → `x`, `[x](y)` → `x`, `` `x` `` → `x`, `\*` → `*`. */
export declare function plainText(md: string): string;
/**
 * A Vue template reads `{{ }}` in text, drops <style>, and compiles twice (server, client), so a figure goes in as the value of
 * v-html: the same string on both sides, never parsed as a template.
 */
export declare function vueHtml(content: string, tag?: 'div' | 'span'): string;
