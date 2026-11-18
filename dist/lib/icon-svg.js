// The SVG of one installed icon: its path (or shapes) scaled from the set's viewBox to `size`, with its top-left at (x, y). Shared by every
// primitive that can carry an icon (box, table cell, state, sankey node).
import { prefixIds } from './icon-store.js';
export function iconSvg(o) {
    const g = o.glyph, { vb: [vx, vy, vs] } = g, s = o.size / vs;
    const n = (v) => +v.toFixed(4);
    const a11y = o.labelled ? 'aria-hidden="true"' : `role="img" aria-label="${o.name}"`;
    const at = `transform="translate(${n(o.x - vx * s)} ${n(o.y - vy * s)}) scale(${n(s)})"`;
    if (g.body === undefined)
        return `<path d="${g.d}" ${at} fill="${o.color}"${g.rule ? ' fill-rule="evenodd"' : ''} ${a11y} data-icon="${o.name}"/>`;
    // shapes drawn the way the set drew them: `currentColor` is the tone colour; an icon with colours of its own keeps them (faded when dimmed)
    // (ids inside it are made unique to this place: the same icon drawn twice must not share a gradient id)
    const inner = prefixIds(g.body.replaceAll('currentColor', o.color), `ic-${Math.round(o.x)}-${Math.round(o.y)}-`);
    return `<g ${at} fill="${o.color}"${g.fixed ? ` data-icon-fixed="true"${o.dim ? ' opacity="0.35"' : ''}` : ''} ${a11y} data-icon="${o.name}">${inner}</g>`;
}
