import {diagram, sankey} from 'svg-diagram';

// サンキー図: 流入元から購入までの流れ。ノードの高さもリボンの太さも値に比例し（目盛りは図全体で一つ）、名前の横に値を書く。
// 十分に太いリボンには値が入る。tone: 'danger' のリボンは赤の破線で縁取られる（色だけに頼らない）。
export default function define() {
  return diagram({theme: 'blue', title: 'サイト訪問から購入までの流れ', sourceLine: '出典: 説明用の例'}).add(
    sankey(
      [
        {id: 'ad', label: '広告'}, {id: 'seo', label: '自然検索'}, {id: 'sns', label: 'SNS'}, {id: 'visit', label: 'サイト訪問'},
        {id: 'cart', label: 'カート投入'}, {id: 'bounce', label: '離脱', tone: 'muted'}, {id: 'buy', label: '購入'}, {id: 'abandon', label: 'カート放棄', tone: 'muted'},
      ],
      [
        {from: 'ad', to: 'visit', value: 520}, {from: 'seo', to: 'visit', value: 380}, {from: 'sns', to: 'visit', value: 160},
        {from: 'visit', to: 'cart', value: 280}, {from: 'visit', to: 'bounce', value: 750, tone: 'danger'},
        {from: 'cart', to: 'buy', value: 120}, {from: 'visit', to: 'buy', value: 30}, {from: 'cart', to: 'abandon', value: 160, tone: 'danger'},
      ],
      {unit: '人', height: 420},
    ),
  );
}
