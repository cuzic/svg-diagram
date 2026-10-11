import {caption, diagram, table} from 'svg-diagram';

// 3 層の表を、dense と行ごとの高さで 254px に収める
export default function define() {
  return diagram({theme: 'blue', title: '表の行高'}).add(
    caption('table({dense, headerH}) と行の h', {bold: true, tone: 'text'}),
    table(
      [{label: '層', flex: 1}, {label: '役割', flex: 3}, {label: '主な技術', flex: 2, mono: true}],
      [
        {cells: ['画面', '入力を受けて、結果を表示する', 'React'], h: 36},
        ['業務', '規則を適用し、権限を確かめる', 'Node.js'],
        {cells: ['データ', '保存し、履歴を残す', 'PostgreSQL'], tone: 'accent'},
      ],
      {dense: true, headerH: 30, cellH: 32, title: '3 層の構成', width: 560},
    ),
  );
}
