import { textWidth } from './atoms.js';
import { isSolidTone } from './tokens.js';
import { resolveFocus, sequenceTones } from './focus.js';
import { wrapText } from './wrap.js';
import { must } from './must.js';
export const BOX_TONES = new Set(['plain', 'accent', 'new', 'changed', 'removed', 'muted', 'danger', 'solid', 'solid-danger']);
export const TEXT_TONES = new Set(['text', 'accent', 'muted', 'danger']);
export function common(name, xs, id) {
    if (!xs.length)
        throw new Error(`${name}(): at least one item is required`);
    const ids = new Set();
    for (const [i, x] of xs.entries()) {
        if (!x.label?.trim())
            throw new Error(`${name}(): item ${i + 1} needs a non-empty label`);
        if (x.id && (x.id === id || ids.has(x.id)))
            throw new Error(`${name}(): duplicate id "${x.id}"`);
        if (x.id)
            ids.add(x.id);
    }
}
/** focus on a sequence (ADR 0051): a copy of the items, the focused ones 'solid' and the rest 'muted' (by id or 1-based number). */
export function focusItems(name, items, focus) {
    if (focus === undefined)
        return [...items];
    const tones = sequenceTones(items.length, resolveFocus(focus, items.map(x => x.id), `${name}()`, true));
    return items.map((x, i) => ({ ...x, tone: must(tones[i]) }));
}
/** The text tone on a filled (solid) item: white; otherwise the tone given. */
export const onItem = (tone, base) => isSolidTone(tone) ? 'bg' : base;
export function checkTones(name, xs, allowed) {
    xs.forEach((x, i) => { if (x.tone && !allowed.has(x.tone))
        throw new Error(`${name}(): item ${i + 1} has unknown tone "${x.tone}" (${[...allowed].join(' | ')})`); });
}
/** The advice for a figure too narrow for its band (ADR 0065): its own `width` when that is what holds it in, else the diagram's (the band's
 * plus the default margins, 20px each side). A spec has no width: spec.ts leaves this out (inSpecTerms). */
export const WIDEN = (b, need) => b.width !== undefined && b.width < need ? `give it width: ${need} or more` : `widen the diagram (diagram({width: ${need + 40}}) or more)`;
/** A 1-based number, or a label / id, as a 0-based index of `xs`. A name two of them answer to (one's label, another's id; or two with one
 * label) is refused: it would silently take the first. */
export function refIndex(name, what, ref, xs) {
    if (typeof ref === 'string') {
        const all = xs.flatMap((x, k) => x.id === ref || x.label === ref ? [k] : []);
        if (all.length > 1)
            throw new Error(`${name}(): ${what} ${JSON.stringify(ref)} names ${all.length} of them (${all.map(k => k + 1).join(', ')}: a label or id twice) — give its number, or an id of its own`);
    }
    const i = typeof ref === 'number' ? (Number.isInteger(ref) && ref >= 1 && ref <= xs.length ? ref - 1 : -1) : xs.findIndex(x => x.id === ref || x.label === ref);
    if (i < 0)
        throw new Error(`${name}(): ${what} ${JSON.stringify(ref)} is not one of them (1..${xs.length}, or ${xs.map(x => `"${x.id ?? x.label}"`).join(' / ')})`);
    return i;
}
/** The item an item's frame names (ADR 0034): the id, when it has one. */
export const nodeOf = (item) => item.id ? { node: item.id } : {};
export const LINE = 1.35; // line step, in font sizes
export const g4 = (v) => Math.round(v / 4) * 4; // circle centres and frames sit on the 4px grid (lint: coordinate-grid)
export function placeFlowShape(b, x, y, cw, widthOf, roles, mode, draw) {
    const w = Math.min(cw, b.width ?? cw), ox = x + (cw - w) / 2;
    const out = { type: b.type, id: b.id, reveal: b.reveal, until: b.until, x: ox, y, w, h: 0, primitives: [], texts: [], anchors: [], labelBoxes: [] };
    const t = new Texts(out, widthOf, roles, mode);
    const anchor = (id, r, part) => { if (id)
        out.anchors.push({ id, ...r, ...(part ? { part } : {}) }); };
    draw(b, out, t, anchor, roles);
    return out;
}
/** A wrapped text block: measure it first (lines, height), then place it. */
export class Texts {
    out;
    widthOf;
    roles;
    mode;
    constructor(out, widthOf, roles, mode) { this.out = out; this.widthOf = widthOf; this.roles = roles; this.mode = mode; }
    wrap(text, maxW, weight = 700, size = this.roles.note) {
        const atomWidth = (a) => this.widthOf(a, size, weight, 'sans');
        const lines = wrapText(text, { maxWidth: Math.max(24, maxW), atomWidth, mode: this.mode });
        return { text, lines, h: lines.length * size * LINE, w: Math.max(...lines.map(l => textWidth(this.widthOf, l, size, weight))), size, weight };
    }
    width(text, weight = 700, size = this.roles.note) { return textWidth(this.widthOf, text, size, weight); }
    /** The height of one line of note text. */
    lineH() { return this.roles.note * LINE; }
    /** Places a wrapped block with its top at `top`; `x` is its centre (middle), left edge (start) or right edge (end). */
    /** `xAt`: a line's own x for the height its middle is at (a slanted shape whose room moves sideways with the height), else `x` for every line. */
    place(block, x0, top, tone = 'text', anchor = 'middle', part, xAt) {
        const { size, weight } = block;
        block.lines.forEach((line, i) => {
            const tw = textWidth(this.widthOf, line, size, weight), ty = top + i * size * LINE + size * ((LINE - 1.2) / 2 + 1); // the glyph box (1.2 sizes) centred in its line
            const x = xAt ? xAt(ty - size * 0.4) : x0;
            const left = anchor === 'middle' ? x - tw / 2 : anchor === 'start' ? x : x - tw;
            const box = { x: left, y: ty - size, w: tw, h: size * 1.2 };
            this.out.texts.push({ text: line, tx: x, ty, size, weight, anchor, tone, ...box, ...(part ? { part } : {}) });
            this.out.labelBoxes.push({ label: block.text, ...box });
        });
    }
}
