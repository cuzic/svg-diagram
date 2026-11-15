// ADR 0056 D10: the dependency-free QR encoder (lib/present/qr.ts). Round trips through the jsqr decoder, a byte-for-byte
// comparison with a reference implementation, the 10-M length limit, version selection, and the SVG / terminal renderings.
import test from 'node:test';
import assert from 'node:assert/strict';
import jsQRModule from 'jsqr';
import {QR_MAX_BYTES, encodeQr, encodeQrWithMask, qrSvg, qrTerminal, qrVersionFor} from '../lib/present/qr.ts';

// jsqr is CommonJS with `exports.default`; under Node's ESM interop the default import is the module object.
type JsQr = typeof jsQRModule.default;
const jsQR: JsQr = (jsQRModule as unknown as {default?: JsQr}).default ?? (jsQRModule as unknown as JsQr);

const utf8 = (s: string): number[] => [...new TextEncoder().encode(s)];
const versionOf = (m: boolean[][]): number => (m.length - 17) / 4;

/** Rasterise a module matrix (true = dark) with a 4-module light quiet zone at `scale` px per module, then decode. */
function decode(matrix: readonly boolean[][], scale = 4): ReturnType<JsQr> {
  const quiet = 4, side = (matrix.length + quiet * 2) * scale;
  const rgba = new Uint8ClampedArray(side * side * 4).fill(255);
  matrix.forEach((row, y) => row.forEach((dark, x) => {
    if (!dark) return;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const i = (((y + quiet) * scale + dy) * side + (x + quiet) * scale + dx) * 4;
      rgba[i] = rgba[i + 1] = rgba[i + 2] = 0;
    }
  }));
  return jsQR(rgba, side, side, {inversionAttempts: 'dontInvert'});
}

const SHORT_URL = 'https://example.com/';
const LONG_URL = 'https://slides.example.test/p/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef?k=0123456789abcdef01234567';
const JAPANESE = 'スライドを見る: https://例え.テスト/発表';
const LARGEST = 'https://x.test/' + 'a'.repeat(QR_MAX_BYTES - 'https://x.test/'.length);

for (const [name, text, versions] of [
  ['a short ASCII URL', SHORT_URL, [1, 2]],
  ['a ~120-byte URL (version 7, with the version information area)', LONG_URL, [7, 8]],
  ['a Japanese string (multi-byte UTF-8)', JAPANESE, [1, 10]],
  ['the largest text that fits in 10-M', LARGEST, [10, 10]],
] as const) {
  test(`round trip through jsqr: ${name}`, () => {
    const m = encodeQr(text);
    const v = versionOf(m);
    assert.ok(v >= versions[0] && v <= versions[1], `version ${v}`);
    const got = decode(m);
    assert.ok(got, 'jsqr found no code');
    assert.equal(got.version, v);
    assert.deepEqual(got.binaryData, utf8(text));
    assert.equal(got.data, text);
  });
}

test('the ~120-byte URL really needs version 7 or 8', () => {
  assert.equal(utf8(LONG_URL).length, 121);
  assert.equal(qrVersionFor(121), 7);
});

// Reference matrices produced by the npm package `qrcode` 1.5.4 (node-qrcode, a widely used implementation), with
// QR.create([{data, mode: 'byte'}], {errorCorrectionLevel: 'M'}) and its own mask choice ('#' = dark), pasted here as
// literals. They are not from ISO/IEC 18004 itself: the standard's worked example is numeric mode, which we do not encode.
// node-qrcode picked mask 0 for 'hello, world' (as we do) and mask 2 for LONG_URL; our penalty scoring can choose a
// different mask for some inputs (implementations differ on finder-like patterns at the symbol edge), so the version-7
// comparison fixes the mask to isolate the encoding, ECC, placement, format and version information.
const HELLO_V1 = [
  '#######..#.##.#######',
  '#.....#.##..#.#.....#',
  '#.###.#..#..#.#.###.#',
  '#.###.#...##..#.###.#',
  '#.###.#.#..##.#.###.#',
  '#.....#....#..#.....#',
  '#######.#.#.#.#######',
  '..........#..........',
  '#.#.#.#..#..#...#..#.',
  '#.##...###.#....#..##',
  '.#..####.###.#.######',
  '####.#.######..#...#.',
  '.######.#.##....#....',
  '........##.#..###.###',
  '#######..#..##..#.###',
  '#.....#....#...#...#.',
  '#.###.#.##.###.#...#.',
  '#.###.#..#.###.##.##.',
  '#.###.#.#..##...#.#.#',
  '#.....#..#.#....#..#.',
  '#######.####...#...##',
];
const LONG_URL_V7_MASK2 = [
  '#######..#..#..##..#.##....##.###...#.#######',
  '#.....#....#.###..####.#####.......#..#.....#',
  '#.###.#.#..###.##....#..##..######.#..#.###.#',
  '#.###.#.#...###.#####.####.#.##..#.##.#.###.#',
  '#.###.#.##.#.###...#######..###...###.#.###.#',
  '#.....#.##.########.#...#.##....#.....#.....#',
  '#######.#.#.#.#.#.#.#.#.#.#.#.#.#.#.#.#######',
  '........##....##.#.##...#...###.##..#........',
  '#.#####.....##..#.#######.....##..##..#####..',
  '..##.....###.#.#..###..#.#...####...#...#.###',
  '#.#..##...#.###...###.#.#.#.#....###.###.###.',
  '.###...#..##.##.#.#..#...#.##...######..#.#..',
  '..##..#.###.#.....#.#.#.#....###...#.#.#.#..#',
  '..#.#..#.###..#....#.#.#...#.##.....#.....#.#',
  '...##.##.###.#..###.#.#.###....#.##.###.#.##.',
  '..####.#.#..#.##..##.#......##.####..#..#.##.',
  '#.###.#..##..#...###..######...#.#.#...#.#.#.',
  '#.#.##.##....#.##......#.....###.#.##...#####',
  '.#.#..##.....#.#..#.#...####...#..##.###.....',
  '.####..##.##..#.##.#...#.#..#####..#....#.#.#',
  '...######.#..##.###.#####.##.....#.#######.#.',
  '.####...#..##.##...##...#..##.####.##...#####',
  '#####.#.##...#..##..#.#.####.#.#..#.#.#.#.#..',
  '..#.#...#..##.##....#...#######.#.#.#...###..',
  '..###########.##.#..#####....###.#..######...',
  '#...##..####.#.#..##..####...##.#..##..#..#.#',
  '#.##.###..##..##..#..###..##.....##....#...#.',
  '..#.#...###....####.#..###.##.#.##.####...##.',
  '...#..##.#...##.#.#.#....#...###....#.#.##..#',
  '#.####.##...####..##.###....#####..#..#...#.#',
  '#.....#.###.#.###.#.####.###.....##....#.###.',
  '..##...##.####....#.##..##..###.#####.##..#..',
  '##...##.#.##...#.#...#.##..#.###.....#..##.#.',
  '.##.....#...#.##..###.#.#..#.##....#..##.#..#',
  '....#.####.##.#####.#..#.###.#.#.##.#...##.#.',
  '.####...........#.#..#..#...#.###..#########.',
  '#..##.##.#.#..#.#.#######..#..#.....#####..#.',
  '........#...#.#.#.#.#...#.....#.##.##...#####',
  '#######.....##.###.##.#.####.#.#..###.#.#.#..',
  '#.....#.#.......#####...##.####.#####...#####',
  '#.###.#.##.#..#.###.######.....#...#######.##',
  '#.###.#.##..##.#..##.#.##..#..##...#.#..#.###',
  '#.###.#.#.#.####..#...###.####...##.##.#.#.#.',
  '#.....#...##..#...####.#.#.##.#.##.##..##.#..',
  '#######.#.#.#.#.#.##..#.#.#....#.##.####.#.#.',
];

const toRows = (m: readonly boolean[][]): string[] => m.map(r => r.map(d => (d ? '#' : '.')).join(''));

test('known value: version 1-M of "hello, world" matches node-qrcode, mask choice included', () => {
  assert.deepEqual(toRows(encodeQr('hello, world')), HELLO_V1);
});

test('known value: version 7-M with mask 2 matches node-qrcode (version information area)', () => {
  assert.deepEqual(toRows(encodeQrWithMask(LONG_URL, 2)), LONG_URL_V7_MASK2);
});

test('length limit: 213 bytes fit in 10-M, one byte more throws with the length and the limit', () => {
  assert.equal(QR_MAX_BYTES, 213);
  assert.equal(versionOf(encodeQr('a'.repeat(213))), 10);
  assert.throws(() => encodeQr('a'.repeat(214)), /214 bytes.*at most 213 bytes/);
  // The limit counts UTF-8 bytes, not characters: 72 three-byte characters are 216 bytes.
  assert.throws(() => encodeQr('あ'.repeat(72)), /216 bytes/);
});

test('version selection: the smallest version that holds the bytes, growing with the length', () => {
  // Byte-mode capacities at level M, versions 1..10 (ISO/IEC 18004 Table 7).
  const capacity = [14, 26, 42, 62, 84, 106, 122, 152, 180, 213];
  capacity.forEach((cap, i) => {
    assert.equal(qrVersionFor(cap), i + 1);
    assert.equal(qrVersionFor(cap + 1), i + 2 <= 10 ? i + 2 : null);
  });
  assert.equal(qrVersionFor(0), 1);
  let last = 1;
  for (let n = 0; n <= 213; n++) {
    const v = qrVersionFor(n) ?? 99;
    assert.ok(v >= last);
    last = v;
  }
  assert.equal(versionOf(encodeQr('x'.repeat(100))), 6);
});

test('qrSvg: one path of row runs over a light rect, sized by moduleSize and margin, labelled with the text', () => {
  const text = 'https://example.com/?a=1&b="2"';
  const svg = qrSvg(text, {moduleSize: 3, margin: 2, dark: '#123', light: '#fed'});
  const m = encodeQr(text), full = m.length + 4;
  assert.match(svg, new RegExp(`viewBox="0 0 ${full} ${full}" width="${full * 3}" height="${full * 3}"`));
  assert.match(svg, /role="img" aria-label="https:\/\/example\.com\/\?a=1&amp;b=&quot;2&quot;"/);
  assert.match(svg, /<rect width="\d+" height="\d+" fill="#fed"\/>/);
  assert.equal(svg.match(/<path /g)?.length, 1);
  // Rebuild the matrix from the runs: every dark module is covered once, and nothing else.
  const back = m.map(r => r.map(() => false));
  const d = /d="([^"]*)"/.exec(svg)?.[1] ?? '';
  for (const [, x, y, len] of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\3z/g)) {
    for (let i = 0; i < Number(len); i++) {
      const row = back[Number(y) - 2];
      assert.ok(row && !row[Number(x) - 2 + i]);
      row[Number(x) - 2 + i] = true;
    }
  }
  assert.deepEqual(back, m);
  assert.match(qrSvg('a'), /viewBox="0 0 29 29" width="116" height="116"/); // defaults: margin 4, 4 px per module
});

test('qrTerminal: half blocks, two rows per line, 4-module quiet zone; scans as drawn on a dark terminal', () => {
  const text = LONG_URL, m = encodeQr(text), full = m.length + 8;
  const out = qrTerminal(text);
  assert.ok(out.endsWith('\n'));
  const lines = out.slice(0, -1).split('\n');
  assert.equal(lines.length, Math.ceil(full / 2));
  assert.ok(lines.every(l => [...l].length === full && /^[▀▄█ ]+$/.test(l)));
  assert.match(lines[0] ?? '', /^█+$/); // the quiet zone is drawn as blocks (light)
  // On a dark terminal the blocks are light: rebuild the light/dark grid and decode without inversion.
  const lightAt = (ch: string, top: boolean): boolean => ch === '█' || ch === (top ? '▀' : '▄');
  const grid: boolean[][] = [];
  for (const l of lines) {
    const cs = [...l];
    grid.push(cs.map(c => !lightAt(c, true)), cs.map(c => !lightAt(c, false)));
  }
  const symbol = grid.slice(4, 4 + m.length).map(r => r.slice(4, 4 + m.length));
  assert.deepEqual(symbol, m);
  assert.equal(decode(symbol)?.data, text);
});
