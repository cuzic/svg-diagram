import { banner, caption, stat } from './dsl/text-bands.js';
import { row } from './dsl/containers.js';
const SIDE_MAX_STEPS = 4;
const SIDE_STAT_FLEX = 1.5; // the number is wider than a step (a step has flex 1)
export function hero(opts) {
    if (!opts || typeof opts !== 'object' || !opts.stat || opts.stat.value === undefined || opts.stat.label === undefined)
        throw new Error('hero(): needs a stat: {value, label}');
    if (!Array.isArray(opts.flow) || opts.flow.length === 0)
        throw new Error('hero(): needs a flow of at least one box()');
    for (const [i, s] of opts.flow.entries())
        if (s?.type !== 'box')
            throw new Error(`hero(): flow[${i}] is ${s?.type === undefined ? 'not a band' : `a ${s.type}()`}, but a flow takes box() only`);
    const layout = opts.layout ?? (opts.flow.length <= SIDE_MAX_STEPS ? 'side' : 'stack');
    if (layout !== 'side' && layout !== 'stack')
        throw new Error(`hero(): layout must be 'side' or 'stack' (got ${String(layout)})`);
    const { value, label, ...statOpts } = opts.stat;
    const number = stat(value, label, { ...statOpts, size: statOpts.size ?? 'display', flex: statOpts.flex ?? (layout === 'side' ? SIDE_STAT_FLEX : undefined) });
    const out = [];
    if (opts.banner)
        out.push(banner(opts.banner));
    if (layout === 'side')
        out.push(row([...opts.flow, number], { arrows: 'between' }));
    else
        out.push(row([number]), row([...opts.flow], { arrows: 'between' }));
    if (opts.caption !== undefined)
        out.push(caption(opts.caption, { bold: true, tone: 'text' }));
    if (opts.note !== undefined)
        out.push(caption(opts.note));
    return out;
}
