import {banner, box, caption, diagram, row, stat} from 'svg-diagram';

// 主役=solid / 次点=accent / その他=plain の 3 段階。新しい色は足さず、塗りの濃さで区別する。
// accent だけ、白黒でも plain と見分けがつくよう、この図に限って塗りをテーマの既定より濃い青（L* 約 86）にしている。
// legend: 'auto' は solid の図で accent を「次点」と読む。
export default function define() {
  return diagram({theme: 'blue', title: '施策の優先度(3 段階)', legend: 'auto', gap: 40, tones: {accent: {fill: '#c5d8f0'}}}).add(
    banner({headline: '今期は検索改善に集中する', sub: '主役は 1 つ、次点は 2 つまで', tone: 'solid'}),
    row([
      box({id: 'search', title: '検索改善', body: '離脱の最大要因', note: '工数 3 人月', tone: 'solid', step: 1, tag: '主役'}),
      box({id: 'onboard', title: 'オンボーディング', body: '初回の完了率を上げる', tone: 'accent', step: 2}),
      box({id: 'report', title: 'レポート刷新', body: '次点。検索の後に着手', tone: 'accent', step: 3}),
      box({id: 'misc', title: 'その他の改善', body: '随時対応'}),
    ]),
    caption('期待する効果', {bold: true, tone: 'text'}),
    row([
      stat('-30%', '検索からの離脱', {tone: 'solid'}),
      stat('+12%', '初回の完了率', {tone: 'accent'}),
      stat('0', '新規の障害'),
    ]),
  );
}
