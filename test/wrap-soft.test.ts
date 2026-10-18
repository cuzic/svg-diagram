import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {causeTree, checkDiagram, closeMeasurer, diagram, renderDiagram} from '../lib/dsl.ts';
import {applyConfig, loadConfig} from '../lib/config.ts';

test.after(() => closeMeasurer());

const LABELS = ['途中から再開・リハーサルできる', '件数・チェックサムで差分を見つけられる', '移行前にデータをクレンジングする', '品質を保ちながら安全に切り替えられる', '戻す手段と過去データを保ち廃止に進める', '新たな負債を抑え改善を続けられる', '段階的な移行が許されない場合がある'];
const fig = (n: number, wrap: string) => {
  const labels = LABELS.slice(0, n);
  const nodes = [...labels.map((label, i) => ({id: `n${i}`, label})), {id: 'top', label: '本番移行を問題なく完了できる'}];
  return diagram({theme: 'blue', title: 't', wrap} as never).add(causeTree(nodes, labels.map((_, i) => ({from: `n${i}`, to: 'top'})), {dir: 'up', maxNodeW: 110, tree: 'frt'}));
};
const svg = async (d: ReturnType<typeof diagram>) => (await renderDiagram(d, {name: 'a.svg', budget: 'cacheOnly'})).svg;

test("wrap: 'bunsetsu-soft' breaks at phrase boundaries when the figure fits that way (the same drawing as 'bunsetsu')", async () => {
  const soft = await checkDiagram(fig(4, 'bunsetsu-soft'));
  assert.equal(soft.laidOut.wrapFellBack, undefined);
  assert.equal(await svg(fig(4, 'bunsetsu-soft')), await svg(fig(4, 'bunsetsu')));
  assert.ok(!soft.verdict.findings.some(f => f.rule === 'wrap-fell-back'));
});

test("wrap: 'bunsetsu-soft' lays a figure that does not fit that way out as 'phrase', and says so (information); 'bunsetsu' fails the build", async () => {
  await assert.rejects(checkDiagram(fig(7, 'bunsetsu')), /does not fit/);
  const soft = await checkDiagram(fig(7, 'bunsetsu-soft'));
  assert.equal(soft.laidOut.wrapFellBack, true);
  assert.equal(await svg(fig(7, 'bunsetsu-soft')), await svg(fig(7, 'phrase')), 'the same drawing as phrase');
  const f = soft.verdict.findings.find(x => x.rule === 'wrap-fell-back');
  assert.equal(f?.severity, 'info');
});

test("a real mistake of the author still fails with its own message in 'bunsetsu-soft'", async () => {
  const bad = diagram({theme: 'blue', title: 't', wrap: 'bunsetsu-soft'}).add(causeTree([{id: 'a', label: 'x'}, {id: 'a', label: 'y'}] as never, [], {tree: 'crt'}));
  await assert.rejects(checkDiagram(bad), /duplicate/i);
});

test('wrap is checked, and .svg-diagram.json takes it too (a diagram\'s own wins)', () => {
  assert.throws(() => diagram({theme: 'blue', wrap: 'bunsetu' as never}), /'bunsetsu-soft'/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wrap-'));
  fs.writeFileSync(path.join(dir, '.svg-diagram.json'), JSON.stringify({wrap: 'bunsetsu-soft'}));
  const cfg = loadConfig(dir);
  assert.equal(cfg.wrap, 'bunsetsu-soft');
  const data = (d: object) => applyConfig({...d} as never, cfg) as {wrap?: string};
  assert.equal(data({}).wrap, 'bunsetsu-soft');
  assert.equal(data({wrap: 'phrase'}).wrap, 'phrase');
  fs.writeFileSync(path.join(dir, '.svg-diagram.json'), JSON.stringify({wrap: 'bunsetu'}));
  assert.throws(() => loadConfig(dir), /"wrap" must be/);
});
