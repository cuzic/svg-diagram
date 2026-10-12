// ADR 0003: bold / coloured words inside a box's text (em.* parts), from the DSL down to the lint of the drawing.
import './helpers/strict-width.ts'; // an atom layout did not register for measuring throws instead of measuring 0 wide (acceptance: 0 misses)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {banner, box, caption, checkDiagram, closeMeasurer, diagram, em, group, renderDiagram, row, stat, swimlane} from '../lib/dsl.ts';
import {richOf} from '../lib/rich.ts';
import {measureAll, splitAtoms} from '../lib/measure.ts';
import {styledAtoms} from '../lib/layout.ts';
import {parseXml, computeStyles, elements} from '../lib/svg-dom.ts';
import {textBoxOf} from '../lib/svg-geom.ts';
import {geometryChecks} from '../lib/svg-lint.ts';
import {resolveFontFile} from '../lib/font-metrics.ts';
import {diagramDesc, diagramTitle} from '../lib/rules.ts';
import {measureBudget} from '../lib/budget.ts';
import type {BoxBand, LaidOutBox, LaidOutDiagram, WidthOf, WrappedRun} from '../lib/dsl.ts';

test.after(() => closeMeasurer());

const skip = resolveFontFile('sans') !== null ? false : 'no font file found';
const render = (d: ReturnType<typeof diagram>) => renderDiagram(d, {name: 'rich.svg', budget: 'cacheOnly'});
const boxesOf = (l: LaidOutDiagram): LaidOutBox[] => l.laidOut.flatMap(b => b.type === 'box' ? [b] : b.type === 'row' || b.type === 'grid' ? b.children : []);

// ---- richOf ----

test('richOf: a string is exactly its characters, whatever it looks like', () => {
  for (const s of ['**API**', '{frame: false}', 'lib/**/*.ts', '{"a": [1, 2]}', '[[danger:x]]', '', ' leading and trailing ']) assert.deepEqual(richOf(s, {field: 'f', bold: false}), {text: s});
});

test('richOf: random strings and arrays of strings are plain text with no spans', () => {
  let s = 12345;
  const rnd = () => { s = (s * 1103515245 + 12345) >>> 0; return s / 2 ** 32; };
  const alphabet = ['*', '**', '{', '}', 'a', 'API', ' ', '\n', 'あ', '(', ':', 'lib/**/*.ts'];
  for (let n = 0; n < 300; n++) {
    const parts = Array.from({length: Math.floor(rnd() * 6)}, () => alphabet[Math.floor(rnd() * alphabet.length)]);
    const r = richOf(parts, {field: 'f', bold: false});
    assert.equal(r.text, parts.join(''));
    assert.equal(r.spans, undefined);
  }
});

test('richOf: spans concatenate to the text; neighbours of one style merge; plain pieces are spans too', () => {
  const r = richOf(['許可は ', em.danger(em.b('ユーザー')), em.danger(em.b('！')), ' が決める'], {field: 'f', bold: false});
  assert.equal(r.text, '許可は ユーザー！ が決める');
  assert.deepEqual(r.spans, [{text: '許可は '}, {text: 'ユーザー！', bold: true, tone: 'danger'}, {text: ' が決める'}]);
  assert.equal(r.spans!.map(sp => sp.text).join(''), r.text);
  assert.deepEqual(richOf([em.b('a'), em.b('b')], {field: 'f', bold: false}).spans, [{text: 'ab', bold: true}]);
  assert.deepEqual(richOf([em.b(em.danger('x')), em.danger(em.b('y'))], {field: 'f', bold: false}).spans, [{text: 'xy', bold: true, tone: 'danger'}]); // both nestings are "bold + colour"
});

test('richOf: an empty input is the empty text with no spans', () => {
  assert.deepEqual(richOf([], {field: 'f', bold: false}), {text: '', spans: undefined});
  assert.deepEqual(richOf(['', ''], {field: 'f', bold: false}), {text: '', spans: undefined});
  assert.deepEqual(richOf([em.b('')], {field: 'f', bold: false}), {text: '', spans: undefined});
});

test('richOf refuses what would show nothing or be ambiguous', () => {
  assert.throws(() => richOf([em.danger(em.muted('x'))], {field: 'f', bold: false}), /em\.muted\(\) inside em\.danger\(\)/);
  assert.throws(() => richOf([em.danger(em.danger('x'))], {field: 'f', bold: false}), /inside em\.danger\(\)/);
  assert.throws(() => richOf(['a', em.b('x')], {field: 'f', bold: true}), /em\.b\(\) has no effect here/);
  assert.throws(() => richOf([em.danger('x')], {field: 'f', bold: false, tone: 'danger'}), /colour this text already has/);
  assert.throws(() => richOf([em.text('x')], {field: 'f', bold: false}), /already has/); // an unset tone is 'text'
  assert.throws(() => richOf([em.text('x')], {field: 'f', bold: false, tone: 'text'}), /already has/);
  assert.doesNotThrow(() => richOf([em.text('x'), em.danger('y')], {field: 'f', bold: false, tone: 'muted'}));
  assert.throws(() => richOf(em.b('x') as never, {field: 'f', bold: false}), /wrap a single em/);
  assert.throws(() => richOf([{text: 'x'} as never], {field: 'f', bold: false}), /string or an em/);
  assert.throws(() => em.b(['a', 'b'] as never), /separate items/);
});

// ---- the DSL functions: plain text in the band, spans beside it ----

test('box(): the band holds plain text and spans, never an array; the copied options are overwritten', () => {
  const b = box({title: ['Claude in ', em.accent('Chrome')], body: ['a ', em.b('b')], note: ['n ', em.danger('!')], lines: ['x', {text: ['l ', em.b('m')], tone: 'muted'}], id: 'k'});
  assert.equal(b.title, 'Claude in Chrome');
  assert.equal(b.body, 'a b');
  assert.equal(b.note, 'n !');
  assert.deepEqual(b.lines, ['x', {text: 'l m', tone: 'muted', spans: [{text: 'l '}, {text: 'm', bold: true}]}]);
  assert.deepEqual(b.spans, {title: [{text: 'Claude in '}, {text: 'Chrome', tone: 'accent'}], body: [{text: 'a '}, {text: 'b', bold: true}], note: [{text: 'n '}, {text: '!', tone: 'danger'}]});
  for (const k of ['title', 'body', 'note'] as const) assert.equal(typeof b[k], 'string');
  assert.ok(b.lines!.every(l => typeof (typeof l === 'string' ? l : l.text) === 'string'));
  assert.equal(b.id, 'k');
});

test('a box written with strings only is the band it always was (no spans key, same line objects)', () => {
  const line = {text: 'y', bold: true};
  assert.deepEqual(box({title: 'T', body: 'b', lines: ['x', line], note: 'n'}), {type: 'box', title: 'T', body: 'b', lines: ['x', line], note: 'n'});
  assert.deepEqual(caption('c'), {type: 'caption', text: 'c', align: 'center', role: 'label', tone: 'muted', bold: false, mono: false});
  assert.ok(!('spans' in group([box({title: 'a'})], {title: 'g'})));
  assert.ok(!('spans' in banner({headline: 'h', sub: 's'})));
  // an array with no em part is also plain
  const arr = box({title: ['API', 's'], body: ['x', 'y']});
  assert.equal(arr.title, 'APIs');
  assert.ok(!('spans' in arr));
});

test('title: [] (and body: [], [""]) is the same as leaving the field out', async () => {
  assert.equal(box({title: [], body: ['']}).title, undefined);
  assert.equal(box({title: [], body: ['']}).body, undefined);
  assert.throws(() => box({step: 1, title: []}), /needs a title/);
  const empty = await render(diagram({theme: 'blue'}).add(box({title: [], body: 'b'})));
  const absent = await render(diagram({theme: 'blue'}).add(box({body: 'b'})));
  assert.equal(empty.svg.replace(/"sourceSha256":"[0-9a-f]+"/, ''), absent.svg.replace(/"sourceSha256":"[0-9a-f]+"/, ''));
});

test('the boxes that use rich text: banner, caption, group, stat, swimlane step, step badge', () => {
  const ban = banner({headline: ['a ', em.accent('b')], sub: ['c ', em.b('d')]});
  assert.deepEqual([ban.headline, ban.sub, ban.spans], ['a b', 'c d', {headline: [{text: 'a '}, {text: 'b', tone: 'accent'}], sub: [{text: 'c '}, {text: 'd', bold: true}]}]);
  const cap = caption(['x ', em.b('y')]);
  assert.deepEqual([cap.text, cap.spans], ['x y', {text: [{text: 'x '}, {text: 'y', bold: true}]}]);
  const grp = group([box({title: 'a'})], {title: ['g ', em.danger('!')]});
  assert.deepEqual([grp.title, grp.spans], ['g !', {title: [{text: 'g '}, {text: '!', tone: 'danger'}]}]);
  const st = stat('76%', ['導入', em.b('前')]);
  assert.deepEqual(st.lines![1], {text: '導入前', tone: 'muted', spans: [{text: '導入'}, {text: '前', bold: true}]});
  const [sw] = swimlane([{id: 'a', label: 'A'}], [{lane: 'a', title: ['t ', em.accent('u')], body: ['b ', em.b('c')]}]) as unknown as [{steps: BoxBand[]}];
  assert.equal(sw.steps[0].title, 't u');
  assert.deepEqual(sw.steps[0].spans, {title: [{text: 't '}, {text: 'u', tone: 'accent'}], body: [{text: 'b '}, {text: 'c', bold: true}]});
  assert.equal(box({step: 1, title: ['a ', em.accent('b')]}).title, 'a b');
});

test('a bold run takes no em.b(), and a part in the run\'s own colour is an error', () => {
  const tpl = 'em\\.b\\(\\) has no effect here';
  assert.throws(() => box({title: ['a', em.b('b')]}), new RegExp(tpl));
  assert.throws(() => banner({headline: ['a', em.b('b')]}), new RegExp(tpl));
  assert.throws(() => group([box({title: 'a'})], {title: ['a', em.b('b')]}), new RegExp(tpl));
  assert.throws(() => caption(['a', em.b('b')], {bold: true}), new RegExp(tpl));
  assert.throws(() => box({lines: [{text: ['a', em.b('b')], bold: true}]}), new RegExp(tpl));
  assert.doesNotThrow(() => caption(['a', em.b('b')]));
  assert.throws(() => box({body: ['a', em.danger('b')], bodyTone: 'danger'}), /already has/);
  assert.throws(() => box({note: ['a', em.muted('b')]}), /already has/); // a note is muted unless noteTone says otherwise
  assert.doesNotThrow(() => box({note: ['a', em.danger('b')]}));
  assert.throws(() => group([box({title: 'a'})], {title: ['a', em.accent('b')], tone: 'accent'}), /already has/); // an accent group titles in accent
});

test('a part (or an array) is not a line: lines take strings and {text} only', () => {
  assert.throws(() => box({lines: [em.b('x') as never]}), /not a line/);
  assert.throws(() => box({lines: [['a', em.b('b')] as never]}), /not a line/);
});

test('hand-made spans that do not add up to the text are refused where layout reads them', async () => {
  const d = diagram({theme: 'blue'}).add({type: 'box', body: 'abc', spans: {body: [{text: 'ab'}, {text: 'x', bold: true}]}} as BoxBand);
  await assert.rejects(checkDiagram(d), /spans do not add up/);
  const nowrap = diagram({theme: 'blue'}).add({...stat('1', 'x'), lines: [{text: '1', spans: [{text: '1', bold: true}]}, 'x']});
  await assert.rejects(checkDiagram(nowrap), /cannot have spans/);
});

// ---- the text outside the figure: <title>, <desc>, budget, labels ----

test('the SVG <title> / <desc>, the budget and verify labels read plain text', async () => {
  const d = diagram({theme: 'blue'}).add(
    caption(['Claude in ', em.b('Chrome')]),
    box({title: ['ブラウザ ', em.danger('操作')], body: ['許可は ', em.b('ユーザー'), ' が決める']}),
  );
  assert.equal(diagramTitle(d), 'Claude in Chrome');
  assert.equal(diagramDesc(d), '要素: ブラウザ 操作');
  const r = await render(d);
  assert.match(r.svg, /<title id="svg-title">Claude in Chrome<\/title>/);
  assert.match(r.svg, /<desc id="svg-desc">要素: ブラウザ 操作<\/desc>/);
  assert.doesNotMatch(r.svg.slice(0, r.svg.indexOf('<style>')), /\*\*|\[\[|em\./);
  const plain = diagram({theme: 'blue'}).add(caption('Claude in Chrome'), box({title: 'ブラウザ 操作', body: '許可は ユーザー が決める'}));
  assert.deepEqual(measureBudget((await checkDiagram(d)).laidOut), measureBudget((await checkDiagram(plain)).laidOut));
  assert.deepEqual(r.verdict.problems, []);
});

// ---- measuring: one atom function for registering and for looking up ----

test('styledAtoms cuts the plain text as splitAtoms does, and cuts a word at a span boundary into glued pieces', () => {
  const run = {text: 'APIs を呼ぶ', size: 14, weight: 400 as const, mono: false, spans: [{text: 'API', bold: true}, {text: 's を呼ぶ'}]};
  assert.deepEqual(styledAtoms(run).map(a => [a.text, a.weight, !!a.glue]), [['API', 700, false], ['s', 400, true], [' ', 400, false], ['を', 400, false], ['呼', 400, false], ['ぶ', 400, false]]);
  assert.deepEqual(styledAtoms({...run, spans: undefined}).map(a => a.text), splitAtoms(run.text));
  const three = {...run, text: 'abcd', spans: [{text: 'a'}, {text: 'bc', bold: true}, {text: 'd', tone: 'danger' as const}]};
  assert.deepEqual(styledAtoms(three).map(a => [a.text, !!a.glue]), [['a', false], ['bc', true], ['d', true]]);
});

test('a word that a span cuts in two is never broken between lines', async () => {
  // widen the box until "APIs" would not fit after the text before it: it must move whole to the next line
  for (const width of [200, 210, 220, 230, 240, 250, 260, 270, 280]) {
    const d = diagram({theme: 'blue', width}).add(box({body: ['あいうえおかきくけこ ', em.b('API'), 's を呼ぶ']}));
    const {laidOut} = await checkDiagram(d);
    const lines = boxesOf(laidOut)[0].wrappedRuns[0].lines;
    assert.ok(!lines.some(l => /API$/.test(l)) || !lines.some(l => /^s/.test(l)), `width ${width}: ${JSON.stringify(lines)}`);
  }
});

test('leading spaces dropped, a bracket moved to the next line and \\n do not shift the spans', async () => {
  const text = ['一二三四五六七八九十（', em.b('括弧'), '）と', em.danger('赤'), '\n', '  次の行 ', em.b('太字')];
  const {laidOut} = await checkDiagram(diagram({theme: 'blue', width: 220}).add(box({body: text})));
  const run = boxesOf(laidOut)[0].wrappedRuns[0] as WrappedRun;
  assert.ok(run.lines.length >= 3);
  assert.deepEqual(run.lineSpans!.map(sp => sp.map(x => x.text).join('')), run.lines); // every line's pieces are exactly that line
  const first = run.lineSpans!.flat();
  assert.ok(first.some(sp => sp.bold && sp.text === '括弧'));
  assert.ok(run.lines.every(l => !/^\s/.test(l) && !/\s$/.test(l)));
  assert.ok(run.lines.every(l => !l.endsWith('（')));
  assert.ok(run.lineSpans!.flat().every(sp => sp.text.length > 0));
  assert.ok(run.lineSpans!.at(-1)!.some(sp => sp.bold && sp.text === '太字'));
  assert.ok(run.lineSpans!.flat().some(sp => sp.tone === 'danger' && sp.text === '赤'));
});

// ---- the drawing ----

test('a line with spans is one <text> of tspans with nothing between them; a plain line is as before', async () => {
  const r = await render(diagram({theme: 'blue'}).add(box({body: ['許可は ', em.danger(em.b('ユーザー')), ' が決める'], note: '平文'})));
  assert.match(r.svg, /<text [^>]*font-weight="400" fill="#22201b">許可は <tspan font-weight="700" fill="#b91c1c">ユーザー<\/tspan> が決める<\/text>/);
  assert.match(r.svg, /<text [^>]*>平文<\/text>/);
  assert.doesNotMatch(r.svg, /xml:space/);
  assert.doesNotMatch(r.svg, /<\/tspan>\s+<tspan/);
});

test('an emoji inside a coloured piece nests in its tspan; one outside stays a direct emoji span', async () => {
  const r = await render(diagram({theme: 'blue'}).add(box({body: [em.danger(em.b('😀 注意')), ' 😀'], note: ''})));
  assert.match(r.svg, /<tspan font-weight="700" fill="#b91c1c"><tspan class="emoji">😀<\/tspan> 注意<\/tspan><tspan class="emoji">😀<\/tspan>|<tspan font-weight="700" fill="#b91c1c"><tspan class="emoji">😀<\/tspan> 注意<\/tspan> <tspan class="emoji">😀<\/tspan>/);
});

test('a dimmed box keeps its bold and loses its colours', async () => {
  const d = diagram({theme: 'blue', spotlight: 'a'}).add(
    box({id: 'a', title: 'A'}),
    box({id: 'b', body: ['x ', em.danger(em.b('red')), ' ', em.accent('blue')]}),
  );
  const r = await render(d);
  assert.match(r.svg, /x <tspan font-weight="700">red<\/tspan> blue<\/text>/);
  assert.doesNotMatch(r.svg, /fill="#b91c1c"|fill="#1d5fa8">blue/);
});

test('the tspan widths are the layout widths (left / centre / right, spaces at the joins, a split word; emoji widths depend on the installed emoji font, so they are not compared here)', {skip}, async () => {
  const texts = [
    ['許可は ', em.danger(em.b('ユーザー')), ' が決める。', em.b('API'), 's を呼ぶ'],
    [em.b('先頭'), ' と ', em.accent('色'), ' の', em.b(' 間 '), '末尾 ', em.b('end')],
    ['abc', em.b('def'), 'ghi ', em.muted('jkl'), em.b('mno'), 'pqr'],
  ];
  for (const align of ['left', 'center', 'right'] as const) {
    const d = diagram({theme: 'blue'}).add(...texts.map(body => box({body, align})), row([box({body: texts[0], align}), box({body: texts[1], align})]));
    const {laidOut} = await checkDiagram(d);
    const svg = (await render(d)).svg;
    const root = parseXml(svg), styles = computeStyles(root);
    const drawn = elements(root).filter(e => e.tag === 'text');
    const runs = boxesOf(laidOut).flatMap(b => b.wrappedRuns);
    const lines = runs.flatMap(r => r.lines.map((l, i) => ({run: r, i})));
    assert.equal(drawn.length, lines.length);
    const atoms = new Map<string, {text: string; size: number; weight: number; font: 'sans' | 'mono'}>();
    for (const {run, i} of lines) for (const sp of run.lineSpans?.[i] ?? []) for (const a of splitAtoms(sp.text)) atoms.set(`${a} ${run.size} ${sp.bold ? 700 : run.weight}`, {text: a, size: run.size, weight: sp.bold ? 700 : run.weight, font: 'sans'});
    const m = await measureAll(new Map([...atoms].map(([k, v]) => [k, v])));
    const widthOf: WidthOf = (a, size, weight) => m.get(`${a} ${size} ${weight}`)!.w;
    let checked = 0;
    lines.forEach(({run, i}, k) => {
      if (!run.lineSpans) return;
      const layoutW = run.lineSpans[i].reduce((w, sp) => w + splitAtoms(sp.text).reduce((s, a) => s + widthOf(a, run.size, sp.bold ? 700 : run.weight, 'sans'), 0), 0);
      const box = textBoxOf(drawn[k], styles)!;
      assert.ok(Math.abs(box.w - layoutW) <= 0.5, `${align} line "${run.lines[i]}": drawn ${box.w} vs layout ${layoutW}`);
      checked++;
    });
    assert.ok(checked >= 4);
  }
});

// ---- checks that see the pieces ----

// box() refuses a colour on solid-danger (the text would vanish), so the unreadable box is made by hand: the verify / lint safety net for add()ed bands
const solid = (body: BoxBand['body'] | (string | ReturnType<typeof em.b>)[]): BoxBand => ({...box({body: body as never}), tone: 'solid-danger'});

test('verify and the SVG lint both fail a coloured word that is unreadable on its box', async () => {
  for (const [part, word] of [[em.danger('ユーザー'), 'ユーザー'], [em.muted('補助'), '補助']] as const) {
    const d = diagram({theme: 'blue'}).add(solid(['許可は ', part, ' が決める']));
    const r = await render(d);
    assert.ok(r.verdict.problems.some(p => p.includes(`"${word}"`)), `verify: ${r.verdict.problems.join(' | ')}`);
    const lint = geometryChecks(r.svg)!;
    assert.ok(lint.contrast.some(c => c.txt === word), `svg-lint: ${JSON.stringify(lint.contrast)}`);
  }
  // and a readable colour on a readable box is not reported
  const ok = await render(diagram({theme: 'blue'}).add(box({body: ['許可は ', em.danger('ユーザー'), ' が決める']})));
  assert.deepEqual(ok.verdict.problems, []);
  assert.deepEqual(geometryChecks(ok.svg)!.contrast, []);
});

test('svg-lint judges a tspan by its own fill, and a text drawn in one colour as before', () => {
  const wrap = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="#ffffff"/>${inner}</svg>`;
  const pale = geometryChecks(wrap('<text x="10" y="40" font-size="14" fill="#222222">ok <tspan fill="#f0f0f0">pale</tspan></text>'))!;
  assert.deepEqual(pale.contrast.map(c => c.txt), ['pale']);
  const all = geometryChecks(wrap('<text x="10" y="40" font-size="14" fill="#f0f0f0">all pale <tspan class="emoji">x</tspan></text>'))!;
  assert.deepEqual(all.contrast.map(c => c.txt), ['all pale x']);
  const inner = geometryChecks(wrap('<text x="10" y="40" font-size="14" fill="#f0f0f0"><tspan fill="#222222">dark</tspan></text>'))!;
  assert.deepEqual(inner.contrast, []); // all the text is in the tspan: the parent's fill is not judged
});

test('a colour-only emphasis is a warning in a doc diagram, not when bold goes with it, nor for muted, nor on a slide', async () => {
  const warn = async (body: Parameters<typeof box>[0]['body'], opts: Parameters<typeof diagram>[0] = {theme: 'blue'}) => (await render(diagram(opts).add(box({body})))).verdict.warnings.filter(w => w.includes('a11y-color-only-emphasis'));
  assert.equal((await warn(['x ', em.danger('赤')])).length, 1);
  assert.equal((await warn(['x ', em.accent('青')])).length, 1);
  assert.deepEqual(await warn(['x ', em.danger(em.b('赤'))]), []);
  assert.deepEqual(await warn(['x ', em.b('太'), ' ', em.muted('弱')]), []);
  assert.deepEqual(await warn(['x ', em.danger('赤')], {day: 1}), []);
});

test('the coloured piece\'s own contrast also counts for the WCAG 4.5:1 rule', async () => {
  const r = await render(diagram({theme: 'blue'}).add(solid(['x ', em.muted('補助'), ' y'])));
  assert.ok(r.verdict.findings.some(f => f.rule === 'a11y-text-contrast' && f.message.includes('補助')), JSON.stringify(r.verdict.findings));
});

// ---- nothing changes for a figure that does not use it ----

test('the checked-in SVGs and examples draw clean under the tspan-aware lint', () => {
  for (const dir of ['svg', 'examples/out']) for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.svg'))) {
    const r = geometryChecks(fs.readFileSync(`${dir}/${f}`, 'utf8'))!;
    // Only the colour check is compared: it does not depend on the installed fonts. The width-based checks (text out of its box, text over text)
    // re-measure the checked-in SVGs with whatever font this machine has, so they differ between a developer's machine and CI.
    assert.deepEqual(r.contrast, [], `${dir}/${f}`);
  }
});

test('a figure that uses no em part draws the same bytes whether its text is a string or an array of strings', async () => {
  const strip = (svg: string) => svg.replace(/"sourceSha256":"[0-9a-f]+"/, '');
  const a = await render(diagram({theme: 'blue'}).add(caption('lib/**/*.ts', {mono: true}), box({title: 'T', body: 'API と {frame: false}', lines: ['a', {text: '**b**'}]})));
  const b = await render(diagram({theme: 'blue'}).add(caption(['lib/**', '/*.ts'], {mono: true}), box({title: ['T'], body: ['API と ', '{frame: false}'], lines: ['a', {text: ['**b', '**']}]})));
  assert.equal(strip(a.svg), strip(b.svg));
  assert.match(a.svg, /lib\/\*\*\/\*\.ts/);
});

test('a group title keeps its pieces (the caption made from the group carries them) and its ink box is as wide as the drawn line', {skip}, async () => {
  const d = diagram({theme: 'blue'}).add(group([box({title: 'a'})], {title: ['記録と ', em.danger('責任'), ' Chrome']}));
  const {laidOut} = await checkDiagram(d);
  const cap = laidOut.laidOut.find(b => b.type === 'caption');
  assert.ok(cap && cap.type === 'caption' && cap.inkBox);
  assert.deepEqual(cap.wrappedRuns[0].lineSpans, [[{text: '記録と '}, {text: '責任', tone: 'danger'}, {text: ' Chrome'}]]);
  const svg = (await render(d)).svg;
  assert.match(svg, /記録と <tspan fill="#b91c1c">責任<\/tspan> Chrome<\/text>/);
  const root = parseXml(svg);
  const drawn = textBoxOf(elements(root).find(e => e.tag === 'text')!, computeStyles(root))!;
  assert.ok(Math.abs(drawn.w - cap.inkBox.w) <= 0.5, `${drawn.w} vs ${cap.inkBox.w}`);
});
