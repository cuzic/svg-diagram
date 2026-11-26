import {diagram, flowchart} from '../../lib/dsl.ts';
export default function define() {
  return diagram({theme: 'blue', width: 1640, title: '貸出の申し込みの受け付け(例)'}).add(
    flowchart(
      [
        {id: 'q1', kind: 'decision', label: '利用者カードを持っている？'},
        {id: 'a1', label: 'カードで受け付ける'},
        {id: 'q2', kind: 'decision', label: '本人確認の書類がある？'},
        {id: 'a2', label: 'その場でカードを作る'},
        {id: 'q3', kind: 'decision', label: '家族がカードを持っている？'},
        {id: 'a3', label: '家族の同意書で受け付ける'},
        {id: 'q4', kind: 'decision', label: '館内で読むだけ？'},
        {id: 'a4', label: '閲覧席へ案内する'},
        {id: 'q5', kind: 'decision', label: '予約だけしたい？'},
        {id: 'a5', label: '仮予約の票を渡す', sub: '7 日間有効'},
        {id: 'end', label: '後日の来館をお願いする'},
      ],
      [
        {from: 'q1', to: 'a1', label: 'はい'}, {from: 'q1', to: 'q2', label: 'いいえ'},
        {from: 'q2', to: 'a2', label: 'はい'}, {from: 'q2', to: 'q3', label: 'いいえ'},
        {from: 'q3', to: 'a3', label: 'はい'}, {from: 'q3', to: 'q4', label: 'いいえ'},
        {from: 'q4', to: 'a4', label: 'はい'}, {from: 'q4', to: 'q5', label: 'いいえ'},
        {from: 'q5', to: 'a5', label: 'はい'}, {from: 'q5', to: 'end', label: 'いいえ'},
      ],
      {dir: 'right'},
    ),
  );
}
