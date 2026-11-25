// Drawing a JSON spec where there is no file system and no native code, such as a Cloudflare Worker ("svg-diagram/spec/edge"). The caller hands in
// the text engine; the result is an SVG with its text as outlines, so the picture does not depend on the fonts of whoever opens it.
import { renderInBrowser } from './web.js';
import { SpecError, specToDiagram } from './spec.js';
import { guardedEngine, MAX_EDGE_HEIGHT, nothing, renderEdgeResult } from './spec-edge-core.js';
export { guardedEngine, MAX_EDGE_HEIGHT, missingIssues, TextEngineError } from './spec-edge-core.js';
/**
 * Draw and check a spec, and turn its text into outlines. A bad spec, a figure that does not fit, or a character the font lacks comes back in the
 * result, with its place. A failure of the engine that was handed in throws TextEngineError.
 */
export async function renderSpecEdge(spec, givenEngine, opts = {}) {
    const engine = guardedEngine(givenEngine);
    let d;
    try {
        d = specToDiagram(spec);
    }
    catch (e) {
        if (e instanceof SpecError)
            return nothing([...e.issues]);
        throw e;
    }
    return renderEdgeResult(spec, engine, opts.maxHeight ?? MAX_EDGE_HEIGHT, () => renderInBrowser(d, { measure: engine.measure }));
}
