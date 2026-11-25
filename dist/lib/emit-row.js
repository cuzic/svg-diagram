import { dimChildren } from './emit-spotlight.js';
import { renderBox } from './emit-box.js';
import { childTextSvgDefs } from './emit-box-defs.js';
import { snap4 } from './emit-common.js';
import { must } from './must.js';
import { visibleAt } from './reveal-visibility.js';
import { PALETTE } from './tokens.js';
export function rowSvgDefs(band) {
    return { ...childTextSvgDefs(band), arrow: band.arrows.length > 0 };
}
export function renderRow(band, day, tones, roles, stage) {
    const boxes = band.children.filter(c => visibleAt(c, stage)).map(c => renderBox(c, day, tones, roles)).join('\n\n  ');
    const arrows = band.arrows.filter((_, i) => visibleAt(must(band.children[i]), stage) && visibleAt(must(band.children[i + 1]), stage)).map(a => `<path d="M${snap4(a.x1)},${Math.round(a.y1)} L${snap4(a.x2)},${Math.round(a.y2)}" fill="none" stroke="${band.dim ? PALETTE.muted : PALETTE.text}" stroke-width="2.5" marker-end="url(#${band.dim ? 'dsl-arrow-dim' : 'dsl-arrow'})"/>`).join('\n  ');
    return arrows ? `${boxes}\n\n  ${arrows}` : boxes;
}
export function rowSlot(band, id) {
    if (!band.id || !id.startsWith(`${band.id}#`))
        return undefined;
    const slot = id.slice(band.id.length + 1);
    return /^\d+$/.test(slot) ? band.children[Number(slot) - 1] : undefined;
}
export const rowSpotlight = {
    dim: dimChildren,
    targets(band, id, endpoint) {
        const slot = endpoint ? undefined : rowSlot(band, id);
        return [...(slot ? [slot] : []), ...band.children.filter(c => c.id === id)];
    },
};
