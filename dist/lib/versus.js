import { group } from './dsl/text-bands.js';
import { row, spacer } from './dsl/containers.js';
import { connect } from './dsl/connect.js';
function asGroup(part) {
    if (part.direction !== undefined && part.direction !== 'column' && part.direction !== 'row')
        throw new Error(`versus(): direction must be 'column' or 'row' (got ${String(part.direction)})`);
    const kids = part.children;
    const children = part.direction === 'row' && Array.isArray(kids) && kids.length > 1 ? row(kids, { cols: 12 }) : kids;
    return group(children, { title: part.title, tone: part.tone, id: part.id, reveal: part.reveal });
}
export function versus(left, right, opts = {}) {
    const leftGroup = asGroup(left);
    const rightGroup = asGroup(right);
    const sides = row([leftGroup, rightGroup], { cols: [6, 6] });
    if (!opts.shared)
        return [sides];
    if (!left.id || !right.id || !opts.shared.id)
        throw new Error('versus(): left, right and shared need an id when shared is used');
    const shared = asGroup(opts.shared);
    const style = { ...(opts.connectRoute === undefined ? {} : { route: opts.connectRoute }), ...(opts.connectArrow === undefined ? {} : { arrow: opts.connectArrow }) };
    return [
        sides,
        spacer(opts.connectLabels ? 48 : 28), // room for the arrows (and their labels) between the frames
        shared,
        // plumb: each line ends straight below the middle of its side, not at a fixed 1/4 / 3/4 of the shared top (which sits a few px off it)
        { ...connect(`${left.id}:bottom`, `${opts.shared.id}:top@0.25`, { ...style, ...(opts.connectLabels?.left === undefined ? {} : { label: opts.connectLabels.left }) }), plumb: true },
        { ...connect(`${right.id}:bottom`, `${opts.shared.id}:top@0.75`, { ...style, ...(opts.connectLabels?.right === undefined ? {} : { label: opts.connectLabels.right }) }), plumb: true },
    ];
}
