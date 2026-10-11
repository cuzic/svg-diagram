import {caption, diagram, row, stat} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', title: '導入前後の離脱率'}).add(
    caption('導入前後の離脱率', {bold: true, tone: 'text'}),
    row([
      stat('76%', '導入前', {tone: 'danger', size: 'display'}),
      stat('31%', '導入後', {tone: 'accent', size: 'display'}),
    ]),
  );
}
