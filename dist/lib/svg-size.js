import { must } from './must.js';
/** The SVG's own width and height (the root's attributes, or its viewBox). */
export function svgSize(svg) {
    const root = /<svg\b[^>]*>/.exec(svg)?.[0] ?? '';
    const num = (n) => { const m = new RegExp(`\\s${n}="([0-9.]+)(?:px)?"`).exec(root); return m ? parseFloat(must(m[1])) : NaN; };
    let w = num('width'), h = num('height');
    if (!(w > 0 && h > 0)) {
        const vb = /viewBox="[-0-9.]+[ ,]+[-0-9.]+[ ,]+([0-9.]+)[ ,]+([0-9.]+)"/.exec(root);
        if (vb) {
            w = parseFloat(must(vb[1]));
            h = parseFloat(must(vb[2]));
        }
    }
    return w > 0 && h > 0 ? { w, h } : null;
}
