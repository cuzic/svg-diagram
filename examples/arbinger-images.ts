// 自己正当化のイメージの型を表にする。table で足りる。
// 型の名前と並べ方は、手元の書籍の訳語に合わせて書き換える(この例は説明用で、用語は書籍で要照合)。
// ビルド: svg-diagram build examples/arbinger-images.ts --out examples/out/arbinger-images.svg
import {caption, diagram, table} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', title: '自分を正当化するイメージの型', legend: false, sourceLine: '出典: 説明用の例(用語は書籍で要照合)'}).add(
    caption('型ごとに、相手の見え方と行動が決まる', {bold: true}),
    table([{label: '型'}, {label: '自分のイメージ'}, {label: '相手への見方'}, {label: '典型の行動'}], [
      ['自分は優れている', '私のほうが分かっている', '相手は分かっていない', '指図する・口を挟む'],
      ['自分には当然の権利がある', '私は報われるべきだ', '相手は邪魔をしている', '要求する・不満を溜める'],
      ['きちんとした人に見られたい', '私は立派でいたい', '相手は評価する側', '取り繕う・弱みを隠す'],
      ['自分は不当に扱われている', '私は報われない', '相手が悪い', 'ため息・黙って抱え込む'],
    ], {title: '型の例'}),
  );
}
