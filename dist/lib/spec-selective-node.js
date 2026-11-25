import { fontMeasurer } from './node-measure.js';
import { finishNodeSpec, isInfrastructure, MAX_FIGURE_HEIGHT, nothing } from './spec-node-result.js';
import { layoutIssue } from './spec-result.js';
import { prepareVerifiedSpecRender, SpecError } from './spec-selective.js';
export { MAX_FIGURE_HEIGHT } from './spec-node-result.js';
export { partCatalog, specSchemaFor, validateSpec } from './spec-selective.js';
/** Render and verify registered spec parts using the Node font backend. */
export async function renderSpec(spec, options) {
    let draw;
    try {
        draw = prepareVerifiedSpecRender(spec, options);
    }
    catch (error) {
        if (error instanceof SpecError)
            return nothing([...error.issues]);
        throw error;
    }
    let result;
    try {
        result = await draw(fontMeasurer(options.fonts));
    }
    catch (error) {
        if (isInfrastructure(error))
            throw error;
        return nothing([layoutIssue(spec, error)]);
    }
    return finishNodeSpec(spec, result, options.maxHeight ?? MAX_FIGURE_HEIGHT, options.fonts);
}
