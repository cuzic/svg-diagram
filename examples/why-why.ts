import {diagram, whyWhyTree} from 'svg-diagram';
import type {WhyNode} from 'svg-diagram';

// なぜなぜ分析: 木（whyWhyTree）と表（whyWhyTable）。木は問題を上に、「なぜ?」の答えを下へ。矢印は原因 → 結果で、「なぜ?」は矢印をさかのぼって読む。
// 真因は二重枠、真因に打つ手（対策）は破線の棒。同じ内容を表にもできる。
export default function define() {
  const whys: WhyNode[] = [{
    why: '修正に時間がかかった',
    because: [
      {why: '影響範囲が広かった', because: [{why: '検証が最後に集中していた', trueCause: true, measure: '結合テストを毎週回す'}]},
      {why: '不具合の発見が遅かった', because: [{why: '監視の項目が足りない', trueCause: true, measure: 'アラートを足す'}]},
    ],
  }];
  return diagram({theme: 'blue', title: 'リリースが遅れた原因（なぜなぜ分析）', legend: 'auto', sourceLine: '出典: 説明用の例'}).add(whyWhyTree('リリースが遅れた', whys, {id: 'ww'}));
}
