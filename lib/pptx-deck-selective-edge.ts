import {renderDeckPptxEdgeWith, type DeckEdgeResult} from './pptx-deck-edge-core.ts';
import {validateDeckWith} from './deck-spec-core.ts';
import {planSelectedFigureEdge, type SelectedFigureOptions} from './pptx-selective-edge.ts';
import {validateSpec} from './spec-selective.ts';
import type {PptxEdgeOptions} from './pptx-edge-core.ts';
import type {TextEngine} from './spec-edge-core.ts';

export {TextEngineError, type TextEngine} from './spec-edge-core.ts';
export {MAX_SLIDES, type DeckSpec, type DeckSlide} from './deck-spec-core.ts';
export type {DeckEdgeResult, DeckSlideResult} from './pptx-deck-edge-core.ts';

export type DeckEdgeOptions = SelectedFigureOptions & PptxEdgeOptions;

export function renderDeckPptxEdge(input: unknown, engine: TextEngine, opts: DeckEdgeOptions): Promise<DeckEdgeResult> {
  return renderDeckPptxEdgeWith(input, engine, opts, {
    validate: deck => validateDeckWith(deck, spec => validateSpec(spec, opts)),
    plan: (spec, guarded, width) => planSelectedFigureEdge(spec, guarded, width === undefined ? opts : {...opts, width}),
  });
}
