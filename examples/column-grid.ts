// 架空の取り込み処理の構成図（svg-diagram の列グリッド / 行の列を接続点にする / connectDefaults の使用例）。
// golden: ラベルつきの接続線で `cols` の行の隙間が広がること（同じ cols・gap の行はそろって広がる）を、出力の差分で見張る。
// ビルド: svg-diagram build examples/column-grid.ts --out examples/out/column-grid.svg
import {diagram, caption, box, row, connect} from 'svg-diagram';

export default function define() {
  const d = diagram({theme: 'blue', width: 940, gap: 28, title: '取り込み処理の構成（例）: 6 列グリッドの 3 段', legend: 'auto', connectDefaults: {chip: true, route: 'elbow'}, accept: {'gray-tone-collision': '入力（accent）と処理（plain）は段の位置と名前で読める。色は補助', 'graph-orphan-node': '「再生」は「ライブ表示」と同じ参照元から選ぶ並列の出口で、矢印は 1 本にまとめて示す例'}});

  const sources = row([
    box({id: 'cam', title: 'カメラ', body: '映像', tone: 'accent'}),
    box({id: 'lidar', title: 'LiDAR', body: '点群', tone: 'accent'}),
    box({id: 'gps', title: 'GNSS', body: '位置', tone: 'accent'}),
  ], {cols: [2, 2, 2], gap: 20, id: 'sources'});
  const pipeline = row([
    box({id: 'decode', title: 'デコード', body: '映像を展開'}),
    box({id: 'fuse', title: '統合', body: '時刻でそろえる'}),
    box({id: 'store', title: '保存', body: '時系列 DB'}),
  ], {cols: [2, 2, 2], gap: 20, id: 'pipeline'});
  const views = row([
    box({id: 'live', title: 'ライブ表示'}),
    box({id: 'replay', title: '再生'}),
  ], {cols: [3, 3], gap: 20, id: 'views'});

  d.add(caption('取り込み処理の構成', {bold: true}));
  d.add(sources, pipeline, views);
  d.add(
    connect(sources.col(1).bottom, 'decode:top', {label: 'RTP'}),
    connect('lidar:bottom', 'fuse:top', {label: 'UDP'}),
    connect('gps:bottom', 'fuse:top@0.8', {label: 'NMEA'}),
    connect('decode:right', 'fuse:left', {route: 'straight', label: '展開', chip: false}),
    connect('fuse:right', 'store:left', {route: 'straight', label: '同期'}),
    connect(pipeline.col(1, 2).bottom, views.col(1).top, {label: '参照'}),
  );
  return d;
}
