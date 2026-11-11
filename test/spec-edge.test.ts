// Text as outlines, and a spec drawn with nothing but a text engine handed in: what a Cloudflare Worker has.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {build as bundle} from 'esbuild';
import {closeMeasurer} from '../lib/dsl.ts';
import {harfbuzz, resolveFontFile} from '../lib/font-metrics.ts';
import fs from 'node:fs';
import {partCatalog} from '../lib/spec.ts';
import {TextEngineError, renderSpecEdge, type OutlineFont, type TextEngine} from '../lib/spec-edge.ts';
import {renderSpec, svgToPng} from '../lib/spec-render.ts';
import {rasterizeWithResvg} from '../lib/raster.ts';
import {outlineText} from '../lib/svg-outline.ts';
import {xmlProblems} from '../lib/xml-check.ts';

test.after(() => closeMeasurer());
const ROOT = path.resolve(import.meta.dirname, '..');
const spec = (...parts: unknown[]) => ({version: 1, title: '例', parts});

const fake: OutlineFont = {
  shape: text => ({upem: 1000, glyphs: [...text].map(c => ({id: c.codePointAt(0) as number, xAdvance: 1000, xOffset: 0, yOffset: 0}))}),
  path: id => id === 32 ? '' : `M${id} 0Z`,
  covers: cp => cp < 0x2000 || (cp >= 0x3000 && cp < 0xe000),
};
const fakeBox = (text: string, _f: unknown, size: number) => ({w: [...text].length * size, ascent: size, descent: 0});
const wrap = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><style>text { font-family: 'Noto Sans JP', sans-serif; }\n.emoji { font-family: 'Noto Color Emoji'; }</style>${inner}</svg>`;

test('every <text> becomes outlines at the place it was drawn, and a repeated glyph is defined once', () => {
  const {svg, missing, unsupported} = outlineText(wrap('<text x="50" y="20" text-anchor="middle" font-size="10" font-weight="700" fill="#123456">AA</text>'), fake, fakeBox);
  assert.doesNotMatch(svg, /<text\b/);
  assert.equal(svg.match(/<path id=/g)?.length, 1);
  assert.match(svg, /<path id="sd-glyph-sb65" d="M65 0Z"\/>/);
  assert.match(svg, /translate\(40 20\) scale\(0\.01 -0\.01\)/);
  assert.match(svg, /translate\(50 20\)/);
  assert.match(svg, /<g fill="#123456" role="img" aria-label="AA">/);
  assert.deepEqual([missing, unsupported], [[], []]);
  assert.deepEqual(xmlProblems(svg), []);
});

test('the font rules go with the text, and other styles stay', () => {
  assert.doesNotMatch(outlineText(wrap('<text x="1" y="1">A</text>'), fake, fakeBox).svg, /<style>|font-family/);
  const kept = outlineText('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><style>text { font-family: x; } rect { fill: red; }</style><text>A</text></svg>', fake, fakeBox).svg;
  assert.match(kept, /rect \{ fill: red; \}/);
  assert.doesNotMatch(kept, /font-family/);
});

test('tspans keep their own weight and colour, and a transform stays on the group', () => {
  const {svg} = outlineText(wrap('<text x="0" y="10" font-size="10" fill="#111" transform="rotate(90)">A<tspan font-weight="700" fill="#222">B</tspan></text>'), fake, fakeBox);
  assert.match(svg, /<g fill="#111" transform="rotate\(90\)" role="img" aria-label="AB">/);
  assert.match(svg, /#sd-glyph-sr65"[^>]*translate\(0 10\)/);
  assert.match(svg, /<g fill="#222"><use href="#sd-glyph-sb66"[^>]*translate\(10 10\)[^>]*\/><\/g>/);
});

test('escaped text is read as text, and escaped again in the label', () => {
  const {svg} = outlineText(wrap('<text x="0" y="10" font-size="10">a&lt;&amp;"</text>'), fake, fakeBox);
  assert.match(svg, /aria-label="a&lt;&amp;&quot;"/);
  assert.match(svg, /sd-glyph-sr60/); // "<" was shaped as the one character it is
  assert.deepEqual(xmlProblems(svg), []);
});

test('a space takes room but draws nothing', () => {
  const {svg} = outlineText(wrap('<text x="0" y="10" font-size="10" xml:space="preserve">A B</text>'), fake, fakeBox);
  assert.doesNotMatch(svg, /sd-glyph-sr32/);
  assert.match(svg, /#sd-glyph-sr66"[^>]*translate\(20 10\)/);
});

test('a character the font lacks is reported; joiners and selectors are not', () => {
  // the fake font lists none of U+2060, U+200E, U+200D, U+FE0F or U+E0100
  const {missing} = outlineText(wrap('<text x="0" y="10" font-size="10">A😀\u200d\ufe0f\u2060\u200e\u{e0100}</text>'), fake, fakeBox);
  assert.deepEqual(missing.map(m => m.char), ['😀']);
});

test('the font rules are removed from <style> only: text that looks like one survives', () => {
  const rule = 'text { font-family: x }';
  const {svg} = outlineText(`<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><title>${rule}</title><style>${rule}</style><text font-size="10">${rule}</text></svg>`, fake, fakeBox);
  assert.match(svg, /<title>text \{ font-family: x \}<\/title>/);
  assert.match(svg, /aria-label="text \{ font-family: x \}"/);
  assert.doesNotMatch(svg, /<style>/);
});

test('opacity set by a rule is kept', () => {
  const {svg} = outlineText('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><style>.dim { opacity: 0.5 }</style><text class="dim" font-size="10">A</text></svg>', fake, fakeBox);
  assert.match(svg, /<g fill="black" opacity="0\.5"/);
});

test('what outlines would not reproduce is reported, whichever way it was written', () => {
  assert.deepEqual(outlineText(wrap('<text x="0" y="10" style="letter-spacing: 2px">A</text>'), fake, fakeBox).unsupported, ['letter-spacing']);
  assert.deepEqual(outlineText('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><style>.x { font-style: italic }</style><text class="x">A</text></svg>', fake, fakeBox).unsupported, ['font-style']);
  assert.deepEqual(outlineText(wrap('<text x="0" y="10" visibility="hidden">A</text>'), fake, fakeBox).unsupported, ['visibility']);
});

test('what outlines would not reproduce is reported, not silently lost', () => {
  assert.deepEqual(outlineText(wrap('<text x="0" y="10" writing-mode="tb">A</text>'), fake, fakeBox).unsupported, ['writing-mode']);
  assert.deepEqual(outlineText(wrap('<text x="0" y="10" stroke="#fff">A</text>'), fake, fakeBox).unsupported, ['stroke']);
});

// a real engine: HarfBuzz over the fonts the layout measures with
function realEngine(): TextEngine {
  const hb = harfbuzz();
  const open = (weight: number) => {
    const r = resolveFontFile('sans', weight);
    assert.ok(r, 'a Japanese font must be installed for this test');
    const b = fs.readFileSync(r.file);
    const face = new hb.Face(new hb.Blob(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), r.index), font = new hb.Font(face), ext = font.hExtents();
    return {face, font, upem: face.upem, asc: ext.ascender, desc: ext.descender, covered: new Set(face.collectUnicodes())};
  };
  const fonts = {400: open(400), 700: open(700)};
  const of = (w: number) => w >= 600 ? fonts[700] : fonts[400];
  const shape = (text: string, weight: number) => {
    const f = of(weight), buf = new hb.Buffer();
    buf.addText(text); buf.guessSegmentProperties(); hb.shape(f.font, buf);
    const infos = buf.getGlyphInfos(), pos = buf.getGlyphPositions();
    return {upem: f.upem, glyphs: infos.map((g, i) => ({id: g.codepoint, xAdvance: pos[i]?.xAdvance ?? 0, xOffset: pos[i]?.xOffset ?? 0, yOffset: pos[i]?.yOffset ?? 0}))};
  };
  const width = (text: string, size: number, weight: number) => { const s = shape(text, weight); return s.glyphs.reduce((n, g) => n + g.xAdvance, 0) / s.upem * size; };
  return {
    measure: ({text, size, weight}) => { const f = of(weight); return {w: width(text, size, weight), h: Math.round((f.asc - f.desc) / f.upem * size)}; },
    textBox: (text, _family, size, weight) => { const f = of(weight); return {w: width(text, size, weight), ascent: f.asc / f.upem * size, descent: -f.desc / f.upem * size}; },
    font: {shape: (text, _f, weight) => shape(text, weight), path: (id, _f, weight) => of(weight).font.glyphToPath(id), covers: (cp, _f, weight) => of(weight).covered.has(cp)},
  };
}

test('every example of the catalog draws with no text element left, and at the size the Node path gives', async () => {
  const engine = realEngine();
  for (const {type, example} of partCatalog()) {
    const r = await renderSpecEdge(spec(example), engine);
    assert.deepEqual([r.issues, r.problems], [[], []], type);
    assert.ok(r.svg);
    assert.doesNotMatch(r.svg, /<text\b/, type);
    assert.match(r.svg, /<use href="#sd-glyph-/, type);
    assert.deepEqual(xmlProblems(r.svg), [], type);
    const tags = new Set([...r.svg.matchAll(/<([a-zA-Z][\w:-]*)/g)].map(m => m[1]));
    assert.deepEqual([...tags].filter(t => !WIDGET_ELEMENTS.has(t as string)), [], `${type}: the plugin widget drops these elements`);
    const node = await renderSpec(spec(example), {config: {measure: 'font'}});
    assert.deepEqual([r.width, r.height], [node.width, node.height], type);
  }
});

/** The elements the plugin's widget keeps (svg-diagram-mcp-plugin widget/widget.html ALLOWED): a figure needing more is not shown there. */
const WIDGET_ELEMENTS: ReadonlySet<string> = new Set(['svg', 'g', 'defs', 'path', 'use', 'rect', 'line', 'polyline', 'polygon', 'circle', 'ellipse', 'marker', 'title', 'desc']);

const richSpecs = () => [
  ...partCatalog().map(p => spec(p.example)),
  {version: 1, title: '全部', theme: 'teal', showTitle: true, sourceLine: '出典: 例', parts: [{type: 'swimlane', lanes: [{id: 'a', label: '申請者'}, {id: 'b', label: '上長', tone: 'muted'}], steps: [{id: 's', lane: 'a', title: '申請する', body: '内容を記入', col: 1, tag: '当日'}, {id: 't', lane: 'b', title: '確認する', tone: 'accent', col: 2}], flows: [{from: 's', to: 't', label: '依頼'}], phases: [{label: '段階', from: 1, to: 2}], boundaries: [{after: 'a', label: '線'}]}]},
  {version: 1, title: '暗', appearance: 'dark', parts: [{type: 'flowchart', nodes: [{id: 'a', kind: 'terminator', label: 'Start ABC 123'}, {id: 'q', kind: 'decision', label: '長い質問の文章は折り返されますか？'}, {id: 'b', label: '処理', sub: '補足', tone: 'danger'}], edges: [{from: 'a', to: 'q'}, {from: 'q', to: 'b', label: 'Yes', line: 'dashed', tone: 'accent'}]}]},
  spec({type: 'sequence', actors: [{id: 'u', label: '利用者'}, {id: 'a', label: 'API'}], steps: [{divider: '認証'}, {from: 'u', to: 'a', label: '全角　スペース'}, {self: 'a', label: '検証'}, {note: '注記', over: ['a']}]}),
];

const LAYOUTS = ['radial', 'right', 'left', 'down', 'up', 'org', 'list', 'brace', 'fishbone', 'timeline'];
const root = {label: '検討項目', tone: 'accent', children: [{label: '目的', sub: '補足', children: [{label: '時間を半分に'}, {label: '欠品の防止'}]}, {label: '機能', children: [{label: '読み取り'}, {label: '通知'}]}, {label: '課題', children: [{label: '連携'}]}]};

test('every layout of a mind map outlines cleanly, or says it cannot be drawn', async () => {
  const engine = realEngine();
  let drawn = 0;
  for (const layout of LAYOUTS) {
    const r = await renderSpecEdge(spec({type: 'mindmap', root, layout}), engine);
    if (r.svg === null) { assert.ok(r.issues.length > 0, layout); continue; }
    drawn++;
    assert.doesNotMatch(r.svg, /<text\b/, layout);
    assert.deepEqual(r.problems.filter(p => p.rule === 'outline'), [], layout);
    assert.deepEqual(xmlProblems(r.svg), [], layout);
  }
  assert.ok(drawn >= 8, `only ${drawn} layouts were drawn`);
});

test('the TOC trees, the cloud and the value chain outline with no feature lost', async () => {
  const engine = realEngine();
  const nodes = [{id: 'u', label: '納期に遅れる', role: 'ude'}, {id: 'w', label: '仕掛りが多い', sub: '補足'}, {id: 'r', label: '稼働率で評価される', role: 'root'}, {id: 'p', label: '受注量は変えられない', role: 'precondition'}];
  const links = [{from: ['r', 'p'], to: 'w'}, {from: 'w', to: 'u'}, {from: 'u', to: 'r', back: true}];
  for (const part of [
    {type: 'causeTree', tree: 'crt', coreDriver: true, nodes, links},
    {type: 'cloud', a: '成功', b: '品質', c: '速度', d: '検証する', d2: '早く出す', conflictLabel: '対立', assumptions: [{on: 'bd', text: '前提', injection: '打ち手'}]},
    {type: 'valueChain', support: [{label: '管理', sub: '補足'}], primary: [{label: '製造', tone: 'accent'}, {label: '販売'}], margin: '利益', titles: ['支援', '主']},
  ]) {
    const r = await renderSpecEdge(spec(part), engine);
    assert.deepEqual(r.issues, [], part.type);
    assert.deepEqual(r.problems.filter(p => p.rule === 'outline'), [], part.type);
    assert.doesNotMatch(r.svg ?? '<text', /<text\b/, part.type);
  }
});

test('the outlines land where the text was, in its colour: the pictures match in every channel', async () => {
  const engine = realEngine();
  for (const s of richSpecs()) {
    const edge = await renderSpecEdge(s, engine), node = await renderSpec(s, {config: {measure: 'font'}});
    assert.deepEqual(edge.issues, [], JSON.stringify(s).slice(0, 80));
    const a = await rasterizeWithResvg(edge.svg as string), b = await rasterizeWithResvg(node.svg as string);
    assert.deepEqual([a.width, a.height], [b.width, b.height]);
    let diff = 0;
    for (let i = 0; i < a.rgba.length; i += 4) if ([0, 1, 2].some(c => Math.abs((a.rgba[i + c] as number) - (b.rgba[i + c] as number)) > 64)) diff++;
    assert.ok(diff / (a.width * a.height) < 0.0005, `${s.title}: ${diff} of ${a.width * a.height} pixels differ`);
  }
});

test('a full-width space keeps its width', async () => {
  const s = spec({type: 'flowchart', nodes: [{id: 'a', label: '開始　終了'}, {id: 'b', label: '次'}], edges: [{from: 'a', to: 'b'}]});
  const r = await renderSpecEdge(s, realEngine());
  assert.match(r.svg ?? '', /aria-label="開始　終了"/);
  const xs = [...(r.svg ?? '').matchAll(/translate\(([\d.]+) /g)].map(m => Number(m[1]));
  assert.ok(xs[2] !== undefined && xs[1] !== undefined && xs[2] - xs[1] > 27, `from the second glyph to the third: ${String(xs[2])} - ${String(xs[1])}`);
});

test('outlined figures are ordinary SVG for svgToPng too', async () => {
  const r = await renderSpecEdge(spec(partCatalog()[0]?.example), realEngine());
  assert.equal((await svgToPng(r.svg as string)).width, r.width);
});

test('an emoji is refused at its field, naming the character', async () => {
  const r = await renderSpecEdge(spec({type: 'flowchart', nodes: [{id: 'a', label: '開始😀'}, {id: 'b', label: '終了'}], edges: [{from: 'a', to: 'b'}]}), realEngine());
  assert.equal(r.svg, null);
  assert.equal(r.issues[0]?.path, 'parts[0].nodes[0].label');
  assert.match(r.issues[0]?.message ?? '', /😀.*U\+1F600.*emoji/s);
});

test('a character that cannot be drawn is reported at every field that holds it, once, wherever it is', async () => {
  const r = await renderSpecEdge({version: 1, title: '例', sourceLine: '出典😀', parts: [{type: 'flowchart', nodes: [{id: 'a', label: 'A😀', sub: '補足⭐'}, {id: 'b', label: 'B😀'}], edges: [{from: 'a', to: 'b'}]}]}, realEngine());
  assert.deepEqual(r.issues.map(i => i.path).sort(), ['parts[0].nodes[0].label', 'parts[0].nodes[0].sub', 'parts[0].nodes[1].label', 'sourceLine']);
});

test('a character the font lacks that is not an emoji is not blamed on emoji, and repeats are reported once', async () => {
  const r = await renderSpecEdge(spec({type: 'flowchart', nodes: [{id: 'a', label: '\uE000'.repeat(25) + '\uE001'}, {id: 'b', label: '안녕'}], edges: [{from: 'a', to: 'b'}]}), realEngine());
  assert.deepEqual(r.issues.map(i => /U\+([0-9A-F]+)/.exec(i.message)?.[1]), ['E000', 'E001', 'C548', 'B155']);
  assert.doesNotMatch(r.issues[0]?.message ?? '', /emoji/i);
  assert.match(r.issues[0]?.message ?? '', /Japanese or Latin/);
});

test('a failing engine throws its own error, at measuring and at outlining; it is not a spec issue', async () => {
  const engine = realEngine();
  const boom = () => { throw new Error('font file missing'); };
  await assert.rejects(renderSpecEdge(spec(partCatalog()[0]?.example), {...engine, measure: boom}), TextEngineError);
  await assert.rejects(renderSpecEdge(spec(partCatalog()[0]?.example), {...engine, textBox: boom}), TextEngineError);
  await assert.rejects(renderSpecEdge(spec(partCatalog()[0]?.example), {...engine, font: {...engine.font, path: boom}}), TextEngineError);
});

test('problems and findings are bounded at the limits of the schema', async () => {
  const n = 12, lanes = Array.from({length: n}, (_, i) => ({id: `l${i}`, label: '担当者'}));
  const steps = Array.from({length: 48}, (_, i) => ({id: `s${i}`, lane: `l${i % n}`, title: '手順', col: (i % 8) + 1, row: Math.floor(i / 8) % 2 + 1}));
  const flows = Array.from({length: 47}, (_, i) => ({from: `s${i}`, to: `s${i + 1}`, label: '長いラベルの文字列です'}));
  const r = await renderSpecEdge(spec({type: 'swimlane', lanes, steps, flows}), realEngine());
  assert.ok(r.problems.length + r.issues.length > 0, 'this figure must have something wrong for the test to mean anything');
  assert.ok(r.problems.length <= 21, `${r.problems.length} problems`);
  assert.ok(r.findings.length <= 21, `${r.findings.length} findings`);
});

test('a swimlane too narrow says so in the fields of a spec', async () => {
  const steps = Array.from({length: 8}, (_, i) => ({id: `s${i}`, lane: 'a', title: '手順', col: i + 1}));
  const r = await renderSpecEdge(spec({type: 'swimlane', lanes: [{id: 'a', label: '人'}], steps, colGap: 96}), realEngine());
  assert.match(r.issues[0]?.message ?? '', /Lower colGap or use fewer columns/);
  assert.doesNotMatch(r.issues[0]?.message ?? '', /widen the diagram|labelW/);
});

test('bad specs and figures that cannot be drawn come back in the result', async () => {
  const engine = realEngine();
  assert.equal((await renderSpecEdge({version: 1}, engine)).issues[0]?.path, 'title');
  const tall = await renderSpecEdge(spec(partCatalog()[0]?.example), engine, {maxHeight: 10});
  assert.equal(tall.svg, null);
  assert.match(tall.issues[0]?.message ?? '', /limit is 10px/);
});

test('the edge entry reaches no node: module, directly or through what it imports', async () => {
  const out = await bundle({entryPoints: [path.join(ROOT, 'lib/spec-edge.ts')], bundle: true, write: false, metafile: true, format: 'esm', platform: 'browser', logLevel: 'silent'});
  const imports = Object.values(out.metafile.outputs).flatMap(o => o.imports.map(i => i.path));
  assert.deepEqual(imports.filter(i => i.startsWith('node:')), []);
});

test('lang: en leaves no Japanese in what a figure writes by itself', async () => {
  const engine = realEngine();
  const CJK = /[\u3000-\u30ff\u3400-\u9fff\uff00-\uffef]/;
  const parts = [
    {type: 'swimlane', lanes: [{id: 'a', label: 'Sales'}, {id: 'b', label: 'Ops'}], steps: [{id: 's', lane: 'a', title: 'Order', col: 1}, {id: 't', lane: 'b', title: 'Ship', col: 2}], flows: [{from: 's', to: 't'}]},
    {type: 'raci', legend: true, tasks: ['Plan'], roles: ['PM', 'Dev'], assignments: [['A/R', 'C']]},
    {type: 'cloud', a: 'Win', b: 'Quality', c: 'Speed', d: 'Test long', d2: 'Ship early'},
    {type: 'quadrant', x: {title: 'Share'}, y: {title: 'Growth'}, items: [{label: 'One', at: [0.2, 0.3], size: 5}, {label: 'Two', at: [0.7, 0.6], size: 9}]},
    {type: 'causeTree', tree: 'crt', coreDriver: true, nodes: [{id: 'u', label: 'Late', role: 'ude'}, {id: 'v', label: 'Costly', role: 'ude'}, {id: 'r', label: 'KPI', role: 'root'}], links: [{from: 'r', to: 'u'}, {from: 'r', to: 'v'}]},
    {type: 'journeyMap', stages: ['A', 'B'], lanes: [{id: 'emotion', label: 'Feeling', cells: [1, -1]}]},
    {type: 'gantt', today: '2026-01-07', rows: [{label: 'Work', start: '2026-01-05', days: 5}]},
    {type: 'whyWhyTree', problem: 'Late', whys: [{why: 'No plan', trueCause: true, measure: 'Plan'}]},
    {type: 'valueChain', primary: [{label: 'Make'}]},
    {type: 'sequence', actors: [{id: 'u', label: 'User'}], steps: [{self: 'u', label: 'Think'}]},
  ];
  for (const part of parts) {
    const r = await renderSpecEdge({version: 1, title: 'Example', lang: 'en', legend: 'auto', parts: [part]}, engine);
    assert.deepEqual(r.issues, [], part.type);
    const words = [...(r.svg ?? '').matchAll(/aria-label="([^"]*)"|<title[^>]*>([^<]*)<|<desc[^>]*>([^<]*)</g)].map(m => m[1] ?? m[2] ?? m[3] ?? '');
    assert.deepEqual(words.filter(w => CJK.test(w)), [], part.type);
  }
});
