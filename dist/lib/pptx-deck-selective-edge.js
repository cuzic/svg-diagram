import { renderDeckPptxEdgeWith } from './pptx-deck-edge-core.js';
import { validateDeckWith } from './deck-spec-core.js';
import { planSelectedFigureEdge } from './pptx-selective-edge.js';
import { validateSpec } from './spec-selective.js';
export { TextEngineError } from './spec-edge-core.js';
export { MAX_SLIDES } from './deck-spec-core.js';
export function renderDeckPptxEdge(input, engine, opts) {
    return renderDeckPptxEdgeWith(input, engine, opts, {
        validate: deck => validateDeckWith(deck, spec => validateSpec(spec, opts)),
        plan: (spec, guarded) => planSelectedFigureEdge(spec, guarded, opts),
    });
}
