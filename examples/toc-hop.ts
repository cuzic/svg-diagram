import {causeTree, diagram} from 'svg-diagram';

// 避けられない交差の見せ方(ADR 0028): `hop: true` を書くと、戻りの矢印(`back: true`)が他の線を横切る箇所に、小さな弧が付く。
// 弧は戻りの線の側が、層の流れに逆らう側へ膨らんで飛び越す。AND の弧や矢じりの近く、帯の外へ出る箇所には付けない。書かなければ、今までと同じ図になる。
export default function define() {
  return diagram({theme: 'blue', title: '好循環の戻りが他の線を飛び越す(未来現実ツリー)', sourceLine: '出典: 説明用の例'}).add(
    causeTree(
      [
        {id: 'cap', label: '着手の枠を決める', role: 'injection'},
        {id: 'wip', label: '仕掛りが減る'},
        {id: 'focus', label: '1 つずつ仕上げる'},
        {id: 'quality', label: '手直しが減る'},
        {id: 'ask', label: '営業が納期を相談できる'},
        {id: 'fact', label: '受注の量は変えない'},
        {id: 'review', label: '週に一度、枠を見直す'},
        {id: 'ontime', label: '納期を守れる'},
        {id: 'trust', label: '顧客の信頼が増える', role: 'de'},
      ],
      [
        {from: 'cap', to: 'wip'},
        {from: 'wip', to: 'focus'},
        {from: 'wip', to: 'quality'},
        {from: 'cap', to: 'ask'},
        {from: 'cap', to: 'fact'},
        {from: 'cap', to: 'review'},
        {from: 'review', to: 'ontime'},
        {from: 'ask', to: 'trust'},
        {from: 'ontime', to: 'trust'},
        {from: 'trust', to: 'cap', back: true},
      ],
      {hop: true},
    ),
  );
}
