import {diagram, faultTree} from 'svg-diagram';

// 故障の木(FTA): 頂上事象から、ゲート(AND / OR / 多数決)で原因をたどり、基本事象(円)・未展開(ひし形)で終わる。
// 事象の文は矩形に書き、種類の記号はその下に付く。`ref` は同じ基本事象をもう一度描く(線は飛ばさない)。線に矢じりは無い(下へ読む)。
export default function define() {
  return diagram({theme: 'blue', title: 'サービス停止の故障の木', sourceLine: '出典: 説明用の例'}).add(
    faultTree(
      {
        label: 'サービス停止',
        gate: 'or',
        children: [
          {
            label: 'DB 全体停止',
            gate: 'and',
            children: [
              {label: '主系 DB 停止', kind: 'basic', p: 1e-3},
              {id: 'sw', label: '待機系へ切替不能', kind: 'basic', p: 5e-2},
            ],
          },
          {
            label: 'アプリ全台停止',
            gate: 'vote',
            k: 2,
            children: [
              {label: 'AP1 停止', kind: 'basic'},
              {label: 'AP2 停止', kind: 'basic'},
              {label: 'AP3 停止', kind: 'basic'},
            ],
          },
          {label: '回線断', gate: 'or', children: [{label: '光回線の障害', kind: 'undeveloped'}, {ref: 'sw'}]},
        ],
      },
      {id: 'fta1', maxNodeW: 'auto'},
    ),
  );
}
