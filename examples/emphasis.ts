import {banner, box, caption, diagram, em, group, row, stat} from 'svg-diagram';

// 箱の文章の一部だけを太字・色にする。配列の中の文字列はそのままの文字で、強調は em.* の部品で書く。
export default function define() {
  return diagram({theme: 'blue', title: 'ブラウザ操作を任せるときの分担', accept: {'legend-missing': '数値の色は意味でなく強調。値と見出しで読める', 'gray-tone-collision': '強調の枠線と太字の数値で、白黒でも読める'}}).add(
    caption(['ブラウザ操作を ', em.b('Claude in Chrome'), ' に任せる'], {tone: 'text', role: 'body'}),
    row([
      box({
        title: '許可',
        body: ['操作してよいサイトは ', em.danger(em.b('ユーザー')), ' が決める。', em.b('API'), 's を呼ぶ前に確認する。'],
        note: ['例: ', em.b('lib/**/*.ts'), ' のような記号も、文字列ならそのまま'],
      }),
      box({
        title: '実行',
        body: ['手順は ', em.b('1 つずつ'), ' 進め、', em.muted('画面が変わったら'), ' 読み直す。'],
        lines: [{text: ['戻せない操作（', em.danger(em.b('送信・削除')), '）は止まる。']}],
      }),
    ]),
    group([
      box({title: '確認', body: ['結果は ', em.b('画面のスクリーンショット'), ' で残す。']}),
    ], {title: '記録と責任'}),
    row([
      stat('3', ['確認が要る操作の ', em.b('数')]),
      stat('0', '勝手に実行される操作', {tone: 'accent'}),
    ]),
    banner({headline: '任せるのは操作、決めるのは人', sub: ['迷ったら ', em.accent(em.b('止まって聞く'))]}),
  );
}
