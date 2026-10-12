import {diagram, tree} from 'svg-diagram';

// 同じ階層に並ぶ数が多いときは、dir: 'right' で左から右へ展開する。
export default function define() {
  return diagram({theme: 'teal', title: 'サービスの依存関係(階層)'}).add(
    tree({
      label: 'ショップ', tone: 'accent',
      children: [
        {label: '注文', children: [{label: '在庫引当'}, {label: '決済', sub: '外部 API'}, {label: '配送手配'}]},
        {label: '会員', children: [{label: '認証'}, {label: 'ポイント'}]},
        {label: '商品', children: [{label: '検索'}, {label: '推薦'}, {label: 'レビュー'}, {label: '画像変換'}]},
      ],
    }, {dir: 'right'}),
  );
}
