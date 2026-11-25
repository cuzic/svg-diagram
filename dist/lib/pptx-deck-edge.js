import { validateDeck } from './deck-spec.js';
import { renderDeckPptxEdgeWith } from './pptx-deck-edge-core.js';
import { planFigureEdge } from './pptx-edge.js';
export { TextEngineError } from './spec-edge-core.js';
export { deckSchema, validateDeck, MAX_SLIDES } from './deck-spec.js';
export function renderDeckPptxEdge(input, engine, opts) {
    return renderDeckPptxEdgeWith(input, engine, opts, { validate: validateDeck, plan: (spec, guarded) => planFigureEdge(spec, guarded, opts) });
}
