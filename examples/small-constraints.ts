import {banner, box, caption, diagram, group, row, table} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', title: '小さな制約の解消'}).add(
    caption('group({frame: false}) / table({cellH}) / stamp', {bold: true, tone: 'text'}),
    row([
      group([table(
        [{label: '層', flex: 1}, {label: '役割', flex: 2}],
        [['画面', '入力を受ける'], ['業務', '規則を適用する'], ['データ', '保存する']],
        {cellH: 44},
      )], {frame: false}),
      box({title: '画面の例', body: '実際の画面ではない', stamp: '架空の例'}),
    ]),
    group([box({title: '構成のイメージ', body: '図の中の枠'})], {title: '社内', stamp: 'イメージ'}),
    banner({headline: '要点', sub: '数字は例', stamp: '要確認'}),
  );
}
