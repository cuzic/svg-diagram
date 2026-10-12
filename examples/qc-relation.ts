import {diagram, relationDiagram} from 'svg-diagram';

// 連関図: 因果が絡み合う問題の要因を書き出し、原因 → 結果の矢印でつなぐ。戻る矢印・交差する矢印も引ける。
// 各要因の「出 n・入 m」は出る矢印と入る矢印の数。出る矢印がいちばん多い要因（2 本以上）が自動で二重枠（主原因）になる。
// `problem` は取り上げる問題（赤）。
export default function define() {
  return diagram({theme: 'blue', title: '納期遅れの連関図', sourceLine: '出典: 説明用の例'}).add(
    relationDiagram(
      [
        {id: 'late', label: '納期に遅れる'},
        {id: 'rush', label: '急ぎの割り込み'},
        {id: 'multi', label: '並行作業が多い'},
        {id: 'sw', label: '切り替えのロス'},
        {id: 'plan', label: '計画が守られない'},
        {id: 'est', label: '見積もりが甘い'},
        {id: 'skill', label: '経験者に集中'},
        {id: 'over', label: '残業が増える'},
        {id: 'tired', label: '疲れてミスが増える'},
      ],
      [
        {from: 'rush', to: 'multi'}, {from: 'multi', to: 'sw'}, {from: 'sw', to: 'late'}, {from: 'est', to: 'plan'}, {from: 'plan', to: 'rush'},
        {from: 'est', to: 'over'}, {from: 'est', to: 'multi'}, {from: 'skill', to: 'sw'}, {from: 'skill', to: 'late'}, {from: 'over', to: 'tired'}, {from: 'tired', to: 'late'},
        {from: 'tired', to: 'plan'}, {from: 'plan', to: 'late'},
      ],
      {problem: 'late', maxNodeW: 150},
    ),
  );
}
