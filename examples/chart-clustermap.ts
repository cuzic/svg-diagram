import {clustermap, diagram} from 'svg-diagram';

// seaborn の clustermap: 表を渡すと、行と列が階層クラスタリング（平均連結法）の順に並び、樹形図が付く。
// 似た行・列が隣り合うので、元の並びでは見えなかったまとまりが見える。
const shops = ['渋谷', '新宿', '池袋', '梅田', '難波', '天王寺', '栄', '名駅'];
const items = ['コーヒー', '紅茶', 'ラテ', 'サンド', 'ケーキ', 'スープ'];
const sales = [
  [90, 20, 80, 15, 12, 40], [85, 25, 75, 20, 15, 45], [30, 80, 25, 70, 65, 20], [88, 22, 78, 18, 10, 42],
  [28, 78, 30, 72, 60, 18], [35, 75, 22, 68, 70, 25], [60, 50, 55, 45, 40, 35], [32, 82, 28, 74, 68, 22],
];
export default function define() {
  return diagram({theme: 'blue', title: '店舗×商品の販売数（クラスタ付きヒートマップ）', sourceLine: '出典: 説明用の例'}).add(
    clustermap(shops, items, sales, {unit: '個'}),
  );
}
