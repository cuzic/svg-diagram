// 架空の在庫管理アプリのワイヤーフレーム（svg-diagram の wireframe() の使用例）。
// ビルド: svg-diagram build examples/inventory-wireframe.mjs --out examples/out/inventory-wireframe.svg
import {diagram, wireframe, wf} from 'svg-diagram';

export default function define() {
  const d = diagram({theme: 'blue', title: '在庫一覧のワイヤーフレームと、削除の確認ダイアログ'});
  const list = [
    wf.appbar('在庫管理', {nav: ['ダッシュボード', '在庫', '発注', '設定'], active: 1, right: ['田中']}),
    wf.row([wf.input('品名・型番で検索', {flex: 3, n: 1}), wf.select('倉庫: 東京', {flex: 2}), wf.btn('追加', {primary: true})], {align: 'center'}),
    wf.row([
      wf.table(['品名', '型番', '在庫', '状態'], [
        ['ボルト M8', 'B-0008', '1,240', {badge: '十分', tone: 'ok'}],
        ['ナット M8', 'N-0008', '86', {badge: '少ない', tone: 'danger'}],
        ['ワッシャー', 'W-0008', '310', {badge: '十分', tone: 'ok'}],
        ['スペーサー', 'S-0012', '0', {badge: '欠品', tone: 'danger'}],
      ], {flex: 3, n: 2}),
      wf.map({plan: 'site', flex: 2, label: '倉庫の位置', legend: [{kind: 'site', label: '倉庫'}, {kind: 'alert', label: '欠品あり'}],
        markers: [{x: 0.25, y: 0.3, kind: 'site', label: '東京', side: 'bottom'}, {x: 0.7, y: 0.5, kind: 'alert', label: '大阪', side: 'bottom'}]}),
    ], {flex: 1}),
  ];
  d.add(wireframe(list, {
    h: 400, title: '在庫一覧', tag: '改修',
    overlays: [wf.toast('保存しました', {n: 3})],
    notes: [
      {title: '検索', text: '品名か型番で絞り込む。'},
      {title: '在庫表', text: '少ない・欠品の行は強調して表示する。'},
      {title: '保存の通知', text: '操作の結果は、画面の右下に短く出す（toast）。'},
    ],
  }));
  d.add(wireframe(list, {
    h: 400, title: '在庫一覧（削除の確認）',
    overlays: [wf.dialog('「スペーサー」を削除しますか？', {body: '在庫が 0 の品目です。削除すると発注履歴は残りますが、一覧から消えます。', buttons: [wf.btn('キャンセル'), wf.btn('削除する', {primary: true, danger: true})], n: 1})],
    notes: [{title: '確認ダイアログ', text: '取り消せない操作の前に出す。背景は暗くし、操作できるのはダイアログだけにする。'}],
  }));
  return d;
}
