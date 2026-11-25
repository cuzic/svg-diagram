import { band } from '../band-def.js';
import { legend as build } from '../dsl/legend.js';
import { legendSvgDefs, renderLegend } from '../emit-legend.js';
import { missingLegendItems } from '../legend-notation.js';
import { layoutLegend } from '../layout-legend.js';
const definition = {
    type: 'legend',
    verify: { figureExtent: () => null, legendNotation: data => data },
    measure(data, { atoms, roles }) {
        for (const item of data.items)
            atoms(item.label, roles.note, 400);
    },
    layout(data, { x, y, w, widthOf, roles }) {
        const laid = layoutLegend(data, x, y, w, widthOf, roles);
        return { laid, h: laid.h };
    },
    emit: (laid, { theme, tones, roles }) => renderLegend(laid, theme, tones, roles),
    svgDefs: legendSvgDefs,
};
export function legend(items, opts) {
    return band(definition, build(items, opts));
}
/** Build the legend for the notation in a selected diagram, if it needs any entries. */
export function autoLegend(bands, labels, dimmed) {
    const items = missingLegendItems(bands, labels, dimmed);
    return items.length ? legend(items) : undefined;
}
/** @internal Definition used by the full renderer. */
export const legendDefinition = definition;
