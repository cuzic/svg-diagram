import {arrowDiagram, diagram} from 'svg-diagram';

// アロー・ダイヤグラム: 丸が結合点（イベント）、矢印が作業（作業名と日数）。点線の矢印はダミー（順序だけ）。
// 各丸の「最早/最遅」の時刻、各作業の余裕、クリティカルパス（赤い太線）が自動で出る。始まりの丸と終わりの丸は 1 つずつ。
// 横に並べて幅（940px）に収まらないときは、`arrowDiagram(..., {dir: 'down'})` で縦に流す（examples/qc-arrow-long.ts）。
export default function define() {
  return diagram({theme: 'blue', title: '試作から納品までの日程（アロー・ダイヤグラム）', sourceLine: '出典: 説明用の例'}).add(
    ...arrowDiagram([
      {from: 1, to: 2, name: '設計', days: 5},
      {from: 2, to: 3, name: '試作', days: 8},
      {from: 2, to: 4, name: '調達', days: 6},
      {from: 3, to: 5, name: '評価', days: 4},
      {from: 4, to: 5, name: '組立', days: 3},
    ]),
  );
}
