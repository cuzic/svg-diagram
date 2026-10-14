import {box, caption, diagram, group, row} from 'svg-diagram';

// A row of groups with different amounts of content: the frames are stretched to the tallest one, and the shorter groups'
// content is centred in the room that leaves (group({valign}) = 'top' keeps it at the top, 'stretch' makes a single box fill it).
export default function define() {
  return diagram({theme: 'blue', title: '部門ごとの確認項目', layoutCheck: 'strict'}).add(
    caption('部門ごとの確認項目', {bold: true, tone: 'text'}),
    row([
      group([
        box({title: '申請内容の確認'}),
        box({title: '添付書類の確認'}),
        box({title: '金額の確認'}),
        box({title: '期限の確認'}),
      ], {title: '経理部'}),
      group([box({title: '総合判断'})], {title: '承認者'}),
    ], {cols: [6, 6]}),
  );
}
