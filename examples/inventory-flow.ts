// 架空の在庫管理アプリの画面遷移（screens() + connect() の使用例）。
// ビルド: svg-diagram build examples/inventory-flow.ts --out examples/out/inventory-flow.svg
import {diagram, caption, screens, wf, connect} from 'svg-diagram';

const bar = (name: string, active: number) => wf.appbar(name, {nav: ['ダッシュボード', '在庫', '発注'], active});

export default function define() {
  const d = diagram({theme: 'blue', title: '在庫管理アプリの画面遷移図', gap: 40});
  d.add(caption('画面遷移: 一覧から詳細へ、詳細から編集または発注へ', {bold: true}));
  d.add(screens([
    {id: 'list', title: '一覧', root: [bar('在庫一覧', 1), wf.table(['品名', '在庫'], [['ボルト', '1,240'], ['ナット', '86']], {flex: 1})]},
    {id: 'detail', title: '詳細', tag: '改修', root: [bar('品目の詳細', 1), wf.kv([['品名', 'ナット M8'], ['在庫', '86']]), wf.chart({flex: 1, threshold: 0.4})]},
    {id: 'edit', title: '編集', tag: '新規', at: [1, 0.5], root: [bar('品目の編集', 1), wf.input('品名'), wf.input('在庫'), wf.btn('保存', {primary: true})]},
    {id: 'order', title: '発注', at: [1, 1.5], root: [bar('発注', 2), wf.select('発注先'), wf.btn('発注する', {primary: true})]},
  ], {skeleton: true, cols: 3, gap: 100, rowGap: 80, h: 250}));
  d.add(connect('list:right', 'detail:left', {label: '行を選ぶ', chip: true}));
  d.add(connect('detail:bottom@0.25', 'edit:top', {route: 'elbow', label: '編集', chip: true}));
  d.add(connect('detail:bottom@0.75', 'order:top', {route: 'elbow', label: '発注', chip: true}));
  return d;
}
