import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {causeTree, checkDiagram, closeMeasurer, diagram, renderDiagram} from '../lib/dsl.ts';
import {loadConfig, applyConfig} from '../lib/config.ts';

test.after(() => closeMeasurer());

const WORD = 'シャドウトラフィック'; // 10 katakana: ~140px bold at 14px
const nodes = [{id: 'a', label: `${WORD}で検証できない`}, {id: 'b', label: 'コンテキストスイッチの増加'}, {id: 'c', label: '遅延'}];
const links = [{from: 'a', to: 'c'}, {from: 'b', to: 'c'}];
const breaks = async (d: ReturnType<typeof diagram>) => (await checkDiagram(d)).verdict.findings.filter(f => f.rule === 'text-mid-word-break').length;
const tree = (opts: object, dia: object = {}) => diagram({theme: 'blue', title: 't', ...dia}).add(causeTree(nodes, links, {tree: 'crt', ...opts}));

test('keepWords: a written maxNodeW that is narrower than a katakana word no longer breaks it; off, it does', async () => {
  assert.equal(await breaks(tree({dir: 'up', maxNodeW: 100})), 1, 'the word breaks without the option');
  assert.equal(await breaks(tree({dir: 'up', maxNodeW: 100}, {keepWords: true})), 0, 'and not with it');
});

test('keepWords: the default layout is unchanged where no word is wider than the box', async () => {
  const svg = async (dia: object) => (await renderDiagram(tree({}, dia), {name: 'a.svg', budget: 'cacheOnly'})).svg;
  assert.equal(await svg({keepWords: true}), await svg({}));
});

test('keepWords: a node never goes wider than the node width the figure starts with', async () => {
  const widest = async (dia: object) => Math.max(...((await checkDiagram(tree({dir: 'up', maxNodeW: 100}, dia))).laidOut.laidOut[0] as {nodes: {w: number}[]}).nodes.map(n => n.w));
  assert.ok((await widest({keepWords: true})) <= 200, 'within the first attempt (200)');
  assert.ok((await widest({keepWords: true})) > (await widest({})), 'wider than the narrow box it was given');
});

test('keepWords: a figure that does not fit with the floor is tried without it (the break is then left to text-mid-word-break)', async () => {
  const many = Array.from({length: 8}, (_, i) => ({id: `n${i}`, label: `${WORD}${'ス'.repeat(i)}の${i}`}));
  const d = (dia: object) => diagram({theme: 'blue', title: 't', ...dia}).add(causeTree([...many, {id: 'top', label: '結果'}], many.map(n => ({from: n.id, to: 'top'})), {dir: 'up', maxNodeW: 80, tree: 'crt'}));
  const without = await checkDiagram(d({}));
  const withFloor = await checkDiagram(d({keepWords: true}));
  assert.ok(withFloor.laidOut.width > 0 && without.laidOut.width > 0, 'both lay out: the floor does not turn a fit into an error');
  assert.equal(await breaks(d({keepWords: true})), await breaks(d({})), 'the fallback is the figure without the floor');
});

test('diagram({keepWords}) is a boolean; .svg-diagram.json takes it too and a diagram\'s own wins', () => {
  assert.throws(() => diagram({theme: 'blue', keepWords: 'yes' as never}), /keepWords/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kw-'));
  fs.writeFileSync(path.join(dir, '.svg-diagram.json'), JSON.stringify({keepWords: true}));
  const cfg = loadConfig(dir);
  assert.equal(cfg.keepWords, true);
  const data = (dia: object) => applyConfig({...dia} as never, cfg) as {keepWords?: boolean};
  assert.equal(data({}).keepWords, true);
  assert.equal(data({keepWords: false}).keepWords, false);
  fs.writeFileSync(path.join(dir, '.svg-diagram.json'), JSON.stringify({keepWords: 'yes'}));
  assert.throws(() => loadConfig(dir), /keepWords/);
});
