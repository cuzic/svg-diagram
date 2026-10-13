import {diagram, tornado} from 'svg-diagram';

// トルネード図: 前提を一つずつ振ったときの結果（営業利益）。基準から左が低ケース、右が高ケースの結果で、結果の幅が大きい前提ほど上にくる。
export default function define() {
  return diagram({theme: 'blue', title: '営業利益の感度分析', sourceLine: '出典: 説明用の例'}).add(
    tornado(
      [
        {label: '販売単価（±10%）', low: 640, high: 1360},
        {label: '原材料費（±15%）', low: 1210, high: 790},
        {label: '販売数量（±8%）', low: 780, high: 1220},
        {label: '為替（±5円）', low: 880, high: 1130},
        {label: '人件費（±3%）', low: 950, high: 1050},
        {label: '物流費', low: 970, high: 1030},
      ],
      {base: 1000, unit: '百万円', lowLabel: '前提が低いとき', highLabel: '前提が高いとき'},
    ),
  );
}
