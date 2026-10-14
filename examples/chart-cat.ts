import {boxplot, catplot, diagram, row, swarmplot} from 'svg-diagram';

// seaborn の箱ひげ図・バイオリン・スウォーム・ポイントプロット: 生の値を渡すだけで、四分位・密度・信頼区間は計算される。
// 値は固定（乱数を使わない）なので、何度描いても同じ図になる。
const tokyo = [52, 58, 61, 63, 64, 66, 67, 69, 70, 72, 74, 75, 77, 81, 84, 96];
const osaka = [41, 47, 50, 52, 54, 55, 57, 58, 60, 61, 63, 65, 66, 70, 71];
const nagoya = [48, 53, 57, 59, 60, 62, 63, 64, 66, 67, 69, 72, 75, 78];
export default function define() {
  return diagram({theme: 'blue', title: '拠点別の月間売上（箱ひげ図・バイオリン・スウォーム）', sourceLine: '出典: 説明用の例'}).add(
    row([
      boxplot({東京: tokyo, 大阪: osaka, 名古屋: nagoya}, {label: '売上（百万円）', counts: true, values: 'median'}),
      catplot({東京: tokyo, 大阪: osaka, 名古屋: nagoya}, {kind: ['violin', 'swarm'], label: '売上（百万円）'}),
    ]),
    catplot(
      [
        {label: '第1四半期', hues: [{name: '新規', values: [32, 35, 38, 41, 44, 47]}, {name: '既存', values: [51, 54, 56, 59, 62, 66, 70]}]},
        {label: '第2四半期', hues: [{name: '新規', values: [40, 43, 46, 49, 55, 58]}, {name: '既存', values: [49, 52, 55, 57, 60, 61, 64]}]},
        {label: '第3四半期', hues: [{name: '新規', values: [48, 52, 57, 60, 63, 68]}, {name: '既存', values: [47, 50, 53, 54, 58, 59, 61]}]},
      ],
      {kind: 'point', label: '平均売上（百万円）', height: 280},
    ),
    swarmplot({東京: tokyo, 大阪: osaka, 名古屋: nagoya}, {dir: 'h', label: '売上（百万円）'}),
  );
}
