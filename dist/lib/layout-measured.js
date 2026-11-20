// The shell around layout: measure what collectMeasures() asked for (the one await), then lay out synchronously.
// layout.ts itself does no I/O and reads no environment; the strict-width switch is read here.
import { layoutWith } from './layout.js';
import { collectMeasures, widthOfMeasured } from './layout-measure.js';
import { defaultMeasureSettings, measureAll } from './measure.js';
import { ROLES } from './tokens.js';
// Tests and the golden check run with SVG_DIAGRAM_STRICT_WIDTH=1 (test/helpers/strict-width.ts): an atom that was never
// registered for measuring is then an error instead of a silent width of 0.
const strictWidths = () => !!process.env['SVG_DIAGRAM_STRICT_WIDTH'];
/** Measure then lay out. `roles` (default ROLES) is baked into the result as LaidOutDiagram.roles; the measuring settings (`measure`, else
 *  the diagram's own, else the process default) are baked in as LaidOutDiagram.measure, which the HTML emit measures glyph boxes with. */
export async function layoutDiagram(d, opts = {}) {
    const roles = opts.roles ?? ROLES, measure = opts.measure ?? d.measure ?? defaultMeasureSettings();
    const laid = layoutWith(d, roles, widthOfMeasured(await measureAll(collectMeasures(d, roles), measure), strictWidths()));
    return { ...laid, measure };
}
