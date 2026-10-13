// issue #128: a narrow fit:'shrink' result warns; issue #129: .svg-diagram.json "accept" is validated.
import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {bpmn, checkDiagram, closeMeasurer, diagram, swimlane} from '../lib/dsl.ts';
import {applyConfig, loadConfig} from '../lib/config.ts';

test.after(() => closeMeasurer());

const rule = async (d: ReturnType<typeof diagram>) => (await checkDiagram(d)).verdict.findings.filter(f => f.rule === 'shrink-narrow-text');

const chain = (n: number, fit?: 'shrink') => {
  const ids = Array.from({length: n}, (_, i) => `n${i}`);
  return bpmn([{id: 'a', label: '担当'}], ids.map(id => ({id, lane: 'a', label: '在庫を確認する'})), ids.slice(1).map((id, i) => ({from: ids[i], to: id})), fit ? {fit} : {});
};

test("bpmn fit:'shrink' that squeezes tasks warns; a roomy one does not", async () => {
  const d = diagram({theme: 'blue'}); d.add(chain(8, 'shrink'));
  const narrow = await rule(d);
  assert.equal(narrow.length, 1);
  assert.match(narrow[0].message, /字ずつ/);
  // eight tasks with the same label are named once, not eight times
  assert.equal(narrow[0].message.match(/「在庫を確認する」/g)?.length, 1);
  assert.doesNotMatch(narrow[0].message, /ほか/);
  const ok = diagram({theme: 'blue'}); ok.add(chain(3, 'shrink'));
  assert.deepEqual(await rule(ok), []);
});

test("swimlane fit:'shrink' warns", async () => {
  const d = diagram({theme: 'blue'});
  d.add(swimlane([{id: 'l', label: '担当'}], Array.from({length: 11}, (_, i) => ({id: `s${i}`, lane: 'l', col: i + 1, title: '在庫を確認する'})), {fit: 'shrink'}));
  const f = await rule(d);
  assert.equal(f.length, 1);
});

const withCfg = (cfg: unknown) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svgd-'));
  fs.writeFileSync(path.join(dir, '.svg-diagram.json'), JSON.stringify(cfg));
  return dir;
};

test('.svg-diagram.json accept: unknown rule ids and empty reasons throw; diagram accept wins', () => {
  assert.throws(() => loadConfig(withCfg({accept: {'gray-tone-colision': 'x'}})), /unknown rule "gray-tone-colision"/);
  assert.throws(() => loadConfig(withCfg({accept: {'gray-tone-collision': ''}})), /non-empty reason/);
  assert.throws(() => loadConfig(withCfg({accept: {constructor: 'x'}})), /unknown rule "constructor"/);
  const cfg = loadConfig(withCfg({accept: {'gray-tone-collision': 'project', 'shrink-narrow-text': 'p2'}}));
  const d = applyConfig({accept: {'gray-tone-collision': 'own'}} as never, cfg) as {accept: Record<string, string>};
  assert.equal(d.accept['gray-tone-collision'], 'own');
  assert.equal(d.accept['shrink-narrow-text'], 'p2');
});
