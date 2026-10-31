import {diagram, swimlane} from 'svg-diagram';

// サービスブループリント: 顧客の行動を縦の上から、接点・裏の業務・支援の順に並べ、レーンの境目に 3 本の線を引く。
//   相互作用線（顧客と会社が接する所）／ 可視線（顧客から見える所と見えない所）／ 内部相互作用線（裏の業務と支援）
// 線は swimlane の `boundaries: [{between: [上のレーンの id, 下のレーンの id], label?}]`（レーンを足すと隣り合わなくなって throw するので、線の意味が黙って変わらない）。
// 名前の幅だけラベル列が要る（labelW を書かなければ自動で広がる。`内部相互作用線` は 134px）。物的証拠と顧客の行動の間には線を引かない（顧客の行動の各手順の真上に置く）。
// 失敗点・待ちは手順の `tag` / `stamp` で書く。顧客の感情は journeyMap()。矢印にラベルを付けると、境目の線に重なることがあるので `labelAt` で外す。
// ビルド: svg-diagram build examples/service-blueprint.ts --out examples/out/service-blueprint.svg

export default function define() {
  return diagram({theme: 'blue', width: 940, title: 'ミールキット宅配の注文（架空の例）'}).add(
    swimlane(
      [
        {id: 'ev', label: '物的証拠', tone: 'muted'},
        {id: 'cust', label: '顧客の行動'},
        {id: 'front', label: '表の業務（接点）'},
        {id: 'back', label: '裏の業務'},
        {id: 'sys', label: '支援システム', tone: 'muted'},
      ],
      [
        {lane: 'ev', title: 'アプリの画面', col: 1}, {lane: 'ev', title: '配達の箱とチラシ', col: 3},
        {id: 'c1', lane: 'cust', title: '献立を選ぶ', col: 1},
        {id: 'c2', lane: 'cust', title: '注文を確定する'},
        {id: 'c3', lane: 'cust', title: '箱を受け取る', tag: '待ち'},
        {id: 'f1', lane: 'front', title: '注文を受け付ける', col: 2},
        {id: 'f2', lane: 'front', title: '配達員が手渡す', col: 3},
        {id: 'b1', lane: 'back', title: '食材を小分けする', col: 2, tag: '失敗点'},
        {id: 's1', lane: 'sys', title: '在庫・注文の管理', col: 2, span: 2},
      ],
      {boundaries: [{between: ['cust', 'front'], label: '相互作用線'}, {between: ['front', 'back'], label: '可視線'}, {between: ['back', 'sys'], label: '内部相互作用線'}],
       flows: [{from: 'c1', to: 'c2'}, {from: 'c2', to: 'c3'}, {from: 'c2', to: 'f1'}, {from: 'f1', to: 'b1'}, {from: 'b1', to: 'f2'}, {from: 'f2', to: 'c3'}, {from: 's1', to: 'b1'}],
       phases: [{label: '注文', from: 1, to: 2}, {label: '受け取り', from: 3, to: 3}]},
    ),
  );
}
