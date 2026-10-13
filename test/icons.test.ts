import test from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {bpmn, box, cell, checkDiagram, closeMeasurer, connect, diagram, icon, iconRow, node, renderDiagram, row, sankey, sequence, stateDiagram, swimlane, table} from '../lib/dsl.ts';
import {EMOJIS} from '../lib/icons.ts';
import type {EmojiName, IconName} from '../lib/icons.ts';
import {parseManifest} from '../lib/icon-store.ts';
import {ALLOWED_COLORS, EMOJI_RE} from '../lib/tokens.ts';
import {fontCoverage, measureWithFonts} from '../lib/font-metrics.ts';
import {xmlProblems} from '../lib/xml-check.ts';

test.after(() => closeMeasurer());

const emojiNames = Object.keys(EMOJIS) as EmojiName[];
const emojiFont = fontCoverage('emoji');
const ROOT_MANIFEST = fs.readFileSync(new URL('../svg-diagram.icons.json', import.meta.url), 'utf8');

test('this repo\'s own svg-diagram.icons.json (what the examples and tests draw) is a valid manifest that records each icon\'s source and licence', () => {
  const m = parseManifest(ROOT_MANIFEST, 'svg-diagram.icons.json');
  const names = Object.keys(m.icons);
  assert.ok(names.length >= 20);
  for (const n of ['person', 'people', 'document', 'folder', 'key', 'lock', 'bridge', 'fence', 'stairs', 'warning', 'check', 'close', 'idea', 'search', 'gear', 'cloud', 'database', 'mail', 'shield', 'flag', 'clock']) assert.ok(icon.has(n).path, n);
  for (const n of names) {
    const {d, body, from, license} = m.icons[n];
    assert.ok((d ?? body)!.length > 20 && from.includes(':') && license, n);
    assert.deepEqual(xmlProblems(`<svg xmlns="http://www.w3.org/2000/svg">${d !== undefined ? `<path d="${d}"/>` : body}</svg>`), [], n);
  }
});

test('svg-diagram ships no icons: with none installed, box({icon}) throws and says how to install one', () => {
  icon.use({version: 1, icons: {}});
  try {
    assert.throws(() => box({icon: 'key', title: 'x'}), /icon "key" is not installed.*svg-diagram icons add mdi:<icon>=key/);
    assert.deepEqual(icon.pathNames, []);
    assert.deepEqual(icon.has('key'), {path: false, emoji: true});
  } finally { icon.use(undefined); }
  assert.ok(icon.has('key').path, 'back to the file');
});

test('icon.use() draws a project\'s own glyph; evenodd is kept', async () => {
  icon.use({version: 1, icons: {dot: {d: 'M2 2h20v20H2zM8 8v8h8V8z', vb: [0, 0, 24], rule: 'evenodd', from: 'file:dot.svg', license: 'local'}}});
  try {
    const {svg} = await renderDiagram(diagram({theme: 'blue'}).add(box({icon: 'dot', title: '点'})), {name: 'dot.svg', budget: 'cacheOnly'});
    assert.match(svg, /<path d="M2 2h20v20H2zM8 8v8h8V8z" transform="[^"]+" fill="#[0-9a-f]{6}" fill-rule="evenodd" aria-hidden="true" data-icon="dot"\/>/);
  } finally { icon.use(undefined); }
});

test('every emoji is one code point inside EMOJI_RE (so emit gives it class="emoji")', () => {
  for (const n of emojiNames) {
    assert.equal([...icon.emoji(n)].length, 1, n);
    assert.ok(EMOJI_RE.test(icon.emoji(n)), `${n} ${icon.emoji(n)} is outside EMOJI_RE`);
  }
});

test('every emoji has a glyph in the emoji font and measures as an emoji, not the 1em fallback', {skip: emojiFont ? false : 'no emoji font file found'}, () => {
  for (const n of emojiNames) assert.ok(emojiFont!.has(icon.emoji(n).codePointAt(0)!), `${n} is missing from the emoji font`);
  const m = measureWithFonts(new Map(emojiNames.map(n => [n, {text: icon.emoji(n), size: 100}])));
  for (const n of emojiNames) assert.notEqual(m.get(n)!.w, 100, `${n} measured as the 1em fallback`);
});

test('icon.has says which set has a name; unknown names throw', () => {
  assert.deepEqual(icon.has('key'), {path: true, emoji: true});
  assert.deepEqual(icon.has('stairs'), {path: true, emoji: false});
  assert.deepEqual(icon.has('ladder'), {path: false, emoji: true});
  assert.deepEqual(icon.has('toString'), {path: false, emoji: false});
  assert.throws(() => icon.emoji('nope' as EmojiName), /unknown emoji icon "nope"/);
  assert.throws(() => icon.emoji('toString' as EmojiName), /unknown emoji icon/);
  assert.throws(() => box({icon: 'nope' as IconName, title: 'x'}), /icon "nope" is not installed/);
  assert.throws(() => iconRow([{icon: 'nope' as IconName, label: 'x'}]), /not installed/);
  assert.throws(() => iconRow([]), /at least one/);
});

test('an emoji inside a title is drawn with class="emoji" and passes the check', async () => {
  const d = diagram({theme: 'blue'}).add(row([box({title: `${icon.emoji('key')} 鍵の管理`, body: '発行と失効'}), box({title: `${icon.emoji('bridge')}${icon.emoji('fence')} 橋と柵`})]));
  const {svg, verdict} = await renderDiagram(d, {name: 'icons.svg', budget: 'cacheOnly'});
  assert.deepEqual(verdict.problems, []);
  assert.match(svg, /<tspan class="emoji">🔑<\/tspan> 鍵の管理/);
});

test('box({icon}) indents every run, makes room for the icon, and a box without one is unchanged', async () => {
  const plain = (await checkDiagram(diagram({theme: 'blue'}).add(box({id: 'a', title: 'T'})))).laidOut.laidOut[0] as {h: number; wrappedRuns: object[]};
  assert.ok(plain.wrappedRuns.every(r => !('indent' in r) || (r as {indent: number}).indent === 0));
  const {laidOut} = await checkDiagram(diagram({theme: 'blue'}).add(box({icon: 'key', title: 'T', body: 'B', note: 'N'})));
  const b = laidOut.laidOut[0] as {wrappedRuns: {indent?: number}[]};
  assert.ok(b.wrappedRuns.every(r => r.indent! >= 32), 'every run is pushed right of the icon');
  const one = (await checkDiagram(diagram({theme: 'blue'}).add(box({icon: 'key', title: 'T'})))).laidOut.laidOut[0] as {h: number};
  assert.ok(one.h >= 32 + 32, 'the icon sets a minimum height');
});

test('box({icon}) draws a path in a token colour, muted when dimmed, and iconRow() puts them side by side', async () => {
  const d = diagram({theme: 'blue', spotlight: 'on'}).add(
    row([box({id: 'on', icon: 'lock', iconTone: 'accent', title: '鍵', body: '本文'}), box({id: 'off', icon: 'person', title: '人', body: '本文'})]),
    iconRow([{icon: 'bridge', label: '橋'}, {icon: 'fence', label: '柵', iconTone: 'danger'}, {icon: 'stairs', label: '階段'}]),
  );
  const {svg, verdict} = await renderDiagram(d, {name: 'icons.svg', budget: 'cacheOnly'});
  assert.deepEqual(verdict.problems, []);
  const paths = [...svg.matchAll(/<path d="[^"]+" transform="translate\(([\d. -]+)\) scale\(([\d.]+)\)" fill="(#[0-9a-f]{6})" aria-hidden="true" data-icon="(\w+)"\/>/g)];
  assert.deepEqual(paths.map(m => m[4]), ['lock', 'person', 'bridge', 'fence', 'stairs']);
  for (const m of paths) assert.ok(ALLOWED_COLORS.has(m[3]), `${m[4]} fill ${m[3]} is a token`);
  assert.notEqual(paths[0][3], paths[1][3], 'the focused box keeps its tone, the dimmed one is muted');
});

test('line, duotone and colour icons draw as one <g> around the set\'s shapes: currentColor is the tone, fixed colours stay, a dimmed fixed icon fades', async () => {
  icon.use({version: 1, icons: {
    line: {vb: [0, 0, 24], body: '<g fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="8" r="5"/><path d="M12 12l8 8"/></g>', from: 'lucide:x', license: 'ISC'},
    duo: {vb: [0, 0, 24], body: '<path fill="currentColor" d="M1 1h10v10z" opacity=".3"/><path fill="currentColor" d="M2 2h4v4z"/>', from: 'ph:x', license: 'MIT'},
    logo: {vb: [0, 0, 24], body: '<circle cx="12" cy="12" r="9" fill="#e53935"/>', fixed: true, from: 'file:l.svg', license: 'local'},
  }});
  try {
    const d = diagram({theme: 'blue', spotlight: 'on'}).add(row([
      box({id: 'on', icon: 'line', iconTone: 'danger', title: '線', body: '本文'}),
      box({icon: 'duo', title: '二色', body: '本文'}),
      box({icon: 'logo', title: 'ロゴ', body: '本文'}),
    ]));
    const {svg, verdict} = await renderDiagram(d, {name: 'lines.svg', budget: 'cacheOnly'});
    assert.deepEqual(verdict.problems, []);
    const g = (n: string) => new RegExp(`<g transform="[^"]+" fill="(#[0-9a-f]{6})"([^>]*?) aria-hidden="true" data-icon="${n}">(.*?)</g>`).exec(svg)!;
    assert.ok(ALLOWED_COLORS.has(g('line')[1]));
    assert.ok(g('line')[3].includes(`stroke="${g('line')[1]}"`) && !g('line')[3].includes('currentColor'), 'currentColor became the tone colour');
    assert.ok(g('duo')[3].includes('opacity=".3"') && g('duo')[3].includes(`fill="${g('duo')[1]}"`));
    assert.ok(g('logo')[3].includes('fill="#e53935"'), 'the logo keeps its own colour');
    assert.match(g('logo')[2], /data-icon-fixed="true" opacity="0\.35"/, 'dimmed by spotlight: faded, not recoloured');
    assert.ok(!svg.includes('group-transform'));
  } finally { icon.use(undefined); }
});

test('node(): the icon is centred above its label with no box around it; connect() meets the icon (bottom: under the label); ids inside a colour icon are unique per use', async () => {
  const body = '<defs><linearGradient id="g"><stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff"/></linearGradient></defs><rect width="24" height="24" fill="url(#g)"/>';
  icon.use({version: 1, icons: {grad: {vb: [0, 0, 24], body, fixed: true, from: 'pack:x/g.svg', license: 'vendor:x'}, line: {vb: [0, 0, 24], body: '<g fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/></g>', from: 'lucide:x', license: 'ISC'}}});
  try {
    const d = diagram({theme: 'blue'}).add(
      row([node({id: 'a', icon: 'grad', label: 'A', sub: 'a-sub'}), node({id: 'b', icon: 'grad', label: 'B', size: 64})], {gap: 80}),
      row([node({id: 'c', icon: 'line', label: 'C', frame: true})], {cols: 12}),
      connect('a:right', 'b:left'),
      connect('a:bottom', 'c:top', {route: 'elbow', bend: 0.9}),
    );
    const {laidOut, verdict} = await checkDiagram(d);
    assert.deepEqual(verdict.problems, []);
    const find = (id: string) => (JSON.parse(JSON.stringify(laidOut.laidOut[0])) as {children: {id: string; x: number; y: number; w: number; h: number; wrappedRuns: {lineYs: number[]}[]}[]}).children.find(c => c.id === id)!;
    const a = find('a'), b = find('b');
    assert.ok(a.wrappedRuns[0].lineYs[0] >= 48 + 8, 'the label starts below the 48px icon and its gap');
    assert.ok(b.h > a.h - 20 && b.wrappedRuns[0].lineYs[0] >= 64 + 8, 'size: 64 pushes the label lower');
    const {svg} = await renderDiagram(d, {name: 'nodes.svg', budget: 'cacheOnly'});
    assert.equal((svg.match(/<rect x="[\d.]+" y="[\d.]+" width="[\d.]+" height="[\d.]+" rx="8"/g) ?? []).length, 1, 'only the node with frame: true has a box');
    const ids = [...svg.matchAll(/<linearGradient id="([^"]+)"/g)].map(m => m[1]);
    assert.equal(ids.length, 2);
    assert.notEqual(ids[0], ids[1], 'the same gradient drawn twice does not share an id');
    for (const id of ids) assert.ok(svg.includes(`fill="url(#${id})"`), id);
    assert.ok(a.x + a.w / 2 > 0);
    const dpath = [...svg.matchAll(/<path d="(M[^"]+)" fill="none" stroke="#22201b"/g)].map(m => m[1]);
    const first = dpath[0].split(' ');
    assert.ok(Number(first[0].slice(1).split(',')[0]) > a.x + a.w / 2 && Number(first[0].slice(1).split(',')[0]) < a.x + a.w / 2 + 40, 'right: starts at the icon\'s edge, not the box\'s');
  } finally { icon.use(undefined); }
  assert.throws(() => node({icon: 'key', label: 'x', size: 4}), /between 16 and 96/);
  assert.throws(() => box({iconAt: 'top', title: 'x'} as never), /needs an icon/);
  assert.throws(() => box({icon: 'key', iconAt: 'middle', title: 'x'} as never), /'left' or 'top'/);
});

// ---- icon coverage: swimlane steps, table cells, states, sankey nodes; step + icon; iconRow label position ----

const iconMarks = (svg: string): string[] => [...svg.matchAll(/data-icon="(\w+)"/g)].map(m => m[1]);

test('a swimlane step takes an icon (and step too); an unknown icon throws with the install hint', async () => {
  const lanes = [{id: 'a', label: '営業'}, {id: 'b', label: '経理'}];
  const d = diagram({theme: 'blue'}).add(swimlane(lanes, [
    {id: 's1', lane: 'a', title: '受注', icon: 'key', step: 1},
    {id: 's2', lane: 'b', title: '請求', icon: 'lock'},
  ], {flows: [{from: 's1', to: 's2'}]}));
  const {svg, verdict} = await renderDiagram(d, {name: 'swim-icon.svg', budget: 'cacheOnly'});
  assert.deepEqual(verdict.problems, []);
  assert.deepEqual(iconMarks(svg), ['key', 'lock']);
  assert.throws(() => swimlane(lanes, [{id: 's', lane: 'a', title: 'x', icon: 'nope' as IconName}]), /not installed/);
});

test('box({step, icon}) draws both: the badge to the right of the icon, the title clear of both', async () => {
  const d = diagram({theme: 'blue'}).add(box({id: 'b', icon: 'key', step: 2, title: '鍵の管理', body: '発行と失効'}));
  const r = await checkDiagram(d);
  assert.deepEqual(r.verdict.problems, []);
  const {svg} = await renderDiagram(d, {name: 'step-icon.svg', budget: 'cacheOnly'});
  assert.deepEqual(iconMarks(svg), ['key']);
  assert.match(svg, /aria-label="手順 2"/);
  const iconX = Number(/<path d="[^"]+" transform="translate\(([\d.-]+) /.exec(svg)![1]);
  const badgeX = Number(/<circle cx="([\d.]+)"/.exec(svg)![1]);
  const titleX = Number(/<text x="([\d.]+)"[^>]*font-weight="700"/.exec(svg)![1]);
  assert.ok(badgeX - 15 >= iconX + 32 - 1 && titleX >= badgeX + 15, `icon ${iconX}, badge ${badgeX}, title ${titleX}`);
});

test('a table cell takes an icon before its text, or alone', async () => {
  const d = diagram({theme: 'blue'}).add(table([{label: '項目'}, {label: '状態', align: 'center'}], [
    [cell('鍵', {icon: 'key'}), cell('', {icon: 'lock', iconTone: 'danger', align: 'center'})],
    [cell('人', {icon: 'person', tone: 'accent', bold: true}), '済'],
  ]));
  const {svg, verdict} = await renderDiagram(d, {name: 'table-icon.svg', budget: 'cacheOnly'});
  assert.deepEqual(verdict.problems, []);
  assert.deepEqual(iconMarks(svg), ['key', 'lock', 'person']);
  assert.match(svg, /role="img" aria-label="lock"/, 'an icon with no text carries its name');
  assert.throws(() => table([{label: 'a'}], [[cell('x', {icon: 'nope' as IconName})]]), /not installed/);
});

test('a state takes an icon above its label (box and circle)', async () => {
  const d = diagram({theme: 'blue'}).add(stateDiagram(
    [{id: 'a', label: '施錠', icon: 'lock'}, {id: 'b', label: '開錠', icon: 'key', tone: 'accent'}, {id: 'c', label: '見張り', icon: 'person', shape: 'circle'}],
    [{from: 'a', to: 'b', label: '鍵'}, {from: 'b', to: 'c'}], {initial: 'a'}));
  const {svg, verdict} = await renderDiagram(d, {name: 'state-icon.svg', budget: 'cacheOnly'});
  assert.deepEqual(verdict.problems, []);
  assert.deepEqual(iconMarks(svg), ['lock', 'key', 'person']);
});

test('a sankey node takes an icon before its label', async () => {
  const d = diagram({theme: 'blue'}).add(sankey([{id: '広告', icon: 'person'}, '訪問', {id: '購入', icon: 'key'}], [{from: '広告', to: '訪問', value: 60}, {from: '訪問', to: '購入', value: 15}], {unit: '千人'}));
  const {svg, verdict} = await renderDiagram(d, {name: 'sankey-icon.svg', budget: 'cacheOnly'});
  assert.deepEqual(verdict.problems, []);
  assert.deepEqual(iconMarks(svg), ['person', 'key']);
});

test('iconRow: the label is centred beside the icon, not hung from the top', async () => {
  const {laidOut} = await checkDiagram(diagram({theme: 'blue'}).add(iconRow([{icon: 'key', label: '鍵'}])));
  const b = (laidOut.laidOut[0] as unknown as {bands?: unknown[]}).bands ?? laidOut.laidOut;
  const box0 = JSON.stringify(b);
  const m = /"lineYs":\[([\d.]+)\]/.exec(box0)!;
  const base = Number(m[1]);
  const plain = await checkDiagram(diagram({theme: 'blue'}).add(box({title: '鍵'})));
  const base0 = Number(/"lineYs":\[([\d.]+)\]/.exec(JSON.stringify(plain.laidOut.laidOut))![1]);
  assert.ok(base > base0, `baseline ${base} is lower than a plain box's ${base0}: the label is centred on the 32px icon`);
});

test('step badge: uses the box padding (swimlane steps) and sits just before a centred title (iconAt top)', async () => {
  const lanes = [{id: 'a', label: '営業'}];
  const sw = await renderDiagram(diagram({theme: 'blue'}).add(swimlane(lanes, [{id: 's1', lane: 'a', title: '受注', icon: 'key', step: 1}])), {name: 'swim-step.svg', budget: 'cacheOnly'});
  const badge = /<circle cx="([\d.]+)" cy="([\d.]+)"/.exec(sw.svg)!, title = /<text x="([\d.]+)" y="([\d.]+)"[^>]*font-weight="700"[^>]*>受注/.exec(sw.svg)!;
  assert.ok(Math.abs(Number(title[1]) - (Number(badge[1]) + 15 + 10)) <= 4, `badge ${badge[1]} / title ${title[1]}: the title follows the badge`);
  assert.ok(Number(badge[2]) < Number(title[2]), 'the badge is centred on the title line, not below it');
  const top = await renderDiagram(diagram({theme: 'blue'}).add(box({icon: 'person', iconAt: 'top', step: 3, title: '利用者'})), {name: 'top-step.svg', budget: 'cacheOnly'});
  const cx = Number(/<circle cx="([\d.]+)"/.exec(top.svg)![1]), iconX = Number(/data-icon="person"/.test(top.svg) && /translate\(([\d.-]+) /.exec(top.svg)![1]);
  assert.ok(cx > iconX - 40, `badge ${cx} is beside the centred title, not at the box's left edge (icon at ${iconX})`);
});

test('a table icon beside centred / right-aligned text sits just before the text', async () => {
  const {svg} = await renderDiagram(diagram({theme: 'blue'}).add(table([{label: 'a', align: 'center'}, {label: 'b', align: 'right'}], [[cell('済', {icon: 'key'}), cell('1,000', {icon: 'lock'})]])), {name: 'table-align.svg', budget: 'cacheOnly'});
  const at = (n: string) => Number(new RegExp(`translate\\(([\\d.-]+) [^"]*"[^>]*data-icon="${n}"`).exec(svg)![1]);
  const tx = (s: string) => Number(new RegExp(`<text x="([\\d.]+)"[^>]*>${s}<`).exec(svg)![1]);
  assert.ok(tx('済') - at('key') < 50, `centred: icon ${at('key')} near text ${tx('済')}`);
  assert.ok(tx('1,000') - at('lock') < 90, `right: icon ${at('lock')} near text end ${tx('1,000')}`);
});

// ---- icons on bpmn tasks and sequence participants ----
const bpmnWith = (opts: object = {}) => bpmn(
  [{id: 'a', label: '顧客'}, {id: 'b', label: '店舗'}],
  [{id: 's', lane: 'a', kind: 'start', label: '注文'}, {id: 't', lane: 'a', label: '支払う', icon: 'key', sub: 'カード'}, {id: 'u', lane: 'b', label: '確認する', icon: 'lock', iconTone: 'danger', tone: 'accent'}, {id: 'e', lane: 'b', kind: 'end', label: '完了'}],
  [{from: 's', to: 't'}, {from: 't', to: 'u', line: 'dashed'}, {from: 'u', to: 'e'}], opts);

test('a bpmn task takes an icon above its label; the task grows to hold it', async () => {
  const {svg, verdict} = await renderDiagram(diagram({theme: 'blue'}).add(bpmnWith()), {name: 'bpmn-icon.svg', budget: 'cacheOnly'});
  assert.deepEqual(verdict.problems, []);
  assert.deepEqual(iconMarks(svg), ['key', 'lock']);
  assert.match(svg, /aria-hidden="true" data-icon="key"/, 'a task has a label, so its icon is decoration');
  const h = async (icon?: 'key') => ((await checkDiagram(diagram({theme: 'blue'}).add(bpmn([{id: 'a', label: 'x'}], [{id: 't', lane: 'a', label: '支払う', ...(icon ? {icon} : {})}], [])))).laidOut.laidOut[0] as unknown as {nodes: {h: number}[]}).nodes[0].h;
  assert.equal(await h('key') - await h(), 24);
});

test("a bpmn task's icon takes the task's text tone unless iconTone says otherwise", async () => {
  const {svg} = await renderDiagram(diagram({theme: 'blue'}).add(bpmn([{id: 'a', label: 'x'}],
    [{id: 't', lane: 'a', label: '承認', icon: 'key', tone: 'accent'}, {id: 'u', lane: 'a', label: '照合', icon: 'lock', tone: 'danger', iconTone: 'muted'}], [{from: 't', to: 'u'}])), {name: 'bpmn-icon-tone.svg', budget: 'cacheOnly'});
  const fill = (name: string) => svg.match(new RegExp(`fill="(#\\w+)" aria-hidden="true" data-icon="${name}"`))![1];
  const textFill = (s: string) => svg.match(new RegExp(`fill="(#\\w+)">${s}`))![1];
  assert.equal(fill('key'), textFill('承認'));
  assert.notEqual(fill('lock'), textFill('照合'));
});

test("bpmn icons survive fit: 'shrink'", async () => {
  const {verdict} = await renderDiagram(diagram({theme: 'blue'}).add(bpmnWith({fit: 'shrink'})), {name: 'bpmn-icon-shrink.svg', budget: 'cacheOnly'});
  assert.deepEqual(verdict.problems, []);
});

test('a back flow runs under a tall task with an icon that stands between its ends, not through it', async () => {
  const d = diagram({theme: 'blue'}).add(bpmn(
    [{id: 'a', label: '申請者'}, {id: 'm', label: '上長'}],
    [{id: 'w', lane: 'a', label: '精算書を作成'}, {id: 'ap', lane: 'm', label: '内容を承認', sub: '金額と領収書を確かめる', icon: 'check'}, {id: 'g', lane: 'm', kind: 'xor', label: '承認'}, {id: 'e', lane: 'm', kind: 'end'}],
    [{from: 'w', to: 'ap'}, {from: 'ap', to: 'g'}, {from: 'g', to: 'e', label: '可'}, {from: 'g', to: 'w', label: '却下'}]));
  const {verdict} = await renderDiagram(d, {name: 'bpmn-icon-back.svg', budget: 'cacheOnly'});
  assert.deepEqual(verdict.problems, []);
});

test('bpmn icon errors: not installed, on an event', async () => {
  const lanes = [{id: 'a', label: 'x'}];
  assert.throws(() => bpmn(lanes, [{id: 't', lane: 'a', label: 'T', icon: 'nope' as IconName}], []), /not installed/);
  await assert.rejects(checkDiagram(diagram({theme: 'blue'}).add(bpmn(lanes, [{id: 't', lane: 'a', kind: 'start', label: 'T', icon: 'key'}], []))), /only a task takes an icon/);
});

test('a sequence participant takes an icon above its label; heads stay one height', async () => {
  const mk = () => diagram({theme: 'blue'}).add(sequence(
    [{id: 'u', label: '利用者', icon: 'person'}, {id: 's', label: 'サーバ', icon: 'database', iconTone: 'accent', tone: 'accent'}, {id: 'p', label: '外部'}],
    [{from: 'u', to: 's', label: '依頼'}, {from: 's', to: 'p', label: '照会'}, {self: 's', label: '検証'}]));
  const {svg, verdict} = await renderDiagram(mk(), {name: 'seq-icon.svg', budget: 'cacheOnly'});
  assert.deepEqual(verdict.problems, []);
  assert.deepEqual(iconMarks(svg), ['person', 'database']);
  const heads = ((await checkDiagram(mk())).laidOut.laidOut[0] as unknown as {heads: {h: number; textDy: number}[]}).heads;
  assert.equal(new Set(heads.map(x => x.h)).size, 1);
  assert.ok(heads[2].textDy > 12 && heads[2].textDy < heads[0].textDy, 'a head without an icon keeps its label in the middle');
  assert.throws(() => sequence([{id: 'a', label: 'A', icon: 'nope' as IconName}, {id: 'b', label: 'B'}], []), /not installed/);
  assert.throws(() => sequence([{id: 'a', label: 'A', iconTone: 'accent'}, {id: 'b', label: 'B'}], []), /iconTone but no icon/);
});
