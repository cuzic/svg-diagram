import {diagram, combo} from 'svg-diagram';

// コンボチャート: 売上と営業利益を棒（左軸）、営業利益率を折れ線（右軸）で、規模と収益性を一緒に見せる。
export default function define() {
  return diagram({theme: 'blue', title: '売上・営業利益と営業利益率', sourceLine: '出典: 説明用の例'}).add(
    combo(
      ['2021', '2022', '2023', '2024', '2025'],
      [
        {label: '売上', type: 'bar', values: [820, 910, 1040, 1180, 1330]},
        {label: '営業利益', type: 'bar', values: [49, 64, 94, 130, 173]},
        {label: '営業利益率', type: 'line', values: [6, 7, 9, 11, 13]},
      ],
      {y: {unit: '億円'}, y2: {unit: '%', min: 0, max: 20}},
    ),
  );
}
