// 同じ行動でも、心の向き(箱の外/中)で相手に招くものが変わる。banner + row + group で描く。
// 箱の中/外は tone(new / muted)と legendLabels で凡例に書く。danger / removed は「異常・対象外」の意味で凡例が逆に読めるので使わない。
// ビルド: svg-diagram build examples/arbinger-iceberg.ts --out examples/out/arbinger-iceberg.svg
import {banner, box, caption, diagram, group, row} from 'svg-diagram';

export default function define() {
  return diagram({
    theme: 'blue', title: '同じ行動でも、心の向きで受け取られ方が変わる', legend: 'auto', sourceLine: '出典: 説明用の例',
    legendLabels: {'tone:new': '箱の外(相手を人として見る)', 'tone:muted': '箱の中(相手を物として見る)'},
  }).add(
    caption('見える行動は同じ', {bold: true}),
    banner({headline: '行動: 資料を渡す', tone: 'accent'}),
    banner({headline: '── 水面: ここから下は見えない ──', tone: 'muted'}),
    row([
      group([box({title: '心の向き', body: '相手を、事情のある一人の人として見る', tone: 'new'}), box({title: '相手に招くもの', body: '協力しやすい空気', tone: 'new'})], {title: 'A'}),
      group([box({title: '心の向き', body: '相手を、仕事を止める物として見る', tone: 'muted'}), box({title: '相手に招くもの', body: '身構える空気', tone: 'muted'})], {title: 'B'}),
    ], {cols: [6, 6]}),
  );
}
