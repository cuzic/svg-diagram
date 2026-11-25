import { band } from '../band-def.js';
import { statusSpotlight, renderStatus } from '../emit-status.js';
import { snapGrid } from '../layout-util.js';
import { layoutStatus, statusText, statusTexts } from '../status.js';
import { statusRects } from '../verify-rects.js';
/** @internal Shared wording for the diagram-level finding. */
export function draftStatusFinding(status) {
    return { rule: 'draft-status', severity: 'info', message: `この図は下書き(status: '${status}')。公開前に外す` };
}
const definition = {
    type: 'status',
    spotlight: statusSpotlight,
    verify: {
        rects: statusRects,
        figureExtent: () => null,
        diagramFindings: ({ accept }) => accept?.['draft-status'] ? [] : [draftStatusFinding('draft')],
    },
    textSizes: band => [band.size],
    measure(data, { atoms, roles }) {
        for (const [text, size, weight, font] of statusTexts(data, roles))
            atoms(text, size, weight, font);
    },
    layout(data, { x, y, w, widthOf, roles }) {
        const laid = layoutStatus(data, x, snapGrid(y), w, widthOf, roles);
        return { laid, h: laid.h };
    },
    emit: renderStatus,
};
/** A status strip. Put it first to place the badge above the content. */
export function status(value, label) {
    if (value !== 'draft')
        throw new Error('status(): status must be "draft"');
    if (label !== undefined && (typeof label !== 'string' || !label.trim() || /[\r\n]/.test(label))) {
        throw new Error('status(): label must be a non-empty single-line string');
    }
    return band(definition, { type: 'status', status: value, text: statusText({ statusLabel: label }) });
}
/** @internal Definition used by the full renderer. */
export const statusDefinition = definition;
