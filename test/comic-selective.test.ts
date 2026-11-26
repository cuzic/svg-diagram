import assert from 'node:assert/strict';
import {globSync} from 'node:fs';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {band} from '../lib/band-def.ts';
import {box} from '../lib/bands/box.ts';
import {comic, comicDefinition} from '../lib/bands/comic.ts';
import {connect} from '../lib/bands/connect.ts';
import {comicAcceptHint, comicAdvice, comicProblems} from '../lib/comic/findings.ts';
import {valueFindings} from '../lib/comic/slot-values.ts';
import {renderBands} from '../lib/core.ts';
import {documentAcceptHint, documentFindings} from '../lib/document-findings.ts';
import {importDefine} from '../lib/load-source.ts';
import {installResolveHook} from '../lib/resolve-hook.ts';
import {RULE_DOCS, RULE_LOCATION} from '../lib/rules.ts';
import type {ComicWorksheet} from '../lib/types/comic.ts';
import type {Verdict} from '../lib/types/verdicts.ts';
import {comicConnectorProblems} from '../lib/verify-comic-rects.ts';
import {comic as legacyComic, diagram, renderComic, renderInBrowser} from '../lib/web.ts';
import {SAMPLE} from './helpers/comic-sample.ts';
import {measure, widthOf} from './helpers/comic-values.ts';

installResolveHook();

const drawOpts = {measure, diagramFindings: documentFindings, diagramAcceptHint: documentAcceptHint};
const diagnostics = (verdict: Verdict) => ({
  problems: new Set(verdict.problems),
  warnings: new Set(verdict.warnings),
  rules: new Set(verdict.findings.map(f => f.rule)),
});

const examples = new URL('../examples/', import.meta.url);
for (const file of globSync('comic-*.ts', {cwd: fileURLToPath(examples)}).sort()) {
  test(`${file} keeps its diagnostics in selective rendering`, async () => {
    const define = await importDefine(fileURLToPath(new URL(file, examples)));
    const input = define();
    const [source] = input.bands;
    assert.ok(source?.type === 'comic');
    assert.equal(input.bands.length, 1);
    const selected = await renderBands([band(comicDefinition, source)], {
      ...drawOpts, width: input.width, title: input.title, theme: input.day, accept: input.accept,
    });
    const legacy = await renderInBrowser(input, {measure});
    assert.deepEqual(diagnostics(selected.verdict), diagnostics(legacy.verdict));
    assert.deepEqual(selected.laidOut.inventory, legacy.laidOut.inventory);
    assert.deepEqual(selected.xml, []);
    assert.match(selected.svg, /data-comic=/);
  });
}

test('selective comic reports worksheet problems and lint advice', async () => {
  const sheet: ComicWorksheet = {
    version: 1, title: '穴の検査', layout: '1x2', cast: {},
    panels: [
      {id: 'p1', stage: [], dialogue: [
        {id: 'note', kind: 'narration', tpl: '{short}{missing}', slots: {short: {max: 2, fallback: '長すぎる', prompt: '確認'}}},
      ]},
      {id: 'p2', stage: [], dialogue: [
        {id: 'wide', kind: 'narration', tpl: 'Internationalization-supportあ'},
      ]},
    ],
  };
  const opts = {width: 492, title: sheet.title, theme: 'blue', legend: false} as const;
  for (const accept of [undefined, {'comic-bubble-wide': '比較用の見本'}]) {
    const legacy = await renderInBrowser(diagram({...opts, accept}).add(legacyComic(sheet)), {measure});
    const selected = await renderBands([comic(sheet)], {...drawOpts, ...opts, accept});
    assert.ok(legacy.verdict.problems.some(problem => problem.endsWith('[comic-slot-max]')));
    assert.ok(legacy.verdict.problems.some(problem => problem.endsWith('[comic-slot-undefined]')));
    assert.ok(legacy.verdict.findings.some(f => f.rule === 'comic-bubble-wide' && f.severity === (accept ? 'info' : 'warn')));
    assert.deepEqual(diagnostics(selected.verdict), diagnostics(legacy.verdict));
    const [laid] = selected.laidOut.laidOut;
    assert.ok(laid?.type === 'comic');
    assert.deepEqual(comicProblems(laid).map(f => f.message), selected.verdict.problems);
    assert.deepEqual(comicAdvice(laid).map(f => [f.rule, f.severity]).sort(), [
      ['comic-bubble-wide', 'warn'], ['comic-orphan-line', 'warn'],
    ]);
  }
});

test('selective comic publishes the same documented rule ids, guidance and scope', () => {
  const rules = ['comic-bubble-wide', 'comic-orphan-line', 'comic-follower-split',
    'comic-value-invalid', 'comic-values-unknown', 'slot-overflow'] as const;
  assert.deepEqual(Object.keys(comicDefinition.rules ?? {}), [...rules]);
  for (const rule of rules) {
    assert.deepEqual(comicDefinition.rules?.[rule], {doc: RULE_DOCS[rule], scope: RULE_LOCATION[rule]});
    assert.ok(comicAcceptHint(rule)?.includes(`check --explain ${rule}`));
  }
  assert.equal(comicAcceptHint('doc-width'), undefined);
});

test('filled worksheet values retain their own findings with selective comic geometry', async () => {
  const values = {day: '水\x07曜', unknown: '未定義'};
  const legacy = await renderComic(SAMPLE, {measure, values});
  const selected = await renderBands([comic(SAMPLE)], {
    ...drawOpts, title: SAMPLE.title, width: legacy.width,
  });
  const [laid] = selected.laidOut.laidOut;
  assert.ok(laid?.type === 'comic');
  const findings = valueFindings(SAMPLE, laid, values, widthOf);
  assert.deepEqual(findings.map(f => f.rule).sort(), ['comic-value-invalid', 'comic-values-unknown']);
  assert.deepEqual(findings, legacy.findings);
  assert.deepEqual(diagnostics(selected.verdict), diagnostics(legacy.verdict));
});

test('selective comic anchors and connectors follow the band reveal interval', async () => {
  const worksheet = comic(SAMPLE, {scope: 'sheet', reveal: 2, until: 4});
  const marker = box({id: 'note', title: '注記'});
  for (const [id, side] of [['p1', 'top'], ['p1.d1', 'top'], ['day', 'top']] as const) {
    const bands = [marker, worksheet, connect('note:bottom', `${id}:${side}`)];
    for (const stage of [1, 2, 4]) {
      const result = await renderBands(bands, {measure, width: 500, stage});
      assert.equal(result.laidOut.connects[0]?.toId, `sheet.${id}`);
      assert.equal(result.laidOut.connects[0]?.reveal, 2);
      assert.equal(result.laidOut.connects[0]?.until, 4);
      assert.equal(result.svg.includes('data-comic='), stage === 2);
      assert.equal(result.svg.includes('marker-end='), stage === 2);
    }
  }
});

test('selective comic checks other bubbles when a connector enters a slot', async () => {
  const sheet: ComicWorksheet = {...SAMPLE, panels: SAMPLE.panels.map(panel => panel.id === 'p1' ? {...panel, dialogue: [
    {id: 'intro', kind: 'narration', tpl: '今週の予定について話します。'}, ...panel.dialogue,
  ]} : panel)};
  const {laidOut, verdict} = await renderBands([
    box({id: 'note', title: '注記'}), comic(sheet, {scope: 'sheet'}), connect('note:bottom', 'sheet.day:top'),
  ], {measure, width: 500});
  assert.deepEqual(verdict.problems.filter(p => p.includes('経路がふきだし')), [
    'connect(note -> sheet.day) の経路がふきだし "sheet.p1.intro" に重なります。接続の辺か経路を変えてください',
  ]);
  const laid = laidOut.laidOut.find(b => b.type === 'comic');
  const [link] = laidOut.connects;
  assert.ok(laid && link);
  assert.deepEqual(comicConnectorProblems(laid, [{...link, segments: link.pathSegments}]), [
    'connect(note:bottom -> sheet.day:top) の経路がふきだし "sheet.p1.intro" に重なります。接続の辺か経路を変えてください',
  ]);
});
