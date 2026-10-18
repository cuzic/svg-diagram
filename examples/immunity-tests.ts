import {caption, diagram, table} from 'svg-diagram';

// 免疫マップの続き: 固定観念を検証する表。1 行が 1 つの検証。検証は改善ではなく調べること(結果が固定観念を支えることもある)。
// 「試す固定観念」の列には、マップの箱の id ではなく固定観念の文を書く。
export default function define() {
  return diagram({theme: 'blue', title: '固定観念の検証(任せられない課長)', sourceLine: '出典: 説明用の例'}).add(
    caption('table: 行 = 1 つの検証。安全で小さく、すぐ実行できるものにする', {bold: true, tone: 'text'}),
    table(
      [
        {label: '試す固定観念', flex: 3}, {label: 'すること', flex: 3}, {label: '集めるデータ', flex: 3},
        {label: '安全か', flex: 2}, {label: '結果', flex: 2}, {label: '固定観念について分かったこと', flex: 3},
      ],
      [
        ['任せると品質が落ち、必ず責められる', '影響の小さい資料作成を 1 件、部下に任せる', '品質の指摘の有無、周囲の反応', '安全', '(実施前)', '(実施後に書く)'],
        ['頼ると頼りない人だと思われる', '上司に 1 件、判断の相談をしてみる', '相談後の上司の言葉と態度', '安全', '(実施前)', '(実施後に書く)'],
      ],
      {dense: true, width: 800, title: '行動実験'},
    ),
  );
}
