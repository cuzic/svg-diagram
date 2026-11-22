import {test} from 'node:test';
import assert from 'node:assert/strict';
import {comic, diagram, renderComic, renderInBrowser} from '../lib/web.ts';
import type {Values, WebMeasurer} from '../lib/web.ts';
import {renderComicBand} from '../lib/comic/emit.ts';
import {replaceComicFragment} from '../lib/comic/render.ts';
import {withNodeIdsBand} from '../lib/emit-node-ids.ts';
import type {LaidOutComic} from '../lib/types/comic.ts';
import {ARTIST} from './helpers/comic-character.ts';
import {SAMPLE} from './helpers/comic-sample.ts';
import {measure, slotSvg, withoutSlotsAndTitles} from './helpers/comic-values.ts';

const base = (nodeIds = false) => renderInBrowser(diagram({theme: 'blue', title: SAMPLE.title, width: 492, legend: false}).add(comic(SAMPLE)), {measure, nodeIds});

test('renderComic shares the browser pipeline and replaces only the comic fragment, including with node ids', async () => {
  for (const nodeIds of [false, true]) {
    const plain = await base(nodeIds);
    const empty = await renderComic(SAMPLE, {measure, nodeIds});
    assert.deepEqual(empty.verdict, plain.verdict);
    assert.deepEqual(empty.xml, plain.xml);
    assert.deepEqual(empty.fit, plain.fit);
    assert.equal(empty.svg, plain.svg);
    assert.equal(empty.width, 492);
    const laid = plain.laidOut.laidOut.find(b => b.type === 'comic')!;
    assert.equal(laid.w, plain.width - 40);
    const emitted = (nodeIds ? withNodeIdsBand(laid) : laid) as LaidOutComic;
    const filled = await renderComic(SAMPLE, {measure, nodeIds, values: {day: '水曜'}});
    assert.equal(filled.svg, plain.svg.replace(renderComicBand(emitted), renderComicBand(emitted, {day: '水曜'})));
    assert.match(slotSvg(filled.svg, 'day'), />水曜<\/text>/);
    assert.equal(filled.svg, (await renderComic(SAMPLE, {measure, nodeIds, values: {day: '水曜'}})).svg);
    assert.deepEqual(filled.laidOut.laidOut, empty.laidOut.laidOut);
  }
  const grid = await renderComic({...SAMPLE, layout: '2x2'}, {measure});
  assert.equal(grid.width, 808);
  assert.equal(grid.geometry.panels['p1']?.w, 360);
});

test('values leave geometry, fit and verdict unchanged in all four states', async () => {
  const empty = await renderComic(SAMPLE, {measure});
  assert.equal(empty.verdict.ok, true);
  for (const day of [undefined, '水曜', null, 'ABCDEFGH'] as const) {
    const values: Values = day === undefined ? {} : {day};
    const r = await renderComic(SAMPLE, {measure, values});
    assert.deepEqual(r.geometry, empty.geometry);
    assert.deepEqual(r.fit, empty.fit);
    assert.equal(r.verdict.ok, empty.verdict.ok);
    assert.deepEqual(r.verdict.problems, empty.verdict.problems);
    assert.equal(withoutSlotsAndTitles(r.svg), withoutSlotsAndTitles(empty.svg));
    if (day === 'ABCDEFGH') assert.deepEqual(r.findings.map(f => f.rule).sort(), ['comic-value-invalid', 'slot-overflow']);
    else assert.deepEqual(r.findings, []);
  }
});

test('only non-full-width value atoms are measured, at both sizes once per call', async () => {
  type Request = Parameters<WebMeasurer>[0];
  const calls: Request[] = [];
  const count: WebMeasurer = async request => { calls.push(request); return measure(request); };
  const draw = async (values: Values) => {
    calls.length = 0;
    await renderComic(SAMPLE, {measure: count, values});
    return [...calls];
  };
  const plain = await draw({});
  assert.deepEqual(await draw({day: '水曜', what: null, change: '早く帰る'}), plain);
  const expected = [18, 14].map(size => ({text: 'ABCDE', size, weight: 700, font: 'sans'}));
  for (const values of [{change: 'ABCDE'}, {change: 'ABCDE'}, {change: 'ABCDE', wish: 'ABCDE'}, {change: 'ABCDEとABCDE'}]) {
    assert.deepEqual((await draw(values as Values)).slice(plain.length), expected);
  }
});

test('control characters are reported without corrupting the SVG and unknown values are ignored', async () => {
  const plain = await renderComic(SAMPLE, {measure});
  const unknown = await renderComic(SAMPLE, {measure, values: {zzz: '<&'}});
  assert.equal(unknown.svg, plain.svg);
  assert.deepEqual(unknown.findings.map(f => [f.rule, f.where, f.severity]), [['comic-values-unknown', 'zzz', 'advice']]);
  const invalid = await renderComic(SAMPLE, {measure, values: {day: '水\x07曜'}});
  assert.ok(invalid.findings.some(f => f.rule === 'comic-value-invalid'));
  assert.ok(!invalid.svg.includes('\x07'));
});

test('a missing or repeated source fragment aborts the replacement', () => {
  const original = '<g data-comic="1x4"></g>';
  for (const svg of ['<svg/>', `<svg>${original}${original}</svg>`]) {
    assert.throws(() => replaceComicFragment(svg, original, '<g/>'), /renderComic.*断片/);
  }
  assert.equal(replaceComicFragment(`<svg>${original}</svg>`, original, '<g>$&</g>'), '<svg><g>$&</g></svg>');
});

test('renderComic forwards character material and aspect and requires a measurer', async () => {
  const sheet = {...SAMPLE, cast: {...SAMPLE.cast, col: {...SAMPLE.cast['col']!, asset: ARTIST.id}}};
  const drawn = await renderComic(sheet, {measure, aspect: '1:1', characters: {[ARTIST.id]: ARTIST}});
  assert.match(drawn.svg, /<svg data-character="colleague-a"/);
  assert.equal(drawn.geometry.panels['p1']!.h, 420);
  await assert.rejects(renderComic(sheet, {measure, characters: {[ARTIST.id]: {...ARTIST, license: undefined!}}}), /comic-license-missing/);
  await assert.rejects(renderComic(SAMPLE, {} as never), /renderComic.*measure/);
  await assert.rejects(renderComic(SAMPLE, undefined!), /renderComic.*measure/);
});

test('thumbnail crops the selected panel, empties its slots and never measures again', async () => {
  const sheet = {...SAMPLE, panels: SAMPLE.panels.map(p => p.id === 'p3' ? {...p, thumb: true} : p)};
  let count = 0;
  const r = await renderComic(sheet, {measure: request => { count++; return measure(request); }, values: {what: '水曜'}});
  const before = count;
  const thumb = r.thumbnail('p2', {width: 160});
  const {x, y, w, h} = r.geometry.panels['p2']!;
  assert.match(thumb, new RegExp(`viewBox="${x - 8} ${y - 8} ${w + 16} ${h + 16}"`));
  assert.ok(thumb.includes(`width="160" height="${(h + 16) * 160 / (w + 16)}"`));
  assert.match(thumb, /data-panel="p2"/);
  assert.doesNotMatch(thumb, /data-panel="p1"|水曜|心配|準備/);
  assert.match(slotSvg(thumb, 'what'), /stroke-dasharray/);
  assert.match(r.thumbnail(undefined, {width: 160}), /data-panel="p3"/);
  assert.throws(() => r.thumbnail('missing', {width: 160}), /missing/);
  assert.equal(count, before);
  assert.match((await renderComic(SAMPLE, {measure})).thumbnail(undefined, {width: 160}), /data-panel="p1"/);
});
