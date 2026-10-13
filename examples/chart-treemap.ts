import {diagram, treemap} from 'svg-diagram';

// ツリーマップ: 面積が値に比例する。グループは枠と見出しで、葉は名前と値を書く。小さすぎて入らない葉は描かず、説明（<desc>）に残る。
// tone: 'accent' / 'danger' の葉は塗りつぶしで目立たせる。
export default function define() {
  return diagram({theme: 'blue', title: '事業別・製品別の売上構成', sourceLine: '出典: 説明用の例'}).add(
    treemap(
      [
        {label: 'クラウド', children: [{label: 'ストレージ', value: 420, id: 'storage'}, {label: '計算基盤', value: 310}, {label: 'データベース', value: 180}, {label: 'ネットワーク', value: 70}, {label: 'その他', value: 12}]},
        {label: 'ソフトウェア', children: [{label: '業務パッケージ', value: 260, tone: 'accent'}, {label: '開発ツール', value: 150}, {label: '保守', value: 95}]},
        {label: 'ハードウェア', children: [{label: 'サーバー', value: 120}, {label: '端末', value: 85, tone: 'danger'}, {label: '周辺機器', value: 20}]},
        {label: 'その他', value: 40},
      ],
      {unit: '億円', percent: true, height: 440},
    ),
  );
}
