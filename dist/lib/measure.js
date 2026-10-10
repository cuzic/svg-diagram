// Batch text measurement for the diagram DSL, via headless Chromium.
//
// Splits text into "break atoms" — the smallest units worth measuring once
// and reusing — instead of re-measuring every prefix of a string (which is
// what naive greedy line-wrapping does: O(n^2) measurement calls in string
// length). CJK characters have ~zero inter-glyph kerning, so each one is its
// own atom and summed widths are exact; Latin/digit/punctuation runs DO have
// real kerning, so they're kept together as one atom each, which folds that
// kerning into the single measurement instead of losing it.
//
// Nodes use xml:space="preserve": SVG otherwise collapses a whitespace-only <text> to
// width 0, which made every space in a wrapped line (~4px at 14px) go uncounted and
// let lines overflow their box by (spaces x 4)px.
//
// Uses getBBox() rather than getComputedTextLength() specifically because
// lint-svg.ts's own container-overflow check uses getBBox() — measuring
// with the same primitive the linter checks against means a diagram that
// passes layout here cannot then disagree with lint-svg.ts about whether
// something fits.
import { chromium } from 'playwright-chromium';
import { FONT_STACKS } from './tokens.js';
function isCJK(ch) {
    const c = ch.codePointAt(0);
    return (c >= 0x3000 && c <= 0x30ff) // CJK punctuation, hiragana, katakana
        || (c >= 0x3400 && c <= 0x9fff) // CJK unified ideographs (+ ext A)
        || (c >= 0xf900 && c <= 0xfaff) // CJK compatibility ideographs
        || (c >= 0xff00 && c <= 0xffef); // fullwidth forms
}
// Splits text into atoms: each CJK character alone, each run of whitespace
// alone, and each run of anything else (Latin words, digits, punctuation,
// emoji) kept together.
export function splitAtoms(text) {
    const atoms = [];
    let buf = '';
    const flush = () => { if (buf) {
        atoms.push(buf);
        buf = '';
    } };
    for (const ch of text) {
        if (isCJK(ch)) {
            flush();
            atoms.push(ch);
        }
        else if (/\s/.test(ch)) {
            flush();
            atoms.push(ch);
        }
        else {
            buf += ch;
        }
    }
    flush();
    return atoms;
}
/** Width of single-line text: the sum of its atoms' measured widths. The one place this sum is written. */
export function textWidth(widthOf, text, size, weight, font = 'sans') {
    let w = 0;
    for (const atom of splitAtoms(text))
        w += widthOf(atom, size, weight, font);
    return w;
}
function escapeXml(s) {
    return s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
let browserPromise = null;
function getBrowser() {
    browserPromise ??= chromium.launch({ args: ['--no-sandbox'] });
    return browserPromise;
}
// Call once after all measureAll() calls for a build are done (or let the
// process exit naturally — Playwright doesn't need an explicit close if the
// process is about to end, but build-diagram.ts calls this for a clean exit
// when building many diagrams in one process).
// The measuring browser, for callers that must draw with the same engine (svg-diagram show).
export { getBrowser };
/** The SVG's own width and height (the root's attributes, or its viewBox). */
export function svgSize(svg) {
    const root = /<svg\b[^>]*>/.exec(svg)?.[0] ?? '';
    const num = (n) => { const m = new RegExp(`\\s${n}="([0-9.]+)(?:px)?"`).exec(root); return m ? parseFloat(m[1]) : NaN; };
    let w = num('width'), h = num('height');
    if (!(w > 0 && h > 0)) {
        const vb = /viewBox="[-0-9.]+[ ,]+[-0-9.]+[ ,]+([0-9.]+)[ ,]+([0-9.]+)"/.exec(root);
        if (vb) {
            w = parseFloat(vb[1]);
            h = parseFloat(vb[2]);
        }
    }
    return w > 0 && h > 0 ? { w, h } : null;
}
/**
 * Draw `svg` the way a page's <img src="x.svg"> does — as an image document, parsed as XML, with this browser's fonts —
 * scaled by `scale`, on white. An SVG that is not well-formed XML fails to load as an <img>; that is reported here as an
 * error rather than drawn from a forgiving HTML parse. Reuses the measuring browser, so a .ts source costs no extra launch.
 */
export async function rasterize(svg, { scale = 1, png = false } = {}) {
    const size = svgSize(svg);
    if (!size)
        throw new Error('the SVG has no width/height (or viewBox) on its root element');
    const width = Math.max(1, Math.round(size.w * scale)), height = Math.max(1, Math.round(size.h * scale));
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
        const url = 'data:image/svg+xml;base64,' + Buffer.from(svg, 'utf8').toString('base64');
        const out = await page.evaluate(async ({ url, width, height, png }) => {
            const img = new Image();
            img.src = url;
            try {
                await img.decode();
            }
            catch {
                return { error: 'the browser could not load it as an <img> (not well-formed XML?)' };
            }
            const c = document.createElement('canvas');
            c.width = width;
            c.height = height;
            const g = c.getContext('2d');
            g.fillStyle = '#fff';
            g.fillRect(0, 0, width, height);
            g.drawImage(img, 0, 0, width, height);
            const data = g.getImageData(0, 0, width, height).data;
            let bin = '';
            for (let i = 0; i < data.length; i += 0x8000)
                bin += String.fromCharCode(...data.subarray(i, i + 0x8000));
            return { rgba: btoa(bin), png: png ? c.toDataURL('image/png').split(',')[1] : undefined };
        }, { url, width, height, png });
        if ('error' in out)
            throw new Error(out.error);
        return { width, height, rgba: Buffer.from(out.rgba, 'base64'), png: out.png ? Buffer.from(out.png, 'base64') : undefined };
    }
    finally {
        await page.close();
    }
}
export async function closeMeasurer() {
    if (browserPromise) {
        const b = await browserPromise;
        await b.close();
        browserPromise = null;
    }
}
// requests: Map<key, {text, size, weight?, font?: 'sans'|'mono'|'emoji'}>
// returns Map<key, {w, h}>
// Widths measured earlier in this process, so building many diagrams in one run measures each atom once.
const memo = new Map();
const memoKey = (r) => JSON.stringify([r.text, r.size, r.weight ?? 400, r.font ?? 'sans']);
export async function measureAll(requests) {
    if (requests.size === 0)
        return new Map();
    const result = new Map();
    const todo = new Map();
    for (const [key, r] of requests) {
        const hit = memo.get(memoKey(r));
        if (hit)
            result.set(key, hit);
        else
            todo.set(key, r);
    }
    if (todo.size === 0)
        return result;
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
        const entries = [...todo.entries()];
        const nodes = entries.map(([, r], i) => {
            const stack = FONT_STACKS[r.font ?? 'sans'];
            const weight = r.weight ?? 400;
            return `<text id="m${i}" xml:space="preserve" x="0" y="100" font-family="${stack}" font-size="${r.size}" font-weight="${weight}">${escapeXml(r.text)}</text>`;
        }).join('\n');
        await page.setContent(`<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="200">${nodes}</svg>`, { waitUntil: 'load' });
        const dims = await page.evaluate((n) => {
            const out = [];
            for (let i = 0; i < n; i++) {
                const b = document.getElementById('m' + i).getBBox();
                out.push([b.width, b.height]);
            }
            return out;
        }, entries.length);
        entries.forEach(([key, r], i) => {
            const m = { w: dims[i][0], h: dims[i][1] };
            memo.set(memoKey(r), m);
            result.set(key, m);
        });
        return result;
    }
    finally {
        await page.close();
    }
}
// Convenience: measure every atom of every string in `strings` (deduped) at
// one (size, weight, font) combination, in a single Chromium round trip.
// Returns a lookup function atomWidth(atomText) -> number, plus the raw map
// if callers need heights too (atoms are all single-line so height is
// mostly uniform, but kept per-atom for exactness with mixed scripts).
export async function measureAtoms(strings, { size, weight, font }) {
    const atomSet = new Set();
    for (const s of strings)
        for (const a of splitAtoms(s))
            atomSet.add(a);
    const requests = new Map([...atomSet].map(a => [a, { text: a, size, weight, font }]));
    const measured = await measureAll(requests);
    return {
        width: (atom) => measured.get(atom)?.w ?? 0,
        height: (atom) => measured.get(atom)?.h ?? size * 1.2,
        raw: measured,
    };
}
