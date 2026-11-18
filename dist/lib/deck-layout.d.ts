/** The slide, in px at 96 dpi: 13.333 × 7.5 in, PowerPoint's 16:9. */
export declare const SLIDE_W = 1280, SLIDE_H = 720;
export declare const MARGIN_X = 56;
/** A figure is never drawn larger than this many times its own size: past it the text looks shouted. */
export declare const MAX_FIGURE_SCALE = 1.25;
/** How a figure takes the room the slide leaves (ADR 0060): 'fill' (default) lays it out at the width that draws it largest, up to FILL_FIGURE_SCALE;
 *  'width' keeps the layout of ADR 0055 / 0059 (the figure's own width, or its column's, scaled up to MAX_FIGURE_SCALE). */
export type FigureFit = 'fill' | 'width';
/** The largest a figure is drawn under 'fill': 14 px text comes out at 21 px (about 16 pt), still well under the heading's 37 px. */
export declare const FILL_FIGURE_SCALE = 1.5;
export declare const maxScale: (fit: FigureFit) => number;
/** The smallest text (pt) a scaled figure may have before the slide is reported as hard to read. */
export declare const MIN_TEXT_PT = 9;
/** Line pitch as a multiple of the text size. */
export declare const LINE = 1.3;
/** Sizes in px, colours as RRGGBB. */
export declare const STYLE: {
    readonly title: {
        readonly size: 37;
        readonly bold: true;
        readonly color: '1F2328';
    };
    readonly lead: {
        readonly size: 19;
        readonly bold: false;
        readonly color: '5B6370';
    };
    readonly callout: {
        readonly size: 16;
        readonly bold: false;
        readonly color: '3A4A5A';
        readonly strong: '1A2A3A';
        readonly fill: 'EEF4FB';
        readonly bar: '1F5FA8';
        readonly padX: 16;
        readonly padY: 8;
    };
    readonly source: {
        readonly size: 13;
        readonly bold: false;
        readonly color: '6B7280';
    };
};
/** The width of `text` in px at `size` px, bold or not, in the font the slide is measured with. */
export type TextWidth = (text: string, size: number, bold: boolean) => number;
export interface DeckCalloutIn {
    label?: string;
    text: string;
}
export interface DeckTextIn {
    title?: string;
    lead?: string;
    callouts?: readonly DeckCalloutIn[];
    source?: string; /** ADR 0066: a cover, with its own fields. */
    layout?: 'cover';
    event?: string;
    date?: string;
    presenter?: string;
}
/** A column to place (ADR 0058): a figure (its laid-out size) or text, under an optional caption; `width` its share of the row. */
export interface ColumnIn {
    caption?: string;
    figure?: {
        w: number;
        h: number;
    };
    text?: string;
    width?: number;
}
/** Where a column's parts go: its caption, and its figure or its text (one block per paragraph); `noRoom` when its content does not fit. */
export interface ColumnPlace {
    x: number;
    width: number;
    caption: TextBlock | null;
    figure: FigurePlace | null;
    text: TextBlock[];
    noRoom: boolean; /** The room for the column's content (under the captions). */
    box: {
        w: number;
        h: number;
    };
}
export interface Run {
    text: string;
    bold: boolean;
    color: string;
}
/** A text box: lines of runs, each line `pitch` px below the last, inside an inset; `align` 'center' puts each line in the middle of the box (ADR 0066). */
export interface TextBlock {
    kind: 'text';
    name: string;
    x: number;
    y: number;
    width: number;
    size: number;
    pitch: number;
    lines: Run[][];
    inset: {
        x: number;
        y: number;
    };
    align?: 'center';
}
export interface RectBlock {
    kind: 'rect';
    name: string;
    x: number;
    y: number;
    w: number;
    h: number;
    fill: string;
}
export type Block = TextBlock | RectBlock;
export interface FigurePlace {
    x: number;
    y: number;
    w: number;
    h: number;
    k: number;
}
export interface DeckLayout {
    /** The heading and lead, in that order; on a cover (ADR 0066), its texts and its rule from the top. */
    top: Block[];
    /** The source and then each callout from the last up, each as the blocks it is made of (a callout: its box, its bar, its text). */
    bottom: Block[][];
    /** Where the figure goes, when there is one and it has room. */
    figure: FigurePlace | null;
    /** The slide's text leaves the figure no room, or (without a figure) the text from the top runs into the text from the bottom. */
    noRoom: boolean;
    /** The columns, when the slide has them (ADR 0058). */
    columns: ColumnPlace[];
    /** The room the slide's text leaves for its figure (or its columns): what a figure is fitted into. */
    room: {
        w: number;
        h: number;
    };
}
/** Between two columns, px. */
export declare const COLUMN_GAP = 24;
/**
 * The slide's blocks and the figure's place. `figure` is the figure's laid-out size in px, when the slide has one. `columns` (ADR 0058) share
 * the room the figure would have, side by side; `scale` 'same' puts every column figure at one scale.
 */
export declare function planDeckLayout(s: DeckTextIn, figure: {
    w: number;
    h: number;
} | undefined, w: TextWidth, columns?: readonly ColumnIn[], scale?: 'each' | 'same', fit?: FigureFit): DeckLayout;
/**
 * A cover (ADR 0066 D4): the event, the title, the lead (the subtitle), a short rule, the date and the presenter, each centred, stacked and
 * set in the middle of the room above the source. `gap` is the room under each to the next one there is. The title is 56 px, else 48
 * (each when it takes two lines at most and the whole fits), else 40 (D5).
 */
export declare const COVER: {
    readonly width: 1040;
    readonly event: {
        readonly size: 22;
        readonly bold: true;
        readonly color: '1F5FA8';
        readonly gap: 16;
    };
    readonly title: {
        readonly sizes: readonly [56, 48, 40];
        readonly line: 1.2;
        readonly bold: true;
        readonly color: '1F2328';
        readonly gap: 20;
    };
    readonly lead: {
        readonly size: 26;
        readonly bold: false;
        readonly color: '5B6370';
        readonly gap: 36;
    };
    readonly rule: {
        readonly w: 80;
        readonly h: 3;
        readonly fill: '1F5FA8';
        readonly gap: 28;
    };
    readonly date: {
        readonly size: 20;
        readonly bold: false;
        readonly color: '3A4A5A';
        readonly gap: 8;
    };
    readonly presenter: {
        readonly size: 24;
        readonly bold: true;
        readonly color: '1F2328';
        readonly gap: 0;
    };
};
/** Each column's width in px: the row (the slide less its margins and the gaps) shared by the columns' `width`. */
export declare function columnWidths(columns: readonly {
    width?: number;
}[]): number[];
/** The scale a column figure laid out at its column's width is drawn at: 14 px text comes out at 9 pt (ADR 0059). */
export declare const COLUMN_FIGURE_SCALE = 0.86;
/** The width a spec figure with no `width` of its own is laid out at in a column `px` wide (ADR 0059), within the spec's range. */
export declare const columnLayoutWidth: (px: number, range: {
    min: number;
    max: number;
}) => number;
/** Every text of the slide that is measured, at its size and weight: for a shell that measures in a batch first. */
export declare function deckTexts(s: DeckTextIn & {
    columns?: readonly {
        caption?: string;
        text?: string;
    }[];
}): {
    text: string;
    size: number;
    bold: boolean;
}[];
/** Why a slide could not be made, for a slide with or without a figure, or a cover (ADR 0066). */
export declare const roomMessage: (hasFigure: boolean, cover?: boolean) => string;
/** A warning for a slide whose figure's smallest text is under MIN_TEXT_PT, or null. */
export declare function smallTextWarning(p: {
    scale: number | null;
    minTextPt: number | null;
}): string | null;
/** The layout widths 'fill' tries (ADR 0060): the document's 940 and narrower, each about 12 % less, down to the spec's 320. */
export declare const FILL_WIDTHS: readonly number[];
/** A figure laid out at one width: its size, and the checks it raised (rule ids such as text-mid-word-break), or why it could not be. */
export type Drawn<T> = {
    ok: true;
    w: number;
    h: number;
    value: T;
    flags: readonly string[];
} | {
    ok: false;
    why: string;
};
/** The rule ids of a verdict's findings (`[rule-id] …`). */
export declare const ruleIds: (findings: readonly string[]) => string[];
export interface FillResult<T> {
    ok: true;
    value: T; /** The layout width chosen, or null for the figure as it is (940). */
    width: number | null;
    k: number;
    tried: number; /** Why the first narrower width that failed failed. */
    narrower: {
        width: number;
        why: string;
    } | null;
}
/**
 * The layout width that draws a figure largest in `box` (ADR 0060): the figure as it is first, then narrower widths while it is the width
 * that holds it back (a narrower figure is taller, so once the height holds it back, narrower only makes it smaller). A width that cannot be
 * laid out ends the search, and so does one that raises a check the figure as it is does not (a narrower box breaking a word in the middle,
 * text crowding: a larger figure that reads worse is not wanted). The scale is min(box width / figure width, box height / figure height, cap);
 * a narrower width is taken only when it draws the figure at least 1 % larger.
 */
export declare function fillSearch<T>(box: {
    w: number;
    h: number;
}, cap: number, draw: (width: number | null) => Promise<Drawn<T>>): Promise<FillResult<T> | {
    ok: false;
    why: string;
}>;
/** The room each figure of a slide is fitted into (ADR 0060): the slide's figure's, and each figure column's (null for a text column). */
export declare function figureRooms(s: DeckTextIn & {
    columns?: readonly {
        caption?: string;
        text?: string;
        width?: number;
    }[];
}, w: TextWidth): {
    figure: {
        w: number;
        h: number;
    };
    columns: ({
        w: number;
        h: number;
    } | null)[];
};
/** The shares tried for columns left to choice (ADR 0061). */
export declare const COLUMN_SHARES: Readonly<Record<number, readonly (readonly number[])[]>>;
/** The least a figure column's smallest text may come to for its shares to be chosen on the empty room (ADR 0055 D4). */
export declare const CHOOSE_MIN_PT = 9;
/** A figure laid out at one width, with its smallest text (pt, at scale 1; null without text): what choosing columns compares. */
export type DrawnFigure<T> = Drawn<T> & {
    minPt?: number | null;
};
export interface ChosenColumns<T> {
    ok: true;
    shares: number[];
    /** Per column: the figure as fitted (null for a text column). */
    figures: (FillResult<T> | null)[];
    /** The empty room the chosen shares leave (px²), and their smallest text (pt; null without figures). */
    empty: number;
    minPt: number | null;
    /** How many shares were tried, and whether none had every figure at CHOOSE_MIN_PT or more. */
    tried: number;
    small: boolean;
}
/**
 * The shares for a slide's columns (ADR 0061): each candidate of COLUMN_SHARES is laid out (captions, texts), each figure column fitted by
 * fillSearch, and the one that leaves the least empty room with every figure's smallest text at CHOOSE_MIN_PT or more is taken; when none
 * reaches it, the one whose smallest text is largest. A candidate whose text does not fit its column, or whose figure cannot be laid out,
 * is left out. `draw(j, width)` lays out column j's figure (memoised here: the same width is drawn once).
 */
export declare function chooseColumns<T>(s: DeckTextIn & {
    columns: readonly {
        caption?: string;
        text?: string;
    }[];
}, w: TextWidth, cap: number, draw: (j: number, width: number | null) => Promise<DrawnFigure<T>>): Promise<ChosenColumns<T> | {
    ok: false;
    why: string;
}>;
