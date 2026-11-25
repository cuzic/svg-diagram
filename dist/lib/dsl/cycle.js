import { cycleBand } from '../flow-cycle.js';
import { withHandle } from './shared.js';
/**
 * Three to eight nodes joined as a closed circular process. Node ids are anchors for connect() and spotlight.
 * With `links` (ADR 0065) the nodes sit on a regular polygon (four on a square) joined pair by pair instead — 'all' (every pair, two-way) or
 * [{from, to, label, direction: 'forward'}] — and `frame` puts a named frame round it: the CBT five-part model.
 *   cycle([{label: '思考'}, {label: '感情'}, {label: '行動'}, {label: '身体'}], {links: 'all', frame: '状況・環境'})
 */
export function cycle(steps, opts) { return withHandle(cycleBand(steps, opts), opts?.id); }
