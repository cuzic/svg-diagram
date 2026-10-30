// ポーターの価値連鎖（バリューチェーン）。支援活動を横帯に、主活動を矢羽根に、右端にマージンの矢印を置く。
// ビルド: svg-diagram build examples/value-chain.ts --out examples/out/value-chain.svg
import {diagram, valueChain} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', title: '価値連鎖（バリューチェーン）'}).add(valueChain({
    support: [
      {label: '全般管理（インフラストラクチャ）', sub: '財務・経理・法務・経営企画'},
      {label: '人事・労務管理', sub: '採用・教育・評価'},
      {label: '技術開発', sub: '製品設計・工程改善'},
      {label: '調達活動', sub: '原材料・設備・サービスの購買'},
    ],
    primary: [
      {id: 'inbound', label: '購買物流', sub: '受入れ・保管'},
      {id: 'ops', label: '製造', sub: '加工・組立'},
      {id: 'outbound', label: '出荷物流', sub: '配送・在庫'},
      {id: 'sales', label: '販売・マーケティング', sub: '広告・営業'},
      {id: 'service', label: 'サービス', sub: '保守・サポート'},
    ],
  }));
}
