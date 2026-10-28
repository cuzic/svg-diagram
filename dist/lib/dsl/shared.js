import { MIN_FONT_SIZE, isSolidTone } from '../tokens.js';
import { assertScope, scopeOf } from '../scope-name.js';
// `const list = box({id: 'list'})`: a band built with an id also works as a handle (`list.right`, `list.at('top', 0.25)`),
// so connect() can name it without typing the id again. The helpers are NON-enumerable properties: spreading or
// serialising a band, and every existing consumer of bands, sees exactly what it saw before.
export function handleFor(id) {
    const side = (s) => `${id}:${s}`;
    return {
        left: { value: side('left') }, right: { value: side('right') }, top: { value: side('top') }, bottom: { value: side('bottom') }, center: { value: side('center') },
        at: { value: (s, t) => `${id}:${s}@${t}` },
    };
}
export function withHandle(band, id) {
    if (id)
        Object.defineProperties(band, handleFor(id));
    return band;
}
// screens() / swimlane(): `.anchors.<id>` is the handle of each item / step that has an id.
// A band built with {scope} registers its items as `<scope>.<id>` (ADR 0012), so the handle names the item that way: `.anchors.p0.right` is 'plan.p0:right'.
export function withAnchors(band, ids) {
    const anchors = {};
    const scope = scopeOf(Array.isArray(band) ? band[0] ?? {} : band);
    for (const id of ids)
        if (id) {
            const name = scope ? `${scope}.${id}` : id;
            anchors[id] = Object.defineProperties({ id: name }, handleFor(name));
        }
    return Object.defineProperty(band, 'anchors', { value: anchors });
}
// `scope` goes onto a band only when it was given (ADR 0012), so a band built without it is byte-for-byte what it was.
export const scopeOpt = (opts, what) => {
    assertScope(opts?.scope, what);
    return opts?.scope === undefined ? {} : { scope: opts.scope };
};
// `reveal` goes onto a band only when it was given, so a band built without it is byte-for-byte what it was.
export const revealOf = (opts) => ({ ...(opts.reveal === undefined ? {} : { reveal: opts.reveal }), ...(opts.until === undefined ? {} : { until: opts.until }) });
// A constructor with no `reveal` (legend, spacer, raw, ...) refuses one instead of dropping it: the types already do, a JS caller is told here.
export function assertNoReveal(opts, what) {
    if (opts && ['reveal', 'until'].some(k => k in opts && opts[k] !== undefined))
        throw new Error(`${what}: takes no reveal — it is shown from the start (reveal goes on box, banner, stat, caption, group, row's children, table, sequence, swimlane, plane, bars and connect)`);
}
// group / table rows / sequence / swimlane lanes carry dark text (or white boxes) on their fill, which a solid fill would swallow:
// the types leave 'solid' / 'solid-danger' out (BoxTone), and this is the same rule for JS callers.
export function assertBoxTone(tone, what) {
    if (isSolidTone(tone))
        throw new Error(`${what}: tone '${tone}' is for box() / banner() / stat() / a swimlane step / a legend item only — what sits on it would read dark on the fill; use 'accent' here`);
}
// A JS caller (or a typo past the editor) can pass a value the types would refuse; a band built from it draws something other than what was
// written without a word. Same message shape as assertTextRole.
export function assertOneOf(value, allowed, what) {
    if (value !== undefined && !allowed.includes(value))
        throw new Error(`${what} must be ${allowed.map(r => `'${r}'`).join(' | ')} (got ${JSON.stringify(value)})`);
}
export const ALIGNS = ['left', 'center', 'right'];
export const TEXT_TONES = ['text', 'accent', 'muted', 'danger'];
export const EMPHASIS_TONES = ['plain', 'accent', 'new', 'changed', 'removed', 'muted', 'danger', 'solid', 'solid-danger'];
export function assertTextRole(role, allowed, what) {
    if (role !== undefined && !allowed.includes(role))
        throw new Error(`${what} must be ${allowed.map(r => `'${r}'`).join(' | ')} (got ${JSON.stringify(role)})`);
}
// A band copied with the same properties (including the non-enumerable handles) so a diagram's defaults never change the
// object the caller holds — the same band can be added to another diagram with other defaults (or none).
export function cloneBand(b) {
    return Object.create(Object.getPrototypeOf(b), Object.getOwnPropertyDescriptors(b));
}
/** Maps a band list; a container is copied only when something inside it changed. */
export function mapBands(bands, fn) {
    return bands.map(b => {
        const changed = fn(b);
        if (changed)
            return changed;
        if ('children' in b && Array.isArray(b.children)) {
            const kids = mapBands(b.children, fn);
            if (kids.some((k, i) => k !== b.children[i]))
                return Object.assign(cloneBand(b), { children: kids });
        }
        return b;
    });
}
export function assertFontSize(size) {
    if (size < MIN_FONT_SIZE) {
        throw new Error(`font-size ${size} is below the ${MIN_FONT_SIZE}px floor — this deck never uses smaller text. Reconsider the layout instead of shrinking the text.`);
    }
}
