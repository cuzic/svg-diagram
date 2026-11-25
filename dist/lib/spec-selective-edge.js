import { guardedEngine, MAX_EDGE_HEIGHT, nothing, renderEdgeResult } from './spec-edge-core.js';
import { prepareVerifiedSpecRender, SpecError } from './spec-selective.js';
export { MAX_EDGE_HEIGHT, TextEngineError } from './spec-edge-core.js';
export { partCatalog, specSchemaFor, validateSpec } from './spec-selective.js';
/** Draw and outline only the registered spec parts, with a caller-supplied text engine. */
export async function renderSpecEdge(spec, givenEngine, options) {
    const engine = guardedEngine(givenEngine);
    let draw;
    try {
        draw = prepareVerifiedSpecRender(spec, options);
    }
    catch (error) {
        if (error instanceof SpecError)
            return nothing([...error.issues]);
        throw error;
    }
    return renderEdgeResult(spec, engine, options.maxHeight ?? MAX_EDGE_HEIGHT, () => draw(engine.measure));
}
