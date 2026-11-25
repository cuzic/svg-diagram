import { revealOf, scopeOpt, withAnchors, withHandle } from './shared.js';
export function gantt(rows, opts = {}) {
    if (!Array.isArray(rows) || !rows.some(r => !('section' in r)))
        throw new Error('gantt(rows) needs at least one task');
    for (const r of rows) {
        if ('section' in r) {
            if (typeof r.section !== 'string' || !r.section.trim())
                throw new Error('gantt(): a section needs a title');
            continue;
        }
        if (r.tone !== undefined && !['accent', 'danger', 'muted'].includes(r.tone))
            throw new Error(`gantt(): "${r.label}" tone must be accent, danger or muted (got ${String(r.tone)})`);
    }
    const band = { type: 'gantt', rows: [...rows], ...(opts.from === undefined ? {} : { from: opts.from }), ...(opts.to === undefined ? {} : { to: opts.to }), ...(opts.today === undefined ? {} : { today: opts.today }), ...(opts.todayLabel === undefined ? {} : { todayLabel: opts.todayLabel }), ...(opts.extendToToday === undefined ? {} : { extendToToday: opts.extendToToday }), ...(opts.id === undefined ? {} : { id: opts.id }), ...scopeOpt(opts, 'gantt()'), ...revealOf(opts) };
    return withAnchors(withHandle(band, opts.id), rows.map(r => 'id' in r ? r.id : undefined));
}
