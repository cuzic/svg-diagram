import {bars, caption, diagram} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'teal', title: '量の比較と構成比', gap: 28}).add(
    caption('横棒：導入前後', {bold: true, tone: 'text'}),
    bars([{label: '導入前', value: 76, series: 'a'}, {label: '導入後', value: 31, series: 'b'}], {max: 100, unit: '%'}),
    caption('縦棒：四半期ごとの件数', {bold: true, tone: 'text'}),
    bars([{label: 'Q1', value: 42, series: 'a'}, {label: 'Q2', value: 68, series: 'b'}, {label: 'Q3', value: 51, series: 'c'}], {max: 80, dir: 'v', height: 240}),
    caption('積み上げ：工程の構成比', {bold: true, tone: 'text'}),
    bars([{label: '企画', value: 16, series: 'a'}, {label: '実装', value: 34, series: 'b'}, {label: '検証', value: 34, series: 'c'}, {label: '運用', value: 16, series: 'a'}], {max: 100, unit: '%', stack: true}),
  );
}
