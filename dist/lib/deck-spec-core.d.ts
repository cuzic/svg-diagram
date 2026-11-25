import { type JsonSchema, type SpecIssue } from './spec-kit.ts';
/** Slides in one deck (ADR 0055 D1, raised from 30 to 300 on 2026-11-15: see the ADR for what the number rests on). */
export declare const MAX_SLIDES = 300;
export declare const MAX_CALLOUTS = 3;
/** Columns of a slide (ADR 0058). */
export declare const MIN_COLUMNS = 2, MAX_COLUMNS = 3;
export interface DeckCallout {
    label?: string;
    text: string;
}
/** One column of a slide (ADR 0058): a figure or short text, under an optional caption, `width` its share of the row. */
export interface DeckColumn {
    caption?: string;
    figure?: unknown;
    text?: string; /** Its share of the row (1 to 3), or 'auto' (ADR 0061; leaving it out is 'auto' too). */
    width?: number | 'auto';
}
export interface DeckSlide {
    title?: string;
    lead?: string;
    figure?: unknown;
    columns?: DeckColumn[];
    columnScale?: 'each' | 'same';
    fit?: 'fill' | 'width';
    callouts?: DeckCallout[];
    source?: string;
    notes?: string; /** ADR 0066: a cover, and the fields only a cover has. */
    layout?: 'cover';
    event?: string;
    date?: string;
    presenter?: string;
}
/** The fields a cover does not draw (ADR 0066 D2), and the ones only a cover draws. */
export declare const NOT_ON_COVER: readonly ['figure', 'columns', 'columnScale', 'fit', 'callouts'];
export declare const COVER_ONLY: readonly ['event', 'date', 'presenter'];
/** The message for a field a cover does not draw. */
export declare const notOnCover: (field: string) => string;
export interface DeckSpec {
    title?: string;
    fit?: 'fill' | 'width';
    slides: DeckSlide[];
}
/** How slide i's figures take its room (ADR 0060): the slide's `fit`, else the deck's, else 'fill'. */
export declare const fitOf: (deck: DeckSpec, slide: DeckSlide) => 'fill' | 'width';
export declare const deckSchemaFor: (figure: JsonSchema) => JsonSchema;
/** Where a figure's issue is in the deck: `slides[i].figure` and then the spec's own path ('' is the whole figure). */
export declare const figurePath: (i: number, path: string | null) => string;
/** Where a column figure's issue is: `slides[i].columns[j].figure` and then the spec's own path. */
export declare const columnFigurePath: (i: number, j: number, path: string | null) => string;
/** Every problem with `input`, each with its place; empty when it can be drawn. At most MAX_ISSUES (the last says how many more). */
export declare function validateDeckWith(input: unknown, validateFigure: (figure: unknown) => SpecIssue[]): SpecIssue[];
/** Use asynchronously loaded figure validators while retaining the deck's issue order. */
export declare function validateDeckWithAsync(input: unknown, validateFigure: (figure: unknown) => Promise<SpecIssue[]>): Promise<SpecIssue[]>;
/**
 * The spec a column's figure is laid out from (ADR 0059): one that gives no `width` of its own is laid out at the column's width (so its
 * boxes and tables wrap their text instead of the whole figure being shrunk); `auto` is that width, or null when the spec keeps its own.
 */
export declare function columnSpec(spec: unknown, columnPx: number): {
    spec: unknown;
    auto: number | null;
};
/** The warning when a column's figure did not fit its column's width and was drawn at the document's width and shrunk instead (ADR 0059). */
export declare const columnFallbackWarning: (auto: number, why: string) => string;
/** The columns' shares as written: a number where one is given, null where it is left to choice ('auto' or left out). */
export declare const writtenShares: (columns: readonly DeckColumn[]) => (number | null)[];
/** Whether slide's columns are chosen (ADR 0061): every column 'auto' and the slide fills. Otherwise an 'auto' column takes 1. */
export declare const autoColumns: (deck: DeckSpec, slide: DeckSlide) => boolean;
/** The columns with the shares to lay them out by: chosen ones where given, else the written ones ('auto' as 1). */
export declare const sharedColumns: <C extends DeckColumn>(columns: readonly C[], chosen?: readonly number[]) => (Omit<C, 'width'> & {
    width: number;
})[];
