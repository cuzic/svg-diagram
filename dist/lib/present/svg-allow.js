// ADR 0056 D3: the allowlist a slide's SVG must pass before it is saved (D5) or accepted by the Worker (D12). Pure (no Node APIs):
// it runs in a Cloudflare Worker too. A slide that does not pass is refused with the places that failed, not repaired.
//
// The markup is read by a small strict XML tokenizer, not by regexes over the whole text, so quoting, comments and CDATA cannot hide
// an element or an attribute from the check. Anything malformed stops the check with a problem: what this reader cannot parse, a
// browser might parse differently.
/** The elements a slide may contain: what the renderer, `outlineText` (live emoji) and the color emoji / image bands emit. */
export const ALLOWED_ELEMENTS = [
    'svg', 'g', 'defs', 'symbol', 'use', 'title', 'desc', 'style',
    'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'image', 'text', 'tspan',
    'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'pattern', 'marker',
    'filter', 'feColorMatrix', 'feGaussianBlur', 'feOffset', 'feFlood', 'feComposite', 'feBlend', 'feMerge', 'feMergeNode',
];
/** The attributes a slide may use, on any allowed element (`href` only on HREF_ELEMENTS). Also every `data-*` and `aria-*`. */
export const ALLOWED_ATTRIBUTES = [
    // core
    'id', 'class', 'style', 'lang', 'role', 'version', 'xmlns', 'xmlns:xlink', 'xml:space', 'href', 'xlink:href',
    // geometry
    'x', 'y', 'width', 'height', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'fx', 'fy', 'fr', 'd', 'points', 'pathLength',
    'transform', 'viewBox', 'preserveAspectRatio',
    // text
    'dx', 'dy', 'rotate', 'textLength', 'lengthAdjust', 'text-anchor', 'dominant-baseline', 'alignment-baseline', 'baseline-shift',
    'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant', 'font-stretch', 'letter-spacing', 'word-spacing',
    'text-decoration', 'writing-mode', 'direction', 'unicode-bidi',
    // painting
    'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin',
    'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'opacity', 'color', 'paint-order', 'vector-effect', 'visibility',
    'display', 'overflow', 'shape-rendering', 'text-rendering', 'image-rendering', 'color-interpolation', 'color-interpolation-filters',
    'clip-path', 'clip-rule', 'mask', 'filter', 'marker-start', 'marker-mid', 'marker-end',
    // gradients, clips, masks, patterns, markers
    'offset', 'stop-color', 'stop-opacity', 'gradientUnits', 'gradientTransform', 'spreadMethod', 'clipPathUnits', 'maskUnits',
    'maskContentUnits', 'patternUnits', 'patternContentUnits', 'patternTransform', 'markerWidth', 'markerHeight', 'markerUnits',
    'refX', 'refY', 'orient',
    // filter primitives
    'filterUnits', 'primitiveUnits', 'in', 'in2', 'result', 'type', 'values', 'stdDeviation', 'mode', 'operator', 'k1', 'k2', 'k3',
    'k4', 'flood-color', 'flood-opacity',
];
/** Attribute name patterns allowed besides ALLOWED_ATTRIBUTES. */
export const ALLOWED_ATTRIBUTE_PATTERNS = [/^data-[a-z0-9_.-]+$/, /^aria-[a-z]+$/];
/** The elements that may carry `href` / `xlink:href`: `#id` on all of them, a PNG / JPEG `data:` URL on `<image>` only. */
export const HREF_ELEMENTS = ['use', 'image', 'linearGradient', 'radialGradient', 'pattern'];
/** The only at-rule a `<style>` may hold (the `appearance: 'auto'` block). */
export const ALLOWED_AT_RULES = ['media'];
const ELEMENTS = new Set(ALLOWED_ELEMENTS);
const ATTRIBUTES = new Set(ALLOWED_ATTRIBUTES);
const HREF_ON = new Set(HREF_ELEMENTS);
const TEXT_IN = new Set(['text', 'tspan', 'title', 'desc', 'style']);
/** Attributes whose value is words for people or names, not paint or geometry: `url(` in them is text. */
const PLAIN = /^(?:id|class|lang|role|data-.*|aria-.*)$/;
const FORBIDDEN = {
    script: 'runs script', foreignObject: 'embeds HTML', a: 'is a link', iframe: 'embeds a page', object: 'embeds a resource',
    embed: 'embeds a resource', audio: 'loads media', video: 'loads media', feImage: 'loads an image', handler: 'runs script',
    animate: 'can change attributes such as href', animateTransform: 'is an animation', animateMotion: 'is an animation',
    set: 'can change attributes such as href', discard: 'is an animation', textPath: 'is not drawn by the renderer',
};
const NS = { xmlns: 'http://www.w3.org/2000/svg', 'xmlns:xlink': 'http://www.w3.org/1999/xlink' };
const MAX_PROBLEMS = 100;
const NAME = /[A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?/y;
const SPACE = /[ \t\r\n]*/y;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const DATA_URL = /^data:image\/(?:png|jpeg);base64,/;
const FRAGMENT = /^#[A-Za-z_][\w.:-]*$/;
const REF = /&(?:#x([0-9a-fA-F]{1,6})|#([0-9]{1,7})|(amp|lt|gt|quot|apos));|&/g;
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const validChar = (c) => c === 0x9 || c === 0xa || c === 0xd || (c >= 0x20 && c <= 0xd7ff) || (c >= 0xe000 && c <= 0xfffd) || (c >= 0x10000 && c <= 0x10ffff);
/** The offset of the first character XML does not allow (C0 controls but tab / newline / CR, U+FFFE, U+FFFF), or -1. */
function badCharAt(s) {
    for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        if ((c < 0x20 && c !== 0x9 && c !== 0xa && c !== 0xd) || c === 0xfffe || c === 0xffff)
            return i;
    }
    return -1;
}
const short = (s) => (s.length > 60 ? `${s.slice(0, 57)}...` : s);
/** Character and entity references replaced; null when an `&` starts no valid reference (an unknown entity, a bare `&`). */
function decode(raw) {
    if (!raw.includes('&'))
        return raw;
    let bad = false;
    const out = raw.replace(REF, (m, hex, dec, named) => {
        if (named)
            return NAMED[named] ?? '';
        const c = hex ? Number.parseInt(hex, 16) : dec ? Number(dec) : -1;
        if (m === '&' || !validChar(c)) {
            bad = true;
            return '';
        }
        return String.fromCodePoint(c);
    });
    return bad ? null : out;
}
/** What is wrong with a stylesheet or a style="" value: only `@media`, `url(#id)`, no escapes and nothing that loads. */
export function cssProblems(css) {
    const out = [];
    const text = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
    if (text.includes('/*'))
        out.push('CSS: unterminated comment');
    if (text.includes('\\'))
        out.push('CSS: escapes (\\) are not allowed');
    if (text.includes('<'))
        out.push('CSS: "<" is not allowed');
    for (const m of text.matchAll(/@([\w-]*)/g))
        if (!ALLOWED_AT_RULES.includes((m[1] ?? '').toLowerCase()))
            out.push(`CSS: @${m[1]} is not allowed (only @media)`);
    for (const u of foreignUrls(text))
        out.push(`CSS: ${u} — only url(#id) is allowed`);
    for (const m of text.matchAll(/(?:-webkit-)?(?:image-set|image|cross-fade|element|src|expression)\s*\(/gi))
        out.push(`CSS: ${m[0]} is not allowed`);
    if (/-moz-binding|behavior\s*:/i.test(text))
        out.push('CSS: -moz-binding / behavior is not allowed');
    return out;
}
/** Each `url(...)` in `s` that is not `url(#id)` (quoted or not). */
const foreignUrls = (s) => [...s.matchAll(/url\(\s*(['"]?)([^'")]*)\1\s*\)|url\(/gi)].filter(m => !FRAGMENT.test(m[2] ?? '')).map(m => short(m[0]));
function hrefProblem(el, v) {
    if (!HREF_ON.has(el))
        return `href is not allowed on <${el}>`;
    if (FRAGMENT.test(v))
        return undefined;
    const data = DATA_URL.exec(v);
    if (!data)
        return `href="${short(v)}" — only "#id" or data:image/png|jpeg;base64,... are allowed`;
    if (el !== 'image')
        return `a data: URL is allowed on <image> only, not <${el}>`;
    return BASE64.test(v.slice(data[0].length)) ? undefined : 'the data: URL is not valid base64';
}
function attributeProblems(el, k, v) {
    if (/^on/i.test(k))
        return [`event handler attribute ${k} is not allowed`];
    if (!ATTRIBUTES.has(k) && !ALLOWED_ATTRIBUTE_PATTERNS.some(p => p.test(k)))
        return [k.includes(':') ? `namespaced attribute ${k} is not allowed` : `unknown attribute ${k}`];
    if (k === 'href' || k === 'xlink:href') {
        const p = hrefProblem(el, v);
        return p ? [p] : [];
    }
    if (k in NS)
        return v === NS[k] ? [] : [`${k}="${short(v)}" — must be ${NS[k]}`];
    if (k === 'style')
        return cssProblems(v).map(p => `style="": ${p}`);
    return PLAIN.test(k) ? [] : foreignUrls(v).map(u => `${k}: ${u} — only url(#id) is allowed`);
}
/** Check one slide's SVG against the allowlist (ADR 0056 D3). `where` is an element path and the offset (in UTF-16 code units) of the tag. */
export function checkSlideSvg(svg) {
    const problems = [];
    const stack = [];
    let roots = 0;
    const locate = (at, extra) => {
        const path = [...stack, ...(extra ? [extra] : [])].map((f, i) => (i === 0 ? f.name : `${f.name}:nth(${f.nth})`) + (f.id ? `#${short(f.id)}` : '')).join(' > ');
        return `${path || '(document)'} @${at}`;
    };
    const add = (where, what) => { if (problems.length < MAX_PROBLEMS)
        problems.push({ where, what }); };
    const done = () => (problems.length ? { ok: false, problems } : { ok: true });
    const malformed = (at, what) => { add(locate(at), `malformed markup: ${what}`); return done(); };
    const nameAt = (at) => { NAME.lastIndex = at; return NAME.exec(svg)?.[0]; };
    const skipSpace = (at) => { SPACE.lastIndex = at; SPACE.exec(svg); return SPACE.lastIndex; };
    /** Text (or CDATA) inside the current element: whitespace anywhere, words in text elements, CSS in <style>. */
    const text = (at, s) => {
        const top = stack[stack.length - 1];
        if (!top) {
            if (s.trim())
                add(locate(at), 'text outside the root element');
            return;
        }
        if (top.name === 'style')
            top.css += s;
        else if (s.trim() && !TEXT_IN.has(top.name))
            add(locate(at), `text inside <${top.name}> is not allowed`);
    };
    const bad = badCharAt(svg);
    if (bad !== -1)
        return malformed(bad, `control character U+${svg.charCodeAt(bad).toString(16).padStart(4, '0')}`);
    const start = svg.charCodeAt(0) === 0xfeff ? 1 : 0;
    let i = start;
    while (i < svg.length) {
        const lt = svg.indexOf('<', i);
        const end = lt === -1 ? svg.length : lt;
        if (end > i) {
            const raw = svg.slice(i, end);
            if (raw.includes(']]>'))
                return malformed(i, '"]]>" in text');
            const s = decode(raw);
            if (s === null)
                return malformed(i, 'an "&" that starts no valid character or entity reference');
            text(i, s);
        }
        if (lt === -1)
            break;
        i = lt;
        if (svg.startsWith('<!--', i)) {
            const close = svg.indexOf('-->', i + 4);
            if (close === -1)
                return malformed(i, 'unterminated comment');
            const body = svg.slice(i + 4, close);
            if (body.includes('--') || body.startsWith('>') || body.startsWith('->') || body.endsWith('-'))
                return malformed(i, 'a comment containing "--" or starting with ">" (read differently by HTML parsers)');
            i = close + 3;
        }
        else if (svg.startsWith('<![CDATA[', i)) {
            const close = svg.indexOf(']]>', i + 9);
            if (close === -1)
                return malformed(i, 'unterminated CDATA section');
            if (!stack.length)
                return malformed(i, 'CDATA outside the root element');
            const body = svg.slice(i + 9, close);
            if (body.includes('<'))
                add(locate(i), 'CDATA containing "<" is not allowed (markup hidden from XML may be read by other parsers)');
            else
                text(i, body);
            i = close + 3;
        }
        else if (svg.startsWith('<!', i)) {
            add(locate(i), `declaration <!${nameAt(i + 2) ?? svg.slice(i + 2, i + 10)}> is not allowed (DOCTYPE / ENTITY / ELEMENT)`);
            return done(); // an internal subset can define entities this reader does not expand: stop here
        }
        else if (svg.startsWith('<?', i)) {
            const close = svg.indexOf('?>', i + 2);
            if (close === -1)
                return malformed(i, 'unterminated processing instruction');
            const target = nameAt(i + 2) ?? '';
            if (target !== 'xml' || i !== start)
                add(locate(i), `processing instruction <?${short(target)}?> is not allowed (only the XML declaration, at the start)`);
            i = close + 2;
        }
        else if (svg.startsWith('</', i)) {
            const name = nameAt(i + 2);
            if (!name)
                return malformed(i, 'a closing tag without a name');
            const gt = skipSpace(i + 2 + name.length);
            if (svg[gt] !== '>')
                return malformed(i, `</${name} is not closed by ">"`);
            const top = stack[stack.length - 1];
            if (!top || top.name !== name)
                return malformed(i, top ? `</${name}> closes <${top.name}>` : `</${name}> closes nothing`);
            if (top.name === 'style')
                for (const p of cssProblems(top.css))
                    add(locate(i), p);
            stack.pop();
            i = gt + 1;
        }
        else {
            const name = nameAt(i + 1);
            if (!name)
                return malformed(i, '"<" that starts no tag (write &lt;)');
            if (!stack.length && roots++)
                return malformed(i, 'a second root element');
            const attrs = new Map();
            let j = i + 1 + name.length, self = false;
            for (;;) {
                const k = skipSpace(j);
                if (svg[k] === '>') {
                    j = k + 1;
                    break;
                }
                if (svg.startsWith('/>', k)) {
                    j = k + 2;
                    self = true;
                    break;
                }
                if (k >= svg.length)
                    return malformed(i, `<${name} is not closed`);
                const attr = nameAt(k);
                if (k === j || !attr)
                    return malformed(k, `unexpected ${JSON.stringify(svg.slice(k, k + 10))} in <${name}>`);
                const eq = skipSpace(k + attr.length);
                if (svg[eq] !== '=')
                    return malformed(k, `attribute ${attr} has no value`);
                const q = skipSpace(eq + 1), quote = svg[q];
                if (quote !== '"' && quote !== "'")
                    return malformed(k, `attribute ${attr} is not quoted`);
                const close = svg.indexOf(quote, q + 1);
                if (close === -1)
                    return malformed(k, `attribute ${attr} is not closed`);
                const raw = svg.slice(q + 1, close);
                if (raw.includes('<'))
                    return malformed(k, `"<" in the value of ${attr}`);
                const value = decode(raw);
                if (value === null)
                    return malformed(k, `an "&" in ${attr} that starts no valid reference`);
                if (attrs.has(attr))
                    return malformed(k, `attribute ${attr} given twice`);
                attrs.set(attr, value);
                j = close + 1;
            }
            const parent = stack[stack.length - 1];
            const frame = { name, nth: parent ? ++parent.children : 1, id: attrs.get('id'), children: 0, css: '' };
            const at = i, report = (what) => add(locate(at, frame), what);
            if (parent?.name === 'style')
                report('an element inside <style> is not allowed');
            if (!parent && name !== 'svg')
                report(`the root element must be <svg>, not <${name}>`);
            if (FORBIDDEN[name])
                report(`<${name}> is not allowed: it ${FORBIDDEN[name]}`);
            else if (!ELEMENTS.has(name))
                report(name.includes(':') ? `namespaced element <${name}> is not allowed` : `unknown element <${name}>`);
            for (const [k, v] of attrs)
                for (const p of attributeProblems(name, k, v))
                    report(p);
            if (!self)
                stack.push(frame);
            i = j;
        }
    }
    const open = stack[stack.length - 1];
    if (open)
        return malformed(svg.length, `<${open.name}> is not closed`);
    if (!roots)
        return malformed(0, 'no root element');
    return done();
}
