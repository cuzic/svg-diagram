import {diagram, faultTree} from 'svg-diagram';

// 故障の木: 禁止ゲート(六角形)は、入力が 1 つで、条件(楕円の記号)が成り立つときだけ出力する。家の記号は「常に起きる / 起きない」の仮定。
export default function define() {
  return diagram({theme: 'blue', title: '設定ミスで全断する故障の木', sourceLine: '出典: 説明用の例'}).add(
    faultTree(
      {
        label: '本番が全断する',
        gate: 'or',
        children: [
          {label: '設定ミスで全断', gate: 'inhibit', children: [{label: '設定を変更した', kind: 'basic'}], condition: {label: '検証をしていない', p: 0.1}},
          {label: '保守作業中の停止', kind: 'house', state: false},
        ],
      },
      {id: 'fta2'},
    ),
  );
}
