import {canvas, diagram} from 'svg-diagram';

// ビジネスモデルキャンバス（Strategyzer 配置）: 左から パートナー / 活動・リソース / 提供価値 / 関係・チャネル / 顧客セグメント、下にコストと収益。
// 領域の内容は箇条書きの配列。`emphasis` で提供価値を重点にする（色だけでなく「重点」のタグが付く）。
export default function define() {
  return diagram({theme: 'blue', title: '宅配ミールキットのビジネスモデル', sourceLine: '出典: 説明用の例'}).add(
    canvas('bmc', {
      partners: ['地元の契約農家', '冷蔵物流の会社', '決済代行'],
      activities: ['献立の開発', '仕入れと小分け', '定期便の配送'],
      resources: ['管理栄養士のレシピ', '小分け用の調理場', '配送網'],
      value: ['20 分で作れる夕食', '食材の買い物と献立決めが要らない', '余らせず、捨てずに済む'],
      relationships: ['アプリで献立を選べる', '休止・変更がいつでもできる'],
      channels: ['自社アプリ', 'SNS の広告', '勤務先の福利厚生'],
      segments: ['共働きの子育て世帯', '平日に料理の時間が取れない単身者'],
      cost: ['食材の仕入れ', '配送費', '調理場の人件費', 'アプリの開発・運用'],
      revenue: ['定期便の月額（週 3 回で 9,800 円）', '単品の追加注文', '企業向けの福利厚生プラン'],
    }, {title: 'ビジネスモデルキャンバス', emphasis: ['value'], stamp: '架空の例', id: 'bmc'}),
  );
}
