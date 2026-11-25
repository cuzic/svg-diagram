// Drawing a JSON spec (lib/spec.ts) in Node, without writing a file, and the checks a caller of renderDiagram() otherwise only gets from
// `build`: part of "svg-diagram/render". Nothing here reads .svg-diagram.json from the working directory; a server passes its settings.
import { renderDiagram } from './dsl/render.js';
import { applyConfig } from './config.js';
import { SpecError, specToDiagram } from './spec.js';
import { layoutIssue, lintMessages } from './spec-result.js';
import { finishNodeSpec, isInfrastructure, MAX_FIGURE_HEIGHT, nothing } from './spec-node-result.js';
export { lintRendering, MAX_FIGURE_HEIGHT } from './spec-node-result.js';
export { MAX_PNG_PIXELS, svgToPng } from './png.js';
export { lintMessages };
/**
 * Draw and check a spec. A bad spec, or a figure that does not fit, comes back in the result with its place. A failure of the machine itself
 * (a font file missing) throws. Layout is synchronous and can take seconds at the limits of the schema: a server should call this from a
 * worker with a time limit.
 */
export async function renderSpec(spec, opts = {}) {
    const config = opts.config ?? {};
    let d;
    try {
        d = applyConfig(specToDiagram(spec), config);
    }
    catch (e) {
        if (e instanceof SpecError)
            return nothing([...e.issues]);
        throw e;
    }
    let r;
    try {
        r = await renderDiagram(d, { name: opts.name ?? 'diagram.svg', budget: 'cacheOnly' });
    }
    catch (e) {
        if (isInfrastructure(e))
            throw e;
        return nothing([layoutIssue(spec, e)]);
    }
    return finishNodeSpec(spec, r, opts.maxHeight ?? MAX_FIGURE_HEIGHT, config.fonts);
}
