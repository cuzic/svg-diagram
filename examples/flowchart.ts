import {diagram, flowchart} from 'svg-diagram';

// 判断フロー: 処理・判断（ひし形）・開始/終了（角の丸い箱）を書くだけで、上から下へ自動配置する。
// 判断から出る矢印には Yes / No を付ける。ひし形は、質問の長さに合わせて大きくなる。やり直し（戻る矢印）は外側を回る。
export default function define() {
  return diagram({theme: 'blue', title: '相談を受けたときの判断フロー', sourceLine: '出典: 運用ガイド(例)'}).add(
    flowchart(
      [
        {id: 'start', kind: 'terminator', label: '新人からの相談'},
        {id: 'q1', kind: 'decision', label: '自分で答えられる？'},
        {id: 'a1', label: '回答する'},
        {id: 'q2', kind: 'decision', label: '調べればわかる？'},
        {id: 'a2', label: '調べて回答する', sub: '24 時間以内'},
        {id: 'q3', kind: 'decision', label: '業務・スキルの問題？'},
        {id: 'a3', label: '上司に相談する', sub: '目安: 当日中'},
        {id: 'a4', label: '人事・相談窓口に報告する', sub: '目安: 即時', tone: 'danger'},
      ],
      [
        {from: 'start', to: 'q1'},
        {from: 'q1', to: 'a1', label: 'Yes'}, {from: 'q1', to: 'q2', label: 'No'},
        {from: 'q2', to: 'a2', label: 'Yes'}, {from: 'q2', to: 'q3', label: 'No'},
        {from: 'q3', to: 'a3', label: 'Yes'}, {from: 'q3', to: 'a4', label: 'No'},
        {from: 'a2', to: 'q1', label: 'まだ解決しない', line: 'dashed'},
      ],
    ),
  );
}
