// 幸福の決定要因(リュボミアスキーほか): 遺伝 50% / 環境 10% / 意図的な活動 40%。変えられるのは後者、という図。
// 割合は研究で広く引かれる目安で、個人の幸福度の内訳ではない(出典に書く)。100% の積み上げ 1 本で描く。
// ビルド: svg-diagram build examples/positive-determinants.ts --out examples/out/positive-determinants.svg
import {diagram, stackedBars} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', title: '幸福度のばらつきを左右する要因', sourceLine: '出典: Lyubomirsky ほかの整理に基づく目安(説明用に簡略化)'}).add(
    stackedBars(
      [{label: '幸福度の差', parts: [{label: '遺伝(設定値)', value: 50}, {label: '環境(境遇)', value: 10}, {label: '意図的な活動', value: 40}]}],
      {percent: true},
    ),
  );
}
