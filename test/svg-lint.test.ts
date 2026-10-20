// lib/svg-lint.ts: each of the five checks on the rendering, with the thresholds on both sides, on hand-written SVG.
// (test/svg-lint-browser.test.ts holds the same checks against a real Chromium.)
import test from 'node:test';
import assert from 'node:assert/strict';
import {geometryChecks} from '../lib/geometry-checks.ts';
import {textBox, resolveFontFile} from '../lib/font-metrics.ts';

const skip = resolveFontFile('sans') ? false : 'no font file found';
const STYLE = `<style>text { font-family: 'Hiragino Sans','Hiragino Kaku Gothic ProN','Yu Gothic','YuGothic',Meiryo,'Noto Sans JP',sans-serif; }</style>`;
const svg = (body: string, w = 400, h = 200, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" ${extra}>${STYLE}${body}</svg>`;
const check = (body: string, w = 400, h = 200, extra = '') => geometryChecks(svg(body, w, h, extra))!;
const T = (text: string, size = 20, weight = 400) => textBox(text, 'sans', size, weight);

// ---- the plumbing ----

test('no <svg>: null. XML it cannot read: an error that says so.', () => {
  assert.equal(geometryChecks('<g/>'), null);
  assert.equal(geometryChecks('just text'), null);
  assert.throws(() => geometryChecks('<svg xmlns="http://www.w3.org/2000/svg"><g></svg>'), /^Error: not well-formed XML/);
  assert.throws(() => geometryChecks(svg('<g data-x></g>')), /not well-formed XML/);
});

test('an empty figure has nothing to report', () => {
  assert.deepEqual(check(''), {contrast: [], overflow: null, textOverlap: [], containerOverflow: [], covered: []});
});

test('a font file that cannot be read stops the checks, naming the file (not a silent pass)', {skip}, () => {
  assert.throws(() => geometryChecks(svg('<text x="10" y="40" font-size="16">x</text>'), {sans: {regular: '/no/such/font.ttf', bold: '/no/such/font.ttf'}}), /font\.ttf/);
});

// ---- 1. contrast ----

test('contrast: white text on white is flagged, with the colours as a browser prints them', {skip}, () => {
  const r = check('<text x="10" y="40" font-size="20" fill="#ffffff">faint</text>');
  assert.deepEqual(r.contrast, [{txt: 'faint', delta: 0, fg: 'rgb(255, 255, 255)', bg: 'rgb(255,255,255)'}]);
});

test('contrast: dark text on white, and light text on a dark shape, are fine', {skip}, () => {
  assert.deepEqual(check('<text x="10" y="40" font-size="20" fill="#22201b">ok</text>').contrast, []);
  assert.deepEqual(check('<rect x="0" y="0" width="400" height="100" fill="#1f5fa8"/><text x="10" y="40" font-size="20" fill="#ffffff">ok</text>').contrast, []);
});

test('contrast: the threshold is a luminance difference of 70, strictly less', {skip}, () => {
  const on = (grey: string) => check(`<rect x="0" y="0" width="400" height="100" fill="${grey}"/><text x="10" y="40" font-size="20" fill="#000000">t</text>`).contrast;
  assert.equal(on('#444444').length, 1); // 68
  assert.equal(on('#444444')[0]!.delta, 68);
  assert.equal(on('#464646').length, 0); // 70
});

test('contrast: the text is judged against the shapes that hold its centre, painted in order, with their opacity', {skip}, () => {
  // black at half opacity over white is 127.5 grey; grey text on it is 0.5 away
  const r = check('<rect x="0" y="0" width="400" height="100" fill="#000000" fill-opacity="0.5"/><text x="10" y="40" font-size="20" fill="#808080">t</text>');
  assert.equal(r.contrast.length, 1);
  assert.equal(r.contrast[0]!.bg, 'rgb(127,127,127)');
  // a later white shape hides the earlier dark one
  assert.deepEqual(check('<rect x="0" y="0" width="400" height="100" fill="#000000"/><rect x="0" y="0" width="400" height="100" fill="#ffffff"/><text x="10" y="40" font-size="20" fill="#ffffff">t</text>').contrast.map(c => c.delta), [0]);
  // opacity="" counts as well as fill-opacity
  assert.equal(check('<rect x="0" y="0" width="400" height="100" fill="#000000" opacity="0.5"/><text x="10" y="40" font-size="20" fill="#808080">t</text>').contrast.length, 1);
});

test('contrast: a shape that does not hold the centre of the text does not count', {skip}, () => {
  assert.deepEqual(check('<rect x="300" y="0" width="100" height="100" fill="#000000"/><text x="10" y="40" font-size="20" fill="#000000">t</text>').contrast, []);
});

test('contrast: every kind of filled shape counts as a background (circle, ellipse, polygon, path)', {skip}, () => {
  for (const shape of ['<circle cx="60" cy="30" r="50" fill="#000000"/>', '<ellipse cx="60" cy="30" rx="50" ry="40" fill="#000000"/>', '<polygon points="0,0 120,0 120,100 0,100" fill="#000000"/>', '<path d="M0 0 L120 0 L120 100 L0 100 Z" fill="#000000"/>']) {
    assert.equal(check(`${shape}<text x="40" y="40" font-size="20" fill="#000000">t</text>`).contrast.length, 1, shape);
  }
});

test('contrast: fill none, a url() paint and a stroke-only shape are not backgrounds', {skip}, () => {
  for (const shape of ['<rect x="0" y="0" width="400" height="100" fill="none"/>', '<rect x="0" y="0" width="400" height="100" fill="url(#g)"/>', '<rect x="0" y="0" width="400" height="100" fill="none" stroke="#000"/>']) {
    assert.deepEqual(check(`${shape}<text x="10" y="40" font-size="20" fill="#ffffff">t</text>`).contrast.map(c => c.bg), ['rgb(255,255,255)'], shape);
  }
});

test('contrast: colours come from classes, inheritance and currentColor; a text with fill none or url() is skipped', {skip}, () => {
  assert.equal(check('<style>.w { fill: #ffffff }</style><text class="w" x="10" y="40" font-size="20">t</text>').contrast.length, 1);
  assert.equal(check('<g fill="#ffffff"><text x="10" y="40" font-size="20">t</text></g>').contrast.length, 1);
  assert.equal(check('<g color="#ffffff"><text x="10" y="40" font-size="20" fill="currentColor">t</text></g>').contrast.length, 1);
  assert.equal(check('<text x="10" y="40" font-size="20" fill="none">t</text>').contrast.length, 0);
  assert.equal(check('<text x="10" y="40" font-size="20" fill="url(#g)">t</text>').contrast.length, 0);
});

test('contrast: the default fill is black, which is fine on white', {skip}, () => {
  assert.deepEqual(check('<text x="10" y="40" font-size="20">t</text>').contrast, []);
});

test('contrast: a translucent text colour is printed as rgba, and judged on its colour alone', {skip}, () => {
  const r = check('<text x="10" y="40" font-size="20" fill="rgba(255,255,255,0.5)">t</text>');
  assert.equal(r.contrast[0]!.fg, 'rgba(255, 255, 255, 0.5)');
});

test('contrast: text of 41+ characters is cut at 40; empty and whitespace-only text is skipped', {skip}, () => {
  const long = 'a'.repeat(60);
  assert.equal(check(`<text x="0" y="40" font-size="14" fill="#ffffff">${long}</text>`).contrast[0]!.txt, 'a'.repeat(40));
  assert.deepEqual(check('<text x="10" y="40" font-size="20" fill="#ffffff">   </text><text x="10" y="80" font-size="20" fill="#ffffff"></text>').contrast, []);
});

test('contrast: what is inside <defs> or a marker is not drawn there, so it is not a background', {skip}, () => {
  const marker = '<defs><marker id="m" viewBox="0 0 10 10"><path d="M0,0 L10,5 L0,10 z" fill="#000000"/></marker></defs>';
  assert.deepEqual(check(`${marker}<text x="1" y="9" font-size="9" fill="#000000">t</text>`).contrast, []);
});

test('contrast: display none hides a shape and a text', {skip}, () => {
  assert.deepEqual(check('<rect x="0" y="0" width="400" height="100" fill="#000000" display="none"/><text x="10" y="40" font-size="20" fill="#000000">t</text>').contrast, []);
  assert.deepEqual(check('<text x="10" y="40" font-size="20" fill="#ffffff" display="none">t</text>').contrast, []);
});

test('contrast: inside a transformed group the text and the shape are compared where they really are', {skip}, () => {
  const r = check('<g transform="translate(200 100)"><rect x="0" y="0" width="100" height="50" fill="#000000"/><text x="10" y="30" font-size="20" fill="#000000">t</text></g>');
  assert.equal(r.contrast.length, 1);
  assert.equal(check('<g transform="translate(200 100)"><rect x="0" y="0" width="100" height="50" fill="#000000"/></g><text x="10" y="30" font-size="20" fill="#000000">t</text>').contrast.length, 0);
});

// ---- 2. the canvas ----

test('overflow: content past the right or bottom edge by more than 2px, with by how much', () => {
  assert.deepEqual(check('<rect x="300" y="150" width="140" height="80" fill="#ccc"/>').overflow, {dx: 40, dy: 30});
});

test('overflow: 2px past is tolerated, 3px is not; one side alone gives the other a negative number', () => {
  assert.equal(check('<rect x="300" y="100" width="102" height="50" fill="#ccc"/>').overflow, null);
  assert.deepEqual(check('<rect x="300" y="100" width="103" height="50" fill="#ccc"/>').overflow, {dx: 3, dy: -50});
  assert.deepEqual(check('<rect x="100" y="150" width="50" height="53" fill="#ccc"/>').overflow, {dx: -250, dy: 3});
});

test('overflow: a stroke is not counted; a shape past the left or top edge is not an overflow', () => {
  assert.equal(check('<rect x="0" y="0" width="400" height="200" fill="none" stroke="#000" stroke-width="20"/>').overflow, null);
  assert.equal(check('<rect x="-50" y="-50" width="100" height="100" fill="#ccc"/>').overflow, null);
});

test('overflow: a text counts, and so does a transformed shape', {skip}, () => {
  const w = T('far right', 20).w;
  const r = check(`<text x="${400 - w + 40}" y="100" font-size="20">far right</text>`);
  assert.deepEqual(r.overflow?.dx, 40);
  assert.equal(check('<g transform="translate(350 0)"><rect x="0" y="0" width="100" height="50" fill="#ccc"/></g>').overflow?.dx, 50);
});

test('overflow: what is in <defs> or hidden does not count', () => {
  assert.equal(check('<defs><rect x="0" y="0" width="900" height="900"/></defs>').overflow, null);
  assert.equal(check('<rect x="0" y="0" width="900" height="900" display="none"/>').overflow, null);
});

test('overflow: the canvas is the viewBox, not the width and height the page scales it to', () => {
  const r = geometryChecks(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 400 200"><rect x="350" y="0" width="100" height="50" fill="#ccc"/></svg>`)!;
  assert.equal(r.overflow?.dx, 50);
});

test('overflow: with no viewBox, the width and height are the canvas', () => {
  const r = geometryChecks(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect x="350" y="0" width="100" height="50" fill="#ccc"/></svg>`)!;
  assert.equal(r.overflow?.dx, 50);
});

test('overflow: a rect of 100% is the canvas, not an overflow', () => {
  assert.equal(check('<rect width="100%" height="100%" fill="#fff"/>').overflow, null);
});

// ---- 3. text over text ----

test('text overlap: two texts that cover each other are reported, with the share of the smaller box', {skip}, () => {
  const r = check('<text x="20" y="45" font-size="20">Overlapping</text><text x="24" y="50" font-size="20">Overlapping</text>');
  assert.equal(r.textOverlap.length, 1);
  assert.deepEqual([r.textOverlap[0]!.a, r.textOverlap[0]!.b], ['Overlapping', 'Overlapping']);
  assert.ok(r.textOverlap[0]!.ratio > 0.5 && r.textOverlap[0]!.ratio <= 1);
});

test('text overlap: apart, and touching, are fine; barely overlapping is under the 30% line', {skip}, () => {
  assert.deepEqual(check('<text x="20" y="45" font-size="20">top</text><text x="20" y="145" font-size="20">bottom</text>').textOverlap, []);
  const h = T('x', 20); const lineHeight = h.ascent + h.descent;
  assert.deepEqual(check(`<text x="20" y="45" font-size="20">stack</text><text x="20" y="${45 + lineHeight}" font-size="20">stack</text>`).textOverlap, [], 'edge to edge');
  assert.deepEqual(check(`<text x="20" y="45" font-size="20">stack</text><text x="20" y="${45 + Math.floor(lineHeight * 0.8)}" font-size="20">stack</text>`).textOverlap, [], '20% shared');
  assert.equal(check(`<text x="20" y="45" font-size="20">stack</text><text x="20" y="${45 + Math.floor(lineHeight * 0.5)}" font-size="20">stack</text>`).textOverlap.length, 1, '50% shared');
});

test('text overlap: a small text inside a big one is all overlap, and each pair is reported once', {skip}, () => {
  const r = check('<text x="20" y="100" font-size="40">Big label here</text><text x="30" y="95" font-size="14">in</text><text x="60" y="95" font-size="14">too</text>');
  assert.equal(r.textOverlap.length, 2);
  assert.ok(r.textOverlap.every(p => p.ratio === 1));
});

test('text overlap: an empty text is not a text', {skip}, () => {
  assert.deepEqual(check('<text x="20" y="45" font-size="20">word</text><text x="20" y="45" font-size="20">  </text>').textOverlap, []);
});

test('text overlap: rotated text is compared by where it really is', {skip}, () => {
  assert.equal(check('<text x="100" y="100" font-size="20">horizontal</text><g transform="rotate(5 100 100)"><text x="100" y="100" font-size="20">horizontal</text></g>').textOverlap.length, 1);
  // a quarter turn about the start of the text leaves only a corner in common: under the line
  assert.deepEqual(check('<text x="100" y="100" font-size="20">horizontal</text><g transform="rotate(90 100 100)"><text x="100" y="100" font-size="20">vertical</text></g>').textOverlap, []);
  assert.deepEqual(check('<text x="100" y="100" font-size="20">horizontal</text><g transform="translate(0 100)"><text x="100" y="100" font-size="20">elsewhere</text></g>').textOverlap, []);
});

test('text overlap: labels are cut at 30 characters', {skip}, () => {
  const long = 'b'.repeat(50);
  assert.equal(check(`<text x="10" y="40" font-size="14">${long}</text><text x="10" y="40" font-size="14">${long}</text>`).textOverlap[0]!.a, 'b'.repeat(30));
});

// ---- 4. text out of its box ----

test('container overflow: text past the edge of its box is reported by how far', {skip}, () => {
  const w = T('a long label', 16).w;
  const r = check(`<rect x="20" y="20" width="${Math.ceil(w) + 40}" height="80" fill="#fff" stroke="#000"/><text x="${20 + Math.ceil(w) + 40 - w + 10}" y="60" font-size="16">a long label</text>`);
  assert.equal(r.containerOverflow.length, 1);
  assert.equal(r.containerOverflow[0]!.txt, 'a long label');
  assert.ok(Math.abs(r.containerOverflow[0]!.over - 14) < 0.2, String(r.containerOverflow[0]!.over)); // 10 past the edge, plus the 4px padding
});

test('container overflow: more than 3px into the padding is reported, exactly 3 is not', {skip}, () => {
  const box = '<rect x="100" y="20" width="200" height="100" fill="#fff" stroke="#000"/>';
  const at = (x: number) => check(`${box}<text x="${x}" y="70" font-size="16" text-anchor="start">hello</text>`).containerOverflow;
  assert.equal(at(101).length, 0); // 3px into the 4px padding
  assert.equal(at(100.5).length, 1); // 3.5
  assert.equal(at(110).length, 0);
});

test('container overflow: the smallest box that holds the text\'s centre is the container; a box smaller than the text is no container', {skip}, () => {
  const big = '<rect x="0" y="0" width="400" height="200" fill="#fff" stroke="#000"/>';
  const tiny = '<rect x="100" y="55" width="6" height="6" fill="#fff" stroke="#000"/>';
  assert.deepEqual(check(`${big}${tiny}<text x="100" y="70" font-size="16">hello</text>`).containerOverflow, []);
  const snug = '<rect x="95" y="50" width="70" height="30" fill="#fff" stroke="#000"/>';
  assert.equal(check(`${big}${snug}<text x="100" y="70" font-size="16">hello world and more</text>`).containerOverflow.length, 0, 'the snug box is smaller than the text, so the big box is the container');
});

test('container overflow: a rect with neither fill nor stroke is not a box', {skip}, () => {
  assert.deepEqual(check('<rect x="100" y="20" width="60" height="100" fill="none" stroke="none"/><text x="90" y="70" font-size="16">hello</text>').containerOverflow, []);
});

test('container overflow: a badge group is one box made of its children', {skip}, () => {
  const w = T('badge', 14).w;
  const g = `<g data-badge="1"><rect x="100" y="50" width="${Math.ceil(w) + 8}" height="30" rx="14" fill="#fff" stroke="#000"/><text x="${100 + 4 - 6}" y="70" font-size="14" text-anchor="start">badge</text></g>`;
  assert.equal(check(g).containerOverflow.length, 1);
  assert.deepEqual(check(g.replace('x="98"', 'x="106"')).containerOverflow, []);
});

test('container overflow: a text in no box is fine', {skip}, () => {
  assert.deepEqual(check('<text x="10" y="40" font-size="16">alone</text>').containerOverflow, []);
});

// ---- 5. a shape over a text ----

const TXT = '<text x="100" y="60" font-size="20">covered text</text>';
const tb = () => { const t = T('covered text', 20); return {x: 100, y: 60 - t.ascent, w: t.w, h: t.ascent + t.descent}; };

test('covered: a filled shape painted after a text, over it, is reported with its kind', {skip}, () => {
  const b = tb();
  const r = check(`${TXT}<rect x="${b.x - 5}" y="${b.y - 5}" width="${b.w + 10}" height="${b.h + 10}" fill="#ff0000"/>`);
  assert.deepEqual(r.covered, [{txt: 'covered text', by: 'rect', how: 'covers'}]);
  for (const [tag, shape] of [['circle', `<circle cx="${b.x + b.w / 2}" cy="${b.y + b.h / 2}" r="40" fill="#f00"/>`], ['ellipse', `<ellipse cx="${b.x + b.w / 2}" cy="${b.y + b.h / 2}" rx="${b.w}" ry="30" fill="#f00"/>`], ['polygon', `<polygon points="${b.x},${b.y} ${b.x + b.w},${b.y} ${b.x + b.w},${b.y + b.h}" fill="#f00"/>`], ['path', `<path d="M${b.x} ${b.y} h${b.w} v${b.h} h-${b.w} z" fill="#f00"/>`]] as const) {
    assert.equal(check(`${TXT}${shape}`).covered[0]?.by, tag, tag);
  }
});

test('covered: a background drawn before the text is fine', {skip}, () => {
  const b = tb();
  assert.deepEqual(check(`<rect x="${b.x - 5}" y="${b.y - 5}" width="${b.w + 10}" height="${b.h + 10}" fill="#ff0000"/>${TXT}`).covered, []);
});

test('covered: needs 3px by 3px and 30px² of overlap, and half opacity or more', {skip}, () => {
  const b = tb();
  const over = (w: number, h: number, extra = '') => check(`${TXT}<rect x="${b.x - 50}" y="${b.y - 50}" width="${50 + w}" height="${50 + h}" fill="#f00" ${extra}/>`).covered.length;
  assert.equal(over(10, 10), 1);
  assert.equal(over(2.9, 20), 0, 'under 3px wide');
  assert.equal(over(20, 2.9), 0, 'under 3px tall');
  assert.equal(over(5, 5), 0, '25px²');
  assert.equal(over(6, 6), 1, '36px²');
  assert.equal(over(20, 20, 'fill-opacity="0.49"'), 0);
  assert.equal(over(20, 20, 'fill-opacity="0.5"'), 1);
  assert.equal(over(20, 20, 'opacity="0.4"'), 0);
  assert.equal(over(20, 20, 'fill="none" stroke="none"'), 0);
});

test('covered: data-allow-cover on the shape or any ancestor excuses it', {skip}, () => {
  const b = tb();
  const rect = `<rect x="${b.x - 5}" y="${b.y - 5}" width="${b.w + 10}" height="${b.h + 10}" fill="#f00"`;
  assert.deepEqual(check(`${TXT}${rect} data-allow-cover="1"/>`).covered, []);
  assert.deepEqual(check(`${TXT}<g data-allow-cover="1">${rect}/></g>`).covered, []);
  assert.equal(check(`${TXT}<g data-other="1">${rect}/></g>`).covered.length, 1);
});

test('covered: a line through the text is reported as crossing; one above or below it, or a rect outline, is not', {skip}, () => {
  const b = tb();
  const line = (y: number) => check(`${TXT}<path d="M0 ${y} L400 ${y}" stroke="#000" fill="none"/>`).covered;
  assert.deepEqual(line(b.y + b.h / 2), [{txt: 'covered text', by: 'path', how: 'crosses'}]);
  assert.equal(line(b.y + 1).length, 0, 'inside the top 2px margin');
  assert.equal(line(b.y + b.h - 1).length, 0, 'inside the bottom 2px margin');
  assert.equal(line(b.y - 10).length, 0);
  assert.equal(line(b.y + 3).length, 1, 'just below the margin');
  assert.deepEqual(check(`${TXT}<rect x="0" y="${b.y + 3}" width="400" height="${b.h - 6}" fill="none" stroke="#000"/>`).covered, [], 'a rect outline is a frame, not a strike-through');
});

test('covered: a line that stops short, or a stroke-less or zero-width one, does not cross', {skip}, () => {
  const b = tb(), y = b.y + b.h / 2;
  assert.equal(check(`${TXT}<path d="M0 ${y} L${b.x - 10} ${y}" stroke="#000" fill="none"/>`).covered.length, 0);
  assert.equal(check(`${TXT}<path d="M0 ${y} L400 ${y}" stroke="none" fill="none"/>`).covered.length, 0);
  assert.equal(check(`${TXT}<path d="M0 ${y} L400 ${y}" stroke="#000" stroke-width="0" fill="none"/>`).covered.length, 0);
});

test('covered: a curved stroke, a circle outline and a polyline are followed along their length', {skip}, () => {
  const b = tb(), cy = b.y + b.h / 2;
  assert.equal(check(`${TXT}<path d="M0 ${cy} C 100 ${cy - 60}, 300 ${cy + 60}, 400 ${cy}" stroke="#000" fill="none"/>`).covered.length, 1);
  assert.equal(check(`${TXT}<path d="M0 ${cy + 90} C 100 ${cy + 60}, 300 ${cy + 60}, 400 ${cy + 90}" stroke="#000" fill="none"/>`).covered.length, 0, 'a curve below the text');
  assert.equal(check(`${TXT}<circle cx="${b.x + b.w / 2}" cy="${cy}" r="30" fill="none" stroke="#000"/>`).covered[0]?.how, 'crosses');
  assert.equal(check(`${TXT}<polyline points="0,${cy} 400,${cy}" fill="none" stroke="#000"/>`).covered[0]?.by, 'polyline');
});

test('covered: a line with the default fill counts as filled (as in a browser), so a flat one is judged by its box', {skip}, () => {
  const b = tb(), cy = b.y + b.h / 2;
  assert.deepEqual(check(`${TXT}<line x1="0" y1="${cy}" x2="400" y2="${cy}" stroke="#000"/>`).covered, [], 'zero-height box: no 3px overlap, and not stroke-only');
  assert.equal(check(`${TXT}<line x1="0" y1="${cy}" x2="400" y2="${cy}" stroke="#000" fill="none"/>`).covered[0]?.how, 'crosses');
});

test('covered: only shapes after the text count, text over text is the other check, and what is not drawn is ignored', {skip}, () => {
  const b = tb();
  assert.deepEqual(check(`${TXT}<text x="${b.x}" y="60" font-size="20">second</text>`).covered, []);
  assert.deepEqual(check(`${TXT}<defs><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#f00"/></defs>`).covered, []);
  assert.deepEqual(check(`${TXT}<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#f00" display="none"/>`).covered, []);
});

test('covered: the first shape that covers is the one reported (one finding per text)', {skip}, () => {
  const b = tb();
  const r = check(`${TXT}<circle cx="${b.x + 20}" cy="${b.y + 10}" r="30" fill="#f00"/><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#00f"/>`);
  assert.deepEqual(r.covered.map(c => c.by), ['circle']);
});

// ---- the viewBox scale ----

test('a figure shown at twice its viewBox gives the same findings as at its own size', {skip}, () => {
  const body = '<text x="20" y="45" font-size="20">Overlapping</text><text x="24" y="50" font-size="20">Overlapping</text><rect x="300" y="150" width="140" height="80" fill="#ccc"/>';
  const a = geometryChecks(svg(body, 400, 200))!;
  const b = geometryChecks(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 400 200">${STYLE}${body}</svg>`)!;
  assert.deepEqual(b, a);
});

test('a figure shown at twice its viewBox is measured as shown: how far a text spills is in screen pixels, how far it overflows is in canvas units', {skip}, () => {
  const body = '<rect x="20" y="20" width="200" height="100" fill="#fff" stroke="#000"/><text x="10" y="70" font-size="16">spills out</text><rect x="350" y="0" width="100" height="50" fill="#ccc"/>';
  const once = geometryChecks(svg(body, 400, 200))!;
  const twice = geometryChecks(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 400 200">${STYLE}${body}</svg>`)!;
  assert.equal(once.containerOverflow.length, 1);
  // the box edge and the text start are 2x as far apart on screen; the padding is a screen measure and does not scale
  const pad = 4;
  assert.ok(Math.abs(once.containerOverflow[0]!.over - (20 + pad - 10)) < 0.01);
  assert.ok(Math.abs(twice.containerOverflow[0]!.over - (2 * 20 + pad - 2 * 10)) < 0.01, String(twice.containerOverflow[0]!.over));
  assert.deepEqual(twice.overflow, once.overflow);
});

// ---- outlined text: a rim has to be seen to make a letter read ----

test('a white letter on a white page reads by a rim that is thick and opaque enough, and not by a hairline or a faint stroke', { skip }, () => {
  const txt = (attrs: string) => `<text x="20" y="80" font-size="40" fill="#ffffff" ${attrs}>SALE</text>`;
  assert.deepEqual(check(txt('stroke="#22201b" stroke-width="3"')).contrast, [], 'a 1.5px visible rim');
  assert.equal(check(txt('stroke="#22201b" stroke-width="0.2"')).contrast.length, 1, 'a hairline');
  assert.equal(check(txt('stroke="#22201b" stroke-width="3" opacity="0.5"')).contrast.length, 1, 'a faint stroke');
  assert.equal(check(txt('stroke="#fafafa" stroke-width="3"')).contrast.length, 1, 'a rim as pale as the page');
  assert.equal(check(txt('')).contrast.length, 1, 'no rim at all');
  assert.equal(check(txt('stroke="rgba(34,32,27,0.1)" stroke-width="3"')).contrast.length, 1, 'a rim whose colour is nearly transparent');
  assert.equal(check(txt('stroke="#22201b1a" stroke-width="3"')).contrast.length, 1, 'a rim with #rrggbbaa alpha');
  assert.equal(check(`<g opacity="0.1">${txt('stroke="#22201b" stroke-width="3"')}</g>`).contrast.length, 1, 'a rim inside a faint group');
});

test('only a data-decor text is exempt from the contrast / overlap checks; aria-hidden alone is not', { skip }, () => {
  const base = `<text x="20" y="80" font-size="40" fill="#22201b">SALE</text>`;
  const copy = (attrs: string) => `<text x="22" y="82" font-size="40" fill="#22201b" ${attrs}>SALE</text>`;
  assert.equal(check(base + copy('aria-hidden="true"')).textOverlap.length, 1, 'aria-hidden is an author\'s own business');
  assert.deepEqual(check(base + copy('aria-hidden="true" data-decor=""')).textOverlap, [], 'a decorative copy');
  assert.deepEqual(check(`<g data-decor="">${copy('')}</g>` + base).textOverlap, [], 'decoration marked on a group');
  assert.equal(check(`<text x="20" y="80" font-size="40" fill="#fafafa" data-decor="">SALE</text>`).contrast.length, 0, 'not judged for contrast');
  assert.ok(check(`<text x="380" y="80" font-size="40" fill="#22201b" data-decor="">SALE</text>`).overflow, 'but still counts for overflow');
});
