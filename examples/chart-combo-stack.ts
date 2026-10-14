import {diagram, combo} from 'svg-diagram';

// コンボチャート（積み上げ）: 地域別の売上を積み上げ、合計を上に。営業利益率を折れ線（右軸）で重ねる。
export default function define() {
  return diagram({theme: 'blue', title: '地域別売上と営業利益率', sourceLine: '出典: 説明用の例'}).add(
    combo(
      ['2022', '2023', '2024', '2025'],
      [
        {label: '国内', type: 'bar', values: [620, 660, 700, 740]},
        {label: '海外', type: 'bar', values: [180, 260, 340, 430]},
        {label: '営業利益率', type: 'line', values: [7, 9, 11, 13]},
      ],
      {stack: true, y: {unit: '億円'}, y2: {unit: '%', min: 0, max: 20}},
    ),
  );
}
