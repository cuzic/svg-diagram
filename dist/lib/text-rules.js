// Text that the layout broke in the middle of a word (pure: reads the wrapped lines the layout left on the bands).
// A line break inside a run of katakana ("コンテキス/ト") or of Latin letters and digits reads as a typo. Kanji compounds are not judged: a break
// between two kanji is common and often fine.
import { EMOJI_RE } from './tokens.js';
const KATAKANA = /[ァ-ヺーㇰ-ㇿｦ-ﾟ]/;
const LATIN = /[A-Za-z0-9]/;
const sameWord = (a, b) => (KATAKANA.test(a) && KATAKANA.test(b)) || (LATIN.test(a) && LATIN.test(b));
/** The run of one script (katakana / Latin) that ends `left` and the run that starts `right`, joined. */
function wordAround(left, right) {
    const cls = (c) => KATAKANA.test(c) ? KATAKANA : LATIN;
    const l = [...left], r = [...right];
    let i = l.length;
    const re = cls(l.at(-1) ?? '');
    while (i > 0 && re.test(l[i - 1] ?? ''))
        i--;
    let j = 0;
    while (j < r.length && re.test(r[j] ?? ''))
        j++;
    return l.slice(i).join('') + r.slice(0, j).join('');
}
/** The word breaks of one wrapped run. With the run's source text, a break where the text has a space or a newline is the author's own; without it only katakana is judged. */
export function midWordBreaks(lines, text) {
    const out = [];
    let p = 0; // position in `text` after the previous line (when the lines can be matched back to it)
    let matched = text !== undefined;
    for (let k = 0; k + 1 < lines.length; k++) {
        const left = lines[k], right = lines[k + 1];
        if (!left || !right) {
            matched = false;
            continue;
        }
        let spaced = false;
        if (matched && text !== undefined) {
            let q = p;
            while (q < text.length && /\s/.test(text.charAt(q)))
                q++;
            if (!text.startsWith(left, q))
                matched = false;
            else {
                p = q + left.length;
                let r = p;
                while (r < text.length && /\s/.test(text.charAt(r)))
                    r++;
                spaced = r > p;
            }
        }
        if (spaced)
            continue;
        const a = left.slice(-1), b = right.slice(0, 1);
        const word = matched ? sameWord(a, b) : KATAKANA.test(a) && KATAKANA.test(b);
        if (word)
            out.push({ before: left.slice(-4), after: right.slice(0, 4), word: wordAround(left, right) });
    }
    return out;
}
/** The anchor of a placed line: `tx` / `ty` where the band separates the text anchor from the text's box (chevron), else `x` / `y`. */
const anchorOf = (p) => {
    const x = p.tx ?? p.x, y = p.ty ?? p.y;
    return typeof x === 'number' && typeof y === 'number' ? { x, y } : undefined;
};
const isPlaced = (o) => typeof o === 'object' && o !== null && typeof o.text === 'string' && typeof o.size === 'number' && anchorOf(o) !== undefined;
/** Many bands keep a wrapped label as separate positioned lines, one entry per line: two entries in a row at the same anchor x, one line apart, are the lines of one label. Only katakana is judged (no source text to tell a space from a break). */
function placedBreaks(items, inSource) {
    const out = [];
    for (let k = 0; k + 1 < items.length; k++) {
        const a = items[k], b = items[k + 1];
        if (!a || !b)
            continue;
        const pa = anchorOf(a), pb = anchorOf(b);
        if (!pa || !pb)
            continue;
        const gap = pb.y - pa.y;
        if (Math.abs(pa.x - pb.x) > 0.5 || a.size !== b.size || gap <= 0 || gap > a.size * 2 || !a.text || !b.text)
            continue;
        if (KATAKANA.test(a.text.slice(-1)) && KATAKANA.test(b.text.slice(0, 1)) && inSource(a.text.slice(-2) + b.text.slice(0, 2)))
            out.push({ before: a.text.slice(-4), after: b.text.slice(0, 4), word: wordAround(a.text, b.text) });
    }
    return out;
}
/** Every mid-word break in a laid-out tree: a `wrappedRuns` entry (lines + source text) or any plain `lines: string[]`. */
export function midWordBreaksIn(root, source) {
    const out = [], seen = new WeakSet();
    // a break between two katakana letters is mid-word only if the author wrote them with nothing in between: with a space (or any mark) there the break fell on a boundary
    const inSource = (junction) => source === undefined || source.includes(junction);
    const walk = (o) => {
        if (typeof o !== 'object' || o === null || seen.has(o))
            return;
        seen.add(o);
        if (Array.isArray(o)) {
            if (o.length > 1 && o.every(isPlaced))
                out.push(...placedBreaks(o, inSource));
            for (const v of o)
                walk(v);
            return;
        }
        const rec = o;
        const lines = rec['lines'], text = rec['text'];
        if (Array.isArray(lines) && lines.every(l => typeof l === 'string'))
            out.push(...midWordBreaks(lines, typeof text === 'string' ? text : undefined).filter(b => typeof text === 'string' || inSource(b.before.slice(-2) + b.after.slice(0, 2))));
        for (const v of Object.values(rec))
            walk(v);
    };
    walk(root);
    return out;
}
// Pictographs the emitter does not treat as emoji: EMOJI_RE (lib/tokens.ts) is what gets `<tspan class="emoji">` and a colour font, so a
// pictograph outside it ("✅" U+2705, "❌", "⭐" is inside) is drawn with the ordinary text font, which usually has no glyph for it (blank in resvg).
const PICTOGRAPH = /\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F/gu;
/** The pictographs in the text of a laid-out tree that would be drawn with the text font (and may come out blank). */
export function missingGlyphs(root) {
    const found = new Set(), seen = new WeakSet();
    const scan = (s) => { for (const m of s.matchAll(PICTOGRAPH))
        if (!EMOJI_RE.test(m[0]))
            found.add(m[0]); };
    const walk = (o, key) => {
        if (typeof o === 'string') {
            if (key === 'text' || key === 'lines' || key === 'label' || key === 'title')
                scan(o);
            return;
        }
        if (typeof o !== 'object' || o === null || seen.has(o))
            return;
        seen.add(o);
        for (const [k, v] of Array.isArray(o) ? o.map(x => [key, x]) : Object.entries(o))
            walk(v, k);
    };
    walk(root);
    return [...found];
}
/** All the strings of the author's bands (labels, titles, bodies ...), for checking what was written without a space. */
export function sourceText(bands) {
    const parts = [], seen = new WeakSet();
    const walk = (o) => {
        if (typeof o === 'string') {
            parts.push(o);
            return;
        }
        if (typeof o !== 'object' || o === null || seen.has(o))
            return;
        seen.add(o);
        for (const v of Array.isArray(o) ? o : Object.values(o))
            walk(v);
    };
    walk(bands);
    return parts.join('\n');
}
