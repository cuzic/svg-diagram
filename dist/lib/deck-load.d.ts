import { type LoadDeckResult } from './deck-file.ts';
export { figureKey, hasSource, type LoadedDeck } from './deck-file.ts';
export { drawColumnFigure, renderDeckFigure } from './deck-render-figure.ts';
/** Load a deck with the complete catalog validator. */
export declare function loadDeck(deckFile: string): LoadDeckResult;
