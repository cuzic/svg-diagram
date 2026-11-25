import { assertNoReveal, withAnchors, withHandle } from './shared.js';
import { NUMBERING, autoNumber } from './wireframe-numbering.js';
export function wireframe(root, opts = {}) {
    assertNoReveal(opts, 'wireframe()');
    const numbering = autoNumber(root, opts.overlays);
    return Object.defineProperty(withHandle({ type: 'wireframe', root, ...opts }, opts.id), NUMBERING, { value: numbering });
}
export function screens(items, opts = {}) {
    assertNoReveal(opts, 'screens()');
    return withAnchors({ type: 'screens', items, ...opts }, items.map(i => i.id));
}
