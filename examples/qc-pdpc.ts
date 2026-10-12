import {diagram, pdpc} from 'svg-diagram';

// PDPC法（過程決定計画図）: 着手からゴールまでの道筋（実線）と、途中で起こりうる懸念（六角形）、そのときの対策（黄）を点線でつなぐ。
// 対策から道筋へ戻る矢印は「ここへ戻る」。
export default function define() {
  return diagram({theme: 'blue', title: '新製品の立ち上げ計画（PDPC）', sourceLine: '出典: 説明用の例'}).add(
    pdpc(
      [
        {id: 'start', label: '設計に着手', role: 'start'},
        {id: 'proto', label: '試作する'},
        {id: 'test', label: '評価試験'},
        {id: 'line', label: '量産ラインを準備'},
        {id: 'goal', label: '量産開始', role: 'goal'},
        {id: 'r1', label: '強度が足りない', role: 'risk'},
        {id: 'm1', label: '材質を変更して再試作', role: 'measure'},
        {id: 'r2', label: '部品の納期が遅れる', role: 'risk'},
        {id: 'm2', label: '代替の仕入先に切り替える', role: 'measure'},
      ],
      [
        {from: 'start', to: 'proto'}, {from: 'proto', to: 'test'}, {from: 'test', to: 'line'}, {from: 'line', to: 'goal'},
        {from: 'test', to: 'r1'}, {from: 'r1', to: 'm1'}, {from: 'm1', to: 'proto'},
        {from: 'line', to: 'r2'}, {from: 'r2', to: 'm2'}, {from: 'm2', to: 'goal'},
      ],
      {maxNodeW: 150},
    ),
  );
}
