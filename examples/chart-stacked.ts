import {diagram, stackedBars} from 'svg-diagram';

// 積み上げ棒グラフ: 売上の内訳。各部分に数字が入り、列の上に合計が出る。percent: true で 100% 積み上げになる。
export default function define() {
  return diagram({theme: 'blue', title: '売上の内訳の推移', sourceLine: '出典: 説明用の例'}).add(
    stackedBars(
      [
        {label: '2022', parts: [{label: '国内', value: 62}, {label: '北米', value: 21}, {label: '欧州', value: 12}]},
        {label: '2023', parts: [{label: '国内', value: 64}, {label: '北米', value: 29}, {label: '欧州', value: 14}]},
        {label: '2024', parts: [{label: '国内', value: 61}, {label: '北米', value: 38}, {label: '欧州', value: 19}]},
        {label: '2025', parts: [{label: '国内', value: 63}, {label: '北米', value: 47}, {label: '欧州', value: 26}]},
      ],
      {unit: '億円'},
    ),
    stackedBars(
      [
        {label: '2022', parts: [{label: '国内', value: 62}, {label: '北米', value: 21}, {label: '欧州', value: 12}]},
        {label: '2025', parts: [{label: '国内', value: 63}, {label: '北米', value: 47}, {label: '欧州', value: 26}]},
      ],
      {unit: '億円', percent: true, height: 300},
    ),
  );
}
