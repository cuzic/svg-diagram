// Rule inputs reused from their behavioral tests, and focused inputs for the remaining producers.
import {
  bars, bowtie, box, canvas, comic, caption, causeTree, concentric, connect, diagram, em,
  faultTree, flowchart, funnel, isIsNot, isIsNotTests, legend, quadrant, raci, row, stat,
  stateMatrix, swimlane, table, wf, whyWhyTree, wireframe,
} from '../../lib/dsl-pure.ts';
import {image} from '../../lib/dsl.ts';
import type {BandInput, ConnectBand, DiagramOpts, LaidOutBand, LaidOutConnect, LintTarget, Point, RuleId} from '../../lib/types/index.ts';
import type {CauseLink, CauseNode, CauseOpts} from '../../lib/types/diagrams.ts';

const figure = (parts: BandInput[], opts: Omit<DiagramOpts, 'fill'> = {}) =>
  diagram({theme: 'blue', title: '図', legend: false, ...opts}).add(...parts as never[]);
const N = (id: string, role?: CauseNode['role'], label = id): CauseNode => ({id, label, role});
const tree = (kind: NonNullable<CauseOpts['tree']>, nodes: CauseNode[], links: CauseLink[]) =>
  causeTree(nodes, links, {tree: kind});

interface Case {
  rules: RuleId[];
  input: LintTarget;
  layout?: true;
}

export function ruleLocationFixtures(): Case[] {
  const cases: Case[] = [];
  const add = (rules: RuleId[], parts: BandInput[], opts?: Omit<DiagramOpts, 'fill'>, layout?: true) => {
    cases.push({rules, input: figure(parts, opts), layout});
  };

  // toc-rules.test.ts: lint the cause bands without layout, as the TOC predicates read their authored nodes and links.
  add(['toc-parts', 'toc-orphan', 'toc-cycle-undeclared'], [tree('crt',
    [N('a'), N('b'), N('c', 'ude'), N('orphan')], [{from: 'a', to: 'b'}, {from: 'b', to: 'c'}, {from: 'c', to: 'a'}])]);
  add(['toc-chain-only', 'toc-source-has-cause'], [tree('crt',
    [N('a'), N('b', 'root'), N('c', 'ude')], [{from: 'a', to: 'b'}, {from: 'b', to: 'c'}])]);
  add(['toc-no-desired-result', 'toc-injection-to-obstacle'], [tree('frt',
    [N('i', 'injection'), N('o', 'obstacle')], [{from: 'i', to: 'o'}])]);
  add(['toc-nbr-parts', 'toc-nbr-no-tipping'], [tree('nbr',
    [N('i', 'injection'), N('b', 'ude')], [{from: 'i', to: 'b'}])]);
  add(['toc-nbr-tipping-not-and', 'toc-nbr-trim-too-late'], [tree('nbr',
    [N('i', 'injection'), N('t', 'tipping'), N('b', 'ude'), N('x', 'trim')],
    [{from: 'i', to: 't'}, {from: 't', to: 'b'}, {from: 'x', to: 'b', kind: 'blocks'}])]);
  add(['toc-tt-unit'], [tree('tt',
    [N('x', 'precondition'), N('n', 'need'), N('r', 'io')], [{from: ['x', 'n'], to: 'r'}])]);
  add(['toc-prt-bottom-not-action', 'toc-prt-one-to-one', 'toc-obstacle-phrase'], [tree('prt',
    [N('g', 'goal'), N('i1', 'io'), N('i2', 'io'), N('o1', 'obstacle', '時間がない'), N('o2', 'obstacle')],
    [{from: 'o1', to: 'i1'}, {from: 'o2', to: 'i2'}, {from: 'i1', to: 'g'}, {from: 'i2', to: 'g'}])]);
  const crt = tree('crt', [N('c', 'root'), N('u1', 'ude'), N('u2', 'ude')], [{from: 'c', to: 'u1'}, {from: 'c', to: 'u2'}]);
  add(['toc-mirror'], [causeTree([N('i', 'injection'), {...N('d', 'de'), mirrors: 'u1'}],
    [{from: 'i', to: 'd'}], {tree: 'frt', mirrors: crt})]);

  add(['fta-gate-one-input', 'fta-vote-degenerate', 'fta-top-is-leaf'], [
    faultTree({label: 'A', gate: 'and', children: [{label: 'B', kind: 'basic'}]}),
    faultTree({label: 'Vote', gate: 'vote', k: 1, children: [{label: 'B', kind: 'basic'}, {label: 'C', kind: 'basic'}]}),
    faultTree({label: 'D', kind: 'basic'}),
  ]);
  const isIsNotRows = [{dim: 'what', is: 'a', isNot: ''}];
  add(['isisnot-no-isnot', 'isisnot-no-distinct-at-all', 'isisnot-no-hypothesis-stands'], [
    isIsNot(isIsNotRows), isIsNotTests(isIsNotRows, [{text: '仮説', results: ['no']}]),
  ]);
  add(['whywhy-no-root', 'whywhy-measure-without-root', 'whywhy-single-chain', 'whywhy-dig-below-root'], [
    whyWhyTree('問題 A', [{why: 'a', measure: '周知'}]),
    whyWhyTree('問題 B', [{why: 'a', trueCause: true, because: [{why: 'b', trueCause: true}]}]),
  ]);
  // comic-rules.test.ts: the line-break advice of a comic's bubbles comes from the layout, so the input is laid out.
  add(['comic-bubble-wide', 'comic-orphan-line', 'comic-follower-split'], [comic({version: 1, title: '図', layout: '1x2', cast: {me: {name: '私'}}, panels: [
    {id: 'p1', stage: [{who: 'me', at: 'left', expression: 'neutral'}], dialogue: [
      {id: 'd1', who: 'me', kind: 'say', tpl: 'Internationalization-supportあ'},
      {id: 'd2', who: 'me', kind: 'say', tpl: '{a}なの？ご確認ください', slots: {a: {max: 8, prompt: '何か'}}}]},
    {id: 'p2', stage: [], dialogue: []}]}, {aspect: '1:1'})], {width: 480}, true);
  add(['bowtie-barrier-missing'], [bowtie({top: '頂上', threats: [{label: '脅威'}], consequences: [{label: '結果'}]})]);
  add(['term-variant', 'term-avoid', 'table-sum-mismatch', 'table-share-not-100', 'rowheader-tone-collides', 'semantic-table-warning'], [
    box({title: 'ユーザと担当者'}), box({title: 'ユーザー'}),
    table([{label: '部門'}, {label: '件数'}], [{cells: ['営業', '10'], tone: 'accent'}, ['合計', '20']], {rowHeader: true}),
    table([{label: '区分'}, {label: '構成比'}], [['A', '50%'], ['B', '30%']]),
    raci(['設計'], ['担当', '責任者', '監査'], [['R', 'A', '']]),
  ], {terms: {'責任者': ['担当者']}}, true);
  add(['canvas-region-empty'], [canvas('swot', {strengths: ['a'], weaknesses: ['b']}, {requireAll: true})]);
  add(['cjk-line-long', 'box-size-ignored', 'stat-no-source', 'draft-status', 'doc-width'], [
    caption('見出し'.repeat(16), {role: 'title'}), row([box({title: 'A', size: 24}), box({title: 'B'})]), stat(10, '件'),
  ], {status: 'draft', width: 1000, evidenceCheck: 'info'});
  add(['legend-incomplete'], [
    box({title: '新規', tone: 'new'}), legend([{tone: 'danger', label: '注意'}]),
  ], {legend: undefined});
  add(['a11y-no-title', 'bars-values-hidden', 'bars-thin-bar'], [
    bars([{label: 'a', value: 0.5}, {label: 'b', value: 100}], {dir: 'v', labels: 'none', axis: false, height: 60}),
  ], {title: undefined}, true);
  add(['a11y-text-contrast', 'a11y-nontext-contrast', 'a11y-color-only-emphasis', 'glyph-missing'], [
    row([box({title: '確認 ✅', body: [em.danger('注意')], tone: 'accent'}), box({title: '第二'})]),
  ], {tones: {accent: {fill: '#303030', stroke: '#303030'}}}, true);
  add(['source-wraps'], [box({title: '本文'})], {
    sourceLine: '出典: ' + '総務省統計局の労働力調査と厚生労働省の毎月勤労統計調査をもとに筆者が集計した'.repeat(2),
  }, true);
  add(['chart-axis-mismatch'], [6, 10].map(max => bars([{label: 'x', value: 5}], {unit: '件', dir: 'h', max})));
  add(['text-mid-word-break'], [causeTree(
    [{id: 'a', label: 'コンテキストスイッチングの増加'}, {id: 'b', label: 'リフレッシュ遅延'}],
    [{from: 'a', to: 'b'}], {maxNodeW: 80},
  )], {}, true);
  add(['shrink-narrow-text'], [swimlane([{id: 'l', label: '担当'}],
    Array.from({length: 11}, (_, i) => ({id: `s${i}`, lane: 'l', col: i + 1, title: '在庫を確認する'})),
    {fit: 'shrink'},
  )], {}, true);
  add(['swimlane-lanes', 'one-story'], [
    swimlane(Array.from({length: 7}, (_, i) => ({id: `lane${i}`, label: `役割${i}`})), [{lane: 'lane0', title: '作業'}]),
    swimlane([{id: 'a', label: '担当'}], [{lane: 'a', title: '別の作業'}]),
  ]);
  add(['swimlane-lane-order'], [swimlane(
    [{id: 'x', label: 'X'}, {id: 'y', label: 'Y'}, {id: 'z', label: 'Z'}, {id: 'end', label: 'END', fixed: true}],
    [{id: 's1', lane: 'x', title: 's1'}, {id: 's2', lane: 'z', title: 's2'}, {id: 's3', lane: 'y', title: 's3'}, {id: 's4', lane: 'end', title: 's4'}],
    {flows: [{from: 's1', to: 's2'}, {from: 's2', to: 's3'}, {from: 's3', to: 's4'}]},
  )], {}, true);
  const axes = {x: {title: 'x'}, y: {title: 'y'}};
  add(['quadrant-item-moved', 'quadrant-size-floor', 'quadrant-empty-cell', 'quadrant-tone-only'], [
    quadrant({...axes, items: [
      ...Array.from({length: 6}, (_, i) => ({label: `長い名前の項目${i}`, at: [0.35, 0.35] as [number, number], size: 1000, tone: 'danger' as const})),
      {label: 'tiny', at: [0.8, 0.8], size: 1, tone: 'muted'},
    ]}),
  ], {}, true);
  add(['flowchart-decision-edges'], [flowchart([{id: 'a', label: '確認', kind: 'decision'}, {id: 'b', label: '次'}],
    [{from: 'a', to: 'b'}])], {}, true);
  add(['concentric-label-crossing'], [concentric(['Adopt', 'Trial', 'Assess', 'Hold'].map(label => ({label})), {
    order: 'inner-first', sectors: ['仕事・学び', '人間関係', '成長・健康', '余暇'].map(label => ({label})),
    marks: ['Cloudflare Workers', 'Amazon Web Services'].map(label => ({label, sector: 1, ring: 1})),
  })], {}, true);
  add(['density', 'slide-canvas-overflow'], Array.from({length: 32}, (_, i) => box({title: `項目${i}`, body: '説明'})),
    {canvas: 'slide'}, true);
  add(['funnel-values-rise'], [funnel([{label: 'A', value: 1}, {label: 'B', value: 2}], {scale: 'value'})]);

  add(['wf-callout-no-note', 'wf-note-no-callout', 'wf-callout-gap', 'wf-callout-duplicate', 'wf-callout-order'], [
    wireframe(wf.col([wf.btn('a', {n: 4, h: 80}), wf.btn('b', {n: 2, h: 80}), wf.btn('c', {n: 2, h: 80})]),
      {notes: [{n: 1, title: 'a', text: 'x'}]}),
  ], {}, true);
  const matrix = stateMatrix(['通常', '空'], [{label: '一覧', cells: [wf.text('x'), undefined]}]);
  // The lint rule guards malformed matrix data before layout validates width.
  cases.push({rules: ['wf-states-todo', 'wf-states-required', 'wf-states-ragged'], input: figure([
    {...matrix, matrix: {...matrix.matrix!, required: ['読み込み中'], rows: [
      ...matrix.matrix!.rows, {label: 'カード', cells: ['na', 'na', 'na']},
    ]}},
  ])});

  // Laid-out fixtures follow the public lint target shape, as in slide-canvas, rules and layout-metrics tests.
  const slideBox = box({title: '小さい文字'});
  const small = {...slideBox, x: 20, y: 20, w: 200, h: 60, wrappedRuns: [{text: '小さい文字', lines: ['小さい文字'], size: 12}]} as LaidOutBand;
  cases.push({rules: ['slide-min-text'], input: {...figure([slideBox], {canvas: 'slide'}), laidOut: [small]}});
  cases.push({rules: ['font-floor-lowered'], input: {...figure([slideBox], {canvas: {minText: 10}}), laidOut: [small]}});
  const a = connect('a', 'b'), b = connect('c', 'd');
  const resolved = (band: ConnectBand, from: Point, to: Point): LaidOutConnect => ({
    ...band, from, to, fromId: band.from, toId: band.to, fromLabel: band.from, toLabel: band.to,
    pathSegments: [], points: [from, to],
  });
  const connects = [resolved(a, {x: 0, y: 50}, {x: 100, y: 50}), resolved(b, {x: 50, y: 0}, {x: 50, y: 100})];
  cases.push({rules: ['edge-crossings'], input: {...figure([a, b]), connects}});
  const frame = (x: number, y: number, align: 'left' | 'center' = 'left') =>
    ({...box({title: '箱', align}), x, y, w: 100, h: 60, wrappedRuns: []}) as LaidOutBand;
  cases.push({rules: ['layout-gutter-uneven', 'layout-edge-misalign', 'layout-align-mixed'], input: {
    ...figure([]), laidOut: [frame(20, 20), frame(128, 20, 'center'), frame(232, 20), frame(24, 96)],
  }});
  const cause = causeTree([N('a'), N('b')], [{from: 'a', to: 'b'}]);
  const shaped = {
    ...cause, lineScaleDropped: true, densityRestored: true,
    edges: [{from: 'a', to: 'b', points: Array.from({length: 7}, (_, i) => ({x: Math.floor(i / 2) * 10, y: Math.ceil(i / 2) * 10}))}],
  } as unknown as LaidOutBand;
  cases.push({rules: ['edge-bends', 'cause-line-scale-dropped', 'density-compact-restored'],
    input: {...figure([cause]), laidOut: [shaped]}});
  cases.push({rules: ['wrap-fell-back'], input: {...figure([box({title: '本文'})]), wrapFellBack: true}});
  const picture = image(new URL('../../examples/assets/kitchen.png', import.meta.url), {alt: '写真'});
  add(['image-large'], [{...picture, bytes: 400 * 1024}]);

  return cases;
}
