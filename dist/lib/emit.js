import { connectorSvgDefs, renderConnect } from './emit-connect.js';
import { definitionsOf } from './figure-definitions.js';
import { spotlighter } from './spotlight-core.js';
import { colorOf } from './tokens.js';
import { withNodeIds } from './emit-node-ids.js';
import { emitSvgWith } from './emit-svg-core.js';
import { withParts } from './parts.js';
import { diagramTitle, diagramDesc } from './diagram-summary.js';
import { spotlightDim } from './emit-spotlight.js';
export { resolveTextColor, resolveBoxStyle } from './emit-common.js';
export { renderFlowShape } from './emit-flow-shape.js';
// A placed band is drawn by the definition of its type.
export const renderBandWith = (definitionOf) => (band, theme, tones, roles, stage, dimFill) => {
    const def = definitionOf(band);
    if (!def) {
        throw new Error(`svg-diagram: no definition for the "${band.type}" band. emitSvg / emitHtml need the laid-out figure as the renderer returns it (its bands carry their definitions; a JSON or structuredClone copy loses them), or the definitions passed explicitly (the \`definitions\` option of emitHtml, the \`definitionOf\` argument of emitSvg)`);
    }
    const svg = def.emit(band, { theme, tones, roles, stage, dimFill, color: key => colorOf(key, theme) });
    return spotlighter.renderBand(band, svg, def);
};
/**
 * `definitionOf`: the definition of each placed band. The default finds them among the definitions the figure's own bands carry, which is
 * every band a selective entry drew; a full entry passes the table of the built-in definitions (placed-definitions.ts).
 * `parts`: mark each part's elements with `data-part` (ADR 0054), for the PowerPoint export; nothing else changes.
 */
export function emitSvg(laidOutDiagram, opts = {}, definitionOf = definitionsOf(laidOutDiagram.bands, opts.definitions)) {
    const named = opts.nodeIds ? withNodeIds(laidOutDiagram, definitionOf) : laidOutDiagram;
    const services = {
        connectorDefs: connectorSvgDefs, defsNeeded: (band) => definitionOf(band)?.svgDefs?.(band) ?? {},
        renderBand: renderBandWith(definitionOf), renderConnect, diagramTitle, diagramDesc, spotlightDim,
    };
    return emitSvgWith(services, opts.parts ? withParts(named) : named, opts);
}
