// ADR 0074: comic() as a band in a diagram: layout, check (the verdict), lint advice, anchors for connect(), and nothing else changes.
import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {box, checkDiagram, closeMeasurer, comic, connect, diagram, renderDiagram} from '../lib/dsl.ts';
import {lintDiagram} from '../lib/rules.ts';
import type {ComicWorksheet, LaidOutComic} from '../lib/types/comic.ts';
import {ARTIST} from './helpers/comic-character.ts';
import {SAMPLE} from './helpers/comic-sample.ts';

test.after(() => closeMeasurer());

const figure = (...bands: unknown[]) => diagram({theme: 'blue', title: 'マンガ', width: 480, legend: false}).add(...bands as never[]);
const laid = async (d: ReturnType<typeof figure>) => {
  const r = await checkDiagram(d);
  return {r, c: r.laidOut.laidOut.find(b => b.type === 'comic') as LaidOutComic};
};
const tags = (problems: readonly string[]) => problems.map(p => /\[(comic-[a-z-]+)\]$/.exec(p)?.[1]);

test('the verdict reports only the missing asset and expression, and SVG renders their fallback faces', async () => {
  const sheet: ComicWorksheet = {
    version: 1, title: '素材', layout: '1x2',
    cast: {me: {name: '私', asset: 'unknown'}, col: {name: '同僚', asset: ARTIST.id}},
    panels: [
      {id: 'p1', stage: [{who: 'me', at: 'left', expression: 'neutral'}, {who: 'col', at: 'right', expression: 'angry'}], dialogue: []},
      {id: 'p2', stage: [{who: 'col', at: 'left', expression: 'neutral'}], dialogue: []},
    ],
  };
  const d = figure(comic(sheet, {characters: {[ARTIST.id]: ARTIST}}));
  const {r, c} = await laid(d);
  assert.deepEqual(tags(r.verdict.problems), ['comic-asset-missing', 'comic-asset-missing']);
  assert.deepEqual(c.findings.map(f => f.where), ['p1.me', 'p1.col']);
  const svg = (await renderDiagram(d, {name: 'missing-characters', budget: 'cacheOnly'})).svg;
  assert.match(svg, /data-head="p1\.me"><g data-face="neutral"/);
  assert.match(svg, /data-head="p1\.col"><g data-face="angry"/);
  assert.match(svg, /data-head="p2\.col"[^>]*><svg data-character="colleague-a"/);
});

test('scoped comics and hyphens in panel and cast ids keep all SVG ids distinct', async () => {
  const sheet: ComicWorksheet = {
    version: 1, title: '素材', layout: '1x2',
    cast: {b: {name: 'B', asset: ARTIST.id}, 'a-b': {name: 'A B', asset: ARTIST.id}},
    panels: [
      {id: 'p-a', stage: [{who: 'b', at: 'left', expression: 'neutral'}], dialogue: []},
      {id: 'p', stage: [{who: 'a-b', at: 'left', expression: 'neutral'}], dialogue: []},
    ],
  };
  const characters = {[ARTIST.id]: ARTIST};
  const d = figure(comic(sheet, {characters, scope: '上'}), comic(sheet, {characters, scope: '下'}));
  const {svg, xml} = await renderDiagram(d, {name: 'scoped-characters', budget: 'cacheOnly'});
  assert.deepEqual(xml, []);
  const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(ids.filter(id => id?.endsWith('-cloth')).length, 4);
  assert.equal(new Set(ids).size, ids.length);
  for (const ref of svg.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ids.includes(ref[1]), `${ref[1]} is defined`);
});

test('an asset keeps its own paint in a dark or auto diagram', async () => {
  const artist = {...ARTIST, expressions: {neutral: '<circle r="5" fill="#ffffff" stroke="#22201b"/>'}};
  const sheet: ComicWorksheet = {
    version: 1, title: '素材', layout: '1x2', cast: {col: {name: '同僚', asset: artist.id}},
    panels: [
      {id: 'p1', stage: [{who: 'col', at: 'left', expression: 'neutral'}], dialogue: []},
      {id: 'p2', stage: [], dialogue: []},
    ],
  };
  const comicOf = async (appearance: 'light' | 'dark' | 'auto') => {
    const d = diagram({theme: 'blue', title: '素材', width: 480, legend: false, appearance}).add(comic(sheet, {characters: {[artist.id]: artist}}));
    const {svg} = await renderDiagram(d, {name: 'character-paint', budget: 'cacheOnly'});
    const start = svg.indexOf('<svg data-character=');
    assert.ok(start >= 0);
    return svg.slice(start, svg.indexOf('</svg>', start));
  };
  const light = await comicOf('light');
  assert.equal(await comicOf('dark'), light);
  assert.equal(await comicOf('auto'), light);
});

test('the ADR sample is drawn at the default shape (6:5) with no problem and no finding', async () => {
  const {r, c} = await laid(figure(comic(SAMPLE)));
  assert.deepEqual(r.verdict.problems, []);
  assert.deepEqual(c.findings, []);
  assert.equal(c.aspect, '6:5');
  assert.equal(c.panels[0]!.h, 352);
});

test('the same sample at 7:5 fails the check on the root causes only: comic-bubble-zone and comic-text-budget (ADR 0074 U1, criterion 4)', async () => {
  const {r} = await laid(figure(comic(SAMPLE, {aspect: '7:5'})));
  assert.deepEqual(tags(r.verdict.problems), ['comic-bubble-zone', 'comic-text-budget']);
  assert.equal(r.verdict.ok, false);
});

test('Latin text in a template is measured at the comic\'s one size, and the strict-width helper confirms every atom was registered', async () => {
  const sheet = {...SAMPLE, panels: SAMPLE.panels.map((p, i) => i === 0 ? {...p, dialogue: [{id: 'd1', who: 'me', kind: 'say' as const, tpl: 'Slack で{day}に共有する。', slots: SAMPLE.panels[0]!.dialogue[0]!.slots!}]} : p)};
  const {r, c} = await laid(figure(comic(sheet)));
  assert.deepEqual(r.verdict.problems, []);
  assert.ok(c.bubbles[0]!.lines.join('').includes('Slack'));
});

test('lint: the line-break advice is a warn finding of the rule, located on the band', async () => {
  const sheet = {...SAMPLE, panels: [{...SAMPLE.panels[0]!, dialogue: [{id: 'd1', who: 'me', kind: 'say' as const, tpl: 'Internationalization-supportあ'}]}, {id: 'x', stage: [], dialogue: []}, {id: 'x', stage: [], dialogue: []}, {id: 'x', stage: [], dialogue: []}].map((p, i) => ({...p, id: `p${i + 1}`}))};
  const d = figure(comic(sheet));
  const {r} = await laid(d);
  const found = lintDiagram({...d, laidOut: r.laidOut.laidOut}).filter(f => f.rule.startsWith('comic-'));
  assert.deepEqual(found.map(f => [f.rule, f.severity]).sort(), [['comic-bubble-wide', 'warn'], ['comic-orphan-line', 'warn']]);
  assert.deepEqual(tags(r.verdict.problems), [], 'advice is not a problem');
});

test('a worksheet with mistakes fails the check, one tagged problem per mistake', async () => {
  const bad = {...SAMPLE, panels: [{...SAMPLE.panels[0]!, stage: [{who: 'me', at: 'left' as const, expression: 'neutral' as const}], dialogue: [{id: 'd1', who: 'col', kind: 'say' as const, tpl: 'こんにちは'}]}, ...SAMPLE.panels.slice(1, 4)]};
  const {r} = await laid(figure(comic(bad)));
  assert.deepEqual(tags(r.verdict.problems), ['comic-speaker-unknown']);
  assert.equal(r.verdict.ok, false);
});

test('panels and bubbles are anchors: connect() can end on them, and a scope qualifies the names', async () => {
  const d = figure(box({id: 'note', title: 'メモ'}), comic(SAMPLE, {scope: 'c'}), connect('note:bottom', 'c.p1:top'));
  const {r} = await laid(d);
  assert.deepEqual(r.verdict.problems, []);
  assert.equal(r.laidOut.connects.length, 1);
  await assert.rejects(() => checkDiagram(figure(comic(SAMPLE), comic(SAMPLE))), /another anchor already has/);
});

test('a comic changes nothing around it: the box next to it is drawn byte for byte as without it, and the width rule is not taken by other bands', async () => {
  const alone = await renderDiagram(figure(box({title: 'Slack で共有 API', body: 'Latin words: shared, rounded, measured'})), {name: 'a', budget: 'cacheOnly'});
  const beside = await renderDiagram(figure(box({title: 'Slack で共有 API', body: 'Latin words: shared, rounded, measured'}), comic(SAMPLE)), {name: 'b', budget: 'cacheOnly'});
  const texts = (svg: string) => [...svg.matchAll(/<text [^>]*x="([\d.]+)"[^>]*>([^<]*)<\/text>/g)].filter(m => /Slack|Latin/.test(m[2]!)).map(m => m[0]);
  assert.ok(texts(alone.svg).length > 0);
  assert.deepEqual(texts(beside.svg), texts(alone.svg));
});

test('the same data and the same measures draw the same SVG, and reveal / spotlight leave the drawing alone', async () => {
  const a = await renderDiagram(figure(comic(SAMPLE)), {name: 'a', budget: 'cacheOnly'});
  const b = await renderDiagram(figure(comic(SAMPLE)), {name: 'a', budget: 'cacheOnly'});
  assert.equal(a.svg, b.svg);
  assert.deepEqual(a.xml, []);
  assert.ok(a.svg.includes('data-comic="1x4"'));
});

test("the comic keeps its paper and ink in a dark diagram (ADR 0074 D6: it is for print and export): the drawing of the band is the same for appearance 'dark' and 'auto'", async () => {
  const draw = async (appearance?: 'dark' | 'auto') => (await renderDiagram(diagram({theme: 'blue', title: 'マンガ', width: 480, legend: false, ...(appearance ? {appearance} : {})}).add(comic(SAMPLE)), {name: 'a', budget: 'cacheOnly'})).svg;
  const comicOf = (svg: string) => svg.slice(svg.indexOf('<g data-comic='), svg.indexOf('</svg>'));
  const light = comicOf(await draw());
  assert.ok(light.includes('rgb(34,32,27)') && light.includes('rgb(255,255,255)'), 'ink and paper');
  for (const a of ['dark', 'auto'] as const) {
    const svg = await draw(a);
    assert.equal(comicOf(svg), light, a);
    assert.ok(!/#[0-9a-f]{6}/i.test(comicOf(svg).replace(/<style[\s\S]*?<\/style>/g, '')), 'no hex colour of the dark map inside the band');
  }
});
