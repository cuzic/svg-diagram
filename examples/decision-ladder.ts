import {decisionLadder, diagram} from 'svg-diagram';

// 判断のはしご: はい/いいえの質問を縦に積み、「はい」は右の答え、「いいえ」は下の次の質問へ。最後の「いいえ」は最後の箱で終わる。
// 判断が 1 本の鎖なら flowchart より小さく、16:9 のスライドに 14pt 以上で収まる。幅は 640 にすると文字がさらに大きく読める。
export default function define() {
  return diagram({theme: 'blue', title: '来館者の受け付け', width: 640, sourceLine: '出典: 図書室の運用メモ(例)'}).add(
    decisionLadder(
      [
        {q: '貸出票は書いてある？', yes: '窓口で受け付ける'},
        {q: '返却期限は守れる？', yes: '貸出の手続きに進む'},
        {q: '予約の本はある？', yes: '予約棚から取り出す'},
        {q: '館内で読むだけ？', yes: '閲覧席へ案内する'},
        {q: '次回の入荷を待てる？', yes: '入荷の連絡を登録する', sub: '7 日間有効'},
      ],
      '後日の来館をお願いする',
    ),
  );
}
