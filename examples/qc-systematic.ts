import {diagram, tree} from 'svg-diagram';

// 系統図法: 目的から手段へ、段階を追って展開する。左が目的、右へ行くほど具体的な手段になる（`tree` の `dir: 'right'`）。
// いちばん右の手段は、そのまま実行できる大きさまで具体化する。
export default function define() {
  return diagram({theme: 'blue', title: '不良率を半減させる方策展開（系統図）', sourceLine: '出典: 説明用の例'}).add(
    tree({
      label: '不良率を半減させる', tone: 'accent',
      children: [
        {label: '作業のばらつきをなくす', children: [{label: '手順書を作り直す'}, {label: '治具で位置を決める'}, {label: '新人教育を標準化する'}]},
        {label: '設備の状態を保つ', children: [{label: '刃物の交換基準を決める'}, {label: '日常点検をチェックシート化する'}]},
        {label: '不良を早く見つける', children: [{label: '工程内で寸法を測る'}, {label: '管理図で異常を知らせる'}]},
      ],
    }, {dir: 'right', maxNodeW: 190}),
  );
}
