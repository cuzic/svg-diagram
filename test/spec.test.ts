// A diagram as JSON (lib/spec.ts): the input of a caller that must not run a source file. The checks that matter: it draws what the DSL draws,
// it says where a mistake is, and nothing outside the schema reaches a builder.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import * as pure from '../lib/dsl-pure.ts';
import {build as bundle} from 'esbuild';
import {closeMeasurer, diagram, flowchart, mindmap, pyramid, quadrant, renderDiagram, sequence, table, whyWhyTree} from '../lib/dsl.ts';
import {MEMO_LIMIT, currentMeasure, measureAtoms, measureMemoSize} from '../lib/measure.ts';
import {xmlProblems} from '../lib/xml-check.ts';
import {installResolveHook} from '../lib/resolve-hook.ts';
import {MAX_CAUSE_LINKS, MAX_CAUSE_NODES, MAX_EMOJI, MAX_ISSUES, MAX_SWIMLANE_COLS, MAX_TOTAL_TEXT, MAX_TREE_DEPTH, SpecError, capped, cappedMessages, fieldsHolding, layoutIssue, locateMessage, locateVerdict, partCatalog, specSchema, specToDiagram, validateSpec} from '../lib/spec.ts';
import {MAX_PNG_PIXELS, lintMessages, lintRendering, renderSpec, svgToPng} from '../lib/spec-render.ts';
import type {Diagram} from '../lib/types/index.ts';

test.after(() => closeMeasurer());

const ROOT = path.resolve(import.meta.dirname, '..');
const svgOf = async (d: Diagram) => (await renderDiagram(d, {name: 'x.svg', budget: 'cacheOnly'})).svg;
const spec = (...parts: unknown[]) => ({version: 1, title: '例', parts});
const flow = {type: 'flowchart', nodes: [{id: 'a', label: '開始'}, {id: 'b', label: '終了'}], edges: [{from: 'a', to: 'b'}]};
const pathsOf = (input: unknown) => validateSpec(input).map(i => i.path);

test('a flowchart spec draws the same SVG as the DSL', async () => {
  const nodes = [{id: 's', kind: 'terminator', label: '受付'}, {id: 'q', kind: 'decision', label: '在庫はある？'}, {id: 'a', label: '発送する', sub: '当日'}] as const;
  const edges = [{from: 's', to: 'q'}, {from: 'q', to: 'a', label: 'Yes'}];
  const dsl = diagram({theme: 'teal', title: '注文'}).add(flowchart(nodes, edges));
  const json = specToDiagram({version: 1, title: '注文', theme: 'teal', parts: [{type: 'flowchart', nodes, edges}]});
  assert.equal(await svgOf(json), await svgOf(dsl as unknown as Diagram));
});

test('the service-blueprint example, written as a spec, draws the same SVG', async () => {
  installResolveHook();
  const {default: define} = await import(path.join(ROOT, 'examples/service-blueprint.ts')) as {default: () => Diagram};
  const json = specToDiagram({version: 1, title: 'ミールキット宅配の注文（架空の例）', parts: [{
    type: 'swimlane',
    lanes: [{id: 'ev', label: '物的証拠', tone: 'muted'}, {id: 'cust', label: '顧客の行動'}, {id: 'front', label: '表の業務（接点）'}, {id: 'back', label: '裏の業務'}, {id: 'sys', label: '支援システム', tone: 'muted'}],
    steps: [
      {lane: 'ev', title: 'アプリの画面', col: 1}, {lane: 'ev', title: '配達の箱とチラシ', col: 3},
      {id: 'c1', lane: 'cust', title: '献立を選ぶ', col: 1}, {id: 'c2', lane: 'cust', title: '注文を確定する'}, {id: 'c3', lane: 'cust', title: '箱を受け取る', tag: '待ち'},
      {id: 'f1', lane: 'front', title: '注文を受け付ける', col: 2}, {id: 'f2', lane: 'front', title: '配達員が手渡す', col: 3},
      {id: 'b1', lane: 'back', title: '食材を小分けする', col: 2, tag: '失敗点'},
      {id: 's1', lane: 'sys', title: '在庫・注文の管理', col: 2, span: 2},
    ],
    boundaries: [{between: ['cust', 'front'], label: '相互作用線'}, {between: ['front', 'back'], label: '可視線'}, {between: ['back', 'sys'], label: '内部相互作用線'}],
    flows: [{from: 'c1', to: 'c2'}, {from: 'c2', to: 'c3'}, {from: 'c2', to: 'f1'}, {from: 'f1', to: 'b1'}, {from: 'b1', to: 'f2'}, {from: 'f2', to: 'c3'}, {from: 's1', to: 'b1'}],
    phases: [{label: '注文', from: 1, to: 2}, {label: '受け取り', from: 3, to: 3}],
  }]});
  assert.equal(await svgOf(json), await svgOf(define()));
});

test('a sequence spec draws the same SVG as the DSL', async () => {
  const actors = [{id: 'u', label: '利用者'}, {id: 'api', label: 'API'}];
  const steps = [{divider: '認証'}, {from: 'u', to: 'api', label: 'ログインする'}, {self: 'api', label: '検証する'}, {note: '30 分で失効', over: ['api']}, {from: 'api', to: 'u', label: 'トークン', line: 'dashed'}];
  const dsl = diagram({theme: 'blue', title: '例'}).add(sequence(actors as never, steps as never));
  assert.equal(await svgOf(specToDiagram(spec({type: 'sequence', actors, steps}))), await svgOf(dsl as unknown as Diagram));
});

/** An example of the repository, and the same figure written as a spec. */
const SAME_AS_EXAMPLE: Record<string, unknown> = {
  'toc-crt': {version: 1, title: '納期遅れの現状ツリー', sourceLine: '出典: 説明用の例', parts: [{type: 'causeTree', maxNodeW: 170, nodes: [{id: 'late', label: '納期に遅れる', role: 'ude'}, {id: 'cost', label: '残業費が膨らむ', role: 'ude'}, {id: 'switch', label: '作業の切り替えが多い'}, {id: 'rush', label: '急ぎの割り込みが入る'}, {id: 'wip', label: '仕掛りが多い'}, {id: 'start', label: '受注したらすぐ着手する'}, {id: 'kpi', label: '稼働率で評価される', role: 'root'}], links: [{from: 'kpi', to: 'start'}, {from: 'start', to: 'wip'}, {from: 'wip', to: 'switch'}, {from: 'wip', to: 'rush'}, {from: 'switch', to: 'late'}, {from: ['switch', 'rush'], to: 'cost'}]}]},
  'toc-frt': {version: 1, title: '受注の着手を絞る未来現実ツリー', legend: 'auto', sourceLine: '出典: 説明用の例', parts: [{type: 'causeTree', tree: 'frt', nodes: [{id: 'de', label: '納期を守れる', role: 'de'}, {id: 'gain', label: '顧客の信頼が増える'}, {id: 'wip', label: '仕掛りが減る'}, {id: 'focus', label: '1 つずつ仕上げる'}, {id: 'cap', label: '着手の枠を決める', role: 'injection'}, {id: 'fact', label: '受注の量は変えられない', role: 'precondition'}, {id: 'sales', label: '営業が納期を相談できる', role: 'precondition'}], links: [{from: 'cap', to: 'wip'}, {from: 'wip', to: 'focus'}, {from: ['focus', 'sales'], to: 'de'}, {from: ['fact', 'cap'], to: 'focus'}, {from: 'de', to: 'gain'}, {from: 'gain', to: 'sales', back: true}]}]},
  'toc-cloud': {version: 1, title: '品質とスピードのクラウド', sourceLine: '出典: 説明用の例', parts: [{type: 'cloud', a: '製品を成功させる', b: '品質を確保する', c: '市場機会を逃さない', d: '検証に時間をかける', d2: '早くリリースする', assumptions: [{on: 'bd', text: '品質確保には長い検証期間が必須だ', injection: '自動テストで検証を短くする'}, {on: 'cd', text: '早いリリースとは全機能の一括公開だ', injection: '主要機能から段階的に公開する'}, {on: 'dd', text: '検証を終えてからでないと公開できない'}]}]},
  'chevron-release': {version: 1, title: 'リリース工程', parts: [{type: 'chevron', steps: [{label: '計画', sub: '要件を確認'}, {label: '実装', sub: '小さく作る'}, {label: '検証', sub: '品質を確認'}, {label: '公開', sub: '利用を開始'}], current: 2}]},
  'cycle-pdca': {version: 1, title: 'PDCA', parts: [{type: 'cycle', steps: [{label: 'Plan'}, {label: 'Do'}, {label: 'Check'}, {label: 'Act'}], centre: '継続改善'}]},
  'state-diagram': {version: 1, title: '注文の状態', sourceLine: '出典: 注文サービスの設計メモ(例)', parts: [{type: 'stateDiagram', initial: 'new', states: [{id: 'new', label: '受付済み'}, {id: 'paid', label: '入金済み', tone: 'accent'}, {id: 'ship', label: '出荷中', sub: '追跡番号あり'}, {id: 'done', label: '完了', final: true}, {id: 'cancel', label: 'キャンセル', tone: 'muted', final: true}], transitions: [{from: 'new', to: 'paid', label: '入金'}, {from: 'paid', to: 'ship', label: '出荷'}, {from: 'ship', to: 'done', label: '到着'}, {from: 'ship', to: 'ship', label: '再配達'}, {from: 'new', to: 'cancel', label: '期限切れ', line: 'dashed'}, {from: 'paid', to: 'new', label: '入金取消'}]}]},
  'gantt': {version: 1, title: '在庫管理アプリ 開発計画', sourceLine: '出典: プロジェクト計画(例)', parts: [{type: 'gantt', today: '2026-10-26', rows: [{section: '設計'}, {id: 'req', label: '要件定義', start: '2026-10-05', end: '2026-10-16', progress: 1}, {id: 'ui', label: '画面設計', start: '2026-10-19', end: '2026-10-30', progress: 0.5, after: 'req'}, {section: '開発'}, {id: 'app', label: 'アプリ実装', start: '2026-11-02', end: '2026-11-27', after: 'ui'}, {id: 'api', label: 'API 実装', start: '2026-11-02', end: '2026-11-20', after: 'ui'}, {id: 'test', label: '結合テスト', start: '2026-11-30', end: '2026-12-11', after: ['api', 'app'], tone: 'danger'}, {section: 'リリース'}, {label: '本番リリース', start: '2026-12-14', milestone: true, after: 'test'}]}]},
  'funnel-sales': {version: 1, title: '営業ファネル', parts: [{type: 'funnel', scale: 'value', showRate: true, stages: [{label: '訪問', value: 1200}, {label: '問い合わせ', value: 420}, {label: '商談', value: 160}, {label: '成約', value: 52}]}]},
  'venn-skills': {version: 1, title: '必要な能力', parts: [{type: 'venn', sets: [{name: '技術'}, {name: '顧客理解'}], overlaps: [{sets: ['技術', '顧客理解'], label: '価値'}], universe: 'チーム'}]},
  'journey-map': {version: 1, title: '定期便のカスタマージャーニー', parts: [{type: 'journeyMap', title: 'カスタマージャーニーマップ', stages: ['認知', '検討', '購入', '利用'], lanes: [{id: 'action', label: '行動', cells: ['広告を見る', '比較する', '申し込む', '商品を使う']}, {id: 'touchpoint', label: 'タッチポイント', cells: ['SNS', '商品ページ', '決済画面', '同梱ガイド']}, {id: 'emotion', label: '感情', cells: [0, -1, 1, 2]}, {id: 'issue', label: '課題', cells: ['違いが不明', '送料が不明', '入力が多い', '交換日が不明']}]}]},
  'raci-project': {version: 1, title: '新サービス立ち上げ RACI', parts: [{type: 'raci', title: 'RACI 責任分担表', legend: true, tasks: ['要件定義', '画面設計', 'リリース判定'], roles: ['PM', 'デザイン', '開発', '事業責任者'], assignments: [['R', 'C', 'C', 'A'], ['A', 'R', 'C', 'I'], ['R', 'I', 'C', 'A']]}]},
  'value-chain': {version: 1, title: '価値連鎖（バリューチェーン）', parts: [{type: 'valueChain', support: [{label: '全般管理（インフラストラクチャ）', sub: '財務・経理・法務・経営企画'}, {label: '人事・労務管理', sub: '採用・教育・評価'}, {label: '技術開発', sub: '製品設計・工程改善'}, {label: '調達活動', sub: '原材料・設備・サービスの購買'}], primary: [{label: '購買物流', sub: '受入れ・保管'}, {label: '製造', sub: '加工・組立'}, {label: '出荷物流', sub: '配送・在庫'}, {label: '販売・マーケティング', sub: '広告・営業'}, {label: 'サービス', sub: '保守・サポート'}]}]},
};
for (const [name, json] of Object.entries(SAME_AS_EXAMPLE)) {
  test(`the ${name} example, written as a spec, draws the same SVG`, async () => {
    installResolveHook();
    const {default: define} = await import(path.join(ROOT, `examples/${name}.ts`)) as {default: () => Diagram};
    assert.equal(await svgOf(specToDiagram(json)), await svgOf(define()));
  });
}

test('a mind map spec draws the same SVG as the DSL', async () => {
  const root = {label: '在庫管理アプリ', tone: 'accent', children: [{label: '目的', children: [{label: '棚卸しの時間を半分に'}]}, {label: '課題', sub: '優先', children: [{label: '現場の端末'}]}]} as const;
  const dsl = diagram({theme: 'blue', title: '例'}).add(mindmap(root as never, {layout: 'right', edges: 'curve'}));
  assert.equal(await svgOf(specToDiagram(spec({type: 'mindmap', root, layout: 'right', edges: 'curve'}))), await svgOf(dsl as unknown as Diagram));
});

test('cause trees: references, ANDs and single-cause links are checked at their place', () => {
  const nodes = [{id: 'a', label: '一'}, {id: 'b', label: '二'}, {id: 'c', label: '三'}];
  const tree = (links: unknown[]) => spec({type: 'causeTree', nodes, links});
  assert.deepEqual(pathsOf(tree([{from: 'z', to: 'a'}])), ['parts[0].links[0].from']);
  assert.deepEqual(pathsOf(tree([{from: 'a', to: 'z'}])), ['parts[0].links[0].to']);
  assert.deepEqual(pathsOf(tree([{from: ['a', 'z'], to: 'b'}])), ['parts[0].links[0].from[1]']);
  assert.deepEqual(pathsOf(tree([{from: ['a', 'b'], to: 'c', back: true}])), ['parts[0].links[0].back']);
  assert.deepEqual(pathsOf(tree([{from: ['a', 'b'], to: 'c', kind: 'blocks'}])), ['parts[0].links[0].kind']);
  assert.deepEqual(pathsOf(tree([{from: 3, to: 'a'}])), ['parts[0].links[0].from']);
  assert.deepEqual(pathsOf(tree([{from: ['a'], to: 'b'}])), ['parts[0].links[0].from']); // an AND of one is a mistake
  assert.deepEqual(validateSpec(tree([{from: ['a', 'b'], to: 'c'}, {from: 'c', to: 'a', back: true}])), []);
  assert.deepEqual(pathsOf(spec({type: 'causeTree', nodes: [{id: 'a', label: '一', role: 'nonsense'}], links: []})), ['parts[0].nodes[0].role']);
  assert.deepEqual(pathsOf(spec({type: 'causeTree', tree: 'xyz', nodes, links: []})), ['parts[0].tree']);
});

test('a cause tree is bounded at what a worker draws in time', () => {
  const nodes = (n: number) => Array.from({length: n}, (_, i) => ({id: `n${i}`, label: '事象'}));
  assert.deepEqual(pathsOf(spec({type: 'causeTree', nodes: nodes(MAX_CAUSE_NODES + 1), links: []})), ['parts[0].nodes']);
  const links = Array.from({length: MAX_CAUSE_LINKS + 1}, (_, i) => ({from: `n${i % MAX_CAUSE_NODES}`, to: `n${(i + 1) % MAX_CAUSE_NODES}`}));
  assert.deepEqual(pathsOf(spec({type: 'causeTree', nodes: nodes(MAX_CAUSE_NODES), links})), ['parts[0].links']);
});

test('a quadrant spec draws the same SVG as the DSL, by cell, by place and by preset', async () => {
  const opts = {x: {title: '価格', low: '安い', high: '高い'}, y: {title: '品質', low: '低', high: '高'}, items: [{label: '自社', at: [0.4, 0.8], size: 30, group: '国内'}, {label: 'A 社', at: [0.7, 0.6], size: 50, group: '海外'}, {label: 'B 社', at: [0.2, 0.3], size: 10, group: '国内'}]};
  const dsl = diagram({theme: 'blue', title: '例'}).add(quadrant(opts as never));
  assert.equal(await svgOf(specToDiagram(spec({type: 'quadrant', ...opts}))), await svgOf(dsl as unknown as Diagram));
  const preset = {items: [{label: '障害対応', cell: [0, 0]}, {label: '育成', cell: [1, 0]}]};
  const dsl2 = diagram({theme: 'blue', title: '例'}).add(quadrant.preset('eisenhower', preset as never));
  assert.equal(await svgOf(specToDiagram(spec({type: 'quadrant', preset: 'eisenhower', ...preset}))), await svgOf(dsl2 as unknown as Diagram));
});

test('a pyramid spec draws the same SVG as the DSL', async () => {
  const layers = ['ビジョン', '戦略', '戦術', '日々の業務'];
  const dsl = diagram({theme: 'blue', title: '例'}).add(pyramid(layers as never));
  assert.equal(await svgOf(specToDiagram(spec({type: 'pyramid', layers}))), await svgOf(dsl as unknown as Diagram));
});

test('quadrant items need one place; numbers are checked as numbers; a chevron step in progress must exist', () => {
  const q = (item: object) => spec({type: 'quadrant', x: {title: '横'}, y: {title: '縦'}, items: [{label: 'x', ...item}]});
  assert.deepEqual(pathsOf(spec({type: 'quadrant', items: [{label: 'x', cell: [0, 0]}]})), ['parts[0].x', 'parts[0].y']);
  assert.deepEqual(pathsOf(spec({type: 'quadrant', preset: 'risk', items: [{label: 'a', cell: [0, 0], size: 3}, {label: 'b', cell: [0, 0]}]})), ['parts[0].items[1].size']);
  assert.deepEqual(pathsOf(q({})), ['parts[0].items[0]']);
  assert.deepEqual(pathsOf(q({cell: [0, 0], at: [0.5, 0.5]})), ['parts[0].items[0].at']);
  assert.deepEqual(pathsOf(q({at: [1.5, 0.5]})), ['parts[0].items[0].at[0]']);
  assert.deepEqual(pathsOf(q({at: ['a', 0.5]})), ['parts[0].items[0].at[0]']);
  assert.deepEqual(pathsOf(q({cell: [0, 4]})), ['parts[0].items[0].cell[1]']);
  assert.deepEqual(validateSpec(q({at: [0.25, 1]})), []);
  assert.deepEqual(pathsOf(spec({type: 'chevron', steps: [{label: 'a'}, {label: 'b'}], current: 3})), ['parts[0].current']);
  assert.deepEqual(pathsOf(spec({type: 'pyramid', layers: ['一']})), ['parts[0].layers']);
});

test('gantt dates are real days, ends follow starts, waits name tasks; a funnel with values has them all', () => {
  const g = (row: object, extra: object = {}) => spec({type: 'gantt', ...extra, rows: [{id: 'a', label: 'A', start: '2026-01-05', end: '2026-01-09'}, {label: 'B', ...row}]});
  assert.deepEqual(pathsOf(g({start: '2026-02-30', days: 3})), ['parts[0].rows[1].start']);
  assert.deepEqual(pathsOf(g({start: '2026-1-5', days: 3})), ['parts[0].rows[1].start']);
  assert.deepEqual(pathsOf(g({start: '2026-01-10', end: '2026-01-08'})), ['parts[0].rows[1].end']);
  assert.deepEqual(pathsOf(g({start: '2026-01-10', end: '2026-01-12', days: 2})), ['parts[0].rows[1].days']);
  assert.deepEqual(pathsOf(g({start: '2026-01-10'})), ['parts[0].rows[1]']);
  assert.deepEqual(pathsOf(g({start: '2026-01-10', days: 2, after: 'zz'})), ['parts[0].rows[1].after']);
  assert.deepEqual(pathsOf(g({start: '2026-01-10', days: 2, after: ['a', 'zz']})), ['parts[0].rows[1].after[1]']);
  assert.deepEqual(pathsOf(g({start: '2030-01-10', days: 2})), ['parts[0].rows']);
  assert.deepEqual(pathsOf(g({start: '2026-01-10', days: 2}, {today: 'tomorrow'})), ['parts[0].today']);
  assert.deepEqual(validateSpec(g({start: '2026-01-12', milestone: true, after: 'a'}, {today: '2026-01-07'})), []);
  assert.deepEqual(pathsOf(spec({type: 'funnel', scale: 'value', stages: [{label: 'a', value: 3}, {label: 'b'}]})), ['parts[0].stages[1].value']);
  assert.deepEqual(pathsOf(spec({type: 'venn', sets: [{name: 'A'}, {name: 'B'}], overlaps: [{sets: ['A', 'C'], label: 'x'}]})), ['parts[0].overlaps[0].sets[1]']);
  assert.deepEqual(pathsOf(spec({type: 'stateDiagram', initial: 'z', states: [{id: 'a', label: 'A'}], transitions: [{from: 'a', to: 'b'}]})), ['parts[0].transitions[0].to', 'parts[0].initial']);
});

test('a table and a why-why spec draw the same SVG as the DSL', async () => {
  const columns = [{label: '項目'}, {label: 'A 案', flex: 2}, {label: 'B 案', flex: 2}];
  const rows = [['費用', '100 万円', 80], {cells: ['期間', '3 か月', '5 か月'], tone: 'accent'}];
  const dsl = diagram({theme: 'blue', title: '例'}).add(table(columns as never, rows as never, {title: '比較', rowHeader: true}));
  assert.equal(await svgOf(specToDiagram(spec({type: 'table', columns, rows, title: '比較', rowHeader: true}))), await svgOf(dsl as unknown as Diagram));
  const whys = [{why: '修正に時間がかかった', because: [{why: '影響範囲が広かった', because: [{why: '検証が最後に集中していた', trueCause: true, measure: '結合テストを毎週回す'}]}]}];
  const dsl2 = diagram({theme: 'blue', title: '例'}).add(whyWhyTree('リリースが遅れた', whys as never));
  assert.equal(await svgOf(specToDiagram(spec({type: 'whyWhyTree', problem: 'リリースが遅れた', whys}))), await svgOf(dsl2 as unknown as Diagram));
});

test('tables, journeys and RACI charts must be as wide as their headings, and RACI letters are checked', () => {
  assert.deepEqual(pathsOf(spec({type: 'table', columns: [{label: 'a'}, {label: 'b'}], rows: [['1', '2'], ['1'], {cells: ['1', '2', '3']}]})), ['parts[0].rows[1]', 'parts[0].rows[2]']);
  assert.deepEqual(pathsOf(spec({type: 'table', columns: [{label: 'a'}], rows: [[{text: 'x'}]]})), ['parts[0].rows[0][0]']);
  assert.deepEqual(pathsOf(spec({type: 'table', columns: [{label: 'a'}], rows: ['x']})), ['parts[0].rows[0]']);
  assert.deepEqual(pathsOf(spec({type: 'journeyMap', stages: ['a', 'b'], lanes: [{id: 'x', label: 'X', cells: ['1']}, {id: 'emotion', label: 'F', cells: [0, 3]}]})), ['parts[0].lanes[0].cells', 'parts[0].lanes[1].cells[1]']);
  assert.deepEqual(pathsOf(spec({type: 'journeyMap', stages: ['a', 'b'], lanes: [{id: 'emotion', label: 'F', cells: [0, 'ok']}]})), ['parts[0].lanes[0].cells[1]']);
  assert.deepEqual(validateSpec(spec({type: 'journeyMap', stages: ['a', 'b'], lanes: [{id: 'score', label: 'S', cells: [10, 20]}]})), []); // numbers elsewhere are just numbers
  const r = (assignments: unknown[]) => spec({type: 'raci', tasks: ['t1', 't2'], roles: ['p', 'q'], assignments});
  assert.deepEqual(validateSpec(r([['A/R', 'C'], ['R', 'A']])), []);
  assert.deepEqual(pathsOf(r([['A/R', 'C'], ['C', 'A']])), ['parts[0].assignments[1]']);
  assert.deepEqual(pathsOf(r([['A/R', 'X'], ['A', 'R']])), ['parts[0].assignments[0][1]']);
  assert.deepEqual(pathsOf(r([['R', 'C'], ['A/R', 'A']])), ['parts[0].assignments[0]', 'parts[0].assignments[1]']);
  assert.deepEqual(pathsOf(r([['A/R', 'C']])), ['parts[0].assignments']);
});

test('a cloud needs all five boxes, and its assumptions name an arrow', () => {
  const five = {type: 'cloud', a: 'A', b: 'B', c: 'C', d: 'D', d2: 'E'};
  const {d2: _gone, ...four} = five;
  assert.deepEqual(pathsOf(spec(four)), ['parts[0].d2']);
  assert.deepEqual(pathsOf(spec({...five, assumptions: [{on: 'xx', text: '前提'}]})), ['parts[0].assumptions[0].on']);
  assert.deepEqual(validateSpec(spec({...five, assumptions: [{on: 'dd', text: '前提'}]})), []);
});

test('a value chain margin is a label or false, nothing else', () => {
  const chain = (margin: unknown) => spec({type: 'valueChain', primary: [{label: '製造'}], margin});
  assert.deepEqual(validateSpec(chain('利益')), []);
  assert.deepEqual(validateSpec(chain(false)), []);
  assert.deepEqual(pathsOf(chain(true)), ['parts[0].margin']);
  assert.deepEqual(pathsOf(chain(3)), ['parts[0].margin']);
  assert.deepEqual(pathsOf(spec({type: 'valueChain', primary: []})), ['parts[0].primary']);
});

test('a mind map is bounded in depth and in size', () => {
  const deep = (levels: number): object => levels === 0 ? {label: '葉'} : {label: '枝', children: [deep(levels - 1)]};
  assert.deepEqual(validateSpec(spec({type: 'mindmap', root: deep(MAX_TREE_DEPTH)})), []);
  assert.match(pathsOf(spec({type: 'mindmap', root: deep(MAX_TREE_DEPTH + 1)}))[0] ?? '', /children\[0\]\.children$/);
  const wide = {label: '根', children: Array.from({length: 12}, () => ({label: '枝', children: Array.from({length: 12}, () => ({label: '葉'}))}))};
  assert.deepEqual(pathsOf(spec({type: 'mindmap', root: wide})), ['parts[0].root']);
});

test('saying which tree it is turns on the checks for that tree', async () => {
  const nodes = [{id: 'a', label: '原因'}, {id: 'b', label: '結果'}], links = [{from: 'a', to: 'b'}];
  const plain = await renderSpec(spec({type: 'causeTree', nodes, links})), crt = await renderSpec(spec({type: 'causeTree', tree: 'crt', nodes, links}));
  assert.ok(crt.findings.some(f => f.rule?.startsWith('toc-')), JSON.stringify(crt.findings));
  assert.equal(plain.findings.some(f => f.rule?.startsWith('toc-')), false);
});

test('every example of the catalog is valid and draws without a problem', async () => {
  for (const {type, example} of partCatalog()) {
    assert.deepEqual(validateSpec(spec(example)), [], type);
    const r = await renderSpec(spec(example));
    assert.deepEqual(r.problems, [], type);
    assert.equal(r.ok, true, type);
    assert.match(r.svg ?? '', /^<svg\b/, type);
  }
});

test('a mistake is reported at its place', () => {
  assert.deepEqual(pathsOf({title: '例', parts: [flow]}), ['version']);
  assert.deepEqual(pathsOf(spec({...flow, extra: 1})), ['parts[0].extra']);
  assert.deepEqual(pathsOf(spec({type: 'wireframe'})), ['parts[0].type']);
  assert.deepEqual(pathsOf(spec({...flow, nodes: [{id: 'a', label: 3}, {id: 'b', label: '終'}]})), ['parts[0].nodes[0].label']);
  assert.deepEqual(pathsOf(spec({...flow, edges: [{from: 'a', to: 'z'}]})), ['parts[0].edges[0].to']);
  assert.deepEqual(pathsOf(spec({...flow, nodes: [{id: 'a', label: '一'}, {id: 'a', label: '二'}], edges: []})), ['parts[0].nodes[1].id']);
  assert.deepEqual(pathsOf(spec({type: 'sequence', actors: [{id: 'u', label: '人'}], steps: [{note: '注', over: ['x']}]})), ['parts[0].steps[0].over[0]']);
  assert.deepEqual(pathsOf(spec({type: 'sequence', actors: [{id: 'u', label: '人'}], steps: [{label: '形が無い'}]})), ['parts[0].steps[0]']);
  assert.deepEqual(pathsOf(spec({type: 'swimlane', lanes: [{id: 'l', label: '人'}], steps: [{id: 's', lane: 'l', title: '手順'}], flows: [{from: 'nope:right', to: 's'}]})), ['parts[0].flows[0].from']);
});

test('what the schema does not list is refused, and specToDiagram throws for it before any builder', () => {
  for (const bad of [{...spec(flow), sourceDir: '/etc'}, spec({type: 'image', src: '/etc/passwd'}), spec({type: 'raw', svg: '<script/>'})]) assert.throws(() => specToDiagram(bad), SpecError);
  // the features that read a file or need a dev server are not fields of a spec
  assert.deepEqual(pathsOf({...spec(flow), slide: 1}), ['slide']);
  assert.deepEqual(pathsOf({...spec(flow), fill: true}), ['fill']);
  assert.deepEqual(pathsOf({...spec(flow), sourceDir: '/etc'}), ['sourceDir']);
  assert.deepEqual(pathsOf(spec({type: 'image', src: '/etc/passwd'})), ['parts[0].type']);
  assert.deepEqual(pathsOf(spec({type: 'raw', svg: '<script/>'})), ['parts[0].type']);
  // JSON.parse makes these own keys; a lookup on a plain object would find Object.prototype's
  assert.deepEqual(pathsOf(JSON.parse('{"version":1,"title":"例","parts":[],"__proto__":{"x":1}}')), ['parts', '__proto__']);
  assert.deepEqual(pathsOf({...spec(flow), constructor: 'x'}), ['constructor']);
  assert.deepEqual(pathsOf(spec({type: 'constructor'})), ['parts[0].type']);
});

test('text cannot break out of the SVG, in any text field of any part', async () => {
  const x = '<script>a</script>"/><image href="x"/>&amp;';
  const specs = [
    spec({type: 'flowchart', nodes: [{id: x, label: x, sub: x}, {id: 'b', label: x, kind: 'decision'}], edges: [{from: x, to: 'b', label: x}], dir: 'right'}),
    spec({type: 'swimlane', lanes: [{id: x, label: x}, {id: 'l', label: x}], steps: [{id: 's', lane: x, title: x, body: x, note: x, tag: x}, {id: 't', lane: 'l', title: x, col: 2}], flows: [{from: 's', to: 't', label: x}], phases: [{label: x, from: 1, to: 2}], boundaries: [{after: x, label: x}]}),
    spec({type: 'sequence', actors: [{id: x, label: x}, {id: 'b', label: x}], steps: [{from: x, to: 'b', label: x}, {self: 'b', label: x}, {note: x, over: ['b']}, {divider: x}]}),
    {...spec(flow), title: x, desc: x, sourceLine: x, showTitle: true},
  ];
  let drawn = 0;
  for (const s of specs) {
    const r = await renderSpec(s);
    if (r.svg === null) continue; // too crowded to draw is fine; drawn wrong is not
    drawn++;
    assert.doesNotMatch(r.svg, /<script|<image/);
    assert.deepEqual(xmlProblems(r.svg), []);
  }
  assert.ok(drawn >= 2, 'at least some of these must have been drawn');
});

test('oversized input is refused before it is laid out', () => {
  const nodes = Array.from({length: 41}, (_, i) => ({id: `n${i}`, label: 'x'}));
  assert.deepEqual(pathsOf(spec({type: 'flowchart', nodes, edges: []})), ['parts[0].nodes']);
  assert.deepEqual(pathsOf(spec({...flow, nodes: [{id: 'a', label: 'あ'.repeat(121)}, {id: 'b', label: '終'}]})), ['parts[0].nodes[0].label']);
  assert.deepEqual(pathsOf(spec(...Array.from({length: 5}, () => flow))), ['parts']);
  const wide = (p: number) => ({type: 'sequence', actors: [{id: `u${p}`, label: '人'}], steps: Array.from({length: 50}, () => ({self: `u${p}`, label: 'あ'.repeat(120)}))});
  const issues = validateSpec(spec(wide(0), wide(1)));
  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.path, '');
  assert.match(issues[0]?.message ?? '', new RegExp(`limit is ${MAX_TOTAL_TEXT}`));
});

test('a flow end must be well-formed: no NaN reaches the drawing', async () => {
  const lane = (from: string, stepId = 's') => spec({type: 'swimlane', lanes: [{id: 'a', label: '人'}], steps: [{id: stepId, lane: 'a', title: '一'}, {id: 't', lane: 'a', title: '二'}], flows: [{from, to: 't'}]});
  for (const bad of ['s:right@x', 's:bogus', 's:right@9', 's:right@-1', 's:', ':right']) assert.deepEqual(pathsOf(lane(bad)), ['parts[0].flows[0].from'], bad);
  for (const good of ['s', 's:right', 's:right@0.5', 's:bottom@1', 's:center']) assert.deepEqual(validateSpec(lane(good)), [], good);
  assert.deepEqual(pathsOf(lane('a:b', 'a:b')).includes('parts[0].steps[0].id'), true);
  const r = await renderSpec(lane('s:right@0.5'));
  assert.doesNotMatch(r.svg ?? '', /NaN/);
});

test('a character that cannot be drawn is refused at its field, and renderSpec does not throw for it', async () => {
  const labelled = (label: string) => spec({...flow, nodes: [{id: 'a', label}, {id: 'b', label: '終'}]});
  for (const c of ['\u0001', '\n', '\ufffe', '\uffff', '\ud800']) {
    assert.deepEqual(pathsOf(labelled(`x${c}y`)), ['parts[0].nodes[0].label'], JSON.stringify(c));
    const r = await renderSpec(labelled(`x${c}y`));
    assert.equal(r.svg, null);
    assert.equal(r.issues[0]?.path, 'parts[0].nodes[0].label');
  }
  assert.deepEqual(validateSpec(labelled('絵文字 😀 も可')), []);
  const r = await renderSpec({...spec(flow), sourceLine: 'a\nb'});
  assert.equal(r.issues[0]?.path, 'sourceLine');
  assert.deepEqual(xmlProblems('<svg>\uffff</svg>').length, 1);
});

test('a figure that cannot be laid out comes back as an issue at its own part, not an exception', async () => {
  const seq = {type: 'sequence', actors: [{id: 'u', label: '人'}], steps: [{self: 'u', label: '確認'}]};
  const n = 40, wide = {type: 'flowchart', nodes: Array.from({length: n}, (_, i) => ({id: `n${i}`, label: '処理の内容を説明する文章です'})), edges: Array.from({length: 60}, (_, i) => ({from: `n${i % n}`, to: `n${(i * 7 + 3) % n}`}))};
  const r = await renderSpec(spec(seq, wide));
  assert.equal(r.ok, false);
  assert.equal(r.svg, null);
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0]?.path, 'parts[1]');
  assert.match(r.issues[0]?.message ?? '', /flowchart\(\).*does not fit/s);
});

test('a swimlane stays within the columns it has room for, and says so before layout', () => {
  const steps = (n: number) => Array.from({length: n}, (_, i) => ({id: `s${i}`, lane: 'a', title: '手順'}));
  const lane = (s: unknown[]) => spec({type: 'swimlane', lanes: [{id: 'a', label: '人'}], steps: s});
  assert.deepEqual(validateSpec(lane(steps(MAX_SWIMLANE_COLS))), []);
  assert.deepEqual(pathsOf(lane(steps(MAX_SWIMLANE_COLS + 1))), ['parts[0].steps']);
  assert.deepEqual(pathsOf(lane([{id: 's', lane: 'a', title: '手順', col: MAX_SWIMLANE_COLS + 1}])), ['parts[0].steps[0].col']);
  assert.match(validateSpec(lane(steps(12)))[0]?.message ?? '', /same col/);
});

test('boundaries are checked against the lane order, at the boundary', () => {
  const lane = (boundaries: unknown[]) => spec({type: 'swimlane', lanes: [{id: 'a', label: '一'}, {id: 'b', label: '二'}, {id: 'c', label: '三'}], steps: [{id: 's', lane: 'a', title: '手順'}], boundaries});
  assert.deepEqual(pathsOf(lane([{between: ['a', 'c']}])), ['parts[0].boundaries[0].between']);
  assert.deepEqual(pathsOf(lane([{between: ['b', 'a']}])), ['parts[0].boundaries[0].between']);
  assert.deepEqual(pathsOf(lane([{after: 'c'}])), ['parts[0].boundaries[0].after']);
  assert.deepEqual(validateSpec(lane([{between: ['a', 'b']}, {after: 'b'}])), []);
});

test('a spec with too many emoji is refused: they are what makes a picture slow', () => {
  const emoji = (n: number) => spec({...flow, nodes: [{id: 'a', label: '😀'.repeat(n)}, {id: 'b', label: '終'}]});
  assert.deepEqual(validateSpec(emoji(MAX_EMOJI)), []);
  const issues = validateSpec(emoji(MAX_EMOJI + 1));
  assert.equal(issues.length, 1);
  assert.match(issues[0]?.message ?? '', /emoji/);
});

test('emoji are counted the way the emitter draws them', () => {
  const skin = '\u{1f3fb}'; // a skin-tone modifier: in the emitter's range, and not counted by Extended_Pictographic
  const emoji = (n: number) => spec({...flow, nodes: [{id: 'a', label: skin.repeat(n)}, {id: 'b', label: '終'}]});
  assert.deepEqual(validateSpec(emoji(MAX_EMOJI)), []);
  assert.match(validateSpec(emoji(MAX_EMOJI + 1))[0]?.message ?? '', /emoji/);
});

test('a message quotes at most a short piece of the input', () => {
  const huge = 'x'.repeat(5_000_000);
  for (const bad of [spec({type: huge}), {...spec(flow), [huge]: 1}, {...spec(flow), version: huge}]) {
    const size = JSON.stringify(validateSpec(bad)).length;
    assert.ok(size < 2000, `${size} characters`);
  }
});

test('fieldsHolding, capped and cappedMessages', () => {
  assert.deepEqual(fieldsHolding({...spec(flow), sourceLine: '開始の出典'}, '開'), ['parts[0].nodes[0].label', 'sourceLine']);
  assert.equal(capped(Array.from({length: 30}, () => ({path: '', message: 'm'}))).length, MAX_ISSUES + 1);
  assert.equal(cappedMessages(Array.from({length: 30}, () => ({path: null, message: 'm'}))).length, MAX_ISSUES + 1);
});

test('layoutIssue puts a layout message in the fields of a spec', () => {
  assert.deepEqual(layoutIssue(spec(flow), 'swimlane(): 8 columns leave only 9px each — widen the diagram, shrink labelW, or use fewer columns'), {path: 'parts[0]', message: 'swimlane(): 8 columns leave only 9px each. Lower colGap or use fewer columns.'});
});

test('the list of issues is bounded, however bad the spec', () => {
  const many = {...spec(flow), ...Object.fromEntries(Array.from({length: 25_000}, (_, i) => [`k${i}`, 1]))};
  const issues = validateSpec(many);
  assert.equal(issues.length, MAX_ISSUES + 1);
  assert.match(issues[MAX_ISSUES]?.message ?? '', /24980 more/);
});

test('a label with no room is reported at its flow, with advice in the fields of a spec', async () => {
  const r = await renderSpec(spec({type: 'swimlane', lanes: [{id: 'a', label: '人'}], steps: [{id: 's', lane: 'a', title: '申請する', col: 1}, {id: 't', lane: 'a', title: '確認する', col: 2}], flows: [{from: 's', to: 't', label: '承認された'}]}));
  assert.equal(r.ok, false);
  const p = r.problems[0];
  assert.equal(p?.path, 'parts[0].flows[0].label');
  assert.doesNotMatch(p?.message ?? '', /route|elbow/);
  assert.match(p?.fix ?? '', /colGap/);
});

test('colGap makes room for a short label between neighbouring columns', async () => {
  const lane = (extra: object) => spec({type: 'swimlane', lanes: [{id: 'a', label: '人'}], steps: [{id: 's', lane: 'a', title: '申請する', col: 1}, {id: 't', lane: 'a', title: '確認する', col: 2}], flows: [{from: 's', to: 't', label: '可'}], ...extra});
  assert.equal((await renderSpec(lane({}))).ok, false);
  assert.equal((await renderSpec(lane({colGap: 48}))).ok, true);
});

test('a step id with a flow-end character is refused', () => {
  assert.deepEqual(pathsOf(spec({type: 'swimlane', lanes: [{id: 'a', label: '人'}], steps: [{id: 'x@y', lane: 'a', title: '手順'}]})), ['parts[0].steps[0].id']);
});

test('a figure taller than the limit is refused, whatever the schema allowed', async () => {
  const r = await renderSpec(spec(flow), {maxHeight: 50});
  assert.equal(r.svg, null);
  assert.match(r.issues[0]?.message ?? '', /limit is 50px/);
});

test('svgToPng refuses a scale or a size that would allocate too much, before allocating', async () => {
  const small = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>';
  for (const scale of [0, -1, 4.5, Number.NaN]) await assert.rejects(svgToPng(small, {scale}), RangeError, String(scale));
  const side = Math.ceil(Math.sqrt(MAX_PNG_PIXELS)) + 1;
  await assert.rejects(svgToPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}"/>`), RangeError);
  // sizes that look small, or are not what a simple reader finds first
  for (const root of ['<svg width="3e4" height="3e4" viewBox="0 0 1 1"/>', '<svg width="300in" height="300in"/>', '<!-- <svg width="1" height="1"> --><svg width="3e4" height="3e4"/>', '<svg viewBox="0 0 30000 30000"/>', '<!DOCTYPE svg><svg width="1" height="1"/>']) await assert.rejects(svgToPng(root), RangeError, root);
});

test('a machine failure throws, instead of telling the caller to change the spec', async () => {
  await assert.rejects(renderSpec(spec(flow), {config: {measure: 'font', fonts: {sans: {regular: '/nonexistent.ttf', bold: '/nonexistent.ttf'}}}}));
});

test('renderSpec leaves the process-wide measuring settings alone', async () => {
  const before = currentMeasure();
  await renderSpec(spec(flow), {config: {measure: 'font'}});
  assert.deepEqual(currentMeasure(), before);
});

test('the same ids in two parts, phases past the columns, and a message to oneself are caught by validateSpec', () => {
  assert.deepEqual(pathsOf(spec(flow, flow)), ['parts[1].nodes[0].id', 'parts[1].nodes[1].id']);
  const lane = (phases: unknown[]) => spec({type: 'swimlane', lanes: [{id: 'a', label: '人'}], steps: [{id: 's', lane: 'a', title: '一'}, {id: 't', lane: 'a', title: '二'}], phases});
  assert.deepEqual(pathsOf(lane([{label: '期', from: 2, to: 1}])), ['parts[0].phases[0].to']);
  assert.deepEqual(pathsOf(lane([{label: '期', from: 1, to: 9}])), ['parts[0].phases[0].to']);
  assert.deepEqual(validateSpec(lane([{label: '期', from: 1, to: 2}])), []);
  assert.deepEqual(pathsOf(spec({type: 'sequence', actors: [{id: 'u', label: '人'}], steps: [{from: 'u', to: 'u', label: '自分へ'}]})), ['parts[0].steps[0].to']);
});

test('lanes and actors may repeat between parts: only anchors must be unique', async () => {
  const lane = (s: string) => ({type: 'swimlane', lanes: [{id: 'a', label: '人'}], steps: [{id: s, lane: 'a', title: '手順'}]});
  const seq = {type: 'sequence', actors: [{id: 'a', label: '人'}], steps: [{self: 'a', label: '確認'}]};
  const r = await renderSpec(spec(lane('s1'), lane('s2'), seq, seq));
  assert.deepEqual(r.issues, []);
  assert.equal(r.ok, true);
});

test('the width memo stops growing at its limit', async () => {
  await measureAtoms(Array.from({length: MEMO_LIMIT + 50}, (_, i) => `memo-${i}`), {size: 14});
  assert.equal(measureMemoSize(), MEMO_LIMIT);
});

test('a finding names the place of the text it is about', async () => {
  // the arrow labels of this figure sit a few pixels past the diamond: an advisory that does not fail it
  const r = await renderSpec(spec(partCatalog().find(p => p.type === 'flowchart')?.example));
  assert.equal(r.ok, true);
  const yes = r.findings.find(f => f.message.includes('"Yes"'));
  assert.equal(yes?.path, 'parts[0].edges[1].label');
});

test('locateMessage reads only quoted text, and says nothing when the text is ambiguous', () => {
  const one = spec(flow), two = spec(flow, {type: 'sequence', actors: [{id: 'user', label: '利用者さん'}], steps: [{self: 'user', label: '確認の処理を実行する'}]});
  assert.equal(locateMessage(two, 'box "利用者さん" is too wide'), 'parts[1].actors[0].label');
  assert.equal(locateMessage(two, '判断「user」から'), 'parts[1].actors[0].id');
  assert.equal(locateMessage(two, 'nothing here is named'), null);
  assert.equal(locateMessage(two, 'user is a word of the message, not a mention'), null);
  assert.equal(locateMessage(two, 'text out of its box: "確認の処理を実…"'), 'parts[1].steps[0].label'); // shortened by the check
  assert.equal(locateMessage(two, 'text out of its box: "処理を"'), 'parts[1].steps[0].label'); // one wrapped line
  assert.equal(locateMessage(one, 'nothing here is named'), 'parts[0]');
  // the same label on two arrows of one part: the part, not the first arrow
  const yes = spec({...flow, edges: [{from: 'a', to: 'b', label: 'Yes'}, {from: 'b', to: 'a', label: 'Yes'}]}, flow);
  assert.equal(locateMessage(yes, 'text "Yes"'), 'parts[0]');
  // the message's own quoted words first, an id later
  assert.equal(locateMessage(two, '「Yes / No」と "利用者さん"'), 'parts[1].actors[0].label');
});

test('locateVerdict keeps each message, its rule and its fix, and adds the place', () => {
  const v = {ok: false, problems: ['"開始" overflows'], warnings: [], findings: [{rule: 'r', severity: 'warn' as const, message: '"終了" is far', data: {measured: 1, threshold: 0, fix: 'move it'}}]};
  assert.deepEqual(locateVerdict(spec(flow), v), {
    problems: [{path: 'parts[0].nodes[0].label', message: '"開始" overflows', severity: 'problem'}],
    findings: [{path: 'parts[0].nodes[1].label', message: '"終了" is far', rule: 'r', severity: 'warn', fix: 'move it'}],
  });
});

test('lintMessages separates what fails the lint from what it only advises', () => {
  const {errors, advisories} = lintMessages({
    contrast: [{txt: 'a', delta: 1, fg: '#fff', bg: '#fff'}], overflow: {dx: 2, dy: 0}, textOverlap: [{a: 'x', b: 'y', ratio: 0.5}],
    containerOverflow: [{txt: 'b', over: 4}], covered: [{txt: 'c', by: 'rect', how: 'crosses'}],
  });
  assert.deepEqual(errors, ['low contrast: "a" (#fff on #fff)', 'content runs past the canvas by 2px horizontally and 0px vertically', 'text over text: "x" and "y"']);
  assert.deepEqual(advisories, ['text out of its box by 4px: "b"', '"c" is crossed by rect']);
});

test('figures drawn at the same time come out as when drawn one by one', async () => {
  const specs = partCatalog().map(p => spec(p.example));
  const config = {measure: 'font'} as const;
  const alone: (string | null)[] = [];
  for (const s of specs) alone.push((await renderSpec(s, {config})).svg);
  const together = await Promise.all([...specs, ...specs].map(s => renderSpec(s, {config})));
  assert.deepEqual(together.map(r => r.svg), [...alone, ...alone]);
});

test('lintRendering and svgToPng work on a string, without a file', async () => {
  const r = await renderSpec(spec(flow));
  assert.ok(r.svg);
  const checks = lintRendering(r.svg);
  assert.deepEqual(checks?.contrast, []);
  assert.equal(checks?.overflow, null);
  const {png, width} = await svgToPng(r.svg, {scale: 2});
  assert.equal(width, r.width * 2);
  assert.deepEqual([...png.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
});

test('the spec entry reaches no node: module, directly or through what it imports', async () => {
  const out = await bundle({entryPoints: [path.join(ROOT, 'lib/spec.ts')], bundle: true, write: false, metafile: true, format: 'esm', platform: 'browser', logLevel: 'silent'});
  const imports = Object.values(out.metafile.outputs).flatMap(o => o.imports.map(i => i.path));
  assert.deepEqual(imports.filter(i => i.startsWith('node:')), []);
});

// A new builder must be decided on: add it to lib/spec.ts, or say here that specs do not have it yet.
const IN_NO_SPEC_YET = new Set(['analyzeCausalLoops', 'analyzeCriticalPath', 'arrowDiagram', 'banner', 'barplot', 'box', 'bracket', 'branch', 'callout', 'canvas', 'caption', 'catplot', 'cell', 'clustermap', 'compare', 'connect', 'curve', 'diagram', 'displot', 'dots', 'ecdfplot', 'emblem', 'facet', 'fillScaleLimit', 'grid', 'group', 'hero', 'hist2d', 'histplot', 'iconRow', 'isIsNotTests', 'isType', 'jointplot', 'kde2d', 'kdeplot', 'legend', 'node', 'pairplot', 'people', 'plane', 'pointplot', 'raw', 'regplot', 'residplot', 'rewrite', 'row', 'rugplot', 'screens', 'spacer', 'stat', 'stateMatrix', 'stateRow', 'stripplot', 'styled', 'swarmplot', 'tally', 'transitionUnits', 'violinplot', 'when', 'wireframe', 'within', 'wordart', 'xbarR']);

test('every builder is either in the spec or listed as not in it yet', () => {
  const inSpec = new Set(partCatalog().map(p => p.type));
  const builders = Object.entries(pure).filter(([, v]) => typeof v === 'function').map(([k]) => k);
  assert.deepEqual(builders.filter(b => !inSpec.has(b) && !IN_NO_SPEC_YET.has(b)), [], 'decide these in lib/spec.ts or IN_NO_SPEC_YET');
  assert.deepEqual([...inSpec].filter(t => IN_NO_SPEC_YET.has(t)), []);
});

test('the schema is plain JSON', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(specSchema)), specSchema);
});
