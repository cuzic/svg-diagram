import { finishDeckFile, readDeckFile } from './deck-file.js';
import { validateDeck } from './deck-spec.js';
export { figureKey, hasSource } from './deck-file.js';
export { drawColumnFigure, renderDeckFigure } from './deck-render-figure.js';
/** Load a deck with the complete catalog validator. */
export function loadDeck(deckFile) {
    const read = readDeckFile(deckFile);
    return read.ok ? finishDeckFile(read.loaded, validateDeck(read.checked)) : read;
}
