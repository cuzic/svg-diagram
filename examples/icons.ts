import {box, caption, diagram, group, icon, iconRow, row} from 'svg-diagram';
import type {IconName} from 'svg-diagram';

const SHAPES = icon.pathNames;

export default function define() {
  const cell = (n: IconName) => ({icon: n, label: n});
  return diagram({theme: 'blue', title: 'メタファー用の絵記号'}).add(
    caption('メタファー用の絵記号（核心の数枚だけで使う）', {bold: true, tone: 'text'}),
    group([
      iconRow(SHAPES.slice(0, 5).map(cell)),
      iconRow(SHAPES.slice(5, 10).map(cell)),
      iconRow(SHAPES.slice(10, 15).map(cell)),
      iconRow(SHAPES.slice(15, 20).map(cell)),
      iconRow(SHAPES.slice(20).map(cell)),
    ], {title: 'box({icon}) / iconRow() — 図形として出す（色はトーン）'}),
    group([
      caption(icon.emojiNames.slice(0, 9).map(n => `${icon.emoji(n)} ${n}`).join('   '), {role: 'body', tone: 'text'}),
      caption(icon.emojiNames.slice(9).map(n => `${icon.emoji(n)} ${n}`).join('   '), {role: 'body', tone: 'text'}),
    ], {title: 'icon.emoji(name) — 文字列の中で使う（見た目は環境の絵文字フォント）'}),
    caption('例: 認証の橋渡し', {bold: true, tone: 'text'}),
    row([
      box({icon: 'person', title: '利用者', body: '社内の誰か'}),
      box({icon: 'fence', iconTone: 'danger', title: '認証ゲート', body: '通れるのは鍵を持つ人だけ'}),
      box({icon: 'database', iconTone: 'accent', title: '顧客データ', body: '鍵がないと開けない'}),
    ]),
    row([
      box({title: `${icon.emoji('key')} 鍵の管理`, body: '発行・失効・ローテーションを一か所で'}),
      box({title: `${icon.emoji('bridge')} 移行の橋`, body: '旧システムと新システムを並行運用でつなぐ'}),
    ]),
  );
}
