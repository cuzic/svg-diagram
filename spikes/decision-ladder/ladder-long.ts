import {diagram, decisionLadder} from '../../lib/dsl.ts';
export default function define() {
  return diagram({theme: 'blue', title: '貸出の申し込みの受け付け(例)'}).add(
    decisionLadder([
      {q: '市内に住んでいるか、市内の学校や職場に通っている？', yes: 'カードで受け付ける'},
      {q: '本人確認の書類がある？', yes: 'その場でカードを作る'},
      {q: '家族がカードを持っている？', yes: '家族の同意書で受け付ける'},
      {q: '館内で読むだけ？', yes: '閲覧席へ案内する'},
      {q: '予約だけしたい？', yes: '仮予約の票を渡す', sub: '7 日間有効'},
    ], {label: '後日の来館をお願いする', sub: '必要な書類の一覧を渡す'}, {question: 'box'}),
  );
}
