import type { JsonSchema, SpecIssue } from './spec-kit.ts';
export { autoColumns, columnFallbackWarning, columnFigurePath, columnSpec, COVER_ONLY, figurePath, fitOf, MAX_CALLOUTS, MAX_COLUMNS, MAX_SLIDES, MIN_COLUMNS, NOT_ON_COVER, notOnCover, sharedColumns, writtenShares, } from './deck-spec-core.ts';
export type { DeckCallout, DeckColumn, DeckSlide, DeckSpec } from './deck-spec-core.ts';
/** The deck's JSON Schema, figures included (each is a full spec). */
export declare const deckSchema: JsonSchema;
/** Every problem with the deck and its figures, using the complete spec catalog. */
export declare function validateDeck(input: unknown): SpecIssue[];
