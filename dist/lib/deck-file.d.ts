import type { DeckSpec } from './deck-spec-core.ts';
import { type SpecIssue } from './spec-kit.ts';
export interface LoadedDeck {
    deck: DeckSpec;
    /** The .ts figures: `figureKey(i)` (slide i's figure) or `figureKey(i, j)` (its column j) → the absolute path (the deck's `figure` is left out for these). */
    sources: Map<string, string>;
    /** Every file this read: the deck and the .json figures (the .ts figures are in `sources`). */
    files: string[];
}
type DeckFileError = {
    ok: false;
    errors: string[];
};
export type LoadDeckResult = {
    ok: true;
    loaded: LoadedDeck;
} | DeckFileError;
/** The key of a figure in `sources`: slide i's own figure, or the figure of its column j (ADR 0058). */
export declare const figureKey: (i: number, j?: number) => string;
/** Whether slide i has any .ts figure (its own or a column's). */
export declare const hasSource: (sources: ReadonlyMap<string, string>, i: number) => boolean;
/** Resolve figure paths and retain the input used for validation. */
export declare function readDeckFile(deckFile: string): DeckFileError | {
    ok: true;
    loaded: LoadedDeck;
    checked: unknown;
};
export declare function finishDeckFile(loaded: LoadedDeck, issues: readonly SpecIssue[]): LoadDeckResult;
export {};
