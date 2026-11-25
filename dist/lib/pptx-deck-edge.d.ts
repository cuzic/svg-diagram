import type { DeckEdgeResult } from './pptx-deck-edge-core.ts';
import type { PptxEdgeOptions } from './pptx-edge-core.ts';
import type { TextEngine } from './spec-edge-core.ts';
export { TextEngineError, type TextEngine } from './spec-edge-core.ts';
export { deckSchema, validateDeck, MAX_SLIDES, type DeckSpec, type DeckSlide } from './deck-spec.ts';
export type { DeckEdgeResult, DeckSlideResult } from './pptx-deck-edge-core.ts';
export type DeckEdgeOptions = PptxEdgeOptions;
export declare function renderDeckPptxEdge(input: unknown, engine: TextEngine, opts: DeckEdgeOptions): Promise<DeckEdgeResult>;
