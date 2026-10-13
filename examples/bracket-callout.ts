// 注釈のコネクタ: bracket(区間を示す括弧)と callout(吹き出し)。
import {box, bracket, callout, caption, diagram, row} from 'svg-diagram';

export default function define() {
  const r = row([box({title: '受付'}), box({title: '審査'}), box({title: '承認'}), box({title: '通知'})], {id: 'r', arrows: 'between'});
  return diagram({theme: 'blue', title: '対象の区間'}).add(
    caption('審査と承認の区間だけが対象', {bold: true, tone: 'text'}),
    r,
    bracket(r.col(2).left, r.col(3).right, {label: '対象の区間'}),
    callout(r.col(4).bottom, {text: '結果はメールで届く', side: 'below'}),
  );
}
