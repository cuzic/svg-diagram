import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import type {ComicExpression, ComicWorksheet} from '../../lib/types/comic.ts';
import type {convertOpenPeeps} from './convert.ts';

const [checkout, mode] = process.argv.slice(2);
if (!checkout || (mode !== undefined && mode !== '--check')) {
  throw new Error('node spikes/comic-assets/render.ts <PR #442 の展開先> [--check] を実行してください');
}

const moduleUrl = pathToFileURL(resolve(checkout, 'lib/dsl.ts'));
const {comic, diagram, renderDiagram}: typeof import('../../lib/dsl.ts') = await import(moduleUrl.href);
const asset: ReturnType<typeof convertOpenPeeps> = JSON.parse(
  readFileSync(new URL('./character.json', import.meta.url), 'utf8'),
);
const frames: readonly [ComicExpression, string][] = [
  ['neutral', '要確認です'],
  ['smile', 'ここが変更点です'],
  ['surprise', '差分がありました'],
  ['laugh', '確認できました'],
];

const sheet: ComicWorksheet = {
  version: 1,
  title: '確認の流れ',
  layout: '2x2',
  cast: {guide: {name: asset.name, asset: asset.id}},
  panels: frames.map(([expression, tpl], index) => ({
    id: `p${index + 1}`,
    stage: [{who: 'guide', at: 'center', expression}],
    dialogue: [{id: 'd1', who: 'guide', kind: 'say', tpl}],
  })),
};

const options = {id: 'comic-assets', aspect: '7:5' as const, characters: {[asset.id]: asset}};
const example = diagram({theme: 'blue', width: 800, legend: false}).add(comic(sheet, options));
const {svg, verdict, xml} = await renderDiagram(example, {name: 'comic-assets', budget: 'cacheOnly'});
assert.deepEqual(verdict.problems, []);
assert.deepEqual(xml, []);
assert.equal(svg.split(`data-character="${asset.id}"`).length - 1, frames.length);

const outputUrl = new URL('./out/four-panels.svg', import.meta.url);
if (mode === '--check') {
  assert.equal(svg, readFileSync(outputUrl, 'utf8'));
} else {
  writeFileSync(outputUrl, svg);
}
