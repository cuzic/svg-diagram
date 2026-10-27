// The page script of test/web-entry.test.ts: the four figures a web page draws (swimlane, causeTree as CRT and as FRT, cloud) through
// the browser entry, measured on a canvas. Bundled for the browser with esbuild (no alias, no stub) and run in Chromium.
import {FONT_STACKS} from '../../lib/tokens.ts';
import {causeTree, cloud, diagram, gantt, renderInBrowser, svgMeasurer, swimlane} from '../../lib/web.ts';

const figures = {
  swimlane: () => diagram({theme: 'blue', title: '受注の流れ'}).add(swimlane(
    [{id: 'sales', label: '営業'}, {id: 'plan', label: '生産管理'}],
    [{id: 'a', lane: 'sales', title: '受注する', col: 1}, {id: 'b', lane: 'plan', title: '日程を組む', col: 2}, {id: 'c', lane: 'sales', title: '納期を伝える', col: 3}],
    {flows: [{from: 'a', to: 'b'}, {from: 'b', to: 'c'}]})),
  crt: () => diagram({theme: 'blue', title: '納期遅れの現状ツリー'}).add(causeTree(
    [{id: 'late', label: '納期に遅れる', role: 'ude'}, {id: 'cost', label: '残業費が膨らむ', role: 'ude'}, {id: 'switch', label: '作業の切り替えが多い'},
     {id: 'rush', label: '急ぎの割り込みが入る'}, {id: 'wip', label: '仕掛りが多い'}, {id: 'kpi', label: '稼働率で評価される', role: 'root'}],
    [{from: 'kpi', to: 'wip'}, {from: 'wip', to: 'switch'}, {from: 'wip', to: 'rush'}, {from: 'switch', to: 'late'}, {from: ['switch', 'rush'], to: 'cost'}],
    {maxNodeW: 170})),
  frt: () => diagram({theme: 'blue', title: '未来現実ツリー', legend: 'auto'}).add(causeTree(
    [{id: 'de', label: '納期を守れる', role: 'de'}, {id: 'wip', label: '仕掛りが減る'}, {id: 'focus', label: '1 つずつ仕上げる'},
     {id: 'cap', label: '着手の枠を決める', role: 'injection'}, {id: 'fact', label: '受注の量は変えられない', role: 'precondition'}],
    [{from: 'cap', to: 'wip'}, {from: 'wip', to: 'focus'}, {from: ['fact', 'cap'], to: 'focus'}, {from: 'focus', to: 'de'}],
    {tree: 'frt'})),
  gantt: () => diagram({theme: 'blue', title: '工程'}).add(gantt([{label: '設計', start: '2026-10-19', end: '2026-10-30'}, {label: '実装', start: '2026-10-26', end: '2026-11-13'}], {today: 'auto'})),
  cloud: () => diagram({theme: 'blue', title: '品質とスピードのクラウド'}).add(cloud(
    {a: '製品を成功させる', b: '品質を確保する', c: '市場機会を逃さない', d: '検証に時間をかける', d2: '早くリリースする'},
    {assumptions: [{on: 'bd', text: '品質確保には長い検証期間が必須だ', injection: '自動テストで検証を短くする'}]})),
};

(globalThis as any).drawAll = async () => {
  const measure = svgMeasurer();
  const out: Record<string, {ok: boolean; xml: string[]; svg: number; verdict: unknown}> = {};
  for (const [name, make] of Object.entries(figures)) {
    const r = await renderInBrowser(make(), {measure, today: '2026-10-27'});
    out[name] = {ok: r.verdict.ok, xml: r.xml, svg: r.svg.length, verdict: r.verdict.ok ? null : r.verdict};
  }
  return out;
};

/** What svgMeasurer returns for a run, and the box of the same run drawn as a visible <text> in a normal SVG (the figure's own way of showing it). */
(globalThis as any).bboxOf = (text: string, size: number, weight: number, font: 'sans' | 'mono' | 'emoji') => {
  const m = svgMeasurer();
  const via = m({text, size, weight, font});
  m.dispose();
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', '800'); svg.setAttribute('height', '200');
  const t = document.createElementNS(NS, 'text');
  t.setAttribute('xml:space', 'preserve'); t.setAttribute('x', '0'); t.setAttribute('y', '100');
  t.setAttribute('font-family', FONT_STACKS[font]); t.setAttribute('font-size', String(size)); t.setAttribute('font-weight', String(weight));
  t.textContent = text;
  svg.appendChild(t); document.body.appendChild(svg);
  const b = (t as unknown as SVGGraphicsElement).getBBox();
  svg.remove();
  return {via, drawn: {w: b.width, h: b.height}};
};
