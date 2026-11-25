import { quadrantBand } from '../quadrant.js';
import { withHandle } from './shared.js';
export { pyramid } from './pyramid.js';
export { curve } from './curve.js';
export { plane } from './plane.js';
/**
 * A classification matrix (2x2, 3x3 or any N x M) between two axes: cells with a caption, items placed in a cell or at coordinates,
 * optional bubble sizes (area proportional to the value, with a legend), movement arrows. Every item with an id is an anchor for
 * connect() / spotlight; items never overlap each other, a label or a caption (they move within their cell, or the rows grow).
 *   quadrant({preset: 'bcg', sizeTitle: '売上', sizeUnit: '億円', items: [{id: 'a', label: '製品 A', at: [0.8, 0.9], size: 120}, {label: '製品 B', cell: [1, 0]}]})
 *   quadrant({x: {title: '価格', low: '安い', high: '高い'}, y: {title: '品質', low: '低い', high: '高い'}, crosshair: true, items: [...]})
 * Item `at` is in value space ([1, 1] = high on both axes, whichever way the axis is drawn); `cell` is [col, row] from the top-left as drawn.
 */
export const quadrant = Object.assign((opts) => withHandle(quadrantBand(opts), opts?.id), { preset: (name, opts = {}) => withHandle(quadrantBand({ ...opts, preset: name }), opts.id) });
export { chevron, concentric, cycle, emblem, funnel, valueChain, venn } from './flow.js';
export { wordart } from './wordart.js';
