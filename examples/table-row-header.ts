import {caption, diagram, table} from 'svg-diagram';

// 3 層の表。左端を行ラベルにして(rowHeader)、dense と cellH で高さをそろえる
export default function define() {
  return diagram({theme: 'blue', title: '3 層の表(行ラベル)'}).add(
    caption('table({rowHeader, dense, cellH})', {bold: true, tone: 'text'}),
    table(
      [{label: '層', flex: 1}, {label: '役割', flex: 3}, {label: '主な技術', flex: 2, mono: true}],
      [
        ['画面', '入力を受けて、結果を表示する', 'React'],
        ['業務', '規則を適用し、権限を確かめる', 'Node.js'],
        {cells: ['データ', '保存し、履歴を残す', 'PostgreSQL'], tone: 'muted'},
      ],
      {rowHeader: true, dense: true, cellH: 36, title: '3 層の構成', width: 560},
    ),
  );
}
