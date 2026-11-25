import { assertNoReveal } from './shared.js';
export function pyramid(layers, opts = {}) {
    assertNoReveal(opts, 'pyramid()');
    if (!Array.isArray(layers) || layers.length < 2)
        throw new Error('pyramid(layers) needs at least 2 layers, bottom to top');
    return {
        type: 'pyramid',
        layers: layers.map(l => typeof l === 'string' ? { text: l } : l),
        width: opts.width,
        layerHeight: opts.layerHeight ?? 76,
        apexRatio: opts.apexRatio ?? 0.3,
    };
}
