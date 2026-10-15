import {caption, diagram, row, stat} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', title: '導入前後の離脱率', accept: {'legend-missing': '数値の色は意味でなく強調。値と見出しで読める', 'gray-tone-collision': '強調の枠線と太字の数値で、白黒でも読める', 'stat-fit-shrunk': '細い列の値は箱に収まる大きさまで縮む(意図)'}}).add(
    caption('導入前後の離脱率', {bold: true, tone: 'text'}),
    row([
      stat('76%', '導入前', {tone: 'danger', size: 'display'}),
      stat('31%', '導入後', {tone: 'accent', size: 'display'}),
      stat('3割未満', '目標', {size: 'display', flex: 0.5}), // a narrow column: the value shrinks to fit instead of failing
    ]),
  );
}
