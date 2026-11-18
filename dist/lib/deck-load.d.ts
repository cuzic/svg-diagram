import { type DeckSpec } from './deck-spec.ts';
import { type DrawnFigure } from './deck-layout.ts';
import type { Config } from './types/project.ts';
import type { RenderResult } from './types/verdicts.ts';
export interface LoadedDeck {
    deck: DeckSpec;
    /** The .ts figures: `figureKey(i)` (slide i's figure) or `figureKey(i, j)` (its column j) → the absolute path (the deck's `figure` is left out for these). */
    sources: Map<string, string>;
    /** Every file this read: the deck and the .json figures (the .ts figures are in `sources`). */
    files: string[];
}
/** The key of a figure in `sources`: slide i's own figure, or the figure of its column j (ADR 0058). */
export declare const figureKey: (i: number, j?: number) => string;
/** Whether slide i has any .ts figure (its own or a column's). */
export declare const hasSource: (sources: ReadonlyMap<string, string>, i: number) => boolean;
/** The deck at `deckFile` with its figure paths read, or every problem with it (each with its place). */
export declare function loadDeck(deckFile: string): {
    ok: true;
    loaded: LoadedDeck;
} | {
    ok: false;
    errors: string[];
};
/**
 * A figure drawn (a .ts source from `source`, else the spec `spec`), or the problems with it, each with its place: slide i's figure, or
 * with `column` the figure of its column j. With `columnPx` (the column's width), a spec that gives no width of its own is laid out at the
 * column's width; when it does not fit there, it is drawn at the document's width and `fallback` says so (ADR 0059).
 */
export declare function renderDeckFigure(i: number, spec: unknown, source: string | undefined, cfg: Config, opts?: {
    fresh?: boolean;
    column?: number;
    columnPx?: number;
    fill?: {
        box: {
            w: number;
            h: number;
        };
        cap: number;
    };
}): Promise<{
    ok: true;
    result: RenderResult;
    fallback?: string;
} | {
    ok: false;
    errors: string[];
}>;
/** A figure's smallest text in pt at scale 1, counted as the .pptx counts it (null without text). */
export declare function figureMinPt(laidOut: RenderResult['laidOut']): number | null;
/**
 * Column j's figure laid out at `width` for choosing the columns' shares (ADR 0061): a spec without a width of its own at that width; a spec
 * with one, or a .ts figure, only as it is (a narrower width "fails", so the search does not draw the same figure again).
 */
export declare function drawColumnFigure(i: number, j: number, spec: unknown, source: string | undefined, cfg: Config, width: number | null, fresh?: boolean): Promise<DrawnFigure<RenderResult> & {
    errors?: string[];
}>;
