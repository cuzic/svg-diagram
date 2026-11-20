import { type DeckLayout } from '../deck-layout.ts';
import { type OutlineFont } from '../svg-outline.ts';
import type { TextBoxFn } from '../svg-geom.ts';
export interface SlideFigure {
    /** The figure's SVG as the renderer wrote it. */
    svg: string;
}
export interface SlideSvg {
    svg: string;
    /** Characters no font has a glyph for (drawn as the font's empty box), with the text they are in. */
    missing: {
        text: string;
        char: string;
    }[];
    /** What some text asked for that outlines do not reproduce (a WordArt stroke, ...). */
    unsupported: string[];
    /** Emoji left as live text (no outline for them): the viewer's font draws them, at a width that may differ from the measured one. */
    liveEmoji: string[];
}
/**
 * The figure's SVG as the content of a nested <svg> at `place`: no XML declaration, no <metadata>, and (ADR 0056 D2) the light side of an
 * `auto` figure, so a viewer's dark mode does not recolour the slide. A dark figure gets its page colour as a panel behind it, as on the .pptx.
 */
export declare function placedFigure(svg: string, place: {
    x: number;
    y: number;
    w: number;
    h: number;
}): string;
/**
 * The slide: a white page, the heading and lead, the figure (or the columns' figures, captions and texts, ADR 0058), then the callouts and
 * source on top; all text outlined with `font`. `columns[j]` is column j's figure, where it has one.
 */
export declare function slideSvg(layout: DeckLayout, figure: SlideFigure | undefined, font: OutlineFont, box: TextBoxFn, columns?: readonly (SlideFigure | undefined)[]): SlideSvg;
/** What the slide says, for `<img alt>` (ADR 0056 D2: the SVG's own <title> is not read out from an <img>). */
export declare function slideText(s: {
    title?: string;
    lead?: string;
    callouts?: readonly {
        label?: string;
        text: string;
    }[];
    source?: string;
    columns?: readonly {
        caption?: string;
        text?: string;
    }[];
    layout?: 'cover';
    event?: string;
    date?: string;
    presenter?: string;
}, figureTitle?: string, columnTitles?: readonly (string | undefined)[]): string;
