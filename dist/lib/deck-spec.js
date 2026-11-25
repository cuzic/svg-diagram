import { deckSchemaFor, validateDeckWith } from './deck-spec-core.js';
import { specSchema, validateSpec } from './spec.js';
export { autoColumns, columnFallbackWarning, columnFigurePath, columnSpec, COVER_ONLY, figurePath, fitOf, MAX_CALLOUTS, MAX_COLUMNS, MAX_SLIDES, MIN_COLUMNS, NOT_ON_COVER, notOnCover, sharedColumns, writtenShares, } from './deck-spec-core.js';
const { canvas: _canvas, ...FIGURE_FIELDS } = specSchema.properties ?? {}; // a deck slide sizes its figure itself (validateDeck refuses a canvas)
const FIGURE = { ...specSchema, properties: FIGURE_FIELDS, description: 'The figure: the same JSON spec as a single diagram. It is laid out at its own size and then scaled to the room the slide leaves. Not on a cover.' };
/** The deck's JSON Schema, figures included (each is a full spec). */
export const deckSchema = /* @__PURE__ */ deckSchemaFor(FIGURE);
/** Every problem with the deck and its figures, using the complete spec catalog. */
export function validateDeck(input) {
    return validateDeckWith(input, validateSpec);
}
