// 架空の在庫管理アプリの「部品の仕様」（svg-diagram の stateMatrix() / frame / parts / wf.region() の使用例）。
// 画面全体は粗く（領域と見る順）、部品は別の図で詳しく（構成と、状態の一覧）。
// ビルド: svg-diagram build examples/inventory-component-spec.mjs --out examples/out/inventory-component-spec.svg
import {diagram, caption, stateMatrix, wireframe, wf} from 'svg-diagram';

const stock = (o = {}) => wf.card([wf.kv([['在庫', '24 個'], ['棚', 'A-03']])], {title: 'ボルト M6', ...o});
const results = (o = {}) => wf.card([wf.list([{text: 'ボルト M6', badge: '十分', tone: 'ok'}, {text: 'ナット M6', badge: '少ない', tone: 'danger'}])], o);

export default function define() {
  const d = diagram({theme: 'blue', width: 940, gap: 28, title: '在庫画面の部品の仕様（例）: 全体の領域、部品の構成、部品の状態'});

  d.add(caption('1 全体の領域（粗い図）', {bold: true}));
  d.add(wireframe(wf.col([
    wf.region('ナビゲーション', {h: 40}),
    wf.row([
      wf.region('検索と絞り込み', {w: 220, n: true, emphasis: 'primary', hint: '最初に見る'}),
      wf.col([wf.region('検索結果の一覧', {n: true}), wf.region('選んだ在庫の詳細', {n: true})], {flex: 1}),
    ], {flex: 1}),
  ]), {h: 280, title: '在庫画面（全体）', notes: [
    {title: '検索と絞り込み', text: '品名・倉庫で絞る。最初に目が行く場所。'},
    {title: '検索結果', text: '絞り込んだ在庫の一覧。0 件のときは空の状態（下の一覧表）。'},
    {title: '詳細', text: '選んだ在庫の数と棚。詳細は、次の「在庫インサイト」の構成を参照。'},
  ]}));

  d.add(caption('2 在庫インサイトの構成', {bold: true}));
  d.add(wireframe(wf.col([wf.insight({
    title: '在庫が発注点を下回っている', level: 'danger', text: '発注点は 30 個。早めの発注を勧める。',
    evidence: [{kind: '在庫数 24 個', at: '10/9 10:24'}], parts: {level: true, title: true, evidence: true, reference: true},
  })]), {frame: 'light', h: 'fit', title: '在庫インサイト', notes: [
    {title: '重要度', text: '要確認・注意・参考の 3 段。'},
    {title: '題名', text: '1 行で言い切る。'},
    {title: '根拠', text: '根拠の種類と取得時刻は必須。欠けた所見は作れない。'},
    {title: '参考表示', text: '判断の根拠にはしない。'},
  ]}));

  d.add(caption('3 部品の状態の一覧', {bold: true}));
  d.add(stateMatrix(['通常', '読み込み中', '空', 'エラー', '古い情報'], [
    {label: '在庫カード', cells: [stock(), stock({state: 'loading'}), {na: '必ず 1 件ある'}, stock({state: 'disconnected', stateTitle: '取得できません', stateNote: '再試行'}), stock({state: 'stale', stateNote: '10:24'})]},
    {label: '検索結果', note: '0 件のとき空', cells: [results(), results({state: 'loading'}), results({state: 'empty', stateNote: '該当なし'}), results({state: 'disconnected', stateTitle: '取得できません', stateNote: '再試行'}), results({state: 'stale', stateNote: '10:24'})]},
  ], {required: ['通常', '読み込み中', '空', 'エラー']}));
  return d;
}
