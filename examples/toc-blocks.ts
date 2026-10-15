import {causeTree, diagram} from 'svg-diagram';

// ネガティブブランチ: 施策が悪い結果(UDE)を引き起こしかねないとき、それを防ぐ施策から `kind: 'blocks'` の辺を引く。
// 破線で、矢じりの代わりに横棒(T 字の端)で止まる。因果の矢印とは形で区別できる。AND には入れられない。
export default function define() {
  return diagram({theme: 'blue', title: '施策のネガティブブランチ', sourceLine: '出典: 説明用の例'}).add(
    causeTree(
      [
        {id: 'inj', label: '着手の前に空き枠を確認する', role: 'injection'},
        {id: 'fix', label: '着手を絞る'},
        {id: 'ok', label: '納期を守れる', role: 'de'},
        {id: 'idle', label: '現場が手持ち無沙汰になる', role: 'ude'},
        {id: 'plan', label: '空き枠で次の案件を前倒す', role: 'injection'},
      ],
      [
        {from: 'inj', to: 'fix'},
        {from: 'fix', to: 'ok'},
        {from: 'fix', to: 'idle'},
        {from: 'plan', to: 'idle', kind: 'blocks'},
      ],
      {maxNodeW: 170},
    ),
  );
}
