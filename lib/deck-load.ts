import {finishDeckFile, readDeckFile, type LoadDeckResult} from './deck-file.ts';
import {validateDeck} from './deck-spec.ts';

export {figureKey, hasSource, type LoadedDeck} from './deck-file.ts';
export {drawColumnFigure, renderDeckFigure} from './deck-render-figure.ts';

/** Load a deck with the complete catalog validator. */
export function loadDeck(deckFile: string): LoadDeckResult {
  const read = readDeckFile(deckFile);
  return read.ok ? finishDeckFile(read.loaded, validateDeck(read.checked)) : read;
}
