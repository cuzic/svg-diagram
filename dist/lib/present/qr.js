// ADR 0056 D10: a dependency-free QR code encoder for the audience URL (terminal at start-up, SVG on the presenter's screen).
// Pure: no I/O and no Node APIs, so the same code runs in the CLI, a Cloudflare Worker and a browser.
// Scope is what D10 needs and no more: byte mode (UTF-8), error correction level M, versions 1..10
// (a Worker URL is ~100-130 bytes and needs version 7-8, so the version information area is included).
// Algorithm follows ISO/IEC 18004:2015; the structure is close to Project Nayuki's public QR generator.
/** The largest version we encode. 10-M holds 213 bytes, comfortably above any URL D10 hands us. */
export const QR_MAX_VERSION = 10;
/** Error correction codewords per block at level M, index = version (index 0 unused). ISO/IEC 18004 Table 9. */
const ECC_PER_BLOCK_M = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
/** Number of error correction blocks at level M, index = version. ISO/IEC 18004 Table 9. */
const BLOCKS_M = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
/** Alignment pattern centre coordinates, index = version. ISO/IEC 18004 Annex E. */
const ALIGN = [[], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
const sizeOf = (version) => version * 4 + 17;
/** Modules left for codewords once the function patterns are placed (Nayuki's closed form; exact for every version). */
function rawDataModules(version) {
    let n = (16 * version + 128) * version + 64;
    if (version >= 2) {
        const a = Math.floor(version / 7) + 2;
        n -= (25 * a - 10) * a - 55;
        if (version >= 7)
            n -= 36;
    }
    return n;
}
const totalCodewords = (version) => Math.floor(rawDataModules(version) / 8);
const dataCodewords = (version) => totalCodewords(version) - (ECC_PER_BLOCK_M[version] ?? 0) * (BLOCKS_M[version] ?? 0);
/** Byte-mode payload capacity: 4-bit mode indicator, then an 8-bit count below version 10 and a 16-bit count from 10. */
const byteCapacity = (version) => Math.floor((dataCodewords(version) * 8 - 4 - (version < 10 ? 8 : 16)) / 8);
/** The largest byte length that fits (213 at 10-M). */
export const QR_MAX_BYTES = byteCapacity(QR_MAX_VERSION);
/** The smallest version 1..10 at level M whose byte mode holds `byteLength` bytes, or null when none does. */
export function qrVersionFor(byteLength) {
    for (let v = 1; v <= QR_MAX_VERSION; v++)
        if (byteLength <= byteCapacity(v))
            return v;
    return null;
}
// ---- GF(256) and Reed-Solomon (primitive polynomial x^8+x^4+x^3+x^2+1 = 0x11D) ----
function gfMul(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
        z = (z << 1) ^ ((z >>> 7) * 0x11d);
        z ^= ((y >>> i) & 1) * x;
    }
    return z;
}
/** Generator polynomial coefficients (highest degree dropped) for `degree` ECC codewords. */
function rsDivisor(degree) {
    const result = new Array(degree).fill(0);
    result[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
        for (let j = 0; j < degree; j++) {
            result[j] = gfMul(result[j] ?? 0, root) ^ (result[j + 1] ?? 0);
        }
        root = gfMul(root, 0x02);
    }
    return result;
}
function rsRemainder(data, divisor) {
    const result = divisor.map(() => 0);
    for (const b of data) {
        const factor = b ^ (result.shift() ?? 0);
        result.push(0);
        divisor.forEach((coef, i) => { result[i] = (result[i] ?? 0) ^ gfMul(coef, factor); });
    }
    return result;
}
// ---- Codewords ----
/** Mode indicator, count, payload, terminator and pad bytes: exactly `dataCodewords(version)` bytes. */
function dataBytes(bytes, version) {
    const bits = [];
    const put = (value, len) => { for (let i = len - 1; i >= 0; i--)
        bits.push((value >>> i) & 1); };
    put(0b0100, 4);
    put(bytes.length, version < 10 ? 8 : 16);
    for (const b of bytes)
        put(b, 8);
    const capacityBits = dataCodewords(version) * 8;
    put(0, Math.min(4, capacityBits - bits.length));
    put(0, (8 - (bits.length % 8)) % 8);
    for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11)
        put(pad, 8);
    const out = [];
    for (let i = 0; i < bits.length; i += 8)
        out.push(bits.slice(i, i + 8).reduce((acc, b) => (acc << 1) | b, 0));
    return out;
}
/** Split into blocks, append ECC to each, and interleave (ISO/IEC 18004 §7.6). Short blocks come first. */
function interleaved(data, version) {
    const numBlocks = BLOCKS_M[version] ?? 1, eccLen = ECC_PER_BLOCK_M[version] ?? 0, raw = totalCodewords(version);
    const numShort = numBlocks - (raw % numBlocks), shortLen = Math.floor(raw / numBlocks);
    const divisor = rsDivisor(eccLen);
    const blocks = [];
    for (let i = 0, k = 0; i < numBlocks; i++) {
        const dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1));
        k += dat.length;
        const ecc = rsRemainder(dat, divisor);
        if (i < numShort)
            dat.push(0); // placeholder so every block has the same length; skipped below
        blocks.push(dat.concat(ecc));
    }
    const out = [];
    for (let i = 0; i < (blocks[0]?.length ?? 0); i++) {
        blocks.forEach((block, j) => { if (i !== shortLen - eccLen || j >= numShort)
            out.push(block[i] ?? 0); });
    }
    return out;
}
function newGrid(size) {
    const mk = () => Array.from({ length: size }, () => new Array(size).fill(false));
    return { size, dark: mk(), fn: mk() };
}
/** Set a function module (x = column, y = row); function modules are never masked or overwritten by data. */
function setFn(g, x, y, dark) {
    const row = g.dark[y], fnRow = g.fn[y];
    if (!row || !fnRow || x < 0 || x >= g.size)
        return;
    row[x] = dark;
    fnRow[x] = true;
}
const bit = (value, i) => ((value >>> i) & 1) !== 0;
function drawFunctionPatterns(g, version) {
    const n = g.size;
    for (let i = 0; i < n; i++) {
        setFn(g, 6, i, i % 2 === 0);
        setFn(g, i, 6, i % 2 === 0);
    } // timing
    for (const [cx, cy] of [[3, 3], [n - 4, 3], [3, n - 4]]) { // finders with their separators
        for (let dy = -4; dy <= 4; dy++) {
            for (let dx = -4; dx <= 4; dx++) {
                const d = Math.max(Math.abs(dx), Math.abs(dy));
                setFn(g, cx + dx, cy + dy, d !== 2 && d !== 4);
            }
        }
    }
    const align = ALIGN[version] ?? [], last = align.length - 1;
    align.forEach((ay, i) => align.forEach((ax, j) => {
        if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0))
            return; // finder corners
        for (let dy = -2; dy <= 2; dy++)
            for (let dx = -2; dx <= 2; dx++)
                setFn(g, ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }));
    drawFormat(g, 0); // reserve the format area; redrawn with the real mask later
    if (version >= 7) {
        let rem = version;
        for (let i = 0; i < 12; i++)
            rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
        const bits = (version << 12) | rem;
        for (let i = 0; i < 18; i++) {
            const a = n - 11 + (i % 3), b = Math.floor(i / 3);
            setFn(g, a, b, bit(bits, i));
            setFn(g, b, a, bit(bits, i));
        }
    }
}
/** Format information: level M (indicator 00) and the mask, BCH(15,5) protected, XOR 0x5412 (ISO/IEC 18004 §7.9). */
function drawFormat(g, mask) {
    const data = (0b00 << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++)
        rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412, n = g.size;
    for (let i = 0; i <= 5; i++)
        setFn(g, 8, i, bit(bits, i));
    setFn(g, 8, 7, bit(bits, 6));
    setFn(g, 8, 8, bit(bits, 7));
    setFn(g, 7, 8, bit(bits, 8));
    for (let i = 9; i < 15; i++)
        setFn(g, 14 - i, 8, bit(bits, i));
    for (let i = 0; i < 8; i++)
        setFn(g, n - 1 - i, 8, bit(bits, i));
    for (let i = 8; i < 15; i++)
        setFn(g, 8, n - 15 + i, bit(bits, i));
    setFn(g, 8, n - 8, true); // the always-dark module
}
/** Place codeword bits in the two-column zigzag from the bottom right, skipping the vertical timing column. */
function drawCodewords(g, codewords) {
    const n = g.size, total = codewords.length * 8;
    let i = 0;
    for (let right = n - 1; right >= 1; right -= 2) {
        if (right === 6)
            right = 5;
        const upward = ((right + 1) & 2) === 0;
        for (let vert = 0; vert < n; vert++) {
            const y = upward ? n - 1 - vert : vert;
            for (let j = 0; j < 2; j++) {
                const x = right - j, row = g.dark[y];
                if (!row || g.fn[y]?.[x] || i >= total)
                    continue;
                row[x] = bit(codewords[i >>> 3] ?? 0, 7 - (i & 7));
                i++;
            }
        }
    }
    // Remainder bits (0, 7 or 3 per version) stay light, as the standard asks.
}
/** The eight data-mask conditions (ISO/IEC 18004 Table 10); x = column, y = row. */
const MASKS = [
    (x, y) => (x + y) % 2 === 0,
    (_x, y) => y % 2 === 0,
    (x) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];
/** Data masking is an XOR, so applying the same mask twice undoes it. */
function applyMask(g, mask) {
    const cond = MASKS[mask];
    if (!cond)
        return;
    g.dark.forEach((row, y) => row.forEach((d, x) => { if (!g.fn[y]?.[x] && cond(x, y))
        row[x] = !d; }));
}
const FINDER_LIKE = ['10111010000', '00001011101'];
/** Penalty of one row or column for rules 1 (runs) and 3 (finder-like 1:1:3:1:1 with 4 light modules on a side). */
function linePenalty(line) {
    let score = 0, run = 1;
    for (let i = 1; i <= line.length; i++) {
        if (i < line.length && line[i] === line[i - 1]) {
            run++;
            continue;
        }
        if (run >= 5)
            score += 3 + (run - 5);
        run = 1;
    }
    // The quiet zone outside the symbol is light, so a finder-like run at the edge still counts.
    const s = '0000' + line.map(d => (d ? '1' : '0')).join('') + '0000';
    for (const pat of FINDER_LIKE)
        for (let k = s.indexOf(pat); k >= 0; k = s.indexOf(pat, k + 1))
            score += 40;
    return score;
}
/** Total penalty (ISO/IEC 18004 §7.8.3): runs, 2x2 blocks, finder-like patterns and the dark/light balance. */
function penalty(dark) {
    const n = dark.length;
    let score = 0, darkCount = 0;
    for (let y = 0; y < n; y++) {
        const row = dark[y] ?? [];
        score += linePenalty(row) + linePenalty(dark.map(r => r[y] ?? false));
        for (let x = 0; x < n; x++) {
            if (row[x])
                darkCount++;
            const c = row[x];
            if (x < n - 1 && y < n - 1 && row[x + 1] === c && dark[y + 1]?.[x] === c && dark[y + 1]?.[x + 1] === c)
                score += 3;
        }
    }
    const total = n * n;
    score += (Math.ceil(Math.abs(darkCount * 20 - total * 10) / total) - 1) * 10;
    return score;
}
/** Build the symbol with a given mask (0..7); exposed for tests that compare against a reference built with a fixed mask. */
export function encodeQrWithMask(text, mask) {
    const bytes = new TextEncoder().encode(text);
    const version = qrVersionFor(bytes.length);
    if (version === null) {
        throw new Error(`QR: text is ${bytes.length} bytes in UTF-8, but version ${QR_MAX_VERSION}-M holds at most ${QR_MAX_BYTES} bytes`);
    }
    const g = newGrid(sizeOf(version));
    drawFunctionPatterns(g, version);
    drawCodewords(g, interleaved(dataBytes(bytes, version), version));
    let chosen = mask ?? 0;
    if (mask === null) {
        let best = Number.POSITIVE_INFINITY;
        for (let m = 0; m < 8; m++) {
            applyMask(g, m);
            drawFormat(g, m);
            const p = penalty(g.dark);
            if (p < best) {
                best = p;
                chosen = m;
            }
            applyMask(g, m);
        }
    }
    applyMask(g, chosen);
    drawFormat(g, chosen);
    return g.dark;
}
/** Encode `text` (UTF-8 bytes) at level M in the smallest version 1..10, choosing the mask by the standard penalty. true = dark. */
export function encodeQr(text) {
    return encodeQrWithMask(text, null);
}
const escapeXml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** A compact SVG: one light background rect and one path whose subpaths are the horizontal dark runs of each row. */
export function qrSvg(text, opts = {}) {
    const matrix = encodeQr(text);
    const margin = opts.margin ?? 4, unit = opts.moduleSize ?? 4;
    const full = matrix.length + margin * 2, px = full * unit;
    const runs = [];
    matrix.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
            if (!row[x])
                continue;
            let end = x;
            while (row[end + 1])
                end++;
            runs.push(`M${x + margin} ${y + margin}h${end - x + 1}v1h-${end - x + 1}z`);
            x = end;
        }
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${full} ${full}" width="${px}" height="${px}" role="img" aria-label="${escapeXml(text)}" shape-rendering="crispEdges">`
        + `<rect width="${full}" height="${full}" fill="${escapeXml(opts.light ?? '#fff')}"/>`
        + `<path fill="${escapeXml(opts.dark ?? '#000')}" d="${runs.join('')}"/></svg>`;
}
/**
 * Unicode half blocks, two module rows per line, with a 4-module quiet zone.
 * Polarity: LIGHT modules (and the quiet zone) are drawn as blocks, dark modules as spaces. On the usual dark-background
 * terminal the blocks show in the light foreground colour, so the code reads with the correct polarity and a visible
 * light frame. On a light-background terminal the same text shows inverted (light modules dark); modern phone
 * scanners (iOS Camera, Google Lens, ZXing) read inverted codes, but we cannot be correct for both backgrounds without
 * colour escapes, and a dark background is what most terminals default to.
 */
export function qrTerminal(text) {
    const matrix = encodeQr(text), quiet = 4, full = matrix.length + quiet * 2;
    const light = (x, y) => !(matrix[y - quiet]?.[x - quiet] ?? false);
    const lines = [];
    for (let y = 0; y < full; y += 2) {
        let line = '';
        for (let x = 0; x < full; x++) {
            const top = light(x, y), bottom = y + 1 < full && light(x, y + 1);
            line += top ? (bottom ? '█' : '▀') : bottom ? '▄' : ' ';
        }
        lines.push(line);
    }
    return lines.join('\n') + '\n';
}
