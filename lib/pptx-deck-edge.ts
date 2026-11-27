import {validateDeck} from './deck-spec.ts';
import {renderDeckPptxEdgeWith} from './pptx-deck-edge-core.ts';
import type {DeckEdgeResult} from './pptx-deck-edge-core.ts';
import {planFigureEdge} from './pptx-edge.ts';
import type {PptxEdgeOptions} from './pptx-edge-core.ts';
import type {TextEngine} from './spec-edge-core.ts';

export {TextEngineError, type TextEngine} from './spec-edge-core.ts';
export {deckSchema, validateDeck, MAX_SLIDES, type DeckSpec, type DeckSlide} from './deck-spec.ts';
export type {DeckEdgeResult, DeckSlideResult} from './pptx-deck-edge-core.ts';
export type DeckEdgeOptions = PptxEdgeOptions;

export function renderDeckPptxEdge(input: unknown, engine: TextEngine, opts: DeckEdgeOptions): Promise<DeckEdgeResult> {
  return renderDeckPptxEdgeWith(input, engine, opts, {validate: validateDeck, plan: (spec, guarded, width, textSize) => planFigureEdge(spec, guarded, opts, width, textSize)});
}
