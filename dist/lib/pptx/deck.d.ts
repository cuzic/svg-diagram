import { type FigureFit, type TextWidth } from '../deck-layout.ts';
import type { Picture } from './image-band.ts';
import { type Entry, type SlidePlan } from './package.ts';
import { type Fonts } from './xml.ts';
export { deckTexts, MAX_FIGURE_SCALE, MIN_TEXT_PT, roomMessage, SLIDE_H, SLIDE_W, smallTextWarning, type TextWidth } from '../deck-layout.ts';
export interface DeckFigure {
    plan: SlidePlan; /** Its laid-out size, px. */
    w: number;
    h: number;
}
/** A column of a slide (ADR 0058): its figure (laid out) or its text. */
export interface DeckColumnIn {
    caption?: string;
    figure?: DeckFigure;
    text?: string;
    width?: number;
}
export interface DeckSlideIn {
    title?: string;
    lead?: string;
    callouts?: {
        label?: string;
        text: string;
    }[];
    source?: string;
    notes?: string;
    figure?: DeckFigure;
    columns?: DeckColumnIn[];
    columnScale?: 'each' | 'same'; /** ADR 0060; 'width' when not given. */
    fit?: FigureFit; /** A cover (ADR 0066): no figure, columns or callouts. */
    layout?: 'cover';
    event?: string;
    date?: string;
    presenter?: string;
}
export interface PlannedSlide {
    xml: string;
    notes: string;
    /** The figure's pictures; picture i is the slide's imageRids(i). */
    pictures: Picture[];
    /** How much the figure was scaled, and the size of its smallest text after (pt); null without a figure. */
    scale: number | null;
    minTextPt: number | null;
    /** The slide's text leaves the figure no room, or (without a figure) the text from the top runs into the text from the bottom. */
    noRoom: boolean;
    name: string;
    /** A cover (ADR 0066): its no-room message is its own. */
    cover?: boolean;
    /** Per column (ADR 0058): how much its figure was scaled and its smallest text after (null for a text column), and whether its content has no room. */
    columns?: {
        scale: number | null;
        minTextPt: number | null;
        noRoom: boolean;
    }[];
}
/**
 * A figure's shapes moved by (dx, dy) EMU and scaled by k. What is a length on the slide is scaled; what is in a shape's own path space
 * (a:path w/h, a:pt, a:pos, a:arcTo wR/hR) and angles, colours and ids are not. test/pptx-deck.test.ts lists every numeric attribute the
 * writer emits, so a new one has to be put on one side or the other.
 */
export declare function placeShapes(xml: string, k: number, dx: number, dy: number): string;
/** The smallest text size (pt) in a slide's XML, or null when it has none. */
export declare function minTextPt(xml: string): number | null;
/** One slide: the heading and lead from the top, the source and callouts from the bottom, the figure scaled into what is left (lib/deck-layout.ts). */
export declare function planDeckSlide(s: DeckSlideIn, fonts: Fonts, w: TextWidth): PlannedSlide;
/**
 * A figure's shapes renumbered to sit beside other figures on one slide: shape ids (and the connectors' glue to them) moved up by `ids`,
 * picture relationships moved on by `pictures` places (imageRids).
 */
export declare function renumberShapes(xml: string, ids: number, pictures: number): string;
/**
 * The package of `slides`: the template with its one slide replaced by these, each with its notes page and pictures; `[Content_Types].xml`
 * first and the rest sorted by name. `pngs[i]` are slide i's pictures' PNGs. Media are numbered across the deck.
 */
export declare function deckEntries(slides: readonly PlannedSlide[], pngs: readonly (readonly Uint8Array[])[], title?: string, template?: readonly {
    name: string;
    text: string;
}[]): Entry[];
/**
 * What stops a planned slide (no room), and what it is warned about (small text), each with its place: the slide's figure, or each column's
 * (ADR 0058). `kinds`: what each column holds.
 */
export declare function slideIssues(p: PlannedSlide, i: number, hasFigure: boolean, kinds?: readonly ('figure' | 'text')[]): {
    errors: {
        path: string;
        message: string;
    }[];
    warnings: {
        path: string;
        message: string;
    }[];
};
