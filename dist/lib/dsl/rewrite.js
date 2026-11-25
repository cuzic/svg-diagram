// rewrite(bands, fn): restyle bands by a condition (ADR 0050 D2), and diagram({transform}) (D3). Pure.
import { assertSolidText } from '../rich.js';
import { ALIGNS, assertBoxTone, assertOneOf, cloneBand, EMPHASIS_TONES, TEXT_TONES } from './shared.js';
import { SHELLED } from './wireframe-numbering.js';
const SHOWN = ['reveal', 'until'];
// The bands whose constructor calls assertNoReveal: they are shown from the start (a row's children carry their own reveal). The rest take one.
const NO_REVEAL = ['spacer', 'row', 'grouprow', 'grid', 'areas', 'legend', 'raw', 'wireframe', 'screens', 'people', 'dots', 'math', 'pyramid', 'curve'];
const KEYS = {
    box: ['tone', 'dashed', 'titleTone', 'bodyTone', 'noteTone', 'iconTone', 'align', ...SHOWN],
    group: ['tone', 'dashed', 'titleTone', ...SHOWN],
    caption: ['tone', 'bold', 'mono', 'align', ...SHOWN],
    connect: ['line', 'arrow', 'weight', ...SHOWN],
};
const textTone = (k) => (v, what) => assertOneOf(v, TEXT_TONES, `${what} ${k}`);
const CHECKS = {
    tone: (b, v, what) => { assertOneOf(v, b.type === 'caption' ? TEXT_TONES : EMPHASIS_TONES, `${what} tone`); if (b.type === 'group')
        assertBoxTone(v, what); },
    titleTone: (_b, v, w) => textTone('titleTone')(v, w), bodyTone: (_b, v, w) => textTone('bodyTone')(v, w),
    noteTone: (_b, v, w) => textTone('noteTone')(v, w), iconTone: (_b, v, w) => textTone('iconTone')(v, w),
    align: (_b, v, w) => assertOneOf(v, ALIGNS, `${w} align`),
    line: (_b, v, w) => assertOneOf(v, ['solid', 'dashed', 'dotted', 'double'], `${w} line`),
    arrow: (_b, v, w) => assertOneOf(v, ['end', 'both', 'start', 'none'], `${w} arrow`),
    weight: (_b, v, w) => assertOneOf(v, ['strong'], `${w} weight`),
};
/** The patch laid over a copy of the band (the handles and the record of what was written are kept by cloneBand). */
function patched(b, patch) {
    const what = `rewrite(${b.type})`;
    const allowed = (KEYS[b.type] ?? (NO_REVEAL.includes(b.type) ? [] : SHOWN));
    const given = Object.entries(patch).filter(([, v]) => v !== undefined);
    if (given.length === 0)
        return b;
    for (const [k, v] of given) {
        if (!allowed.includes(k))
            throw new Error(`${what}: cannot change '${k}' — a rewrite changes the look only (${allowed.join(', ')}), never the text, an id or what a connector joins`);
        if ((k === 'reveal' || k === 'until') && !(Number.isInteger(v) && v >= 0))
            throw new Error(`${what}: ${k} must be a whole number, 0 or more (got ${JSON.stringify(v)})`);
        CHECKS[k]?.(b, v, what);
    }
    if ('annot' in b && b.annot && ['arrow', 'line', 'weight'].some(k => k in Object.fromEntries(given)))
        throw new Error(`${what}: a ${b.annot.kind}() has a fixed line and arrow — only reveal and until can change`);
    if (b.type === 'caption' && b.spans && given.some(([k]) => k === 'bold'))
        throw new Error(`${what}: this caption has em.* parts, which decide their own weight — bold cannot be changed`);
    if (b.type === 'group' && b.frame === false && given.some(([k]) => k === 'tone' || k === 'dashed'))
        throw new Error(`${what}: a group({frame: false}) draws no frame, so it takes no tone or dashed`);
    const out = Object.assign(cloneBand(b), Object.fromEntries(given));
    if (out.type === 'group' && patch.tone !== undefined && patch.dashed === undefined) { // group({tone: 'plain'}) is dashed unless told otherwise
        if (patch.tone === 'plain' && out.dashed === undefined)
            out.dashed = true;
        else if (patch.tone !== 'plain' && b.tone === 'plain' && b.dashed === true)
            out.dashed = undefined; // leaving plain takes the derived dash with it
    }
    if (b.type === 'box')
        assertSolidText(out, what);
    if (SHELLED.has(b))
        SHELLED.add(out);
    if (out.type === 'connect' && out.weight && out.line === 'double')
        throw new Error(`${what}: weight '${out.weight}' cannot go with line 'double'`);
    return out;
}
export function rewrite(bands, fn, path = [], seen = new Map()) {
    // a band placed in two spots stays one band: the result of the first visit is used again, when the kinds of band around it are the same too
    // (a rule that looks at the path sees the same band under another path asked again; one that reads an ancestor's own fields gets the first visit's answer)
    const out = bands.map(b => {
        const known = seen.get(b)?.find(k => k.path.length === path.length && k.path.every((p, i) => p.type === path[i]?.type));
        if (known)
            return known.out;
        const done = rewriteOne(b, fn, path, seen);
        seen.set(b, [...(seen.get(b) ?? []), { path, out: done }]);
        return done;
    });
    return out.some((b, i) => b !== bands[i]) ? out : bands;
}
function rewriteOne(orig, fn, path, seen) {
    const patch = fn(orig, path);
    let cur = patch ? patched(orig, patch) : orig;
    const inner = [...path, cur]; // the patched band: a rule that reads an ancestor sees what it now is
    if (cur.type === 'swimlane') {
        const steps = rewrite(cur.steps, fn, inner, seen);
        if (steps !== cur.steps)
            cur = Object.assign(cloneBand(cur), { steps });
    }
    if ('children' in cur && Array.isArray(cur.children)) {
        const kids = rewrite(cur.children, fn, inner, seen);
        if (kids !== cur.children)
            cur = Object.assign(cloneBand(cur), { children: kids });
    }
    if (cur.type === 'tree') {
        const root = rewriteItem(cur.root, fn, inner, seen);
        if (root !== cur.root)
            cur = Object.assign(cloneBand(cur), { root });
    }
    return cur;
}
function rewriteItem(item, fn, path, seen) {
    const band = item.band ? rewrite([item.band], fn, path, seen)[0] : undefined;
    const kids = item.children?.map(c => rewriteItem(c, fn, path, seen));
    const changed = (band !== undefined && band !== item.band) || (kids?.some((k, i) => k !== item.children?.[i]) ?? false);
    return changed ? { ...item, ...(band ? { band } : {}), ...(kids ? { children: kids } : {}) } : item;
}
/** A band of one of these types. */
export const isType = (...types) => b => types.includes(b.type);
/** A band that sits inside a band of this type (any depth). */
export const within = (type) => (_b, path) => path.some(p => p.type === type);
/** `when(isType('box'), {tone: 'muted'})`: the patch for the bands every predicate holds for. */
export const when = (pred, patch) => (b, path) => [pred].flat().every(p => p(b, path)) ? patch : undefined;
