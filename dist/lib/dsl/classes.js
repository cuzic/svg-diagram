import { graphTones, resolveFocus } from '../focus.js';
import { must } from '../must.js';
import { revealOf, scopeOpt, TREE_TONES, withAnchors, withHandle } from './shared.js';
export function classDiagram(classes, relations, opts = {}) {
    if (!Array.isArray(classes) || classes.length === 0)
        throw new Error('classDiagram(classes, relations) needs at least one class');
    if (opts.straighten !== undefined && typeof opts.straighten !== 'boolean')
        throw new Error(`classDiagram(): straighten must be true or false (got ${String(opts.straighten)})`);
    if (opts.dir !== undefined && opts.dir !== 'down' && opts.dir !== 'right' && opts.dir !== 'auto')
        throw new Error(`classDiagram(): dir must be 'down', 'right' or 'auto' (got ${String(opts.dir)})`);
    for (const c of classes)
        if (c.tone !== undefined && !TREE_TONES.includes(c.tone))
            throw new Error(`classDiagram(): class "${c.id}" has tone ${String(c.tone)} (use ${TREE_TONES.join(', ')})`);
    const band = { type: 'classes', classes: [...classes], relations: [...relations], ...(opts.dir === undefined ? {} : { dir: opts.dir }), ...(opts.straighten === undefined ? {} : { straighten: opts.straighten }), ...(opts.id === undefined ? {} : { id: opts.id }), ...scopeOpt(opts, 'classDiagram()'), ...revealOf(opts) };
    if (opts.focus !== undefined) {
        const ids = classes.map(c => c.id), hit = resolveFocus(opts.focus, ids, 'classDiagram()');
        const tones = graphTones(ids.length, relations.map(r => [ids.indexOf(r.from), ids.indexOf(r.to)]), hit);
        band.classes = band.classes.map((c, i) => ({ ...c, tone: must(tones[i]) }));
        band.focused = [...hit].map(i => must(ids[i]));
    }
    return withAnchors(withHandle(band, opts.id), classes.map(c => c.id));
}
